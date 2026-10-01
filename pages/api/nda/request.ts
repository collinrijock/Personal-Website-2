// POST /api/nda/request: a signed nda request from the modal.
// validates, checks the honeypot, rate-limits per ip and per email, records the
// signature, and emails collin approve / deny links.
import type { NextApiRequest, NextApiResponse } from "next";
import { ndaOpen } from "@/lib/nda/config";
import { Refusal, submitRequest } from "@/lib/nda/flow";
import { clientIp, limited, sameOrigin } from "@/lib/nda/http";

export const config = { api: { bodyParser: { sizeLimit: "16kb" } } };

const HOUR = 60 * 60 * 1000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }
  if (!sameOrigin(req)) return res.status(403).json({ error: "not allowed." });
  const gate = ndaOpen();
  if (!gate.open) {
    console.warn(`nda: request refused, closed: ${gate.why}`);
    return res.status(503).json({ error: "requests aren't open yet." });
  }
  const body = req.body && typeof req.body === "object" ? req.body : {};
  // the honeypot: people never see this field. say thanks and do nothing
  if (typeof body.website === "string" && body.website.trim()) return res.status(200).json({ ok: true });
  const ip = clientIp(req);
  if (limited(`ip:${ip}`, 5, HOUR)) return res.status(429).json({ error: "too many requests from here. try again in an hour." });
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
  if (email && limited(`email:${email}`, 3, 24 * HOUR)) return res.status(429).json({ error: "too many requests for that email today." });
  try {
    await submitRequest(req, body);
    return res.status(200).json({ ok: true });
  } catch (err) {
    if (err instanceof Refusal) return res.status(err.status).json({ error: err.message });
    console.error("nda: request failed:", err);
    return res.status(500).json({ error: "something went wrong. please try again." });
  }
}
