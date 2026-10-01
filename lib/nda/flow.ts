// the gate itself: take a request, decide it once, hand out access, check it.
// the api routes and pages are thin wrappers around these.
import type { IncomingMessage } from "http";
import { ACCESS_TTL, DECIDE_TTL, ndaConfig } from "./config";
import { approvedEmail, deniedEmail, ownerRequestEmail } from "./emails";
import { clean, clientIp, EMAIL_RE, readCookie, sameName } from "./http";
import { sendMail } from "./mail";
import { NDA_VERSION } from "./nda-text";
import { addRequest, addStatus, getRequest, openRequestFor, withLock, type NdaRequest } from "./store";
import { signToken, verifyToken, type Action } from "./token";

export const LIMITS = { name: 120, email: 254, company: 120, reason: 800, signature: 120 };

export class Refusal extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function decideUrl(id: string, a: Action, exp: number) {
  return `${ndaConfig().siteUrl}/nda/decide?token=${encodeURIComponent(signToken({ p: "decide", r: id, a, e: exp }))}`;
}
export function accessUrl(id: string) {
  const exp = Date.now() + ACCESS_TTL;
  return { url: `${ndaConfig().siteUrl}/nda/access?token=${encodeURIComponent(signToken({ p: "access", r: id, e: exp }))}`, exp };
}

export interface RequestInput {
  name?: unknown;
  email?: unknown;
  company?: unknown;
  reason?: unknown;
  signature?: unknown;
  agree?: unknown;
  nda_version?: unknown;
}

export function validate(body: RequestInput) {
  const name = clean(body.name, LIMITS.name);
  const email = clean(body.email, LIMITS.email).toLowerCase();
  const company = clean(body.company, LIMITS.company);
  const reason = clean(body.reason, LIMITS.reason, true);
  const signature = clean(body.signature, LIMITS.signature);
  if (name.length < 2) throw new Refusal(400, "please enter your full name.");
  if (!EMAIL_RE.test(email)) throw new Refusal(400, "that email doesn't look right.");
  if (reason.length < 4) throw new Refusal(400, "say a few words about what you'd like to see and why.");
  if (!signature) throw new Refusal(400, "type your full name to sign.");
  if (!sameName(signature, name)) throw new Refusal(400, "the signature has to match your full name.");
  if (body.agree !== true && body.agree !== "on" && body.agree !== "true") throw new Refusal(400, "check \"i agree\" to sign.");
  if (body.nda_version !== NDA_VERSION) throw new Refusal(409, "the agreement was just updated. please reload the page and read it again.");
  return { name, email, company, reason, signature };
}

export async function submitRequest(req: IncomingMessage, body: RequestInput) {
  const fields = validate(body);
  const c = ndaConfig();
  const line = await withLock(() => {
    if (openRequestFor(fields.email)) throw new Refusal(429, "you already have a request in. you'll get an email once collin decides.");
    return addRequest({ ...fields, ip: clientIp(req), user_agent: clean(req.headers["user-agent"], 300) });
  });
  const exp = Date.now() + DECIDE_TTL;
  const mail = ownerRequestEmail(line, decideUrl(line.id, "approve", exp), decideUrl(line.id, "deny", exp), exp, c.notifyDenied);
  try {
    await sendMail({ to: c.ownerEmail, replyTo: line.email, kind: "owner-request", ref: line.id, ...mail });
  } catch (err) {
    console.error(`nda: owner mail failed for ${line.id}:`, (err as Error).message);
    await withLock(() => addStatus(line.id, "failed", "request", "owner email failed to send"));
    throw new Refusal(502, "something went wrong sending that. please try again in a little while.");
  }
  console.log(`nda: request ${line.id} recorded`);
  return line.id;
}

export type DecideView =
  | { state: "invalid" }
  | { state: "expired" }
  | { state: "missing" }
  | { state: "ready" | "done"; action: Action; request: NdaRequest };

// what the decide page shows for a token (it never changes anything)
export function viewDecision(token: unknown): DecideView {
  const v = verifyToken(token, "decide");
  if (!v.ok) return { state: v.reason };
  const r = getRequest(v.payload.r);
  if (!r) return { state: "missing" };
  return { state: r.status === "pending" ? "ready" : "done", action: v.payload.a!, request: r };
}

// the one place a request gets approved or denied from the email links
export async function decide(token: unknown) {
  const v = verifyToken(token, "decide");
  if (!v.ok) throw new Refusal(v.reason === "expired" ? 410 : 400, v.reason === "expired" ? "this link has expired." : "this link isn't valid.");
  const { r: id, a } = v.payload;
  const status = a === "approve" ? "approved" : "denied";
  const r = await withLock(() => {
    const cur = getRequest(id);
    if (!cur) throw new Refusal(404, "that request doesn't exist.");
    if (cur.status !== "pending") throw new Refusal(409, `this request was already ${cur.status}.`);
    addStatus(id, status, "email");
    return { ...cur, status } as NdaRequest;
  });
  const c = ndaConfig();
  let mailed = true;
  try {
    if (status === "approved") {
      const { url, exp } = accessUrl(id);
      await sendMail({ to: r.email, replyTo: c.ownerEmail, kind: "approved", ref: id, ...approvedEmail(r, url, exp) });
    } else if (c.notifyDenied) {
      await sendMail({ to: r.email, replyTo: c.ownerEmail, kind: "denied", ref: id, ...deniedEmail(r) });
    }
  } catch (err) {
    mailed = false;
    console.error(`nda: ${status} mail failed for ${id}:`, (err as Error).message);
  }
  console.log(`nda: request ${id} ${status}`);
  return { id, status, mailed };
}

// a valid cookie for a request that is still approved, or null
export function currentAccess(req: IncomingMessage): NdaRequest | null {
  const v = verifyToken(readCookie(req), "cookie");
  if (!v.ok) return null;
  const r = getRequest(v.payload.r);
  return r && r.status === "approved" ? r : null;
}

export function cookieFor(id: string) {
  return { value: signToken({ p: "cookie", r: id, e: Date.now() + ACCESS_TTL }), maxAge: Math.floor(ACCESS_TTL / 1000) };
}
