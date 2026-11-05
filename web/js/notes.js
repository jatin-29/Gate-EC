import { esc, $, typeset } from "./util.js";
import { FORMULAS } from "./formulas.js";

const NOTES_HOST = "https://notes.prepfusion.in/rx/";
const pdfUrl = (f) => NOTES_HOST + f.path.split("/").map(encodeURIComponent).join("/") + "?h=" + f.hash;
const cache = {};
async function loadNotes(branch) {
  cache[branch] ||= fetch(`data/notes-${branch}.json?v=${window.BUILD}`).then((r) => (r.ok ? r.json() : { complete: null, subjects: {} })).catch(() => ({ complete: null, subjects: {} }));
  return cache[branch];
}

const pickSubject = (D, params, last) => {
  const want = params.get("s") || (last && last.branch === D.branch && last.subject) || "";
  const ok = D.subjects.filter((s) => FORMULAS[s.id]);
  return ok.find((s) => s.id === want) || ok[0];
};

function chips(D, current, hrefOf) {
  return `<div class="chips subj-chips">${D.subjects
    .filter((s) => FORMULAS[s.id])
    .map((x) => `<a class="chip" aria-pressed="${x.id === current}" style="--accent:${x.color}" href="${hrefOf(x.id)}"><span class="dot2"></span>${esc(x.name)}</a>`)
    .join("")}</div>`;
}

const PRIORITY = { high: "High yield", medium: "Medium", foundation: "Foundation" };
const link = (label, f, cls = "btn") => (f ? `<a class="${cls}" href="${esc(pdfUrl(f))}" target="_blank" rel="noopener">${label}${f.pages ? ` <span class="muted">${f.pages}p</span>` : ""}</a>` : "");

// ---------- Notes hub: PDFs per subject / chapter ----------
export async function notesView(root, D, params, last) {
  const b = D.branch;
  const subject = pickSubject(D, params, last);
  root.innerHTML = `<div class="empty">Loading…</div>`;
  const N = await loadNotes(b);
  const sets = N.subjects[subject.id] || [];
  const href = (id) => `#/${b}/notes?s=${id}`;
  const complete = N.complete;
  root.innerHTML = `
    <h1 class="page-title">Notes &amp; formula sheets · ${esc(subject.name)}</h1>
    <p class="page-sub">Formula sheets you can print, plus short-notes PDFs for each chapter. The PDFs are hosted by PrepFusion and open in a new tab.</p>
    ${chips(D, subject.id, href)}
    <div class="grid-2">
      <div class="card pad">
        <h3>Printable formula sheet</h3>
        <p class="muted" style="margin:6px 0 14px">Key formulas of ${esc(subject.name)}, topic by topic, laid out to print on A4.</p>
        <div class="actions"><a class="btn primary" href="#/${b}/formulas?s=${subject.id}">Open &amp; print</a><a class="btn" href="#/${b}/formulas?s=all">All subjects</a></div>
      </div>
      <div class="card pad">
        <h3>Practise this subject</h3>
        <p class="muted" style="margin:6px 0 14px">After the notes, solve the previous-year questions.</p>
        <div class="actions"><a class="btn" href="#/${b}/practice?s=${subject.id}">Practice</a><a class="btn" href="#/${b}/weightage?s=${subject.id}">Weightage</a></div>
      </div>
    </div>
    ${sets
      .map(
        (set) => `<section class="card pad notes-set">
        <div class="notes-head"><div><h3>${esc(set.title)}</h3><div class="hint">Whole subject</div></div>
          <div class="actions">${link("Short notes (print)", set.files.print)}${link("Tablet", set.files.tablet)}${link("Formula sheet", set.files.formula_sheet)}</div></div>
        ${set.chapters
          .map(
            (c, i) => `<div class="chapter">
            <div class="notes-head"><b>${i + 1}. ${esc(c.title)}</b>
              <div class="actions">${link("Notes", c.files.print, "btn sm")}${link("Tablet", c.files.tablet, "btn sm")}${link("Formulas", c.files.formula_sheet, "btn sm")}</div></div>
            <div class="topic-pills">${c.topics
              .map((t) => `<span class="pill p-${t.priority || "none"}" title="${t.pyqs || 0} PYQs, ${t.marks || 0} marks">${esc(t.title)}${t.priority ? ` · ${PRIORITY[t.priority] || t.priority}` : ""}${t.pyqs ? ` · ${t.pyqs} Q` : ""}</span>`)
              .join("")}</div></div>`
          )
          .join("")}</section>`
      )
      .join("") || `<p class="empty">No PDF notes for this subject in ${b.toUpperCase()}.</p>`}
    ${complete ? `<section class="card pad notes-set"><div class="notes-head"><div><h3>${esc(complete.title)}</h3><div class="hint">Every subject in one PDF</div></div><div class="actions">${link("Short notes (print)", complete.files.print)}${link("Tablet", complete.files.tablet)}${link("All formula sheets", complete.files.formula_sheet)}</div></div></section>` : ""}
    <p class="hint" style="margin-top:12px">“Q” = previous-year questions from that topic; priority comes from how often it was asked.</p>`;
}

// ---------- Printable formula sheet ----------
export function formulasView(root, D, params, last) {
  const b = D.branch;
  const all = params.get("s") === "all";
  const subject = all ? null : pickSubject(D, params, last);
  const subs = all ? D.subjects.filter((s) => FORMULAS[s.id]) : [subject];
  const sheet = (s) => `<section class="sheet" style="--accent:${s.color}">
      <h2>${esc(s.name)}</h2>
      ${FORMULAS[s.id]
        .map(
          (t) => `<div class="ftopic"><h3>${esc(t.t)}</h3><table class="ftable"><tbody>${t.f
            .map(([label, tex]) => `<tr><th>${labelHtml(label)}</th><td>\\(${esc(tex)}\\)</td></tr>`)
            .join("")}</tbody></table></div>`
        )
        .join("")}</section>`;
  root.innerHTML = `
    <div class="no-print">
      <h1 class="page-title">Formula sheet${all ? "s · all subjects" : ` · ${esc(subject.name)}`}</h1>
      <p class="page-sub">GATE ${b.toUpperCase()} · use Print and choose “Save as PDF” to keep a copy. Always cross-check with your textbook.</p>
      ${chips(D, all ? "" : subject.id, (id) => `#/${b}/formulas?s=${id}`)}
      <div class="toolbar"><button class="btn primary" id="print-btn">🖨 Print this sheet</button><a class="btn" href="#/${b}/formulas?s=all">All subjects</a><a class="btn" href="#/${b}/notes?s=${(subject || subs[0]).id}">PDF notes</a></div>
    </div>
    <div class="print-title">GATE ${b.toUpperCase()} — formula sheet${all ? "" : ` · ${esc(subject.name)}`}</div>
    <div class="sheets">${subs.map(sheet).join("")}</div>`;
  $("#print-btn", root).onclick = () => window.print();
  typeset(root.querySelector(".sheets"));
}

// labels may contain inline TeX written as $...$
function labelHtml(label) {
  return esc(label).replace(/\$([^$]+)\$/g, (_, t) => `\\(${t.replace(/\\\\/g, "\\")}\\)`);
}
