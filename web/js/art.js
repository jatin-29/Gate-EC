// Small animated SVG scenes for the subject cards. Colours come from the card's --accent via CSS
// (see .subject-art in app.css); motion is plain CSS and is switched off for prefers-reduced-motion.
const sine = (n, amp = 26) => `M0 40 q12.5 -${amp} 25 0 t25 0` + " t25 0".repeat(n - 1);

const SCENES = {
  "engineering-mathematics": `
    <path class="m" d="M10 40H190M20 10V70"/>
    <path class="draw" d="M20 40 C45 2 65 2 85 40 S125 78 145 40 S175 6 190 30"/>
    <text class="f t" x="132" y="72">∫ f(x) dx</text>
    <circle class="f pulse" cx="85" cy="40" r="3"/>`,

  "network-theory": `
    <path class="flow" d="M40 22H160V62H40Z"/>
    <rect class="bg" x="92" y="14" width="26" height="16" rx="2"/>
    <path d="M96 22l3 -5 4 10 4 -10 4 10 3 -5"/>
    <path d="M34 36V48M42 30V54" /><circle class="f pulse" cx="160" cy="42" r="7"/>`,

  "signals-and-systems": `
    <clipPath id="c-ss"><rect x="10" y="8" width="180" height="64"/></clipPath>
    <g clip-path="url(#c-ss)"><g class="slide"><path d="${sine(10)}" transform="translate(0 0)"/></g></g>
    <path class="m" d="M10 40H190"/>
    <g class="m blink"><path d="M40 40V26M65 40V54M90 40V26M115 40V54M140 40V26M165 40V54"/></g>`,

  "electronic-devices-circuits": `
    <rect class="soft" x="30" y="20" width="70" height="40" rx="4"/><rect class="soft2" x="100" y="20" width="70" height="40" rx="4"/>
    <path class="m" d="M92 14V66M108 14V66" stroke-dasharray="3 3"/>
    <text class="f t" x="58" y="45">P</text><text class="f t" x="130" y="45">N</text>
    <circle class="f cross" cx="42" cy="32" r="3"/><circle class="f cross d1" cx="42" cy="50" r="3"/>
    <circle class="m cross2" cx="158" cy="32" r="3"/><circle class="m cross2 d1" cx="158" cy="50" r="3"/>`,

  "analog-electronics": `
    <clipPath id="c-ae1"><rect x="8" y="22" width="50" height="36"/></clipPath><clipPath id="c-ae2"><rect x="144" y="12" width="50" height="56"/></clipPath>
    <path d="M62 14V66L128 40Z"/><path class="m" d="M62 28h-8M62 52h-8M128 40h14"/>
    <g clip-path="url(#c-ae1)"><g class="slide fast"><path d="M0 40 q6.25 -12 12.5 0 t12.5 0 t12.5 0 t12.5 0 t12.5 0 t12.5 0 t12.5 0 t12.5 0 t12.5 0 t12.5 0"/></g></g>
    <g clip-path="url(#c-ae2)"><g class="slide fast2"><path d="M0 40 q6.25 -28 12.5 0 t12.5 0 t12.5 0 t12.5 0 t12.5 0 t12.5 0 t12.5 0 t12.5 0 t12.5 0 t12.5 0"/></g></g>`,

  "digital-electronics": `
    <path d="M70 18H92C118 18 118 62 92 62H70Z"/><path class="m" d="M52 28H70M52 52H70M112 40H168"/>
    <rect class="f bit" x="38" y="22" width="14" height="12" rx="2"/><rect class="f bit d1" x="38" y="46" width="14" height="12" rx="2"/>
    <path class="flow" d="M116 40H168"/><circle class="f bit d2" cx="176" cy="40" r="7"/>`,

  "control-systems": `
    <path class="m" d="M20 70H190M20 10V70"/><path class="m" d="M20 32H190" stroke-dasharray="3 4"/>
    <path class="draw slow" d="M20 70H40V12C52 6 58 56 72 40S92 26 106 34 124 31 136 32H190"/>
    <path class="flow" d="M150 14h30v10M150 14l6 -4M150 14l6 4"/>`,

  "communication-systems": `
    <path d="M40 66V30M30 66h20M40 30l-10 14M40 30l10 14"/><circle class="f pulse" cx="40" cy="26" r="3"/>
    <path class="arc" d="M58 14a28 28 0 0 1 0 24"/><path class="arc d1" d="M58 14a28 28 0 0 1 0 24"/><path class="arc d2" d="M58 14a28 28 0 0 1 0 24"/>
    <clipPath id="c-cm"><rect x="108" y="10" width="84" height="60"/></clipPath>
    <g clip-path="url(#c-cm)"><g class="slide"><path d="M0 40 q4 -26 8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0" transform="translate(100 0)"/></g></g>`,

  "electromagnetic-fields": `
    <path class="flow" d="M62 40C80 6 120 6 138 40M62 40C80 74 120 74 138 40M62 40C85 26 115 26 138 40M62 40C85 54 115 54 138 40"/>
    <circle class="soft pulse" cx="56" cy="40" r="11"/><circle class="soft2 pulse d1" cx="144" cy="40" r="11"/>
    <text class="f t" x="51" y="45">+</text><text class="f t" x="139" y="45">−</text>`,

  "electrical-machines": `
    <path class="m" d="M60 62a40 40 0 0 1 80 0"/><path class="m" d="M52 14a42 42 0 0 1 96 0" opacity="0"/>
    <circle class="m" cx="100" cy="40" r="34"/>
    <g class="spin"><circle cx="100" cy="40" r="8" class="soft"/><path d="M100 8V32M100 48V72M68 40H92M108 40H132"/><circle class="f" cx="100" cy="10" r="3.5"/></g>`,

  "power-systems": `
    <path class="m" d="M10 66H190"/>
    <g><path d="M40 66L50 20L60 66M44 46H56M46 34H54M36 24H64"/><path d="M100 66L110 20L120 66M104 46H116M106 34H114M96 24H124"/><path d="M160 66L170 20L180 66M164 46H176M166 34H174M156 24H184"/></g>
    <path class="flow" d="M36 24Q75 48 96 24M124 24Q150 48 156 24M10 24Q24 34 36 24"/>
    <path class="f bolt" d="M82 8l-8 14h8l-6 12 14 -16h-8l6 -10z"/>`,

  "power-electronics": `
    <clipPath id="c-pe"><rect x="10" y="10" width="180" height="60"/></clipPath>
    <g clip-path="url(#c-pe)"><g class="slide"><path d="M0 62H8V22H28V62H40H48V22H68V62H80H88V22H108V62H120H128V22H148V62H160H168V22H188V62H200H208V22H228V62H240H248V22H268V62H280"/></g></g>
    <path class="m" d="M10 66H190M10 10V66"/>`,

  "measurements": `
    <path class="m" d="M30 64a70 70 0 0 1 140 0"/><path class="m" d="M44 52l-5 -4M70 32l-3 -5M100 24V17M130 32l3 -5M156 52l5 -4"/>
    <g class="swing"><path d="M100 64L100 26"/></g><circle class="f" cx="100" cy="64" r="5"/><rect class="m" x="30" y="64" width="140" height="6" rx="3"/>`,

  "general-aptitude": `
    <path class="m" d="M30 70H170"/>
    <rect class="f bar" x="40" y="36" width="16" height="34" rx="2"/><rect class="f bar d1" x="66" y="22" width="16" height="48" rx="2"/>
    <rect class="f bar d2" x="92" y="44" width="16" height="26" rx="2"/><rect class="f bar d3" x="118" y="14" width="16" height="56" rx="2"/>
    <rect class="f bar d4" x="144" y="30" width="16" height="40" rx="2"/>`,
};

export function subjectArt(id) {
  const body = SCENES[id] || SCENES["engineering-mathematics"];
  return `<svg viewBox="0 0 200 80" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">${body}</svg>`;
}
