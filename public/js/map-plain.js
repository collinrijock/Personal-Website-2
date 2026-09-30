// map-plain.js — the map as plain html, from content.js.
// it's the page without webgl, the copy screen readers get, and the "list" view.
// dom-free on purpose: tools/shots-map.mjs imports it to check map.html hasn't drifted.
import { CLUSTERS, NODES } from './content.js';

const ENT = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ENT[c]);

// sticky markdown is **bold** and `code`, nothing else
export const md = (s) => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
export const strip = (s) => String(s).replace(/`([^`]+)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1');

export function host(url) {
  if (url.startsWith('mailto:')) return 'email';
  if (!/^[a-z]+:/i.test(url)) return url;
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

// every word a card shows, for search
export function nodeText(n) {
  const parts = [n.text, n.title, n.note, n.label, n.url && host(n.url)];
  return strip(parts.filter(Boolean).join(' '));
}

const a = (url, inner) => `<a href="${esc(url)}">${inner}</a>`;

function item(n) {
  const id = `data-id="${esc(n.id)}"`;
  switch (n.type) {
    case 'sticky': return `<li class="p-sticky" data-color="${esc(n.color)}" ${id}>${md(n.text)}${n.internal ? ' <span class="p-note">exowatt · internal</span>' : ''}</li>`;
    case 'quote': return `<li class="p-quote" ${id}>${esc(n.text)}</li>`;
    case 'link':
    case 'image': {
      const t = n.url ? a(n.url, esc(n.title)) : `<span class="p-t">${esc(n.title)}</span>`;
      const note = n.note ? ` <span class="p-note">${esc(n.note)}</span>` : '';
      const where = n.url ? ` <span class="p-host">${esc(host(n.url))}</span>` : '';
      return `<li class="p-link" ${id}>${t}${note}${where}</li>`;
    }
    case 'logo': return `<li class="p-logo" ${id}>${n.url ? a(n.url, esc(n.label)) : esc(n.label)}</li>`;
    default: return '';
  }
}

export function plainHtml() {
  let out = '';
  for (const c of CLUSTERS) {
    const nodes = NODES.filter((n) => n.cluster === c.id);
    const title = nodes.find((n) => n.type === 'title');
    const rest = nodes.filter((n) => n !== title);
    const list = `<ul class="p-list${rest.every((n) => n.type === 'logo') ? ' p-chips' : ''}">${rest.map(item).join('')}</ul>`;
    if (title) {
      out += `<header class="p-head" data-cluster="${esc(c.id)}"><h1 data-id="${esc(title.id)}">${esc(title.text)}</h1>${list}</header>\n`;
    } else {
      out += `<section class="p-cluster" data-cluster="${esc(c.id)}" aria-labelledby="p-${esc(c.id)}"><h2 id="p-${esc(c.id)}"><i data-color="${esc(c.color)}"></i>${esc(c.title)}</h2>${list}</section>\n`;
    }
  }
  return out;
}
