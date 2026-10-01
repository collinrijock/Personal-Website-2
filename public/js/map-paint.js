// map-paint.js — the map's cards, painted with canvas 2d into texture atlas pages.
// the front page's fly-through draws one textured quad per card from these instead of a
// css3d element each: a hundred-odd 3d-transformed dom layers was the thing that made the
// flight heavy (every frame re-rasterised every card as its scale changed, and the page
// froze on anything slower than a desktop gpu). the look is the same as css/map.css:
// pastel stickies with bold runs, quotes with the little gradient bar, white link and
// image cards, logo tiles, chips, the big gradient name, frame titles and arrow pills.
//
// paint() works in slices (a few cards per animation frame), so nothing blocks the page.
import { CLUSTERS } from './content.js';
import { host } from './map-plain.js';
import { widthOf } from './map-cards.js';

export const PASTEL = { yellow: '#fff1a8', pink: '#ffd6e4', blue: '#d3e7ff', green: '#d4f5d9', purple: '#e6dcff', gray: '#e9e9ec', white: '#ffffff' };
export const INKS = { yellow: '#4a3b00', pink: '#5c1030', blue: '#0f2f57', green: '#12421d', purple: '#301a66', gray: '#2b2b30', white: '#1f1f24' };
const SANS = '"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
const MONO = '"Geist Mono", ui-monospace, "SF Mono", Menlo, monospace';
const INK = '#0b1020', INK2 = '#4a5468', INK3 = '#8a93a6';
const DEFAULT_PALETTE = ['#6a2bff', '#18a0ff', '#ff2d87', '#ff7a1a', '#ffd23f'];
const ICON = (slug) => `https://cdn.jsdelivr.net/npm/simple-icons@15/icons/${slug}.svg`;
const clusterColor = Object.fromEntries(CLUSTERS.map((c) => [c.id, c.color]));
const PAD = 14; // margin round each cell, room for the shadow
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

export function palette() {
  try {
    const cs = getComputedStyle(document.documentElement);
    return DEFAULT_PALETTE.map((d, i) => cs.getPropertyValue(`--c${i}`).trim() || d);
  } catch { return DEFAULT_PALETTE; }
}

/* ── text ─────────────────────────────────────────────────────────────── */
// sticky markdown: **bold** and `code`, nothing else
function runs(text) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let i = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > i) out.push({ t: text.slice(i, m.index), b: false, c: false });
    const tok = m[0];
    if (tok.startsWith('**')) out.push({ t: tok.slice(2, -2), b: true, c: false });
    else out.push({ t: tok.slice(1, -1), b: false, c: true });
    i = m.index + tok.length;
  }
  if (i < text.length) out.push({ t: text.slice(i), b: false, c: false });
  return out;
}
const fontOf = (st, base) => (st.c ? `500 ${Math.round(base.size * 0.9)}px ${MONO}` : `${st.b ? base.boldW : base.w} ${base.size}px ${base.family}`);
// greedy word wrap over styled runs. returns lines of placed words and the block height
function wrap(ctx, text, maxW, base) {
  const words = [];
  for (const r of runs(text)) for (const part of r.t.split(/(\s+)/)) if (part) words.push({ t: part, b: r.b, c: r.c, sp: /^\s+$/.test(part) });
  const lines = [[]];
  let x = 0;
  for (const w of words) {
    ctx.font = fontOf(w, base);
    let ww = ctx.measureText(w.t).width + (w.c ? 8 : 0);
    if (w.sp) { if (x === 0) continue; lines[lines.length - 1].push({ ...w, x, w: ww }); x += ww; continue; }
    if (x + ww > maxW && x > 0) {
      const last = lines[lines.length - 1];
      if (last.length && last[last.length - 1].sp) last.pop();
      lines.push([]); x = 0;
    }
    lines[lines.length - 1].push({ ...w, x, w: ww }); x += ww;
  }
  const lh = base.size * base.lh;
  return { lines, h: lines.length * lh, lh };
}
function drawLines(ctx, block, x, y, base, color) {
  ctx.textBaseline = 'alphabetic';
  const asc = base.size * 0.72; // geist's cap-ish ascent, close enough to the browser's line box
  block.lines.forEach((line, i) => {
    const by = y + i * block.lh + (block.lh - base.size) / 2 + asc;
    for (const w of line) {
      if (w.sp) continue;
      ctx.font = fontOf(w, base);
      if (w.c) {
        ctx.fillStyle = 'rgba(11, 16, 32, .06)';
        rr(ctx, x + w.x, by - base.size * 0.8, w.w, base.size * 1.1, 4); ctx.fill();
        ctx.fillStyle = color; ctx.fillText(w.t, x + w.x + 4, by);
      } else { ctx.fillStyle = color; ctx.fillText(w.t, x + w.x, by); }
    }
  });
}
function rr(ctx, x, y, w, h, r) {
  const q = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + q, y); ctx.lineTo(x + w - q, y); ctx.quadraticCurveTo(x + w, y, x + w, y + q);
  ctx.lineTo(x + w, y + h - q); ctx.quadraticCurveTo(x + w, y + h, x + w - q, y + h);
  ctx.lineTo(x + q, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - q);
  ctx.lineTo(x, y + q); ctx.quadraticCurveTo(x, y, x + q, y);
  ctx.closePath();
}
function grad(ctx, x, y, w, stops) {
  const g = ctx.createLinearGradient(x, y, x + w, y);
  stops.forEach(([at, c]) => g.addColorStop(at, c));
  return g;
}
function withLs(ctx, ls, fn) {
  const had = 'letterSpacing' in ctx;
  if (had) ctx.letterSpacing = ls;
  try { return fn(); } finally { if (had) ctx.letterSpacing = '0px'; }
}

/* ── images ───────────────────────────────────────────────────────────── */
const imgs = new Map();
function loadImage(src) {
  if (imgs.has(src)) return imgs.get(src);
  const p = new Promise((res) => {
    const im = new Image();
    im.crossOrigin = 'anonymous'; // a cross-origin picture must never taint the atlas
    im.decoding = 'async';
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
  imgs.set(src, p);
  return p;
}

/* ── one card ─────────────────────────────────────────────────────────── */
// paints node n with its top-left at (x, y) in css px, or just measures it when draw is false.
// returns { w, h }. pictures come from `pics` (src -> HTMLImageElement | null)
const BASE = {
  sticky: { size: 14, lh: 1.45, w: 400, boldW: 650, family: SANS },
  quote: { size: 29, lh: 1.1, w: 600, boldW: 600, family: SANS },
  linkT: { size: 15, lh: 1.25, w: 600, boldW: 600, family: SANS },
  note: { size: 13, lh: 1.4, w: 400, boldW: 600, family: SANS },
  imgNote: { size: 12.5, lh: 1.35, w: 400, boldW: 600, family: SANS },
};
function paintNode(ctx, n, x, y, { draw, pics, pal, dark }) {
  const W = widthOf(n) || 0;
  switch (n.type) {
    case 'sticky': {
      const pad = 12, inner = W - pad * 2;
      const block = wrap(ctx, n.text, inner, BASE.sticky);
      let h = pad * 2 + block.h;
      if (n.internal) h += 8 + 12;
      if (draw) {
        const white = n.color === 'white';
        ctx.save();
        ctx.shadowColor = 'rgba(20, 24, 40, .16)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5;
        ctx.fillStyle = PASTEL[n.color] || '#fff';
        rr(ctx, x, y, W, h, 6); ctx.fill();
        ctx.restore();
        if (white) { ctx.strokeStyle = 'rgba(0, 0, 0, .1)'; ctx.lineWidth = 1; rr(ctx, x + 0.5, y + 0.5, W - 1, h - 1, 6); ctx.stroke(); }
        drawLines(ctx, block, x + pad, y + pad, BASE.sticky, INKS[n.color] || INK);
        if (n.internal) {
          const ly = y + pad + block.h + 8;
          ctx.save(); ctx.globalAlpha = 0.55; ctx.strokeStyle = INKS[n.color] || INK; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          // the little lock
          ctx.beginPath(); ctx.rect(x + pad + 1, ly + 4.5, 8, 6.5); ctx.moveTo(x + pad + 2.6, ly + 4.5); ctx.lineTo(x + pad + 2.6, ly + 2.6); ctx.arc(x + pad + 5, ly + 2.6, 2.4, Math.PI, 0); ctx.lineTo(x + pad + 7.4, ly + 4.5); ctx.stroke();
          ctx.font = `500 10.5px ${MONO}`; ctx.fillStyle = INKS[n.color] || INK; ctx.textBaseline = 'alphabetic';
          ctx.fillText('exowatt · internal', x + pad + 14, ly + 10);
          ctx.restore();
        }
      }
      return { w: W, h };
    }
    case 'quote': {
      const px = 10, py = 8, inner = W - px * 2;
      const block = withLs(ctx, '-0.035em', () => wrap(ctx, n.text, inner, BASE.quote));
      const h = py * 2 + 3 + 12 + block.h;
      if (draw) {
        ctx.fillStyle = grad(ctx, x + px, y, 30, [[0, pal[1]], [0.5, pal[2]], [1, pal[3]]]);
        rr(ctx, x + px, y + py, 30, 3, 2); ctx.fill();
        const color = n.look === 'soft' ? INK3 : dark && n.cluster === 'me' ? '#eef1f8' : INK;
        withLs(ctx, '-0.035em', () => {
          if (n.look === 'grad') {
            // gradient type: paint the words, then colour them through a clip
            ctx.save();
            const g = grad(ctx, x + px, y, inner, [[0, pal[0]], [0.38, pal[2]], [0.68, pal[3]], [1, pal[4]]]);
            drawLines(ctx, block, x + px, y + py + 15, BASE.quote, '#000');
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = g; ctx.fillRect(x, y, W, h);
            ctx.restore();
          } else drawLines(ctx, block, x + px, y + py + 15, BASE.quote, color);
        });
      }
      return { w: W, h };
    }
    case 'link': {
      const px = 14, inner = W - px * 2 - 30;
      const tb = withLs(ctx, '-0.012em', () => wrap(ctx, n.title, inner, BASE.linkT));
      const nb = n.note ? wrap(ctx, n.note, W - px * 2, BASE.note) : null;
      const h = 15 + tb.h + 3 + 15 + (nb ? 8 + nb.h : 0) + 13;
      if (draw) {
        ctx.save(); ctx.shadowColor = 'rgba(20, 24, 40, .14)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5;
        ctx.fillStyle = '#fff'; rr(ctx, x, y, W, h, 10); ctx.fill(); ctx.restore();
        ctx.strokeStyle = 'rgba(11, 16, 32, .08)'; ctx.lineWidth = 1; rr(ctx, x + 0.5, y + 0.5, W - 1, h - 1, 10); ctx.stroke();
        ctx.save(); rr(ctx, x, y, W, h, 10); ctx.clip();
        ctx.fillStyle = grad(ctx, x, y, W, [[0, pal[1]], [0.33, pal[2]], [0.66, pal[3]], [1, pal[4]]]); ctx.fillRect(x, y, W, 3);
        ctx.restore();
        withLs(ctx, '-0.012em', () => drawLines(ctx, tb, x + px, y + 15, BASE.linkT, INK));
        ctx.font = `400 11.5px ${MONO}`; ctx.fillStyle = INK3; ctx.textBaseline = 'alphabetic';
        ctx.fillText(host(n.url), x + px, y + 15 + tb.h + 3 + 11);
        if (nb) drawLines(ctx, nb, x + px, y + 15 + tb.h + 3 + 15 + 8, BASE.note, INK2);
        // the ↗ box
        ctx.fillStyle = '#f3f4f8'; rr(ctx, x + W - 10 - 26, y + 10, 26, 26, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(11, 16, 32, .07)'; rr(ctx, x + W - 10 - 26 + 0.5, y + 10.5, 25, 25, 7); ctx.stroke();
        ctx.font = `500 13px ${SANS}`; ctx.fillStyle = INK2; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('↗', x + W - 10 - 13, y + 23); ctx.textAlign = 'left';
      }
      return { w: W, h };
    }
    case 'image': {
      const ph = n.big ? Math.round(W * 10 / 16) : 146, tbh = 32;
      const nb = n.note ? wrap(ctx, n.note, W - 22, BASE.imgNote) : null;
      const h = tbh + ph + (nb ? 8 + nb.h + 10 : 0);
      if (draw) {
        const color = clusterColor[n.cluster] || 'white';
        ctx.save(); ctx.shadowColor = 'rgba(20, 24, 40, .14)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5;
        ctx.fillStyle = '#fff'; rr(ctx, x, y, W, h, 12); ctx.fill(); ctx.restore();
        ctx.save(); rr(ctx, x, y, W, h, 12); ctx.clip();
        ctx.fillStyle = PASTEL[color] || '#fff'; ctx.fillRect(x, y, W, tbh);
        ctx.fillStyle = '#eef0f6'; ctx.fillRect(x, y + tbh, W, ph);
        const im = pics.get(n.src);
        if (im) {
          // object-fit: cover
          const s = Math.max(W / im.naturalWidth, ph / im.naturalHeight), dw = im.naturalWidth * s, dh = im.naturalHeight * s;
          ctx.drawImage(im, x + (W - dw) / 2, y + tbh + (ph - dh) / 2, dw, dh);
        } else {
          ctx.fillStyle = grad(ctx, x, y, W, [[0, pal[1] + '55'], [0.5, pal[2] + '44'], [1, pal[4] + '55']]); ctx.fillRect(x, y + tbh, W, ph);
        }
        ctx.restore();
        ctx.strokeStyle = 'rgba(11, 16, 32, .08)'; ctx.lineWidth = 1; rr(ctx, x + 0.5, y + 0.5, W - 1, h - 1, 12); ctx.stroke();
        ctx.font = `600 13px ${SANS}`; ctx.fillStyle = INKS[color] || INK; ctx.textBaseline = 'middle';
        const maxT = W - 11 - (n.url ? 34 : 11);
        let t = n.title;
        while (t.length > 2 && ctx.measureText(t).width > maxT) t = t.slice(0, -2).trimEnd() + '…';
        ctx.fillText(t, x + 11, y + tbh / 2 + 0.5);
        if (n.url) {
          ctx.fillStyle = 'rgba(255, 255, 255, .7)'; rr(ctx, x + W - 5 - 23, y + 4.5, 23, 23, 7); ctx.fill();
          ctx.font = `500 13px ${SANS}`; ctx.fillStyle = INK2; ctx.textAlign = 'center'; ctx.fillText('↗', x + W - 5 - 11.5, y + 16); ctx.textAlign = 'left';
        }
        if (nb) drawLines(ctx, nb, x + 11, y + tbh + ph + 8, BASE.imgNote, INK2);
      }
      return { w: W, h };
    }
    case 'logo': {
      const tile = 72, h = tile + 9 + 14;
      if (draw) {
        const tx = x + (W - tile) / 2;
        ctx.save(); ctx.shadowColor = 'rgba(20, 24, 40, .14)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5;
        ctx.fillStyle = '#fff'; rr(ctx, tx, y, tile, tile, 18); ctx.fill(); ctx.restore();
        ctx.strokeStyle = 'rgba(11, 16, 32, .08)'; ctx.lineWidth = 1; rr(ctx, tx + 0.5, y + 0.5, tile - 1, tile - 1, 18); ctx.stroke();
        const im = n.icon ? pics.get(ICON(n.icon)) : null;
        if (im) ctx.drawImage(im, tx + 18, y + 18, 36, 36);
        else {
          ctx.font = `700 31px ${SANS}`; ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          withLs(ctx, '-0.05em', () => ctx.fillText(n.glyph || n.label[0], tx + tile / 2, y + tile / 2 + 1));
          ctx.textAlign = 'left';
        }
        ctx.font = `500 12px ${MONO}`; ctx.fillStyle = INK2; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(n.label, x + W / 2, y + tile + 9 + 11); ctx.textAlign = 'left';
      }
      return { w: W, h };
    }
    case 'tags': {
      // chips, wrapped
      ctx.font = `500 11.5px ${MONO}`;
      const chips = n.tags.map((t) => ({ t, w: Math.ceil(ctx.measureText(t).width) + 18 }));
      let cx = 0, cy = 0;
      const rows = [];
      for (const c of chips) { if (cx + c.w > W && cx > 0) { cx = 0; cy += 20 + 6; } c.x = cx; c.y = cy; cx += c.w + 6; rows.push(c); }
      const h = cy + 20;
      if (draw) {
        rows.forEach((c, i) => {
          const col = pal[(i % 4) + 1];
          ctx.fillStyle = '#fff'; rr(ctx, x + c.x, y + c.y, c.w, 20, 10); ctx.fill();
          ctx.fillStyle = col + '22'; rr(ctx, x + c.x, y + c.y, c.w, 20, 10); ctx.fill();
          ctx.strokeStyle = col + '55'; ctx.lineWidth = 1; rr(ctx, x + c.x + 0.5, y + c.y + 0.5, c.w - 1, 19, 10); ctx.stroke();
          ctx.font = `500 11.5px ${MONO}`; ctx.fillStyle = INK2; ctx.textBaseline = 'middle'; ctx.fillText(c.t, x + c.x + 9, y + c.y + 10.5);
        });
      }
      return { w: W, h };
    }
    case 'title': {
      const size = 150;
      ctx.font = `600 ${size}px ${SANS}`;
      const tw = withLs(ctx, '-0.06em', () => ctx.measureText(n.text).width);
      const w = Math.ceil(tw + size * 0.08) + 4, h = Math.ceil(size * 0.92 + size * 0.12);
      if (draw) {
        ctx.save();
        withLs(ctx, '-0.06em', () => {
          ctx.font = `600 ${size}px ${SANS}`; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#000';
          ctx.fillText(n.text, x, y + size * 0.78);
        });
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = grad(ctx, x, y, w, [[0, pal[0]], [0.24, pal[1]], [0.52, pal[2]], [0.78, pal[3]], [1, pal[4]]]);
        ctx.fillRect(x, y, w, h);
        ctx.restore();
      }
      return { w, h };
    }
    case 'ftitle': {
      ctx.font = `600 22px ${SANS}`;
      const tw = withLs(ctx, '-0.02em', () => ctx.measureText(n.text).width);
      const w = Math.ceil(tw) + 4, h = 34;
      if (draw) {
        ctx.font = `600 22px ${SANS}`; ctx.fillStyle = INKS[n.color] || INK; ctx.textBaseline = 'middle';
        withLs(ctx, '-0.02em', () => ctx.fillText(n.text, x + 2, y + h / 2 + 1));
      }
      return { w, h };
    }
    case 'pill': {
      ctx.font = `400 11.5px ${SANS}`;
      const w = Math.ceil(ctx.measureText(n.text).width) + 14, h = 21;
      if (draw) {
        ctx.save(); ctx.shadowColor = 'rgba(20, 24, 40, .08)'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1;
        ctx.fillStyle = '#fff'; rr(ctx, x, y, w, h, 6); ctx.fill(); ctx.restore();
        ctx.strokeStyle = 'rgba(11, 16, 32, .1)'; ctx.lineWidth = 1; rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 6); ctx.stroke();
        ctx.font = `400 11.5px ${SANS}`; ctx.fillStyle = INK2; ctx.textBaseline = 'middle'; ctx.fillText(n.text, x + 7, y + h / 2 + 0.5);
      }
      return { w, h };
    }
    default: return { w: W || 10, h: 10 };
  }
}

/* ── the atlas ────────────────────────────────────────────────────────── */
/**
 * items: [{ id, node }] where node is a content.js node, or { type: 'ftitle' | 'pill', text, color? }.
 * returns { pages: [canvas], cells: Map(id -> { page, w, h, u0, v0, u1, v1 }), repaint(opts) }.
 * sizes are css px; the atlas is painted at `scale` device px per css px, as many PAGE² pages as it takes.
 * onProgress(done, total) is called as it goes; the whole thing yields to the browser every few cards.
 */
export async function paintAtlas(items, { page = 2048, scale = 1.75, dark = false, onProgress = () => {} } = {}) {
  // fonts first, so the measurements match what will be drawn
  try {
    await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 2500))]);
    await Promise.race([Promise.all(['400 14px Geist', '600 14px Geist', '650 14px Geist', '700 14px Geist', '400 12px "Geist Mono"', '500 12px "Geist Mono"'].map((f) => document.fonts?.load(f))), new Promise((r) => setTimeout(r, 2500))]);
  } catch { /* system fonts then */ }
  const pal = palette();
  const meas = document.createElement('canvas').getContext('2d');
  // pictures: start them all now, paint the cards that need them last
  const picSrcs = new Set();
  for (const { node: n } of items) { if (n.type === 'image') picSrcs.add(n.src); if (n.type === 'logo' && n.icon) picSrcs.add(ICON(n.icon)); }
  const picWait = Promise.all([...picSrcs].map((s) => loadImage(s).then((im) => [s, im])));
  const pics = new Map();
  // measure
  const cells = new Map();
  const list = [];
  for (const it of items) {
    const { w, h } = paintNode(meas, it.node, 0, 0, { draw: false, pics, pal, dark });
    list.push({ ...it, w, h, cw: Math.ceil(w + PAD * 2), ch: Math.ceil(h + PAD * 2) });
  }
  await nextFrame();
  // pack: shelves, tallest first, pictures last so their rows are painted after the images arrive
  const order = [...list].sort((a, b) => (a.node.type === 'image') - (b.node.type === 'image') || b.ch - a.ch);
  let k = scale;
  const area = order.reduce((s, it) => s + it.cw * it.ch, 0);
  const pagesWanted = Math.ceil((area * k * k * 1.18) / (page * page));
  if (pagesWanted > 4) k = Math.sqrt((4 * page * page) / (area * 1.18)); // never more than four pages
  const pages = [];
  let px = 0, py = 0, shelf = 0, pi = -1;
  const newPage = () => {
    const c = document.createElement('canvas');
    c.width = c.height = page;
    pages.push(c);
    pi++; px = 0; py = 0; shelf = 0;
  };
  newPage();
  for (const it of order) {
    const w = Math.ceil(it.cw * k), h = Math.ceil(it.ch * k);
    if (px + w > page) { px = 0; py += shelf; shelf = 0; }
    if (py + h > page) { newPage(); }
    it.page = pi; it.px = px; it.py = py; it.pw = w; it.ph = h;
    px += w; shelf = Math.max(shelf, h);
  }
  // paint, a few cards per frame
  let done = 0;
  const paintOne = (it) => {
    const ctx = pages[it.page].getContext('2d');
    ctx.save();
    ctx.translate(it.px, it.py);
    ctx.scale(k, k);
    ctx.textAlign = 'left';
    paintNode(ctx, it.node, PAD, PAD, { draw: true, pics, pal, dark });
    ctx.restore();
    cells.set(it.id, { page: it.page, w: it.w, h: it.h, u0: (it.px + PAD * k) / page, v0: (it.py + PAD * k) / page, u1: (it.px + PAD * k + it.w * k) / page, v1: (it.py + PAD * k + it.h * k) / page, scale: k });
    onProgress(++done, order.length);
  };
  const needsPic = (it) => it.node.type === 'image' || (it.node.type === 'logo' && it.node.icon);
  let n = 0;
  for (const it of order.filter((x) => !needsPic(x))) { paintOne(it); if (++n % 10 === 0) await nextFrame(); }
  // the pictures: whatever has arrived in time; the rest get a soft placeholder
  await Promise.race([picWait, new Promise((r) => setTimeout(r, 3500))]);
  for (const [s, im] of await Promise.race([picWait, Promise.resolve([])])) pics.set(s, im);
  for (const it of order.filter(needsPic)) { paintOne(it); if (++n % 8 === 0) await nextFrame(); }
  return { pages, cells, scale: k };
}
