// small request helpers: client ip, rate limits, escaping, input cleanup, cookies.
import type { IncomingMessage } from "http";
import { ndaConfig, COOKIE_NAME } from "./config";

export function clientIp(req: IncomingMessage): string {
  const cf = req.headers["cf-connecting-ip"];
  if (typeof cf === "string" && cf.trim()) return cf.trim().slice(0, 64);
  const xff = req.headers["x-forwarded-for"];
  const first = (Array.isArray(xff) ? xff[0] : xff || "").split(",")[0].trim();
  if (first) return first.slice(0, 64);
  return (req.socket?.remoteAddress || "unknown").replace(/^::ffff:/, "").slice(0, 64);
}

// a sliding-window limiter in memory. it resets when the server restarts,
// which is fine: the store also refuses a second pending request per email.
const hits = new Map<string, number[]>();
export function limited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (list.length >= max) {
    hits.set(key, list);
    return true;
  }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) hits.forEach((v, k) => { if (!v.some((t) => now - t < 86_400_000)) hits.delete(k); });
  return false;
}

export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// trim, drop control characters (newlines too unless multiline), cap the length
export function clean(v: unknown, max: number, multiline = false): string {
  if (typeof v !== "string") return "";
  let s = v.normalize("NFC").replace(multiline ? /[\u0000-\u0009\u000b-\u001f\u007f\u2028\u2029]/g : /[\u0000-\u001f\u007f\u2028\u2029]/g, "");
  if (multiline) s = s.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n");
  s = s.trim();
  return s.length > max ? s.slice(0, max) : s;
}

export const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export const sameName = (a: string, b: string) => a.toLowerCase().replace(/\s+/g, " ").trim() === b.toLowerCase().replace(/\s+/g, " ").trim();

// a post from a browser must come from this site
export function sameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return true; // curl, server-to-server, old browsers: fine, there are no cookies to ride on
  try {
    const o = new URL(origin);
    if (o.origin === ndaConfig().siteOrigin) return true;
    return !!req.headers.host && o.host === req.headers.host;
  } catch {
    return false;
  }
}

export function accessCookie(value: string, maxAgeSec: number): string {
  // Secure everywhere except a plain-http SITE_URL that isn't localhost (browsers
  // already accept Secure cookies on http://localhost and 127.0.0.1)
  const u = ndaConfig().siteUrl;
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(u);
  const secure = u.startsWith("https://") || local;
  return `${COOKIE_NAME}=${value}; Path=/nda; Max-Age=${maxAgeSec}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function readCookie(req: IncomingMessage, name = COOKIE_NAME): string | null {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

export function privateHeaders(res: { setHeader(k: string, v: string): unknown }) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
}
