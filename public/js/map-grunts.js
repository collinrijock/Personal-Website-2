// map-grunts.js — the grunts who live in the map.
// five drift between clusters, one works with a hammer, one follows you around like a guide.
// each is a css3d element whose svg is redrawn about 22 times a second, and only while it's in view.
import { rollLook, rollName, createMascotEngine, renderFrameToSvg } from './vendor/grunt-mascot.js';
import { esc } from './map-plain.js';
import { rng } from './map-layout.js';

const CAST = [
  { seed: 'map:12', role: 'guide' },
  { seed: 'map:3', role: 'worker', home: 'things', tool: 'hammer' },
  { seed: 'map:5', home: 'vision' },
  { seed: 'map:7', home: 'charles' },
  { seed: 'map:20', home: 'games' },
  { seed: 'map:2', home: 'stack' },
  { seed: 'map:6', home: 'writing' },
];
const LINGER = ['idle', 'happy', 'curious', 'playful', 'thinking', 'searching', 'laughing', 'proud', 'wink', 'idle', 'happy'];
const TRAVEL = ['idle', 'happy', 'playful', 'bouncing', 'comet'];
const FPS = 22;
const SIZE = 96;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * spots: the cluster boards, { id, c: centre, right, up, n, hw, hh } (THREE.Vector3s).
 * returns { update(dt, t, view), setGuideMood(state) }.
 */
export function createGrunts({ THREE, CSS3DObject, scene, camera, spots, reduce, touch }) {
  const V = THREE.Vector3;
  const rand = rng('map:grunts');
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const byId = Object.fromEntries(spots.map((s) => [s.id, s]));
  const roam = spots.filter((s) => s.id !== 'me');
  const tmp = new V(), tmp2 = new V();
  const grunts = [];

  // a place to hover near a board: along its top edge or off to one side, in front of the cards
  function perch(spot, r = rand) {
    const p = spot.c.clone().addScaledVector(spot.n, 120 + r() * 160);
    if (r() < 0.55) {
      p.addScaledVector(spot.right, (r() - 0.5) * spot.hw * 1.4).addScaledVector(spot.up, spot.hh + 60 + r() * 50);
    } else {
      const side = r() < 0.5 ? -1 : 1;
      p.addScaledVector(spot.right, side * (spot.hw + 50 + r() * 60)).addScaledVector(spot.up, (r() - 0.4) * spot.hh);
    }
    return p;
  }

  for (const def of CAST) {
    const look = rollLook(def.seed);
    const name = rollName(def.seed).toLowerCase();
    const id = `g${grunts.length}`;
    const el = document.createElement('div');
    el.className = 'grunt';
    el.dataset.role = def.role || 'wander';
    el.innerHTML = `<div class="gs"></div><span class="gn">${esc(name)}</span>`;
    const obj = new CSS3DObject(el);
    scene.add(obj);
    const home = byId[def.home] || roam[grunts.length % roam.length];
    const g = {
      id, def, el, gs: el.firstChild, obj,
      role: def.role || 'wander',
      look, drawLook: { ...look, tool: def.tool || null },
      eng: createMascotEngine(look, { initialState: def.role === 'worker' ? 'working' : 'idle' }),
      spot: home,
      pos: def.role === 'guide' ? new V() : perch(home),
      vel: new V(),
      path: null,
      lingerUntil: 0,
      moodUntil: 0,
      override: null, // { state, until }
      hover: false,
      nextDraw: rand() / FPS,
      nextGaze: 0,
      shown: true,
      stillDirty: true,
      phase: rand() * Math.PI * 2,
    };
    if (g.role === 'guide') g.primed = false;
    obj.position.copy(g.pos);
    if (g.role !== 'guide') obj.scale.setScalar(1.4);
    el.addEventListener('pointerenter', () => { g.hover = true; setMood(g, 'excited'); });
    el.addEventListener('pointerleave', () => { g.hover = false; g.moodUntil = 0; });
    el.addEventListener('click', () => {
      g.override = { state: 'celebrate', until: now + 2.6 };
      setMood(g, 'celebrate');
    });
    grunts.push(g);
  }

  let now = 0;
  function setMood(g, state) {
    if (reduce) { g.eng.reset(state, 0); g.stillDirty = true; return; }
    g.eng.setState(state, now);
  }
  function restingMood(g) {
    if (g.role === 'worker') return 'working';
    if (g.role === 'guide') return g.guideMood || 'idle';
    return null;
  }

  function planTrip(g) {
    const choices = g.role === 'worker'
      ? ['things', 'stack', 'games'].map((k) => byId[k]).filter(Boolean)
      : roam;
    let next = pick(choices);
    if (next === g.spot && choices.length > 1) next = pick(choices.filter((s) => s !== g.spot));
    const p0 = g.pos.clone(), p3 = perch(next);
    const dist = p0.distanceTo(p3);
    const dur = clamp(dist / 300, 4.5, 13);
    const bend = tmp.set(rand() - 0.5, (rand() - 0.3) * 0.6, rand() - 0.5).normalize().multiplyScalar(dist * 0.35);
    g.path = {
      p0, p3,
      p1: p0.clone().addScaledVector(g.vel, dur / 3).add(bend),
      p2: p3.clone().addScaledVector(next.n, dist * 0.2).sub(bend),
      t0: now, dur,
    };
    g.spot = next;
    if (g.role !== 'worker') setMood(g, rand() < 0.25 ? 'comet' : pick(TRAVEL));
  }

  function bez(p, u, out) {
    const a = 1 - u;
    return out.set(0, 0, 0)
      .addScaledVector(p.p0, a * a * a).addScaledVector(p.p1, 3 * a * a * u)
      .addScaledVector(p.p2, 3 * a * u * u).addScaledVector(p.p3, u * u * u);
  }

  const view = new V();
  function draw(g, t) {
    const frame = reduce ? g.eng.sample(g.eng.restPoseTime()) : g.eng.sample(t);
    g.gs.innerHTML = renderFrameToSvg(frame, g.drawLook, SIZE, { idPrefix: `map-${g.id}` });
  }

  // reduced motion: everyone sits still at home, drawn once
  if (reduce) {
    for (const g of grunts) {
      g.eng.reset(g.role === 'worker' ? 'working' : g.role === 'guide' ? 'happy' : pick(['idle', 'happy', 'curious', 'proud']), 0);
      draw(g, 0);
      g.stillDirty = false;
    }
  }

  function guideTarget(out, vw, vh) {
    const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const D = 380;
    const hh = D * tv, hw = hh * camera.aspect;
    const narrow = vw < 700;
    out.set(hw * (narrow ? 0.76 : 0.85), -hh * (narrow ? 0.78 : 0.7), -D);
    return camera.localToWorld(out);
  }

  function update(dt, t, { vw, vh, pointer }) {
    now = t;
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const tanH = tanV * camera.aspect;
    for (const g of grunts) {
      // where it is
      if (g.role === 'guide') {
        guideTarget(tmp2, vw, vh);
        if (reduce || !g.primed) g.pos.copy(tmp2);
        else {
          // loosely: it trails you when you move, but never so far it leaves the corner
          g.pos.lerp(tmp2, 1 - Math.exp(-dt * 3.2));
          const lag = tmp.copy(g.pos).sub(tmp2);
          if (lag.length() > 140) g.pos.copy(tmp2).add(lag.setLength(140));
        }
        g.primed = true;
        const pxPerUnit = (vh / 2) / (380 * tanV);
        g.obj.scale.setScalar(((vw < 700 ? 62 : 78) / SIZE) / pxPerUnit);
        g.obj.position.copy(g.pos);
        if (!reduce) g.obj.position.y += Math.sin(t * 1.9 + g.phase) * 3;
      } else if (!reduce) {
        if (g.path) {
          const u = clamp((t - g.path.t0) / g.path.dur, 0, 1);
          const e = u * u * (3 - 2 * u);
          const prev = tmp.copy(g.pos);
          bez(g.path, e, g.pos);
          g.vel.copy(g.pos).sub(prev).divideScalar(Math.max(dt, 1e-3));
          if (u >= 1) {
            g.path = null;
            g.vel.multiplyScalar(0.2);
            g.lingerUntil = t + (g.role === 'worker' ? 16 + rand() * 14 : 5 + rand() * 6);
            g.moodUntil = 0;
          }
        } else if (t > g.lingerUntil && !g.hover) {
          planTrip(g);
        } else {
          g.vel.multiplyScalar(Math.exp(-dt * 2));
        }
        g.obj.position.copy(g.pos);
        g.obj.position.y += Math.sin(t * 1.6 + g.phase) * (g.path ? 8 : 16);
        g.obj.position.x += Math.cos(t * 0.7 + g.phase) * (g.path ? 0 : 10);
      }
      g.obj.quaternion.copy(camera.quaternion);

      // can we see it
      view.copy(g.obj.position).applyMatrix4(camera.matrixWorldInverse);
      const depth = -view.z;
      if (g.role !== 'guide' && depth > 1) {
        // never loom: however close you fly, a grunt stays grunt-sized on screen
        const pxPerUnit = (vh / 2) / (depth * tanV);
        const sc = Math.min(1.4, 104 / (SIZE * pxPerUnit));
        if (Math.abs(sc - g.obj.scale.x) > 0.002) g.obj.scale.setScalar(sc);
      }
      const r = (SIZE * g.obj.scale.x) / 2 / Math.max(depth, 1);
      const shown = depth > 30 && depth < 7000
        && Math.abs(view.x / depth) - r < tanH * 1.05 && Math.abs(view.y / depth) - r < tanV * 1.05;
      if (shown !== g.shown) { g.obj.visible = shown; g.shown = shown; }
      if (!shown) continue;
      if (g.role !== 'guide') {
        const o = Math.round((1 - 0.85 * clamp((depth - 2600) / 4000, 0, 1)) * 50) / 50;
        if (o !== g.op) { g.el.style.opacity = String(o); g.op = o; }
      }

      if (reduce) {
        if (g.override && t > g.override.until) { g.override = null; g.eng.reset(g.hover ? 'excited' : restingMood(g) || 'idle', 0); g.stillDirty = true; }
        else if (!g.override && !g.hover && g.eng.state === 'excited') { g.eng.reset(restingMood(g) || 'idle', 0); g.stillDirty = true; }
        if (g.stillDirty) { draw(g, 0); g.stillDirty = false; }
        continue;
      }

      // how it feels
      if (g.override && t > g.override.until) { g.override = null; g.moodUntil = 0; }
      if (!g.override && !g.hover && t > g.moodUntil) {
        const rest = restingMood(g);
        if (rest) setMood(g, rest);
        else if (!g.path) setMood(g, pick(LINGER));
        g.moodUntil = t + 3 + rand() * 4;
      }

      // where it looks: at the pointer when there is one, otherwise back at you
      if (t > g.nextGaze) {
        g.nextGaze = t + 0.12;
        const sx = view.x / depth / tanH, sy = view.y / depth / tanV;
        let yaw, pitch;
        if (pointer.active) { yaw = (pointer.x - sx) * 55; pitch = (pointer.y - sy) * 40; }
        else if (g.role === 'guide') { yaw = -22; pitch = 10; }
        else { yaw = -sx * 30; pitch = -sy * 22; }
        g.eng.setGaze({ yaw: clamp(yaw, -40, 40), pitch: clamp(pitch, -28, 28), mix: 1, spin: 0, wander: 0.3 }, t);
      }

      if (t >= g.nextDraw) {
        g.nextDraw = t + 1 / FPS;
        draw(g, t);
      }
    }
  }

  function setGuideMood(state) {
    const g = grunts[0];
    g.guideMood = state;
    if (!g.hover && !g.override) { setMood(g, state); g.moodUntil = now + 4; }
  }

  return { update, setGuideMood, grunts };
}
