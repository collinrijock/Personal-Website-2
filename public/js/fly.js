// fly.js — the #fly section: the brainstorm map, ending in "say hi."
//
// two ways through it:
//   scrolling  the section is a short track with a sticky, full-viewport stage. how far you've
//              scrolled through the track is the progress, smoothed every frame: the camera
//              drifts in from far out towards the name, the 3d fades into a soft palette wash and
//              the call to action flies in out of the depth. it's a pass, not a trap.
//   immersed   a click on the map (or "step into the map") pins the stage over the page and stops
//              the page scrolling. now the wheel, the scrubber and the arrow keys fly the camera
//              along the whole flight (js/map-world.js in scroll mode), past every board, and a
//              drag pans the view. "back to the site" (or esc) puts the page back where it was.
//
// it only loads three.js when the section gets near, only draws while the section is on screen,
// the tab is visible and the hero's gradient is off screen (the two never run together).
// reduced motion gets one still pose; no webgl2 (or a failed import) gets css colour; no
// javascript gets the call to action as a plain section. neither of those steps into the map.

const sec = document.querySelector('[data-fly]');

// section progress -> what happens while scrolling
const DRIFT = [0.3, 0.56]; // where the scroll's drift starts and ends, as shares of the way in to the name
const FADE = [0.44, 0.62]; // the 3d gives way to the wash
const LAND = [0.5, 0.78]; // the call to action comes in
const HEAD = [0.36, 0.48]; // the section's title steps aside
const SMOOTH = 6; // per second: how quickly the camera catches up with the scroll
const GLIDE = 4.5; // per second, immersed: how quickly the camera catches up with the wheel / scrubber
const BACK = 3.2; // per second: the glide back to the scroll's pose after stepping out
const PAN = 16; // per second: how quickly a drag's pan is followed
const WHEEL = 0.00018; // immersed: flight per pixel of wheel
const STILL = 0.5; // reduced motion's one pose, as a share of the way in to the name

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = (v, to, rate, dt) => (Math.abs(to - v) < 1e-4 ? to : v + (to - v) * (1 - Math.exp(-dt * rate)));

// js/main.js already made a webgl2 context for the hero and marks the page no-gl when it
// can't; a second probe context here cost seconds on software renderers, so ask the page
function hasGL() {
  const root = document.documentElement;
  if (root.classList.contains('no-gl')) return false;
  if (root.classList.contains('gl-on') || document.querySelector('.sky')) return true;
  try { const g = document.createElement('canvas').getContext('webgl2'); g?.getExtension('WEBGL_lose_context')?.loseContext(); return !!g; } catch { return false; }
}

if (sec) boot();

function boot() {
  const $ = (s) => sec.querySelector(s);
  const track = $('.fly-track'), stage = $('.fly-stage'), worldEl = $('.fly-world'), mount = $('.fly-mount');
  const cta = $('.fly-cta'), land = $('.fly-land'), head = $('.fly-head'), nowEl = $('.fly-now');
  const ui = $('[data-fly-ui]'), range = $('.fly-range'), ticks = $('.fly-ticks');
  const enterBtn = $('[data-fly-enter]'), backBtn = $('[data-fly-back]');
  const hero = document.querySelector('[data-hero]');
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(hover: none) and (pointer: coarse)').matches;
  const darkQ = matchMedia('(prefers-color-scheme: dark)');

  let mode = !hasGL() ? 'flat' : reduce ? 'still' : 'fly';
  const setMode = (m) => {
    sec.classList.remove('is-flat', 'is-still', 'is-fly');
    sec.classList.add(`is-${m}`);
    mode = m;
  };
  setMode(mode);

  const st = {
    world: null, loading: false, near: false, inView: false, heroIn: !!hero,
    target: 0, p: 0, landed: mode !== 'fly',
    // the camera along the flight (f), where it's headed (ft), and the drag's pan (smoothed + target)
    f: 0, ft: 0, im: false, returning: false, wantIn: false, saved: 0,
    pan: { x: 0, y: 0, tx: 0, ty: 0 },
  };
  // for tools/shots-fly.mjs
  window.__fly = {
    get mode() { return mode; },
    get running() { return !!st.world?.running; },
    get progress() { return +st.p.toFixed(4); },
    get target() { return +st.target.toFixed(4); },
    get landed() { return st.landed; },
    get ready() { return !!st.world; },
    get immersed() { return st.im; },
    get flight() { return +st.f.toFixed(4); },
    get stops() { return st.world?.stops || []; },
    get pose() { return st.world?.pose; },
    perf: () => st.world?.perf() ?? 0,
    get end() { return +flightEnd().toFixed(4); },
    enter: () => enter({ keys: true }),
    leave: () => leave(),
    // immersed: put the camera at f along the flight, right away
    go(f) { st.ft = st.f = clamp(+f || 0, 0, flightEnd()); },
    // jump the smoothing to wherever it's headed (for screenshots)
    snap() {
      st.target = st.p = progressNow();
      st.f = st.ft = st.im ? st.ft : driftAt(st.p);
      st.pan.x = st.pan.tx; st.pan.y = st.pan.ty;
      st.returning = false;
      shown.land = -1; shown.head = -1;
    },
  };

  // in the fly-through the call to action isn't there until you arrive
  if (mode === 'fly') cta.inert = true;

  /* ── where the track is, measured off the hot path ── */
  let top = 0, span = 1;
  function measure() {
    if (st.im) return; // the stage is pinned over the page; the track is where it was
    const r = track.getBoundingClientRect();
    top = r.top + scrollY;
    span = Math.max(1, track.offsetHeight - stage.offsetHeight);
  }
  const progressNow = () => (mode === 'fly' ? clamp((scrollY - top) / span) : 0);

  // the flight, in [0, 1]: scrolling only drifts towards the ring, with the name far off; immersed you can go as far
  // as the last board (after it the flight dives into open sky, which is the scroll's ending)
  const meAt = () => st.world?.stops.find((s) => s.id === 'me')?.at ?? 0.12;
  const driftAt = (p) => meAt() * (DRIFT[0] + (DRIFT[1] - DRIFT[0]) * clamp(p / FADE[1]));
  const flightEnd = () => st.world?.diveAt ?? 1;

  /* ── what's on screen ── */
  new IntersectionObserver(([e]) => { st.near = e.isIntersecting; if (st.near) init(); }, { rootMargin: '150% 0px 150% 0px' }).observe(sec);
  new IntersectionObserver(([e]) => { st.inView = e.isIntersecting; wake(); }).observe(sec);
  if (hero) new IntersectionObserver(([e]) => { st.heroIn = e.isIntersecting; wake(); }).observe(hero);
  document.addEventListener('visibilitychange', wake);
  const ro = new ResizeObserver(() => { measure(); wake(); });
  ro.observe(track);
  ro.observe(document.body); // the canvas above can change height under us
  addEventListener('resize', () => { measure(); wake(); stillSoon(); if (st.im) buildTicks(); });
  addEventListener('scroll', wake, { passive: true });
  document.fonts?.ready.then(measure);
  measure();
  st.target = st.p = progressNow();

  const mayDraw = () => st.im || (st.inView && !st.heroIn && !document.hidden);

  /* ── the 3d, loaded when the section gets near ── */
  async function init() {
    if (st.world || st.loading || mode === 'flat') return;
    st.loading = true;
    try {
      const { createWorld } = await import('./map-world.js');
      const world = await createWorld({ stage: mount, reduce, touch, mode: 'scroll', dark: darkQ.matches });
      st.world = world;
      // the boards' paper follows the colour scheme (css does the rest)
      darkQ.addEventListener?.('change', (e) => { world.setDark(e.matches); if (mode === 'still') drawStill(); });
      if (mode === 'still') {
        // one pose: on the way in to the name, with the ring around it
        world.setProgress(meAt() * STILL);
        drawStill();
      } else {
        st.f = st.ft = driftAt(st.p);
        world.setProgress(st.f);
        sec.classList.add('can-enter');
        if (st.wantIn) enter({ keys: st.wantIn === 'keys' });
        wake();
      }
    } catch (err) {
      console.warn('fly: staying with the css version', err);
      mount.replaceChildren();
      setMode('flat');
      st.landed = true;
      cta.inert = false;
      clearStyles();
      measure();
    } finally {
      st.loading = false;
    }
  }

  // reduced motion: a still, drawn when it can be seen (and again after a resize)
  let stillTimer = 0;
  function drawStill() {
    if (mode !== 'still' || !st.world) return;
    if (!mayDraw()) return; // drawn when it next comes on screen
    if (!st.drawn || st.world.stale) {
      st.world.renderOnce();
      st.drawn = true;
      worldEl.classList.add('on');
    }
  }
  function stillSoon() {
    if (mode !== 'still') return;
    clearTimeout(stillTimer);
    stillTimer = setTimeout(drawStill, 160); // after the stage's resize observer has run
  }

  /* ── stepping into the map, and back out ── */
  // everything else on the page sits still and out of the tab order while you're in
  const others = () => [...document.body.children].filter((el) => el !== sec && !el.contains(sec) && el.tagName !== 'DIALOG' && el.tagName !== 'SCRIPT');
  function enter({ keys = false } = {}) {
    if (st.im || mode !== 'fly') return;
    if (!st.world) { st.wantIn = keys ? 'keys' : true; init(); return; } // in as soon as it's built
    st.wantIn = false;
    st.im = true;
    st.returning = false;
    st.saved = scrollY;
    // off the drift and on to the first board
    const first = st.world.stops[0];
    st.ft = Math.max(st.f, first ? first.at : 0);
    st.pan.tx = st.pan.ty = 0;
    root.classList.add('fly-locked');
    sec.classList.add('is-im');
    ui.hidden = false;
    for (const el of others()) el.inert = true;
    head.inert = true;
    cta.inert = true;
    worldEl.classList.add('on');
    buildTicks();
    shown.now = ''; shown.range = -1; shown.head = -1; shown.land = -1; shown.wash = -1; shown.et = shown.eb = -1;
    // from the keyboard, focus goes with you (from a click the ring would just be noise)
    if (keys) backBtn.focus({ preventScroll: true });
    else document.activeElement?.blur?.();
    wake();
  }
  function leave() {
    if (!st.im) return;
    st.im = false;
    st.returning = true; // the camera glides back to the scroll's pose
    st.pan.tx = st.pan.ty = 0;
    endDrag();
    root.classList.remove('fly-locked');
    sec.classList.remove('is-im');
    ui.hidden = true;
    for (const el of others()) el.inert = false;
    head.inert = false;
    cta.inert = !st.landed;
    scrollTo({ top: st.saved, behavior: 'instant' });
    measure();
    shown.head = -1; shown.land = -1; shown.wash = -1; shown.et = shown.eb = -1; shown.now = '';
    nowEl.classList.remove('on');
    enterBtn.focus({ preventScroll: true });
    wake();
  }
  // e.detail is 0 for a click from the keyboard
  enterBtn.addEventListener('click', (e) => { e.stopPropagation(); enter({ keys: e.detail === 0 }); });
  backBtn.addEventListener('click', leave);
  // a click anywhere on the map steps in, while the map is what's showing
  stage.addEventListener('click', (e) => {
    if (st.im || mode !== 'fly' || !sec.classList.contains('can-enter')) return;
    if (e.target.closest('a, button, input, .fly-land')) return;
    enter();
  });
  // the page's "fly through the map" links (hero pill, nav, canvas, corner guide) step right in.
  // capture, so js/main.js's in-page glide doesn't take them first
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href="#fly"]');
    if (!a || mode !== 'fly' || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    e.stopPropagation();
    measure();
    const keys = e.detail === 0;
    const go = () => { measure(); enter({ keys }); };
    if (Math.abs(scrollY - top) < 4) { go(); return; }
    let done = false;
    const once = () => { if (!done) { done = true; removeEventListener('scrollend', once); go(); } };
    addEventListener('scrollend', once);
    setTimeout(once, 1200); // no scrollend (older safari), or it never moved
    scrollTo({ top, behavior: 'smooth' });
    init();
  }, true);

  /* ── immersed: the scrubber, its board ticks, wheel, drag and keys ── */
  function buildTicks() {
    if (!st.world) return;
    const end = flightEnd();
    ticks.replaceChildren(...st.world.stops.map((s) => {
      // marks only: the slider under them takes the clicks, the step buttons the keyboard
      const b = document.createElement('i');
      b.className = 'fly-tick';
      b.style.setProperty('--x', `${((s.at / end) * 100).toFixed(2)}%`);
      return b;
    }));
  }
  range.addEventListener('input', () => { st.ft = (range.value / 1000) * flightEnd(); });
  let rangeDown = false;
  range.addEventListener('pointerdown', () => { rangeDown = true; });
  addEventListener('pointerup', () => { rangeDown = false; });

  function step(dir) {
    const stops = st.world?.stops || [];
    if (dir > 0) {
      const s = stops.find((s) => s.at > st.ft + 0.002);
      st.ft = s ? s.at : flightEnd();
    } else {
      const s = [...stops].reverse().find((s) => s.at < st.ft - 0.002);
      st.ft = s ? s.at : 0;
    }
  }
  for (const b of sec.querySelectorAll('[data-fly-step]')) b.addEventListener('click', () => step(+b.dataset.flyStep));

  stage.addEventListener('wheel', (e) => {
    if (!st.im) return;
    e.preventDefault();
    const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
    let dy = e.deltaY * k, dx = e.deltaX * k;
    if (e.shiftKey && !dx) { dx = dy; dy = 0; }
    if (dy) st.ft = clamp(st.ft + dy * WHEEL, 0, flightEnd());
    if (dx) panBy(-dx, 0);
  }, { passive: false });

  const panBy = (dx, dy) => {
    st.pan.tx = clamp(st.pan.tx + dx, -innerWidth * 0.9, innerWidth * 0.9);
    st.pan.ty = clamp(st.pan.ty + dy, -innerHeight * 0.8, innerHeight * 0.8);
  };
  let drag = null;
  function endDrag() {
    if (!drag) return;
    try { stage.releasePointerCapture(drag.id); } catch {}
    drag = null;
    sec.classList.remove('is-dragging');
  }
  stage.addEventListener('pointerdown', (e) => {
    if (!st.im || drag || e.target.closest('.fly-ui button, .fly-ui input')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    stage.setPointerCapture(e.pointerId);
    sec.classList.add('is-dragging');
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    panBy(e.clientX - drag.x, e.clientY - drag.y);
    drag.x = e.clientX; drag.y = e.clientY;
  });
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  document.addEventListener('keydown', (e) => {
    if (!st.im || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') { e.preventDefault(); leave(); return; }
    if (e.target === range && e.key.startsWith('Arrow')) return; // the slider's own keys
    if (e.target.closest?.('button') && (e.key === ' ' || e.key === 'Enter')) return;
    const k = e.key;
    if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || k === ' ') { e.preventDefault(); step(1); }
    else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp') { e.preventDefault(); step(-1); }
    else if (k === 'Home') { e.preventDefault(); st.ft = 0; }
    else if (k === 'End') { e.preventDefault(); st.ft = flightEnd(); }
  });

  /* ── per frame, while the section is on screen ── */
  let raf = 0, last = 0;
  function wake() {
    if (st.heroIn && !st.im) st.world?.stop(); // right away, in the same task the gradient starts in
    if (mode === 'still') { drawStill(); return; }
    if (mode !== 'fly') return;
    if ((st.inView || st.im) && !document.hidden) { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }
    else stopAll();
  }
  function stopAll() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    st.world?.stop();
  }

  let shown = { head: -1, land: -1, wash: -1, now: '', et: -1, eb: -1, range: -1, enter: null };
  function frame(ms) {
    raf = 0;
    if (!(st.inView || st.im) || document.hidden || mode !== 'fly') { stopAll(); return; }
    raf = requestAnimationFrame(frame);
    const dt = last ? clamp((ms - last) / 1000, 0, 0.1) : 1 / 60;
    last = ms;
    if (!st.im) {
      st.target = progressNow();
      st.p = ease(st.p, st.target, SMOOTH, dt);
    }
    const p = st.p;
    const w = st.world;

    // the camera: the scroll's drift, or wherever the wheel / scrubber is taking it
    const f0 = st.f;
    if (st.im) st.f = ease(st.f, st.ft, GLIDE, dt);
    else {
      st.ft = driftAt(p);
      if (st.returning) {
        st.f = ease(st.f, st.ft, BACK, dt);
        if (Math.abs(st.f - st.ft) < 1e-3) st.returning = false;
      } else st.f = st.ft;
    }
    // flying on lets go of the pan, so you don't get lost
    if (st.im && !drag && Math.abs(st.f - f0) > 1e-5) {
      const k = Math.exp(-Math.abs(st.f - f0) * 30);
      st.pan.tx *= k; st.pan.ty *= k;
    }
    st.pan.x = ease(st.pan.x, st.pan.tx, PAN, dt);
    st.pan.y = ease(st.pan.y, st.pan.ty, PAN, dt);

    // the 3d, and whether it draws at all: never with the hero's gradient, never once it's faded out
    const fade = st.im ? 0 : sstep(FADE[0], FADE[1], p);
    if (w) {
      w.setProgress(st.f);
      w.setPan(st.pan.x, st.pan.y);
      const draw = st.im || (!st.heroIn && fade < 0.999);
      if (draw && !w.running) { w.start(); worldEl.classList.add('on'); }
      else if (!draw && w.running) w.stop();
      const wo = Math.round((1 - fade) * 1000) / 1000;
      if (wo !== shown.wash) { worldEl.style.opacity = String(wo); stage.style.setProperty('--wash', String(1 - wo)); shown.wash = wo; }
    } else {
      const wash = Math.round(fade * 1000) / 1000;
      if (wash !== shown.wash) { stage.style.setProperty('--wash', String(wash)); shown.wash = wash; }
    }
    // stepping in only makes sense while the map is what you're looking at
    const canEnter = !!w && !st.im && fade < 0.5;
    if (canEnter !== shown.enter) { sec.classList.toggle('can-enter', canEnter); shown.enter = canEnter; }

    // the stage's edges melt into the page while they're on screen
    const et = st.im ? 0 : Math.round((1 - sstep(0, 0.06, p)) * 100) / 100, eb = st.im ? 0 : Math.round(sstep(0.96, 1, p) * 100) / 100;
    if (et !== shown.et) { stage.style.setProperty('--edge-top', String(et)); shown.et = et; }
    if (eb !== shown.eb) { stage.style.setProperty('--edge-bot', String(eb)); shown.eb = eb; }

    // the title steps aside
    const h = st.im ? 0 : Math.round((1 - sstep(HEAD[0], HEAD[1], p)) * 100) / 100;
    if (h !== shown.head) {
      head.style.opacity = String(h);
      head.style.transform = h < 1 ? `translate3d(0, ${((1 - h) * -28).toFixed(1)}px, 0)` : '';
      head.style.visibility = h <= 0 ? 'hidden' : '';
      if (!st.im) head.inert = h <= 0.2;
      shown.head = h;
    }

    // immersed: which board we're at, and the scrubber
    if (st.im && w) {
      const stops = w.stops;
      let i = 0, best = Infinity;
      for (let k = 0; k < stops.length; k++) { const d = Math.abs(st.f - stops[k].at); if (d < best) { best = d; i = k; } }
      const txt = stops.length ? `${i + 1}|${stops[i].title}` : '';
      if (txt !== shown.now) {
        nowEl.classList.toggle('on', !!txt);
        if (txt) { nowEl.querySelector('.fly-n').textContent = `${i + 1} / ${stops.length}`; nowEl.querySelector('.fly-t').textContent = stops[i].title; }
        for (const [k, b] of [...ticks.children].entries()) b.classList.toggle('on', k === i);
        shown.now = txt;
      }
      if (!rangeDown) {
        const v = Math.round((st.ft / flightEnd()) * 1000);
        if (v !== shown.range) { range.value = String(v); shown.range = v; }
      }
      ui.style.setProperty('--at', `${((st.f / flightEnd()) * 100).toFixed(2)}%`);
    }

    // the call to action flies in out of the depth, then holds still and takes clicks
    const a = st.im ? 0 : Math.round(sstep(LAND[0], LAND[1], p) * 1000) / 1000;
    if (a !== shown.land) {
      shown.land = a;
      if (a >= 1) {
        land.style.transform = 'none'; land.style.opacity = '1'; land.style.visibility = 'visible';
      } else {
        const e = 1 - Math.pow(1 - a, 2);
        const s = 0.42 + 0.58 * e;
        // scale and fade only: a blur filter over the whole landing re-rasterised it every frame
        land.style.transform = `translate3d(0, ${((1 - e) * 60).toFixed(1)}px, 0) scale(${s.toFixed(4)})`;
        land.style.opacity = String(clamp(a * 1.6));
        land.style.visibility = a <= 0 ? 'hidden' : 'visible';
      }
      const landed = a > 0.9;
      if (landed !== st.landed) { st.landed = landed; if (!st.im) cta.inert = !landed; sec.classList.toggle('is-landed', landed); }
    }
  }
  function clearStyles() {
    for (const el of [land, head, worldEl]) { el.style.transform = ''; el.style.filter = ''; el.style.opacity = ''; el.style.visibility = ''; }
    for (const k of ['--wash', '--edge-top', '--edge-bot']) stage.style.removeProperty(k);
  }

  wake();
}
