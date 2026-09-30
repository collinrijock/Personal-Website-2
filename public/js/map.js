// map.js — boots the brainstorm, or leaves the list if it can't.
// owns the chrome: tour, search, list and the hint. the 3d lives in map-world.js.
import { CLUSTERS, NODES } from './content.js';
import { plainHtml, nodeText, esc } from './map-plain.js';

const root = document.documentElement;
const $ = (s, el = document) => el.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const touch = matchMedia('(hover: none) and (pointer: coarse)').matches;
if (touch) root.classList.add('touch');

// the list always matches content.js, even if map.html's copy is stale
const plain = $('#plain');
const slot = plain && [...plain.childNodes].find((n) => n.nodeType === 8 && n.data.startsWith(' plain:start'));
if (slot) {
  let n = slot.nextSibling;
  while (n && !(n.nodeType === 8 && n.data.startsWith(' plain:end'))) { const next = n.nextSibling; n.remove(); n = next; }
  slot.after(document.createRange().createContextualFragment(plainHtml()));
}

function hasGL() {
  try {
    const c = document.createElement('canvas');
    const g = c.getContext('webgl2');
    g?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!g;
  } catch { return false; }
}

function listOnly() {
  root.classList.remove('gl');
  root.classList.add('no-gl');
}

async function boot() {
  if (!hasGL()) { listOnly(); return; }
  root.classList.add('gl');
  let world;
  try {
    const { createWorld } = await import('./map-world.js');
    world = await createWorld({ stage: $('#stage'), reduce, touch, onTour: (s) => showTour(s) });
    wire(world);
  } catch (err) {
    console.warn('map: showing the list instead', err);
    $('#stage').replaceChildren();
    listOnly();
  }
}

/* ── the chrome ─────────────────────────────────────────────────────── */
const btn = (act) => $(`.bar-r [data-act="${act}"]`);
const tourbar = $('#tourbar');

let hideHint = () => {};
function showTour({ on, i, n, title }) {
  if (on && tourbar.hidden) hideHint(); // the tour bar wants the bottom of the screen
  btn('tour')?.setAttribute('aria-pressed', String(on));
  tourbar.hidden = !on;
  $('.tour-n', tourbar).textContent = `${i + 1} / ${n}`;
  $('.tour-t', tourbar).textContent = title;
}

function wire(world) {
  window.__map = world; // for tools/shots-map.mjs

  // hint: shown until you close it once
  const hint = $('#hint');
  const setHint = (show, remember) => {
    hint.hidden = !show;
    btn('hint').setAttribute('aria-pressed', String(show));
    if (remember) { try { localStorage.setItem('map-hint', show ? 'on' : 'off'); } catch { /* private mode */ } }
  };
  let seen = null;
  try { seen = localStorage.getItem('map-hint'); } catch { /* fine */ }
  setHint(seen !== 'off', false);
  hideHint = () => setHint(false, false);
  btn('hint').addEventListener('click', () => setHint(hint.hidden, true));
  $('[data-act="hint-close"]', hint).addEventListener('click', () => { setHint(false, true); btn('hint').focus(); });

  // list
  const setList = (open) => {
    root.classList.toggle('list-open', open);
    btn('list').setAttribute('aria-pressed', String(open));
    if (open) plain.focus({ preventScroll: true });
  };
  btn('list').addEventListener('click', () => setList(!root.classList.contains('list-open')));

  // tour
  btn('tour').addEventListener('click', () => world.tourToggle());
  $('[data-act="tour-prev"]', tourbar).addEventListener('click', () => world.tourPrev());
  $('[data-act="tour-next"]', tourbar).addEventListener('click', () => world.tourNext());

  const search = makeSearch(world);
  btn('search').addEventListener('click', () => (search.isOpen() ? search.close(true) : search.open()));

  addEventListener('keydown', (e) => {
    const t = e.target;
    const typing = t.closest?.('input, textarea, [contenteditable]');
    if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'f') { e.preventDefault(); search.open(); return; }
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); search.open(); return; }
    if (e.key === '?') { setHint(hint.hidden, true); return; }
    if (e.key === 'Escape') {
      if (root.classList.contains('list-open')) { setList(false); btn('list').focus(); return; }
      world.escape();
      return;
    }
    // space is the tour's "next", even with the tour buttons focused; other buttons and links keep it
    if (e.key === ' ' && (t.closest?.('[data-act^="tour"]') || !t.closest?.('button, a, summary, .plain'))) { e.preventDefault(); world.tourNext(); }
  });
}

/* ── search, like the canvas's ─────────────────────────────────────── */
function makeSearch(world) {
  const box = $('#search'), input = $('#q'), count = $('#count'), list = $('#hits');
  const clusterTitle = Object.fromEntries(CLUSTERS.map((c) => [c.id, c.title]));
  const index = NODES.map((n) => { const text = nodeText(n); return { id: n.id, cluster: n.cluster, text, lc: text.toLowerCase() }; });
  let hits = [], cur = 0, q = '', timer = 0, opener = null;

  const snippet = (h) => {
    const at = h.lc.indexOf(q);
    const from = Math.max(0, at - 24);
    const pre = (from ? '…' : '') + h.text.slice(from, at);
    return `${esc(pre)}<mark>${esc(h.text.slice(at, at + q.length))}</mark>${esc(h.text.slice(at + q.length))}`;
  };
  function render() {
    count.textContent = !q ? '' : hits.length ? `${cur + 1} of ${hits.length}` : 'no matches';
    list.innerHTML = hits.map((h, i) =>
      `<li role="option" id="hit-${i}" data-i="${i}" aria-selected="${i === cur}"><span class="hx">${snippet(h)}</span><span class="hc">${esc(clusterTitle[h.cluster])}</span></li>`).join('');
    input.setAttribute('aria-activedescendant', hits.length ? `hit-${cur}` : '');
    list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
    world.highlight(q ? new Set(hits.map((h) => h.id)) : null, hits[cur]?.id);
  }
  function go(i) {
    if (!hits.length) return;
    cur = (i + hits.length) % hits.length;
    render();
    world.focusNode(hits[cur].id);
  }
  let flown = false; // has the camera gone to the current hit yet
  input.addEventListener('input', () => {
    q = input.value.trim().toLowerCase();
    hits = q ? index.filter((h) => h.lc.includes(q)) : [];
    cur = 0;
    flown = false;
    render();
    clearTimeout(timer);
    if (hits.length) timer = setTimeout(() => { flown = true; world.focusNode(hits[0].id); }, 260);
  });
  const step = (d) => { clearTimeout(timer); go(cur + d); flown = true; };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); step(1); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); step(-1); return; }
    if (e.key === 'Enter') { e.preventDefault(); step(e.shiftKey ? -1 : flown ? 1 : 0); }
  });
  list.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (li) { step(+li.dataset.i - cur); input.focus(); }
  });
  $('[data-act="prev"]', box).addEventListener('click', () => { step(-1); input.focus(); });
  $('[data-act="next"]', box).addEventListener('click', () => { step(1); input.focus(); });
  $('[data-act="close"]', box).addEventListener('click', () => close(true));

  function open() {
    if (box.hidden) opener = document.activeElement;
    box.hidden = false;
    $('.bar-r [data-act="search"]').setAttribute('aria-pressed', 'true');
    input.focus();
    input.select();
    world.searching(true);
    if (q) render();
  }
  function close(restore) {
    if (box.hidden) return;
    box.hidden = true;
    clearTimeout(timer);
    $('.bar-r [data-act="search"]').setAttribute('aria-pressed', 'false');
    world.highlight(null);
    world.searching(false);
    if (restore) (opener && opener !== document.body ? opener : $('.bar-r [data-act="search"]')).focus?.();
  }
  return { open, close, isOpen: () => !box.hidden };
}

boot();
