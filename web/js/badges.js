import { esc, toast } from "./util.js";
import * as store from "./store.js";
import * as photos from "./photos.js";
import { loadBranch } from "./data.js";

const BRANCHES = ["ec", "ee", "in"];
const TIER = { bronze: "#cd7f32", silver: "#aeb6c4", gold: "#f5c542", special: "#8b6dff" };

// each badge: how far along (v of t) the learner is; earned when v >= t
const SIMPLE = [
  // streaks
  ["streak-3", "Streaks", "bronze", "🔥", "3-Day Spark", "Practise 3 days in a row", (s) => s.longestStreak, 3],
  ["streak-7", "Streaks", "silver", "🔥", "Week Warrior", "Practise 7 days in a row", (s) => s.longestStreak, 7],
  ["streak-30", "Streaks", "gold", "🔥", "Monthly Grind", "Practise 30 days in a row", (s) => s.longestStreak, 30],
  ["streak-100", "Streaks", "special", "👑", "Centurion", "Practise 100 days in a row", (s) => s.longestStreak, 100],
  // solved
  ["solved-10", "Questions solved", "bronze", "🌱", "First Steps", "Solve 10 questions correctly", (s) => s.solved, 10],
  ["solved-50", "Questions solved", "bronze", "📘", "Getting Warm", "Solve 50 questions", (s) => s.solved, 50],
  ["solved-100", "Questions solved", "silver", "💯", "Century", "Solve 100 questions", (s) => s.solved, 100],
  ["solved-250", "Questions solved", "silver", "🚀", "Quarter K", "Solve 250 questions", (s) => s.solved, 250],
  ["solved-500", "Questions solved", "gold", "🏆", "Half K", "Solve 500 questions", (s) => s.solved, 500],
  ["solved-1000", "Questions solved", "special", "💎", "Thousand Club", "Solve 1000 questions", (s) => s.solved, 1000],
  // skills
  ["accuracy", "Skills", "gold", "🎯", "Sharp Shooter", "70%+ accuracy over at least 50 attempts", (s) => (s.attempts >= 50 && s.accuracy >= 70 ? 1 : 0), 1, (s) => `${Math.min(s.attempts, 50)}/50 attempts · ${s.accuracy}% accuracy`],
  ["hard-10", "Skills", "gold", "🧠", "Tough Nut", "Solve 10 Hard questions", (s) => s.hard, 10],
  ["nat-25", "Skills", "silver", "🔢", "Number Cruncher", "Solve 25 numerical-answer (NAT) questions", (s) => s.nat, 25],
  ["msq-5", "Skills", "silver", "☑️", "Multi-Select Master", "Solve 5 multiple-select (MSQ) questions", (s) => s.msq, 5],
  ["comeback-10", "Skills", "silver", "💪", "Comeback Kid", "Get 10 questions right after getting them wrong", (s) => s.redeemed, 10],
  ["marathon-20", "Skills", "silver", "⚡", "Marathon", "Check 20 answers in a single day", (s) => s.bestDay, 20],
  ["paper", "Skills", "gold", "📄", "Paper Finisher", "Attempt every question of a full GATE paper", (s) => s.papers, 1],
  ["all-branches", "Skills", "special", "🔀", "Triple Threat", "Solve 10+ questions in each of EC, EE and IN", (s) => Math.min(...BRANCHES.map((b) => s.byBranch[b] || 0)), 10],
  // habits
  ["bookmarks-10", "Habits", "bronze", "★", "Collector", "Bookmark 10 questions", (s) => s.bookmarks, 10],
  ["notes-5", "Habits", "bronze", "✎", "Note Taker", "Write notes on 5 questions", (s) => s.notes, 5],
  ["photo-1", "Habits", "bronze", "📷", "Photographic Memory", "Attach a photo to a question", (s) => s.photos, 1],
];

export async function stats() {
  const data = Object.fromEntries(await Promise.all(BRANCHES.map(async (b) => [b, await loadBranch(b)])));
  await photos.ready;
  const st = { solved: 0, attempts: 0, hard: 0, nat: 0, msq: 0, redeemed: 0, bySubject: {}, byBranch: {}, papers: 0, subjectNames: {} };
  const perPaper = {};
  for (const [id, a] of Object.entries(store.allAttempts())) {
    const b = id.split("-")[0];
    const q = data[b] && data[b].byId.get(id);
    if (!q) continue;
    st.attempts++;
    (perPaper[`${b}|${q.p}`] ||= new Set()).add(id);
    if (!a.ok) continue;
    st.solved++;
    if (q.d === 3) st.hard++;
    if (q.t === "nat") st.nat++;
    if (q.t === "msq") st.msq++;
    if (a.n > 1) st.redeemed++;
    st.bySubject[q.s] = (st.bySubject[q.s] || 0) + 1;
    st.byBranch[b] = (st.byBranch[b] || 0) + 1;
  }
  for (const key of Object.keys(perPaper)) {
    const [b, p] = key.split("|");
    const paper = data[b].paperByKey.get(p);
    if (paper.kind === "paper" && perPaper[key].size >= paper.count) st.papers++;
  }
  st.accuracy = st.attempts ? Math.round((100 * st.solved) / st.attempts) : 0;
  st.longestStreak = store.longestStreak();
  st.bestDay = Math.max(0, ...Object.values(store.dailyCounts()));
  st.bookmarks = store.bookmarks().length;
  st.notes = store.noteCount();
  st.photos = photos.total();
  for (const b of BRANCHES) for (const s of data[b].subjects) st.subjectNames[s.id] = s.name;
  return st;
}

export function definitions(st) {
  const defs = SIMPLE.map(([id, cat, tier, icon, name, desc, val, target, label]) => ({
    id, cat, tier, icon, name, desc, target, v: Math.min(val(st), target), note: label ? label(st) : null,
  }));
  for (const [sid, name] of Object.entries(st.subjectNames)) {
    if (sid === "general-aptitude") continue;
    defs.push({ id: `subject-${sid}`, cat: "Subject specialist", tier: "gold", icon: "🎓", name: `${name} Specialist`, desc: `Solve 50 ${name} questions (any branch)`, target: 50, v: Math.min(st.bySubject[sid] || 0, 50) });
  }
  defs.push({ id: "subject-general-aptitude", cat: "Subject specialist", tier: "gold", icon: "🎓", name: "Aptitude Ace", desc: "Solve 50 General Aptitude questions", target: 50, v: Math.min(st.bySubject["general-aptitude"] || 0, 50) });
  return defs;
}

let running = false;
// Called whenever progress changes. The first run only records what the learner already earned,
// so nobody gets a flood of pop-ups for old work.
export async function checkBadges() {
  if (running) return;
  running = true;
  try {
    const st = await stats();
    const earned = store.earnedBadges();
    const fresh = definitions(st).filter((d) => d.v >= d.target && !earned[d.id]);
    const firstRun = Object.keys(earned).length === 0 && !store.settings().badgesInit;
    store.awardBadges(fresh.map((d) => d.id));
    if (firstRun) { store.settings().badgesInit = true; store.persist(); }
    else fresh.forEach((d, i) => setTimeout(() => toast(`${d.icon} Badge unlocked: ${d.name}`), i * 600));
  } finally {
    running = false;
  }
}

export async function badgesView(root) {
  root.innerHTML = `<div class="empty">Loading…</div>`;
  const st = await stats();
  const defs = definitions(st);
  const earned = store.earnedBadges();
  const have = defs.filter((d) => d.v >= d.target || earned[d.id]).length;
  const cats = [...new Set(defs.map((d) => d.cat))];
  const day = (t) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  root.innerHTML = `
    <h1 class="page-title">Badges</h1>
    <p class="page-sub">${have} of ${defs.length} earned · ${st.solved} questions solved · best streak ${st.longestStreak} day${st.longestStreak === 1 ? "" : "s"} · ${st.accuracy}% accuracy</p>
    ${cats.map((c) => `<h3 class="badge-cat">${esc(c)}</h3><div class="badge-grid">${defs
      .filter((d) => d.cat === c)
      .map((d) => {
        const done = d.v >= d.target || earned[d.id];
        return `<div class="card badge ${done ? "on" : ""}" style="--tier:${TIER[d.tier]}">
          <div class="medal">${d.icon}</div>
          <div class="b-body"><b>${esc(d.name)}</b><div class="hint">${esc(d.desc)}</div>
          ${done ? `<div class="b-done">Earned${earned[d.id] ? " · " + day(earned[d.id]) : ""}</div>` : `<div class="bar"><i style="width:${(100 * d.v) / d.target}%"></i></div><div class="hint">${esc(d.note || `${d.v} / ${d.target}`)}</div>`}</div></div>`;
      })
      .join("")}</div>`).join("")}`;
}
