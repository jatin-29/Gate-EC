// Progress lives in localStorage only; nothing is sent anywhere.
const KEY = "gatepyq:v1";

const blank = () => ({ attempts: {}, badges: {}, bookmarks: [], bookmarkTimes: {}, notes: {}, daily: {}, settings: { theme: "dark" } });

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    return raw ? { ...blank(), ...raw } : blank();
  } catch {
    return blank();
  }
}

let db = load();
if (!db.bookmarkTimes) db.bookmarkTimes = {};
if (!db.badges) db.badges = {};

// days are counted in the user's local time, not UTC (UTC made late-night and early-morning IST answers land on the wrong day)
const pad = (n) => String(n).padStart(2, "0");
export const dayKey = (t = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const changed = () => window.dispatchEvent(new Event("gate:progress"));

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* storage unavailable (private mode / quota): keep working in memory */
  }
}

export const settings = () => db.settings;
export const attemptOf = (id) => db.attempts[id];
export const isBookmarked = (id) => db.bookmarks.includes(id);
export const noteOf = (id) => db.notes[id] || "";

export function statusOf(id) {
  const a = db.attempts[id];
  return a ? (a.ok ? "correct" : "incorrect") : "unattempted";
}

export function record(id, ok, answer) {
  const prev = db.attempts[id];
  db.attempts[id] = { ok, a: answer, t: Date.now(), n: (prev?.n || 0) + 1 };
  touch();
}

// count a day of activity (checking an answer, revealing a descriptive answer)
export function touch() {
  const day = dayKey();
  db.daily[day] = (db.daily[day] || 0) + 1;
  persist();
  changed();
}

export function clearAttempt(id) {
  delete db.attempts[id];
  persist();
  changed();
}

export function toggleBookmark(id) {
  const i = db.bookmarks.indexOf(id);
  if (i >= 0) { db.bookmarks.splice(i, 1); delete db.bookmarkTimes[id]; }
  else { db.bookmarks.push(id); db.bookmarkTimes[id] = Date.now(); }
  persist();
  changed();
  return i < 0;
}

export function setNote(id, text) {
  if (text.trim()) db.notes[id] = text;
  else delete db.notes[id];
  persist();
}

export function exportData() {
  return JSON.stringify({ app: "gate-pyq", version: 1, exportedAt: new Date().toISOString(), ...db }, null, 1);
}

// mode "merge" keeps the newer attempt per question; "replace" overwrites everything.
export function importData(text, mode = "merge") {
  const inc = JSON.parse(text);
  if (inc.app !== "gate-pyq" || typeof inc.attempts !== "object") throw new Error("Not a GATE PYQ backup file");
  if (mode === "replace") {
    db = { ...blank(), attempts: inc.attempts, badges: inc.badges || {}, bookmarks: inc.bookmarks || [], bookmarkTimes: inc.bookmarkTimes || {}, notes: inc.notes || {}, daily: inc.daily || {}, settings: db.settings };
  } else {
    for (const [id, a] of Object.entries(inc.attempts)) {
      if (!db.attempts[id] || a.t > db.attempts[id].t) db.attempts[id] = a;
    }
    db.bookmarks = [...new Set([...db.bookmarks, ...(inc.bookmarks || [])])];
    db.badges = { ...(inc.badges || {}), ...db.badges };
    db.bookmarkTimes = { ...(inc.bookmarkTimes || {}), ...db.bookmarkTimes };
    Object.assign(db.notes, inc.notes || {});
    for (const [d, n] of Object.entries(inc.daily || {})) db.daily[d] = Math.max(db.daily[d] || 0, n);
  }
  persist();
}

export function resetProgress(prefix = "") {
  for (const id of Object.keys(db.attempts)) if (id.startsWith(prefix)) delete db.attempts[id];
  db.bookmarks = db.bookmarks.filter((id) => !id.startsWith(prefix));
  for (const id of Object.keys(db.bookmarkTimes)) if (id.startsWith(prefix)) delete db.bookmarkTimes[id];
  for (const id of Object.keys(db.notes)) if (id.startsWith(prefix)) delete db.notes[id];
  persist();
}

export function allAttempts() {
  return db.attempts;
}
export function dailyCounts() {
  return db.daily;
}
export function bookmarks() {
  return db.bookmarks;
}
export function notes() {
  return db.notes;
}

export const lastVisit = () => db.settings.last || null;
export function setLastVisit(v) {
  db.settings.last = v;
  persist();
}

// consecutive days with activity, counting back from today (or yesterday if nothing yet today)
export function streak() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  if (!db.daily[dayKey(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (db.daily[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
export const todayCount = () => db.daily[dayKey()] || 0;
export const bookmarkTimes = () => db.bookmarkTimes;

export const earnedBadges = () => db.badges;
export const noteCount = () => Object.keys(db.notes).length;
export function awardBadges(ids) {
  const now = Date.now();
  for (const id of ids) db.badges[id] = now;
  if (ids.length) persist();
}

// longest run of consecutive active days ever
export function longestStreak() {
  const days = Object.keys(db.daily).filter((k) => db.daily[k] > 0).sort();
  let best = 0, run = 0, prev = null;
  for (const k of days) {
    const [y, m, d] = k.split("-").map(Number);
    const t = Date.UTC(y, m - 1, d);
    run = prev !== null && t - prev === 864e5 ? run + 1 : 1;
    prev = t;
    best = Math.max(best, run);
  }
  return best;
}
