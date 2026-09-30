// grunts.js — the little guys around the page.
// each [data-grunt] is a seeded grunt from the gruntworks mascot kit: same seed,
// same face. they bob, drift or patrol, look toward the cursor, change mood on
// their own now and then, get excited when you hover and celebrate when you
// click. drawn as svg strings at ~30 fps, only while on screen.
//
// data-grunt  seed             data-size   px
// data-state  resting state    data-tool   "hammer"
// data-move   bob | drift | patrol
// data-moods  comma list of states it drifts into

import { rollLook, rollName, createMascotEngine, renderFrameToSvg } from './vendor/grunt-mascot.js';

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const now = () => performance.now() / 1000;
const FPS = 30;

const pointer = { x: -1e4, y: -1e4, on: false };
if (fine) {
  window.addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.on = true; }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { pointer.on = false; });
}

const greetings = ['hi', 'hey', 'yo', 'hello', 'sup'];

function make(el, i) {
  const seed = el.dataset.grunt;
  const look = rollLook(seed);
  const size = +el.dataset.size || 56;
  const rest = el.dataset.state || 'idle';
  const moods = (el.dataset.moods || 'happy,curious').split(',').map((s) => s.trim()).filter(Boolean);
  const tool = el.dataset.tool || null;
  const name = rollName(seed).split(' ')[0].toLowerCase();
  el.style.setProperty('--gs', `${size}px`);
  el.setAttribute('aria-hidden', 'true');
  const body = document.createElement('span');
  body.className = 'grunt-body';
  const bubble = document.createElement('span');
  bubble.className = 'grunt-bubble';
  bubble.textContent = `${greetings[i % greetings.length]}, i'm ${name}`;
  el.append(body, bubble);

  const eng = createMascotEngine(look, { initialState: rest });
  const g = {
    el, body, bubble, eng, look: { ...look, tool }, size, rest, moods, tool,
    prefix: `gr${i}`, move: el.dataset.move || 'bob', phase: i * 1.7 + Math.random() * 3,
    visible: false, hover: false, until: 0, nextMood: now() + 3 + Math.random() * 5, lastDraw: 0,
    x: 0, vx: 1, gazeOn: false,
  };

  const setState = (st, hold) => { eng.setState(st, now()); g.until = hold ? now() + hold : 0; if (reduce) draw(g, true); };
  g.setState = setState;

  el.addEventListener('pointerenter', () => { g.hover = true; el.classList.add('talk'); setState('excited'); });
  el.addEventListener('pointerleave', () => { g.hover = false; el.classList.remove('talk'); setState(g.rest); });
  el.addEventListener('click', (e) => {
    if (!el.closest('a')) e.preventDefault();
    setState('celebrate', 2.2);
    el.classList.add('talk');
    clearTimeout(g.talkT);
    g.talkT = setTimeout(() => { if (!g.hover) el.classList.remove('talk'); }, 1800);
  });
  return g;
}

function draw(g, force = false) {
  const t = reduce ? g.eng.restPoseTime() : now();
  if (!force && t - g.lastDraw < 1 / FPS) return;
  g.lastDraw = t;
  g.body.innerHTML = renderFrameToSvg(g.eng.sample(t), g.look, g.size, { idPrefix: g.prefix });
}

// movement is a transform on the host, separate from the character's own animation
function place(g, t, dt) {
  let tx = 0, ty = 0, rot = 0;
  if (g.move === 'bob') {
    ty = Math.sin(t * 1.7 + g.phase) * 4;
  } else if (g.move === 'drift') {
    tx = Math.sin(t * 0.31 + g.phase) * 46 + Math.sin(t * 0.83 + g.phase * 2) * 10;
    ty = Math.cos(t * 0.27 + g.phase) * 30 + Math.sin(t * 1.4) * 5;
    rot = Math.sin(t * 0.5 + g.phase) * 6;
  } else if (g.move === 'patrol') {
    // walk along the parent's width, turn at the ends, hop a little
    const w = (g.el.parentElement?.clientWidth || 600) - g.size;
    if (!g.hover) g.x += g.vx * dt * 46;
    if (g.x > w) { g.x = w; g.vx = -1; }
    if (g.x < 0) { g.x = 0; g.vx = 1; }
    tx = g.x;
    ty = -Math.abs(Math.sin(t * 5.2 + g.phase)) * 7;
  }
  g.el.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) rotate(${rot.toFixed(2)}deg)`;
}

function gaze(g, t) {
  if (g.move === 'patrol' && !g.hover) {
    g.eng.setGaze({ yaw: g.vx * 32, pitch: 4, mix: 1, spin: 0, wander: 0.2 }, t);
    g.gazeOn = true;
    return;
  }
  if (!pointer.on) { if (g.gazeOn) { g.eng.setGaze(null, t); g.gazeOn = false; } return; }
  const r = g.el.getBoundingClientRect();
  const dx = pointer.x - (r.left + r.width / 2), dy = pointer.y - (r.top + r.height / 2);
  const d = Math.hypot(dx, dy);
  if (d > 700) { if (g.gazeOn) { g.eng.setGaze(null, t); g.gazeOn = false; } return; }
  g.eng.setGaze({ yaw: clamp(dx / 7, -38, 38), pitch: clamp(-dy / 9, -26, 26), mix: 1, spin: 0, wander: 0.15 }, t);
  g.gazeOn = true;
}

function boot() {
  const els = [...document.querySelectorAll('[data-grunt]')];
  if (!els.length) return;
  let grunts;
  try { grunts = els.map(make); } catch (err) {
    console.warn('grunts: staying home', err);
    document.documentElement.classList.add('no-grunts');
    return;
  }

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) { const g = grunts.find((x) => x.el === e.target); if (g) g.visible = e.isIntersecting; }
  }, { rootMargin: '80px' });
  grunts.forEach((g) => { io.observe(g.el); draw(g, true); });
  if (reduce) return;

  let last = now();
  const loop = () => {
    requestAnimationFrame(loop);
    if (document.hidden) return;
    const t = now(), dt = Math.min(0.05, t - last);
    last = t;
    for (const g of grunts) {
      // the guide lives in a fixed box that is hidden until you scroll; still cheap to skip
      if (!g.visible) continue;
      if (g.until && t > g.until) { g.until = 0; g.eng.setState(g.hover ? 'excited' : g.rest, t); }
      if (!g.hover && !g.until && t > g.nextMood) {
        const mood = g.moods[Math.floor(Math.random() * g.moods.length)];
        g.eng.setState(mood, t);
        g.until = t + 2.4 + Math.random() * 1.6;
        g.nextMood = t + 6 + Math.random() * 7;
      }
      place(g, t, dt);
      gaze(g, t);
      draw(g);
    }
  };
  requestAnimationFrame(loop);
}

boot();
