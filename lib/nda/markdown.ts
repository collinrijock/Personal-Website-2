// a deliberately small markdown renderer for the section files (NDA_DATA_DIR/sections/<id>.md).
// it escapes everything first, then adds back a short list of constructs:
// # / ## / ### headings, paragraphs, - and 1. lists, > quotes, --- rules,
// **bold**, *italic*, `code`, and [links](https://...) (http, https, mailto
// and same-site paths only). no raw html gets through.
//
// media: a line on its own of the form
//   ![video](media/<section>/<file>.mp4 "media/<section>/<poster>.jpg")
//   ![video: a caption](media/<section>/<file>.webm "poster.jpg")
//   ![alt text](media/<section>/<file>.png)
// becomes a <figure class="nda-media"> with a native <video controls> (or an
// <img>) pointing at /nda/media/<section>/<file>, which is gated like /nda. the
// poster is optional: a full media/ path, or a bare filename in the video's
// dir. a video's caption is its alt text with a leading "video:" dropped (none
// if the alt is just "video"); an image's alt is its alt attribute, no caption.
// anything that doesn't match exactly stays escaped plain text.
//
// each "## " heading starts a new project card. on /nda the section is an h2
// and each card an h3, so headings inside a card start at h3.
import { esc } from "./http";
import { MEDIA_FILE_SRC, mediaType } from "./media";
import { SECTION_IDS } from "./sections";

const MEDIA_PATH_RE = new RegExp(`^media/(${SECTION_IDS.join("|")})/(${MEDIA_FILE_SRC})$`);
const EMBED_RE = /^!\[([^\]]*)\]\(([^\s()"]+)(?:\s+"([^"]*)")?\)$/;

// media/<section>/<file> -> { section, file }, or null unless it is exactly that
function mediaPath(p: string): { section: string; file: string } | null {
  const m = MEDIA_PATH_RE.exec(p);
  if (!m || m[2].includes("..")) return null;
  return { section: m[1], file: m[2] };
}
const isVideo = (f: string) => /\.(mp4|webm)$/i.test(f);

// one embed line -> a figure, or null to fall back to escaped text
function embed(line: string): string | null {
  const m = EMBED_RE.exec(line);
  if (!m) return null;
  const [, alt, src, title] = m;
  const media = mediaPath(src);
  if (!media) return null;
  const url = `/nda/media/${media.section}/${media.file}`;
  if (!isVideo(media.file)) {
    if (title !== undefined) return null;
    return `<figure class="nda-media"><img src="${esc(url)}" alt="${esc(alt.trim())}" loading="lazy"></figure>`;
  }
  let poster = "";
  if (title !== undefined) {
    const pm = /^[^/]+$/.test(title) ? mediaPath(`media/${media.section}/${title}`) : mediaPath(title);
    if (!pm || isVideo(pm.file)) return null;
    poster = ` poster="${esc(`/nda/media/${pm.section}/${pm.file}`)}"`;
  }
  const a = alt.trim();
  const caption = /^video$/i.test(a) ? "" : a.replace(/^video:\s*/i, "").trim();
  return `<figure class="nda-media"><video controls preload="metadata" playsinline${poster}${caption ? ` aria-label="${esc(caption)}"` : ""}><source src="${esc(url)}" type="${mediaType(media.file)}"></video>${caption ? `<figcaption>${esc(caption)}</figcaption>` : ""}</figure>`;
}

function inline(s: string): string {
  let out = esc(s);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  out = out.replace(/(?<!!)\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text: string, href: string) => {
    const raw = href.replace(/&amp;/g, "&");
    if (!/^(https?:\/\/|mailto:|\/(?!\/))/i.test(raw)) return text;
    return `<a href="${href}" rel="noopener noreferrer" target="_blank">${text}</a>`;
  });
  return out;
}

function blocks(md: string): string {
  const lines = md.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  let para: string[] = [];
  let list: { tag: "ul" | "ol"; items: string[] } | null = null;
  let quote: string[] = [];
  const flush = () => {
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.tag}>`);
    list = null;
    if (quote.length) out.push(`<blockquote>${inline(quote.join(" "))}</blockquote>`);
    quote = [];
  };
  for (const line of lines) {
    const t = line.trim();
    let m: RegExpExecArray | null;
    if (!t) { flush(); continue; }
    if ((m = /^(#{1,4})\s+(.*)$/.exec(t))) { flush(); const n = Math.min(6, m[1].length + 2); out.push(`<h${n}>${inline(m[2])}</h${n}>`); continue; }
    if (t.startsWith("![")) { const fig = embed(t); if (fig) { flush(); out.push(fig); continue; } }
    if (/^(-{3,}|\*{3,})$/.test(t)) { flush(); out.push("<hr>"); continue; }
    if ((m = /^[-*]\s+(.*)$/.exec(t))) { if (para.length || quote.length || (list && list.tag !== "ul")) flush(); list = list || { tag: "ul", items: [] }; list.items.push(m[1]); continue; }
    if ((m = /^\d+[.)]\s+(.*)$/.exec(t))) { if (para.length || quote.length || (list && list.tag !== "ol")) flush(); list = list || { tag: "ol", items: [] }; list.items.push(m[1]); continue; }
    if ((m = /^>\s?(.*)$/.exec(t))) { if (para.length || list) flush(); quote.push(m[1]); continue; }
    if (list) flush();
    para.push(t);
  }
  flush();
  return out.join("\n");
}

export interface Rendered {
  intro: string; // html before the first "## "
  projects: { title: string; html: string }[];
}

export function renderProjects(md: string): Rendered {
  const parts = md.replace(/\r/g, "").split(/^##\s+/m);
  const intro = blocks(parts[0].replace(/^#\s+.*$/m, "")); // the file's own "# title" is dropped; the page has one
  const projects = parts.slice(1).map((p) => {
    const nl = p.indexOf("\n");
    const title = (nl < 0 ? p : p.slice(0, nl)).trim();
    return { title: inline(title), html: blocks(nl < 0 ? "" : p.slice(nl + 1)) };
  });
  return { intro, projects };
}
