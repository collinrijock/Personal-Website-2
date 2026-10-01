// map-world.js — the brainstorm, in 3d.
// webgl draws the air: palette blobs, a field of specks, the arrows (with pulses) and the frames.
// in free mode css3d draws everything you read: cards, frame titles, arrow labels, grunts, so the
// links on the cards are real links. in scroll mode (the front page's fly-through) the cards,
// titles and labels are painted once into a texture atlas (js/map-paint.js) and drawn as textured
// billboards in webgl, and only the three grunts are css3d: the page scrolls over the picture, so
// nothing needs to be clickable, and a hundred-odd 3d dom layers was what made the flight heavy.
// one camera drives both renderers.
//
// two modes:
//   free    map.html. the page is the world: window-sized, wheel / drag / pinch / keys fly it,
//           there's an intro, a tour and a guide grunt, and it draws whenever the tab is visible.
//   scroll  the front page's #fly section (js/fly.js). sized by the stage element, no input at all
//           (the page scrolls over it), no intro / tour / guide, and it only draws between start()
//           and stop(). setProgress(p) puts the camera at p in [0, 1] along a precomputed flight:
//           far out, in to the name, around the ring past the boards in ROUTE, then a dive
//           forward at the end. the caller smooths p; the camera follows it exactly.
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { CLUSTERS, NODES, EDGES } from './content.js';
import { buildCard } from './map-cards.js';
import { relax, thread, rng } from './map-layout.js';
import { createGrunts } from './map-grunts.js';
import { paintAtlas } from './map-paint.js';

const V3 = THREE.Vector3;
const DEG = Math.PI / 180;
const FOV = 50;
const UP = new V3(0, 1, 0);
// the fly-through's lap: every board it stops at, in order (the ones between it passes)
export const ROUTE = ['me', 'vision', 'xmade', 'things', 'ideas', 'writing', 'links'];
export const TOUR = ['me', 'vision', 'exowatt', 'xmade', 'charles', 'work', 'things', 'games', 'ideas', 'writing', 'before', 'stack', 'links']
  .filter((id) => CLUSTERS.some((c) => c.id === id));

const PAD = 34, BAR = 54; // frame padding and title bar, in card pixels
const START = { pos: new V3(2400, 2300, 15500), look: new V3(0, 0, 0) }; // far out, where the intro begins
const START_SCROLL = { pos: new V3(2300, 2000, 9800), look: new V3(0, 0, 0) }; // the fly-through starts nearer: the ring is already in view
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

// textured billboards (scroll mode): a quad per card, facing the camera, alpha per quad
const SPRITE_VS = /* glsl */ `
attribute vec2 corner;
attribute vec2 auv;
attribute float alpha;
varying vec2 vUv;
varying float vA;
void main() {
  vUv = auv; vA = alpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  mv.xy += corner;
  gl_Position = projectionMatrix * mv;
}`;
const SPRITE_FS = /* glsl */ `
uniform sampler2D map;
varying vec2 vUv;
varying float vA;
void main() {
  vec4 c = texture2D(map, vUv);
  if (c.a < 0.5 || vA < 0.01) discard;
  gl_FragColor = vec4(c.rgb, c.a * vA);
}`;
const FAR = [1900, 7600]; // distance fade: starts, ends
const PASTEL = { yellow: '#fff1a8', pink: '#ffd6e4', blue: '#d3e7ff', green: '#d4f5d9', purple: '#e6dcff', gray: '#e9e9ec', white: '#ffffff' };
// the arrows walk the palette from blue through violet, pink and orange to a deep yellow
const RAMP = ['#18a0ff', '#6a2bff', '#ff2d87', '#ff7a1a', '#eea200'];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const ramp = (u) => {
  const x = clamp(u, 0, 1) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(x));
  return mix(rgb(RAMP[i]), rgb(RAMP[i + 1]), x - i);
};
const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const easeOut = (u) => 1 - Math.pow(1 - u, 3);
const quad = (a, c, b, t, out = new V3()) => {
  const s = 1 - t;
  return out.set(0, 0, 0).addScaledVector(a, s * s).addScaledVector(c, 2 * s * t).addScaledVector(b, t * t);
};

/* ── shaders ───────────────────────────────────────────────────────── */

// screen-space ribbons: every segment is a quad pushed out to a few pixels either side.
// the fragment draws a thin anti-aliased core, and a pulse that travels from → to.
const LINE_VS = /* glsl */ `
uniform vec2 uRes;
uniform float uHalf;
uniform float uNear;
uniform vec2 uFade;
attribute vec3 other;
attribute float side;
attribute float endp;
attribute vec3 acolor;
attribute float tt;
attribute vec4 edge;
attribute float core;
varying vec3 vColor;
varying float vSide;
varying float vT;
varying vec4 vEdge;
varying float vFade;
varying float vCore;
void main() {
  vColor = acolor; vSide = side; vT = tt; vEdge = edge; vCore = core;
  vec4 a = modelViewMatrix * vec4(position, 1.0);
  vec4 b = modelViewMatrix * vec4(other, 1.0);
  // recede with distance, and don't streak across the lens when one passes close
  vFade = (1.0 - 0.92 * smoothstep(uFade.x, uFade.y, length(a.xyz))) * smoothstep(120.0, 1000.0, -a.z);
  float nz = -uNear * 2.0;
  if (a.z > nz && b.z > nz) { gl_Position = vec4(0.0, 0.0, -2.0, 1.0); return; }
  if (a.z > nz) a = mix(a, b, (a.z - nz) / (a.z - b.z));
  if (b.z > nz) b = mix(b, a, (b.z - nz) / (b.z - a.z));
  vec4 ca = projectionMatrix * a;
  vec4 cb = projectionMatrix * b;
  vec2 sa = ca.xy / ca.w * uRes * 0.5;
  vec2 sb = cb.xy / cb.w * uRes * 0.5;
  vec2 d = endp < 0.5 ? sb - sa : sa - sb;
  float L = length(d);
  d = L > 0.0001 ? d / L : vec2(1.0, 0.0);
  ca.xy += vec2(-d.y, d.x) * side * uHalf / (uRes * 0.5) * ca.w;
  gl_Position = ca;
}`;
const LINE_FS = /* glsl */ `
uniform float uTime;
uniform float uPulse;
uniform float uHalf;
uniform float uDpr;
uniform float uSpeed;
varying vec3 vColor;
varying float vSide;
varying float vT;
varying vec4 vEdge;
varying float vFade;
varying float vCore;
void main() {
  float px = abs(vSide) * uHalf;
  float core = vCore * uDpr;
  float alpha = (1.0 - smoothstep(core - 0.5 * uDpr, core + 0.7 * uDpr, px)) * vEdge.w;
  vec3 col = vColor;
  if (uPulse > 0.5) {
    float len = vEdge.x;
    float period = vEdge.z;
    float head = fract(uTime / period + vEdge.y) * period * uSpeed;
    float d = head - vT * len;
    float tail = min(180.0, len * 0.4);
    float p = d < 0.0 ? 1.0 - smoothstep(0.0, 10.0, -d) : pow(max(0.0, 1.0 - d / tail), 2.2);
    float sigma = mix(core * 0.8, uHalf * 0.46, p * p);
    float glow = exp(-(px * px) / (2.0 * sigma * sigma + 0.0001));
    alpha = max(alpha, p * glow);
    col = mix(col, col * 0.78, p);
  }
  alpha *= vFade;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(col, alpha);
}`;

const DOT_VS = /* glsl */ `
uniform float uScale;
uniform float uTime;
attribute float size;
attribute vec3 acolor;
attribute float seed;
varying vec3 vC;
varying float vA;
void main() {
  vec3 p = position + vec3(sin(uTime * 0.11 + seed * 6.283), cos(uTime * 0.09 + seed * 4.1), sin(uTime * 0.07 + seed * 2.3)) * 28.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float d = -mv.z;
  float s = size * uScale / max(d, 1.0);
  vA = smoothstep(40.0, 260.0, d) * (1.0 - 0.9 * smoothstep(3200.0, 11000.0, length(mv.xyz))) * clamp(s / 1.6, 0.0, 1.0);
  gl_PointSize = clamp(s, 1.6, 22.0);
  vC = acolor;
  gl_Position = projectionMatrix * mv;
}`;
const DOT_FS = /* glsl */ `
varying vec3 vC;
varying float vA;
void main() {
  float r = length(gl_PointCoord - 0.5);
  float a = (1.0 - smoothstep(0.26, 0.5, r)) * vA * 0.8;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vC, a);
}`;

// a canvas frame: rounded, 2px border, translucent paper, a coloured title bar
const FRAME_VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAME_FS = /* glsl */ `
uniform vec2 uSize;
uniform float uBar;
uniform float uR;
uniform float uBw;
uniform vec3 uFill;
uniform float uFillA;
uniform vec3 uBarC;
uniform vec3 uLine;
uniform float uAlpha;
varying vec2 vUv;
float sdBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main() {
  vec2 p = (vUv - 0.5) * uSize;
  float d = sdBox(p, uSize * 0.5, uR);
  float fw = fwidth(d);
  float inside = 1.0 - smoothstep(-fw, fw * 0.5, d);
  float border = smoothstep(-uBw - fw, -uBw + fw, d);
  float top = uSize.y * 0.5 - uBar;
  float fy = fwidth(p.y);
  float bar = smoothstep(top - fy, top + fy, p.y);
  float seam = (1.0 - smoothstep(0.0, fy * 1.5, abs(p.y - top))) * 0.35;
  vec4 c = vec4(uFill, uFillA);
  c = mix(c, vec4(uBarC, 0.97), bar);
  c = mix(c, vec4(uLine, 0.8), max(border, seam));
  c.a *= inside * uAlpha;
  if (c.a < 0.003) discard;
  gl_FragColor = c;
}`;

/* ── the world ─────────────────────────────────────────────────────── */

export async function createWorld({ stage, reduce = false, touch = false, onTour = () => {}, mode = 'free', route = ROUTE, dark = false }) {
  const scroll = mode === 'scroll';
  const sprites = scroll; // cards as textured quads from an atlas, not css3d
  const viewSize = () => (scroll ? [stage.clientWidth || innerWidth, stage.clientHeight || innerHeight] : [innerWidth, innerHeight]);
  let [vw, vh] = viewSize();
  const tanV = Math.tan((FOV / 2) * DEG);

  const gl = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
  // a software renderer (swiftshader, llvmpipe, headless browsers) pays for every pixel on the
  // cpu: give it a smaller budget, so the flight still moves instead of stalling
  const soft = (() => { try { const dbg = gl.getContext().getExtension('WEBGL_debug_renderer_info'); const r = dbg ? gl.getContext().getParameter(dbg.UNMASKED_RENDERER_WEBGL) : ''; return /swiftshader|llvmpipe|softpipe|software|mesa offscreen/i.test(String(r)); } catch { return false; } })();
  const dpr = soft ? Math.min(window.devicePixelRatio || 1, 1) : Math.min(window.devicePixelRatio || 1, 2);
  gl.setPixelRatio(dpr);
  gl.setSize(vw, vh, false);
  gl.setClearColor(0x000000, 0);
  gl.domElement.setAttribute('aria-hidden', 'true');
  stage.append(gl.domElement);
  const css = new CSS3DRenderer();
  css.domElement.className = 'css3d';
  css.setSize(vw, vh);
  stage.append(css.domElement);

  const scene = new THREE.Scene();
  const cssScene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, vw / vh, 5, 60000);

  /* ── cards: dom elements measured once (free mode), or painted into an atlas (scroll mode) ── */
  const cards = NODES.map((n, i) => ({ n, i, v: new V3(), shown: true, op: -1, a: -1 }));
  const byId = new Map(cards.map((k) => [k.n.id, k]));
  const clusters = CLUSTERS.map((c, i) => ({ ...c, i, cards: cards.filter((k) => k.n.cluster === c.id) }));
  const clusterOf = new Map(clusters.map((c) => [c.id, c]));
  for (const k of cards) k.cl = clusterOf.get(k.n.cluster);
  const titles = clusters.filter((c) => c.id !== 'me').map((c) => ({ c, h: 34 }));
  const labelled = EDGES.filter((e) => e[2] && byId.has(e[0]) && byId.has(e[1]));
  let atlas = null, meas = null;
  if (sprites) {
    const items = [
      ...cards.map((k) => ({ id: k.n.id, node: k.n })),
      ...titles.map((t) => ({ id: `title:${t.c.id}`, node: { type: 'ftitle', text: t.c.title, color: t.c.color } })),
      ...labelled.map(([a, b, text]) => ({ id: `pill:${a}|${b}`, node: { type: 'pill', text } })),
    ];
    atlas = await paintAtlas(items, { dark, scale: Math.min(1.75, Math.max(1.25, dpr)) });
    for (const k of cards) { const c = atlas.cells.get(k.n.id); k.w = c.w; k.h = c.h; k.cell = c; }
    for (const t of titles) { const c = atlas.cells.get(`title:${t.c.id}`); t.w = c.w; t.cell = c; }
  } else {
    meas = document.createElement('div');
    meas.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;contain:layout style;';
    stage.append(meas);
    for (const k of cards) { k.el = buildCard(k.n); k.el.style.position = 'absolute'; meas.append(k.el); }
    for (const t of titles) {
      const el = document.createElement('div');
      el.className = 'ftitle';
      el.dataset.color = t.c.color;
      el.dataset.cluster = t.c.id;
      el.textContent = t.c.title;
      el.style.position = 'absolute';
      meas.append(el);
      t.el = el;
    }
    void meas.offsetWidth; // lay out once so the fonts start loading
    await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 2500))]);
    for (const k of cards) { k.w = k.el.offsetWidth; k.h = k.el.offsetHeight; }
    for (const t of titles) t.w = t.el.offsetWidth;
  }

  /* ── layout: boards on a loose ring around the name ── */
  const aspect0 = vw / vh;
  const boardAspect = clamp(aspect0, 0.62, 1.55);
  for (const cl of clusters) {
    const items = cl.cards.map((k) => ({ w: k.w, h: k.h, pin: k.n.type === 'title' ? [0, 0] : null, k }));
    // the name's board reads like the front page: the name, then the line under it
    const T = items.find((it) => it.pin), Q = T && items.find((it) => it.k.n.type === 'quote');
    if (Q) Q.pin = [-T.w / 2 + Q.w / 2 + 4, -(T.h / 2 + Q.h / 2 + 14)];
    const b = relax(items, { aspect: cl.id === 'me' ? Math.max(boardAspect, 1.3) : boardAspect, gap: 30, seed: cl.id });
    items.forEach((it) => { it.k.lx = it.x; it.k.ly = it.y; });
    cl.items = items;
    cl.b = b;
    cl.fw = b.w + PAD * 2;
    cl.fh = b.h + PAD * 2 + (cl.id === 'me' ? 0 : BAR);
    cl.fx = (b.x0 + b.x1) / 2;
    cl.fy = (b.y0 + b.y1) / 2 + (cl.id === 'me' ? 0 : BAR / 2);
  }
  const ring = clusters.filter((c) => c.id !== 'me');
  const rr = rng('map:ring');
  const LIFT = [560, -300, 440, -560, 120, -640, 400, -180, 600, -420];
  ring.forEach((cl, i) => {
    const th = (26 + i * (308 / Math.max(1, ring.length - 1))) * DEG;
    const R = 2750 + (rr() - 0.5) * 380;
    cl.c = new V3(Math.sin(th) * R, LIFT[i % LIFT.length] + (rr() - 0.5) * 140, Math.cos(th) * R);
  });
  const me = clusterOf.get('me');
  me.c = new V3(0, 0, 0);
  for (const cl of clusters) {
    cl.n = cl === me ? new V3(0, 0.035, 1).normalize() : cl.c.clone().normalize();
    const f = cl.n.clone().negate();
    cl.right = new V3().crossVectors(f, UP).normalize();
    cl.up = new V3().crossVectors(cl.right, f).normalize();
    cl.fc = cl.c.clone().addScaledVector(cl.right, cl.fx).addScaledVector(cl.up, cl.fy);
    // cards sit at different depths, scaled and spread so that from the tour's
    // viewpoint the board reads exactly as it was laid out, flat and tidy
    const D0 = tourFit(cl).D;
    const zr = rng(`z:${cl.id}`);
    const amp = Math.min(D0 * 0.18, 70 + 12 * cl.cards.length);
    for (const k of cl.cards) {
      const z = k.n.type === 'title' ? 0 : (zr() * 2 - 1) * amp;
      const s = (D0 - z) / D0;
      k.s = s;
      k.pos = cl.c.clone()
        .addScaledVector(cl.right, cl.fx + (k.lx - cl.fx) * s)
        .addScaledVector(cl.up, cl.fy + (k.ly - cl.fy) * s)
        .addScaledVector(cl.n, z);
    }
  }
  const hueOf = new Map(clusters.map((cl) => [cl.id, cl === me ? rgb('#6a2bff') : ramp(ring.indexOf(cl) / Math.max(1, ring.length - 1))]));

  if (!sprites) {
    for (const k of cards) {
      const obj = new CSS3DObject(k.el);
      obj.position.copy(k.pos);
      obj.scale.setScalar(k.s);
      k.obj = obj;
      cssScene.add(obj);
    }
  }

  /* ── sprites (scroll mode): the atlas pages as textures, one quad per card / pill, per page ── */
  const spritePages = [];
  let spriteTex = [];
  function spriteMaterial(tex) {
    return new THREE.ShaderMaterial({ uniforms: { map: { value: tex } }, vertexShader: SPRITE_VS, fragmentShader: SPRITE_FS, transparent: true, depthTest: true, depthWrite: true, side: THREE.DoubleSide });
  }
  // items: { pos (V3), w, h, s, cell }. writes it.pg / it.ai so alphas can be set per frame
  function spriteMeshes(items, order) {
    if (!atlas) return;
    spriteTex = atlas.pages.map((c) => {
      const t = new THREE.CanvasTexture(c);
      t.flipY = false;
      t.colorSpace = THREE.SRGBColorSpace;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.anisotropy = soft ? 1 : Math.min(4, gl.capabilities.getMaxAnisotropy());
      t.generateMipmaps = true;
      return t;
    });
    atlas.pages.forEach((c, pi) => {
      const list = items.filter((it) => it.cell.page === pi);
      if (!list.length) return;
      const n = list.length;
      const pos = new Float32Array(n * 12), corner = new Float32Array(n * 8), uv = new Float32Array(n * 8), alpha = new Float32Array(n * 4);
      const idx = new Uint16Array(n * 6);
      list.forEach((it, i) => {
        const hw = (it.w * it.s) / 2, hh = (it.h * it.s) / 2, { u0, v0, u1, v1 } = it.cell;
        for (let q = 0; q < 4; q++) pos.set([it.pos.x, it.pos.y, it.pos.z], i * 12 + q * 3);
        corner.set([-hw, hh, hw, hh, -hw, -hh, hw, -hh], i * 8);
        uv.set([u0, v0, u1, v0, u0, v1, u1, v1], i * 8);
        idx.set([i * 4, i * 4 + 2, i * 4 + 1, i * 4 + 1, i * 4 + 2, i * 4 + 3], i * 6);
        it.pg = spritePages.length; it.ai = i; it.a = -1;
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('corner', new THREE.BufferAttribute(corner, 2));
      g.setAttribute('auv', new THREE.BufferAttribute(uv, 2));
      const al = new THREE.BufferAttribute(alpha, 1);
      al.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('alpha', al);
      g.setIndex(new THREE.BufferAttribute(idx, 1));
      const m = new THREE.Mesh(g, spriteMaterial(spriteTex[pi]));
      m.frustumCulled = false;
      m.renderOrder = order;
      scene.add(m);
      spritePages.push({ mesh: m, alpha: al, dirty: false });
    });
  }
  function setAlpha(it, o) {
    const q = Math.round(o * 64) / 64;
    if (q === it.a || it.pg == null) return;
    it.a = q;
    const pg = spritePages[it.pg];
    pg.alpha.array.fill(q, it.ai * 4, it.ai * 4 + 4);
    pg.dirty = true;
  }

  /* ── arrows: the edges, plus a faint thread through each board ── */
  const er = rng('map:edges');
  const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const linked = new Set();
  const crossCurves = [];
  const chainCurves = new Map(clusters.map((c) => [c.id, []]));
  const labels = [];
  function curve(A, B, kind) {
    const a = A.pos, b = B.pos;
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const dir = b.clone().sub(a);
    const len = dir.length() || 1;
    dir.divideScalar(len);
    let perp, bow;
    if (kind === 'cross') {
      // bow outward, away from the middle of the map, with a seeded twist so arcs don't stack
      perp = mid.lengthSq() > 1 ? mid.clone().normalize() : new V3(0, 1, 0);
      perp.addScaledVector(dir, -perp.dot(dir));
      if (perp.lengthSq() < 0.09) perp.crossVectors(dir, new V3(er() - 0.5, 1, er() - 0.5).normalize());
      perp.normalize().applyAxisAngle(dir, (er() - 0.5) * 1.3);
      bow = len * (0.2 + er() * 0.12);
    } else {
      const cl = A.cl;
      perp = new V3().crossVectors(dir, cl.n).normalize().multiplyScalar(er() < 0.5 ? -1 : 1).addScaledVector(cl.n, 0.35).normalize();
      bow = len * (kind === 'chain' ? 0.12 : 0.18);
    }
    const ctrl = mid.clone().addScaledVector(perp, bow);
    const segs = kind === 'cross' ? 40 : 18;
    const pts = [];
    for (let s = 0; s <= segs; s++) pts.push(quad(a, ctrl, b, s / segs));
    let L = 0;
    for (let s = 1; s <= segs; s++) L += pts[s].distanceTo(pts[s - 1]);
    const ca = hueOf.get(A.n.cluster), cb = hueOf.get(B.n.cluster);
    return { pts, len: L, ca, cb: kind === 'cross' ? cb : mix(cb, [1, 1, 1], 0.12), mid: quad(a, ctrl, b, 0.5), phase: er() };
  }
  for (const [a, b, label] of EDGES) {
    const A = byId.get(a), B = byId.get(b);
    if (!A || !B) continue;
    linked.add(key(a, b));
    const same = A.n.cluster === B.n.cluster;
    const c = curve(A, B, same ? 'intra' : 'cross');
    // long arcs across the whole map stay quieter than local links
    Object.assign(c, { alpha: 0.46 * clamp(2400 / c.len, 0.5, 1), core: 0.66, gap: 1.2 + er() * 3.8 });
    (same ? chainCurves.get(A.n.cluster) : crossCurves).push(c);
    if (label) labels.push({ text: label, pos: c.mid, key: `${a}|${b}` });
  }
  for (const cl of clusters) {
    for (const [i, j] of thread(cl.items)) {
      const A = cl.items[i].k, B = cl.items[j].k;
      if (linked.has(key(A.n.id, B.n.id))) continue;
      const c = curve(A, B, 'chain');
      Object.assign(c, { alpha: 0.34, core: 0.6, gap: 4 + er() * 9 });
      chainCurves.get(cl.id).push(c);
    }
  }

  const lineMat = new THREE.ShaderMaterial({
    uniforms: {
      uRes: { value: new THREE.Vector2(vw * dpr, vh * dpr) },
      uHalf: { value: 3.8 * dpr },
      uDpr: { value: dpr },
      uNear: { value: camera.near },
      uFade: { value: new THREE.Vector2(1100, 6600) },
      uTime: { value: 0 },
      uPulse: { value: reduce ? 0 : 1 },
      uSpeed: { value: 540 },
    },
    vertexShader: LINE_VS,
    fragmentShader: LINE_FS,
    side: THREE.DoubleSide, // the ribbons wind whichever way the screen says
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  function lineMesh(list) {
    let segs = 0;
    for (const c of list) segs += c.pts.length - 1;
    const nv = segs * 4;
    const pos = new Float32Array(nv * 3), oth = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
    const side = new Float32Array(nv), endp = new Float32Array(nv), tt = new Float32Array(nv), core = new Float32Array(nv);
    const edge = new Float32Array(nv * 4);
    const idx = new (nv > 65535 ? Uint32Array : Uint16Array)(segs * 6);
    let v = 0, ii = 0;
    for (const c of list) {
      const n = c.pts.length - 1;
      const period = c.len / lineMat.uniforms.uSpeed.value + c.gap;
      for (let s = 0; s < n; s++) {
        const pa = c.pts[s], pb = c.pts[s + 1];
        const ta = s / n, tb = (s + 1) / n;
        const base = v;
        for (let q = 0; q < 4; q++) {
          const atB = q >= 2;
          const P = atB ? pb : pa, O = atB ? pa : pb, t = atB ? tb : ta;
          const C = mix(c.ca, c.cb, t);
          pos.set([P.x, P.y, P.z], v * 3);
          oth.set([O.x, O.y, O.z], v * 3);
          col.set(C, v * 3);
          side[v] = q % 2 ? 1 : -1;
          endp[v] = atB ? 1 : 0;
          tt[v] = t;
          core[v] = c.core;
          edge.set([c.len, c.phase, period, c.alpha], v * 4);
          v++;
        }
        idx.set([base, base + 1, base + 2, base + 2, base + 1, base + 3], ii);
        ii += 6;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('other', new THREE.BufferAttribute(oth, 3));
    g.setAttribute('acolor', new THREE.BufferAttribute(col, 3));
    g.setAttribute('side', new THREE.BufferAttribute(side, 1));
    g.setAttribute('endp', new THREE.BufferAttribute(endp, 1));
    g.setAttribute('tt', new THREE.BufferAttribute(tt, 1));
    g.setAttribute('core', new THREE.BufferAttribute(core, 1));
    g.setAttribute('edge', new THREE.BufferAttribute(edge, 4));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    const m = new THREE.Mesh(g, lineMat);
    m.frustumCulled = false;
    return m;
  }
  const crossMesh = lineMesh(crossCurves);
  crossMesh.renderOrder = 5;
  scene.add(crossMesh);
  const chainMesh = new Map();
  for (const cl of clusters) {
    const list = chainCurves.get(cl.id);
    if (!list.length) continue;
    const m = lineMesh(list);
    m.renderOrder = cl === me ? 9 : 11;
    chainMesh.set(cl.id, m);
    scene.add(m);
  }

  // arrow labels: the canvas's little white pills
  const pills = labels.map((l) => {
    if (sprites) {
      const cell = atlas.cells.get(`pill:${l.key}`);
      return { pos: l.pos, v: new V3(), shown: true, op: -1, a: -1, w: cell.w, h: cell.h, s: 1, cell };
    }
    const el = document.createElement('div');
    el.className = 'elabel';
    el.textContent = l.text;
    const obj = new CSS3DObject(el);
    el.style.pointerEvents = 'none';
    obj.position.copy(l.pos);
    cssScene.add(obj);
    return { el, obj, pos: l.pos, v: new V3(), shown: true, op: -1, w: 12 + l.text.length * 6.4, h: 22 };
  });
  if (sprites) spriteMeshes([...cards, ...pills], 40);

  /* ── frames ── */
  const plane = new THREE.PlaneGeometry(1, 1);
  // a frame's paper: translucent on the light sky; on a dark one (the front page in dark mode) near opaque
  function paper(cl, night) {
    const white = cl.color === 'white';
    const past = rgb(PASTEL[cl.color] || '#ffffff');
    if (night) {
      return {
        fill: white ? [0.925, 0.935, 0.955] : mix(past, [1, 1, 1], 0.16), fillA: 0.9,
        bar: white ? [1, 1, 1] : past,
        line: white ? [0.7, 0.73, 0.8] : mix(past, [0.04, 0.06, 0.13], 0.22),
      };
    }
    return {
      fill: white ? [0.972, 0.976, 0.988] : mix(past, [1, 1, 1], 0.3), fillA: white ? 0.64 : 0.56,
      bar: white ? [1, 1, 1] : past,
      line: white ? [0.83, 0.85, 0.9] : mix(past, [0.04, 0.06, 0.13], 0.13),
    };
  }
  const frames = titles.map((t) => {
    const { c: base, el, w } = t;
    const cl = clusterOf.get(base.id);
    const pp = paper(cl, dark);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uSize: { value: new THREE.Vector2(1, 1) },
        uBar: { value: BAR }, uR: { value: 14 }, uBw: { value: 2 },
        uFill: { value: new THREE.Vector3(...pp.fill) },
        uFillA: { value: pp.fillA },
        uBarC: { value: new THREE.Vector3(...pp.bar) },
        uLine: { value: new THREE.Vector3(...pp.line) },
        uAlpha: { value: 0 },
      },
      vertexShader: FRAME_VS,
      fragmentShader: FRAME_FS,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    const mesh = new THREE.Mesh(plane, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 10;
    scene.add(mesh);
    let title;
    if (sprites) title = { w, h: t.h, cell: t.cell, op: -1, shown: true, a: -1 };
    else { const obj = new CSS3DObject(el); cssScene.add(obj); title = { el, obj, w, op: -1, shown: true }; }
    return { cl, mesh, u: mat.uniforms, title, alpha: 0, z: 0, x0: 0, x1: 0, y0: 0, y1: 0 };
  });
  // the frame titles as sprites live in camera space (they sit on a camera-facing rect), so their
  // mesh wears the camera's matrix and their vertices are written each frame
  let titleMesh = null, titlePos = null, titleAlpha = null;
  if (sprites && frames.length) {
    const n = frames.length;
    const pos = new Float32Array(n * 12), corner = new Float32Array(n * 8), uv = new Float32Array(n * 8), alpha = new Float32Array(n * 4);
    const idx = new Uint16Array(n * 6);
    frames.forEach((f, i) => {
      const { u0, v0, u1, v1 } = f.title.cell;
      uv.set([u0, v0, u1, v0, u0, v1, u1, v1], i * 8);
      idx.set([i * 4, i * 4 + 2, i * 4 + 1, i * 4 + 1, i * 4 + 2, i * 4 + 3], i * 6);
    });
    const g = new THREE.BufferGeometry();
    titlePos = new THREE.BufferAttribute(pos, 3); titlePos.setUsage(THREE.DynamicDrawUsage);
    titleAlpha = new THREE.BufferAttribute(alpha, 1); titleAlpha.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', titlePos);
    g.setAttribute('corner', new THREE.BufferAttribute(corner, 2));
    g.setAttribute('auv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('alpha', titleAlpha);
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    // the titles' atlas page: whichever page holds the first one (they're packed together, same height)
    const mat = spriteMaterial(spriteTex[frames[0].title.cell.page]);
    mat.depthTest = false; mat.depthWrite = false;
    titleMesh = new THREE.Mesh(g, mat);
    titleMesh.frustumCulled = false;
    titleMesh.matrixAutoUpdate = false;
    titleMesh.renderOrder = 41;
    scene.add(titleMesh);
  }

  /* ── the air: specks and palette blobs ── */
  let dotMat;
  {
    const N = soft ? 500 : touch ? 1100 : 1700;
    const pr = rng('map:specks');
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const near = i < N * 0.7;
      const r = near ? 900 + pr() * 4800 : 5000 + pr() * 7000;
      const a = pr() * Math.PI * 2;
      const y = (pr() * 2 - 1) * (near ? 2300 : 5000);
      pos.set([Math.sin(a) * r, y, Math.cos(a) * r], i * 3);
      const c = ramp(pr());
      col.set(pr() < 0.3 ? mix(c, [1, 1, 1], 0.35) : c, i * 3);
      size[i] = 4 + pr() * pr() * 12;
      seed[i] = pr();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('acolor', new THREE.BufferAttribute(col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(size, 1));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    dotMat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: (vh * dpr) / 2 / tanV }, uTime: { value: 0 } },
      vertexShader: DOT_VS, fragmentShader: DOT_FS,
      transparent: true, depthWrite: false, depthTest: false,
    });
    const pts = new THREE.Points(g, dotMat);
    pts.frustumCulled = false;
    pts.renderOrder = 2;
    scene.add(pts);
  }
  const blobTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.3, 'rgba(255,255,255,.62)');
    gr.addColorStop(0.62, 'rgba(255,255,255,.18)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const blobs = [
    ['#18a0ff', [-2600, 900, -2200], 5600, 0.2], ['#ff2d87', [2900, -700, -1300], 5000, 0.15],
    ['#ff7a1a', [1500, 1500, 2700], 4400, 0.14], ['#6a2bff', [-2100, -1500, 2100], 5000, 0.13],
    ['#ffd23f', [0, 300, -5400], 6600, 0.24], ['#18a0ff', [4300, 1900, 2500], 5000, 0.12],
    ['#ff2d87', [-4500, 600, 900], 5400, 0.12], ['#ffd23f', [-700, -2700, -700], 5800, 0.14],
    ['#6a2bff', [1900, 2700, -3100], 5200, 0.11], ['#ff7a1a', [-300, -300, 5600], 5000, 0.1],
  ].slice(0, soft ? 4 : 10).map(([c, p, s, o]) => {
    const m = new THREE.SpriteMaterial({ map: blobTex, color: new THREE.Color(c), transparent: true, opacity: o, depthWrite: false, depthTest: false, fog: false });
    const sp = new THREE.Sprite(m);
    sp.position.set(...p);
    sp.scale.setScalar(s);
    sp.renderOrder = 0;
    scene.add(sp);
    return { sp, o, s };
  });

  meas?.remove();

  /* ── the camera, and how you fly it ── */
  const ctl = { pos: new V3(), yaw: 0, pitch: 0, tyaw: 0, tpitch: 0, vel: new V3(), pend: 0, keys: new Set(), flight: null };
  let now = performance.now() / 1000;
  const fwd = (out = new V3()) => out.set(-Math.sin(ctl.yaw) * Math.cos(ctl.pitch), Math.sin(ctl.pitch), -Math.cos(ctl.yaw) * Math.cos(ctl.pitch));
  const rightOf = (out = new V3()) => out.set(Math.cos(ctl.yaw), 0, -Math.sin(ctl.yaw));
  const angles = (pos, look) => {
    const d = look.clone().sub(pos).normalize();
    return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.asin(clamp(d.y, -1, 1)) };
  };
  function setPose(pos, look) {
    ctl.pos.copy(pos);
    const a = angles(pos, look);
    ctl.yaw = ctl.tyaw = a.yaw;
    ctl.pitch = ctl.tpitch = a.pitch;
  }
  function flyTo(pos, look, { dur, arc = 0.15, ease = easeInOut, onDone } = {}) {
    const from = { pos: ctl.pos.clone(), yaw: ctl.yaw, pitch: ctl.pitch };
    const a = angles(pos, look);
    let dy = a.yaw - from.yaw;
    dy = ((((dy + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
    const to = { pos: pos.clone(), yaw: from.yaw + dy, pitch: a.pitch };
    const dist = from.pos.distanceTo(to.pos);
    const d = reduce ? 0 : dur ?? clamp(0.7 + 0.42 * Math.log2(1 + dist / 320), 0.8, 2.6);
    const mid = from.pos.clone().add(to.pos).multiplyScalar(0.5);
    const out = new V3(mid.x, mid.y * 0.3, mid.z);
    if (out.lengthSq() < 1) out.set(0, 0, 1);
    const ctrl = mid.addScaledVector(out.normalize(), dist * arc).addScaledVector(UP, dist * arc * 0.3);
    ctl.pend = 0;
    ctl.vel.set(0, 0, 0);
    ctl.flight = { from, to, ctrl, t0: now, d, ease, onDone };
    if (d === 0) stepFlight();
  }
  function stepFlight() {
    const f = ctl.flight;
    const u = f.d > 0 ? clamp((now - f.t0) / f.d, 0, 1) : 1;
    quad(f.from.pos, f.ctrl, f.to.pos, f.ease(u), ctl.pos);
    const e = f.ease(Math.min(1, u * 1.12));
    ctl.yaw = ctl.tyaw = f.from.yaw + (f.to.yaw - f.from.yaw) * e;
    ctl.pitch = ctl.tpitch = f.from.pitch + (f.to.pitch - f.from.pitch) * e;
    if (u >= 1) { ctl.flight = null; f.onDone?.(); }
  }
  // any hand on the controls: stop flying for them, stop the tour
  function takeover() {
    if (ctl.flight) ctl.flight = null;
    if (intro) intro = null;
    if (tour.on) stopTour();
  }

  const tmpV = new V3(), tmpR = new V3();
  function updateControls(dt) {
    if (intro) return;
    if (ctl.flight) { stepFlight(); return; }
    if (tour.on && tour.arrived && tour.stop?.pan) {
      const s = tour.stop;
      const u = sstep(0.8, tour.dwell - 0.8, now - tour.arrived);
      ctl.pos.copy(s.pos).addScaledVector(s.cl.right, s.ox * (2 * u - 1)).addScaledVector(s.cl.up, -s.oy * (2 * u - 1));
    }
    const kl = reduce ? 1 : 1 - Math.exp(-dt * 18);
    ctl.yaw += (ctl.tyaw - ctl.yaw) * kl;
    ctl.pitch += (ctl.tpitch - ctl.pitch) * kl;
    if (Math.abs(ctl.pend) > 0.05) {
      const step = reduce ? ctl.pend : ctl.pend * (1 - Math.exp(-dt * 9));
      ctl.pend -= step;
      ctl.pos.addScaledVector(fwd(tmpV), step);
    }
    const k = ctl.keys;
    const f = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
    const r = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    const u = (k.has('e') ? 1 : 0) - (k.has('q') ? 1 : 0);
    const want = fwd(tmpV).multiplyScalar(f).addScaledVector(rightOf(tmpR), r).addScaledVector(UP, u);
    if (want.lengthSq() > 0) want.normalize().multiplyScalar(k.has('shift') ? 2800 : 950);
    ctl.vel.lerp(want, reduce ? 1 : 1 - Math.exp(-dt * (want.lengthSq() ? 5 : 8)));
    if (ctl.vel.lengthSq() > 0.01) ctl.pos.addScaledVector(ctl.vel, dt);
  }

  /* ── shots: where the camera goes for a board, or for a card ── */
  function tourFit(cl) {
    const asp = vw / vh, narrow = vw < 700;
    const fillW = narrow ? 0.94 : 0.88;
    // the top chrome and the tour bar take ~130px of height between them
    const fillH = clamp(1 - 150 / vh, 0.6, 0.84);
    let D = Math.max(cl.fw / 2 / (tanV * asp * fillW), cl.fh / 2 / (tanV * fillH));
    let ox = 0, oy = 0;
    // small boards shouldn't blow up to slide size; big ones shouldn't shrink past reading
    const maxScale = narrow ? 1 : 1.12;
    D = Math.max(D, vh / 2 / (maxScale * tanV));
    // a phone frames the whole board (its width), however small the cards get: a cropped group reads as broken
    const minScale = narrow ? 0.3 : 0.52;
    const Dmax = vh / 2 / (minScale * tanV);
    if (cl.id !== 'me' && !reduce && D > Dmax) {
      D = Dmax;
      ox = Math.max(0, cl.fw / 2 - D * tanV * asp * fillW);
      oy = Math.max(0, cl.fh / 2 - D * tanV * fillH);
    }
    return { D, ox, oy };
  }
  function stopShot(cl) {
    const { D, ox, oy } = tourFit(cl);
    const pos = cl.fc.clone().addScaledVector(cl.n, D);
    // a pan starts top-left and drifts to bottom-right, the way you'd read it
    const start = pos.clone().addScaledVector(cl.right, -ox).addScaledVector(cl.up, oy);
    return { cl, pos, start, look: start.clone().addScaledVector(cl.n, -D), ox, oy, pan: ox > 1 || oy > 1 };
  }
  function cardShot(k) {
    const narrow = vw < 700;
    const w = k.w * k.s, h = k.h * k.s;
    const cap = k.n.type === 'title' ? 1 : k.n.type === 'logo' ? 1.5 : 1.3;
    const scale = Math.min(cap, (vw * (narrow ? 0.84 : 0.46)) / w, (vh * (narrow ? 0.5 : 0.56)) / h);
    const D = vh / 2 / (scale * tanV);
    const from = camera.position.clone().sub(k.pos).normalize();
    const dir = k.cl.n.clone().multiplyScalar(0.8).addScaledVector(from, 0.2).normalize();
    return { pos: k.pos.clone().addScaledVector(dir, D), look: k.pos.clone() };
  }

  /* ── the fly-through (scroll mode): one flight, scrubbed by the page ── */
  // keys are camera poses (position + a point to look at). position and look each run along a
  // centripetal catmull-rom through the keys; the plan says how much of p each leg gets, and eases
  // every leg in and out, so the camera settles at each board and glides between them.
  const path = { p: 0, keys: [], plan: [], stops: [], total: 1, posC: null, lookC: null };
  let stale = false;
  const hAngle = (v) => Math.atan2(v.x, v.z);
  // between boards: linger at each end, swoop through the middle (smoothstep of a smoothstep)
  const glide = (u) => { const a = u * u * (3 - 2 * u); return a * a * (3 - 2 * a); };
  const hLen = (v) => Math.hypot(v.x, v.z);
  function buildPath() {
    const keys = [], plan = [], stops = [];
    const key = (pos, look) => keys.push({ pos: pos.clone(), look: look.clone() }) - 1;
    const ringR = ring.reduce((a, cl) => a + hLen(cl.c), 0) / Math.max(1, ring.length);
    const at = (ang, r, y) => new V3(Math.sin(ang) * r, y, Math.cos(ang) * r);
    let last = key(START_SCROLL.pos, START_SCROLL.look);
    let lead = 1.5; // the first leg, in from far out, is the longest
    for (const id of route) {
      const cl = clusterOf.get(id);
      if (!cl) continue;
      const s = stopShot(cl);
      const end = s.pan ? s.pos.clone().addScaledVector(cl.right, s.ox).addScaledVector(cl.up, -s.oy) : s.start;
      const endLook = end.clone().add(s.look).sub(s.start);
      const from = keys[last];
      const a0 = last;
      // leaving the inside of the ring (the name's board), back out through the gap first
      if (hLen(from.pos) < ringR) {
        key(at(hAngle(from.pos), ringR + 1300, from.pos.y + 160), from.look.clone().lerp(s.look, 0.3));
      } else {
        // a long way round the ring: swing wide and keep looking in, so the boards between go by
        let d = hAngle(s.start) - hAngle(from.pos);
        d = ((((d + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
        const n = Math.floor(Math.abs(d) / (40 * DEG));
        const r0 = hLen(from.pos), r1 = hLen(s.start), l0 = hLen(from.look), l1 = hLen(s.look);
        for (let j = 1; j <= n; j++) {
          const u = j / (n + 1);
          const ang = hAngle(from.pos) + d * u;
          const lift = Math.sin(u * Math.PI) * 220;
          key(at(ang, Math.max(r0, r1) * 1.1, from.pos.y + (s.start.y - from.pos.y) * u + lift),
            at(ang, l0 + (l1 - l0) * u, from.look.y + (s.look.y - from.look.y) * u));
        }
      }
      const b = key(s.start, s.look);
      plan.push({ a: a0, b, w: lead + 0.3 * (b - a0 - 1), ease: glide });
      lead = 0.85;
      const stop = { id, title: cl.title, at: 0, w0: 0 };
      if (s.pan) {
        const c = key(end, endLook);
        plan.push({ a: b, b: c, w: 1.4, lin: true, stop });
        last = c;
      } else {
        plan.push({ a: b, b, w: 0.9, stop });
        last = b;
      }
      stops.push(stop);
    }
    // the end: up and forward over the last board, into open sky, where the call to action waits
    const L = keys[last];
    const fwdL = L.look.clone().sub(L.pos).normalize();
    const reach = L.pos.distanceTo(L.look);
    const top = L.pos.clone().addScaledVector(fwdL, reach * 0.55).addScaledVector(UP, 1500);
    const dive = key(top, top.clone().addScaledVector(fwdL.clone().addScaledVector(UP, 0.6).normalize(), 4000));
    plan.push({ a: last, b: dive, w: 1.4, ease: (u) => u * u * (2 - u) * 0.5 + u * u * 0.5 });
    path.total = plan.reduce((a, e) => a + e.w, 0);
    let acc = 0;
    for (const e of plan) {
      if (e.stop) { e.stop.at = (acc + e.w / 2) / path.total; }
      acc += e.w;
    }
    path.keys = keys;
    path.plan = plan;
    path.stops = stops;
    const curve = (pts) => new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    path.posC = curve(keys.map((k) => k.pos));
    path.lookC = curve(keys.map((k) => k.look));
  }
  const pathPos = new V3(), pathLook = new V3(), pathTmp = new V3();
  function followPath() {
    const n = path.keys.length - 1;
    let x = path.p * path.total;
    let e = path.plan[path.plan.length - 1], u = 1;
    for (const it of path.plan) {
      if (x <= it.w) { e = it; u = it.w ? x / it.w : 1; break; }
      x -= it.w;
    }
    const v = e.ease ? e.ease(u) : u * u * (3 - 2 * u);
    if (e.lin) {
      const A = path.keys[e.a], B = path.keys[e.b];
      pathPos.lerpVectors(A.pos, B.pos, v);
      pathLook.lerpVectors(A.look, B.look, v);
    } else {
      const t = (e.a + (e.b - e.a) * v) / n;
      path.posC.getPoint(t, pathPos);
      path.lookC.getPoint(t, pathLook);
    }
    ctl.pos.copy(pathPos);
    pathTmp.copy(pathLook).sub(pathPos).normalize();
    ctl.yaw = ctl.tyaw = Math.atan2(-pathTmp.x, -pathTmp.z);
    ctl.pitch = ctl.tpitch = Math.asin(clamp(pathTmp.y, -1, 1));
  }

  /* ── tour ── */
  const tour = { on: false, i: 0, arrived: 0, stop: null, dwell: 7, ending: false };
  const emitTour = () => onTour({ on: tour.on, i: tour.i, n: TOUR.length, title: clusterOf.get(TOUR[tour.i]).title });
  function tourGo(i, { start = true } = {}) {
    tour.i = ((i % TOUR.length) + TOUR.length) % TOUR.length;
    tour.on = start;
    tour.ending = false;
    const cl = clusterOf.get(TOUR[tour.i]);
    const s = stopShot(cl);
    tour.stop = s;
    tour.arrived = 0;
    tour.dwell = s.pan ? 11 : 7;
    intro = null;
    setFocus(null);
    grunts?.setGuideMood('bouncing');
    flyTo(s.start, s.look, { arc: 0.16, onDone: () => { tour.arrived = now; grunts?.setGuideMood('happy'); } });
    emitTour();
  }
  function stopTour() {
    if (!tour.on) return;
    tour.on = false;
    tour.ending = false;
    emitTour();
  }
  function updateTour() {
    if (!tour.on || !tour.arrived || ctl.flight) return;
    if (tour.ending) { stopTour(); return; }
    if (now - tour.arrived < tour.dwell) return;
    const last = tour.i === TOUR.length - 1;
    tourGo(tour.i + 1);
    if (last) tour.ending = true;
  }

  /* ── focus ── */
  let focused = null;
  function setFocus(k) {
    if (focused === k) return;
    focused?.el.classList.remove('is-focus');
    focused = k;
    k?.el.classList.add('is-focus');
  }
  function focusNode(id, { keepTour = false } = {}) {
    const k = byId.get(id);
    if (!k) return;
    if (!keepTour) stopTour();
    intro = null;
    setFocus(k);
    const s = cardShot(k);
    tour.i = Math.max(0, TOUR.indexOf(k.n.cluster));
    grunts?.setGuideMood('curious');
    flyTo(s.pos, s.look, { arc: 0.1, onDone: () => grunts?.setGuideMood('happy') });
  }
  function showCluster(id) {
    const i = TOUR.indexOf(id);
    if (i >= 0) tourGo(i, { start: false });
  }
  function highlight(ids, cur) {
    if (sprites) return;
    stage.classList.toggle('is-searching', !!ids);
    for (const k of cards) {
      const hit = !!ids && ids.has(k.n.id);
      k.el.classList.toggle('is-hit', hit);
      k.el.classList.toggle('is-cur', hit && k.n.id === cur);
    }
  }

  /* ── input (free mode only: in scroll mode the page scrolls over the stage) ── */
  const pointer = { x: 0, y: 0, active: false, at: 0 };
  if (!scroll) {
    const ptrs = new Map();
    let drag = null, pinch = null, dragged = false;
    const inUi = (t) => !!t?.closest?.('input, textarea, select, [contenteditable], .plain, .search, .hint');
    stage.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragged = false;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
      else if (ptrs.size === 2) {
        const [p, q] = [...ptrs.values()];
        pinch = { d: Math.hypot(p.x - q.x, p.y - q.y) };
        drag = null;
        dragged = true;
      }
    });
    stage.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') {
        pointer.x = (e.clientX / vw) * 2 - 1;
        pointer.y = -(e.clientY / vh) * 2 + 1;
        pointer.active = true;
        pointer.at = now;
      }
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      const px = p.x, py = p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (pinch && ptrs.size >= 2) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        takeover();
        ctl.pend = clamp(ctl.pend + (d - pinch.d) * 6, -5000, 5000);
        pinch.d = d;
        return;
      }
      if (!drag || drag.id !== e.pointerId) return;
      if (!drag.moved) {
        if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < (e.pointerType === 'mouse' ? 4 : 9)) return;
        drag.moved = true;
        dragged = true;
        takeover();
        stage.classList.add('is-dragging');
        try { stage.setPointerCapture(e.pointerId); } catch { /* fine */ }
      }
      const k = (FOV * DEG) / vh;
      ctl.tyaw += (e.clientX - px) * k;
      ctl.tpitch = clamp(ctl.tpitch + (e.clientY - py) * k, -1.45, 1.45);
    });
    const lift = (e) => {
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (drag && drag.id === e.pointerId) drag = null;
      if (!ptrs.size) stage.classList.remove('is-dragging');
    };
    stage.addEventListener('pointerup', lift);
    stage.addEventListener('pointercancel', lift);
    stage.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') pointer.active = false; });
    // a drag that ends over a link must not follow it
    stage.addEventListener('click', (e) => {
      if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; }
    }, true);
    stage.addEventListener('click', (e) => {
      const t = e.target;
      if (t.closest('a')) { stopTour(); return; } // a real link: the browser has it
      if (t.closest('.grunt')) return;
      const ft = t.closest('.ftitle');
      if (ft) { showCluster(ft.dataset.cluster); return; }
      const card = t.closest('.card');
      if (card) { focusNode(card.dataset.node); return; }
      setFocus(null);
    });
    stage.addEventListener('wheel', (e) => {
      e.preventDefault();
      let dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? vh : 1);
      if (e.ctrlKey) dy *= 4; // a trackpad pinch
      takeover();
      ctl.pend = clamp(ctl.pend - dy * 2.6, -5000, 5000);
    }, { passive: false });
    let gs = 1;
    stage.addEventListener('gesturestart', (e) => { e.preventDefault(); gs = 1; });
    stage.addEventListener('gesturechange', (e) => { e.preventDefault(); takeover(); ctl.pend += (e.scale - gs) * 1400; gs = e.scale; });
    const MOVE = new Set(['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift']);
    addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || inUi(e.target)) return;
      const key = e.key.toLowerCase();
      if (!MOVE.has(key)) return;
      if (key.startsWith('arrow')) e.preventDefault();
      if (key !== 'shift') takeover();
      ctl.keys.add(key);
    });
    addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      ctl.keys.delete(key);
      if (key === 'shift') { ctl.keys.delete('shift'); }
    });
    addEventListener('blur', () => ctl.keys.clear());
  }

  /* ── grunts ── */
  const spots = clusters.map((cl) => ({ id: cl.id, c: cl.fc, right: cl.right, up: cl.up, n: cl.n, hw: cl.fw / 2, hh: cl.fh / 2 }));
  let grunts = null;
  try {
    // the fly-through keeps three (css3d is the one dom cost left in it), redrawn less often
    grunts = createGrunts({ THREE, CSS3DObject, scene: cssScene, camera, spots, reduce, touch, guide: !scroll, cast: scroll ? 3 : 0, fps: scroll ? 12 : 22 });
  } catch (err) {
    grunts = null; // the map is still the map without them
  }

  /* ── per frame ── */
  let tanH = tanV * camera.aspect;
  // the name's board has no frame, but it still stands in front of what's behind it
  const meOcc = { cl: me, pseudo: true, alpha: 0, z: 0, x0: 0, x1: 0, y0: 0, y1: 0 };
  const occluders = [...frames, meOcc];
  function updateFrames() {
    // where each board is, as seen from here: a camera-facing rect on a plane just behind its cards
    for (const f of occluders) {
      const ks = f.cl.cards;
      let zmax = 0, zmin = Infinity, zsum = 0;
      for (const k of ks) { const d = -k.v.z; zmax = Math.max(zmax, d); zmin = Math.min(zmin, d); zsum += d; }
      tmpV.copy(f.cl.fc).sub(camera.position);
      const dc = tmpV.length();
      const facing = Math.abs(tmpV.dot(f.cl.n)) / Math.max(dc, 1);
      let a = (1 - 0.9 * sstep(FAR[0], FAR[1], dc)) * sstep(90, 320, zmin) * sstep(0.25, 0.62, facing);
      // near-opaque night paper would turn far boards into grey slabs: let them go sooner
      if (dark) a *= 1 - 0.94 * sstep(1300, 3400, dc);
      if (f.pseudo) a *= 0.75;
      f.alpha = a > 0.02 ? a : 0;
      if (!f.alpha) continue;
      const z = zmax + 70;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const k of ks) {
        const m = z / -k.v.z, hw = k.w * k.s * 0.5, hh = k.h * k.s * 0.5;
        x0 = Math.min(x0, (k.v.x - hw) * m); x1 = Math.max(x1, (k.v.x + hw) * m);
        y0 = Math.min(y0, (k.v.y - hh) * m); y1 = Math.max(y1, (k.v.y + hh) * m);
      }
      const kk = z / (zsum / ks.length);
      const pad = (f.pseudo ? 20 : PAD) * kk, bar = f.pseudo ? 0 : BAR * kk;
      Object.assign(f, { z, kk, bar, x0: x0 - pad, x1: x1 + pad, y0: y0 - pad, y1: y1 + pad + bar });
    }
    // a board behind a nearer one fades, the way the cards do
    for (const f of frames) {
      f.seen = f.alpha;
      if (!f.alpha) continue;
      const cx = (f.x0 + f.x1) / 2, cy = (f.y0 + f.y1) / 2;
      for (const g of occluders) {
        if (g === f || !g.alpha || g.z >= f.z) continue;
        const px = (cx * g.z) / f.z, py = (cy * g.z) / f.z;
        if (px > g.x0 && px < g.x1 && py > g.y0 && py < g.y1) f.seen *= 1 - 0.75 * g.alpha;
      }
    }
    frames.forEach((f, i) => {
      const show = f.seen > 0.02;
      if (f.mesh.visible !== show) f.mesh.visible = show;
      if (f.title.shown !== show) { if (f.title.obj) f.title.obj.visible = show; f.title.shown = show; }
      if (!show) { if (titleAlpha && titleAlpha.array[i * 4] !== 0) { titleAlpha.array.fill(0, i * 4, i * 4 + 4); titleAlpha.needsUpdate = true; } return; }
      const { z, kk, bar, x0, x1, y0, y1 } = f;
      const w = x1 - x0, h = y1 - y0;
      f.mesh.position.copy(camera.localToWorld(tmpV.set((x0 + x1) / 2, (y0 + y1) / 2, -z)));
      f.mesh.quaternion.copy(camera.quaternion);
      f.mesh.scale.set(w, h, 1);
      f.u.uSize.value.set(w, h);
      f.u.uBar.value = bar;
      f.u.uR.value = 14 * kk;
      f.u.uBw.value = 2 * kk;
      f.u.uAlpha.value = f.seen;
      const t = f.title;
      const tx = x0 + 16 * kk + (t.w * kk) / 2, ty = y1 - bar / 2;
      if (titlePos) {
        const hw = (t.w * kk) / 2, hh = (t.h * kk) / 2, zz = -z + 1;
        titlePos.array.set([tx - hw, ty + hh, zz, tx + hw, ty + hh, zz, tx - hw, ty - hh, zz, tx + hw, ty - hh, zz], i * 12);
        titlePos.needsUpdate = true;
        const q = Math.round(f.seen * 64) / 64;
        if (titleAlpha.array[i * 4] !== q) { titleAlpha.array.fill(q, i * 4, i * 4 + 4); titleAlpha.needsUpdate = true; }
      } else {
        t.obj.position.copy(camera.localToWorld(tmpV.set(tx, ty, -z)));
        t.obj.quaternion.copy(camera.quaternion);
        t.obj.scale.setScalar(kk);
        const q = Math.round(f.seen * 40) / 40;
        if (q !== t.op) { t.el.style.opacity = String(q); t.op = q; }
      }
    });
    if (titleMesh) titleMesh.matrix.copy(camera.matrixWorld);
    // far boards first, each followed by its own thread, so a near frame lies over the far web
    for (const f of frames) { const m = chainMesh.get(f.cl.id); if (m && !(f.seen > 0.02)) m.renderOrder = 6; }
    const order = frames.filter((f) => f.seen > 0.02).sort((a, b) => b.z - a.z);
    order.forEach((f, i) => {
      f.mesh.renderOrder = 10 + i * 2;
      const m = chainMesh.get(f.cl.id);
      if (m) m.renderOrder = 11 + i * 2;
    });
  }
  function fadeOf(v, w, h, cl) {
    const depth = -v.z;
    if (depth < 25) return 0;
    const tx = v.x / depth, ty = v.y / depth;
    if (Math.abs(tx) - (w * 0.5) / depth > tanH * 1.02 || Math.abs(ty) - (h * 0.5) / depth > tanV * 1.02) return 0;
    const dist = v.length();
    if (dist > 10500) return 0;
    let o = (1 - 0.88 * sstep(FAR[0], FAR[1], dist)) * sstep(25, 240, depth);
    for (const f of occluders) {
      if (!f.alpha || f.cl === cl || depth <= f.z) continue;
      const px = tx * f.z, py = ty * f.z;
      if (px > f.x0 && px < f.x1 && py > f.y0 && py < f.y1) o *= 1 - 0.95 * f.alpha;
    }
    return o;
  }
  function place(item, o, ease) {
    const show = o > 0.015;
    if (show !== item.shown) {
      item.obj.visible = show;
      item.shown = show;
      if (show) item.obj.quaternion.copy(camera.quaternion);
    }
    if (!show) return;
    item.obj.quaternion.slerp(camera.quaternion, ease);
    const q = Math.round(o * 40) / 40;
    if (q !== item.op) { item.el.style.opacity = String(q); item.op = q; }
  }
  function updateCards(dt) {
    const m = camera.matrixWorldInverse;
    if (sprites) {
      for (const k of cards) setAlpha(k, fadeOf(k.v, k.w * k.s, k.h * k.s, k.cl));
      for (const p of pills) { p.v.copy(p.pos).applyMatrix4(m); setAlpha(p, fadeOf(p.v, p.w, p.h, null) * 0.95); }
      for (const pg of spritePages) if (pg.dirty) { pg.alpha.needsUpdate = true; pg.dirty = false; }
      return;
    }
    const ease = reduce ? 1 : 1 - Math.exp(-dt * 7);
    for (const k of cards) place(k, fadeOf(k.v, k.w * k.s, k.h * k.s, k.cl), ease);
    for (const p of pills) { p.v.copy(p.pos).applyMatrix4(m); place(p, fadeOf(p.v, p.w, p.h, null) * 0.95, ease); }
  }
  let blobK = dark ? 1.7 : 1; // the palette glows a little brighter at night
  let repainting = false;
  async function setDark(on) {
    dark = !!on;
    blobK = dark ? 1.7 : 1;
    for (const f of frames) {
      const pp = paper(f.cl, dark);
      f.u.uFill.value.set(...pp.fill); f.u.uFillA.value = pp.fillA;
      f.u.uBarC.value.set(...pp.bar); f.u.uLine.value.set(...pp.line);
    }
    stale = true;
    // the atlas has the name's line in ink; at night it's light. same items, same packing, new paint
    if (atlas && !repainting) {
      repainting = true;
      try {
        const items = [...cards.map((k) => ({ id: k.n.id, node: k.n })), ...titles.map((t) => ({ id: `title:${t.c.id}`, node: { type: 'ftitle', text: t.c.title, color: t.c.color } })), ...labelled.map(([a, b, text]) => ({ id: `pill:${a}|${b}`, node: { type: 'pill', text } }))];
        const next = await paintAtlas(items, { dark, scale: atlas.scale });
        next.pages.forEach((c, i) => { if (spriteTex[i]) { spriteTex[i].image = c; spriteTex[i].needsUpdate = true; } });
        atlas.pages = next.pages;
        stale = true;
      } finally { repainting = false; }
    }
  }
  function updateBlobs() {
    for (const b of blobs) {
      const d = b.sp.position.distanceTo(camera.position);
      b.sp.material.opacity = b.o * blobK * sstep(b.s * 0.18, b.s * 0.5, d);
    }
  }

  let intro = null;
  function tick(dt) {
    if (scroll) followPath();
    else {
      if (intro && intro.frames-- <= 0) {
        const home = stopShot(me);
        intro = null;
        if (!reduce) flyTo(home.pos, home.look, { dur: 2.5, arc: 0.04, ease: easeOut, onDone: () => grunts?.setGuideMood('happy') });
      }
      updateTour();
      updateControls(dt);
    }
    camera.position.copy(ctl.pos);
    camera.rotation.set(ctl.pitch, ctl.yaw, 0, 'YXZ');
    camera.updateMatrixWorld();
    const m = camera.matrixWorldInverse;
    for (const k of cards) k.v.copy(k.pos).applyMatrix4(m);
    updateFrames();
    updateCards(dt);
    updateBlobs();
    lineMat.uniforms.uTime.value = now;
    dotMat.uniforms.uTime.value = reduce ? 0 : now;
    if (pointer.active && now - pointer.at > 5) pointer.active = false;
    grunts?.update(dt, now, { vw, vh, pointer });
    gl.render(scene, camera);
    css.render(cssScene, camera);
  }
  const perf = { ms: 0, n: 0 };

  // start: far out, then in to the name. reduced motion starts there
  const home = stopShot(me);
  if (scroll) { buildPath(); followPath(); }
  else if (reduce) setPose(home.pos, home.look);
  else {
    setPose(START.pos, START.look);
    intro = { frames: 3 };
  }
  camera.position.copy(ctl.pos);
  camera.rotation.set(ctl.pitch, ctl.yaw, 0, 'YXZ');
  camera.updateMatrixWorld();
  await nextFrame(); // the shaders compile in their own frame, not on the tail of the build
  gl.compile(scene, camera);
  if (scroll) {
    // and the first frame is drawn now, while the section is still off screen: a software
    // renderer's first draw of each program is its slowest, better here than mid-scroll
    await nextFrame();
    now = performance.now() / 1000;
    tick(0);
  }

  let raf = 0, last = 0;
  function loop(ms) {
    raf = requestAnimationFrame(loop);
    const t = ms / 1000;
    const dt = last ? clamp(t - last, 0, 0.05) : 1 / 60;
    last = t;
    now = t;
    const t0 = performance.now();
    tick(dt);
    perf.ms += performance.now() - t0;
    perf.n++;
  }
  const run = () => { if (!raf) { last = 0; raf = requestAnimationFrame(loop); } };
  const halt = () => { cancelAnimationFrame(raf); raf = 0; };
  // free mode draws whenever the tab is visible; in scroll mode the section decides (start / stop)
  if (!scroll) {
    document.addEventListener('visibilitychange', () => (document.hidden ? halt() : run()));
    if (!document.hidden) run();
  }

  function resize() {
    [vw, vh] = viewSize();
    camera.aspect = vw / vh;
    camera.updateProjectionMatrix();
    tanH = tanV * camera.aspect;
    gl.setSize(vw, vh, false);
    css.setSize(vw, vh);
    lineMat.uniforms.uRes.value.set(vw * dpr, vh * dpr);
    dotMat.uniforms.uScale.value = (vh * dpr) / 2 / tanV;
  }
  if (!scroll) addEventListener('resize', resize);
  else {
    // the stage, not the window: the shots are framed for its size, so the flight is re-planned too
    let seen = `${vw}x${vh}`;
    const ro = new ResizeObserver(() => {
      const [w, h] = viewSize();
      if (!w || !h || `${w}x${h}` === seen) return;
      seen = `${w}x${h}`;
      resize();
      buildPath();
      if (!raf) stale = true; // the canvas was cleared; start() or renderOnce() draws it again
    });
    ro.observe(stage);
  }

  if (scroll) {
    // the fly-through's controls. nothing here listens to the page; js/fly.js calls in
    return {
      start: () => { run(); stale = false; },
      stop: halt,
      setRunning: (on) => (on ? (run(), (stale = false)) : halt()),
      setProgress: (p) => { path.p = clamp(+p || 0, 0, 1); },
      setDark,
      renderOnce: () => { if (!raf) { now = performance.now() / 1000; tick(0); stale = false; } },
      get running() { return !!raf; },
      get progress() { return path.p; },
      get stale() { return stale; },
      // where the boards sit along the flight, for the section's captions and tools/shots-fly.mjs
      get stops() { return path.stops.map((s) => ({ id: s.id, title: s.title, at: +s.at.toFixed(4) })); },
      get pose() { return { pos: ctl.pos.toArray().map(Math.round), yaw: +ctl.yaw.toFixed(3), pitch: +ctl.pitch.toFixed(3) }; },
      perf() { const r = perf.n ? perf.ms / perf.n : 0; perf.ms = 0; perf.n = 0; return r; },
    };
  }

  const api = {
    focusNode,
    tourGo,
    tourNext: () => tourGo(tour.i + 1),
    tourPrev: () => tourGo(tour.i - 1),
    tourToggle: () => (tour.on ? stopTour() : tourGo(tour.i + 1)),
    stopTour,
    escape: () => { stopTour(); setFocus(null); },
    highlight,
    searching: (on) => grunts?.setGuideMood(on ? 'searching' : 'idle'),
    get busy() { return !!ctl.flight || !!intro; },
    // average js time per frame since the last read, for tools/shots-map.mjs
    perf() { const r = perf.n ? perf.ms / perf.n : 0; perf.ms = 0; perf.n = 0; return r; },
    get tour() { return { on: tour.on, i: tour.i, arrived: !!tour.arrived }; },
    get pose() { return { pos: ctl.pos.toArray().map(Math.round), yaw: +ctl.yaw.toFixed(3), pitch: +ctl.pitch.toFixed(3) }; },
    get focused() { return focused?.n.id || null; },
    get moods() { return grunts ? grunts.grunts.map((g) => g.eng.state) : []; },
  };
  return api;
}
