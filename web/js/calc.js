import { $, icons } from "./util.js";

// Small scientific calculator; expressions are parsed by hand (no eval).
function evaluate(src, deg) {
  const toks = src.match(/\d*\.?\d+(?:e[+-]?\d+)?|[a-z]+|[-+*/^()!,%]/gi);
  if (!toks) return NaN;
  let i = 0;
  const rad = (x) => (deg ? (x * Math.PI) / 180 : x);
  const unrad = (x) => (deg ? (x * 180) / Math.PI : x);
  const fns = {
    sin: (x) => Math.sin(rad(x)), cos: (x) => Math.cos(rad(x)), tan: (x) => Math.tan(rad(x)),
    asin: (x) => unrad(Math.asin(x)), acos: (x) => unrad(Math.acos(x)), atan: (x) => unrad(Math.atan(x)),
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    ln: Math.log, log: Math.log10, sqrt: Math.sqrt, exp: Math.exp, abs: Math.abs,
  };
  const consts = { pi: Math.PI, e: Math.E };
  const peek = () => toks[i];
  function expr() {
    let v = term();
    while (peek() === "+" || peek() === "-") v = toks[i++] === "+" ? v + term() : v - term();
    return v;
  }
  function term() {
    let v = unary();
    while (peek() === "*" || peek() === "/" || (peek() && (/^[a-z(]/i.test(peek()) || /^\d/.test(peek())))) {
      if (peek() === "*") { i++; v *= unary(); }
      else if (peek() === "/") { i++; v /= unary(); }
      else v *= unary(); // implicit multiplication: 2pi, 3(4+1)
    }
    return v;
  }
  function unary() {
    if (peek() === "-") { i++; return -unary(); }
    if (peek() === "+") { i++; return unary(); }
    return power();
  }
  function power() {
    const base = postfix();
    if (peek() === "^") { i++; return Math.pow(base, unary()); }
    return base;
  }
  function postfix() {
    let v = atom();
    while (peek() === "!" || peek() === "%") {
      if (toks[i++] === "!") { let r = 1; for (let k = 2; k <= Math.round(v); k++) r *= k; v = r; }
      else v /= 100;
    }
    return v;
  }
  function atom() {
    const t = toks[i++];
    if (t === undefined) throw new Error("incomplete");
    if (t === "(") { const v = expr(); if (peek() === ")") i++; return v; }
    if (/^\d|^\./.test(t)) return parseFloat(t);
    const name = t.toLowerCase();
    if (name in consts) return consts[name];
    if (name in fns) return fns[name](power());
    throw new Error("unknown " + t);
  }
  const v = expr();
  if (i < toks.length) throw new Error("unexpected");
  return v;
}

export function mountCalculator() {
  const fab = document.createElement("button");
  fab.className = "calc-fab";
  fab.title = "Scientific calculator";
  fab.setAttribute("aria-label", "Open calculator");
  fab.innerHTML = icons.calc;
  const box = document.createElement("div");
  box.className = "card calc";
  let deg = true;
  const keys = [
    ["sin(", "fn"], ["cos(", "fn"], ["tan(", "fn"], ["ln(", "fn"], ["log(", "fn"],
    ["asin(", "fn"], ["acos(", "fn"], ["atan(", "fn"], ["exp(", "fn"], ["sqrt(", "fn"],
    ["pi", "fn"], ["e", "fn"], ["(", "fn"], [")", "fn"], ["^", "op"],
    ["7"], ["8"], ["9"], ["/", "op"], ["C", "op"],
    ["4"], ["5"], ["6"], ["*", "op"], ["⌫", "op"],
    ["1"], ["2"], ["3"], ["-", "op"], ["ans", "fn"],
    ["0"], ["."], ["E", "fn"], ["+", "op"], ["=", "eq"],
  ];
  box.innerHTML = `<div class="calc-top"><span>Scientific calculator</span><span><button class="btn" id="cdeg" style="padding:3px 9px">DEG</button></span></div>
    <input class="calc-screen" id="cin" autocomplete="off" spellcheck="false" aria-label="Expression">
    <div class="calc-out" id="cout">0</div>
    <div class="calc-keys">${keys.map(([k, c]) => `<button class="${c || ""}" data-k="${k}">${k.replace("(", "").replace("sqrt", "√")}</button>`).join("")}</div>`;
  document.body.append(fab, box);
  const input = $("#cin", box), out = $("#cout", box);
  let ans = 0;
  const calc = () => {
    if (!input.value.trim()) return;
    try {
      const v = evaluate(input.value.replace(/ans/gi, `(${ans})`).replace(/(\d)E([+-]?\d)/g, "$1e$2"), deg);
      if (!Number.isFinite(v)) throw new Error("NaN");
      ans = v;
      out.textContent = String(+v.toPrecision(12));
    } catch {
      out.textContent = "Error";
    }
  };
  box.addEventListener("click", (e) => {
    const k = e.target.dataset.k;
    if (e.target.id === "cdeg") { deg = !deg; e.target.textContent = deg ? "DEG" : "RAD"; return; }
    if (!k) return;
    if (k === "C") { input.value = ""; out.textContent = "0"; }
    else if (k === "⌫") input.value = input.value.slice(0, -1);
    else if (k === "=") calc();
    else input.value += k;
    input.focus();
  });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") calc(); e.stopPropagation(); });
  fab.onclick = () => { box.classList.toggle("open"); if (box.classList.contains("open")) input.focus(); };
}
