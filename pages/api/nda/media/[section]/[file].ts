// /nda/media/<section>/<file>: videos and images for the section files, behind
// the same gate as /nda. the browser url sits under /nda because the access
// cookie is Path=/nda; next.config.js rewrites it to this route. a direct hit
// on /api/nda/media/... carries no cookie, so it gets a 403.
//
// order matters: method, then access, then the section id, then the grant, and
// only then the filesystem. someone without the section learns nothing about
// which files exist in it.
//
// files live in NDA_DATA_DIR/media/<section>/. names are strict (no dots up
// front, no slashes, no traversal), the resolved and real paths both have to
// stay inside that dir, and only regular files are served. single byte ranges
// are supported so video seeking works.
import fs from "fs";
import path from "path";
import type { NextApiRequest, NextApiResponse } from "next";
import { ndaConfig } from "@/lib/nda/config";
import { currentAccess } from "@/lib/nda/flow";
import { privateHeaders } from "@/lib/nda/http";
import { mediaType, validMediaName } from "@/lib/nda/media";
import { isSection } from "@/lib/nda/sections";
import { grantedSections } from "@/lib/nda/store";

export const config = { api: { responseLimit: false, bodyParser: false } };

function fail(res: NextApiResponse, status: number, msg: string) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(msg + "\n");
}

// a single "bytes=" range. null: no usable range header (serve the whole file).
// "bad": a well-formed range that can't be satisfied (416).
function parseRange(h: string | undefined, size: number): { start: number; end: number } | "bad" | null {
  if (!h) return null;
  const m = /^bytes=\s*(\d*)\s*-\s*(\d*)\s*$/i.exec(h.trim()); // multiple ranges (a comma) don't match: whole file
  if (!m || (!m[1] && !m[2])) return null;
  if (!m[1]) {
    const n = Number(m[2]);
    if (!Number.isSafeInteger(n)) return null;
    if (n === 0 || size === 0) return "bad";
    return { start: Math.max(0, size - n), end: size - 1 };
  }
  const start = Number(m[1]);
  const end = m[2] ? Number(m[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return null;
  if (m[2] && end < start) return null; // invalid per rfc 9110: ignore it
  if (start >= size) return "bad";
  return { start, end: Math.min(end, size - 1) };
}

const inside = (dir: string, p: string) => p.startsWith(dir + path.sep) && p.length > dir.length + 1;

export default async function media(req: NextApiRequest, res: NextApiResponse) {
  privateHeaders(res);
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Accept-Ranges", "bytes");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return fail(res, 405, "method not allowed");
  }
  const r = currentAccess(req);
  if (!r) return fail(res, 403, "forbidden");
  const section = req.query.section;
  const file = req.query.file;
  if (!isSection(section)) return fail(res, 404, "not found");
  // not granted: 403, decided before the filesystem is touched
  if (!grantedSections(r).includes(section)) return fail(res, 403, "forbidden");
  if (!validMediaName(file)) return fail(res, 404, "not found");

  const dir = path.resolve(ndaConfig().dataDir, "media", section);
  const full = path.resolve(dir, file);
  if (!inside(dir, full) || path.dirname(full) !== dir) return fail(res, 404, "not found");

  let fd: number | null = null;
  try {
    // symlinks are followed only if they land inside the section's own dir
    const [realDir, real] = await Promise.all([fs.promises.realpath(dir), fs.promises.realpath(full)]);
    if (!inside(realDir, real)) return fail(res, 404, "not found");
    fd = await new Promise<number>((ok, no) => fs.open(real, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0), (e, n) => (e ? no(e) : ok(n))));
    const st = await new Promise<fs.Stats>((ok, no) => fs.fstat(fd!, (e, s) => (e ? no(e) : ok(s))));
    if (!st.isFile()) throw Object.assign(new Error("not a file"), { code: "ENOTFILE" });

    const size = st.size;
    const etag = `"${size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
    res.setHeader("Content-Type", mediaType(file));
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("ETag", etag);
    res.setHeader("Last-Modified", st.mtime.toUTCString());

    // If-Range: only honour the range if the file is still the one they have
    const ifRange = req.headers["if-range"];
    const rangeHeader = ifRange && ifRange !== etag && ifRange !== st.mtime.toUTCString() ? undefined : req.headers.range;
    const range = parseRange(rangeHeader, size);
    if (range === "bad") {
      res.setHeader("Content-Range", `bytes */${size}`);
      fs.close(fd, () => {});
      fd = null;
      return fail(res, 416, "range not satisfiable");
    }
    const start = range ? range.start : 0;
    const end = range ? range.end : size - 1;
    res.statusCode = range ? 206 : 200;
    if (range) res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
    res.setHeader("Content-Length", String(size === 0 ? 0 : end - start + 1));

    if (req.method === "HEAD" || size === 0) {
      fs.close(fd, () => {});
      fd = null;
      return res.end();
    }
    const stream = fs.createReadStream("", { fd, start, end, autoClose: true });
    fd = null; // the stream owns it now
    res.on("close", () => stream.destroy()); // client went away mid-file
    stream.on("error", (err) => {
      console.error(`nda: media stream failed for ${section}/${file}:`, err.message);
      if (!res.headersSent) {
        res.removeHeader("Content-Length");
        res.removeHeader("Content-Range");
        fail(res, 500, "error");
      }
      else res.destroy();
    });
    stream.pipe(res);
  } catch (err: any) {
    if (fd != null) fs.close(fd, () => {});
    const code = err && err.code;
    if (code === "ENOENT" || code === "ENOTDIR" || code === "ELOOP" || code === "ENOTFILE" || code === "EISDIR") return fail(res, 404, "not found");
    console.error(`nda: media failed for ${section}/${file}:`, err && err.message);
    return fail(res, 500, "error");
  }
}
