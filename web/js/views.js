import { esc, $, $$, pct, toast, icons } from "./util.js";
import * as store from "./store.js";
import { subjectArt } from "./art.js";
import * as photos from "./photos.js";


function tally(D, qs) {
  let attempted = 0, correct = 0;
  for (const q of qs) {
    const a = store.attemptOf(q.id);
    if (a) { attempted++; if (a.ok) correct++; }
  }
  return { attempted, correct, total: qs.length };
}

// ---------- landing ----------
export function landing(root, datasets) {
  const cards = datasets
    .map((D) => {
      const sets = new Set(D.official.map((q) => q.p)).size;
      const t = tally(D, D.official);
      return `<a class="card branch-card" href="#/${D.branch}">
        <div class="code">${D.branch.toUpperCase()}</div>
        <h2>${esc(D.title)}</h2>
        <div class="stat-row">
          <div class="stat"><b>${D.official.length.toLocaleString()}</b><span>Questions</span></div>
          <div class="stat"><b>${D.years[D.years.length - 1]}–${D.years[0]}</b><span>Years</span></div>
          
        </div>
        ${t.attempted ? `<div class="bar" style="margin-top:16px"><i style="width:${pct(t.attempted, t.total)}%"></i></div><div class="hint" style="margin-top:6px">${t.attempted} attempted · ${pct(t.correct, t.attempted)}% accuracy</div>` : `<div class="hint" style="margin-top:16px">${sets} papers · tap to start</div>`}
      </a>`;
    })
    .join("");
  const last = store.lastVisit();
  root.innerHTML = `<section class="intro">
      <h1>GATE previous-year questions</h1>
      <p>EC, EE and IN, ${Math.min(...datasets.map((d) => d.years[d.years.length - 1]))}–${Math.max(...datasets.map((d) => d.years[0]))}, sorted by subject and topic with answers and solutions. Your progress is saved on this device.</p>
      ${last ? `<a class="btn primary" href="${esc(last.href)}">Resume · ${esc(last.label)}</a>` : ""}
    </section>
    <div class="branch-cards">${cards}</div>`;
}

// ---------- branch home: subjects & topics ----------
export function branchHome(root, D) {
  const b = D.branch;
  const t = tally(D, D.official);
  const bySub = new Map(), byTopic = new Map();
  for (const q of D.official) {
    (bySub.get(q.s) || bySub.set(q.s, []).get(q.s)).push(q);
    (byTopic.get(q.tk) || byTopic.set(q.tk, []).get(q.tk)).push(q);
  }
  const extra = D.questions.length - D.official.length;
  const subjects = D.subjects
    .map((s) => {
      const qs = bySub.get(s.id) || [];
      const st = tally(D, qs);
      const topics = s.topics
        .filter((tp) => byTopic.has(`${s.id}/${tp.id}`))
        .map((tp) => {
          const k = `${s.id}/${tp.id}`;
          const ts = tally(D, byTopic.get(k));
          const done = ts.attempted === ts.total;
          return `<li><a href="#/${b}/practice?tp=${encodeURIComponent(k)}"><span>${esc(tp.name)}</span><span class="tn ${done ? "done" : ""}">${ts.attempted ? `${ts.attempted}/` : ""}${ts.total}</span></a></li>`;
        })
        .join("");
      return `<article class="card subject-card" style="--accent:${s.color}">
        <a class="subject-art" href="#/${b}/practice?s=${s.id}" tabindex="-1" aria-hidden="true">${subjectArt(s.id)}</a>
        <header><h3><a href="#/${b}/practice?s=${s.id}">${esc(s.name)}</a></h3><span class="count">${qs.length} Qs</span></header>
        <div class="bar"><i style="width:${pct(st.attempted, st.total)}%"></i></div>
        <ul class="topic-list">${topics}</ul>
      </article>`;
    })
    .join("");
  root.innerHTML = `
    <h1 class="page-title">GATE ${b.toUpperCase()} · ${esc(D.title)}</h1>
    <p class="page-sub">${D.official.length.toLocaleString()} questions from ${new Set(D.official.map((q) => q.p)).size} papers, grouped into ${D.subjects.length} subjects. Pick a topic to practise.</p>
    ${store.lastVisit() && store.lastVisit().branch === b ? `<a class="card resume" href="${esc(store.lastVisit().href)}"><span>▶</span><div><b>Continue where you left off</b><div class="hint">${esc(store.lastVisit().label)}</div></div></a>` : ""}
    <div class="stats-strip">
      <div class="card"><div class="stat"><b>${store.streak()}🔥</b><span>Day streak · ${store.todayCount()} today</span></div></div>
      <div class="card"><div class="stat"><b>${t.attempted}</b><span>Attempted</span></div></div>
      <div class="card"><div class="stat"><b>${pct(t.correct, t.attempted)}%</b><span>Accuracy</span></div></div>
      <div class="card"><div class="stat"><b>${store.bookmarks().filter((i) => i.startsWith(b + "-")).length}</b><span>Bookmarked</span></div></div>
      <div class="card"><div class="stat"><b>${t.total - t.attempted}</b><span>Remaining</span></div></div>
    </div>
    <h3 style="margin-bottom:10px">Practise by year</h3>
    <div class="year-strip">${D.years.map((y) => `<a class="chip" href="#/${b}/practice?y=${y}">${y}</a>`).join("")}</div>
    <div class="topic-head"><h3>Practise by subject &amp; topic</h3><input class="field" id="topic-find" type="search" placeholder="Find a topic… e.g. Laplace, MOSFET, Smith chart" aria-label="Find a topic"></div>
    <div class="subject-grid">${subjects}</div>
    <p class="empty" id="topic-none" hidden>No topic matches that search.</p>
    ${extra ? `<p class="page-sub" style="margin-top:28px">Looking for more? <a href="#/${b}/practice?x=1&sort=topic">${extra.toLocaleString()} extra General Aptitude &amp; Maths questions</a> from other branches’ papers are available too.</p>` : ""}`;
  wireTopicSearch(root);
}

function wireTopicSearch(root) {
  const input = $("#topic-find", root);
  if (!input) return;
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    let shown = 0;
    $$(".subject-card", root).forEach((card) => {
      const subjectHit = card.querySelector("h3").textContent.toLowerCase().includes(q);
      let any = false;
      $$(".topic-list li", card).forEach((li) => {
        const hit = !q || subjectHit || li.textContent.toLowerCase().includes(q);
        li.hidden = !hit;
        any ||= hit;
      });
      card.hidden = !any;
      if (any) shown++;
    });
    $("#topic-none", root).hidden = shown > 0;
  });
}

// ---------- topic × year weightage (one subject at a time) ----------
export function weightage(root, D, params) {
  const b = D.branch;
  const last = store.lastVisit();
  const wanted = params.get("s") || (last && last.branch === b && last.subject) || "";
  const subject = D.subjectById.has(wanted) ? D.subjectById.get(wanted) : D.subjects[0];
  const mode = params.get("by") === "marks" ? "marks" : "count";
  const span = params.get("yrs") || "10";           // "10" | "20" | "all"
  const sort = params.get("sort") === "total" ? "total" : "syllabus";
  const href = (over = {}) => {
    const q = new URLSearchParams({ s: subject.id, ...(mode === "marks" ? { by: "marks" } : {}), ...(span !== "10" ? { yrs: span } : {}), ...(sort === "total" ? { sort } : {}) });
    for (const [k, v] of Object.entries(over)) v === null ? q.delete(k) : q.set(k, v);
    return `#/${b}/weightage?${q}`;
  };
  const years = span === "all" ? D.years : D.years.slice(0, +span);
  const val = (q) => (mode === "marks" ? q.m : 1);
  const unit = mode === "marks" ? "marks" : "questions";

  const qs = D.official.filter((q) => q.s === subject.id);
  const cell = new Map(), tot = new Map(), recent = new Map(), lastYear = new Map();
  const yearTot = new Map();
  for (const q of qs) {
    const v = val(q);
    cell.set(`${q.tk}|${q.year}`, (cell.get(`${q.tk}|${q.year}`) || 0) + v);
    yearTot.set(q.year, (yearTot.get(q.year) || 0) + v);
    if (years.includes(q.year)) tot.set(q.tk, (tot.get(q.tk) || 0) + v);
    lastYear.set(q.tk, Math.max(lastYear.get(q.tk) || 0, q.year));
  }
  const grand = [...tot.values()].reduce((a, c) => a + c, 0);
  let topics = subject.topics.filter((t) => lastYear.has(`${subject.id}/${t.id}`)).map((t) => ({ ...t, key: `${subject.id}/${t.id}` }));
  if (sort === "total") topics.sort((x, y) => (tot.get(y.key) || 0) - (tot.get(x.key) || 0));
  const max = Math.max(1, ...cell.values());
  const fmt = (v) => (v ? String(Math.round(v * 10) / 10) : "");
  const shade = (v) => (v ? `background:color-mix(in srgb, ${subject.color} ${Math.round(14 + 72 * (v / max))}%, var(--surface));${v / max > 0.6 ? "color:#fff;font-weight:700" : ""}` : "");
  const top = [...topics].sort((x, y) => (tot.get(y.key) || 0) - (tot.get(x.key) || 0)).slice(0, 3).filter((t) => tot.get(t.key));
  const nYears = years.length;

  const rows = topics
    .map((t) => {
      const total = tot.get(t.key) || 0;
      const cells = years
        .map((y) => {
          const v = cell.get(`${t.key}|${y}`) || 0;
          return `<td class="c" style="${shade(v)}">${v ? `<a href="#/${b}/practice?tp=${encodeURIComponent(t.key)}&y=${y}" title="${t.name} · ${y}">${fmt(v)}</a>` : ""}</td>`;
        })
        .join("");
      return `<tr><th class="tl"><a href="#/${b}/practice?tp=${encodeURIComponent(t.key)}">${esc(t.name)}</a></th>${cells}
        <td class="tot">${fmt(total)}</td><td class="tot">${fmt(total / nYears)}</td>
        <td class="tot share"><span>${pct(total, grand)}%</span><i style="width:${pct(total, grand)}%"></i></td><td class="tot">${lastYear.get(t.key)}</td></tr>`;
    })
    .join("");
  const foot = `<tr class="sh"><th class="tl">All ${esc(subject.name)} topics</th>${years.map((y) => `<td class="c">${fmt(yearTot.get(y))}</td>`).join("")}<td class="tot">${fmt(grand)}</td><td class="tot">${fmt(grand / nYears)}</td><td class="tot">100%</td><td class="tot"></td></tr>`;

  root.innerHTML = `
    <h1 class="page-title">Topic weightage · ${esc(subject.name)}</h1>
    <p class="page-sub">How many ${unit} each ${esc(subject.name)} topic carried in GATE ${b.toUpperCase()} each year. Click a cell to practise those questions, or a topic name for all of its questions.</p>
    <div class="chips subj-chips">${D.subjects.map((x) => `<a class="chip" aria-pressed="${x.id === subject.id}" style="--accent:${x.color}" href="${href({ s: x.id })}"><span class="dot2"></span>${esc(x.name)}</a>`).join("")}</div>
    <div class="toolbar">
      <div class="seg"><a class="${mode === "count" ? "on" : ""}" href="${href({ by: null })}">Questions</a><a class="${mode === "marks" ? "on" : ""}" href="${href({ by: "marks" })}">Marks</a></div>
      <div class="seg"><a class="${span === "10" ? "on" : ""}" href="${href({ yrs: null })}">Last 10 yrs</a><a class="${span === "20" ? "on" : ""}" href="${href({ yrs: "20" })}">Last 20</a><a class="${span === "all" ? "on" : ""}" href="${href({ yrs: "all" })}">All years</a></div>
      <div class="seg"><a class="${sort === "syllabus" ? "on" : ""}" href="${href({ sort: null })}">Syllabus order</a><a class="${sort === "total" ? "on" : ""}" href="${href({ sort: "total" })}">Most asked first</a></div>
      <a class="btn" href="#/${b}/practice?s=${subject.id}">Practise ${esc(subject.name)} →</a>
    </div>
    ${top.length ? `<div class="insight card"><b>Most asked in the last ${nYears} years:</b> ${top.map((t) => `<a href="#/${b}/practice?tp=${encodeURIComponent(t.key)}">${esc(t.name)}</a> <span class="muted">(${fmt(tot.get(t.key))} ${unit}, ${pct(tot.get(t.key), grand)}%)</span>`).join(" · ")}</div>` : ""}
    <div class="card heat-wrap"><table class="heat"><thead><tr><th class="tl">Topic</th>${years.map((y) => `<th title="GATE ${y}">${String(y).slice(2)}</th>`).join("")}<th class="tot">Total</th><th class="tot" title="Average per year over the years shown">Avg/yr</th><th class="tot">Share</th><th class="tot" title="Most recent year it appeared">Last</th></tr></thead>
    <tbody>${rows}</tbody><tfoot>${foot}</tfoot></table></div>
    <p class="hint" style="margin-top:10px">Column headings are years (e.g. 24 = GATE 2024). Total, average and share cover only the years shown.</p>`;
}

// ---------- analytics ----------
export function analytics(root, D) {
  const b = D.branch;
  const t = tally(D, D.official);
  const subRows = D.subjects
    .map((s) => {
      const qs = D.official.filter((q) => q.s === s.id);
      const st = tally(D, qs);
      return `<div class="row-bar" style="--accent:${s.color}"><span class="lbl"><a href="#/${b}/practice?s=${s.id}" style="color:var(--text)">${esc(s.name)}</a></span>
        <div class="bar"><i style="width:${pct(st.attempted, st.total)}%"></i></div><span class="val">${st.attempted}/${st.total} · ${st.attempted ? pct(st.correct, st.attempted) + "%" : "–"}</span></div>`;
    })
    .join("");
  const topicStats = [];
  for (const s of D.subjects)
    for (const tp of s.topics) {
      const qs = D.official.filter((q) => q.tk === `${s.id}/${tp.id}`);
      if (!qs.length) continue;
      const st = tally(D, qs);
      topicStats.push({ k: `${s.id}/${tp.id}`, name: tp.name, subject: s.name, ...st });
    }
  const weak = topicStats.filter((x) => x.attempted >= 3).sort((a, c) => a.correct / a.attempted - c.correct / c.attempted).slice(0, 8);
  const todo = topicStats.filter((x) => x.attempted < x.total).sort((a, c) => (c.total - c.attempted) - (a.total - a.attempted)).slice(0, 8);
  const days = store.dailyCounts();
  const last = [...Array(14)].map((_, i) => {
    const d = new Date(Date.now() - (13 - i) * 864e5).toISOString().slice(0, 10);
    return { d, n: days[d] || 0 };
  });
  const mx = Math.max(1, ...last.map((x) => x.n));
  root.innerHTML = `
    <h1 class="page-title">Your progress · GATE ${b.toUpperCase()}</h1>
    <p class="page-sub">Stored only in this browser. Use Settings to back it up or move it to another device.</p>
    <div class="stats-strip">
      <div class="card"><div class="stat"><b>${t.attempted}</b><span>of ${t.total} attempted</span></div></div>
      <div class="card"><div class="stat"><b>${t.attempted ? pct(t.correct, t.attempted) + "%" : "–"}</b><span>Accuracy</span></div></div>
      <div class="card"><div class="stat"><b>${t.correct}</b><span>Correct</span></div></div>
      <div class="card"><div class="stat"><b>${t.attempted - t.correct}</b><span>Incorrect</span></div></div>
    </div>
    <div class="grid-2">
      <div class="card pad"><h3 style="margin-bottom:8px">By subject</h3>${subRows}</div>
      <div style="display:grid;gap:16px;align-content:start">
        <div class="card pad"><h3 style="margin-bottom:8px">Last 14 days</h3>
          <div style="display:flex;gap:4px;align-items:flex-end;height:90px">${last.map((x) => `<div title="${x.d}: ${x.n}" style="flex:1;background:var(--primary);opacity:${x.n ? 1 : 0.15};border-radius:4px;height:${Math.max(4, (x.n / mx) * 100)}%"></div>`).join("")}</div>
          <div class="hint" style="margin-top:6px">${last.reduce((a, x) => a + x.n, 0)} answers checked</div></div>
        <div class="card pad"><h3 style="margin-bottom:8px">Weakest topics</h3>${weak.length ? `<table class="table"><tbody>${weak.map((x) => `<tr><td><a href="#/${b}/practice?tp=${encodeURIComponent(x.k)}&st=incorrect">${esc(x.name)}</a><div class="hint">${esc(x.subject)}</div></td><td class="num">${pct(x.correct, x.attempted)}%<div class="hint">${x.correct}/${x.attempted}</div></td></tr>`).join("")}</tbody></table>` : `<p class="muted">Attempt at least 3 questions in a topic to see it here.</p>`}</div>
        <div class="card pad"><h3 style="margin-bottom:8px">Most left to do</h3><table class="table"><tbody>${todo.map((x) => `<tr><td><a href="#/${b}/practice?tp=${encodeURIComponent(x.k)}&st=unattempted">${esc(x.name)}</a><div class="hint">${esc(x.subject)}</div></td><td class="num">${x.total - x.attempted} left</td></tr>`).join("")}</tbody></table></div>
      </div>
    </div>`;
}

// ---------- settings ----------
export function settingsView(root, applyTheme) {
  const th = store.settings().theme;
  root.innerHTML = `
    <h1 class="page-title">Settings &amp; backup</h1>
    <p class="page-sub">Progress, bookmarks and notes live in this browser’s storage. Clearing site data erases them, so keep a backup.</p>
    <div class="card pad">
      <div class="setting"><div><b>Theme</b><div class="hint">Follows your device by default.</div></div>
        <div class="seg" id="theme">${[["dark", "Dark"], ["light", "Light"], ["auto", "System"]].map(([v, l]) => `<button data-v="${v}" class="${th === v ? "on" : ""}">${l}</button>`).join("")}</div></div>
      <div class="setting"><div><b>Saved photos</b><div class="hint" id="photo-info">Checking…</div></div></div>
      <div class="setting"><div><b>Download backup</b><div class="hint">Saves attempts, bookmarks, notes and note photos as a JSON file (photos can make it large).</div></div><button class="btn" id="exp">Download</button></div>
      <div class="setting"><div><b>Restore backup</b><div class="hint">Merge keeps the most recent attempt per question. Replace discards what is here now.</div></div>
        <div class="actions"><input type="file" id="file" accept="application/json" hidden><button class="btn" id="merge">Merge from file…</button><button class="btn danger" id="replace">Replace from file…</button></div></div>
      <div class="setting"><div><b>Reset progress</b><div class="hint">Deletes attempts, bookmarks and notes on this device.</div></div>
        <div class="actions"><button class="btn danger" data-reset="ec-">Reset EC</button><button class="btn danger" data-reset="ee-">Reset EE</button></div></div>
    </div>`;
  let mode = "merge";
  $("#theme", root).addEventListener("click", (e) => {
    const v = e.target.dataset.v;
    if (!v) return;
    store.settings().theme = v;
    store.persist();
    applyTheme();
    $$("#theme button", root).forEach((x) => x.classList.toggle("on", x.dataset.v === v));
  });
  photos.ready.then(() => photos.storageSummary()).then((i) => {
    $("#photo-info", root).textContent = `${i.photos} photo${i.photos === 1 ? "" : "s"} saved on this device${i.usedMB != null ? ` · site storage ${i.usedMB} MB` : ""} · ${i.persisted ? "protected from automatic clean-up" : "browser may clear it if the device runs low on space — keep a backup"}`;
  });
  $("#exp", root).onclick = async () => {
    const a = document.createElement("a");
    const data = { ...JSON.parse(store.exportData()), photos: await photos.exportAll() };
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
    a.download = `gate-pyq-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const file = $("#file", root);
  $("#merge", root).onclick = () => { mode = "merge"; file.click(); };
  $("#replace", root).onclick = () => { if (confirm("Replace all progress on this device with the backup?")) { mode = "replace"; file.click(); } };
  file.onchange = async () => {
    try {
      const text = await file.files[0].text();
      store.importData(text, mode);
      const inc = JSON.parse(text);
      if (inc.photos?.length || mode === "replace") await photos.importAll(inc.photos, mode);
      toast("Backup restored");
    } catch (err) {
      toast(err.message);
    }
    file.value = "";
  };
  root.addEventListener("click", (e) => {
    const p = e.target.dataset.reset;
    if (p && confirm(`Delete all ${p.slice(0, 2).toUpperCase()} progress, bookmarks, notes and photos from this device?`)) {
      store.resetProgress(p);
      photos.removeByPrefix(p);
      toast("Progress reset");
    }
  });
}
