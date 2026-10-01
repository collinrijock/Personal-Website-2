// GET /api/nda/terms: the agreement the modal shows, its version, and whether
// requests are open. the modal sends the version back, so a signature is always
// for the exact text that was on screen.
import type { NextApiRequest, NextApiResponse } from "next";
import { ndaOpen } from "@/lib/nda/config";
import { NDA_TEXT, NDA_TITLE, NDA_VERSION } from "@/lib/nda/nda-text";
import { LIMITS } from "@/lib/nda/flow";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method not allowed" });
  }
  const { open } = ndaOpen();
  res.status(200).json({ open, title: NDA_TITLE, version: NDA_VERSION, text: NDA_TEXT, limits: LIMITS });
}
