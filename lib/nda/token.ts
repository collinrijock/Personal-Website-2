// signed, expiring tokens: base64url(json payload) + "." + base64url(hmac-sha256).
// the purpose ("decide", "access", "cookie") is inside the signed payload, so a
// token minted for one job can't be replayed as another.
import { createHmac, timingSafeEqual } from "crypto";
import { ndaConfig } from "./config";
import { isSection, type SectionId } from "./sections";

export type Purpose = "decide" | "access" | "cookie";
export type Action = "approve" | "deny";
export interface TokenPayload {
  p: Purpose;
  r: string; // request id
  a?: Action; // decide tokens only
  s?: SectionId[]; // approve tokens only: the sections the page starts with ticked
  e: number; // expiry, ms since epoch
}

const b64 = (b: Buffer) => b.toString("base64url");

function mac(body: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(`nda.v1.${body}`).digest();
}

export function signToken(payload: TokenPayload, secret = ndaConfig().secret): string {
  if (!secret) throw new Error("NDA_SECRET is not set");
  const body = b64(Buffer.from(JSON.stringify(payload)));
  return `${body}.${b64(mac(body, secret))}`;
}

export type Verified = { ok: true; payload: TokenPayload } | { ok: false; reason: "invalid" | "expired" };

export function verifyToken(token: unknown, purpose: Purpose, secret = ndaConfig().secret): Verified {
  if (!secret || typeof token !== "string" || token.length > 600) return { ok: false, reason: "invalid" };
  const m = /^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!m) return { ok: false, reason: "invalid" };
  const want = mac(m[1], secret);
  const got = Buffer.from(m[2], "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return { ok: false, reason: "invalid" };
  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(m[1], "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (!payload || payload.p !== purpose || typeof payload.r !== "string" || !/^[a-z0-9]{6,32}$/.test(payload.r) || typeof payload.e !== "number") {
    return { ok: false, reason: "invalid" };
  }
  if (purpose === "decide" && payload.a !== "approve" && payload.a !== "deny") return { ok: false, reason: "invalid" };
  if (payload.s !== undefined && (!Array.isArray(payload.s) || payload.s.length > 4 || !payload.s.every(isSection))) return { ok: false, reason: "invalid" };
  if (Date.now() > payload.e) return { ok: false, reason: "expired" };
  return { ok: true, payload };
}
