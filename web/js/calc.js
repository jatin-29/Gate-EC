import { icons } from "./util.js";

// The GATE virtual scientific calculator (same layout and behaviour as the one used in the exam)
// lives in calc/ and is shown in an iframe so its styles and old jQuery stay isolated.
export function mountCalculator() {
  const fab = document.createElement("button");
  fab.className = "calc-fab";
  fab.title = "Scientific calculator (GATE)";
  fab.setAttribute("aria-label", "Open calculator");
  fab.innerHTML = icons.calc;
  const box = document.createElement("div");
  box.className = "calc-frame";
  box.innerHTML = `<div class="calc-top"><span>GATE virtual calculator</span><button class="icon-btn" aria-label="Close calculator">×</button></div>`;
  document.body.append(fab, box);
  let frame;
  const toggle = () => {
    const open = box.classList.toggle("open");
    if (open && !frame) {
      frame = document.createElement("iframe");
      frame.src = "calc/index.html";
      frame.title = "GATE scientific calculator";
      box.append(frame);
    }
  };
  fab.onclick = toggle;
  box.querySelector("button").onclick = toggle;
}
