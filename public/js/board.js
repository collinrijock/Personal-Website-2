// board.js — the canvas section: this site, as one big map you pan and zoom.
// the gruntworks canvas vocabulary: regions (frames with pastel title bars) holding
// stickies, quotes, link / image / logo cards and chip rows, arrows between related
// ideas, reactions, a dot grid, a minimap, and three simulated agent cursors at
// work. they sort the inbox into regions, type new stickies, draw arrows, react,
// tidy up after you, and occasionally rethink something. you can grab cards too
// (mouse), and move around: wheel / two-finger scroll pans, pinch or ctrl/cmd +
// wheel zooms, drag the background (with a flick), two-finger touch, an "explore"
// mode for one-finger touch, the minimap, and the keyboard.
//
// everything runs on one clock that only ticks while the board is on screen
// and the tab is visible, so the agents pause mid-gesture when you look away.
// cards off screen are hidden (no paint), and zoomed out the cards fade to
// blocks while each region's title grows, so the map stays readable and cheap.

import { NODES } from './content.js';
import { buildCard, INTERNAL } from './map-cards.js';
import { md, strip } from './map-plain.js';
import { adopt } from './grunts.js';
import { rollLook, rollName, createMascotEngine, renderFrameToSvg } from './vendor/grunt-mascot.js';

const board = document.querySelector('[data-board]');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

// ── the map ─────────────────────────────────────────────────────────────
// regions, in the order they read. wide: three rows of regions, like a desk you
// lean over. phones: six one-region-wide columns. every card region is as tall
// as everything that could ever live in it (measured), so nothing is ever
// dropped. the locked strip never takes or gives a card.
const GAP = 14, HEAD = 54, M = 48, G = 44;
let CW = 236, CELL = 252; // card width, column pitch (set per layout at boot)
const fw = (cols) => 32 + (cols - 1) * CELL + CW; // a region's width for n columns
const META = {
  vision: { title: 'how i build', color: 'yellow' },
  now: { title: 'now · exowatt', color: 'blue' },
  charles: { title: 'on the side · super charles', color: 'purple' },
  xmade: { title: "things i've made · at exowatt", color: 'blue' },
  own: { title: "things i've made · on my own time", color: 'pink' },
  inbox: { title: 'inbox', color: 'gray', inbox: true },
  nda: { title: "things i've made · under nda", color: 'lock', locked: true },
  'b-buildrfi': { title: 'before · buildrfi', color: 'white' },
  'b-lula': { title: 'before · lula', color: 'white' },
  'b-kabcash': { title: 'before · kabcash', color: 'white' },
  'b-fiu': { title: 'before · fiu research', color: 'white' },
  writing: { title: 'writing', color: 'gray' },
  games: { title: 'games i make', color: 'purple' },
  links: { title: 'find me', color: 'white' },
  ideas: { title: 'ideas i keep coming back to', color: 'green' },
  stack: { title: 'tools', color: 'white', logos: true }, // a tighter grid: the cards are 96px logos
};
// wide: row one is the reading row (how i build, now, on the side) with the made
// regions and the inbox beside it; the locked strip runs under the reading row;
// row two is before (one region per job), writing, games and find me; row three
// is ideas and tools. the rows are offset a little, so it reads as a map, not a grid
function layoutWide(need) {
  const HN = 236;
  const out = [];
  const row = (y, items, x0 = 0) => { let x = x0; for (const [id, cols, h, w = fw(cols)] of items) { out.push({ id, x, y, cols, w, h }); x += w + G; } return x - G; };
  const hRead = Math.max(need('vision', 2), need('now', 2), need('charles', 2), 380);
  const hTall = Math.max(need('xmade', 2), need('own', 4), need('inbox', 2), hRead + G + HN);
  const w1 = row(0, [['vision', 2, hRead], ['now', 2, hRead], ['charles', 2, hRead], ['xmade', 2, hTall], ['own', 4, hTall], ['inbox', 2, hTall]]);
  out.push({ id: 'nda', x: 0, y: hRead + G, cols: 1, w: fw(2) * 3 + G * 2, h: HN });
  const y2 = hTall + G + 24;
  const h2 = (id, c) => Math.max(need(id, c), 380);
  const r2 = [['b-buildrfi', 2, h2('b-buildrfi', 2)], ['b-lula', 1, h2('b-lula', 1)], ['b-kabcash', 1, h2('b-kabcash', 1)], ['b-fiu', 1, h2('b-fiu', 1)], ['writing', 2, h2('writing', 2)], ['games', 2, h2('games', 2)], ['links', 2, h2('links', 2)]];
  row(y2, r2, 120);
  const y3 = y2 + Math.max(...r2.map((r) => r[2])) + G + 24;
  row(y3, [['ideas', 8, Math.max(need('ideas', 8), 520)], ['stack', 7, Math.max(need('stack', 7, fw(4)), 300), fw(4)]], 40);
  void w1;
  return out;
}
// narrow: six columns, one region wide each
function layoutNarrow(need) {
  const FW = fw(1);
  const COLS = [['vision', 'now', 'charles', 'nda'], ['xmade', 'inbox'], ['own', 'games'], ['b-buildrfi', 'b-lula', 'b-kabcash', 'b-fiu'], ['writing', 'links', 'stack'], ['ideas']];
  const out = [];
  COLS.forEach((ids, i) => {
    let y = 0;
    for (const id of ids) {
      const cols = META[id].logos ? 3 : 1;
      const h = id === 'nda' ? 330 : need(id, cols, FW);
      out.push({ id, x: i * (FW + G), y, w: FW, cols, h });
      y += h + G;
    }
  });
  return out;
}
let FRAMES = [], frameOf = {};
const WORLD = { w: 0, h: 0 };
// cluster -> region, plus cards that live somewhere other than their cluster's region
const HOME = { me: 'links', vision: 'vision', exowatt: 'now', xmade: 'xmade', charles: 'charles', work: 'ideas', things: 'own', games: 'games', ideas: 'ideas', writing: 'writing', before: 'b-buildrfi', stack: 'stack', links: 'links' };
const PIN = { 'b-lula': 'b-lula', 'b-lula-tags': 'b-lula', 'b-lula-did': 'b-lula', 'b-lula-uw': 'b-lula', 'b-kabcash': 'b-kabcash', 'b-kabcash-tags': 'b-kabcash', 'b-kabcash-did': 'b-kabcash', 'b-fiu-ml': 'b-fiu', 'b-fiu-tags': 'b-fiu', 'b-fiu-did': 'b-fiu', 'v-already': 'xmade' };
const homeOf = (id) => frameOf[PIN[id] || HOME[byId[id].cluster]];

// what's on the map at load, by region. the inbox holds what the agents will sort
const START = {
  vision: ['v-love', 'v-lot', 'v-hard', 'v-mountain', 'v-touch', 'v-going'],
  now: ['x-logo', 'x-p3', 'x-role', 'x-build'],
  charles: ['c-link', 'c-db', 'c-what', 'c-mini'],
  xmade: ['x-platform', 'x-ems', 'x-ade', 'x-twins', 'x-browser'],
  own: ['t-skills', 't-voice', 't-deck', 't-jev', 't-orca', 't-vibe', 't-shellhacks', 't-carecart', 't-galactic', 't-ascii', 't-gradient'],
  inbox: ['x-patents', 't-pokemon', 'v-already', 'c-chief', 'g-kotf', 'r-dems'],
  'b-buildrfi': ['b-lead', 'b-buildrfi', 'b-buildrfi-tags', 'b-buildrfi-did', 'b-photo'],
  'b-lula': ['b-lula', 'b-lula-tags', 'b-lula-did'],
  'b-kabcash': ['b-kabcash', 'b-kabcash-tags', 'b-kabcash-did'],
  'b-fiu': ['b-fiu-ml', 'b-fiu-tags', 'b-fiu-did'],
  writing: ['r-blog', 'r-breadth', 'r-founders', 'r-china', 'r-mini'],
  games: ['g-lotfg', 'g-lotfg2', 'g-iron', 'g-crafty', 'g-kakariko'],
  links: ['f-mail', 'f-github', 'f-x', 'f-in', 'f-skills', 'f-llms', 'miami', 'fiu'],
  ideas: ['i-build', 'i-breadth', 'i-own', 'i-loop', 'i-bounded', 'i-files', 'i-dead', 'i-undo', 'i-quiet', 'i-typed', 'i-protocols',
    'i-loud', 'i-algo', 'i-decade', 'i-data', 'i-operator', 'i-tenyear', 'i-friends', 'i-founders', 'i-block', 'i-kobe'],
  stack: ['l-ts', 'l-react', 'l-three', 'l-unity', 'l-rust', 'l-python', 'l-swift', 'l-pg', 'l-bun', 'l-expo', 'l-claude', 'l-next', 'l-torch', 'l-godot'],
};
// notes the agents can write from scratch, typed out a letter at a time (stickies only; the first three are in the still life)
const POOL = ['x-sim', 'x-teammates', 'b-buildrfi-parse', 'v-cheap', 'c-mcp', 'c-know', 'x-interns', 'w-proof', 'w-breadth', 'i-kb', 'r-data', 'b-lula-uw', 'g-mc', 'i-cli', 'i-colossus', 'b-disgo'];
// the things i've made: written first, never erased
const KEEP = new Set(['x-sim', 'x-teammates', 'b-buildrfi-parse', 'b-lula-uw', 'g-mc', 'b-disgo', 'x-interns']);
// arrows worth drawing, when both ends are on the map. the first six are drawn at load
const LINKS = [
  ['x-ade', 'v-lot', 'the agents'], ['x-build', 'x-platform', 'runs on it'], ['b-photo', 'b-buildrfi-tags', 'metaprop'],
  ['i-loop', 't-jev', 'how jev works'], ['c-mini', 'c-link', 'runs on'], ['x-logo', 'v-hard', 'hardware'],
  ['x-twins', 'l-three', 'built with'], ['x-patents', 'x-sim', 'the research'], ['x-browser', 'x-ade', 'for its agents'],
  ['x-sim', 'x-teammates'], ['t-carecart', 't-pokemon', 'also 2020'], ['c-chief', 'c-link'], ['x-teammates', 'c-chief', 'same idea, at home'],
  ['i-breadth', 'r-breadth', 'wrote about it'], ['i-founders', 'r-founders'], ['r-mini', 'c-mini', 'the post'],
  ['i-bounded', 'c-chief', 'the contract'], ['i-undo', 'i-bounded'], ['i-protocols', 'i-algo'], ['v-already', 'x-ems', 'already here'],
  ['i-own', 'b-buildrfi-did', 'end to end'], ['i-quiet', 't-deck'], ['w-breadth', 'i-breadth'], ['i-decade', 'i-tenyear'],
  ['b-kabcash-did', 'l-react'], ['b-fiu-did', 't-pokemon', 'same era'], ['g-lotfg2', 'l-unity'], ['t-skills', 'f-skills'],
  ['c-db', 'l-pg'], ['t-shellhacks', 't-carecart'], ['v-cheap', 'v-already'], ['g-kakariko', 'l-three'], ['b-lead', 'b-lula'],
];
const EMOJI = ['🔥', '⚡', '✨', '👀', '🙌', '💡'];
const SAY = {
  sort: ['on it', 'this goes in {f}', 'sorting the inbox', 'filing this'],
  write: ['writing this down', 'new note', 'adding a thought'],
  connect: ['these two are related', 'linking these', 'connecting'],
  park: ['back to the inbox for later', 'rethinking this one'],
  erase: ['cleaning up', 'removing a dupe'],
  tidy: ['tidying up after you', 'putting this back'],
};

// ── dom ─────────────────────────────────────────────────────────────────
const world = el('div', 'world');
const edgeSvg = svg('svg', { class: 'edges' });
const cursorLayer = el('div', 'cursors');
world.append(edgeSvg);
board?.append(world);

function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function svg(tag, attrs = {}) { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }

const LOCK = '<svg class="lk" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 11h13v10h-13zM8 11V7.5a4 4 0 0 1 8 0V11"/></svg>';
const itemOf = (id) => cards.get(id);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function buildFrames() {
  for (const f of FRAMES) {
    f.el = el('div', `frame${f.inbox ? ' inbox' : ''}${f.locked ? ' locked' : ''}`);
    f.el.dataset.color = f.color;
    f.el.dataset.frame = f.id;
    Object.assign(f.el.style, { left: `${f.x}px`, top: `${f.y}px`, width: `${f.w}px`, height: `${f.h}px` });
    if (f.locked) f.el.innerHTML = lockedFrame(f);
    else {
      // the title bar, plus the same title big, for when you're zoomed out (css shows one or the other)
      f.el.innerHTML = `<div class="ft"><span>${esc(f.title)}</span>${f.inbox ? '<b class="count">0</b>' : ''}</div><div class="big" aria-hidden="true">${esc(f.title)}</div>`
        + (f.id === 'now' ? '<span class="grunt g-perch" data-grunt="collin:site:2" data-size="62" data-fps="15" data-move="bob" data-moods="curious,happy,wink"></span>' : '');
    }
    world.insertBefore(f.el, edgeSvg); // under the arrows, which run under the cards
  }
  board.querySelector('.arts')?.remove();
}

// the locked strip: the pitch and a real button in its title bar (so it shows in
// the opening view), and redacted placeholders under it. the placeholders are
// shapes only, there's nothing under the bars to read
function lockedFrame(f) {
  const ghost = (color, kind, bars) => `<div class="ghost ${kind}" data-color="${color}"><span class="glk">${LOCK}</span>${bars.map((w) => `<i style="width:${w}%"></i>`).join('')}</div>`;
  return `<div class="ft"><span class="nda-t">${LOCK}${f.title}</span>
    <span class="nda-p">work that isn't public yet, from exowatt and my own projects. sign a short nda and i'll share it.</span>
    <button type="button" class="nda-act" data-nda-open>${LOCK}<span class="lbl">request access</span><span class="ar" aria-hidden="true">→</span></button>
    <b class="count">locked</b></div>
  <div class="nda-in" aria-hidden="true">
    ${ghost('blue', 'sticky', [88, 72, 94, 40])}
    ${ghost('white', 'link', [64, 36, 90, 70])}
    ${ghost('yellow', 'sticky blur', [80, 92, 66])}
    ${ghost('purple', 'sticky', [70, 96, 84, 52])}
    ${ghost('white', 'link blur', [58, 30, 86, 62])}
    ${ghost('green', 'sticky', [92, 64, 80])}
    ${ghost('pink', 'sticky blur', [76, 90, 58, 84])}
  </div>`;
}

// ui chrome, in screen space
const ui = el('div', 'ui');
ui.innerHTML = `
  <div class="tools" aria-hidden="true">
    <span class="tool on" data-tool="select"><svg viewBox="0 0 24 24"><path d="M5 3l14 8-6 1.6L10 19z"/></svg></span>
    <span class="tool" data-tool="sticky"><svg viewBox="0 0 24 24"><path d="M5 4h14v10l-5 6H5z"/><path d="M14 20v-6h5"/></svg></span>
    <span class="tool" data-tool="frame"><svg viewBox="0 0 24 24"><path d="M8 3v18M16 3v18M3 8h18M3 16h18"/></svg></span>
    <span class="tool" data-tool="arrow"><svg viewBox="0 0 24 24"><path d="M5 19L19 5M10 5h9v9"/></svg></span>
    <span class="tool" data-tool="text"><svg viewBox="0 0 24 24"><path d="M5 6V4h14v2M12 4v16M9 20h6"/></svg></span>
  </div>
  <div class="presence" aria-hidden="true"></div>
  <div class="zoom">
    <button type="button" data-z="-" aria-label="zoom out">−</button>
    <span class="zpct">100%</span>
    <button type="button" data-z="+" aria-label="zoom in">+</button>
    <button type="button" data-z="fit" aria-label="fit the board">fit</button>
  </div>
  <div class="minimap" aria-hidden="true" title="drag to move around the board"><div class="mv"></div></div>
  <div class="dock">
    <p class="sim"><i></i>simulated<span class="sim-x"> agents</span></p>
    <p class="pan-hint" aria-hidden="true">click to scroll inside · <kbd>${/mac|iphone|ipad/i.test(navigator.platform) ? '⌘' : 'ctrl'}</kbd> + scroll zooms</p>
    <button type="button" class="mode follow" aria-pressed="false"><i></i>follow agents</button>
    <button type="button" class="mode explore" aria-pressed="false" title="one-finger drag moves the board, tap again to scroll the page"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/></svg>explore</button>
  </div>`;
board.append(ui);
world.append(cursorLayer);
const toolEl = Object.fromEntries([...ui.querySelectorAll('.tool')].map((t) => [t.dataset.tool, t]));

// ── cards ───────────────────────────────────────────────────────────────
const cards = new Map(); // id -> card
const cardW = (node) => (node.type === 'logo' ? 96 : node.big && !narrowLayout ? CW + CELL : CW);
const spanOf = (node) => (node.big && !narrowLayout ? 2 : 1);
function makeCard(id, { empty = false } = {}) {
  const node = byId[id];
  const e = buildCard(node);
  e.classList.add('bcard');
  e.style.width = `${cardW(node)}px`;
  e.querySelectorAll('a').forEach((a) => a.setAttribute('tabindex', '-1'));
  if (empty) e.querySelector('.in').innerHTML = `<span class="typed"></span><span class="caret"></span>${node.internal ? INTERNAL : ''}`;
  world.insertBefore(e, cursorLayer);
  const c = { id, node, el: e, x: 0, y: 0, tx: 0, ty: 0, w: cardW(node), h: heightOf[id] || (empty ? 90 : e.offsetHeight), frame: null, lock: null, free: false, written: false, react: null, shownX: NaN, shownY: NaN, culled: false };
  cards.set(id, c);
  if (node.grunt) adopt(e);
  return c;
}

// true heights for every card that could land on the board (the starting cards and
// everything the agents might write), measured once off to the side
const heightOf = {};
function measureCards() {
  const ids = [...Object.values(START).flat(), ...POOL];
  const els = ids.map((id) => {
    const e = buildCard(byId[id]);
    e.classList.add('bcard', 'measure');
    e.style.width = `${cardW(byId[id])}px`;
    world.append(e);
    return e;
  });
  ids.forEach((id, i) => { heightOf[id] = els[i].offsetHeight; els[i].remove(); });
}

// masonry inside a frame: each card drops into the shortest column
function slots(f, list = f.cards) {
  const col = Array.from({ length: f.cols }, () => f.y + HEAD + 12);
  const out = new Map();
  for (const c of list) {
    const span = Math.min(f.cols, spanOf(c.node));
    // the shortest run of `span` columns (a two-column card waits for both)
    let k = 0, best = Infinity;
    for (let i = 0; i + span <= f.cols; i++) { let top = -Infinity; for (let j = i; j < i + span; j++) top = Math.max(top, col[j]); if (top < best - 0.5) { best = top; k = i; } }
    const cx = f.x + 16 + k * f.cell + (c.node.type === 'logo' && !f.logos ? (CW - 96) / 2 : 0);
    out.set(c, { x: cx, y: best });
    const bottom = best + (c.h || heightOf[c.id] || 90) + GAP;
    for (let j = k; j < k + span; j++) col[j] = bottom;
  }
  return { out, bottom: Math.max(...col) - GAP };
}
function fits(f, extra) {
  if (!f || f.locked) return false;
  const probe = [...f.cards, extra];
  return slots(f, probe).bottom <= f.y + f.h - 14;
}
function relayout(f) {
  const { out } = slots(f);
  for (const [c, p] of out) { c.slot = p; if (!c.carried && !c.free) { c.tx = p.x; c.ty = p.y; } }
  if (f.inbox) f.el.querySelector('.count').textContent = String(f.cards.length);
}
function attach(c, f) { c.frame = f; c.free = false; f.cards.push(c); relayout(f); }
function detach(c) { const f = c.frame; if (!f) return; f.cards = f.cards.filter((x) => x !== c); c.frame = null; relayout(f); }
function snapAll() { for (const c of cards.values()) { c.x = c.tx; c.y = c.ty; } }

// ── edges ───────────────────────────────────────────────────────────────
const edges = []; // { a, b, label, color, path, head, lab, born }
function border(c, tx, ty) {
  const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
  const dx = tx - cx, dy = ty - cy;
  const sx = dx ? (c.w / 2 + 6) / Math.abs(dx) : Infinity, sy = dy ? (c.h / 2 + 6) / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy, 1);
  return { x: cx + dx * s, y: cy + dy * s };
}
function curve(p, q) {
  const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2, dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy) || 1;
  const k = Math.min(60, L * 0.14);
  return { c: { x: mx - (dy / L) * k, y: my + (dx / L) * k }, L };
}
function drawEdge(e, p, q) {
  const { c } = curve(p, q);
  e.path.setAttribute('d', `M${p.x.toFixed(1)} ${p.y.toFixed(1)} Q${c.x.toFixed(1)} ${c.y.toFixed(1)} ${q.x.toFixed(1)} ${q.y.toFixed(1)}`);
  const ang = Math.atan2(q.y - c.y, q.x - c.x), s = 9;
  const a1 = ang + 2.6, a2 = ang - 2.6;
  e.head.setAttribute('d', `M${q.x.toFixed(1)} ${q.y.toFixed(1)} L${(q.x + Math.cos(a1) * s).toFixed(1)} ${(q.y + Math.sin(a1) * s).toFixed(1)} L${(q.x + Math.cos(a2) * s).toFixed(1)} ${(q.y + Math.sin(a2) * s).toFixed(1)} Z`);
  if (e.lab) {
    // a pill on a short arrow just covers it, so short arrows go without
    e.lab.classList.toggle('short', Math.hypot(q.x - p.x, q.y - p.y) < 190);
    const mx = 0.25 * p.x + 0.5 * c.x + 0.25 * q.x, my = 0.25 * p.y + 0.5 * c.y + 0.25 * q.y;
    e.lab.style.transform = `translate(${mx.toFixed(1)}px, ${my.toFixed(1)}px) translate(-50%, -50%)`;
  }
}
function newEdge(a, b, label, color) {
  const g = svg('g', { class: 'edge' });
  g.style.setProperty('--ac', color);
  const path = svg('path', { class: 'ln' });
  const head = svg('path', { class: 'hd' });
  g.append(path, head);
  edgeSvg.append(g);
  const e = { a, b, label, color, g, path, head, lab: null };
  if (label) {
    e.lab = el('div', 'elabel', label);
    e.lab.style.setProperty('--ac', color);
    world.insertBefore(e.lab, cursorLayer);
  }
  edges.push(e);
  return e;
}
function dropEdges(c) {
  for (let i = edges.length - 1; i >= 0; i--) {
    const e = edges[i];
    if (e.a === c || e.b === c) { e.g.classList.add('gone'); e.lab?.classList.add('gone'); const g = e.g, l = e.lab; setTimeout(() => { g.remove(); l?.remove(); }, 400); edges.splice(i, 1); }
  }
}
// redrawn only when an end moved: rewriting a path invalidates the world-sized svg, and
// with it everything painted under it, so an arrow that hasn't moved costs nothing
function updateEdges() {
  for (const e of edges) {
    const ca = { x: e.a.x + e.a.w / 2, y: e.a.y + e.a.h / 2 };
    const target = e.b.x != null && e.b.w ? { x: e.b.x + e.b.w / 2, y: e.b.y + e.b.h / 2 } : e.b;
    const p = border(e.a, target.x, target.y);
    const q = e.b.w ? border(e.b, ca.x, ca.y) : e.b;
    const key = `${p.x.toFixed(1)},${p.y.toFixed(1)},${q.x.toFixed(1)},${q.y.toFixed(1)}`;
    if (key === e.key) continue;
    e.key = key;
    drawEdge(e, p, q);
  }
}

// ── agents ──────────────────────────────────────────────────────────────
const AGENTS = [0, 1, 2].map((i) => {
  const seed = `canvas:agent:${i + 1}`;
  const look = rollLook(seed);
  const name = rollName(seed).split(' ')[0].toLowerCase();
  const color = `var(--c${[0, 2, 1][i]})`;
  const eng = createMascotEngine(look, { initialState: 'happy' });
  const face = renderFrameToSvg(eng.sample(eng.restPoseTime()), look, 18, { idPrefix: `cf${i}` });
  const e = el('div', 'cur');
  e.style.setProperty('--ac', color);
  e.innerHTML = `<svg class="ptr" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 2.5v16.8l4.6-4.3 3.1 6.9 2.9-1.3-3.1-6.8h6.4z"/></svg><div class="tag"><span class="face">${face}</span><span class="nm">${name}</span></div><div class="say"></div>`;
  cursorLayer.append(e);
  const p = el('span', 'who', face);
  p.style.setProperty('--ac', color);
  p.title = name;
  ui.querySelector('.presence').append(p);
  return { i, name, color, el: e, sayEl: e.querySelector('.say'), x: 0, y: 0, tw: null, carry: null, drawing: null, last: 0 };
});
{
  const you = el('span', 'who you', 'you');
  ui.querySelector('.presence').append(you);
}

// one clock for everything, paused while the board is off screen
let clock = 0, active = false, ticks = 0;
const timers = [];
const wait = (ms) => new Promise((r) => timers.push({ at: clock + ms, r }));

function move(a, x, y, { speed = 700, arc = 0.2 } = {}) {
  const sx = a.x, sy = a.y, dx = x - sx, dy = y - sy, d = Math.hypot(dx, dy);
  if (d < 1) return Promise.resolve();
  const dur = clamp((d / speed) * 1000, 240, 1600);
  const side = Math.random() < 0.5 ? -1 : 1, off = d * arc * rand(0.3, 1) * side;
  const nx = -dy / d, ny = dx / d;
  const c1 = { x: sx + dx * 0.3 + nx * off, y: sy + dy * 0.3 + ny * off };
  const c2 = { x: sx + dx * 0.78 + nx * off * 0.4, y: sy + dy * 0.78 + ny * off * 0.4 };
  return new Promise((res) => { a.tw = { t0: clock, dur, sx, sy, c1, c2, x, y, res }; });
}
function stepAgent(a) {
  const t = a.tw;
  if (t) {
    const u = clamp((clock - t.t0) / t.dur, 0, 1), e = ease(u), v = 1 - e;
    a.x = v * v * v * t.sx + 3 * v * v * e * t.c1.x + 3 * v * e * e * t.c2.x + e * e * e * t.x;
    a.y = v * v * v * t.sy + 3 * v * v * e * t.c1.y + 3 * v * e * e * t.c2.y + e * e * e * t.y;
    if (u >= 1) { a.tw = null; t.res(); }
  }
  if (a.carry) { const c = a.carry.card; c.x = c.tx = a.x - a.carry.ox; c.y = c.ty = a.y - a.carry.oy; }
  if (a.drawing) a.drawing.b = { x: a.x, y: a.y };
}
async function press(a, ms = 120) { a.el.classList.add('down'); await wait(ms); a.el.classList.remove('down'); }
function say(a, kind, f) {
  const line = pick(SAY[kind]).replace('{f}', f?.title || 'here');
  a.sayEl.textContent = line;
  a.el.classList.add('talking');
  clearTimeout(a.sayT);
  a.sayT = setTimeout(() => a.el.classList.remove('talking'), 1900);
}
function select(c, a) { c.el.style.setProperty('--ac', a.color); c.el.classList.add('sel'); }
function unselect(c) { c.el.classList.remove('sel', 'lift'); }
const grabPoint = (c) => ({ x: c.x + clamp(c.w * rand(0.35, 0.7), 20, c.w - 20), y: c.y + rand(14, 26) });

// screen point of a ui element -> world
function toWorld(sx, sy) { return { x: (sx - view.x) / view.z, y: (sy - view.y) / view.z }; }
function toolPoint(name) {
  const r = board.getBoundingClientRect(), t = toolEl[name].getBoundingClientRect();
  return toWorld(t.left + t.width / 2 - r.left, t.top + t.height / 2 - r.top);
}
async function useTool(a, name) {
  const p = toolPoint(name);
  await move(a, p.x, p.y, { speed: 900 });
  await press(a);
  toolEl.select.classList.remove('on');
  toolEl[name].classList.add('on');
  toolEl[name].style.setProperty('--ac', a.color);
  setTimeout(() => { toolEl[name].classList.remove('on'); toolEl.select.classList.add('on'); }, 1400);
}

// ── what an agent can do ────────────────────────────────────────────────
const free = (c) => !c.lock && !c.carried && c.el.isConnected;
const onBoard = (c) => c && c.frame && !c.frame.inbox && free(c);

const ACTIONS = {
  // take a card out of the inbox and file it in its frame
  sort: {
    weight: () => (frameOf.inbox.cards.some(free) ? 4 : 0),
    async run(a, pref) {
      const choices = frameOf.inbox.cards.filter((c) => free(c) && fits(homeOf(c.id), c));
      if (!choices.length) return false;
      const c = choices.find((x) => x.id === pref) || choices[0];
      const f = homeOf(c.id);
      c.lock = a;
      await dragTo(a, c, f, 'sort');
      return true;
    },
  },
  // write a new sticky from scratch
  write: {
    weight: () => (writable().length ? 3 : 0),
    async run(a, pref) {
      const ids = writable(), keep = ids.filter((x) => KEEP.has(x));
      const id = ids.includes(pref) ? pref : pick(keep.length ? keep : ids);
      if (!id) return false;
      const f = homeOf(id);
      const probe = { id, node: byId[id], h: heightOf[id] };
      if (!fits(f, probe)) return false;
      pool.delete(id);
      await useTool(a, 'sticky');
      // walk to where the note will go, click, and only then does it appear
      const at = slots(f, [...f.cards, probe]).out.get(probe);
      await move(a, at.x + 30, at.y + 24, { speed: 800 });
      if (!fits(f, probe)) { pool.add(id); return false; }
      await press(a);
      const c = makeCard(id, { empty: true });
      c.written = true;
      c.lock = a;
      c.h = heightOf[id]; // reserve the full height so the frame doesn't overflow as it grows
      attach(c, f);
      c.x = c.tx; c.y = c.ty;
      c.el.classList.add('pop');
      await move(a, c.tx + 30, c.ty + 24, { speed: 900 });
      say(a, 'write');
      select(c, a);
      c.el.classList.add('typing');
      await typeInto(a, c);
      c.el.classList.remove('typing');
      c.h = c.el.offsetHeight;
      relayout(f);
      await wait(rand(250, 500));
      unselect(c);
      c.lock = null;
      return true;
    },
  },
  // draw an arrow between two related cards
  connect: {
    weight: () => (linkable().length ? 2.5 : 0),
    async run(a, pref) {
      const can = linkable();
      const [ia, ib, label] = (pref && can.find((l) => l[0] === pref[0] && l[1] === pref[1])) || pick(can) || [];
      const A = itemOf(ia), B = itemOf(ib);
      if (!onBoard(A) || !onBoard(B)) return false;
      A.lock = a; B.lock = a;
      await useTool(a, 'arrow');
      const p = border(A, B.x + B.w / 2, B.y + B.h / 2);
      await move(a, p.x, p.y, { speed: 800 });
      say(a, 'connect');
      a.el.classList.add('down');
      const e = newEdge(A, { x: a.x, y: a.y }, null, a.color);
      e.g.classList.add('drawing');
      a.drawing = e;
      const q = border(B, A.x + A.w / 2, A.y + A.h / 2);
      await move(a, q.x, q.y, { speed: 520, arc: 0.12 });
      a.drawing = null;
      a.el.classList.remove('down');
      e.b = B;
      e.g.classList.remove('drawing');
      if (label) { e.label = label; e.lab = el('div', 'elabel pop', label); e.lab.style.setProperty('--ac', a.color); world.insertBefore(e.lab, cursorLayer); }
      linked.add(`${ia}|${ib}`);
      A.lock = null; B.lock = null;
      return true;
    },
  },
  // leave a reaction on a card
  react: {
    weight: () => 1.2,
    async run(a) {
      const c = pick([...cards.values()].filter((c) => onBoard(c) && (!c.react || c.react.n < 3)));
      if (!c) return false;
      c.lock = a;
      await move(a, c.x + c.w - 18, c.y + 10, { speed: 760 });
      await press(a);
      if (!c.react) {
        c.react = { e: pick(EMOJI), n: 0, el: el('span', 'react') };
        c.el.append(c.react.el);
      }
      c.react.n++;
      c.react.el.textContent = `${c.react.e} ${c.react.n}`;
      c.react.el.classList.remove('pop'); void c.react.el.offsetWidth; c.react.el.classList.add('pop');
      c.lock = null;
      return true;
    },
  },
  // move something back to the inbox, so there's always sorting to do
  park: {
    weight: () => (frameOf.inbox.cards.length < 2 ? 1.6 : 0),
    async run(a) {
      const list = FRAMES.filter((f) => !f.inbox && !f.locked && f.cards.length > 2).flatMap((f) => f.cards.slice(1)).filter((c) => free(c) && !c.written);
      const c = pick(list);
      if (!c || !fits(frameOf.inbox, c)) return false;
      c.lock = a;
      dropEdges(c);
      await dragTo(a, c, frameOf.inbox, 'park');
      return true;
    },
  },
  // remove a note an agent wrote, so it can be written again later
  erase: {
    weight: () => ([...cards.values()].filter((c) => c.written && free(c) && !KEEP.has(c.id)).length > 3 ? 1 : 0),
    async run(a) {
      const c = pick([...cards.values()].filter((x) => x.written && free(x) && x.frame && !KEEP.has(x.id)));
      if (!c) return false;
      c.lock = a;
      const g = grabPoint(c);
      await move(a, g.x, g.y, { speed: 760 });
      await press(a);
      select(c, a);
      say(a, 'erase');
      await wait(700);
      c.el.classList.add('poof');
      dropEdges(c);
      await wait(380);
      detach(c);
      c.el.remove();
      cards.delete(c.id);
      pool.add(c.id);
      return true;
    },
  },
  // put back what you moved
  tidy: {
    weight: () => ([...cards.values()].some((c) => c.free && !c.lock) ? 6 : 0),
    async run(a) {
      const c = [...cards.values()].find((x) => x.free && !x.lock);
      if (!c) return false;
      const home = homeOf(c.id);
      const f = fits(home, c) ? home : frameOf.inbox;
      c.lock = a;
      await dragTo(a, c, f, 'tidy');
      return true;
    },
  },
};
const pool = new Set(POOL);
const linked = new Set();
const writable = () => [...pool].filter((id) => !cards.has(id) && fits(homeOf(id), { id, node: byId[id], h: heightOf[id] }));
const linkable = () => LINKS.filter(([x, y]) => !linked.has(`${x}|${y}`) && onBoard(itemOf(x)) && onBoard(itemOf(y)));

async function dragTo(a, c, f, kind) {
  const g = grabPoint(c);
  await move(a, g.x, g.y, { speed: 760 });
  await press(a, 90);
  select(c, a);
  c.el.classList.add('lift');
  if (kind) say(a, kind, f);
  a.carry = { card: c, ox: a.x - c.x, oy: a.y - c.y };
  c.carried = true;
  c.free = false;
  detach(c);
  // claim the slot now, so nobody else fills it on the way
  f.cards.push(c); c.frame = f;
  const { out } = slots(f);
  const s = out.get(c);
  relayout(f);
  await wait(rand(80, 180));
  await move(a, s.x + a.carry.ox, s.y + a.carry.oy, { speed: 560, arc: 0.16 });
  a.carry = null;
  c.carried = false;
  relayout(f);
  await wait(60);
  unselect(c);
  c.lock = null;
}

async function typeInto(a, c) {
  const text = strip(c.node.text || '');
  const typed = c.el.querySelector('.typed');
  for (let i = 1; i <= text.length; i++) {
    typed.textContent = text.slice(0, i);
    const ch = text[i - 1];
    await wait(rand(38, 95) + (ch === ' ' ? 25 : 0) + (/[.,]/.test(ch) ? 140 : 0) + (Math.random() < 0.03 ? 380 : 0));
  }
  c.el.querySelector('.in').innerHTML = md(c.node.text) + (c.node.internal ? INTERNAL : '');
}

// over the regions, never over the locked strip
async function wander(a) {
  const f = pick(FRAMES.filter((F) => !F.locked));
  await move(a, rand(f.x + 20, f.x + f.w - 20), rand(f.y + 50, f.y + f.h - 30), { speed: 360, arc: 0.3 });
}

// the first thing each agent does happens where the map opens: a note typed into
// "how i build", a card sorted into "on the side", an arrow between now and how i build
const OPENING = [['write', 'v-cheap'], ['sort', 'c-chief'], ['connect', ['x-logo', 'v-hard', 'hardware']]];
let warned = false;
async function life(a) {
  await wait(400 + a.i * 1400);
  let first = OPENING[a.i];
  for (;;) {
    const opts = Object.entries(ACTIONS).map(([k, v]) => [k, v.weight()]).filter(([, w]) => w > 0);
    let did = false;
    if (first) {
      const [name, pref] = first; first = null;
      a.last = clock;
      try { did = await ACTIONS[name].run(a, pref); } catch (err) { did = false; if (!warned) { warned = true; console.warn('canvas: an agent tripped', err); } }
      if (did) { focusOn = a; await wait(rand(500, 1200)); continue; }
    }
    if (opts.length && Math.random() < 0.86) {
      let r = Math.random() * opts.reduce((s, [, w]) => s + w, 0);
      const [name] = opts.find(([, w]) => (r -= w) < 0) || opts[0];
      a.last = clock;
      try { did = await ACTIONS[name].run(a); } catch (err) { did = false; if (!warned) { warned = true; console.warn('canvas: an agent tripped', err); } }
      if (did) focusOn = a;
    }
    if (!did) await wander(a);
    await wait(rand(500, 1600));
  }
}

// ── the view ────────────────────────────────────────────────────────────
// view.{x,y,z} is what's shown, view.{tx,ty,tz} where it's heading; x/y/z ease
// toward the targets at view.rate. direct manipulation (drags, trackpad
// scrolls, pinches) moves both at once, so it tracks the fingers 1:1.
// mode: 'home' (the reading view), 'fit' (everything), 'user' (you moved it).
const PAD = 40; // how far past the world's edge you can pan, in screen px
const view = { x: 0, y: 0, z: 1, tx: 0, ty: 0, tz: 1, rate: 6, vx: 0, vy: 0, follow: false, mode: 'home' };
const size = { w: 0, h: 0 };
let focusOn = null;
const narrow = () => size.w < 700;
const fitZoom = () => Math.min((size.w - 32) / WORLD.w, (size.h - 70) / WORLD.h);
const zMin = () => Math.min(0.3, fitZoom());
const Z_MAX = 1.8;
function measure() { size.w = board.clientWidth; size.h = board.clientHeight; }
// pan limits at zoom z: the world can't leave the board, give or take PAD
function bounds(z) {
  const x = size.w - WORLD.w * z - PAD, y = size.h - WORLD.h * z - PAD;
  return { x0: Math.min(PAD, x), x1: Math.max(PAD, x), y0: Math.min(PAD, y), y1: Math.max(PAD, y) };
}
function clampTargets() {
  view.tz = clamp(view.tz, zMin(), Z_MAX);
  const b = bounds(view.tz);
  view.tx = clamp(view.tx, b.x0, b.x1); view.ty = clamp(view.ty, b.y0, b.y1);
}
function snap() { view.x = view.tx; view.y = view.ty; view.z = view.tz; }
function freeze() { view.tx = view.x; view.ty = view.y; view.tz = view.z; view.vx = view.vy = 0; }
// the opening view: the reading row, how i build, now and on the side, side by
// side with their titles, zoomed so all three fit (a wider board shows the exowatt
// region too). a phone opens on the first column, a little zoomed out, with the
// next column showing at the edge so it reads as a map
const Z_HOME = [0.5, 0.82];
function home(instant = false) {
  const V = frameOf.vision, C = frameOf.charles, X = frameOf.xmade;
  let z, x0 = V.x, x1 = C.x + C.w;
  if (narrowLayout) { z = clamp((size.w - 24) / (V.w * 1.32), 0.56, 0.78); view.tx = 16 - V.x * z; }
  else {
    z = clamp((size.w - 56) / (x1 - x0), Z_HOME[0], Z_HOME[1]);
    if ((size.w - 56) / (X.x + X.w - x0) >= 0.62) { x1 = X.x + X.w; z = clamp((size.w - 56) / (x1 - x0), Z_HOME[0], Z_HOME[1]); }
    view.tx = size.w / 2 - ((x0 + x1) / 2) * z;
  }
  view.tz = z;
  view.ty = (narrowLayout ? 48 : 60) - V.y * z;
  clampTargets();
  view.mode = 'home'; view.rate = 6; view.vx = view.vy = 0;
  if (instant || reduce) snap();
}
function fitView() {
  const z = fitZoom();
  view.tz = z;
  view.tx = (size.w - WORLD.w * z) / 2;
  view.ty = (size.h - WORLD.h * z) / 2 + 18;
  clampTargets();
  view.mode = 'fit'; view.rate = 6; view.vx = view.vy = 0;
  setFollow(false);
  if (reduce) snap();
}
// anything you do to the view stops follow mode (and any flick in flight)
function userMoved() { view.mode = 'user'; if (view.follow) setFollow(false); }
function panBy(dx, dy, direct) {
  const ox = view.tx, oy = view.ty;
  view.tx += dx; view.ty += dy; clampTargets();
  if (direct) { view.x += view.tx - ox; view.y += view.ty - oy; }
  view.rate = 16;
  userMoved();
}
function zoomAt(f, sx, sy) {
  const z = clamp(view.tz * f, zMin(), Z_MAX);
  const wx = (sx - view.tx) / view.tz, wy = (sy - view.ty) / view.tz;
  view.tz = z; view.tx = sx - wx * z; view.ty = sy - wy * z;
  clampTargets();
  view.rate = 16; view.vx = view.vy = 0;
  if (reduce) snap();
  userMoved();
}
function followStep() {
  if (!view.follow || !focusOn) return;
  const z = view.tz;
  view.tx = size.w / 2 - focusOn.x * z;
  view.ty = size.h / 2 - focusOn.y * z;
  clampTargets();
  view.rate = 5;
}
const followBtn = ui.querySelector('.mode.follow'), exploreBtn = ui.querySelector('.mode.explore');
function setFollow(on) {
  view.follow = on;
  followBtn.setAttribute('aria-pressed', String(on));
  if (on) { view.mode = 'user'; view.vx = view.vy = 0; }
}
followBtn.addEventListener('click', () => setFollow(!view.follow));
// explore: one-finger touch pans the board instead of scrolling the page, until tapped again
let explore = false;
exploreBtn.addEventListener('click', () => {
  explore = !explore;
  exploreBtn.setAttribute('aria-pressed', String(explore));
  board.classList.toggle('explore', explore);
  engage(explore);
});

// flick velocity from the last ~100ms of a drag
function tracker() {
  const s = [];
  return {
    add(x, y) { const t = performance.now(); s.push({ x, y, t }); while (s.length > 2 && t - s[0].t > 100) s.shift(); },
    vel() {
      const a = s[0], b = s[s.length - 1];
      if (!a || a === b || performance.now() - b.t > 70) return { x: 0, y: 0 };
      const dt = (b.t - a.t) / 1000;
      return { x: clamp((b.x - a.x) / dt, -4000, 4000), y: clamp((b.y - a.y) / dt, -4000, 4000) };
    },
  };
}
function fling(v) { if (reduce || Math.hypot(v.x, v.y) < 60) return; view.vx = v.x; view.vy = v.y; }

// ── you ─────────────────────────────────────────────────────────────────
let userDrag = null, pan = null;
function boardPoint(e) { const r = board.getBoundingClientRect(); return { sx: e.clientX - r.left, sy: e.clientY - r.top }; }
board.addEventListener('pointerdown', (e) => {
  // links, buttons and the little guys keep their own clicks
  if (e.button !== 0 || e.pointerType === 'touch' || e.target.closest('.ui, a, button, .grunt')) return;
  board.focus({ preventScroll: true });
  engage(true);
  const { sx, sy } = boardPoint(e);
  const cardEl = e.target.closest('.bcard');
  if (cardEl) {
    const c = cards.get(cardEl.dataset.node);
    if (!c || c.lock) return;
    const w = toWorld(sx, sy);
    const orig = c.frame ? { f: c.frame, i: c.frame.cards.indexOf(c) } : null;
    c.lock = 'you'; c.carried = true;
    detach(c);
    c.el.style.setProperty('--ac', '#0b1020');
    c.el.classList.add('sel', 'lift');
    userDrag = { c, ox: w.x - c.x, oy: w.y - c.y, orig, x0: c.x, y0: c.y };
  } else {
    freeze();
    pan = { sx, sy, x: view.tx, y: view.ty, v: tracker() };
    board.classList.add('panning');
  }
  board.setPointerCapture(e.pointerId);
  e.preventDefault();
});
board.addEventListener('pointermove', (e) => {
  if (!userDrag && !pan) return;
  const { sx, sy } = boardPoint(e);
  if (userDrag) {
    const w = toWorld(sx, sy), c = userDrag.c;
    c.x = c.tx = clamp(w.x - userDrag.ox, 0, WORLD.w - c.w);
    c.y = c.ty = clamp(w.y - userDrag.oy, 0, WORLD.h - c.h);
  } else {
    view.tx = pan.x + (sx - pan.sx); view.ty = pan.y + (sy - pan.sy);
    clampTargets(); view.x = view.tx; view.y = view.ty;
    pan.v.add(sx, sy);
    userMoved();
  }
});
function endPointer(e) {
  if (userDrag) {
    const c = userDrag.c;
    c.carried = false; c.lock = null;
    unselect(c);
    // dropped inside a frame with room: it lives there now. anywhere else: it's loose, and someone will tidy it
    const moved = Math.hypot(c.x - userDrag.x0, c.y - userDrag.y0);
    const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
    const f = FRAMES.find((F) => !F.locked && cx > F.x && cx < F.x + F.w && cy > F.y && cy < F.y + F.h);
    if (moved < 5 && userDrag.orig) { const o = userDrag.orig; o.f.cards.splice(o.i, 0, c); c.frame = o.f; relayout(o.f); }
    else if (f && fits(f, c)) attach(c, f); else c.free = true;
    userDrag = null;
  }
  if (pan) {
    if (e.type === 'pointerup') fling(pan.v.vel());
    pan = null; board.classList.remove('panning');
  }
}
board.addEventListener('pointerup', endPointer);
board.addEventListener('pointercancel', endPointer);

// ── wheel and trackpad ──────────────────────────────────────────────────
// the rule, so the board never gets in the way of reading the page:
//  · plain vertical scrolling over the board scrolls the page. always, until you
//    take hold of the board: a click or drag on it, focusing it, or explore mode.
//    (a visitor scrolling down to the next section must never find themselves
//    panning a hidden board instead.) the pointer leaving the board lets go.
//  · a wheel "gesture" is a run of wheel events less than REST (250ms) apart,
//    trackpad momentum included; it's decided once, at its start.
//  · a clearly sideways gesture pans the board whether you hold it or not (the
//    page doesn't scroll sideways, and it keeps the browser's back-swipe from firing).
//  · once held, a mostly-vertical scroll still falls through to the page when the
//    board is panned to its edge in that direction.
//  · pinch (ctrl + wheel in chrome and firefox, gesture events in safari) and
//    ctrl/cmd + wheel always zoom the board at the pointer.
const REST = 250;
let wheelAt = -1e9, wheelOwned = false, engaged = false;
function engage(on) {
  if (engaged === on) return;
  engaged = on;
  board.classList.toggle('engaged', on);
}
board.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch' && !explore) engage(false); });
board.addEventListener('focus', () => engage(true));
board.addEventListener('blur', () => { if (!board.matches(':hover') && !explore) engage(false); });
addEventListener('wheel', (e) => {
  const now = performance.now();
  if (now - wheelAt > REST) {
    const over = board.contains(e.target) && !e.target.closest('.ui');
    const sideways = Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.4;
    wheelOwned = over && (engaged || explore || sideways);
  }
  wheelAt = now;
}, { passive: true, capture: true });
board.addEventListener('wheel', (e) => {
  const { sx, sy } = boardPoint(e);
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? size.h : 1;
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    zoomAt(Math.exp(-clamp(e.deltaY * unit, -30, 30) * 0.01), sx, sy);
    return;
  }
  if (!wheelOwned) return;
  let dx = e.deltaX * unit, dy = e.deltaY * unit;
  if (e.shiftKey && !dx) { dx = dy; dy = 0; }
  if (Math.abs(dy) > Math.abs(dx)) {
    const b = bounds(view.tz);
    const stuck = dy > 0 ? view.ty <= b.y0 + 0.5 : view.ty >= b.y1 - 0.5;
    if (stuck) return; // at the edge: the page scrolls
  }
  e.preventDefault();
  view.vx = view.vy = 0;
  // trackpads send small pixel deltas: follow them exactly. mouse wheel notches ease
  panBy(-dx, -dy, e.deltaMode === 0 && Math.abs(dx) < 60 && Math.abs(dy) < 60);
}, { passive: false });
// safari's trackpad pinch
let gest = null;
board.addEventListener('gesturestart', (e) => { e.preventDefault(); gest = touch ? null : { s: 1 }; });
board.addEventListener('gesturechange', (e) => {
  e.preventDefault();
  if (!gest || touch) return;
  const { sx, sy } = boardPoint(e);
  zoomAt(e.scale / gest.s, sx, sy); gest.s = e.scale;
});
board.addEventListener('gestureend', (e) => { e.preventDefault(); gest = null; });

// ── touch ───────────────────────────────────────────────────────────────
// one finger scrolls the page (touch-action: pan-y), unless explore is on.
// two fingers always pan and pinch the board.
let touch = null;
function touchPts(list) {
  const r = board.getBoundingClientRect(), a = list[0], b = list[1];
  if (!b) return { mx: a.clientX - r.left, my: a.clientY - r.top, d: 0 };
  return { mx: (a.clientX + b.clientX) / 2 - r.left, my: (a.clientY + b.clientY) / 2 - r.top, d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1 };
}
function touchBegin(e) {
  const n = e.touches.length;
  touch = n >= 2 || (n === 1 && explore) ? { n: Math.min(n, 2), ...touchPts(e.touches), v: tracker() } : null;
  if (touch) freeze();
}
board.addEventListener('touchstart', (e) => { if (e.target.closest('.ui, button')) { touch = null; return; } touchBegin(e); }, { passive: true });
board.addEventListener('touchmove', (e) => {
  if (!touch) return;
  if (!e.cancelable) { touch = null; return; } // the page already took it as a scroll
  if (Math.min(e.touches.length, 2) !== touch.n) { touchBegin(e); return; }
  e.preventDefault();
  const p = touchPts(e.touches);
  const z = touch.n === 2 ? clamp(view.tz * (p.d / touch.d), zMin(), Z_MAX) : view.tz;
  const wx = (touch.mx - view.tx) / view.tz, wy = (touch.my - view.ty) / view.tz;
  view.tz = z; view.tx = p.mx - wx * z; view.ty = p.my - wy * z;
  clampTargets(); snap();
  touch.v.add(p.mx, p.my);
  Object.assign(touch, { mx: p.mx, my: p.my, d: p.d });
  userMoved();
}, { passive: false });
function touchEnd(e) {
  if (!touch) return;
  const prev = touch;
  touchBegin(e);
  if (!touch && e.type === 'touchend') fling(prev.v.vel());
}
board.addEventListener('touchend', touchEnd);
board.addEventListener('touchcancel', touchEnd);

// ── the minimap: every frame, the agents and the viewport. click or drag to scrub ─
const mini = ui.querySelector('.minimap'), miniView = mini.querySelector('.mv');
const pct = (v, of) => `${((v / of) * 100).toFixed(2)}%`;
function buildMinimap() {
  // as big as fits in its corner, keeping the world's shape
  const k = Math.min((narrowLayout ? 84 : 190) / WORLD.w, (narrowLayout ? 110 : 140) / WORLD.h);
  Object.assign(mini.style, { width: `${Math.round(WORLD.w * k)}px`, height: `${Math.round(WORLD.h * k)}px` });
  for (const f of FRAMES) {
    const r = el('span', `mf${f.inbox ? ' inbox' : ''}`);
    r.dataset.color = f.color;
    Object.assign(r.style, { left: pct(f.x, WORLD.w), top: pct(f.y, WORLD.h), width: pct(f.w, WORLD.w), height: pct(f.h, WORLD.h) });
    mini.insertBefore(r, miniView);
  }
  for (const a of AGENTS) { a.dot = el('span', 'ma'); a.dot.style.setProperty('--ac', a.color); mini.append(a.dot); }
}
let scrub = null;
function scrubTo(e, direct) {
  const r = mini.getBoundingClientRect();
  const wx = ((e.clientX - r.left) / r.width) * WORLD.w, wy = ((e.clientY - r.top) / r.height) * WORLD.h;
  view.vx = view.vy = 0;
  view.tx = size.w / 2 - wx * view.tz; view.ty = size.h / 2 - wy * view.tz;
  clampTargets();
  view.rate = 14;
  if (direct || reduce) { view.x = view.tx; view.y = view.ty; }
  userMoved();
}
mini.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  scrub = { id: e.pointerId };
  engage(true);
  mini.setPointerCapture(e.pointerId);
  mini.classList.add('scrubbing');
  scrubTo(e, false);
  e.preventDefault();
});
mini.addEventListener('pointermove', (e) => { if (scrub) scrubTo(e, true); });
const endScrub = () => { scrub = null; mini.classList.remove('scrubbing'); };
mini.addEventListener('pointerup', endScrub);
mini.addEventListener('pointercancel', endScrub);

// ── keyboard, once the board has focus ──────────────────────────────────
board.tabIndex = 0;
board.addEventListener('keydown', (e) => {
  if (e.target !== board || e.altKey || e.ctrlKey || e.metaKey) return;
  const step = e.shiftKey ? 320 : 90, cx = size.w / 2, cy = size.h / 2;
  switch (e.key) {
    case 'ArrowLeft': panBy(step, 0); break;
    case 'ArrowRight': panBy(-step, 0); break;
    case 'ArrowUp': panBy(0, step); break;
    case 'ArrowDown': panBy(0, -step); break;
    case '+': case '=': zoomAt(1.2, cx, cy); break;
    case '-': case '_': zoomAt(1 / 1.2, cx, cy); break;
    case '0': home(); break;
    default: return;
  }
  e.preventDefault();
});
ui.querySelector('.zoom').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.z === 'fit') { fitView(); return; }
  zoomAt(b.dataset.z === '+' ? 1.2 : 1 / 1.2, size.w / 2, size.h / 2);
});

// the cards' links and the request button live on the board, so tabbing to one
// brings it into view. (the board clips with overflow: hidden, which the browser
// would otherwise scroll to show a focused child, knocking the world out of place)
board.addEventListener('scroll', () => { board.scrollTop = 0; board.scrollLeft = 0; });
board.addEventListener('focusin', (e) => {
  const t = e.target;
  if (t === board || !world.contains(t)) return;
  board.scrollTop = 0; board.scrollLeft = 0;
  const r = board.getBoundingClientRect(), b = t.getBoundingClientRect(), m = 64;
  const dx = b.left - r.left < m ? m - (b.left - r.left) : b.right > r.right - m ? r.right - m - b.right : 0;
  const dy = b.top - r.top < m ? m - (b.top - r.top) : b.bottom > r.bottom - 96 ? r.bottom - 96 - b.bottom : 0;
  if (dx || dy) panBy(dx, dy);
});

// ── frame loop ──────────────────────────────────────────────────────────
const zpct = ui.querySelector('.zpct');
let last = performance.now(), miniKey = '', lodKey = '', cullKey = '', gridKey = '', worldKey = '';
const CULL = 260; // world px beyond the edge a card stays painted
// zoomed out, cards fade to blocks and the region titles grow (css reads these)
function lod() {
  const z = view.z;
  const level = z < 0.36 ? 'low' : z < 0.52 ? 'mid' : 'full';
  const iz = clamp(1 / z, 1, narrowLayout ? 2.4 : 3.4);
  const key = `${level}|${iz.toFixed(2)}`;
  if (key === lodKey) return;
  lodKey = key;
  board.dataset.lod = level;
  board.style.setProperty('--iz', iz.toFixed(3));
}
// cards outside the view (plus a margin) aren't painted at all
function cull() {
  const x0 = -view.x / view.z - CULL, y0 = -view.y / view.z - CULL, x1 = x0 + size.w / view.z + 2 * CULL, y1 = y0 + size.h / view.z + 2 * CULL;
  for (const c of cards.values()) {
    const out = c.x + c.w < x0 || c.x > x1 || c.y + c.h < y0 || c.y > y1;
    if (out !== c.culled) { c.culled = out; c.el.style.visibility = out && !c.carried ? 'hidden' : ''; }
  }
}
function render() {
  const wt = `translate(${view.x.toFixed(2)}px, ${view.y.toFixed(2)}px) scale(${view.z.toFixed(4)})`;
  if (wt !== worldKey) { worldKey = wt; world.style.transform = wt; }
  const gk = `${view.x.toFixed(1)},${view.y.toFixed(1)},${view.z.toFixed(4)}`;
  if (gk !== gridKey) {
    gridKey = gk;
    board.style.setProperty('--gx', `${view.x.toFixed(1)}px`);
    board.style.setProperty('--gy', `${view.y.toFixed(1)}px`);
    board.style.setProperty('--gs', `${(22 * view.z).toFixed(2)}px`);
  }
  const pctTxt = `${Math.round(view.z * 100)}%`;
  if (zpct.textContent !== pctTxt) zpct.textContent = pctTxt;
  lod();
  for (const c of cards.values()) {
    if (!(Math.abs(c.x - c.shownX) <= 0.05 && Math.abs(c.y - c.shownY) <= 0.05)) {
      c.el.style.transform = `translate(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px)`;
      c.shownX = c.x; c.shownY = c.y;
    }
  }
  const inv = 1 / view.z;
  for (const a of AGENTS) {
    const t = `translate(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px) scale(${inv.toFixed(4)})`;
    if (t !== a.shownT) { a.el.style.transform = t; a.shownT = t; }
    const d = `${pct(a.x, WORLD.w)}|${pct(a.y, WORLD.h)}`;
    if (d !== a.shownD) { a.shownD = d; a.dot.style.left = pct(a.x, WORLD.w); a.dot.style.top = pct(a.y, WORLD.h); }
  }
  // the viewport on the minimap, in world units, clipped by the minimap itself
  const vx = -view.x / view.z, vy = -view.y / view.z, vw = size.w / view.z, vh = size.h / view.z;
  const key = `${vx.toFixed(1)},${vy.toFixed(1)},${vw.toFixed(1)}`;
  if (key !== miniKey) {
    miniKey = key;
    Object.assign(miniView.style, { left: pct(vx, WORLD.w), top: pct(vy, WORLD.h), width: pct(vw, WORLD.w), height: pct(vh, WORLD.h) });
  }
  // cull when the view moved a card's width, or a card moved (agents carry them in and out)
  const ck = `${(vx / 60) | 0},${(vy / 60) | 0},${(vw / 60) | 0},${cards.size}`;
  if (ck !== cullKey || active) { cullKey = ck; cull(); }
  updateEdges();
}
function tick(now) {
  requestAnimationFrame(tick);
  ticks++;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!active) return;
  clock += dt * 1000;
  for (let i = timers.length - 1; i >= 0; i--) if (timers[i].at <= clock) { timers[i].r(); timers.splice(i, 1); }
  for (const a of AGENTS) stepAgent(a);
  const k = 1 - Math.exp(-dt * 11);
  for (const c of cards.values()) if (!c.carried) { c.x += (c.tx - c.x) * k; c.y += (c.ty - c.y) * k; }
  followStep();
  // a flick keeps gliding after you let go, and stops at the edge
  if (view.vx || view.vy) {
    const ox = view.tx, oy = view.ty, wantX = ox + view.vx * dt, wantY = oy + view.vy * dt;
    view.tx = wantX; view.ty = wantY; clampTargets();
    if (Math.abs(view.tx - wantX) > 0.01) view.vx = 0;
    if (Math.abs(view.ty - wantY) > 0.01) view.vy = 0;
    view.x += view.tx - ox; view.y += view.ty - oy;
    const d = Math.exp(-dt * 4.2);
    view.vx *= d; view.vy *= d;
    if (Math.hypot(view.vx, view.vy) < 12) view.vx = view.vy = 0;
  }
  const kv = reduce ? 1 : 1 - Math.exp(-dt * view.rate);
  view.x += (view.tx - view.x) * kv; view.y += (view.ty - view.y) * kv; view.z += (view.tz - view.z) * kv;
  render();
}

// ── boot ────────────────────────────────────────────────────────────────
// a card lands in its frame if it fits, else the inbox, else it waits off the board
const dropped = [];
function place(id, f) {
  if (!byId[id] || cards.has(id)) return null;
  const c = makeCard(id);
  if (fits(f, c)) attach(c, f);
  else if (!f.inbox && fits(frameOf.inbox, c)) attach(c, frameOf.inbox);
  else { c.el.remove(); cards.delete(id); dropped.push(id); return null; }
  return c;
}
// lay the map out for this size: measure every card that could land, pick the
// wide or the phone layout, size each region to hold everything it could, then
// build the regions
let narrowLayout = false;
// column pitch: the columns spread to fill the region, with the same 16px inset as the rest
const pitch = (meta, cols, w) => (cols > 1 ? (w - 32 - (meta.logos ? 96 : CW)) / (cols - 1) : CELL);
function layout() {
  narrowLayout = narrow();
  board.classList.toggle('narrow', narrowLayout);
  CW = narrowLayout ? 288 : 236; CELL = CW + 16;
  measureCards();
  const homeId = (id) => PIN[id] || HOME[byId[id].cluster];
  const ids = (fid) => (fid === 'inbox' ? START.inbox : [...(START[fid] || []), ...START.inbox.filter((id) => homeId(id) === fid), ...POOL.filter((id) => homeId(id) === fid)]);
  // how tall a region of n columns must be to hold everything that could live there
  const need = (fid, cols, w = fw(cols)) => {
    const probe = ids(fid).map((id) => ({ id, node: byId[id], h: heightOf[id] }));
    return Math.ceil(slots({ x: 0, y: 0, cols, cell: pitch(META[fid], cols, w), logos: META[fid].logos }, probe).bottom + (fid === 'inbox' ? 120 : 28));
  };
  const L = narrowLayout ? layoutNarrow(need) : layoutWide(need);
  FRAMES = L.map((p) => {
    const meta = META[p.id];
    const w = p.w || fw(p.cols);
    return { ...meta, ...p, x: p.x + M, y: p.y + M, w, cell: pitch(meta, p.cols, w), cards: [] };
  });
  frameOf = Object.fromEntries(FRAMES.map((f) => [f.id, f]));
  WORLD.w = Math.max(...FRAMES.map((f) => f.x + f.w)) + M;
  WORLD.h = Math.max(...FRAMES.map((f) => f.y + f.h)) + M;
  for (const [k, v] of Object.entries({ width: WORLD.w, height: WORLD.h, viewBox: `0 0 ${WORLD.w} ${WORLD.h}` })) edgeSvg.setAttribute(k, v);
  buildFrames();
  buildMinimap();
}
function boot() {
  measure();
  layout();
  for (const [fid, ids] of Object.entries(START)) for (const id of ids) place(id, frameOf[fid]);
  board.dataset.dropped = dropped.join(' '); // for the shots tool: anything that didn't fit at load
  board.dataset.overflow = ''; // (kept for the tools: nothing on the map can overflow its region now)
  snapAll();
  adopt(world); // the little guy perched on "now"
  AGENTS.forEach((a, i) => { const f = frameOf[['xmade', 'own', 'ideas'][i]]; a.x = f.x + f.w * 0.6; a.y = f.y + Math.min(f.h * 0.55, 420); });
  // a few arrows already drawn, so the map never starts bare
  for (const [x, y, label] of LINKS.slice(0, 5)) {
    const A = itemOf(x), B = itemOf(y);
    if (A && B) { const e = newEdge(A, B, label, AGENTS[0].color); e.b = B; linked.add(`${x}|${y}`); }
  }
  focusOn = AGENTS[0];
  if (reduce) stillLife();
  home(true);
  setFollow(false); // the opening view is for reading; "follow agents" is a tap away
  render();
  board.classList.add('ready');

  let inView = false;
  const sync = () => { active = inView && !document.hidden; board.classList.toggle('live', active && !reduce); };
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; sync(); }, { threshold: 0.15 }).observe(board);
  document.addEventListener('visibilitychange', sync);
  new ResizeObserver(() => {
    measure();
    if (view.mode === 'home') home(); else if (view.mode === 'fit') fitView(); else clampTargets();
    if (!active) { snap(); render(); }
  }).observe(board);
  // reduced motion still gets the view (pan, zoom, minimap), just no agents at work
  if (!reduce) AGENTS.forEach((a) => life(a));
  requestAnimationFrame(tick);
  // for the shots tools: where things are, and a way to look at one frame
  window.__board = {
    get view() { return { ...view }; },
    get debug() { return { clock: Math.round(clock), active, ticks, timers: timers.length, agents: AGENTS.map((a) => ({ x: Math.round(a.x), y: Math.round(a.y), tw: !!a.tw, say: a.sayEl.textContent, carry: !!a.carry })), pool: pool.size, inbox: frameOf.inbox.cards.length }; },
    frames: FRAMES.map(({ id, x, y, w, h }) => ({ id, x, y, w, h })), world: { ...WORLD }, narrow: narrowLayout,
    show(id, z = 1) { const f = frameOf[id]; view.tz = z; view.tx = size.w / 2 - (f.x + f.w / 2) * z; view.ty = 64 - f.y * z; clampTargets(); snap(); render(); userMoved(); },
  };
}

// reduced motion: the board as it looks once the agents have been at it a while
function stillLife() {
  for (const c of [...frameOf.inbox.cards]) { const f = homeOf(c.id); if (fits(f, c)) { detach(c); attach(c, f); } }
  for (const id of POOL.slice(0, 3)) { const f = homeOf(id); const c = makeCard(id); c.written = true; if (fits(f, c)) attach(c, f); else { c.el.remove(); cards.delete(id); } }
  snapAll();
  for (const [x, y, label] of LINKS.slice(0, 12)) { const A = itemOf(x), B = itemOf(y); if (A && B && !linked.has(`${x}|${y}`)) { const e = newEdge(A, B, label, AGENTS[1].color); e.b = B; linked.add(`${x}|${y}`); } }
  const spots = [cards.get('x-patents'), cards.get('t-pokemon'), cards.get('v-already')];
  AGENTS.forEach((a, i) => { const c = spots[i] || [...cards.values()][i]; a.x = c.x + c.w * 0.7; a.y = c.y + c.h * 0.6; });
}

if (board) {
  try {
    if (document.fonts?.ready) document.fonts.ready.then(boot); else boot();
  } catch (err) {
    console.warn('canvas: could not start', err);
  }
}
