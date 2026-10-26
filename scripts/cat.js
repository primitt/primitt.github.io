// Shared ASCII calico cat, drawn as chunky tiles on a canvas the way the koi on daoho.dev are
// (github.com/Dao-Ho/portfolio, koi-pond/renderer.ts). The shimmer comes from the same tricks:
//  - the cat is a blend of round shapes in float space, re-rasterised every frame into big cells
//  - 5 samples per cell: edge cells become dim, partial tiles flecked with dots
//  - glyphs are hashed from part-local coords finer than a cell, so they flicker as the cat moves
//  - fur is etched in 1s and 0s; tiles glint (and flip their bit) on a staggered clock, the body casts a ':' shadow, whiskers are line glyphs
// Used by loader.js (the stretching cat) and cat-pen.js (the cat at the bottom of the page).
window.AsciiCat = (() => {
const CW = 14, CH = 16, GROUND = 296;
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const smooth = u => u * u * (3 - 2 * u);
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const hash = (a, b, c) => {
  let h = (a * 374761393 + b * 668265263 + c * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};
// Smooth 1D value noise in -1..1; each seed is an independent wandering curve.
const noise1 = (x, seed) => {
  const i = Math.floor(x), a = hash(i, seed, 3) / 4294967296, b = hash(i + 1, seed, 3) / 4294967296;
  return (a + (b - a) * smooth(x - i)) * 2 - 1;
};

// Site palette (DaisyUI "black" theme): grey/white fur on black, patches in the site's blue-400/purple-400 accents.
const BG = [0, 0, 0], WHITE = [229, 231, 235], BLACK = [107, 114, 128], ACCENT = "accent";
const EYE = [20, 20, 26], IRIS = [96, 165, 250], NOSE = [216, 180, 254], GREY = [156, 163, 175];
// Accent patches shade from deep indigo in shadow through blue-400 to purple-400 where the light hits.
const ACCENT_RAMP = [[30, 27, 75], [37, 99, 235], [96, 165, 250], [167, 139, 250], [192, 132, 252], [233, 213, 255]];
const TILE = [0.68, 0.98], INK = 0.42, DIM = 0.85;
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const rgb = c => `rgb(${Math.min(255, c[0]) | 0},${Math.min(255, c[1]) | 0},${Math.min(255, c[2]) | 0})`;
function ramp(t) {
  const x = clamp(t) * (ACCENT_RAMP.length - 1), i = Math.min(ACCENT_RAMP.length - 2, Math.floor(x));
  return mix(ACCENT_RAMP[i], ACCENT_RAMP[i + 1], x - i);
}
function lineGlyph(dx, dy) {
  const d = Math.hypot(dx, dy) || 1;
  if (Math.abs(dy) < 0.38 * d) return "-";
  if (Math.abs(dx) < 0.38 * d) return "|";
  return dx * dy > 0 ? "\\" : "/";
}

// ── poses ────────────────────────────────────────────────────────────
// A rig is named keypoints in cat space: facing right, x = 0 near the middle, paws on y = GROUND.
// Tail points t0..t3 are bezier controls relative to the hip; knee/hock are relative to the hind paw.
// sway/breath are animation amplitudes, squint closes the eyes.
const POSES = {
  stand: {
    H: [-100, 166], C: [56, 164], Hd: [118, 112], haunch: [-94, 180], chest: [48, 178],
    fTop: [50, 190], hTop: [-94, 190], fp: [54, 296], ffp: [70, 296], hp: [-96, 296], fhp: [-80, 296],
    knee: [14, -70], hock: [-12, -30], t0: [-34, -10], t1: [-120, 16], t2: [-150, -70], t3: [-112, -104],
    sway: 14, breath: 1.5, squint: 0,
  },
  // Play-bow: rear up, chest down, front legs reaching forward along the ground.
  stretch: {
    H: [-114, 142], C: [50, 232], Hd: [140, 222], haunch: [-108, 156], chest: [50, 246],
    fTop: [60, 248], hTop: [-108, 166], fp: [170, 296], ffp: [186, 296], hp: [-120, 296], fhp: [-104, 296],
    knee: [14, -70], hock: [-12, -30], t0: [-30, -16], t1: [-80, -50], t2: [-100, -120], t3: [-58, -132],
    sway: 14, breath: 0, squint: 1,
  },
  // Sitting upright: haunches on the ground, front legs straight, tail wrapped forward along the floor.
  sit: {
    H: [-60, 236], C: [20, 168], Hd: [70, 96], haunch: [-62, 256], chest: [26, 190],
    fTop: [30, 200], hTop: [-62, 258], fp: [40, 296], ffp: [54, 296], hp: [-10, 296], fhp: [4, 296],
    knee: [-40, -40], hock: [-56, -6], t0: [-30, 10], t1: [-60, 52], t2: [10, 62], t3: [80, 56],
    sway: 6, breath: 1.5, squint: 0,
  },
  // Loaf with front paws out and head up, tail lying behind.
  lie: {
    H: [-100, 250], C: [50, 252], Hd: [112, 196], haunch: [-96, 262], chest: [50, 266],
    fTop: [60, 270], hTop: [-96, 268], fp: [140, 296], ffp: [156, 296], hp: [-40, 296], fhp: [-24, 296],
    knee: [-30, -24], hock: [-70, -6], t0: [-34, 0], t1: [-100, 40], t2: [-150, 46], t3: [-196, 30],
    sway: 8, breath: 1.5, squint: 0,
  },
  // Curled up asleep: head down on the paws, tail tucked under, slow deep breaths.
  sleep: {
    H: [-90, 254], C: [40, 256], Hd: [118, 250], haunch: [-86, 264], chest: [44, 268],
    fTop: [56, 272], hTop: [-86, 270], fp: [120, 296], ffp: [136, 296], hp: [-40, 296], fhp: [-24, 296],
    knee: [-30, -24], hock: [-70, -6], t0: [-34, 6], t1: [-90, 50], t2: [-20, 48], t3: [60, 44],
    sway: 2, breath: 3, squint: 1,
  },
};

// Blend two rigs; the head and tail can trail the body by passing their own progress.
const HEAD = new Set(["Hd", "squint"]), TAIL = new Set(["t0", "t1", "t2", "t3", "sway"]);
function lerpRig(a, b, t, tHead = t, tTail = t) {
  const out = {};
  for (const k in a) {
    const u = HEAD.has(k) ? tHead : TAIL.has(k) ? tTail : t;
    out[k] = typeof a[k] === "number" ? a[k] + (b[k] - a[k]) * u : [a[k][0] + (b[k][0] - a[k][0]) * u, a[k][1] + (b[k][1] - a[k][1]) * u];
  }
  return out;
}

// One stretch as a continuous 0..1..0 curve over `period` ms: stand, ease into the bow, ease back.
function stretchAt(time, period = 3200) {
  const u = 0.5 - 0.5 * Math.cos((time / period) * Math.PI * 2);
  return smooth(clamp((u - 0.08) / 0.84));
}

// One paw of a diagonal walk: slides back while planted, lifts and swings forward.
const foot = (ax, phase) => [ax + 24 * Math.sin(phase), GROUND - Math.max(0, Math.cos(phase)) * 14];
// Standing rig with the legs walking and a little bob; planted paws slide back at WALK_SPEED.
const WALK_SPEED = 0.096; // cat-space px per ms: 48px of stride per half step
function walkRig(time) {
  const ph = (time / 1000) * Math.PI * 2, bob = Math.sin(ph * 2) * 2.5, s = POSES.stand;
  const rig = { ...s, fp: foot(s.fp[0], ph), ffp: foot(s.ffp[0], ph + Math.PI), hp: foot(s.hp[0], ph + Math.PI), fhp: foot(s.fhp[0], ph) };
  for (const k of ["H", "C", "Hd", "haunch", "chest", "fTop", "hTop"]) rig[k] = [s[k][0], s[k][1] + bob];
  return rig;
}

// ── shapes ───────────────────────────────────────────────────────────
// A part is a tapered capsule a->b (radius ra->rb); a circle is a capsule with a === b.
// s0..s1 is how far along a longer limb (the tail) the part sits.
const cap = (id, a, b, ra, rb = ra, s0 = 0, s1 = 1) => ({ id, a, b, ra, rb, s0, s1 });
function frontLeg(id, top, p) {
  const wrist = [p[0] - 2, p[1] - 18];
  return [cap(id, top, wrist, 17, 13), cap(id, wrist, [p[0] + 6, p[1] - 7], 12, 11)];
}
function hindLeg(id, top, p, kneeO, hockO) {
  const knee = [p[0] + kneeO[0], p[1] + kneeO[1]], hock = [p[0] + hockO[0], p[1] + hockO[1]];
  return [cap(id, top, knee, 26, 15), cap(id, knee, hock, 13, 11), cap(id, hock, [p[0] + 5, p[1] - 7], 11)];
}

function parts(rig, time) {
  const br = Math.sin(time / 700) * rig.breath;
  const up = p => [p[0], p[1] + br];
  const H = up(rig.H), C = up(rig.C), Hd = up(rig.Hd), haunch = up(rig.haunch), chest = up(rig.chest);
  const fTop = up(rig.fTop), hTop = up(rig.hTop);
  const flickT = time % 3700, flick = flickT < 260 ? Math.sin((flickT / 260) * Math.PI) : 0;

  // Tail: a cubic bezier of tapering segments. The tip wanders on smooth noise, so it never loops:
  // lazy sways, the middle bending on its own, the tip lifting, and now and then a burst of quick flicks.
  const ts = time / 1000;
  const flicking = Math.max(0, noise1(ts * 0.3, 5) - 0.45) * 1.8;
  const sway = rig.sway * 1.4 * (0.75 * noise1(ts * 0.6, 1) + 0.25 * noise1(ts * 2.2, 2) + flicking * Math.sin(time / 110) * 0.5);
  const mid = rig.sway * 0.4 * noise1(ts * 0.45, 7), lift = rig.sway * 0.6 * noise1(ts * 0.35, 9);
  const T = [rig.t0, rig.t1, rig.t2, rig.t3].map((o, i) =>
    [H[0] + o[0] + [0, 0, mid + sway * 0.3, sway][i], H[1] + o[1] + (i === 3 ? lift : 0)]);
  const tail = [], N = 14;
  for (let i = 0; i <= N; i++) {
    const u = i / N, v = 1 - u;
    tail.push([0, 1].map(k => v ** 3 * T[0][k] + 3 * v * v * u * T[1][k] + 3 * v * u * u * T[2][k] + u ** 3 * T[3][k]));
  }

  const near = [
    cap(0, H, C, 38, 40),                                            // body
    cap(1, haunch, haunch, 32),                                      // haunch
    cap(2, chest, chest, 28),                                        // chest
    cap(3, C, Hd, 26, 24),                                           // neck
    cap(4, Hd, Hd, 40),                                              // head
    cap(5, [Hd[0] + 32, Hd[1] + 14], [Hd[0] + 32, Hd[1] + 14], 20),  // muzzle
    cap(6, [Hd[0] - 20, Hd[1] - 24], [Hd[0] - 30, Hd[1] - 74], 20, 5), // far ear
    cap(7, [Hd[0] + 10, Hd[1] - 28], [Hd[0] + 14 - flick * 16, Hd[1] - 78 + flick * 8], 20, 5), // near ear
    ...tail.slice(1).map((q, i) => cap(8, tail[i], q, 16 - (i / N) * 5, 16 - ((i + 1) / N) * 5, i / N, (i + 1) / N)),
    ...frontLeg(10, fTop, rig.fp),
    ...hindLeg(11, hTop, rig.hp, rig.knee, rig.hock),
  ];
  // Far-side legs sit a little forward and behind the body, drawn darker.
  const far = [
    ...frontLeg(20, [fTop[0] + 16, fTop[1]], rig.ffp),
    ...hindLeg(21, [hTop[0] + 16, hTop[1]], rig.fhp, rig.knee, rig.hock),
  ];
  return { near, far, H, Hd, squint: rig.squint > 0.85, eye: [Hd[0] + 20, Hd[1] - 6], nose: [Hd[0] + 48, Hd[1] + 6] };
}

// Signed distance to a set of parts (smooth-blended if k), recording the closest part in `hit`.
const hit = { part: null, s: 0, across: 0, nx: 0, ny: 0, lx: 0, ly: 0 };
function field(px, py, parts, k) {
  let blend = 1e9, best = 1e9;
  for (const p of parts) {
    const dx = p.b[0] - p.a[0], dy = p.b[1] - p.a[1], len2 = dx * dx + dy * dy;
    const u = len2 ? clamp(((px - p.a[0]) * dx + (py - p.a[1]) * dy) / len2) : 0;
    const ox = px - p.a[0] - u * dx, oy = py - p.a[1] - u * dy, dist = Math.hypot(ox, oy);
    const r = p.ra + (p.rb - p.ra) * u, d = dist - r;
    blend = k ? smin(blend, d, k) : Math.min(blend, d);
    if (d < best) {
      best = d;
      hit.part = p;
      hit.s = p.s0 + (p.s1 - p.s0) * u;
      hit.across = clamp(dist / r);
      hit.nx = dist ? ox / dist : 0;
      hit.ny = dist ? oy / dist : -1;
      hit.lx = px - p.a[0];
      hit.ly = py - p.a[1];
    }
  }
  return blend;
}
const inside = (x, y, P) => field(x, y, P.near, 12) < 0 || field(x, y, P.far, 0) < 0;

const ell = (x, y, cx, cy, rx, ry, w) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1 + w;
// Calico markings pinned to the body (relative to the hip / head), with ragged edges.
function skinOf(part, x, y, P) {
  const id = part.id;
  if (id >= 10) return WHITE; // legs and paws
  const w = Math.sin(x * 0.11 + y * 0.07) * 0.2;
  if (id <= 3) {
    const bx = x - P.H[0], by = y - P.H[1];
    if (by > 24) return WHITE; // belly
    if (ell(bx, by, 40, -26, 58, 34, w)) return ACCENT;
    if (ell(bx, by, 128, -26, 36, 26, w)) return BLACK;
    if (ell(bx, by, -6, 14, 26, 26, w)) return ACCENT; // haunch
    return WHITE;
  }
  if (id === 4) {
    const hx = x - P.Hd[0], hy = y - P.Hd[1];
    return hx < -4 + 8 * Math.sin(hy * 0.15) && hy < 20 ? ACCENT : WHITE;
  }
  if (id === 6) return ACCENT;
  if (id === 7) return BLACK;
  if (id === 8) return part.s0 < 0.2 ? ACCENT : part.s0 > 0.8 ? BLACK : Math.floor(hit.s * 8) % 2 ? BLACK : ACCENT;
  return WHITE; // muzzle
}

// ── renderer ─────────────────────────────────────────────────────────
const SUB = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];

// Set up `canvas` as a cols x rows grid. Returns draw(rig, time, opts), where opts places the cat:
// x = canvas x of the cat's middle, ground = canvas y of its paws, dir = 1 (facing right) or -1,
// plus blink and zzz (sleeping z's). scale shrinks the cat while cells stay the same size.
function create(canvas, cols, rows, scale = 1) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2), N = cols * rows;
  canvas.width = cols * CW * dpr;
  canvas.height = rows * CH * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const FONT = `600 ${Math.round(CH * 0.72)}px ui-monospace, Menlo, monospace`;
  const THIN = `200 ${Math.round(CH * 0.6)}px ui-monospace, Menlo, monospace`;
  ctx.font = FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const cellGlyph = new Array(N), cellColor = new Array(N), cellAlpha = new Float32Array(N);
  const cellTile = new Array(N), cellTileAlpha = new Float32Array(N), cellShadow = new Uint8Array(N);
  const eyeR = Math.max(8, (0.55 * CW) / scale), noseR = Math.max(7, (0.5 * CW) / scale);

  return function draw(rig, time, { x: ox, ground, dir = 1, blink = false, zzz = false }) {
    const t = time / 1000, P = parts(rig, time);
    const lx = x => ((x - ox) * dir) / scale, ly = y => (y - ground) / scale + GROUND;
    const cellOf = (px, py) => {
      const c = Math.floor((ox + px * scale * dir) / CW), r = Math.floor((ground + (py - GROUND) * scale) / CH);
      return c < 0 || r < 0 || c >= cols || r >= rows ? -1 : r * cols + c;
    };
    cellGlyph.fill(""); cellTileAlpha.fill(0); cellShadow.fill(0);

    // The cat spans roughly 300 cat-space px either side of its middle; skip columns beyond that.
    const c0 = Math.max(0, Math.floor((ox - 320 * scale) / CW)), c1 = Math.min(cols - 1, Math.ceil((ox + 320 * scale) / CW));
    for (let r = 0; r < rows; r++) {
      for (let c = c0; c <= c1; c++) {
        const x = lx(c * CW + CW / 2), y = ly(r * CH + CH / 2);
        const dn = field(x, y, P.near, 12), df = field(x, y, P.far, 0);
        if (dn > CW / scale && df > CW / scale) continue; // too far for any sample to land inside

        let hits = dn < 0 || df < 0 ? 1 : 0;
        for (const [sx, sy] of SUB) if (inside(lx(c * CW + sx * CW), ly(r * CH + sy * CH), P)) hits++;
        if (!hits) continue;

        // Attributes come from the centre's closest part (re-read: the samples above clobbered `hit`).
        const isFar = dn >= 0 && df < dn;
        field(x, y, isFar ? P.far : P.near, 12);
        const part = hit.part, i = r * cols + c;
        const skin = skinOf(part, x, y, P);
        const facing = (-0.6 * hit.nx * dir - 0.8 * hit.ny) * hit.across; // lit from the top-left
        const lum = clamp(0.22 + 0.5 * Math.sqrt(1 - hit.across * hit.across) + 0.18 * facing);
        let tile;
        if (skin === ACCENT) {
          const sheen = Math.max(0, Math.sin(x * 0.035 - t * 1.8) - 0.7) / 0.3; // light sliding over fur
          tile = ramp(0.15 + 0.8 * lum + Math.sin(x * 0.05 + y * 0.09) * 0.08 + sheen * 0.35);
        } else {
          tile = mix(BG, skin, TILE[0] + (TILE[1] - TILE[0]) * lum);
        }
        if (isFar) tile = mix(BG, tile, 0.5);

        // Part-local key finer than a cell, so glyphs re-roll as the cat moves under the grid.
        const key = hash(part.id * 7 + (part.s0 * 14 | 0), Math.round(hit.lx / 5), Math.round(hit.ly / 5));
        let glyph = "", color = shade(tile, INK), alpha = DIM, tileAlpha;
        if (hits === 5) {
          if (r + 1 < rows && c + 1 < cols) cellShadow[i + cols + 1] = 1;
          tileAlpha = DIM;
          // Fur is etched in bits; a glint dims the tile and flips its bit.
          const glint = hash(key, Math.floor(t * 1.4 + (key % 997) / 97), 7) % 1000 < 30;
          glyph = ((key >>> 4) & 1) ^ glint ? "1" : "0";
          if (skin === WHITE) alpha *= 0.6; // white fur etched lightly so the patches carry the pattern
          if (glint) tile = mix(tile, BG, 0.45);

          if (part.id === 4 || part.id === 5) {
            if (Math.hypot(x - P.eye[0], y - P.eye[1]) < eyeR) {
              tile = mix(BG, EYE, 0.85); glyph = blink || P.squint ? "-" : "0"; color = IRIS; alpha = 1;
            } else if (Math.hypot(x - P.nose[0], y - P.nose[1]) < noseR) {
              tile = mix(BG, NOSE, 0.9); glyph = "v"; color = shade(NOSE, INK); alpha = 1;
            }
          }
        } else {
          tileAlpha = DIM * (hits / 5) * 0.55; // soft edge: pale tile, flecked with dots
          if (key % 3 === 0) glyph = ".";
        }
        cellTile[i] = tile; cellTileAlpha[i] = tileAlpha;
        cellGlyph[i] = glyph; cellColor[i] = color; cellAlpha[i] = alpha;
      }
    }

    ctx.clearRect(0, 0, cols * CW, rows * CH);
    const at = (i, glyph, color, alpha) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = rgb(color);
      ctx.fillText(glyph, (i % cols) * CW + CW / 2, ((i / cols) | 0) * CH + CH / 2 + 1);
    };
    const empty = i => !cellTileAlpha[i] && !cellGlyph[i];

    for (let i = 0; i < N; i++) if (cellShadow[i] && empty(i)) at(i, ":", BLACK, 0.45);

    const groundRow = Math.floor(ground / CH) + 1;
    for (let c = 0; groundRow < rows && c < cols; c++) {
      const i = groundRow * cols + c;
      if (c % 4 === 0 && empty(i) && !cellShadow[i]) at(i, ".", GREY, 0.5);
    }

    // Whiskers: short, faint, thin line glyphs fanning forward from the muzzle, like daoho's barbels.
    ctx.font = THIN;
    const m = [P.Hd[0] + 50, P.Hd[1] + 16], twitch = Math.sin(time / 420) * 2;
    for (const [ex, ey] of [[30, -8 + twitch], [34, twitch], [29, 8 + twitch]]) {
      for (let u = 0.4; u <= 1; u += 0.2) {
        const i = cellOf(m[0] + ex * u, m[1] + ey * u);
        if (i >= 0 && empty(i)) at(i, lineGlyph(ex * dir, ey), GREY, 0.35);
      }
    }
    ctx.font = FONT;

    // Sleeping z's drift up and back from the head, growing as they rise.
    for (let k = 0; zzz && k < 3; k++) {
      const age = ((t + k * 0.9) % 2.7) / 2.7;
      const i = cellOf(P.Hd[0] + 20 + age * 60, P.Hd[1] - 70 - age * 90);
      if (i >= 0 && empty(i)) at(i, age < 0.4 ? "z" : "Z", WHITE, DIM * Math.sin(age * Math.PI));
    }

    for (let i = 0; i < N; i++) {
      if (cellTileAlpha[i] > 0) {
        ctx.globalAlpha = cellTileAlpha[i];
        ctx.fillStyle = rgb(cellTile[i]);
        ctx.fillRect((i % cols) * CW + 1, ((i / cols) | 0) * CH + 1, CW - 1, CH - 1);
      }
      if (cellGlyph[i]) at(i, cellGlyph[i], cellColor[i], cellAlpha[i]);
    }
    ctx.globalAlpha = 1;
  };
}

// Night in Central Time (8pm-8am). ?cathour=22 in the URL pretends it's that hour, for testing.
const hourParam = new URLSearchParams(location.search).get("cathour");
const ctHour = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hourCycle: "h23" });
function isNight() {
  const h = hourParam !== null ? Number(hourParam) : Number(ctHour.format(new Date()));
  return h >= 20 || h < 8;
}

return { isNight, create, POSES, lerpRig, stretchAt, walkRig, WALK_SPEED, CW, CH, GROUND, clamp, smooth };
})();
