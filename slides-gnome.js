/* ============================================================
   GNoME paper-tour deck widgets.
   All numbers from Nature s41586-023-06735-9 (figures cited per slide);
   values read off figures are marked ≈ in tooltips/notes.
   Requires lib.js (lineChart, supStr) loaded first; classic script.
   ============================================================ */
"use strict";

/* ---------- shared helpers (gn- prefix) ---------- */
const GN_NS = "http://www.w3.org/2000/svg";
function gnAdd(parent, tag, attrs, text) {
  const e = document.createElementNS(GN_NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text != null) e.textContent = text;
  parent.appendChild(e);
  return e;
}
/* grouped bar chart.
   cfg: { groups: [{label, bars: [{name, v, color, op, short, lab, title}]}],
          yMax, yMin, tick, fmt, nameUnder, legend, h, label } */
function gnBars(el, cfg) {
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
  const fmt = cfg.fmt || (v => String(Math.round(v * 100) / 100));
  const svg = document.createElementNS(GN_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", cfg.label || "bar chart");
  svg.style.width = "100%";
  const step = cfg.tick || (yMax - yMin) / 4;
  for (let v = yMin; v <= yMax + 1e-9; v += step) {
    gnAdd(svg, "line", { x1: mL, x2: W - mR, y1: Y(v), y2: Y(v), stroke: "var(--grid)", "stroke-width": 1 });
    gnAdd(svg, "text", { x: mL - 6, y: Y(v) + 4, "text-anchor": "end", "font-size": 11, fill: "var(--muted)" }, fmt(v));
  }
  gnAdd(svg, "line", { x1: mL, x2: W - mR, y1: Y(yMin), y2: Y(yMin), stroke: "var(--muted)", "stroke-width": 1 });
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
      const r = gnAdd(svg, "rect", {
        x: x.toFixed(1), y: y.toFixed(1), width: bw.toFixed(1),
        height: Math.max(0.5, Y(yMin) - y).toFixed(1),
        rx: 3, fill: b.color, opacity: b.op ?? 1
      });
      gnAdd(r, "title", {}, `${b.name}: ${b.title || b.lab || fmt(b.v)}`);
      if (bw >= 24) {
        gnAdd(svg, "text", {
          x: (x + bw / 2).toFixed(1), y: (y - 5).toFixed(1), "text-anchor": "middle",
          "font-size": 10.5, "font-weight": 600, fill: "var(--ink-2)"
        }, b.lab ?? fmt(b.v));
      }
      if (b.short) {
        gnAdd(svg, "text", {
          x: (x + bw / 2).toFixed(1), y: Y(yMin) + 13, "text-anchor": "middle",
          "font-size": 10, fill: "var(--muted)"
        }, b.short);
      }
      if (cfg.nameUnder) {
        const cx = x + bw / 2 + 3, ty = Y(yMin) + 14;
        gnAdd(svg, "text", {
          x: cx.toFixed(1), y: ty, "text-anchor": "end", "font-size": 10.5,
          fill: "var(--muted)", transform: `rotate(-26 ${cx.toFixed(1)} ${ty})`
        }, b.name);
      }
    });
    if (g.label) gnAdd(svg, "text", {
      x: mL + gi * gw + gw / 2, y: H - 8, "text-anchor": "middle",
      "font-size": 12, "font-weight": 600, fill: "var(--ink-2)"
    }, g.label);
  });
  if (showLegend) {
    let x = mL;
    groups[0].bars.forEach(b => {
      gnAdd(svg, "rect", { x, y: 4, width: 10, height: 10, rx: 2, fill: b.color, opacity: b.op ?? 1 });
      gnAdd(svg, "text", { x: x + 14, y: 13, "font-size": 11, fill: "var(--ink-2)" }, b.name);
      x += 14 + b.name.length * 6.1 + 16;
    });
  }
  el.appendChild(svg);
}
function gnSeg(segEl, onPick) {
  const btns = Array.from(segEl.querySelectorAll("button"));
  btns.forEach((b, i) => b.addEventListener("click", () => {
    btns.forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", String(x === b)); });
    onPick(i);
  }));
}
const GN_C1 = "var(--accent)", GN_C2 = "var(--accent-2)", GN_C3 = "var(--accent-3)",
      GN_C4 = "var(--accent-4)", GN_CM = "var(--muted)", GN_CN = "var(--neg)";

/* ---------- w1: convex-hull toy (slide 5) ---------- */
(function wHull() {
  const chart = document.getElementById("gn-hull-chart");
  if (!chart) return;
  const sx = document.getElementById("gn-hull-x"), se = document.getElementById("gn-hull-e");
  const ox = document.getElementById("gn-hull-xo"), oe = document.getElementById("gn-hull-eo");
  const read = document.getElementById("gn-hull-read");
  // toy A–B binary: formation energies in eV/atom (schematic, not paper data)
  const base = [
    { x: 0, e: 0, name: "A" },
    { x: 1 / 3, e: -0.30, name: "A₂B" },
    { x: 0.5, e: -0.42, name: "AB" },
    { x: 0.75, e: -0.15, name: "AB₃ (metastable)" },
    { x: 1, e: 0, name: "B" }
  ];
  function lowerHull(pts) {
    const s = [];
    for (const p of pts) {
      while (s.length >= 2) {
        const a = s[s.length - 2], b = s[s.length - 1];
        if ((b.x - a.x) * (p.e - a.e) - (b.e - a.e) * (p.x - a.x) <= 0) s.pop(); else break;
      }
      s.push(p);
    }
    return s;
  }
  function hullEnergy(h, x) {
    for (let i = 0; i < h.length - 1; i++) {
      if (x >= h[i].x && x <= h[i + 1].x) {
        const t = (x - h[i].x) / (h[i + 1].x - h[i].x);
        return h[i].e + t * (h[i + 1].e - h[i].e);
      }
    }
    return 0;
  }
  function render() {
    const xc = parseFloat(sx.value) / 100;
    const ec = parseFloat(se.value) / 1000; // meV slider -> eV
    ox.textContent = sx.value + "%";
    oe.textContent = (se.value < 0 ? "−" : "+") + Math.abs(se.value);
    const hull0 = lowerHull(base);
    const eh = hullEnergy(hull0, xc);
    const above = (ec - eh) * 1000; // meV/atom
    const stable = above <= 0;
    const inWindow = !stable && above <= 50;

    chart.innerHTML = "";
    const W = 620, H = 330, mL = 52, mR = 16, mT = 14, mB = 34;
    const iw = W - mL - mR, ih = H - mT - mB;
    const yTop = 0.12, yBot = -0.58;
    const X = x => mL + x * iw;
    const Y = e => mT + (yTop - e) / (yTop - yBot) * ih;
    const svg = document.createElementNS(GN_NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "toy convex hull of formation energies");
    svg.style.width = "100%";
    // grid + axes
    [0.1, 0, -0.1, -0.2, -0.3, -0.4, -0.5].forEach(v => {
      gnAdd(svg, "line", { x1: mL, x2: W - mR, y1: Y(v), y2: Y(v), stroke: v === 0 ? "var(--muted)" : "var(--grid)", "stroke-width": 1 });
      gnAdd(svg, "text", { x: mL - 6, y: Y(v) + 4, "text-anchor": "end", "font-size": 10.5, fill: "var(--muted)" }, (v * 1000).toFixed(0));
    });
    gnAdd(svg, "text", { x: 14, y: mT + ih / 2, "font-size": 11, fill: "var(--muted)", transform: `rotate(-90 14 ${mT + ih / 2})`, "text-anchor": "middle" }, "formation energy (meV/atom)");
    gnAdd(svg, "text", { x: X(0), y: H - 8, "text-anchor": "middle", "font-size": 12, fill: "var(--ink-2)" }, "A");
    gnAdd(svg, "text", { x: X(1), y: H - 8, "text-anchor": "middle", "font-size": 12, fill: "var(--ink-2)" }, "B");
    gnAdd(svg, "text", { x: X(0.5), y: H - 8, "text-anchor": "middle", "font-size": 11, fill: "var(--muted)" }, "composition x(B) →");
    // current hull (without candidate)
    gnAdd(svg, "path", {
      d: "M" + hull0.map(p => `${X(p.x).toFixed(1)},${Y(p.e).toFixed(1)}`).join("L"),
      fill: "none", stroke: GN_C1, "stroke-width": 2.5, "stroke-linejoin": "round"
    });
    // updated hull if candidate is below
    if (stable) {
      const hull1 = lowerHull([...base, { x: xc, e: ec, name: "candidate" }].sort((a, b) => a.x - b.x));
      gnAdd(svg, "path", {
        d: "M" + hull1.map(p => `${X(p.x).toFixed(1)},${Y(p.e).toFixed(1)}`).join("L"),
        fill: "none", stroke: GN_C4, "stroke-width": 2.5, "stroke-dasharray": "6 4", "stroke-linejoin": "round"
      });
    }
    // known phases
    base.forEach(p => {
      const onHull = hull0.includes(p);
      const c = gnAdd(svg, "circle", {
        cx: X(p.x), cy: Y(p.e), r: 6,
        fill: onHull ? GN_C1 : "var(--surface)",
        stroke: onHull ? GN_C1 : GN_CM, "stroke-width": 2
      });
      gnAdd(c, "title", {}, p.name + (onHull ? " — on the hull (stable)" : " — above the hull (metastable)"));
      gnAdd(svg, "text", { x: X(p.x) + 9, y: Y(p.e) - 8, "font-size": 10.5, fill: "var(--muted)" }, p.name.split(" ")[0]);
    });
    // decomposition arrow candidate -> hull
    gnAdd(svg, "line", {
      x1: X(xc), x2: X(xc), y1: Y(ec), y2: Y(eh),
      stroke: stable ? GN_C4 : inWindow ? GN_C3 : GN_CN, "stroke-width": 1.5, "stroke-dasharray": "3 3"
    });
    // candidate
    const col = stable ? GN_C4 : inWindow ? GN_C3 : GN_CN;
    gnAdd(svg, "circle", { cx: X(xc), cy: Y(ec), r: 8, fill: col, stroke: "var(--page)", "stroke-width": 2 });
    gnAdd(svg, "text", { x: X(xc) + 11, y: Y(ec) + 4, "font-size": 11.5, "font-weight": 700, fill: "var(--ink-2)" }, "candidate");
    chart.appendChild(svg);

    const dTxt = Math.abs(above).toFixed(0);
    read.innerHTML = stable
      ? `Decomposition energy <b>ΔE_d = ${above <= -0.5 ? "−" + dTxt : "0"} meV/atom</b> — the candidate is <b style="color:${GN_C4}">below the current hull: a new stable material</b>. The hull itself updates (dashed green) — competing phases now measure against it.`
      : inWindow
        ? `<b>ΔE_d = +${dTxt} meV/atom</b> — above the hull, but <b style="color:${GN_C3}">inside the 50 meV/atom window</b> GNoME used for filtration: kept for DFT verification (recall over precision).`
        : `<b>ΔE_d = +${dTxt} meV/atom</b> — <b style="color:${GN_CN}">unstable</b>: it would decompose into the mixture of hull phases directly below it. GNoME’s filter discards it.`;
  }
  sx.addEventListener("input", render);
  se.addEventListener("input", render);
  render();
})();

/* ---------- w2: two-pipeline stages (slide 6) ---------- */
(function wPipe() {
  const detail = document.getElementById("gn-pipe-detail");
  if (!detail) return;
  const stages = [
    `<b>Structural generation: substitutions + SAPS.</b> Ionic substitutions into known crystals, with
     probabilities adjusted to prioritize discovery (uncommon elements no longer down-weighted; minimum
     substitution probability raised to 0; threshold 0.001). New <b>symmetry-aware partial substitutions
     (SAPS)</b> replace only symmetry-equivalent subsets of sites — enabling incomplete replacements such as
     double perovskites. Result: <b>more than 10⁹ candidates</b> across rounds; <b>232,477 of the 381,000</b>
     final stable structures trace back to a SAPS substitution.`,
    `<b>Model-based filtration.</b> GNoME structural networks predict energy on the <i>unrelaxed</i> candidate.
     Stabilized by <b>test-time augmentation</b> — 20 isotropic lattice scalings spanning 80–120% of the
     reference volume, aggregated by minimum — and <b>deep ensembles (n = 10)</b> using the median prediction,
     with the interquartile range bounding uncertainty. Decomposition energy is estimated against the current
     GNoME database with a <b>50 meV/atom</b> threshold to protect recall.`,
    `<b>Clustering &amp; polymorph ranking.</b> Surviving candidates are clustered (pymatgen structure matcher on
     pairwise similarity graphs) and each cluster is represented by its minimum-energy structure — a scalable
     route to polymorphs without wasting DFT on near-duplicates.`,
    `<b>DFT verification.</b> VASP with standardized Materials Project settings: PBE (+U for some transition
     metals), PAW potentials, 520 eV plane-wave cutoff, two-stage relaxation + final static calculation.
     Every outcome — stable or not — verifies the model and joins the next round’s training set.`,
    `<b>Compositional generation: relaxed SMACT.</b> Reduced formulas from oxidation-state balancing, deliberately
     loosened: common SMACT oxidation states plus 0 for metallic forms, and up to two elements with two ordered
     oxidation states. Strict balancing would have missed real materials like Li₁₅Si₄.`,
    `<b>Composition-only GNoME.</b> A Roost-style GNN scores the bare formula (no structure input). Compositions
     predicted within <b>50 meV/atom</b> of stability advance. Labelling by minimum-energy AIRSS phases (≥10
     converged runs) cuts its error from 60 to 40 meV/atom and lifts precision of stable prediction to 33%.`,
    `<b>AIRSS: 100 random structures.</b> For each surviving composition, ab initio random structure search
     initializes <b>100 'sensible' random structures</b> (symmetry-obeying, soft-sphere relaxed), with initial
     volumes scanned from 0.4× to 1.2× of an atomic-radii estimate — different starting points reach different
     minima on the structure–energy landscape.`,
    `<b>DFT verification.</b> Same standardized VASP evaluation as the structural pipeline. For certain
     compositions only a few of the 100 initializations converge — an open issue the authors flag. Converged
     energies feed the data flywheel for both model families.`
  ];
  const btns = stages.map((_, i) => document.getElementById("gn-pipe-" + i));
  function pick(i) {
    btns.forEach((b, j) => b.classList.toggle("on", i === j));
    detail.innerHTML = stages[i];
  }
  btns.forEach((b, i) => b.addEventListener("click", () => pick(i)));
  pick(0);
})();

/* ---------- w3: MAE bars (slide 7) ---------- */
(function wMae() {
  const el = document.getElementById("gn-mae-chart");
  if (!el) return;
  gnBars(el, {
    label: "GNoME energy-prediction MAE",
    yMax: 60, tick: 15, h: 300,
    fmt: v => String(v),
    groups: [
      { label: "structural model (meV/atom)", bars: [
        { name: "prior benchmark (ref. 37)", short: "ref. 37", color: GN_CM, v: 28 },
        { name: "GNoME on MP-2018 snapshot (~69k materials)", short: "MP-2018", color: GN_C1, v: 21 },
        { name: "after 6 rounds of active learning", short: "round 6", color: GN_C2, v: 11 }] },
      { label: "compositional model (meV/atom)", bars: [
        { name: "trained on Materials Project labels", short: "MP labels", color: GN_CM, v: 60 },
        { name: "trained on AIRSS labels (≥10 converged runs)", short: "AIRSS", color: GN_C4, v: 40 }] }
    ]
  });
})();

/* ---------- w4: active-learning flywheel (slide 8) ---------- */
(function wLoop() {
  const svgBox = document.getElementById("gn-loop-svg");
  if (!svgBox) return;
  const chartEl = document.getElementById("gn-loop-chart");
  const cap = document.getElementById("gn-loop-cap");
  const slider = document.getElementById("gn-loop-r");
  const playBtn = document.getElementById("gn-loop-play");
  const tRound = document.getElementById("gn-loop-round");
  const tHs = document.getElementById("gn-loop-hs");
  const tHc = document.getElementById("gn-loop-hc");
  const tMae = document.getElementById("gn-loop-mae");
  const rounds = [1, 2, 3, 4, 5, 6];
  // real anchors: round 1 <6% / <3%; round 6 >80% / 33% (per 100 trials); in-between schematic
  const hitS = [6, 18, 32, 48, 65, 80];
  const hitC = [3, 7, 12, 18, 25, 33];
  const stages = [
    { t: "① Generate", d: "New candidates: full substitutions + SAPS into every known stable crystal (structural), and relaxed-SMACT formulas (compositional). Each round’s discoveries expand the substitution pool — the flywheel’s feedback." },
    { t: "② GNoME filter", d: "Ensembles of 10 GNNs (median prediction, interquartile uncertainty) score unrelaxed candidates with test-time volume augmentation; keep those within ~50 meV/atom of the predicted hull." },
    { t: "③ DFT verify", d: "Filtered candidates get standardized VASP relaxations (Materials Project settings). DFT both confirms discoveries and prices the model’s errors — no unverified structure enters the catalogue." },
    { t: "④ Retrain", d: "All new energies — hits and misses — join the training set; networks retrain and the threshold/criteria are re-tuned. Six such rounds took MAE from 21 to 11 meV/atom." }
  ];
  const nodePos = [
    { x: 150, y: 44 }, { x: 252, y: 132 }, { x: 150, y: 220 }, { x: 48, y: 132 }
  ];
  let round = 1, stage = 0, timer = null;
  function drawLoop() {
    svgBox.innerHTML = "";
    const svg = document.createElementNS(GN_NS, "svg");
    svg.setAttribute("viewBox", "0 0 300 264");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "active-learning loop: generate, filter, verify, retrain");
    svg.style.width = "100%";
    svg.style.maxWidth = "340px";
    const defs = gnAdd(svg, "defs", {});
    const mk = gnAdd(defs, "marker", { id: "gn-arr", viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" });
    gnAdd(mk, "path", { d: "M0,0L10,5L0,10z", fill: "var(--muted)" });
    // arcs between consecutive nodes
    for (let i = 0; i < 4; i++) {
      const a = nodePos[i], b = nodePos[(i + 1) % 4];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const cx = 150 + (mx - 150) * 1.55, cy = 132 + (my - 132) * 1.55;
      gnAdd(svg, "path", {
        d: `M${a.x + (b.x - a.x) * 0.28},${a.y + (b.y - a.y) * 0.28} Q${cx},${cy} ${a.x + (b.x - a.x) * 0.72},${a.y + (b.y - a.y) * 0.72}`,
        fill: "none", stroke: i === stage ? "var(--accent)" : "var(--muted)",
        "stroke-width": i === stage ? 2.5 : 1.5, "marker-end": "url(#gn-arr)", opacity: i === stage ? 1 : 0.6
      });
    }
    stages.forEach((s, i) => {
      const p = nodePos[i];
      const on = i === stage;
      const g = gnAdd(svg, "g", { style: "cursor:pointer" });
      gnAdd(g, "rect", {
        x: p.x - 52, y: p.y - 20, width: 104, height: 40, rx: 10,
        fill: "var(--surface)", stroke: on ? "var(--accent)" : "var(--border)", "stroke-width": on ? 2.5 : 1.2
      });
      gnAdd(g, "text", {
        x: p.x, y: p.y + 4.5, "text-anchor": "middle", "font-size": 12.5,
        "font-weight": on ? 800 : 600, fill: on ? "var(--accent)" : "var(--ink-2)"
      }, s.t);
      g.addEventListener("click", () => { stage = i; render(); });
    });
    gnAdd(svg, "text", { x: 150, y: 137, "text-anchor": "middle", "font-size": 20, "font-weight": 800, fill: "var(--ink-2)" }, "round " + round);
    svgBox.appendChild(svg);
  }
  function drawChart() {
    lineChart(chartEl, {
      xs: rounds,
      series: [
        { name: "structural", color: GN_C1, ys: hitS, dashed: true },
        { name: "compositional", color: GN_C2, ys: hitC, dashed: true }
      ],
      yMin: 0, yMax: 95,
      yTicks: [{ v: 0, label: "0%" }, { v: 25, label: "25%" }, { v: 50, label: "50%" }, { v: 75, label: "75%" }],
      xLabel: "active-learning round (dashed = schematic between reported endpoints)",
      marker: round,
      label: "hit rate of DFT-verified stability per round",
      tooltip: (x) => x === 1
        ? "<b>Round 1</b> — reported: structural &lt;6%, compositional &lt;3% (Methods: 3–10% depending on threshold)"
        : x === 6
          ? "<b>Round 6</b> — reported: structural &gt;80%, compositional 33% per 100 trials (vs 1% in prior work)"
          : `<b>Round ${x}</b> — per-round values not reported; dashed path is a schematic interpolation`
    });
  }
  function render() {
    tRound.textContent = round + " / 6";
    tHs.textContent = round === 1 ? "<6%" : round === 6 ? ">80%" : "rising…";
    tHc.textContent = round === 1 ? "<3%" : round === 6 ? "33%" : "rising…";
    tMae.textContent = round === 1 ? "21" : round === 6 ? "11" : "21→11";
    cap.innerHTML = `<b>${stages[stage].t}</b> — ${stages[stage].d}`;
    drawLoop();
    drawChart();
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; playBtn.textContent = "▶ run the flywheel"; } }
  playBtn.addEventListener("click", () => {
    if (timer) { stop(); return; }
    if (round === 6 && stage === 3) { round = 1; stage = 0; slider.value = "1"; }
    playBtn.textContent = "⏸ pause";
    timer = setInterval(() => {
      stage++;
      if (stage > 3) {
        stage = 0;
        if (round < 6) { round++; slider.value = String(round); }
        else { stage = 3; render(); stop(); return; }
      }
      render();
    }, 800);
  });
  slider.addEventListener("input", () => { stop(); round = parseInt(slider.value, 10); render(); });
  render();
})();

/* ---------- w5: discoveries by unique elements (slide 9) ---------- */
(function wElem() {
  const el = document.getElementById("gn-elem-chart");
  if (!el) return;
  const read = document.getElementById("gn-elem-read");
  const L = v => Math.log10(v);
  // ≈ values read off Fig. 2a (log axis) and Fig. 2c
  const crystals = [
    { g: "2 elements", mp: [4500, "≈4.5k"], gn: [7000, "≈7k"] },
    { g: "3 elements", mp: [18000, "≈18k"], gn: [90000, "≈90k"] },
    { g: "4 elements", mp: [7000, "≈7k"], gn: [230000, "≈230k"] },
    { g: "5 elements", mp: [1300, "≈1.3k"], gn: [80000, "≈80k"] },
    { g: "6 elements", mp: null, gn: [3000, "≈3k"] }
  ];
  const protos = [
    { g: "2 elements", mp: [1.5, "≈1.5k"], gn: [2, "≈2k"] },
    { g: "3 elements", mp: [4, "≈4k"], gn: [13, "≈13k"] },
    { g: "4 elements", mp: [2, "≈2k"], gn: [23, "≈23k"] },
    { g: "5 elements", mp: [0.5, "≈0.5k"], gn: [13, "≈13k"] },
    { g: "6 elements", mp: null, gn: [1, "≈1k"] }
  ];
  function render(mode) {
    if (mode === 0) {
      gnBars(el, {
        label: "stable crystal count by number of unique elements (log scale)",
        yMin: 3, yMax: 5.6, tick: 1, h: 310, legend: true,
        fmt: v => "10" + supStr(Math.round(v)),
        groups: crystals.map(r => ({
          label: r.g,
          bars: [
            ...(r.mp ? [{ name: "Materials Project", color: GN_CM, v: L(r.mp[0]), lab: r.mp[1], title: r.mp[1] + " (≈, Fig. 2a)" }] : []),
            { name: "GNoME", color: GN_C1, v: L(r.gn[0]), lab: r.gn[1], title: r.gn[1] + " (≈, Fig. 2a)" }
          ]
        }))
      });
      read.innerHTML = "Stable crystals by chemistry size (≈, read off Fig. 2a’s log axis). The <b>combinatorial 4–5-element spaces</b> — hard for human intuition and full-substitution enumeration — are where GNoME’s gains explode; MP has almost nothing at 6 elements.";
    } else {
      gnBars(el, {
        label: "distinct structural prototypes by number of unique elements",
        yMax: 25, tick: 5, h: 310, legend: true,
        fmt: v => v + "k",
        groups: protos.map(r => ({
          label: r.g,
          bars: [
            ...(r.mp ? [{ name: "Materials Project", color: GN_CM, v: r.mp[0], lab: r.mp[1], title: r.mp[1] + " (≈, Fig. 2c)" }] : []),
            { name: "GNoME", color: GN_C1, v: r.gn[0], lab: r.gn[1], title: r.gn[1] + " (≈, Fig. 2c)" }
          ]
        }))
      });
      read.innerHTML = "Distinct prototypes (XtalFinder clustering; bars ≈ from Fig. 2c). Anchor numbers from the text: <b>45,500 novel prototypes</b>, a <b>5.6×</b> increase over ~8,000 from the Materials Project — structures that “could not have arisen from full substitutions or prototype enumeration”.";
    }
  }
  gnSeg(document.getElementById("gn-elem-seg"), render);
  render(0);
})();

/* ---------- w6: scaling laws / precision (slide 10) ---------- */
(function wScale() {
  const el = document.getElementById("gn-scale-chart");
  if (!el) return;
  const read = document.getElementById("gn-scale-read");
  // ≈ points read off Fig. 1e (log–log): out-of-domain MAE on AIRSS test vs training set size
  const xs = [2.9, 3.0, 3.9, 4.6, 5.0, 5.9, 6.8, 7.0];
  const mae = [250, 235, 90, 75, 65, 45, 33, 30];
  const sizeLab = ["≈8×10²", "≈10³", "≈8×10³", "≈4×10⁴", "≈10⁵", "≈8×10⁵", "≈6×10⁶", "≈10⁷"];
  function render(mode) {
    if (mode === 0) {
      lineChart(el, {
        xs, series: [{ name: "GNoME", color: GN_C1, ys: mae.map(Math.log10) }],
        yMin: 1.35, yMax: 2.45,
        yTicks: [{ v: Math.log10(25), label: "25" }, { v: Math.log10(50), label: "50" },
                 { v: Math.log10(100), label: "100" }, { v: Math.log10(250), label: "250" }],
        xTicks: [{ v: 3, label: "10³" }, { v: 4, label: "10⁴" }, { v: 5, label: "10⁵" }, { v: 6, label: "10⁶" }, { v: 7, label: "10⁷" }],
        xLabel: "training set size (log–log; early points = Materials Project data)",
        label: "out-of-domain MAE vs training data",
        tooltip: (x, i) => `<b>${sizeLab[i]} structures</b> → ≈${mae[i]} meV/atom out-of-domain MAE (≈, Fig. 1e)`
      });
      read.innerHTML = "Out-of-domain test: energies of <b>AIRSS-generated random structures</b> — a distribution never used for structural training. MAE falls from ≈250 to <b>≈30 meV/atom</b> as data grows 10³ → 10⁷: a clean power-law trend (≈, Fig. 1e).";
    } else {
      gnBars(el, {
        label: "precision of stable prediction by unique elements",
        yMax: 100, tick: 25, h: 280, legend: true,
        fmt: v => v + "%",
        groups: [
          { label: "3 unique elements", bars: [
            { name: "trained on MP only", color: GN_CM, v: 10, lab: "≈10%" },
            { name: "final GNoME", color: GN_C1, v: 85, lab: "≈85%" }] },
          { label: "6 unique elements", bars: [
            { name: "trained on MP only", color: GN_CM, v: 2, lab: "≈2%" },
            { name: "final GNoME", color: GN_C1, v: 50, lab: "≈50%" }] }
        ]
      });
      read.innerHTML = "Hit-rate of predicted-stable candidates (bars ≈ from Fig. 1d; the text anchors “above 80% with structure”). At <b>six unique elements</b> the final models keep ≈50% precision — <b>even though training data stopped at four unique elements</b>: emergent out-of-distribution generalization.";
    }
  }
  gnSeg(document.getElementById("gn-scale-seg"), render);
  render(0);
})();

/* ---------- w7: interatomic-potential scaling (slide 12) ---------- */
(function wMlip() {
  const el = document.getElementById("gn-mlip-chart");
  if (!el) return;
  const read = document.getElementById("gn-mlip-read");
  const xsA = [5.0, 5.5, 5.8, 6.3, 6.9, 8.0];
  const szA = ["10⁵", "≈3×10⁵", "≈6×10⁵", "≈2×10⁶", "≈8×10⁶", "10⁸"];
  const errA = [15.5, 13, 12.5, 12, 8.5, 6.3];
  const maeB = [197, 155, 120, 105, 92, 50];
  const xsC = [1, 1.5, 2, 2.5, 3];
  const nC = ["10", "≈30", "100", "≈300", "1,000"];
  const scratch = [310, 230, 90, 55, 38];
  const finetune = [28, 22, 22, 18, 14];
  function render(mode) {
    if (mode === 0) {
      lineChart(el, {
        xs: xsA, series: [{ name: "zero-shot", color: GN_C1, ys: errA }],
        yMin: 0, yMax: 22,
        yTicks: [{ v: 0, label: "0%" }, { v: 5, label: "5%" }, { v: 10, label: "10%" }, { v: 15, label: "15%" }, { v: 20, label: "20%" }],
        xTicks: [{ v: 5, label: "10⁵" }, { v: 6, label: "10⁶" }, { v: 7, label: "10⁷" }, { v: 8, label: "10⁸" }],
        xLabel: "pretraining set size (log axis)",
        label: "superionic classification error vs pretraining size",
        tooltip: (x, i) => `<b>${szA[i]} structures</b> → ≈${errA[i]}% classification error (≈, Fig. 3a)`
      });
      read.innerHTML = "Zero-shot classification of <b>superionic vs non-superionic behaviour on 623 unseen compositions</b>, judged against AIMD. Error falls ≈15.5% → ≈6% with pretraining scale (final point uses all intermediate relaxation steps). Reference: a NequIP trained on M3GNet data sits at ≈20% (red diamond in Fig. 3a).";
    } else if (mode === 1) {
      lineChart(el, {
        xs: xsA, series: [{ name: "zero-shot", color: GN_C2, ys: maeB }],
        yMin: 0, yMax: 220,
        yTicks: [{ v: 50, label: "50" }, { v: 100, label: "100" }, { v: 150, label: "150" }, { v: 200, label: "200" }],
        xTicks: [{ v: 5, label: "10⁵" }, { v: 6, label: "10⁶" }, { v: 7, label: "10⁷" }, { v: 8, label: "10⁸" }],
        xLabel: "pretraining set size (log axis)",
        label: "zero-shot force error vs pretraining size",
        tooltip: (x, i) => `<b>${szA[i]} structures</b> → ≈${maeB[i]} meV/Å force MAE (≈, Fig. 3b)`
      });
      read.innerHTML = "Zero-shot <b>force MAE on unseen K₂₄Li₁₆P₂₄Sn₈ at T = 1,000 K</b> — no training on any molecular-dynamics data; the potential is pretrained only on GNoME ionic-relaxation trajectories. Consistent power-law gains down to ≈50 meV/Å at 10⁸ structures (≈, Fig. 3b; M3GNet-data reference ≈150).";
    } else {
      lineChart(el, {
        xs: xsC,
        series: [
          { name: "from scratch", color: GN_CN, ys: scratch.map(Math.log10) },
          { name: "GNoME fine-tuned", color: GN_C4, ys: finetune.map(Math.log10), labelDy: 12 }
        ],
        yMin: 1.05, yMax: 2.55,
        yTicks: [{ v: Math.log10(15), label: "15" }, { v: Math.log10(30), label: "30" }, { v: Math.log10(60), label: "60" },
                 { v: Math.log10(120), label: "120" }, { v: Math.log10(240), label: "240" }],
        xTicks: [{ v: 1, label: "10" }, { v: 2, label: "100" }, { v: 3, label: "1,000" }],
        refLine: { v: Math.log10(50), label: "GNoME zero-shot ≈50 meV/Å (0 structures)" },
        xLabel: "target-system training structures (log–log)",
        label: "force error under distribution shift, Ba₈Li₁₆Se₃₂Si₈",
        tooltip: (x, i) => `<b>${nC[i]} structures</b> → scratch ≈${scratch[i]}, fine-tuned ≈${finetune[i]} meV/Å (≈, Fig. 3c)`
      });
      read.innerHTML = "Transferability test on <b>Ba₈Li₁₆Se₃₂Si₈</b>: train at 400 K, evaluate at 1,000 K. The <b>zero-shot GNoME potential (≈50 meV/Å) beats a state-of-the-art NequIP trained from scratch on hundreds of structures</b>; fine-tuning from the GNoME checkpoint dominates everywhere (≈, Fig. 3c).";
    }
  }
  gnSeg(document.getElementById("gn-mlip-seg"), render);
  render(0);
})();
