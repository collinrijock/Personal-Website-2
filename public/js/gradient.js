// gradient.js — the sky, and later the horizon.
// a plane, gently displaced by simplex noise, coloured by four noise fields
// laid over a base colour (the stripe recipe), then lit like satin. the
// height field also draws faint contour lines, brighter near the cursor,
// and clicks send ripples across it.
//
// the canvas fills the hero and fades out toward its bottom edge. (setScroll can
// still tilt the plane back into a floor; the page doesn't use it any more.)
import * as THREE from 'three';

// ashima / stefan gustavson 3d simplex noise (mit)
const NOISE = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

const SHARED = /* glsl */ `
uniform float uTime;      // seconds
uniform float uAspect;    // viewport width / height
uniform float uSpan;      // the plane is uSpan times bigger than the view, so a tilt never shows its edge
uniform vec2 uPointer;    // plane uv
uniform float uPointerAmt;
uniform vec4 uRipples[4]; // x, y, start time, strength
`;

const VERT = /* glsl */ `
${SHARED}
uniform float uAmp;
uniform vec3 uBase;
uniform vec3 uColors[4];
out vec3 vColor;
out vec3 vNormal;
out float vH;
out vec2 vUv;
${NOISE}

// band uv -> a flow space that runs on a slight diagonal, like the band itself
vec2 flow(vec2 uv) {
  vec2 p = vec2(uv.x * uAspect, uv.y) * uSpan;
  return mat2(0.95, -0.31, 0.31, 0.95) * p;
}

float heightAt(vec2 uv) {
  float t = uTime * 0.07;
  vec2 p = flow(uv);
  float h = snoise(vec3(p * vec2(0.75, 1.35) + vec2(-t * 0.9, t * 0.25), t * 0.6)) * 0.62;
  h += snoise(vec3(p * vec2(1.9, 2.6) + vec2(t * 0.5, -t * 0.2), t * 0.9 + 7.3)) * 0.2;
  // the cursor lifts a soft hill
  vec2 dp = (uv - uPointer) * vec2(uAspect, 1.0) * uSpan;
  h += uPointerAmt * 0.42 * exp(-dot(dp, dp) * 7.0);
  // ripples: a ring that travels out and fades
  for (int i = 0; i < 4; i++) {
    vec4 r = uRipples[i];
    if (r.w <= 0.0) continue;
    float age = uTime - r.z;
    if (age < 0.0 || age > 5.0) continue;
    float d = length((uv - r.xy) * vec2(uAspect, 1.0) * uSpan);
    float front = age * 0.5;
    float x = d - front;
    h += r.w * 0.2 * sin(x * 26.0) * exp(-x * x * 30.0) * exp(-age * 0.75);
  }
  return h;
}

// the colour fields, mixed in oklab so crossings stay clean instead of going muddy.
// uBase and uColors arrive already converted to oklab (see toOklab below).
const vec4 LO = vec4(0.24, 0.43, 0.52, 0.67);
const vec4 HI = vec4(0.62, 0.80, 0.85, 0.88);
vec3 fields(vec2 uv) {
  float t = uTime * 0.07;
  vec2 p = flow(uv);
  vec3 c = uBase;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    // long, soft bands that lean with the band's edge
    vec2 f = vec2(0.34 + fi * 0.09, 0.85 + fi * 0.16);
    float n = snoise(vec3(p.x * f.x - t * (0.6 + fi * 0.15), p.y * f.y + t * (0.1 + fi * 0.04), t * (0.45 + fi * 0.08) + fi * 11.7));
    n = smoothstep(LO[i], HI[i], n * 0.5 + 0.5);
    c = mix(c, uColors[i], n);
  }
  return c;
}

void main() {
  vUv = uv;
  float h = heightAt(uv);
  float e = 0.0035 / uSpan;
  float hx = heightAt(uv + vec2(e, 0.0));
  float hy = heightAt(uv + vec2(0.0, e));
  // world space: the plane spans 2 * aspect * span by 2 * span
  vec3 dx = vec3(2.0 * uAspect * uSpan * e, 0.0, (hx - h) * uAmp);
  vec3 dy = vec3(0.0, 2.0 * uSpan * e, (hy - h) * uAmp);
  vNormal = normalize(cross(dx, dy));
  vH = h;
  vColor = fields(uv);
  vec3 pos = position;
  pos.z += h * uAmp;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
${SHARED}
uniform float uLines;
uniform float uScroll;    // 0 hero, 1 horizon
uniform vec2 uRes;        // drawing buffer size
in vec3 vColor;
in vec3 vNormal;
in float vH;
in vec2 vUv;
out vec4 fragColor;

uniform float uChroma;
vec3 oklabToLinear(vec3 c) {
  float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  float l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  return vec3(
     4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
}
vec3 linearToSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 L = normalize(vec3(-0.5, 0.6, 0.62));
  vec3 lab = vColor;
  lab.yz *= uChroma; // mixing two far-apart hues dips in chroma; lift it back a little
  vec3 col = linearToSrgb(oklabToLinear(lab));

  // satin: a soft key from the upper left and a narrow sheen
  float diff = dot(n, L);
  col *= 0.8 + 0.3 * diff;
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float sheen = pow(max(dot(n, H), 0.0), 48.0);
  col += sheen * 0.22;

  // contours of the height field. faint everywhere, clear near the cursor
  float k = vH * 15.0;
  float w = fwidth(k);
  float dist = 0.5 - abs(fract(k) - 0.5);
  float line = 1.0 - smoothstep(0.0, w * 1.25, dist);
  vec2 dp = (vUv - uPointer) * vec2(uAspect, 1.0) * uSpan;
  float near = exp(-dot(dp, dp) * 5.0) * uPointerAmt;
  // on the horizon the contours carry the shape, so they come up a little
  col = mix(col, vec3(1.0), line * uLines * (0.06 + 0.16 * uScroll + 0.5 * near));

  // a little grain, so the long ramps never band
  col += (hash(gl_FragCoord.xy + fract(uTime * 13.1) * 311.0) - 0.5) * (3.0 / 255.0);

  // the fade: hero = opaque at the top, gone by the bottom. horizon = the reverse, low and soft
  float y = gl_FragCoord.y / uRes.y;
  float hero = smoothstep(0.04, 0.46, y);
  float floorFade = 1.0 - smoothstep(0.1, 0.36, y);
  float a = mix(hero, floorFade, smoothstep(0.0, 1.0, uScroll));
  col = clamp(col, 0.0, 1.0);
  fragColor = vec4(col * a, a); // premultiplied
}
`;

// palette hexes -> oklab. the shader mixes there and converts back to srgb itself
export const hex3 = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
export function toOklab(hex) {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = hex3(hex).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

const SPAN = 1.7;
const FOV = 30;
const DIST = 1 / Math.tan((FOV / 2) * Math.PI / 180); // the view is exactly 2 units tall at z = 0

export function createGradient(canvas, { palette, still = false, onFirstFrame } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 60);
  camera.position.set(0, 0, DIST);
  const scene = new THREE.Scene();

  const cur = { base: toOklab(palette.base), colors: palette.colors.map(toOklab) };
  const tgt = { base: [...cur.base], colors: cur.colors.map((c) => [...c]) };
  const uniforms = {
    uTime: { value: 0 },
    uAspect: { value: 1 },
    uSpan: { value: SPAN },
    uPointer: { value: new THREE.Vector2(0.5, 0.5) },
    uPointerAmt: { value: 0 },
    uRipples: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, -99, 0)) },
    uAmp: { value: 0.5 },
    uLines: { value: 1 },
    uChroma: { value: 1.12 },
    uScroll: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uBase: { value: new THREE.Vector3(...cur.base) },
    uColors: { value: cur.colors.map((c) => new THREE.Vector3(...c)) },
  };
  const material = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, premultipliedAlpha: true });
  let mesh = null, aspect = 1;

  function build() {
    mesh?.geometry.dispose();
    if (mesh) scene.remove(mesh);
    // enough vertices that colour and contours stay smooth across the bigger plane
    const sx = Math.round(Math.min(320, 150 * Math.max(1, aspect))), sy = 170;
    mesh = new THREE.Mesh(new THREE.PlaneGeometry(2 * aspect * SPAN, 2 * SPAN, sx, sy), material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    pose();
  }

  // scroll: 0 = the plane faces you and fills the hero; 1 = tilted back into a floor
  let scroll = 0, scrollTarget = 0;
  function pose() {
    if (!mesh) return;
    const e = scroll * scroll * (3 - 2 * scroll);
    mesh.rotation.x = -1.2 * e;
    mesh.position.y = -1.06 * e;
    mesh.position.z = 0.1 * e;
    mesh.updateMatrixWorld();
    uniforms.uScroll.value = e;
    uniforms.uAmp.value = 0.5 + 0.22 * e;
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(w, h, false);
    renderer.getDrawingBufferSize(uniforms.uRes.value);
    const a = w / h;
    camera.aspect = a;
    camera.updateProjectionMatrix();
    uniforms.uAspect.value = a;
    if (Math.abs(a - aspect) > 0.01 || !mesh) { aspect = a; build(); }
    if (!running) render();
  }

  // screen -> plane uv, by intersecting the view ray with the (flat) plane
  const ray = new THREE.Raycaster();
  const inv = new THREE.Matrix4();
  const o = new THREE.Vector3(), d = new THREE.Vector3();
  function uvAt(nx, ny) {
    ray.setFromCamera({ x: nx, y: ny }, camera);
    inv.copy(mesh.matrixWorld).invert();
    o.copy(ray.ray.origin).applyMatrix4(inv);
    d.copy(ray.ray.direction).transformDirection(inv);
    if (Math.abs(d.z) < 1e-5) return null;
    const t = -o.z / d.z;
    if (t <= 0) return null;
    const px = o.x + d.x * t, py = o.y + d.y * t;
    const u = px / (2 * aspect * SPAN) + 0.5, v = py / (2 * SPAN) + 0.5;
    return u < 0 || u > 1 || v < 0 || v > 1 ? null : [u, v];
  }

  // pointer, eased so the hill glides
  const ptr = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, amt: 0, tamt: 0 };
  let rippleSlot = 0;

  let running = false, raf = 0, last = performance.now(), time = 8 + Math.random() * 40, first = true;
  function step(dt) {
    const k = 1 - Math.pow(0.0015, dt);
    ptr.x += (ptr.tx - ptr.x) * k * 0.9;
    ptr.y += (ptr.ty - ptr.y) * k * 0.9;
    ptr.amt += (ptr.tamt - ptr.amt) * k * 0.6;
    uniforms.uPointer.value.set(ptr.x, ptr.y);
    uniforms.uPointerAmt.value = ptr.amt;
    scroll += (scrollTarget - scroll) * Math.min(1, k * 1.4);
    pose();
    // palette crossfade
    const kc = 1 - Math.pow(0.02, dt);
    for (let i = 0; i < 3; i++) cur.base[i] += (tgt.base[i] - cur.base[i]) * kc;
    uniforms.uBase.value.set(...cur.base);
    cur.colors.forEach((c, j) => { for (let i = 0; i < 3; i++) c[i] += (tgt.colors[j][i] - c[i]) * kc; uniforms.uColors.value[j].set(...c); });
    uniforms.uTime.value = time;
  }
  function render() {
    renderer.render(scene, camera);
    if (first) { first = false; onFirstFrame?.(); }
  }
  function loop(now) {
    raf = running ? requestAnimationFrame(loop) : 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    step(dt);
    render();
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();
  step(1);
  render();

  const redrawIfStill = () => { if (!running) { step(1); render(); } };
  return {
    setRunning(on) {
      if (still) on = false;
      if (on === running) return;
      running = on;
      if (on) { last = performance.now(); raf = requestAnimationFrame(loop); } else if (raf) { cancelAnimationFrame(raf); raf = 0; }
    },
    // 0 at the top of the page, 1 once the hero has scrolled away
    setScroll(s) { scrollTarget = Math.min(1, Math.max(0, s)); if (still) { scroll = scrollTarget; redrawIfStill(); } },
    // pointer in normalised device coords (-1..1, y up), or null when it leaves
    setPointer(nx, ny) {
      const uv = nx == null ? null : uvAt(nx, ny);
      if (!uv) { ptr.tamt = 0; return; }
      ptr.tx = uv[0]; ptr.ty = uv[1]; ptr.tamt = 1;
      if (ptr.amt < 0.02) { ptr.x = uv[0]; ptr.y = uv[1]; } // enter where you are, don't slide in from the last spot
      if (still) redrawIfStill();
    },
    ripple(nx, ny, strength = 1) {
      const uv = uvAt(nx, ny);
      if (!uv) return;
      uniforms.uRipples.value[rippleSlot].set(uv[0], uv[1], time, strength);
      rippleSlot = (rippleSlot + 1) % 4;
    },
    setPalette(p, { instant = false } = {}) {
      tgt.base = toOklab(p.base);
      tgt.colors = p.colors.map(toOklab);
      if (instant || still) { cur.base = [...tgt.base]; cur.colors = tgt.colors.map((c) => [...c]); redrawIfStill(); }
    },
    renderOnce() { step(1); render(); },
    dispose() { running = false; cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); },
  };
}
