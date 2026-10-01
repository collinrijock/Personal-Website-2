// fly.js — the #fly section: the brainstorm map as a fly-through you scroll, ending in "say hi."
//
// the section is a tall track with a sticky, full-viewport stage. how far you've scrolled through
// the track is the progress, smoothed every frame, and it drives three things:
//   - the camera (js/map-world.js in scroll mode), along one flight: far out, in to the name,
//     round the ring past the boards, then a dive forward
//   - the 3d fading into a soft palette wash as the camera dives
//   - the call to action flying in out of the depth, then staying put and clickable
//
// it only loads three.js when the section gets near, only draws while the section is on screen,
// the tab is visible and the hero's gradient is off screen (the two never run together).
// reduced motion gets one still pose; no webgl2 (or a failed import) gets css colour; no
// javascript gets the call to action as a plain section.

const sec = document.querySelector('[data-fly]');

// section progress -> what happens. the flight takes FLIGHT of the scroll, the rest is the landing
const FLIGHT = 0.9;
const FADE = [0.82, 0.92]; // the 3d gives way to the wash
const LAND = [0.81, 0.95]; // the call to action comes in
const HEAD = [0.015, 0.075]; // the section's title steps aside as you set off
const SMOOTH = 6;
const STILL = 0.5; // reduced motion's one pose, as a share of the way in to the name // per second: how quickly the camera catches up with the scroll

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

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
  const hero = document.querySelector('[data-hero]');
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

  const st = { world: null, loading: false, near: false, inView: false, heroIn: !!hero, target: 0, p: 0, landed: mode !== 'fly' };
  // for tools/shots-fly.mjs
  window.__fly = {
    get mode() { return mode; },
    get running() { return !!st.world?.running; },
    get progress() { return +st.p.toFixed(4); },
    get target() { return +st.target.toFixed(4); },
    get landed() { return st.landed; },
    get ready() { return !!st.world; },
    get stops() { return st.world?.stops || []; },
    get pose() { return st.world?.pose; },
    perf: () => st.world?.perf() ?? 0,
    // jump the smoothing to wherever the scroll is (for screenshots)
    snap() { st.target = st.p = progressNow(); shown.land = -1; shown.head = -1; },
  };

  // in the fly-through the call to action isn't there until you arrive
  if (mode === 'fly') cta.inert = true;

  /* ── where the track is, measured off the hot path ── */
  let top = 0, span = 1;
  function measure() {
    const r = track.getBoundingClientRect();
    top = r.top + scrollY;
    span = Math.max(1, track.offsetHeight - stage.offsetHeight);
  }
  const progressNow = () => (mode === 'fly' ? clamp((scrollY - top) / span) : 0);

  /* ── what's on screen ── */
  new IntersectionObserver(([e]) => { st.near = e.isIntersecting; if (st.near) init(); }, { rootMargin: '150% 0px 150% 0px' }).observe(sec);
  new IntersectionObserver(([e]) => { st.inView = e.isIntersecting; wake(); }).observe(sec);
  if (hero) new IntersectionObserver(([e]) => { st.heroIn = e.isIntersecting; wake(); }).observe(hero);
  document.addEventListener('visibilitychange', wake);
  const ro = new ResizeObserver(() => { measure(); wake(); });
  ro.observe(track);
  ro.observe(document.body); // the canvas above can change height under us
  addEventListener('resize', () => { measure(); wake(); stillSoon(); });
  addEventListener('scroll', wake, { passive: true });
  document.fonts?.ready.then(measure);
  measure();
  st.target = st.p = progressNow();

  const mayDraw = () => st.inView && !st.heroIn && !document.hidden;

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
        const me = world.stops.find((s) => s.id === 'me');
        world.setProgress((me ? me.at : 0.1) * STILL);
        drawStill();
      } else {
        world.setProgress(st.p / FLIGHT);
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

  /* ── per frame, while the section is on screen ── */
  let raf = 0, last = 0;
  function wake() {
    if (st.heroIn) st.world?.stop(); // right away, in the same task the gradient starts in
    if (mode === 'still') { drawStill(); return; }
    if (mode !== 'fly') return;
    if (st.inView && !document.hidden) { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }
    else stopAll();
  }
  function stopAll() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    st.world?.stop();
  }

  let shown = { head: -1, land: -1, wash: -1, now: '', et: -1, eb: -1 };
  function frame(ms) {
    raf = 0;
    if (!st.inView || document.hidden || mode !== 'fly') { stopAll(); return; }
    raf = requestAnimationFrame(frame);
    const dt = last ? clamp((ms - last) / 1000, 0, 0.1) : 1 / 60;
    last = ms;
    st.target = progressNow();
    const gap = st.target - st.p;
    st.p = Math.abs(gap) < 1e-4 ? st.target : st.p + gap * (1 - Math.exp(-dt * SMOOTH));
    const p = st.p;

    // the camera, and whether it draws at all: never with the hero's gradient, never once it's faded out
    const w = st.world;
    if (w) {
      w.setProgress(p / FLIGHT);
      const fade = sstep(FADE[0], FADE[1], p);
      const draw = !st.heroIn && fade < 0.999;
      if (draw && !w.running) { w.start(); worldEl.classList.add('on'); }
      else if (!draw && w.running) w.stop();
      const wo = Math.round((1 - fade) * 1000) / 1000;
      if (wo !== shown.wash) { worldEl.style.opacity = String(wo); stage.style.setProperty('--wash', String(1 - wo)); shown.wash = wo; }
    } else {
      const wash = Math.round(sstep(FADE[0], FADE[1], p) * 1000) / 1000;
      if (wash !== shown.wash) { stage.style.setProperty('--wash', String(wash)); shown.wash = wash; }
    }

    // the stage's edges melt into the page while they're on screen
    const et = Math.round((1 - sstep(0, 0.035, p)) * 100) / 100, eb = Math.round(sstep(0.975, 1, p) * 100) / 100;
    if (et !== shown.et) { stage.style.setProperty('--edge-top', String(et)); shown.et = et; }
    if (eb !== shown.eb) { stage.style.setProperty('--edge-bot', String(eb)); shown.eb = eb; }

    // the title steps aside
    const h = Math.round((1 - sstep(HEAD[0], HEAD[1], p)) * 100) / 100;
    if (h !== shown.head) {
      head.style.opacity = String(h);
      head.style.transform = h < 1 ? `translate3d(0, ${((1 - h) * -28).toFixed(1)}px, 0)` : '';
      head.style.visibility = h <= 0 ? 'hidden' : '';
      shown.head = h;
    }

    // which board we're at
    if (nowEl && w) {
      const f = p / FLIGHT, stops = w.stops;
      // the nearest board, once the flight has got going and until the landing
      let i = -1, best = Infinity;
      for (let k = 0; k < stops.length; k++) { const d = Math.abs(f - stops[k].at); if (d < best) { best = d; i = k; } }
      const on = i >= 0 && f > stops[0].at - 0.04 && p < LAND[0] - 0.03;
      const txt = on ? `${i + 1}|${stops[i].title}` : '';
      if (txt !== shown.now) {
        nowEl.classList.toggle('on', on);
        if (on) { nowEl.querySelector('.fly-n').textContent = `${i + 1} / ${stops.length}`; nowEl.querySelector('.fly-t').textContent = stops[i].title; }
        shown.now = txt;
      }
    }

    // the call to action flies in out of the depth, then holds still and takes clicks
    const a = Math.round(sstep(LAND[0], LAND[1], p) * 1000) / 1000;
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
      if (landed !== st.landed) { st.landed = landed; cta.inert = !landed; sec.classList.toggle('is-landed', landed); }
    }
  }
  function clearStyles() {
    for (const el of [land, head, worldEl]) { el.style.transform = ''; el.style.filter = ''; el.style.opacity = ''; el.style.visibility = ''; }
    for (const k of ['--wash', '--edge-top', '--edge-bot']) stage.style.removeProperty(k);
  }

  wake();
}
