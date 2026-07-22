/* ============================================================
   LLaMat paper-tour deck widgets.
   All numbers from arXiv:2412.09560 (tables cited per slide).
   Requires lib.js (cssVar) loaded first; classic script.
   ============================================================ */
"use strict";

/* ---------- shared helpers (lm- prefix) ---------- */
const LM_NS = "http://www.w3.org/2000/svg";
function lmAdd(parent, tag, attrs, text) {
  const e = document.createElementNS(LM_NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text != null) e.textContent = text;
  parent.appendChild(e);
  return e;
}
/* grouped bar chart.
   cfg: { groups: [{label, bars: [{name, v, color, op, short, title}]}],
          yMax, yMin, tick, fmt, nameUnder, legend, h, label, note } */
function lmBars(el, cfg) {
  el.innerHTML = "";
  const groups = cfg.groups;
  const W = cfg.w || 760;
  const showLegend = cfg.legend === true;
  const legH = showLegend ? 22 : 0;
  const H = cfg.h || 320;
  const mL = 46, mR = 8, mT = 16 + legH;
  let mB = 12;
  if (cfg.nameUnder) mB = 58;
  else if (groups.some(g => g.label)) mB = 30;
  if (!cfg.nameUnder && groups.some(g => g.bars.some(b => b.short))) mB += 14;
  const iw = W - mL - mR, ih = H - mT - mB;
  const yMin = cfg.yMin || 0, yMax = cfg.yMax;
  const Y = v => mT + (1 - (v - yMin) / (yMax - yMin)) * ih;
  const fmt = cfg.fmt || (v => (Math.abs(v) < 10 && v % 1 !== 0 ? v.toFixed(v < 1 ? 3 : 2) : String(Math.round(v * 100) / 100)));
  const svg = document.createElementNS(LM_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", cfg.label || "bar chart");
  svg.style.width = "100%";
  // y grid + ticks
  const step = cfg.tick || (yMax - yMin) / 4;
  for (let v = yMin; v <= yMax + 1e-9; v += step) {
    lmAdd(svg, "line", { x1: mL, x2: W - mR, y1: Y(v), y2: Y(v), stroke: "var(--grid)", "stroke-width": 1 });
    lmAdd(svg, "text", { x: mL - 6, y: Y(v) + 4, "text-anchor": "end", "font-size": 11, fill: "var(--muted)" }, fmt(v));
  }
  lmAdd(svg, "line", { x1: mL, x2: W - mR, y1: Y(yMin), y2: Y(yMin), stroke: "var(--muted)", "stroke-width": 1 });
  const gw = iw / groups.length;
  groups.forEach((g, gi) => {
    const n = g.bars.length;
    const bw = Math.min(gw * 0.82 / n, 70);
    const gap = Math.min(5, bw * 0.2);
    const total = n * bw + (n - 1) * gap;
    const x0 = mL + gi * gw + (gw - total) / 2;
    g.bars.forEach((b, bi) => {
      const x = x0 + bi * (bw + gap);
      const y = Y(Math.max(yMin, Math.min(yMax, b.v)));
      const r = lmAdd(svg, "rect", {
        x: x.toFixed(1), y: y.toFixed(1), width: bw.toFixed(1),
        height: Math.max(0.5, Y(yMin) - y).toFixed(1),
        rx: 3, fill: b.color, opacity: b.op ?? 1
      });
      lmAdd(r, "title", {}, `${b.name}: ${b.title || fmt(b.v)}`);
      if (bw >= 26) {
        lmAdd(svg, "text", {
          x: (x + bw / 2).toFixed(1), y: (y - 5).toFixed(1), "text-anchor": "middle",
          "font-size": 10.5, "font-weight": 600, fill: "var(--ink-2)"
        }, fmt(b.v));
      }
      if (b.short) {
        lmAdd(svg, "text", {
          x: (x + bw / 2).toFixed(1), y: Y(yMin) + 13, "text-anchor": "middle",
          "font-size": 10, fill: "var(--muted)"
        }, b.short);
      }
      if (cfg.nameUnder) {
        const cx = x + bw / 2 + 3, ty = Y(yMin) + 14;
        lmAdd(svg, "text", {
          x: cx.toFixed(1), y: ty, "text-anchor": "end", "font-size": 10.5,
          fill: "var(--muted)", transform: `rotate(-26 ${cx.toFixed(1)} ${ty})`
        }, b.name);
      }
    });
    if (g.label) lmAdd(svg, "text", {
      x: mL + gi * gw + gw / 2, y: H - 8, "text-anchor": "middle",
      "font-size": 12, "font-weight": 600, fill: "var(--ink-2)"
    }, g.label);
  });
  if (showLegend) {
    let x = mL;
    groups[0].bars.forEach(b => {
      lmAdd(svg, "rect", { x, y: 4, width: 10, height: 10, rx: 2, fill: b.color, opacity: b.op ?? 1 });
      lmAdd(svg, "text", { x: x + 14, y: 13, "font-size": 11, fill: "var(--ink-2)" }, b.name);
      x += 14 + b.name.length * 6.1 + 16;
    });
  }
  el.appendChild(svg);
}
function lmSeg(segEl, onPick) {
  const btns = Array.from(segEl.querySelectorAll("button"));
  btns.forEach((b, i) => b.addEventListener("click", () => {
    btns.forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", String(x === b)); });
    onPick(i);
  }));
}
const LM_C1 = "var(--accent)", LM_C2 = "var(--accent-2)", LM_C3 = "var(--accent-3)",
      LM_C4 = "var(--accent-4)", LM_C5 = "var(--accent-5)", LM_CM = "var(--muted)";

/* ---------- w1: three-stage pipeline (slide 4) ---------- */
(function wPipe() {
  const detail = document.getElementById("lm-pipe-detail");
  if (!detail) return;
  const stages = [
    `<b>Continued pretraining (CPT) on R2CID.</b> 4M+ full-text papers from ~500 Elsevier + 300 Springer
     journals (<b>94.43%</b> of tokens) · 470k CIF crystal files from Materials Project, GNoME and AMCSD,
     with RoboCrystallographer text descriptions (<b>2.50%</b>) · MatSci community forum discourse (<b>0.019%</b>)
     · a ~0.96B-token RedPajama replay slice (<b>3.05%</b>, Table D.1; the paper's §4.1.1 text says ~700M) against catastrophic forgetting.
     Budget: <b>31.5B</b> train tokens for LLaMat-2 (8×A100 80GB, ~17 days), <b>10.9B</b> for LLaMat-3
     (2× Cerebras CS-2, ~3 days).`,
    `<b>Tri-phase instruction finetuning → LLaMat-Chat.</b> Phase I: <b>OpenOrca</b> (576k pairs, 1 epoch)
     for general instruction following — dataset size Pareto-optimized per base (448k best for LLaMat-2).
     Phase II: <b>MathQA</b> (7.5k problems, 3 epochs) — ablations without it fail elementary arithmetic.
     Phase III: materials instructions — <b>MatSciInstruct 52.7k · MatSciNLP 19.9k · MatBookQA 2.0k ·
     MaScQA 1,022×4</b>. LR 2·10⁻⁶ → 2·10⁻⁵, cosine decay (Megatron-LLM).`,
    `<b>Task specialization.</b> <i>LLaMat-Chat:</i> 2 epochs on the combined MatNLP + MatSIE training sets
     (LR 10⁻⁵) → a materials-research copilot for NER, relation extraction, and text/table → JSON.
     <i>LLaMat-CIF:</i> instruction finetuning on <b>~6.94M</b> syntactic + semantic CIF tasks
     (atom counting, cell volumes, MASK infilling, stability-conditioned generation), then <b>PEFT</b>
     for crystal structure generation.`
  ];
  const btns = [0, 1, 2].map(i => document.getElementById("lm-pipe-" + i));
  function pick(i) {
    btns.forEach((b, j) => b.classList.toggle("on", i === j));
    detail.innerHTML = stages[i];
  }
  btns.forEach((b, i) => b.addEventListener("click", () => pick(i)));
  pick(0);
})();

/* ---------- w2: data-mix bar (slide 5) ---------- */
(function wMix() {
  const bar = document.getElementById("lm-mix-bar");
  if (!bar) return;
  const read = document.getElementById("lm-mix-read");
  const slices = [
    { name: "Peer-reviewed papers", pct: 94.431, color: LM_C1,
      txt: "<b>Peer-reviewed papers — 94.431%</b> · 29.8B tokens (LLaMat-2 run). 4M+ articles, ~500 Elsevier + 300 Springer journals, selected for materials relevance; references replaced by [BIB_REF]-style tokens." },
    { name: "RedPajama", pct: 3.051, color: LM_C3,
      txt: "<b>RedPajama replay — 3.051%</b> · ~0.96B tokens of LLaMA's original corpus, interleaved to prevent catastrophic forgetting of general English." },
    { name: "CIF", pct: 2.499, color: LM_C2,
      txt: "<b>Crystallographic information files — 2.499%</b> · ~0.79B tokens from 470k CIFs (Materials Project, GNoME, AMCSD), placed in the final 10% of pretraining." },
    { name: "MatSci discourse", pct: 0.019, color: "var(--neg)",
      txt: "<b>MatSci community discourse — 0.019%</b> · ~6.0M tokens of forum Q&A about materials science. Tiny, but real practitioner language." }
  ];
  const defaultTxt = "Hover a slice for its role. Percentages from the Fig. 1 pie; token counts from Table D.1 (LLaMat-2 training split).";
  let mode = 0;
  function widths() {
    if (mode === 0) return slices.map(s => s.pct);
    const w = slices.map(s => Math.pow(s.pct, 0.3));
    const t = w.reduce((a, b) => a + b, 0);
    return w.map(v => v / t * 100);
  }
  function render() {
    bar.innerHTML = "";
    const ws = widths();
    slices.forEach((s, i) => {
      const d = document.createElement("div");
      d.className = "lm-segp";
      d.style.width = ws[i] + "%";
      d.style.background = s.color;
      if (ws[i] > 9) d.innerHTML = `<span>${s.name} ${s.pct}%</span>`;
      d.addEventListener("mouseenter", () => { read.innerHTML = s.txt; });
      d.addEventListener("click", () => { read.innerHTML = s.txt; });
      bar.appendChild(d);
    });
  }
  bar.addEventListener("mouseleave", () => { read.innerHTML = defaultTxt; });   // once, not per render
  read.innerHTML = defaultTxt;
  lmSeg(document.getElementById("lm-mix-seg"), i => { mode = i; render(); });
  render();
})();

/* ---------- w3: MatNLP chart (slide 7) ---------- */
(function wNlp() {
  const el = document.getElementById("lm-nlp-chart");
  if (!el) return;
  // Table E.1/E.2 mean rows: [name, color, opacity, micro, macro]
  const means = [
    ["LLaMat-2-chat", LM_C1, 1, 93.33, 88.74],
    ["LLaMat-3-chat", LM_C2, 1, 93.03, 88.46],
    ["LLaMA-2-chat-FT", LM_CM, 1, 92.30, 87.40],
    ["LLaMA-3-chat-FT", LM_CM, 0.55, 86.23, 78.78],
    ["GPT-4o", LM_C3, 1, 68.25, 62.42],
    ["GPT-4", LM_C3, 0.55, 60.04, 54.01],
    ["Claude-3.5-Sonnet", LM_C5, 1, 66.59, 62.16],
    ["Gemini-1.5-Pro", LM_C4, 1, 59.72, 54.04]
  ];
  // Table E.2 per-task micro-F1, models: LLaMat-2-chat, LLaMat-3-chat, Claude-3.5-Sonnet, GPT-4o
  const tasks = [
    ["Matscholar NER", [85.22, 88.68, 37.92, 20.46]],
    ["Glass classif.", [93.33, 94.33, 60.33, 74]],
    ["Synthesis actions", [96.68, 96.44, 75.07, 68.23]],
    ["MatSci relation extr.", [100, 100, 100, 98.3]]
  ];
  const taskModels = [
    ["LLaMat-2-chat", LM_C1, 1], ["LLaMat-3-chat", LM_C2, 1],
    ["Claude-3.5-Sonnet", LM_C5, 1], ["GPT-4o", LM_C3, 1]
  ];
  function render(mode) {
    if (mode < 2) {
      lmBars(el, {
        label: "MatNLP mean F1 across models",
        yMax: 100, tick: 25,
        nameUnder: true, h: 330,
        groups: [{ label: "", bars: means.map(m => ({ name: m[0], color: m[1], op: m[2], v: mode === 0 ? m[3] : m[4] })) }],
        fmt: v => String(Math.round(v * 100) / 100)
      });
    } else {
      lmBars(el, {
        label: "Selected MatNLP tasks, micro-F1",
        yMax: 100, tick: 25, legend: true, h: 330,
        groups: tasks.map(t => ({
          label: t[0],
          bars: taskModels.map((m, i) => ({ name: m[0], color: m[1], op: m[2], v: t[1][i] }))
        })),
        fmt: v => String(Math.round(v * 100) / 100)
      });
    }
  }
  lmSeg(document.getElementById("lm-nlp-seg"), render);
  render(0);
})();

/* ---------- w4: SIE from text (slide 8) ---------- */
(function wSie() {
  const el = document.getElementById("lm-sie-chart");
  if (!el) return;
  // Table E.1 (SIE Doping, F1): LLaMat-2-chat, LLaMat-3-chat, LLaMA-2-chat-FT, LLaMA-3-chat-FT
  const dopingModels = [
    ["LLaMat-2-chat", LM_C1, 1], ["LLaMat-3-chat", LM_C2, 1],
    ["LLaMA-2-chat-FT", LM_CM, 1], ["LLaMA-3-chat-FT", LM_CM, 0.55]
  ];
  const dopingTasks = [
    ["base materials (NER)", [0.836, 0.818, 0.843, 0.865]],
    ["dopants (NER)", [0.859, 0.908, 0.823, 0.870]],
    ["host–dopant triplets (RE)", [0.763, 0.782, 0.751, 0.749]]
  ];
  // exact-match, Tables E.1–E.2
  const exact = [
    ["LLaMat-3-chat", LM_C2, 1, 0.619],
    ["LLaMat-2-chat", LM_C1, 1, 0.571],
    ["LLaMA-2-FT", LM_CM, 1, 0.603],
    ["Gemini-1.5-Pro", LM_C4, 1, 0.397],
    ["GPT-4o", LM_C3, 1, 0.371],
    ["Claude-3-Opus", LM_C5, 0.6, 0.371],
    ["Claude-3.5-Sonnet", LM_C5, 1, 0.311],
    ["GPT-4", LM_C3, 0.55, 0.148],
    ["Claude-3-Haiku", LM_C5, 0.35, 0.138]
  ];
  function render(mode) {
    if (mode === 0) {
      lmBars(el, {
        label: "Doping extraction F1 by task",
        yMax: 1, tick: 0.25, legend: true, h: 320,
        groups: dopingTasks.map(t => ({
          label: t[0],
          bars: dopingModels.map((m, i) => ({ name: m[0], color: m[1], op: m[2], v: t[1][i] }))
        })),
        fmt: v => v.toFixed(2)
      });
    } else {
      lmBars(el, {
        label: "Doping full-record exact match",
        yMax: 0.7, tick: 0.175, nameUnder: true, h: 320,
        groups: [{ label: "", bars: exact.map(m => ({ name: m[0], color: m[1], op: m[2], v: m[3] })) }],
        fmt: v => v.toFixed(2)
      });
    }
  }
  lmSeg(document.getElementById("lm-sie-seg"), render);
  render(0);
})();

/* ---------- w5: DiSCoMaT tables (slide 9) ---------- */
(function wTab() {
  const el = document.getElementById("lm-tab-chart");
  if (!el) return;
  // Table E.2, DiSCoMaT accuracy: LLaMat-2-chat, LLaMat-3-chat, Claude-3.5-Sonnet, Gemini-1.5-Pro, GPT-4o
  const models = [
    ["LLaMat-2-chat", LM_C1, 1], ["LLaMat-3-chat", LM_C2, 1],
    ["Claude-3.5-Sonnet", LM_C5, 1], ["Gemini-1.5-Pro", LM_C4, 1], ["GPT-4o", LM_C3, 1]
  ];
  const tasks = [
    ["table classif.", [0.87, 0.846, 0.852, 0.846, 0.796]],
    ["regex table", [0.878, 0.836, 0.400, 0.439, 0.414]],
    ["material ID", [0.872, 0.772, 0.957, 0.948, 0.696]],
    ["composition", [0.595, 0.245, 0.814, 0.827, 0.723]],
    ["chemical labels", [0.704, 0.508, 0.723, 0.755, 0.602]]
  ];
  const exact = [
    ["LLaMat-2-chat", LM_C1, 1, 0.751, "547 / 728 tables"],
    ["LLaMat-3-chat", LM_C2, 1, 0.673, "405 / 602 tables"],
    ["Gemini-1.5-Pro", LM_C4, 1, 0.198, "146 / 737 tables"],
    ["Claude-3.5-Sonnet", LM_C5, 1, 0.089, "65 / 734 tables"],
    ["GPT-4o", LM_C3, 1, 0.071, "52 / 737 tables"],
    ["Claude-3-Haiku", LM_C5, 0.35, 0.0, "0 / 732 tables"]
  ];
  function render(mode) {
    if (mode === 0) {
      lmBars(el, {
        label: "DiSCoMaT per-task accuracy",
        yMax: 1, tick: 0.25, legend: true, h: 330,
        groups: tasks.map(t => ({
          label: t[0],
          bars: models.map((m, i) => ({ name: m[0], color: m[1], op: m[2], v: t[1][i] }))
        })),
        fmt: v => v.toFixed(2)
      });
    } else {
      lmBars(el, {
        label: "DiSCoMaT full-table exact match",
        yMax: 0.8, tick: 0.2, nameUnder: true, h: 330,
        groups: [{ label: "", bars: exact.map(m => ({ name: m[0], color: m[1], op: m[2], v: m[3], title: m[4] })) }],
        fmt: v => Math.round(v * 100) + "%"
      });
    }
  }
  lmSeg(document.getElementById("lm-tab-seg"), render);
  render(0);
})();

/* ---------- w6: crystal generation metrics (slide 10) ---------- */
(function wCif() {
  const el = document.getElementById("lm-cif-chart");
  if (!el) return;
  const read = document.getElementById("lm-cif-read");
  // Table 1: CDVAE, LLaMA-2-7B PEFT (t=0.7), LLaMA-2-13B PEFT (t=0.7), LLaMat-2-CIF, LLaMat-3-CIF
  const models = [
    ["CDVAE", LM_C5, 0.8], ["LLaMA-2-7B PEFT", LM_CM, 0.55], ["LLaMA-2-13B PEFT", LM_CM, 1],
    ["LLaMat-2-CIF", LM_C1, 1], ["LLaMat-3-CIF", LM_C2, 1]
  ];
  const segs = [
    {
      groups: [
        ["structural validity", [1.000, 0.964, 0.955, 0.878, 0.674]],
        ["compositional validity", [0.867, 0.933, 0.924, 0.995, 0.693]]
      ],
      yMax: 1, tick: 0.25, fmt: v => v.toFixed(3),
      note: "Can the text be parsed into a charge-neutral, non-overlapping crystal? <b>LLaMat-2-CIF hits 0.995 compositional validity</b>; LLaMat-3-CIF collapses to 0.693 despite the identical adaptation."
    },
    {
      groups: [
        ["coverage recall", [0.991, 0.911, 0.889, 0.986, 0.925]],
        ["coverage precision", [0.995, 0.949, 0.979, 0.996, 0.994]]
      ],
      yMax: 1, tick: 0.25, fmt: v => v.toFixed(3),
      note: "Similarity of the generated ensemble to held-out test materials: LLaMat-2-CIF reaches <b>0.986 recall / 0.996 precision</b>."
    },
    {
      groups: [["% predicted stable by M3GNet", [28.8, 35.0, 38.0, 49.49, 42.95]]],
      yMax: 60, tick: 15, fmt: v => v + "%",
      note: "Share of 10,000 generated structures with predicted energy &lt; 0.1 eV/atom above hull: <b>LLaMat-2-CIF 49.49%</b> — best in table, +11 pts over the strongest PEFT-LLaMA baseline."
    },
    {
      groups: [
        ["Wasserstein dist., density ρ", [0.688, 3.610, 2.130, 0.623, 12.355]],
        ["Wasserstein dist., #elements", [1.43, 1.06, 0.10, 0.023, 0.261]]
      ],
      yMax: 13, tick: 3.25, fmt: v => String(v),
      note: "Distance between generated and test property distributions — <b>lower is better</b>. LLaMat-2-CIF: ρ 0.623, N<sub>el</sub> 0.023. LLaMat-3-CIF drifts to ρ 12.355 (it favors sprawling 24–32-element compositions)."
    }
  ];
  function render(i) {
    const s = segs[i];
    lmBars(el, {
      label: "crystal generation metrics",
      yMax: s.yMax, tick: s.tick, legend: true, h: 300,
      groups: s.groups.map(g => ({
        label: g[0],
        bars: models.map((m, j) => ({ name: m[0], color: m[1], op: m[2], v: g[1][j] }))
      })),
      fmt: s.fmt
    });
    read.innerHTML = s.note;
  }
  lmSeg(document.getElementById("lm-cif-seg"), render);
  render(0);
})();

/* ---------- w7: periodic-table coverage (slide 11) ---------- */
(function wPt() {
  const grid = document.getElementById("lm-pt-grid");
  if (!grid) return;
  const read = document.getElementById("lm-pt-read");
  const rows = [
    [1, 1, "H:p"], [1, 18, "He:x"],
    [2, 1, "Li:p Be:p"], [2, 13, "B:p C:p N:p O:o F:p Ne:x"],
    [3, 1, "Na:p Mg:p"], [3, 13, "Al:p Si:p P:p S:p Cl:p Ar:x"],
    [4, 1, "K:p Ca:p Sc:t Ti:t V:t Cr:t Mn:t Fe:t Co:t Ni:t Cu:t Zn:t Ga:p Ge:p As:p Se:p Br:p Kr:x"],
    [5, 1, "Rb:p Sr:p Y:t Zr:t Nb:t Mo:t Tc:t Ru:t Rh:t Pd:t Ag:t Cd:t In:p Sn:p Sb:p Te:p I:p Xe:x"],
    [6, 1, "Cs:p Ba:p Lu:t Hf:t Ta:t W:t Re:t Os:t Ir:t Pt:t Au:t Hg:t Tl:p Pb:p Bi:p Po:p At:x Rn:x"],
    [7, 1, "Fr:x Ra:x Lr:x Rf:x Db:x Sg:x Bh:x Hs:x Mt:x Ds:x Rg:x Cn:x Nh:x Fl:x Mc:x Lv:x Ts:x Og:x"],
    [9, 4, "La:p Ce:p Pr:p Nd:p Pm:p Sm:p Eu:p Gd:p Tb:p Dy:p Ho:p Er:p Tm:p Yb:p"],
    [10, 4, "Ac:a Th:a Pa:a U:a Np:a Pu:a Am:a Cm:a Bk:a Cf:a Es:a Fm:a Md:a No:a"]
  ];
  const bands = {
    o: { bg: "var(--accent)", fg: "#fff",
         txt: "the single most frequent element — >1,600 structures contain it (color scale tops out at 1,965 in Fig. 4f)." },
    t: { bg: "color-mix(in srgb, var(--accent) 55%, var(--surface))", fg: "var(--ink)",
         txt: "transition metal — roughly uniform presence, ~200–400 structures each (paper text)." },
    p: { bg: "color-mix(in srgb, var(--accent) 26%, var(--surface))", fg: "var(--ink-2)",
         txt: "present in generated crystals (within the 15–1,600 band of the Fig. 4f color scale)." },
    a: { bg: "color-mix(in srgb, var(--accent) 11%, var(--surface))", fg: "var(--muted)",
         txt: "actinide — minimal incorporation, <50 structures (paper text)." },
    x: { bg: "var(--grid)", fg: "var(--muted)",
         txt: "absent from all 10,000 generated structures (grey in Fig. 4f) — mirrors synthetic reality." }
  };
  rows.forEach(([row, col0, str]) => {
    str.split(" ").forEach((tok, k) => {
      const [sym, band] = tok.split(":");
      const b = bands[band];
      const cell = document.createElement("div");
      cell.className = "lm-el";
      cell.textContent = sym;
      cell.style.background = b.bg;
      cell.style.color = b.fg;
      cell.style.gridRow = row;
      cell.style.gridColumn = col0 + k;
      cell.addEventListener("mouseenter", () => {
        read.innerHTML = `<b>${sym}</b> — ${b.txt}`;
      });
      grid.appendChild(cell);
    });
  });
})();

/* ---------- w8: adaptation-rigidity delta chart (slide 12) ---------- */
(function wDelta() {
  const el = document.getElementById("lm-delta-chart");
  if (!el) return;
  const read = document.getElementById("lm-delta-read");
  // chat lineages, Tables E.1/E.2; tables exact-match: 541/727, 547/728, 180/375, 405/602
  const segs = [
    {
      groups: [
        { label: "LLaMA-2 lineage (+1.0)", bars: [
          { name: "LLaMA-2-chat-FT (no CPT)", short: "no CPT", color: LM_CM, v: 92.30 },
          { name: "LLaMat-2-chat", short: "LLaMat", color: LM_C1, v: 93.33 }] },
        { label: "LLaMA-3 lineage (+6.8)", bars: [
          { name: "LLaMA-3-chat-FT (no CPT)", short: "no CPT", color: LM_CM, op: 0.55, v: 86.23 },
          { name: "LLaMat-3-chat", short: "LLaMat", color: LM_C2, v: 93.03 }] }
      ],
      yMin: 40, yMax: 100, tick: 15, fmt: v => String(v),
      note: "Mean MatNLP micro-F1 (axis starts at 40). LLaMA-3 starts far lower in-domain and gains 6.8 points from CPT+IFT — yet <b>LLaMat-2-chat still finishes ahead, 93.33 vs 93.03</b>."
    },
    {
      groups: [
        { label: "LLaMA-2 lineage (+1.3)", bars: [
          { name: "LLaMA-2-chat-FT (no CPT)", short: "no CPT", color: LM_CM, v: 87.40 },
          { name: "LLaMat-2-chat", short: "LLaMat", color: LM_C1, v: 88.74 }] },
        { label: "LLaMA-3 lineage (+9.7)", bars: [
          { name: "LLaMA-3-chat-FT (no CPT)", short: "no CPT", color: LM_CM, op: 0.55, v: 78.78 },
          { name: "LLaMat-3-chat", short: "LLaMat", color: LM_C2, v: 88.46 }] }
      ],
      yMin: 40, yMax: 100, tick: 15, fmt: v => String(v),
      note: "Mean MatNLP macro-F1 (axis starts at 40). Same shape: the older base needs almost no help and <b>still ends on top (88.74 vs 88.46)</b>. The pattern already holds for CPT-only checkpoints, before any IFT (§2.2)."
    },
    {
      groups: [
        { label: "LLaMA-2 lineage (+0.7)", bars: [
          { name: "LLaMA-2-chat-FT (no CPT), 541/727", short: "no CPT", color: LM_CM, v: 74.4 },
          { name: "LLaMat-2-chat, 547/728", short: "LLaMat", color: LM_C1, v: 75.1 }] },
        { label: "LLaMA-3 lineage (+19.3)", bars: [
          { name: "LLaMA-3-chat-FT (no CPT), 180/375", short: "no CPT", color: LM_CM, op: 0.55, v: 48.0 },
          { name: "LLaMat-3-chat, 405/602", short: "LLaMat", color: LM_C2, v: 67.3 }] }
      ],
      yMin: 0, yMax: 100, tick: 25, fmt: v => v + "%",
      note: "DiSCoMaT full-table exact match (of JSON-parseable outputs). LLaMA-3-chat-FT collapses to 48%; CPT rescues it to 67% — <b>still 8 points behind LLaMat-2-chat</b>."
    },
    {
      groups: [
        { label: "compositional validity", bars: [
          { name: "LLaMat-2-CIF", color: LM_C1, v: 99.5 },
          { name: "LLaMat-3-CIF", color: LM_C2, v: 69.3 }] },
        { label: "% M3GNet-stable", bars: [
          { name: "LLaMat-2-CIF", color: LM_C1, v: 49.5 },
          { name: "LLaMat-3-CIF", color: LM_C2, v: 43.0 }] }
      ],
      yMin: 0, yMax: 100, tick: 25, legend: true, fmt: v => v + "%",
      note: "Identical CIF finetuning + PEFT, no LLaMA-3 baseline exists here — the lineages meet head-on. <b>LLaMat-3-CIF also needed ~33k generations to yield 10k usable structures vs ~13k for LLaMat-2-CIF</b> (2.5× less efficient)."
    }
  ];
  function render(i) {
    const s = segs[i];
    lmBars(el, {
      label: "adaptation before/after by lineage",
      yMin: s.yMin, yMax: s.yMax, tick: s.tick, h: 290,
      legend: s.legend === true, groups: s.groups, fmt: s.fmt
    });
    read.innerHTML = s.note;
  }
  lmSeg(document.getElementById("lm-delta-seg"), render);
  render(0);
})();

/* ---------- w9: loss-landscape schematic (slide 13) ---------- */
(function wLoss() {
  const el = document.getElementById("lm-loss-chart");
  if (!el) return;
  const slider = document.getElementById("lm-loss-s");
  const read = document.getElementById("lm-loss-read");
  const kd = 1.2;
  const panels = [
    { kp: 0.55, title: "LLaMA-2-like: wide basin", color: LM_C1 },
    { kp: 9.0, title: "LLaMA-3-like: sharp basin (overtrained)", color: LM_C2 }
  ];
  function render() {
    const s = (parseFloat(slider.value) / 100) * 1.3;
    el.innerHTML = "";
    const W = 680, H = 240, pw = 330, ph = H;
    const svg = document.createElementNS(LM_NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "schematic wide vs sharp loss basin under domain shift");
    svg.style.width = "100%";
    const fits = [];
    panels.forEach((p, pi) => {
      const ox = pi * (pw + 20);
      const mL2 = 10, mR2 = 10, mT2 = 26, mB2 = 18;
      const iw = pw - mL2 - mR2, ih = ph - mT2 - mB2;
      const xMin = -0.45, xMax = 1.75, yMaxL = 3.4;
      const X = x => ox + mL2 + (x - xMin) / (xMax - xMin) * iw;
      const Y = y => mT2 + (1 - Math.min(y, yMaxL) / yMaxL) * ih;
      const L = x => p.kp * x * x + kd * (x - s) * (x - s);
      lmAdd(svg, "text", { x: ox + mL2, y: 16, "font-size": 12.5, "font-weight": 700, fill: "var(--ink-2)" }, p.title);
      // curve
      let d = "";
      for (let i = 0; i <= 120; i++) {
        const x = xMin + (xMax - xMin) * i / 120;
        d += (i ? "L" : "M") + X(x).toFixed(1) + "," + Y(L(x)).toFixed(1);
      }
      lmAdd(svg, "path", { d, fill: "none", stroke: p.color, "stroke-width": 2.5 });
      // pretrain minimum tick + domain optimum
      lmAdd(svg, "line", { x1: X(0), x2: X(0), y1: Y(0) - 0, y2: mT2 + ih, stroke: "var(--grid)", "stroke-width": 1 });
      lmAdd(svg, "text", { x: X(0), y: mT2 + ih + 13, "text-anchor": "middle", "font-size": 10, fill: "var(--muted)" }, "pretrain min");
      lmAdd(svg, "line", { x1: X(s), x2: X(s), y1: mT2, y2: mT2 + ih, stroke: "var(--accent-3)", "stroke-dasharray": "4 4", "stroke-width": 1.5 });
      lmAdd(svg, "text", { x: X(s), y: mT2 + ih + 13, "text-anchor": "middle", "font-size": 10, fill: "var(--accent-3)" }, "domain optimum");
      // adapted model position
      const xstar = kd * s / (p.kp + kd);
      lmAdd(svg, "circle", { cx: X(xstar), cy: Y(L(xstar)), r: 6, fill: p.color, stroke: "var(--page)", "stroke-width": 2 });
      const fit = s < 0.01 ? 100 : Math.max(0, Math.round(100 * (1 - Math.pow((xstar - s) / s, 2))));
      fits.push(fit);
    });
    el.appendChild(svg);
    read.innerHTML = `Adaptation pulls both models toward the domain optimum. The wide basin recovers <b>${fits[0]}%</b> of the shift; the sharp basin only <b>${fits[1]}%</b> — it stays anchored near its pretraining minimum. <i>Schematic illustration, not paper data.</i>`;
  }
  slider.addEventListener("input", render);
  render();
})();
