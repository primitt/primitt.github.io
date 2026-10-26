// The cat at the bottom of the main page, doing cat things on Central Time: curled up asleep from
// 8pm to 8am, otherwise mostly lying down, sometimes sitting up, now and then a short walk or a stretch.
// Uses the shared renderer in cat.js, which also owns isNight() and the ?cathour= test override.
(() => {
const { isNight, create, POSES, lerpRig, stretchAt, walkRig, WALK_SPEED, CW, CH, GROUND, clamp, smooth } = window.AsciiCat;
const canvas = document.getElementById("cat-pen");

let night = isNight();
setInterval(() => { night = isNight(); }, 30000);

// Fit the grid to the page width; smaller cat (same cell size, so chunkier) on narrow screens.
let draw, width, ground, margin, scale, x, mobile;
function resize() {
  const w = canvas.parentElement.clientWidth;
  mobile = w < 640;
  scale = mobile ? 0.55 : 0.8;
  const cols = Math.max(1, Math.floor(w / CW)), rows = Math.ceil((GROUND * scale + 24) / CH);
  canvas.style.width = cols * CW + "px";
  canvas.style.height = rows * CH + "px";
  draw = create(canvas, cols, rows, scale);
  width = cols * CW;
  ground = rows * CH - 22;
  margin = 300 * scale; // the cat reaches about 300 cat-space px either side of its middle
  const lo = margin, hi = Math.max(margin, width - margin);
  x = clamp(x ?? lo + Math.random() * (hi - lo), lo, hi); // random spot on load, kept across resizes
}
resize();
new ResizeObserver(resize).observe(canvas.parentElement);

// Behaviour: one activity at a time, blended in from wherever the cat was.
// Mostly a lazy cat: lying down is the favourite, then sitting, then a short walk; the odd stretch.
const WEIGHTS = [["lie", 5], ["sit", 3], ["walk", 2], ["stretch", 0.5]];
const DURATION = { lie: [60000, 120000], sit: [20000, 30000], walk: [5000, 10000], stretch: [3200, 3200] };
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
let act, prev, actStart, actDur, from, shown;
// dir is where the cat wants to face; face eases toward it, so turning swings round instead of snapping.
let dir = Math.random() < 0.5 ? -1 : 1, face = dir;

function start(name, now, dur = Infinity) {
  prev = act; act = name; actStart = now; actDur = dur;
  from = shown || POSES[name === "walk" || name === "stretch" ? "stand" : name];
}
function next(now) {
  if (night) return start("sleep", now);
  if (act === "sleep") return start("stretch", now, 3200); // waking up
  // On phones the cat stays put: only lying and sitting.
  const weights = mobile ? WEIGHTS.filter(([n]) => n === "lie" || n === "sit") : WEIGHTS;
  let r = Math.random() * weights.reduce((s, [, w]) => s + w, 0), name = "lie";
  for (const [n, w] of weights) if ((r -= w) < 0) { name = n; break; }
  if (name === act && name !== "lie") name = "lie"; // happy to keep lying there; anything else, lie down after
  if (name === "walk") dir = Math.random() < 0.5 ? -1 : 1;
  start(name, now, rand(...DURATION[name]));
}
function target(now) {
  const e = now - actStart;
  if (act === "stretch") return lerpRig(POSES.stand, POSES.stretch, stretchAt(e), stretchAt(e - 260), stretchAt(e - 520));
  if (act === "walk") return walkRig(now);
  return POSES[act];
}

let raf = 0, last, pointer, look = [0, 0], pokedAt = -Infinity;
addEventListener("pointermove", e => { pointer = { x: e.clientX, y: e.clientY, t: performance.now() }; }, { passive: true });
// Tapping the cat (anywhere over its body) gets a reaction; a sleeping cat only stirs.
canvas.addEventListener("pointerdown", e => {
  if (Math.abs(e.clientX - canvas.getBoundingClientRect().left - x) < 260 * scale) pokedAt = performance.now();
});
function frame(now) {
  const dt = Math.min(100, now - (last ?? now));
  last = now;
  if (act === undefined || night !== (act === "sleep") || now - actStart > actDur || (mobile && act === "walk")) next(now);

  // Getting down onto the floor or back up takes longer than shifting between upright poses.
  const lying = a => a === "lie" || a === "sleep";
  const blendMs = act === "sleep" ? 2000 : lying(act) || lying(prev) ? 1500 : 900;
  const k = smooth(clamp((now - actStart) / blendMs));
  shown = lerpRig(from, target(now), k);

  face += clamp(dir - face, -dt / 225, dt / 225); // a full turn takes ~450ms
  const facing = Math.sin((face * Math.PI) / 2); // squashes through 0 like a body rotating
  const drawDir = Math.abs(facing) < 0.12 ? Math.sign(face || dir) * 0.12 : facing;
  if (act === "walk") {
    // Only move off once mostly standing, and slow through a turn.
    x += facing * WALK_SPEED * scale * dt * clamp((k - 0.4) / 0.6);
    const lo = margin, hi = Math.max(margin, width - margin);
    if ((x <= lo && dir < 0) || (x >= hi && dir > 0)) dir = -dir; // reached an edge: turn around
    x = clamp(x, lo, hi);
  }

  // Lean the head toward the pointer while it's moving nearby; drift back once it goes quiet.
  let want = [0, 0];
  if (pointer && now - pointer.t < 3000 && act !== "sleep") {
    const r = canvas.getBoundingClientRect();
    const hx = x + shown.Hd[0] * scale * drawDir, hy = ground + (shown.Hd[1] - GROUND) * scale;
    const ahead = (pointer.x - r.left - hx) / (scale * drawDir), below = (pointer.y - r.top - hy) / scale; // cat-space px
    want = [clamp(ahead / 150, -0.5, 1) * 10, clamp(below / 120, -1, 1) * 14];
  }
  look = look.map((v, i) => v + (want[i] - v) * Math.min(1, dt / 200));

  draw(shown, now, { x, ground, dir: drawDir, blink: now % 3100 > 2950, zzz: act === "sleep" && k === 1, look, poked: now - pokedAt });
  raf = requestAnimationFrame(frame);
}

// Only animate while the cat is on screen.
new IntersectionObserver(([e]) => {
  if (e.isIntersecting && !raf) { last = undefined; raf = requestAnimationFrame(frame); }
  else if (!e.isIntersecting && raf) { cancelAnimationFrame(raf); raf = 0; }
}).observe(canvas);
})();
