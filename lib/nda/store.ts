// the request log: NDA_DATA_DIR/requests.jsonl, append-only. a request is one
// line with status "pending"; every change after that (approved, denied,
// revoked, failed) is another line. the current state of a request is its
// first line with the later lines folded over it.
//
// writes are one write() call on an O_APPEND fd followed by fsync, so a line
// lands whole or not at all. anything that reads-then-writes (deciding, so a
// request can only be decided once) holds a lock file, which scripts/nda.mjs
// honours too.
import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { ndaConfig } from "./config";
import { NDA_TEXT, NDA_VERSION } from "./nda-text";

export type Status = "pending" | "approved" | "denied" | "revoked" | "failed";

export interface RequestLine {
  t: "request";
  id: string;
  name: string;
  email: string;
  company: string;
  reason: string;
  signature: string;
  nda_version: string;
  signed_at: string;
  ip: string;
  user_agent: string;
  status: "pending";
}
export interface StatusLine {
  t: "status";
  id: string;
  status: Status;
  at: string;
  via: string;
  note?: string;
}
export interface NdaRequest extends Omit<RequestLine, "t" | "status"> {
  status: Status;
  history: { status: Status; at: string; via: string; note?: string }[];
  decided_at?: string;
}

const dir = () => ndaConfig().dataDir;
const logPath = () => path.join(dir(), "requests.jsonl");
const lockPath = () => path.join(dir(), "requests.lock");

function ensureDir() {
  fs.mkdirSync(dir(), { recursive: true, mode: 0o700 });
}

// short, unguessable, url-safe: 12 chars of base32 (60 bits)
const ALPHA = "abcdefghijkmnpqrstuvwxyz23456789";
export function newId(): string {
  const b = randomBytes(12);
  let s = "";
  for (let i = 0; i < 12; i++) s += ALPHA[b[i] & 31];
  return s;
}

function appendLine(obj: RequestLine | StatusLine) {
  ensureDir();
  const fd = fs.openSync(logPath(), "a", 0o600);
  try {
    fs.writeSync(fd, JSON.stringify(obj) + "\n");
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

export function readAll(): Map<string, NdaRequest> {
  const out = new Map<string, NdaRequest>();
  let raw = "";
  try {
    raw = fs.readFileSync(logPath(), "utf8");
  } catch (err: any) {
    if (err && err.code === "ENOENT") return out;
    throw err;
  }
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let o: any;
    try {
      o = JSON.parse(line);
    } catch {
      continue; // a torn line from a crash: skip it
    }
    if (o.t === "request" && typeof o.id === "string" && !out.has(o.id)) {
      const { t, ...rest } = o as RequestLine;
      out.set(o.id, { ...rest, status: "pending", history: [{ status: "pending", at: o.signed_at, via: "request" }] });
    } else if (o.t === "status" && out.has(o.id)) {
      const r = out.get(o.id)!;
      r.status = o.status;
      r.history.push({ status: o.status, at: o.at, via: o.via, note: o.note });
      if (o.status === "approved" || o.status === "denied") r.decided_at = r.decided_at || o.at;
    }
  }
  return out;
}

export function getRequest(id: string): NdaRequest | null {
  return readAll().get(id) || null;
}

// cross-process lock: O_EXCL create, retry, and break locks older than 10s
export async function withLock<T>(fn: () => Promise<T> | T): Promise<T> {
  ensureDir();
  const p = lockPath();
  for (let i = 0; ; i++) {
    try {
      fs.closeSync(fs.openSync(p, "wx", 0o600));
      break;
    } catch (err: any) {
      if (err.code !== "EEXIST") throw err;
      try {
        if (Date.now() - fs.statSync(p).mtimeMs > 10_000) fs.unlinkSync(p);
      } catch {}
      if (i > 200) throw new Error("nda store is locked");
      await new Promise((r) => setTimeout(r, 25));
    }
  }
  try {
    return await fn();
  } finally {
    try {
      fs.unlinkSync(p);
    } catch {}
  }
}

export function addRequest(r: Omit<RequestLine, "t" | "id" | "status" | "nda_version" | "signed_at">): RequestLine {
  saveNdaVersion();
  const line: RequestLine = { t: "request", id: newId(), ...r, nda_version: NDA_VERSION, signed_at: new Date().toISOString(), status: "pending" };
  appendLine(line);
  return line;
}

export function addStatus(id: string, status: Status, via: string, note?: string): StatusLine {
  const line: StatusLine = { t: "status", id, status, at: new Date().toISOString(), via, ...(note ? { note } : {}) };
  appendLine(line);
  return line;
}

// the exact text of each version anyone has signed, written once, atomically
function saveNdaVersion() {
  const d = path.join(dir(), "nda-versions");
  const f = path.join(d, `${NDA_VERSION}.txt`);
  if (fs.existsSync(f)) return;
  fs.mkdirSync(d, { recursive: true, mode: 0o700 });
  const tmp = `${f}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, NDA_TEXT, { mode: 0o600 });
  fs.renameSync(tmp, f);
}

// is there already a live request from this email? (pending in the last 7 days, or approved)
export function openRequestFor(email: string): NdaRequest | null {
  const e = email.toLowerCase();
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const r of Array.from(readAll().values())) {
    if (r.email.toLowerCase() !== e) continue;
    if (r.status === "pending" && Date.parse(r.signed_at) > weekAgo) return r;
  }
  return null;
}

// the exact agreement a request signed, from the saved copy (or the current text if it's the same version)
export function ndaTextFor(version: string): string | null {
  if (version === NDA_VERSION) return NDA_TEXT;
  if (!/^[A-Za-z0-9.-]{1,64}$/.test(version)) return null;
  try {
    return fs.readFileSync(path.join(dir(), "nda-versions", `${version}.txt`), "utf8");
  } catch {
    return null;
  }
}
