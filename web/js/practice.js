import { esc, $, $$, typeset, toast } from "./util.js";
import * as store from "./store.js";
import * as photos from "./photos.js";
import { loadExplanations, checkAnswer, answerText } from "./data.js";

const STATUSES = [["all", "All"], ["unattempted", "Unattempted"], ["correct", "Correct"], ["incorrect", "Incorrect"], ["bookmarked", "Bookmarked"], ["noted", "With notes"]];
const SORTS = [["new", "Newest paper first"], ["old", "Oldest paper first"], ["topic", "Syllabus order"], ["rand", "Shuffle"]];

const DIFF = { 1: "Easy", 2: "Medium", 3: "Hard" };
const csv = (v) => (v ? String(v).split(",").filter(Boolean) : []);

export function parseFilters(params) {
  return {
    q: params.get("q") || "",
    subjects: new Set(csv(params.get("s"))),
    topics: new Set(csv(params.get("tp"))),
    years: new Set(csv(params.get("y")).map(Number)),
    types: new Set(csv(params.get("t"))),
    marks: new Set(csv(params.get("m")).map(Number)),
    diffs: new Set(csv(params.get("d")).map(Number)),
    status: params.get("st") || "all",
    sort: params.get("sort") || "new",
    extra: params.get("x") === "1",
    id: params.get("id") || "",
  };
}

export function serialize(f) {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.subjects.size) p.set("s", [...f.subjects].join(","));
  if (f.topics.size) p.set("tp", [...f.topics].join(","));
  if (f.years.size) p.set("y", [...f.years].join(","));
  if (f.types.size) p.set("t", [...f.types].join(","));
  if (f.marks.size) p.set("m", [...f.marks].join(","));
  if (f.diffs.size) p.set("d", [...f.diffs].join(","));
  if (f.status !== "all") p.set("st", f.status);
  if (f.sort !== "new") p.set("sort", f.sort);
  if (f.extra) p.set("x", "1");
  if (f.id) p.set("id", f.id);
  return p.toString();
}

function shuffled(arr, seed) {
  const a = arr.slice();
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function mountPractice(root, D, params) {
  const branch = D.branch;
  const f = parseFilters(params);
  if (/-extra-/.test(f.id)) f.extra = true;
  const seed = (Math.random() * 1e9) | 0;
  let list = [];
  let idx = 0;
  let sel = new Set(); // working answer for the current question
  let natVal = "";
  let revealed = false;
  let focusId = f.id;

  root.innerHTML = `
    <div class="mobile-bar">
      <button class="btn" data-act="open-filters">☰ Filters</button>
      <span class="pos" id="m-count"></span>
    </div>
    <div class="practice">
      <aside class="filters-col"><div class="card panel" id="filters"></div></aside>
      <section><div class="card q-card" id="qcard"></div></section>
      <aside class="palette-col"><div class="card panel palette" id="palette"></div></aside>
    </div>`;

  // ---------- filtering ----------
  function matches(q, skipTopics) {
    if (q.extra && !f.extra) return false;
    if (!skipTopics) {
      if (f.subjects.size && !f.subjects.has(q.s)) return false;
      if (f.topics.size && !f.topics.has(q.tk)) return false;
    }
    if (f.years.size && !(q.year && f.years.has(q.year))) return false;
    if (f.types.size && !f.types.has(q.t)) return false;
    if (f.marks.size && !f.marks.has(q.m)) return false;
    if (f.diffs.size && !f.diffs.has(q.d)) return false;
    if (f.q && !f.q.toLowerCase().split(/\s+/).every((w) => q.hay.includes(w))) return false;
    if (f.status !== "all") {
      const st = store.statusOf(q.id);
      if (f.status === "bookmarked" ? !store.isBookmarked(q.id) : f.status === "noted" ? !(store.noteOf(q.id) || photos.has(q.id)) : st !== f.status) return false;
    }
    return true;
  }

  function sortList(arr) {
    if (f.sort === "rand") return shuffled(arr, seed);
    if (f.sort === "old") {
      return arr.slice().sort((a, b) => (a.extra - b.extra) || ((a.year || 0) - (b.year || 0)) || (a.paper.set || 0) - (b.paper.set || 0) || a.n - b.n);
    }
    if (f.sort === "topic") {
      return arr.slice().sort((a, b) => {
        const ta = D.topicOf.get(a.tk), tb = D.topicOf.get(b.tk);
        return (D.subjectById.get(a.s).order - D.subjectById.get(b.s).order) || (ta.order - tb.order) || (a.paper.order - b.paper.order) || a.n - b.n;
      });
    }
    return arr; // data is already newest paper first
  }

  function recompute(keepId) {
    list = sortList(D.questions.filter((q) => matches(q)));
    idx = keepId ? Math.max(0, list.findIndex((q) => q.id === keepId)) : Math.min(idx, Math.max(0, list.length - 1));
    syncUrl();
  }

  function syncUrl() {
    const cur = list[idx];
    const copy = { ...f, id: cur ? cur.id : "" };
    history.replaceState(null, "", `#/${branch}/practice?${serialize(copy)}`);
    if (cur) store.setLastVisit({ href: location.hash, label: `${cur.paper.title} · ${cur.ref}`, branch });
    window.dispatchEvent(new Event("gate:url")); // lets the header's branch switcher follow the filters
  }

  // ---------- filter panel ----------
  function renderFilters() {
    const el = $("#filters", root);
    const openSubjects = new Set([...f.subjects, ...[...f.topics].map((k) => k.split("/")[0])]);
    // counts respect every filter except subject/topic so they stay meaningful while browsing
    const counts = new Map();
    for (const q of D.questions) if (matches(q, true)) counts.set(q.tk, (counts.get(q.tk) || 0) + 1);
    const subj = D.subjects
      .map((s) => {
        const total = s.topics.reduce((n, t) => n + (counts.get(`${s.id}/${t.id}`) || 0), 0);
        const topics = s.topics
          .map((t) => {
            const k = `${s.id}/${t.id}`;
            const n = counts.get(k) || 0;
            return `<label class="check ${n ? "" : "zero"}"><input type="checkbox" data-topic="${k}" ${f.topics.has(k) ? "checked" : ""}> <span>${esc(t.name)}</span><span class="n">${n}</span></label>`;
          })
          .join("");
        return `<details class="subj" style="--accent:${s.color}" ${openSubjects.has(s.id) ? "open" : ""}>
          <summary><span class="dot"></span>${esc(s.name)}<span class="n">${total}</span></summary>
          <div class="topics">
            <label class="check"><input type="checkbox" data-subject="${s.id}" ${f.subjects.has(s.id) ? "checked" : ""}> <b>Whole subject</b></label>
            ${topics}
          </div></details>`;
      })
      .join("");
    const chip = (attr, val, label, on) => `<button class="chip" ${attr}="${val}" aria-pressed="${on}">${label}</button>`;
    el.innerHTML = `
      <div class="drawer-head"><b>Filters</b><button class="btn primary" data-act="close-filters">Show ${list.length} questions</button></div>
      <h3>Search</h3>
      <input class="field" id="f-q" type="search" placeholder="Search question text…" value="${esc(f.q)}">
      <h3>Subject &amp; topic</h3>
      <div>${subj}</div>
      <h3>Year</h3>
      <div class="chips">${D.years.map((y) => chip("data-year", y, y, f.years.has(y))).join("")}</div>
      ${D.papers.some((p) => p.kind === "extra") ? `<label class="check" style="margin-top:8px"><input type="checkbox" id="f-extra" ${f.extra ? "checked" : ""}> <span>Include extra practice questions</span></label>` : ""}
      <h3>Type</h3>
      <div class="chips">${[["mcq", "MCQ"], ["msq", "MSQ"], ["nat", "NAT"], ["desc", "Descriptive"]].filter(([v]) => D.types.has(v)).map(([v, l]) => chip("data-type", v, l, f.types.has(v))).join("")}</div>
      <h3>Marks</h3>
      <div class="chips">${[1, 2].map((m) => chip("data-marks", m, `${m} mark`, f.marks.has(m))).join("")}</div>
      <h3>Difficulty</h3>
      <div class="chips">${[1, 2, 3].filter((d) => D.hasDifficulty.has(d)).map((d) => chip("data-diff", d, DIFF[d], f.diffs.has(d))).join("")}</div>
      <h3>Status</h3>
      <div class="chips">${STATUSES.map(([v, l]) => chip("data-status", v, l, f.status === v)).join("")}</div>
      <h3>Order</h3>
      <select class="field" id="f-sort">${SORTS.map(([v, l]) => `<option value="${v}" ${f.sort === v ? "selected" : ""}>${l}</option>`).join("")}</select>
      <p style="margin:16px 0 0"><button class="btn" style="width:100%;justify-content:center" data-act="reset">Reset filters</button></p>`;
  }

  // ---------- palette ----------
  function renderPalette() {
    const el = $("#palette", root);
    const c = { correct: 0, incorrect: 0, unattempted: 0 };
    list.forEach((q) => c[store.statusOf(q.id)]++);
    el.innerHTML = `
      <h3>Questions</h3>
      <div class="sumline"><b>${list.length}</b> matching · ${c.correct} ✓ · ${c.incorrect} ✗</div>
      <div class="pal-grid">${list
        .map((q, i) => `<button data-go="${i}" title="${esc(q.paper.title)} · ${esc(q.ref)}" class="${store.statusOf(q.id)} ${i === idx ? "current" : ""} ${store.isBookmarked(q.id) ? "bmk" : ""}">${i + 1}</button>`)
        .join("")}</div>
      <div class="legend">
        <span><i style="background:var(--ok-weak);border-color:var(--ok)"></i>Correct</span>
        <span><i style="background:var(--bad-weak);border-color:var(--bad)"></i>Incorrect</span>
        <span><i></i>Unattempted</span>
        <span><i style="background:var(--warn);border-color:var(--warn);border-radius:50%"></i>Bookmarked</span>
      </div>`;
    $("#m-count", root).textContent = `${list.length} questions`;
    const cur = $(".current", el), grid = $(".pal-grid", el);
    if (cur && grid) grid.scrollTop = cur.offsetTop - grid.clientHeight / 2;
  }

  // ---------- question card ----------
  function resetWork() {
    sel = new Set();
    natVal = "";
    revealed = false;
    const q = list[idx];
    const a = q && store.attemptOf(q.id);
    if (a) {
      revealed = true;
      if (q.t === "nat") natVal = a.a ?? "";
      else sel = new Set(Array.isArray(a.a) ? a.a : a.a ? [a.a] : []);
    }
  }

  function renderCard() {
    const el = $("#qcard", root);
    const q = list[idx];
    if (!q) {
      el.innerHTML = `<div class="empty"><h3>No questions match these filters</h3><p>Try removing a filter or <button class="btn" data-act="reset">reset all</button>.</p></div>`;
      return;
    }
    const s = D.subjectById.get(q.s), t = D.topicOf.get(q.tk);
    const done = !!store.attemptOf(q.id);
    const ok = done ? store.attemptOf(q.id).ok : null;
    const locked = revealed;
    const correctSet = new Set(Array.isArray(q.a) ? q.a : q.a ? [q.a] : []);
    const opts =
      q.t === "desc"
        ? `<div class="hint" style="margin:16px 0">Descriptive question: work it out, then reveal the answer.</div>`
        : q.t === "nat"
        ? `<div class="nat"><input id="nat" inputmode="decimal" autocomplete="off" placeholder="Enter your answer" value="${esc(natVal)}" ${locked ? "disabled" : ""} class="${locked && q.a ? (checkAnswer(q, natVal) ? "right" : "wrong") : ""}"><span class="hint">Numerical answer type${q.a && q.a.some(([lo, hi]) => lo !== hi) ? " · a range of values is accepted" : ""}</span></div>`
        : `<div class="options" role="${q.t === "msq" ? "group" : "radiogroup"}">${q.o
            .map((o, i) => {
              const L = "ABCD"[i];
              let cls = sel.has(L) ? "sel" : "";
              if (locked && q.a) cls = correctSet.has(L) ? "right" : sel.has(L) ? "wrong" : "";
              return `<button class="opt ${cls}" data-opt="${L}" ${locked ? "disabled" : ""}><span class="L">${L}</span><span class="T">${o}</span></button>`;
            })
            .join("")}</div>${q.t === "msq" ? `<div class="hint">One or more options may be correct (MSQ). Select all that apply.</div>` : ""}`;
    let verdict = "";
    if (locked) {
      if (q.t === "desc") verdict = `<div class="verdict info">${q.r ? `Answer: ${q.r}` : "Answer key not available for this question."}</div>`;
      else if (q.a == null) verdict = `<div class="verdict info">${esc(q.nt || "Answer key not available for this question.")}</div>`;
      else if (done) verdict = ok ? `<div class="verdict ok">✓ Correct — answer: ${esc(answerText(q))}</div>` : `<div class="verdict bad">✗ Incorrect — correct answer: ${esc(answerText(q))}</div>`;
      else verdict = `<div class="verdict info">Answer: <b>${esc(answerText(q))}</b></div>`;
    }
    const bm = store.isBookmarked(q.id);
    el.innerHTML = `
      <div class="progress" aria-hidden="true"><i style="width:${((idx + 1) / list.length) * 100}%"></i></div>
      <div class="q-head">
        <span class="where">${esc(q.paper.title)} · ${esc(q.ref)}</span>
        <span class="tag m${q.m}">${q.m} mark${q.m > 1 ? "s" : ""}</span>
        <span class="tag">${q.t.toUpperCase()}</span>
        ${q.fm ? `<span class="tag" title="The source is missing a figure for this question">Figure missing</span>` : ""}
        ${q.d ? `<span class="tag d${q.d}">${DIFF[q.d] || ""}</span>` : ""}
        ${done ? `<span class="tag" style="color:var(--${ok ? "ok" : "bad"})">${ok ? "Solved" : "Attempted"}</span>` : ""}
        <span class="tag timer" id="timer" title="Time on this question">⏱ 0:00</span>
      </div>
      <div class="crumb" style="margin:-8px 0 14px">
        <a href="#/${branch}/practice?s=${s.id}"><b>${esc(s.name)}</b></a> ›
        <a href="#/${branch}/practice?tp=${esc(q.tk)}">${esc(t.name)}</a>
      </div>
      <div class="q-body" id="qbody">${q.q}</div>
      ${opts}
      <div class="actions">
        ${locked ? "" : `${q.t === "desc" ? "" : `<button class="btn primary" data-act="check" ${q.t === "nat" ? "" : sel.size ? "" : "disabled"}>Check answer</button>`}<button class="btn" data-act="reveal">Show answer</button>`}
        ${done ? `<button class="btn" data-act="retry">Try again</button>` : ""}
        ${locked && !done ? `<button class="btn" data-act="retry">Hide answer</button>` : ""}
        <button class="btn bm ${bm ? "on" : ""}" data-act="bookmark">${bm ? "★ Bookmarked" : "☆ Bookmark"}</button>
        <button class="btn" data-act="notes" id="notes-btn">✎ Notes${store.noteOf(q.id) || photos.has(q.id) ? " •" : ""}</button>
      </div>
      ${verdict}
      <div id="exp"></div>
      <div class="notes" id="notes" hidden>
        <textarea placeholder="Your notes for this question (saved on this device)…">${esc(store.noteOf(q.id))}</textarea>
        <div class="photo-bar">
          <button class="btn" data-act="add-photo">📷 Add photo / screenshot</button>
          <input type="file" id="photo-file" accept="image/*" multiple hidden>
          <span class="hint">Or paste a screenshot (Ctrl/Cmd+V) or drop an image here. Kept on this device.</span>
        </div>
        <div class="photos" id="photos"></div>
      </div>
      <div class="nav-row">
        <button class="btn" data-act="prev" ${idx === 0 ? "disabled" : ""}>← Previous</button>
        <span class="pos">${idx + 1} / ${list.length} · <button class="linkish" data-act="random">random</button></span>
        <button class="btn" data-act="next" ${idx >= list.length - 1 ? "disabled" : ""}>Next →</button>
      </div>`;
    typeset(el);
    startTimer(locked);
    if (locked) showExplanation(q);
    if (store.noteOf(q.id) || photos.has(q.id)) { $("#notes", el).hidden = false; renderPhotos(); }
  }

  // ---------- photos attached to notes ----------
  let photoUrls = [];
  async function renderPhotos() {
    const q = list[idx], box = $("#photos", root);
    if (!q || !box) return;
    photoUrls.forEach(URL.revokeObjectURL);
    photoUrls = [];
    try {
      const rows = await photos.list(q.id);
      if (list[idx] !== q || !box.isConnected) return;
      box.innerHTML = rows
        .map((r) => {
          const url = URL.createObjectURL(r.blob);
          photoUrls.push(url);
          return `<figure class="photo"><img src="${url}" alt="Your saved photo" data-photo="${url}"><button class="photo-del" data-del-photo="${r.id}" title="Delete photo" aria-label="Delete photo">×</button></figure>`;
        })
        .join("");
    } catch { /* storage unavailable */ }
    const btn = $("#notes-btn", root);
    if (btn) btn.textContent = `✎ Notes${store.noteOf(q.id) || photos.has(q.id) ? " •" : ""}`;
  }

  async function addPhotos(files) {
    const q = list[idx];
    if (!q || !files.length) return;
    try {
      const n = await photos.add(q.id, files);
      $("#notes", root).hidden = false;
      toast(n > 1 ? `${n} photos saved` : "Photo saved");
      renderPhotos();
      renderFilters();
    } catch (err) {
      toast(err.message || "Could not save the photo");
    }
  }

  function lightbox(src) {
    const o = document.createElement("div");
    o.className = "lightbox";
    o.innerHTML = `<img src="${src}" alt="Saved photo">`;
    const close = () => { o.remove(); document.removeEventListener("keydown", esc2, true); };
    const esc2 = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    o.onclick = close;
    document.addEventListener("keydown", esc2, true);
    document.body.append(o);
  }

  // per-question stopwatch (pacing practice); it stops once the answer is revealed
  let timerHandle, timerStart;
  function startTimer(stopped) {
    clearInterval(timerHandle);
    const el = $("#timer", root);
    if (!el) return;
    timerStart = Date.now();
    if (stopped) return el.remove();
    timerHandle = setInterval(() => {
      const t = $("#timer", root);
      if (!t || !root.isConnected) return clearInterval(timerHandle);
      const sec = Math.floor((Date.now() - timerStart) / 1000);
      t.textContent = `⏱ ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
    }, 1000);
  }

  async function showExplanation(q) {
    const box = $("#exp", root);
    try {
      const all = await loadExplanations(branch);
      if (list[idx] !== q || !all[q.id]) return;
      box.innerHTML = `<div class="exp"><h4>Solution</h4>${all[q.id]}</div>`;
      typeset(box);
    } catch {
      /* explanations are optional */
    }
  }

  function go(i) {
    if (i < 0 || i >= list.length) return;
    idx = i;
    resetWork();
    syncUrl();
    renderCard();
    renderPalette();
    window.scrollTo({ top: 0 });
  }

  function submit() {
    const q = list[idx];
    if (!q) return;
    const given = q.t === "nat" ? natVal : q.t === "msq" ? [...sel].sort() : [...sel][0];
    if (q.t === "nat" ? !String(natVal).trim() : !sel.size) return;
    const ok = checkAnswer(q, given);
    revealed = true;
    if (ok !== null) store.record(q.id, ok, given);
    renderCard();
    renderPalette();
    renderFilters();
  }

  // ---------- events ----------
  function refreshAll(keepId) {
    recompute(keepId);
    resetWork();
    renderFilters();
    renderCard();
    renderPalette();
  }

  root.addEventListener("click", (e) => {
    const t = e.target.closest("button, a, input, [data-photo]");
    if (!t) return;
    if (t.dataset.go) return go(+t.dataset.go);
    if (t.dataset.photo) return lightbox(t.dataset.photo);
    if (t.dataset.delPhoto) {
      const q = list[idx];
      if (confirm("Delete this photo?")) photos.remove(t.dataset.delPhoto, q.id).then(() => { renderPhotos(); renderFilters(); });
      return;
    }
    if (t.dataset.opt) {
      const L = t.dataset.opt;
      if (list[idx].t === "msq") sel.has(L) ? sel.delete(L) : sel.add(L);
      else sel = new Set([L]);
      renderCard();
      return;
    }
    if (t.dataset.year) { const y = +t.dataset.year; f.years.has(y) ? f.years.delete(y) : f.years.add(y); return refreshAll(); }
    if (t.dataset.type) { const v = t.dataset.type; f.types.has(v) ? f.types.delete(v) : f.types.add(v); return refreshAll(); }
    if (t.dataset.marks) { const v = +t.dataset.marks; f.marks.has(v) ? f.marks.delete(v) : f.marks.add(v); return refreshAll(); }
    if (t.dataset.diff) { const v = +t.dataset.diff; f.diffs.has(v) ? f.diffs.delete(v) : f.diffs.add(v); return refreshAll(); }
    if (t.dataset.status) { f.status = t.dataset.status; return refreshAll(); }
    switch (t.dataset.act) {
      case "check": return submit();
      case "reveal": { revealed = true; renderCard(); return; }
      case "retry": { const q = list[idx]; store.clearAttempt(q.id); resetWork(); sel = new Set(); natVal = ""; revealed = false; renderCard(); renderPalette(); renderFilters(); return; }
      case "bookmark": { const q = list[idx]; toast(store.toggleBookmark(q.id) ? "Bookmarked" : "Bookmark removed"); renderCard(); renderPalette(); return; }
      case "add-photo": $("#photo-file", root).click(); return;
      case "notes": { const n = $("#notes", root); n.hidden = !n.hidden; if (!n.hidden) { renderPhotos(); $("textarea", n).focus(); } return; }
      case "random": return go(Math.floor(Math.random() * list.length));
      case "prev": return go(idx - 1);
      case "next": return go(idx + 1);
      case "close-filters": $(".filters-col", root).classList.remove("open"); return;
      case "open-filters": $(".filters-col", root).classList.add("open"); return;
      case "reset":
        f.q = ""; f.subjects.clear(); f.topics.clear(); f.years.clear(); f.types.clear(); f.marks.clear(); f.diffs.clear(); f.status = "all"; f.sort = "new"; f.extra = false;
        return refreshAll();
    }
  });

  root.addEventListener("change", (e) => {
    const t = e.target;
    if (t.id === "photo-file") { addPhotos(t.files).then(() => (t.value = "")); return; }
    if (t.dataset.topic) { t.checked ? f.topics.add(t.dataset.topic) : f.topics.delete(t.dataset.topic); return refreshAll(); }
    if (t.dataset.subject) { t.checked ? f.subjects.add(t.dataset.subject) : f.subjects.delete(t.dataset.subject); return refreshAll(); }
    if (t.id === "f-extra") { f.extra = t.checked; return refreshAll(); }
    if (t.id === "f-sort") { f.sort = t.value; return refreshAll(); }
  });

  let qTimer;
  root.addEventListener("input", (e) => {
    const t = e.target;
    if (t.id === "f-q") {
      clearTimeout(qTimer);
      qTimer = setTimeout(() => { f.q = t.value.trim(); recompute(); resetWork(); renderCard(); renderPalette(); }, 250);
    } else if (t.id === "nat") {
      natVal = t.value;
    } else if (t.closest("#notes")) {
      store.setNote(list[idx].id, t.value);
    }
  });

  const onKey = (e) => {
    if (!root.isConnected) return document.removeEventListener("keydown", onKey);
    if (e.target.matches("input, textarea, select") && !(e.target.id === "nat" && e.key === "Enter")) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const q = list[idx];
    if (e.key === "ArrowRight") go(idx + 1);
    else if (e.key === "ArrowLeft") go(idx - 1);
    else if (e.key === "Enter" && q) { revealed ? go(idx + 1) : submit(); }
    else if (q && !revealed && q.o && /^[1-4a-dA-D]$/.test(e.key)) {
      const L = "ABCD"[/\d/.test(e.key) ? +e.key - 1 : e.key.toUpperCase().charCodeAt(0) - 65];
      if (q.t === "msq") sel.has(L) ? sel.delete(L) : sel.add(L);
      else sel = new Set([L]);
      renderCard();
    } else if (e.key.toLowerCase() === "b" && q) { toast(store.toggleBookmark(q.id) ? "Bookmarked" : "Bookmark removed"); renderCard(); renderPalette(); }
  };
  document.addEventListener("keydown", onKey);

  // paste a screenshot anywhere on the page, or drop images on the notes box
  const onPaste = (e) => {
    if (!root.isConnected) return document.removeEventListener("paste", onPaste);
    const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith("image/"));
    if (files.length) { e.preventDefault(); addPhotos(files); }
  };
  document.addEventListener("paste", onPaste);
  root.addEventListener("dragover", (e) => { if (e.target.closest("#notes")) e.preventDefault(); });
  root.addEventListener("drop", (e) => {
    if (!e.target.closest("#notes")) return;
    e.preventDefault();
    addPhotos(e.dataTransfer.files);
  });

  recompute(focusId);
  resetWork();
  renderFilters();
  renderCard();
  renderPalette();
  // the photo index loads asynchronously; refresh the badges / "with notes" counts once it is ready
  photos.ready.then(() => { if (root.isConnected) { renderFilters(); renderCard(); } });
}
