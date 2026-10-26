// The cat at the bottom of the main page, doing cat things on Central Time: curled up asleep from
// 8pm to 8am, otherwise mostly lying down, sometimes sitting up, now and then a short walk or a stretch.
// Uses the shared renderer in cat.js, which also owns isNight() and the ?cathour= test override.
(() => {
const { isNight, create, POSES, lerpRig, stretchAt, walkRig, WALK_SPEED, CW, CH, GROUND, clamp, smooth } = window.AsciiCat;
const canvas = document.getElementById("cat-pen");

let night = isNight();
setInterval(() => { night = isNight(); }, 30000);

// Fit the grid to the page width; smaller cat (same cell size, so chunkier) on narrow screens.
let draw, width, ground, margin, scale, x;
function resize() {
  const w = canvas.parentElement.clientWidth;
  scale = w < 640 ? 0.55 : 0.8;
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
let act, actStart, actDur, from, shown, dir = 1;

function start(name, now, dur = Infinity) {
  act = name; actStart = now; actDur = dur;
  from = shown || POSES[name === "walk" || name === "stretch" ? "stand" : name];
}
function next(now) {
  if (night) return start("sleep", now);
  if (act === "sleep") return start("stretch", now, 3200); // waking up
  let r = Math.random() * WEIGHTS.reduce((s, [, w]) => s + w, 0), name = "walk";
  for (const [n, w] of WEIGHTS) if ((r -= w) < 0) { name = n; break; }
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

let raf = 0, last;
function frame(now) {
  const dt = Math.min(100, now - (last ?? now));
  last = now;
  if (act === undefined || night !== (act === "sleep") || now - actStart > actDur) next(now);

  const k = smooth(clamp((now - actStart) / (act === "sleep" ? 2000 : 900)));
  shown = lerpRig(from, target(now), k);
  if (act === "walk") {
    x += dir * WALK_SPEED * scale * dt * k; // ease into walking speed with the blend
    const lo = margin, hi = Math.max(margin, width - margin);
    if ((x <= lo && dir < 0) || (x >= hi && dir > 0)) dir = -dir; // reached an edge: turn around
    x = clamp(x, lo, hi);
  }
  draw(shown, now, { x, ground, dir, blink: now % 3100 > 2950, zzz: act === "sleep" && k === 1 });
  raf = requestAnimationFrame(frame);
}

// Only animate while the cat is on screen.
new IntersectionObserver(([e]) => {
  if (e.isIntersecting && !raf) { last = undefined; raf = requestAnimationFrame(frame); }
  else if (!e.isIntersecting && raf) { cancelAnimationFrame(raf); raf = 0; }
}).observe(canvas);
})();
