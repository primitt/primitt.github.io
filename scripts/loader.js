// Loading screen: the shared ASCII cat (cat.js) stretching, stand -> play-bow -> stand.
// Wrapped in a function so these names never collide with other scripts on the page.
(() => {
const { create, POSES, lerpRig, stretchAt } = window.AsciiCat;
const draw = create(document.getElementById("loader-cat"), 46, 20); // 644x320 canvas

let raf;
const start = performance.now();
function frame(now) {
  const time = now - start; // head and tail trail the body through the stretch
  const rig = lerpRig(POSES.stand, POSES.stretch, stretchAt(time), stretchAt(time - 260), stretchAt(time - 520));
  draw(rig, time, { x: 300, ground: 296, blink: time % 3100 > 2950 });
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
