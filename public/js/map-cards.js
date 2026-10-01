// map-cards.js — one element per node, in the canvas's vocabulary.
import { CLUSTERS } from './content.js';
import { esc, md, host } from './map-plain.js';

const icon = (slug) => `https://cdn.jsdelivr.net/npm/simple-icons@15/icons/${slug}.svg`;
const clusterColor = Object.fromEntries(CLUSTERS.map((c) => [c.id, c.color]));

// the ↗: a real link, so the browser does what links do. out of the tab order,
// because the list view carries the same links for keyboards and screen readers
function open(url, label) {
  const tab = url.startsWith('mailto:') ? '' : ' target="_blank" rel="noopener"';
  return `<a class="open" href="${esc(url)}"${tab} tabindex="-1" draggable="false" aria-label="open ${esc(label)}">↗</a>`;
}

// exowatt work that stays inside: no link, just a quiet lock line under the note
export const INTERNAL = '<span class="int"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 11h13v10h-13zM8 11V7.5a4 4 0 0 1 8 0V11"/></svg>exowatt · internal</span>';

export function widthOf(n) {
  const L = (n.text || '').length;
  switch (n.type) {
    case 'sticky': return L < 34 ? 178 : L < 70 ? 206 : L < 100 ? 232 : 256;
    case 'quote': return L < 34 ? 310 : L < 46 ? 360 : 430;
    case 'link': return 246;
    case 'image': return n.big ? 488 : 288;
    case 'logo': return 112;
    case 'tags': return 236;
    default: return 0; // the title sizes itself
  }
}

export function buildCard(n) {
  const el = document.createElement('div');
  el.className = `card ${n.type}`;
  el.dataset.node = n.id;
  const w = widthOf(n);
  if (w) el.style.width = `${w}px`;
  let html = '';
  switch (n.type) {
    case 'title':
      html = esc(n.text);
      break;
    case 'quote':
      if (n.look) el.dataset.look = n.look;
      // a quote can carry one of the page's little guys (js/grunts.js adopts it)
      html = `<p>${esc(n.text)}${n.grunt ? `<span class="grunt g-atoms" data-grunt="${esc(n.grunt)}" data-size="56" data-state="working" data-tool="hammer" data-move="bob" data-moods="working,proud"></span>` : ''}</p>`;
      break;
    case 'sticky':
      el.dataset.color = n.color;
      html = md(n.text) + (n.internal ? INTERNAL : '');
      break;
    case 'link':
      html = `<p class="t">${esc(n.title)}</p><p class="h">${esc(host(n.url))}</p>`
        + (n.note ? `<p class="n">${esc(n.note)}</p>` : '') + open(n.url, n.title);
      break;
    case 'image':
      el.dataset.color = clusterColor[n.cluster] || 'white';
      if (n.big) el.classList.add('big');
      html = `<div class="tb"><span class="t">${esc(n.title)}</span>${n.url ? open(n.url, n.title) : ''}</div>`
        + `<div class="ph"><img src="${esc(n.src)}" alt="" draggable="false" decoding="async"></div>`
        + (n.note ? `<p class="n">${esc(n.note)}</p>` : '');
      break;
    case 'logo':
      html = `<span class="tile">${n.icon
        ? `<img src="${icon(n.icon)}" alt="" width="36" height="36" draggable="false" decoding="async">`
        : `<span class="glyph">${esc(n.glyph)}</span>`}</span><span class="l">${esc(n.label)}</span>`
        + (n.url ? open(n.url, n.label) : '');
      break;
    case 'tags':
      html = n.tags.map((t, i) => `<span class="chip" style="--tag: var(--c${(i % 4) + 1})">${esc(t)}</span>`).join('');
      break;
  }
  el.innerHTML = `<div class="in">${html}</div>`;
  return el;
}
