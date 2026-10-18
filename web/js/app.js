import { $, $$, icons } from "./util.js";
import * as store from "./store.js";
import { loadBranch } from "./data.js";
import { mountPractice, parseFilters, serialize } from "./practice.js";
import { landing, branchHome, weightage, analytics, settingsView } from "./views.js";
import { mountCalculator } from "./calc.js";

const BRANCHES = ["ec", "ee", "in"];
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

const loaded = {};
let current = { branch: null, view: null };

// The EC/EE/IN switcher keeps what you are studying: on the practice page it links to the same
// subject (and topic when the other branch has it) and hides branches that lack the subject.
function refreshSwitcher() {
  const { branch, view } = current;
  if (!branch) { seg.hidden = true; return; }
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  const f = view === "practice" ? parseFilters(params) : null;
  const wsub = view === "weightage" ? params.get("s") : null;
  const subjects = new Set(f ? [...f.subjects, ...[...f.topics].map((k) => k.split("/")[0])] : wsub ? [wsub] : []);
  const items = [];
  for (const b of BRANCHES) {
    const D = loaded[b];
    if (b !== branch && D && [...subjects].some((s) => !D.subjectById.has(s))) continue;
    let href = `#/${b}${view && view !== "home" ? "/" + view : ""}`;
    if (f && b !== branch && D) {
      const g = { ...f, subjects: new Set(f.subjects), topics: new Set(), id: "" };
      for (const k of f.topics) D.topicOf.has(k) ? g.topics.add(k) : g.subjects.add(k.split("/")[0]);
      href = `#/${b}/practice?${serialize(g)}`;
    } else if (wsub && b !== branch) {
      href = `#/${b}/weightage?${new URLSearchParams([...params].filter(([k]) => k !== "id"))}`;
    } else if (f && b === branch) href = location.hash;
    items.push(`<a href="${href}" class="${b === branch ? "on" : ""}">${b.toUpperCase()}</a>`);
  }
  seg.innerHTML = items.join("");
  seg.hidden = items.length < 2;
}
BRANCHES.forEach((b) => loadBranch(b).then((D) => { loaded[b] = D; refreshSwitcher(); }).catch(() => {}));
addEventListener("gate:url", refreshSwitcher);

function chrome(branch, view) {
  current = { branch, view };
  refreshSwitcher();
  const items = [["home", "Topics", ""], ["practice", "Practice", "/practice"], ["weightage", "Weightage", "/weightage"], ["analytics", "Progress", "/analytics"]];
  // the Weightage tab opens the subject you were last practising
  const lv = store.lastVisit();
  const ws = branch && lv && lv.branch === branch && lv.subject ? `?s=${lv.subject}` : "";
  nav.innerHTML = branch ? items.map(([v, l, p]) => `<a href="#/${branch}${p}${v === "weightage" ? ws : ""}" class="${v === view ? "on" : ""}">${l}</a>`).join("") : "";
}

const skeleton = () => `<div class="skel"><i style="width:40%;height:28px"></i><i style="width:65%"></i><div class="skel-grid"><i></i><i></i><i></i></div></div>`;

function refreshStreak() {
  const n = store.streak();
  const el = document.getElementById("streak");
  el.hidden = !n;
  el.textContent = `🔥 ${n}`;
  el.title = `${n}-day streak · ${store.todayCount()} answers checked today`;
}

let token = 0;
async function route() {
  const my = ++token;
  const [path, query = ""] = location.hash.replace(/^#/, "").split("?");
  const parts = path.split("/").filter(Boolean);
  const params = new URLSearchParams(query);
  window.scrollTo({ top: 0 });
  refreshStreak();
  try {
    if (parts[0] === "settings") {
      chrome(null, "settings");
      return settingsView(root, applyTheme);
    }
    if (!BRANCHES.includes(parts[0])) {
      chrome(null);
      document.title = "GATE PYQ — EC & EE previous-year questions";
      root.innerHTML = skeleton();
      const all = await Promise.all(BRANCHES.map(loadBranch));
      if (my === token) landing(root, all);
      return;
    }
    const b = parts[0];
    const view = parts[1] || "home";
    chrome(b, view);
    root.innerHTML = skeleton();
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
