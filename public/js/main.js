// main.js — palettes, pointer, ripples, and the scroll choreography:
// the hero lifts back into the distance as it scrolls away, and everything
// below stands up in 3d as it scrolls into view.

const root = document.documentElement;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

// base first, then four fields laid over it in order
export const PALETTES = [
  { name: 'sunrise', base: '#6a2bff', colors: ['#18a0ff', '#ff2d87', '#ff7a1a', '#ffd23f'] },
  { name: 'lagoon', base: '#1238ff', colors: ['#00b8ff', '#00dca0', '#8a5cff', '#d6f7ff'] },
  { name: 'dusk', base: '#24126b', colors: ['#6a2cff', '#ff3d7a', '#ff9a3d', '#ffc2e0'] },
  { name: 'ember', base: '#ff1f4b', colors: ['#ff9a00', '#ff2fb0', '#6a2cff', '#ffe066'] },
];

const hero = $('[data-hero]');
const canvas = $('.sky');
const swatches = $('.palettes');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// ── palettes ────────────────────────────────────────────────────────────
let current = 0;
try { const s = +localStorage.getItem('palette'); if (s > 0 && s < PALETTES.length) current = s; } catch { /* private mode */ }

function applyCss(p) {
  const s = root.style;
  s.setProperty('--c0', p.base);
  p.colors.forEach((c, i) => s.setProperty(`--c${i + 1}`, c));
}
applyCss(PALETTES[current]);

PALETTES.forEach((p, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'swatch';
  b.setAttribute('aria-label', `colors: ${p.name}`);
  b.title = p.name;
  b.style.setProperty('--sw', `conic-gradient(from 200deg, ${p.base}, ${p.colors.join(', ')}, ${p.base})`);
  b.setAttribute('aria-pressed', String(i === current));
  b.addEventListener('click', (e) => { e.stopPropagation(); pick(i); });
  swatches?.append(b);
});

let field = null;
function pick(i) {
  current = i;
  applyCss(PALETTES[i]);
  [...swatches.children].forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
  field?.setPalette(PALETTES[i]);
  try { localStorage.setItem('palette', String(i)); } catch { /* fine */ }
}

// ── scroll choreography ─────────────────────────────────────────────────
const lifts = $$('[data-lift]');
const risers = $$('[data-rise]');
const fallback = $('.sky-fallback');
let anchors = []; // page-space y of each riser's upper third
let heroH = 1;

function measure() {
  heroH = hero.offsetHeight || window.innerHeight;
  for (const el of risers) el.style.transform = 'none';
  anchors = risers.map((el) => { const r = el.getBoundingClientRect(); return r.top + window.scrollY + Math.min(r.height * 0.35, 120); });
  frame(true);
}

let lastY = -1, lastVh = -1;
function frame(force = false) {
  const y = window.scrollY, vh = window.innerHeight;
  if (!force && y === lastY && vh === lastVh) return;
  lastY = y; lastVh = vh;
  const s = clamp(y / (heroH * 0.85));
  root.classList.toggle('guide-on', y > heroH * 0.9);
  if (reduce) return;

  // the hero leans back and drifts away, a little staggered top to bottom
  lifts.forEach((el, i) => {
    const t = clamp(s * 1.25 - i * 0.06);
    const e = t * t * (3 - 2 * t);
    el.style.transform = t <= 0 ? '' : `perspective(1100px) translate3d(0, ${(-e * 70).toFixed(1)}px, ${(-e * 380).toFixed(1)}px) rotateX(${(e * 24).toFixed(2)}deg)`;
    el.style.opacity = t <= 0 ? '' : (1 - e * 1.1).toFixed(3);
  });

  // everything below stands up out of the horizon as it enters, scrubbed both ways
  risers.forEach((el, i) => {
    const top = anchors[i] - y;                  // where its anchor sits in the viewport
    const p = clamp((vh * 0.97 - top) / (vh * 0.42));
    const e = 1 - Math.pow(1 - p, 3);
    const k = (1 - e) * (el.dataset.rise === 'soft' ? 0.45 : 1);
    el.style.transform = k < 0.001 ? '' : `perspective(1400px) translate3d(0, ${(k * 110).toFixed(1)}px, ${(-k * 320).toFixed(1)}px) rotateX(${(k * 62).toFixed(2)}deg)`;
    el.style.opacity = k < 0.001 ? '' : clamp(e * 1.15).toFixed(3);
  });
}
const tick = () => { frame(); requestAnimationFrame(tick); };

// ── the colour ──────────────────────────────────────────────────────────
async function start() {
  let ok = false;
  try { ok = !!document.createElement('canvas').getContext('webgl2'); } catch { /* no */ }
  if (!ok) { root.classList.add('no-gl'); return; }
  try {
    const { createGradient } = await import('./gradient.js');
    field = createGradient(canvas, {
      palette: PALETTES[current],
      still: reduce,
      onFirstFrame: () => { canvas.classList.add('on'); root.classList.add('gl-on'); if (fallback) fallback.style.opacity = ''; },
    });
  } catch (err) {
    console.warn('gradient: staying with the css version', err);
    root.classList.add('no-gl');
    return;
  }
  frame(true);

  // draw only while the hero is on screen and the tab is visible
  let inView = true;
  const sync = () => field.setRunning(inView && !document.hidden);
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; sync(); }).observe(hero);
  document.addEventListener('visibilitychange', sync);
  sync();

  const ndc = (e) => { const r = hero.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2]; };
  if (fine) {
    hero.addEventListener('pointermove', (e) => field.setPointer(...ndc(e)), { passive: true });
    hero.addEventListener('pointerleave', () => field.setPointer(null));
    window.addEventListener('blur', () => field.setPointer(null));
  }
  // ripples: a click on open colour, not on words, links or grunts
  hero.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('a, button, .grunt, p, h1')) return;
    field.ripple(...ndc(e), 1);
  }, { passive: true });

  window.__field = field;
}

// the corner guide is a door to the 3d section. it steps aside while the board or
// the 3d section fills the screen (it would sit on the board's minimap and zoom)
{
  const big = new Map();
  const io = new IntersectionObserver((es) => {
    for (const e of es) big.set(e.target, e.intersectionRatio > 0.3 || e.intersectionRect.height > window.innerHeight * 0.45);
    root.classList.toggle('guide-hide', [...big.values()].some(Boolean));
  }, { threshold: [0, 0.15, 0.3, 0.5, 0.75, 1] });
  for (const el of $$('.board, #fly')) io.observe(el);
}

// in-page links (the nav's "map", the hero pill) glide down instead of jumping
document.addEventListener('click', (e) => {
  const a = e.target.closest?.('a[href^="#"]');
  const to = a && a.getAttribute('href').length > 1 && document.getElementById(a.getAttribute('href').slice(1));
  if (!to || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  to.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  history.replaceState(null, '', a.getAttribute('href'));
});

// ── boot ────────────────────────────────────────────────────────────────
measure();
window.addEventListener('resize', () => requestAnimationFrame(measure));
window.addEventListener('load', measure);
document.fonts?.ready.then(measure);
requestAnimationFrame(tick);
start();
