// a deliberately small markdown renderer for NDA_DATA_DIR/projects.md.
// it escapes everything first, then adds back a short list of constructs:
// # / ## / ### headings, paragraphs, - and 1. lists, > quotes, --- rules,
// **bold**, *italic*, `code`, and [links](https://...) (http, https, mailto
// and same-site paths only). no raw html gets through.
//
// each "## " heading starts a new project card.
import { esc } from "./http";

function inline(s: string): string {
  let out = esc(s);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text: string, href: string) => {
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
    if ((m = /^(#{1,4})\s+(.*)$/.exec(t))) { flush(); const n = Math.min(4, m[1].length + 1); out.push(`<h${n}>${inline(m[2])}</h${n}>`); continue; }
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
