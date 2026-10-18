// Progress lives in localStorage only; nothing is sent anywhere.
const KEY = "gatepyq:v1";

const blank = () => ({ attempts: {}, bookmarks: [], notes: {}, daily: {}, settings: { theme: "auto" } });

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    return raw ? { ...blank(), ...raw } : blank();
  } catch {
    return blank();
  }
}

let db = load();

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
  const day = new Date().toISOString().slice(0, 10);
  db.daily[day] = (db.daily[day] || 0) + 1;
  persist();
}

export function clearAttempt(id) {
  delete db.attempts[id];
  persist();
}

export function toggleBookmark(id) {
  const i = db.bookmarks.indexOf(id);
  if (i >= 0) db.bookmarks.splice(i, 1);
  else db.bookmarks.push(id);
  persist();
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
    db = { ...blank(), attempts: inc.attempts, bookmarks: inc.bookmarks || [], notes: inc.notes || {}, daily: inc.daily || {}, settings: db.settings };
  } else {
    for (const [id, a] of Object.entries(inc.attempts)) {
      if (!db.attempts[id] || a.t > db.attempts[id].t) db.attempts[id] = a;
    }
    db.bookmarks = [...new Set([...db.bookmarks, ...(inc.bookmarks || [])])];
    Object.assign(db.notes, inc.notes || {});
    for (const [d, n] of Object.entries(inc.daily || {})) db.daily[d] = Math.max(db.daily[d] || 0, n);
  }
  persist();
}

export function resetProgress(prefix = "") {
  for (const id of Object.keys(db.attempts)) if (id.startsWith(prefix)) delete db.attempts[id];
  db.bookmarks = db.bookmarks.filter((id) => !id.startsWith(prefix));
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

// consecutive days with at least one checked answer, counting back from today (or yesterday)
export function streak() {
  const day = (d) => new Date(d).toISOString().slice(0, 10);
  let d = Date.now();
  if (!db.daily[day(d)]) d -= 864e5;
  let n = 0;
  while (db.daily[day(d)]) { n++; d -= 864e5; }
  return n;
}
export const todayCount = () => db.daily[new Date().toISOString().slice(0, 10)] || 0;
