// Keyboard shortcuts of the Practice page, listed in one place so the help dialog, the header
// button and the Settings page always agree.
export const SHORTCUTS = [
  ["1 – 4", "Select an option (MSQ: toggles it)"],
  ["Enter", "Check answer · go to the next question once answered"],
  ["S", "Show / hide the answer"],
  ["B", "Bookmark / un-bookmark"],
  ["N or →", "Next question"],
  ["P or ←", "Previous question"],
  ["T", "Open notes"],
  ["R", "Random question"],
  ["Esc", "Leave a text box / close a dialog"],
  ["?", "Show this list"],
];

export const shortcutRows = () => SHORTCUTS.map(([k, d]) => `<tr><td><kbd>${k}</kbd></td><td>${d}</td></tr>`).join("");

export function showShortcuts() {
  if (document.querySelector(".lightbox.help")) return;
  const o = document.createElement("div");
  o.className = "lightbox help";
  o.innerHTML = `<div class="card pad" onclick="event.stopPropagation()"><h3 style="margin-bottom:10px">Keyboard shortcuts</h3>
    <table class="table"><tbody>${shortcutRows()}</tbody></table>
    <p class="hint" style="margin-top:10px">Work on the Practice page. They pause while you type in a box. Click anywhere or press Esc to close.</p></div>`;
  const close = () => { o.remove(); document.removeEventListener("keydown", onEsc, true); };
  const onEsc = (e) => { if (e.key === "Escape" || e.key === "?") { e.stopPropagation(); e.preventDefault(); close(); } };
  o.onclick = close;
  document.addEventListener("keydown", onEsc, true);
  document.body.append(o);
}
