// map-layout.js — where things go. seeded, so the map is the same every visit.

export function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rng(seed) {
  let a = typeof seed === 'number' ? seed >>> 0 : hash(String(seed));
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * lay a cluster's cards out on its board: a sunflower scatter with seeded jitter,
 * then a relaxation pass that pushes overlapping rectangles apart while a weak pull
 * keeps the cluster tight. items are { w, h, pin?: [x, y] }; x and y (centres, y up) are written back.
 */
export function relax(items, { aspect = 1.3, gap = 30, seed = 'x' } = {}) {
  const rand = rng(seed);
  const n = items.length;
  const area = items.reduce((s, it) => s + (it.w + gap) * (it.h + gap), 0);
  const R = Math.sqrt(area / Math.PI);
  const sa = Math.sqrt(aspect);
  items.forEach((it, i) => {
    if (it.pin) { it.x = it.pin[0]; it.y = it.pin[1]; return; }
    const r = R * Math.sqrt((i + 0.5) / n) * (0.75 + rand() * 0.4);
    const a = i * 2.39996323 + (rand() - 0.5) * 0.9;
    it.x = Math.cos(a) * r * sa;
    it.y = Math.sin(a) * r / sa;
  });

  const PULL_UNTIL = 380;
  for (let k = 0; k < 900; k++) {
    let hits = 0;
    for (let i = 0; i < n; i++) {
      const A = items[i];
      for (let j = i + 1; j < n; j++) {
        const B = items[j];
        if (A.pin && B.pin) continue;
        const dx = B.x - A.x, dy = B.y - A.y;
        const ox = (A.w + B.w) / 2 + gap - Math.abs(dx);
        if (ox <= 0) continue;
        const oy = (A.h + B.h) / 2 + gap - Math.abs(dy);
        if (oy <= 0) continue;
        hits++;
        const wa = A.pin ? 0 : B.pin ? 1 : 0.5, wb = 1 - wa;
        // part along the cheaper axis; a little extra so it settles instead of buzzing
        if (ox < oy) {
          const s = Math.sign(dx) || (rand() < 0.5 ? -1 : 1), m = ox * 1.02;
          A.x -= s * m * wa; B.x += s * m * wb;
        } else {
          const s = Math.sign(dy) || (rand() < 0.5 ? -1 : 1), m = oy * 1.02;
          A.y -= s * m * wa; B.y += s * m * wb;
        }
      }
    }
    if (k < PULL_UNTIL) {
      const p = 0.014 * (1 - k / PULL_UNTIL);
      for (const it of items) if (!it.pin) { it.x -= it.x * p; it.y -= it.y * p * aspect; }
    } else if (!hits) break;
  }

  // centre the board on its bounding box, unless something is pinned to the origin
  const b = bounds(items);
  if (!items.some((it) => it.pin)) {
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    for (const it of items) { it.x -= cx; it.y -= cy; }
    return bounds(items);
  }
  return b;
}

export function bounds(items) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const it of items) {
    x0 = Math.min(x0, it.x - it.w / 2); x1 = Math.max(x1, it.x + it.w / 2);
    y0 = Math.min(y0, it.y - it.h / 2); y1 = Math.max(y1, it.y + it.h / 2);
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

/** a single thread through a cluster: greedy nearest neighbour from the first card. */
export function thread(items) {
  const n = items.length;
  if (n < 2) return [];
  const used = new Array(n).fill(false);
  used[0] = true;
  const pairs = [];
  let cur = 0;
  for (let step = 1; step < n; step++) {
    let best = -1, bd = Infinity;
    for (let j = 0; j < n; j++) {
      if (used[j]) continue;
      const d = (items[j].x - items[cur].x) ** 2 + (items[j].y - items[cur].y) ** 2;
      if (d < bd) { bd = d; best = j; }
    }
    used[best] = true;
    pairs.push([cur, best]);
    cur = best;
  }
  return pairs;
}
