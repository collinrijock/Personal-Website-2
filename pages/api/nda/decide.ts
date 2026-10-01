// POST /api/nda/decide: the confirm button on /nda/decide. the token in the
// body says which request and which action; a request can be decided once.
// an approval also carries "sections": the ticked boxes (a form sends one
// field per box) or a json array. one to four of the fixed ids, nothing else.
// a form post gets a 303 back to the decide page (a fixed path, so there's no
// open redirect); a json post gets json. there's no origin check here: the
// decide page sends no referrer, so browsers post it with "Origin: null", and
// the signed token in the body is the only thing that authorises a decision.
import type { NextApiRequest, NextApiResponse } from "next";
import { decide, Refusal } from "@/lib/nda/flow";
import { clientIp, limited, privateHeaders } from "@/lib/nda/http";

export const config = { api: { bodyParser: { sizeLimit: "4kb" } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  privateHeaders(res);
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }
  const wantsJson = String(req.headers["content-type"] || "").includes("application/json");
  const token = req.body && typeof req.body.token === "string" ? req.body.token : "";
  const back = (q: string) => res.redirect(303, `/nda/decide?token=${encodeURIComponent(token)}&${q}`);
  if (limited(`decide:${clientIp(req)}`, 30, 60 * 60 * 1000)) return wantsJson ? res.status(429).json({ error: "slow down." }) : res.status(429).send("slow down.");
  try {
    const out = await decide(token, req.body ? req.body.sections : undefined);
    return wantsJson ? res.status(200).json({ ok: true, ...out }) : back(`done=${out.mailed ? "1" : "nomail"}`);
  } catch (err) {
    if (err instanceof Refusal) {
      if (wantsJson) return res.status(err.status).json({ error: err.message });
      // the page works out why from the token
      return back(err.status === 409 ? "done=already" : err.status === 422 ? "failed=none" : "failed=1");
    }
    console.error("nda: decide failed:", err);
    return wantsJson ? res.status(500).json({ error: "something went wrong." }) : res.status(500).send("something went wrong.");
  }
}
