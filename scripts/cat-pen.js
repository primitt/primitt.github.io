// The cat at the bottom of the main page, doing cat things on Central Time: curled up asleep from
// 8pm to 8am (waking with a sleepy sit-up and a stretch), otherwise mostly lying down, sometimes sitting up,
// now and then a stretch or a walk off one side of the screen and back in from the other.
// Uses the shared renderer in cat.js, which also owns isNight() and the ?cathour= test override.
(() => {
const { isNight, create, POSES, lerpRig, stretchAt, walkRig, WALK_SPEED, CW, CH, GROUND, clamp, smooth } = window.AsciiCat;
const canvas = document.getElementById("cat-pen");

let night = isNight();
setInterval(() => { night = isNight(); }, 1000);

// Fit the grid to the page width; smaller cat (same cell size, so chunkier) on narrow screens.
let draw, width, ground, margin, reach, scale, x, mobile;
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
  reach = 320 * scale; // past this far off an edge, none of it is on screen
  const lo = margin, hi = Math.max(margin, width - margin);
  x = clamp(x ?? lo + Math.random() * (hi - lo), lo, hi); // random spot on load, kept across resizes
}
resize();
new ResizeObserver(resize).observe(canvas.parentElement);

// Behaviour: one activity at a time, blended in from wherever the cat was.
// Mostly a lazy cat: lying down is the favourite, then sitting, then a short walk; the odd stretch.
const WEIGHTS = [["lie", 5], ["sit", 3], ["walk", 2], ["stretch", 0.5]];
const DURATION = { lie: [60000, 120000], sit: [20000, 30000], stretch: [3200, 3200] };
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
let act, prev, actStart, actDur, from, shown;
const dir = Math.random() < 0.5 ? -1 : 1; // which way the cat faces, and so walks; it never turns round
// Long enough to walk off the edge ahead, come back in the other side and settle on screen.
const walkMs = () => ((dir > 0 ? width + reach - x : x + reach) + reach + margin + rand(0, 200)) / (WALK_SPEED * scale) + 1000;

function start(name, now, dur = Infinity) {
  prev = act; act = name; actStart = now; actDur = dur;
  from = shown || POSES[name === "walk" || name === "stretch" ? "stand" : name === "wake" ? "sit" : name];
}
function next(now) {
  if (night) return start("sleep", now);
  if (act === "sleep") return start("wake", now, 3000); // morning: sit up, blinking sleepily...
  if (act === "wake") return start("stretch", now, 3200); // ...then a big stretch
  // On phones the cat stays put: only lying and sitting.
  const weights = mobile ? WEIGHTS.filter(([n]) => n === "lie" || n === "sit") : WEIGHTS;
  let r = Math.random() * weights.reduce((s, [, w]) => s + w, 0), name = "lie";
  for (const [n, w] of weights) if ((r -= w) < 0) { name = n; break; }
  if (name === act && name !== "lie") name = "lie"; // happy to keep lying there; anything else, lie down after
  start(name, now, name === "walk" ? walkMs() : rand(...DURATION[name]));
}
function target(now) {
  const e = now - actStart;
  if (act === "wake") return POSES.sit;
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

  if (act === "walk") {
    x += dir * WALK_SPEED * scale * dt * clamp((k - 0.4) / 0.6); // only move off once mostly standing
    // Right off one edge, straight back in from the other.
    if (x > width + reach) x -= width + 2 * reach;
    else if (x < -reach) x += width + 2 * reach;
  }

  // Lean the head toward the pointer while it's moving nearby; drift back once it goes quiet.
  let want = [0, 0];
  if (pointer && now - pointer.t < 3000 && act !== "sleep") {
    const r = canvas.getBoundingClientRect();
    const hx = x + shown.Hd[0] * scale * dir, hy = ground + (shown.Hd[1] - GROUND) * scale;
    const ahead = (pointer.x - r.left - hx) / (scale * dir), below = (pointer.y - r.top - hy) / scale; // cat-space px
    want = [clamp(ahead / 150, -0.5, 1) * 10, clamp(below / 120, -1, 1) * 14];
  }
  look = look.map((v, i) => v + (want[i] - v) * Math.min(1, dt / 200));

  draw(shown, now, { x, ground, dir, blink: act === "wake" ? now % 1000 < 450 : now % 3100 > 2950, zzz: act === "sleep" && k === 1, look, poked: now - pokedAt });
  raf = requestAnimationFrame(frame);
}

// Only animate while the cat is on screen.
new IntersectionObserver(([e]) => {
  if (e.isIntersecting && !raf) { last = undefined; raf = requestAnimationFrame(frame); }
  else if (!e.isIntersecting && raf) { cancelAnimationFrame(raf); raf = 0; }
}).observe(canvas);
})();
