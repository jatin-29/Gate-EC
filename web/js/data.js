const cache = {};

export async function loadBranch(branch) {
  if (cache[branch]) return cache[branch];
  const res = await fetch(`data/${branch}.json?v=${window.BUILD}`);
  if (!res.ok) throw new Error(`Could not load ${branch} questions (${res.status})`);
  const d = await res.json();
  d.subjectById = new Map(d.subjects.map((s, i) => [s.id, { ...s, order: i }]));
  d.topicOf = new Map(); // "subject/topic" -> topic (with order and parent)
  for (const s of d.subjects) s.topics.forEach((t, i) => d.topicOf.set(`${s.id}/${t.id}`, { ...t, order: i, subject: s.id }));
  d.paperByKey = new Map(d.papers.map((p, i) => [p.key, { ...p, order: i }]));
  for (const q of d.questions) {
    const p = d.paperByKey.get(q.p);
    q.year = p.year;
    q.extra = p.kind === "extra";
    q.paper = p;
    q.tk = `${q.s}/${q.tp}`;
    q.hay = (q.q.replace(/<[^>]+>/g, " ") + " " + (q.o || []).join(" ").replace(/<[^>]+>/g, " ")).toLowerCase();
  }
  d.byId = new Map(d.questions.map((q) => [q.id, q]));
  d.official = d.questions.filter((q) => !q.extra);
  d.years = [...new Set(d.official.map((q) => q.year))].sort((a, b) => b - a);
  cache[branch] = d;
  return d;
}

let expCache = {};
export async function loadExplanations(branch) {
  if (!expCache[branch]) {
    expCache[branch] = fetch(`data/${branch}-exp.json?v=${window.BUILD}`).then((r) => {
      if (!r.ok) throw new Error("explanations unavailable");
      return r.json();
    });
    expCache[branch].catch(() => delete expCache[branch]);
  }
  return expCache[branch];
}

export function checkAnswer(q, given) {
  const a = q.a;
  if (a == null) return null;
  if (q.t === "nat") {
    const v = parseFloat(String(given).trim());
    if (Number.isNaN(v)) return false;
    const eps = 1e-9;
    return v >= a.min - eps && v <= a.max + eps;
  }
  if (q.t === "msq") {
    const g = [...given].sort().join("");
    return g === [...a].sort().join("");
  }
  return given === a;
}

export function answerText(q) {
  const a = q.a;
  if (a == null) return "not available";
  if (q.t === "nat") return a.min === a.max ? String(a.min) : `${a.min} to ${a.max}`;
  return Array.isArray(a) ? a.join(", ") : a;
}
