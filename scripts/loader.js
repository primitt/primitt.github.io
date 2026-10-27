// Loading screen: the shared ASCII cat (cat.js): stretching by day (stand -> play-bow -> stand), asleep 8pm-8am CT.
// Wrapped in a function so these names never collide with other scripts on the page.
(() => {
const { isNight, create, POSES, lerpRig, stretchAt } = window.AsciiCat;
const asleep = isNight(); // 8pm-8am CT: the loading cat is asleep instead of stretching
// Phones get a canvas cropped to the cat (504px wide, not 644), so it fills the screen instead of shrinking.
const mobile = innerWidth < 640, cols = mobile ? 36 : 46;
// Cat-space middle that centres the drawn cat in the canvas (measured; the curled-up and stretching cats differ).
const catX = mobile ? (asleep ? 227 : 269) : (asleep ? 308 : 337);
const canvas = document.getElementById("loader-cat");
if (mobile) { canvas.style.width = "min(100vw, 504px)"; canvas.style.aspectRatio = "504 / 320"; }
const draw = create(canvas, cols, 20);

let raf;
const start = performance.now();
function frame(now) {
  const time = now - start;
  if (asleep) {
    draw(POSES.sleep, time, { x: catX, ground: 296, zzz: true });
  } else { // head and tail trail the body through the stretch
    const rig = lerpRig(POSES.stand, POSES.stretch, stretchAt(time), stretchAt(time - 260), stretchAt(time - 520));
    draw(rig, time, { x: catX, ground: 296, blink: time % 3100 > 2950 });
  }
  raf = requestAnimationFrame(frame);
}
raf = requestAnimationFrame(frame);

// Fade out once the page, any extra promise (e.g. flight data) and a short minimum are done.
// Failsafe: never block the page for more than 8s.
const loader = document.getElementById("loader");
let hidden = false;
function finish() {
  if (hidden) return;
  hidden = true;
  cancelAnimationFrame(raf);
  loader.classList.add("opacity-0");
  document.body.style.overflow = "";
  setTimeout(() => loader.remove(), 600);
}
document.body.style.overflow = "hidden";
window.hideLoader = (extra = Promise.resolve()) => {
  const loaded = document.readyState === "complete"
    ? Promise.resolve()
    : new Promise(r => window.addEventListener("load", r, { once: true }));
  Promise.all([loaded, extra, new Promise(r => setTimeout(r, 1800))]).then(finish, finish);
};
setTimeout(finish, 8000);
})();
