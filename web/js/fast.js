import { esc, $, typeset, toast } from "./util.js";
import * as store from "./store.js";
import { parseFilters, matchesFilter, shuffled } from "./practice.js";
import { checkAnswer, answerText } from "./data.js";

const PACE_SEC_PER_MARK = 108; // 180 min / 100 marks, the real GATE average
const COUNTS = [10, 20, 30, 65, 0]; // 0 = as many as available
const fmt = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

export function fastView(root, D, params) {
  const b = D.branch;
  const f = parseFilters(params);
  const cfg = {
    n: params.has("n") ? +params.get("n") : 20,
    mode: params.get("mode") || "per",              // per | pace | total
    sec: +params.get("sec") || 60,
    mins: +params.get("mins") || 30,
    shuffle: params.get("shuffle") !== "0",
    unatt: params.get("unatt") !== "0",
    auto: params.get("auto") !== "0",
    types: new Set(params.get("ty") ? params.get("ty").split(",") : ["mcq", "nat"]),
  };
  let cleanup = () => {};
  const stop = () => { cleanup(); cleanup = () => {}; };

  // ---------------- setup screen ----------------
  function pool() {
    return D.questions.filter((q) => q.a != null && q.t !== "desc" && cfg.types.has(q.t) && matchesFilter(q, { ...f, types: new Set(), status: "all" }) && (!cfg.unatt || store.statusOf(q.id) === "unattempted"));
  }

  function setup() {
    stop();
    const subj = f.subjects.size === 1 ? [...f.subjects][0] : [...f.topics].length ? [...f.topics][0].split("/")[0] : "";
    const topicSel = f.topics.size === 1 ? [...f.topics][0] : "";
    const recent = store.fastSessions().filter((x) => x.branch === b).slice(-5).reverse();
    root.innerHTML = `
      <h1 class="page-title">⚡ Fast track · GATE ${b.toUpperCase()}</h1>
      <p class="page-sub">Race the clock: a timer per question, answers lock in as you press, and the next question comes up on its own. Built for building speed.</p>
      <div class="fast-setup">
        <div class="card pad">
          <h3>What to practise</h3>
          <div class="field-row"><label>Subject<select class="field" id="fs-subject"><option value="">All subjects</option>${D.subjects.map((s) => `<option value="${s.id}" ${s.id === subj ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>
          <label>Topic<select class="field" id="fs-topic"></select></label></div>
          <div class="chips" style="margin-top:12px">${[["mcq", "MCQ"], ["nat", "NAT"], ["msq", "MSQ"]].map(([v, l]) => `<button class="chip" data-type="${v}" aria-pressed="${cfg.types.has(v)}">${l}</button>`).join("")}</div>
          <label class="check" style="margin-top:12px"><input type="checkbox" id="fs-unatt" ${cfg.unatt ? "checked" : ""}> <span>Only questions I haven't attempted</span></label>
          <label class="check"><input type="checkbox" id="fs-shuffle" ${cfg.shuffle ? "checked" : ""}> <span>Shuffle</span></label>
          ${f.years.size || f.marks.size || f.diffs.size || f.ids.size || f.q ? `<p class="hint" style="margin-top:8px">Also using the year / marks / difficulty / selection filters from Practice.</p>` : ""}
          <p class="avail" id="fs-avail"></p>
        </div>
        <div class="card pad">
          <h3>Timer</h3>
          <div class="seg" id="fs-mode"><button data-m="per" class="${cfg.mode === "per" ? "on" : ""}">Per question</button><button data-m="pace" class="${cfg.mode === "pace" ? "on" : ""}">GATE pace</button><button data-m="total" class="${cfg.mode === "total" ? "on" : ""}">Whole session</button></div>
          <div id="fs-timer" style="margin-top:14px"></div>
          <h3 style="margin-top:18px">How many questions</h3>
          <div class="chips">${COUNTS.map((c) => `<button class="chip" data-n="${c}" aria-pressed="${cfg.n === c}">${c || "All"}</button>`).join("")}</div>
          <label class="check" style="margin-top:12px"><input type="checkbox" id="fs-auto" ${cfg.auto ? "checked" : ""}> <span>Move on automatically after I answer</span></label>
          <div class="actions" style="margin-top:16px"><button class="btn primary big" id="fs-start">⚡ Start</button></div>
          <p class="hint" style="margin-top:8px">Keys during a run: <kbd>1</kbd>–<kbd>4</kbd> answer · <kbd>Enter</kbd> submit / next · <kbd>N</kbd> skip · <kbd>Space</kbd> pause · <kbd>Esc</kbd> end</p>
        </div>
      </div>
      ${recent.length ? `<h3 style="margin:22px 0 8px">Recent sessions</h3><div class="card pad"><table class="table"><thead><tr><th>When</th><th class="num">Questions</th><th class="num">Correct</th><th class="num">Accuracy</th><th class="num">Avg / question</th></tr></thead><tbody>${recent.map((x) => `<tr><td>${new Date(x.t).toLocaleDateString(undefined, { day: "numeric", month: "short" })} ${new Date(x.t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</td><td class="num">${x.n}</td><td class="num">${x.correct}</td><td class="num">${x.correct + x.wrong ? Math.round((100 * x.correct) / (x.correct + x.wrong)) : 0}%</td><td class="num">${x.n - x.skipped ? Math.round(x.secs / Math.max(1, x.n)) : "–"}s</td></tr>`).join("")}</tbody></table></div>` : ""}`;
    const subjectSel = $("#fs-subject", root), topicEl = $("#fs-topic", root);
    const fillTopics = () => {
      const s = D.subjectById.get(subjectSel.value);
      topicEl.innerHTML = `<option value="">All topics</option>` + (s ? s.topics.map((t) => `<option value="${s.id}/${t.id}" ${`${s.id}/${t.id}` === topicSel ? "selected" : ""}>${esc(t.name)}</option>`).join("") : "");
      topicEl.disabled = !s;
    };
    const syncFilters = () => {
      f.subjects = subjectSel.value ? new Set([subjectSel.value]) : new Set();
      f.topics = topicEl.value ? new Set([topicEl.value]) : new Set();
      $("#fs-avail", root).innerHTML = `<b>${pool().length}</b> questions available`;
      $("#fs-start", root).disabled = !pool().length;
    };
    const timerUi = () => {
      $("#fs-timer", root).innerHTML = cfg.mode === "per"
        ? `<div class="chips">${[30, 45, 60, 90, 120, 180].map((x) => `<button class="chip" data-sec="${x}" aria-pressed="${cfg.sec === x}">${x}s</button>`).join("")}</div><label class="inline">or custom <input class="field num-in" id="fs-sec" type="number" min="5" max="900" value="${cfg.sec}"> seconds each</label>`
        : cfg.mode === "pace"
          ? `<p class="muted">1-mark question = ${PACE_SEC_PER_MARK}s, 2-mark = ${PACE_SEC_PER_MARK * 2}s. Matches the real GATE average of 180 minutes for 100 marks.</p>`
          : `<div class="chips">${[10, 20, 30, 45, 60, 90].map((x) => `<button class="chip" data-mins="${x}" aria-pressed="${cfg.mins === x}">${x} min</button>`).join("")}</div><label class="inline">or custom <input class="field num-in" id="fs-mins" type="number" min="1" max="240" value="${cfg.mins}"> minutes in total</label>`;
    };
    fillTopics(); timerUi(); syncFilters();
    subjectSel.onchange = () => { fillTopics(); syncFilters(); };
    topicEl.onchange = syncFilters;
    root.onclick = (e) => {
      const t = e.target.closest("button");
      if (!t) return;
      if (t.dataset.type) { const v = t.dataset.type; cfg.types.has(v) ? cfg.types.delete(v) : cfg.types.add(v); if (!cfg.types.size) cfg.types.add(v); t.setAttribute("aria-pressed", cfg.types.has(v)); syncFilters(); }
      else if (t.dataset.m) { cfg.mode = t.dataset.m; [...$("#fs-mode", root).children].forEach((x) => x.classList.toggle("on", x === t)); timerUi(); }
      else if (t.dataset.sec) { cfg.sec = +t.dataset.sec; timerUi(); }
      else if (t.dataset.mins) { cfg.mins = +t.dataset.mins; timerUi(); }
      else if (t.dataset.n !== undefined) { cfg.n = +t.dataset.n; root.querySelectorAll("[data-n]").forEach((x) => x.setAttribute("aria-pressed", x === t)); }
      else if (t.id === "fs-start") start();
    };
    root.oninput = (e) => {
      if (e.target.id === "fs-sec") cfg.sec = Math.max(5, +e.target.value || 60);
      if (e.target.id === "fs-mins") cfg.mins = Math.max(1, +e.target.value || 30);
    };
    root.onchange = (e) => {
      if (e.target.id === "fs-unatt") { cfg.unatt = e.target.checked; syncFilters(); }
      if (e.target.id === "fs-shuffle") cfg.shuffle = e.target.checked;
      if (e.target.id === "fs-auto") cfg.auto = e.target.checked;
    };
  }

  // ---------------- a run ----------------
  function start() {
    let qs = pool();
    qs = cfg.shuffle ? shuffled(qs, (Math.random() * 1e9) | 0) : qs;
    if (cfg.n) qs = qs.slice(0, cfg.n);
    if (!qs.length) return toast("No questions match");
    run(qs);
  }

  function run(qs) {
    stop();
    root.onclick = root.oninput = root.onchange = null;
    const results = [];
    let i = 0, sel = new Set(), natVal = "", locked = false, paused = false, nextTimer = null;
    let qStart = 0, qLimit = 0, qDeadline = 0, sessStart = Date.now(), sessDeadline = cfg.mode === "total" ? Date.now() + cfg.mins * 60000 : 0, pausedAt = 0;
    const limitFor = (q) => (cfg.mode === "per" ? cfg.sec : cfg.mode === "pace" ? PACE_SEC_PER_MARK * q.m : 0);

    root.innerHTML = `<div class="fast">
      <div class="fast-bar"><b>⚡ Fast track</b><span class="mono" id="f-pos"></span><span class="mono" id="f-score"></span><span class="spacer"></span>
        <button class="btn sm" id="f-pause">Pause <kbd>Space</kbd></button><button class="btn sm danger" id="f-end">End</button></div>
      <div class="timer-row"><div class="timer-bar"><i id="f-bar"></i></div><div class="timer-num mono" id="f-time"></div></div>
      <div class="card q-card" id="f-card"></div></div>`;

    const score = () => {
      const c = results.filter((r) => r.status === "correct").length, w = results.filter((r) => r.status === "wrong").length;
      $("#f-score", root).innerHTML = `<span style="color:var(--ok)">✓ ${c}</span> <span style="color:var(--bad)">✗ ${w}</span> <span class="muted">– ${results.length - c - w}</span>`;
    };

    function render() {
      const q = qs[i];
      sel = new Set(); natVal = ""; locked = false;
      qStart = Date.now();
      qLimit = limitFor(q);
      qDeadline = qLimit ? qStart + qLimit * 1000 : 0;
      $("#f-pos", root).textContent = `${i + 1} / ${qs.length}`;
      score();
      const opts = q.t === "nat"
        ? `<div class="nat"><input id="f-nat" inputmode="decimal" autocomplete="off" placeholder="Type the answer, Enter to submit"></div>`
        : `<div class="options">${q.o.map((o, k) => `<button class="opt" data-opt="${"ABCD"[k]}"><span class="L">${"ABCD"[k]}</span><span class="T">${o}</span><kbd class="optkey">${k + 1}</kbd></button>`).join("")}</div>${q.t === "msq" ? `<div class="hint">Select all that apply, then press Enter.</div>` : ""}`;
      $("#f-card", root).innerHTML = `<div class="q-head"><span class="where">${esc(q.paper.title)} · ${esc(q.ref)}</span><span class="tag m${q.m}">${q.m} mark${q.m > 1 ? "s" : ""}</span><span class="tag">${q.t.toUpperCase()}</span></div>
        <div class="q-body">${q.q}</div>${opts}
        <div class="actions">${q.t === "mcq" ? "" : `<button class="btn primary" data-act="submit">Submit <kbd>Enter</kbd></button>`}<button class="btn" data-act="skip">Skip <kbd>N</kbd></button></div><div id="f-verdict"></div>`;
      typeset($("#f-card", root));
      if (q.t === "nat") $("#f-nat", root).focus();
      tick();
    }

    function finishQuestion(status, given) {
      if (locked) return;
      locked = true;
      const q = qs[i];
      const secs = Math.round((Date.now() - qStart) / 1000);
      results.push({ q, status, secs, given });
      score();
      const ok = status === "correct";
      const v = $("#f-verdict", root);
      const reveal = q.t === "msq" ? new Set(q.a) : new Set(Array.isArray(q.a) ? q.a : q.a && q.t !== "nat" ? [q.a] : []);
      // a skipped / timed-out question never reveals its answer; it stays for later practice
      root.querySelectorAll(".opt").forEach((o) => {
        o.disabled = true;
        if (status === "skipped") return;
        if (reveal.has(o.dataset.opt)) o.classList.add("right"); else if (sel.has(o.dataset.opt)) o.classList.add("wrong");
      });
      v.innerHTML = status === "skipped"
        ? `<div class="verdict info">${given === "timeup" ? "⏱ Time up" : "Skipped"} — no answer given</div>`
        : ok ? `<div class="verdict ok">✓ Correct (${secs}s)</div>` : `<div class="verdict bad">✗ Wrong — answer: <b>${esc(answerText(q))}</b> (${secs}s)</div>`;
      v.insertAdjacentHTML("beforeend", `<div class="actions" style="margin-top:10px"><button class="btn primary" data-act="next">${i + 1 >= qs.length ? "Finish" : "Next"} <kbd>Enter</kbd></button></div>`);
      if (cfg.auto) nextTimer = setTimeout(advance, ok ? 700 : status === "skipped" ? 1800 : 2200);
    }

    function submit() {
      if (locked) return;
      const q = qs[i];
      const given = q.t === "nat" ? $("#f-nat", root).value : q.t === "msq" ? [...sel].sort() : [...sel][0];
      if (q.t === "nat" ? !String(given).trim() : !sel.size) return;
      const ok = checkAnswer(q, given);
      store.record(q.id, ok, given);
      finishQuestion(ok ? "correct" : "wrong", given);
    }
    const skip = () => { if (!locked) finishQuestion("skipped", "skip"); else advance(); };
    function advance() {
      clearTimeout(nextTimer);
      if (paused) return;
      if (i + 1 >= qs.length) return summary();
      i++;
      render();
    }

    function tick() {
      if (paused) return;
      const now = Date.now();
      const q = qs[i];
      let left, total;
      if (cfg.mode === "total") { left = (sessDeadline - now) / 1000; total = cfg.mins * 60; }
      else { left = (qDeadline - now) / 1000; total = qLimit; }
      const bar = $("#f-bar", root);
      bar.style.width = `${Math.max(0, Math.min(100, (100 * left) / total))}%`;
      bar.className = left < 10 || left / total < 0.2 ? "low" : "";
      $("#f-time", root).textContent = fmt(Math.max(0, Math.ceil(left)));
      if (left <= 0) {
        if (cfg.mode === "total") return summary();
        if (!locked) {
          const has = q.t === "nat" ? String($("#f-nat", root)?.value || "").trim() : sel.size;
          if (has) submit(); else finishQuestion("skipped", "timeup");
        }
      }
    }
    const timer = setInterval(tick, 100);

    function pauseToggle() {
      if (locked && !paused) return;
      paused = !paused;
      const el = $("#f-card", root);
      if (paused) {
        pausedAt = Date.now();
        el.classList.add("paused");
        el.insertAdjacentHTML("afterbegin", `<div class="pause-note">Paused — press Space to resume</div>`);
      } else {
        const d = Date.now() - pausedAt;
        qDeadline += d; sessDeadline += d; qStart += d; sessStart += d;
        el.classList.remove("paused");
        el.querySelector(".pause-note")?.remove();
      }
      $("#f-pause", root).firstChild.textContent = paused ? "Resume " : "Pause ";
    }

    const onKey = (e) => {
      if (!root.isConnected) return cleanup();
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const inNat = e.target.id === "f-nat";
      if (e.target.matches("input, textarea, select") && !inNat) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === " ") { if (!inNat) { e.preventDefault(); pauseToggle(); } return; }
      if (paused) return;
      if (k === "Enter") { e.preventDefault(); locked ? advance() : submit(); return; }
      if (inNat) return;
      if (k === "n") skip();
      else if (k === "Escape") endEarly();
      else if (!locked && /^[1-4]$/.test(k) && +k <= (qs[i].o || []).length) {
        const L = "ABCD"[+k - 1], q = qs[i];
        if (q.t === "msq") { sel.has(L) ? sel.delete(L) : sel.add(L); root.querySelector(`.opt[data-opt="${L}"]`)?.classList.toggle("sel", sel.has(L)); }
        else { sel = new Set([L]); submit(); }
      }
    };
    const onClick = (e) => {
      const t = e.target.closest("button");
      if (!t || paused && t.id !== "f-pause") return;
      if (t.dataset.opt && !locked) {
        const q = qs[i], L = t.dataset.opt;
        if (q.t === "msq") { sel.has(L) ? sel.delete(L) : sel.add(L); t.classList.toggle("sel", sel.has(L)); }
        else { sel = new Set([L]); submit(); }
      } else if (t.dataset.act === "submit") submit();
      else if (t.dataset.act === "skip") skip();
      else if (t.dataset.act === "next") advance();
      else if (t.id === "f-pause") pauseToggle();
      else if (t.id === "f-end") endEarly();
    };
    function endEarly() { if (confirm("End this session now?")) summary(); }
    document.addEventListener("keydown", onKey);
    root.addEventListener("click", onClick);
    cleanup = () => { clearInterval(timer); clearTimeout(nextTimer); document.removeEventListener("keydown", onKey); root.removeEventListener("click", onClick); };

    function summary() {
      cleanup(); cleanup = () => {};
      // anything not reached counts as skipped but is not listed
      const c = results.filter((r) => r.status === "correct").length, w = results.filter((r) => r.status === "wrong").length;
      const skipped = qs.length - c - w;
      const secs = Math.round((Date.now() - sessStart) / 1000);
      const answered = c + w;
      store.addFastSession({ t: Date.now(), branch: b, n: qs.length, correct: c, wrong: w, skipped, secs, mode: cfg.mode });
      const wrongIds = results.filter((r) => r.status === "wrong").map((r) => r.q.id);
      const acc = answered ? Math.round((100 * c) / answered) : 0;
      root.innerHTML = `
        <h1 class="page-title">⚡ Session complete</h1>
        <div class="stats-strip">
          <div class="card"><div class="stat"><b>${c}/${qs.length}</b><span>Correct</span></div></div>
          <div class="card"><div class="stat"><b>${acc}%</b><span>Accuracy (answered)</span></div></div>
          <div class="card"><div class="stat"><b>${fmt(secs)}</b><span>Total time</span></div></div>
          <div class="card"><div class="stat"><b>${answered ? Math.round(results.filter((r) => r.status !== "skipped").reduce((a, r) => a + r.secs, 0) / answered) : 0}s</b><span>Avg per answer</span></div></div>
          <div class="card"><div class="stat"><b>${w} · ${skipped}</b><span>Wrong · skipped</span></div></div>
        </div>
        <div class="actions" style="margin-bottom:16px">
          <button class="btn primary" id="again">⚡ Go again</button>
          <a class="btn ${wrongIds.length ? "" : "disabled"}" href="${wrongIds.length ? `#/${b}/practice?ids=${wrongIds.join(",")}` : "#"}">Practise the ${wrongIds.length} wrong</a>
          <button class="btn" id="setup">Change settings</button>
        </div>
        <div class="card pad"><table class="table"><thead><tr><th>#</th><th>Question</th><th>Result</th><th class="num">Time</th></tr></thead><tbody>${results.map((r, n) => `<tr><td>${n + 1}</td><td><a href="#/${b}/practice?ids=${r.q.id}">${esc(r.q.paper.title.replace("GATE " + b.toUpperCase() + " ", ""))} · ${esc(r.q.ref)}</a></td><td>${r.status === "correct" ? '<span class="tag d1">Correct</span>' : r.status === "wrong" ? '<span class="tag wr">Wrong</span>' : '<span class="tag">Skipped</span>'}</td><td class="num">${r.secs}s</td></tr>`).join("")}</tbody></table></div>`;
      $("#again", root).onclick = start;
      $("#setup", root).onclick = setup;
    }

    render();
  }

  setup();
  return () => stop();
}
