import { $, $$, icons } from "./util.js";
import * as store from "./store.js";
import { loadBranch } from "./data.js";
import { mountPractice } from "./practice.js";
import { landing, branchHome, weightage, analytics, settingsView } from "./views.js";
import { mountCalculator } from "./calc.js";

const BRANCHES = ["ec", "ee"];
const root = $("#app");
const nav = $("#nav");
const seg = $("#branch-seg");
const themeBtn = $("#theme-btn");

function applyTheme() {
  const t = store.settings().theme;
  const dark = t === "dark" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  themeBtn.innerHTML = dark ? icons.sun : icons.moon;
}
themeBtn.onclick = () => {
  const dark = document.documentElement.dataset.theme === "dark";
  store.settings().theme = dark ? "light" : "dark";
  store.persist();
  applyTheme();
};
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
$("#settings-link").innerHTML = icons.gear;

function chrome(branch, view) {
  seg.innerHTML = BRANCHES.map((b) => `<a href="#/${b}${view && view !== "home" ? "/" + view : ""}" class="${b === branch ? "on" : ""}">${b.toUpperCase()}</a>`).join("");
  seg.hidden = !branch;
  const items = [["home", "Topics", ""], ["practice", "Practice", "/practice"], ["weightage", "Weightage", "/weightage"], ["analytics", "Progress", "/analytics"]];
  nav.innerHTML = branch ? items.map(([v, l, p]) => `<a href="#/${branch}${p}" class="${v === view ? "on" : ""}">${l}</a>`).join("") : "";
}

let token = 0;
async function route() {
  const my = ++token;
  const [path, query = ""] = location.hash.replace(/^#/, "").split("?");
  const parts = path.split("/").filter(Boolean);
  const params = new URLSearchParams(query);
  window.scrollTo({ top: 0 });
  try {
    if (parts[0] === "settings") {
      chrome(null, "settings");
      return settingsView(root, applyTheme);
    }
    if (!BRANCHES.includes(parts[0])) {
      chrome(null);
      document.title = "GATE PYQ — EC & EE previous-year questions";
      root.innerHTML = `<div class="empty">Loading…</div>`;
      const all = await Promise.all(BRANCHES.map(loadBranch));
      if (my === token) landing(root, all);
      return;
    }
    const b = parts[0];
    const view = parts[1] || "home";
    chrome(b, view);
    root.innerHTML = `<div class="empty">Loading ${b.toUpperCase()} questions…</div>`;
    const D = await loadBranch(b);
    if (my !== token) return;
    const titles = { home: "Topics", practice: "Practice", weightage: "Topic weightage", analytics: "Progress" };
    document.title = `${titles[view] || "Topics"} · GATE ${b.toUpperCase()} PYQ`;
    if (view === "practice") mountPractice(root, D, params);
    else if (view === "weightage") weightage(root, D, params);
    else if (view === "analytics") analytics(root, D);
    else branchHome(root, D);
  } catch (err) {
    root.innerHTML = `<div class="empty"><h3>Something went wrong</h3><p>${String(err.message).replace(/</g, "&lt;")}</p><button class="btn" onclick="location.reload()">Reload</button></div>`;
  }
}

addEventListener("hashchange", route);
applyTheme();
mountCalculator();
route();
