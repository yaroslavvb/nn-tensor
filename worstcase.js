/* ============================================================
   Worst-Case Tensor Approximation report — widgets.
   Requires lib.js. All numerics run live in the browser.
   ============================================================ */
"use strict";

/* ---------------- order-d tensor helpers (flat array, mode 0 fastest) ---------------- */
function wcDigitsTable(dims) {
  const N = dims.reduce((a, b) => a * b, 1), d = dims.length;
  const tab = [];
  for (let n = 0; n < N; n++) {
    const dig = new Array(d);
    let m = n;
    for (let k = 0; k < d; k++) { dig[k] = m % dims[k]; m = Math.floor(m / dims[k]); }
    tab.push(dig);
  }
  return tab;
}
function froNorm(T) { let s = 0; for (let i = 0; i < T.length; i++) s += T[i] * T[i]; return Math.sqrt(s); }
function innerRank1(T, tab, U) {
  const d = U.length; let s = 0;
  for (let idx = 0; idx < T.length; idx++) {
    let p = T[idx];
    if (p === 0) continue;
    const dig = tab[idx];
    for (let k = 0; k < d; k++) p *= U[k][dig[k]];
    s += p;
  }
  return s;
}
/* best rank-1 correlation by multi-start alternating power iteration (HOPM).
   Returns {val (signed), vecs}. |val| is a LOWER estimate of the spectral norm. */
function rankOneBest(T, dims, tab, restarts, iters, seedBase) {
  const d = dims.length;
  let best = null;
  for (let s = 0; s < restarts; s++) {
    const rng = mulberry32(seedBase + s * 7919 + 13);
    let U = dims.map(nk => {
      const v = Array.from({ length: nk }, () => randn(rng));
      const nv = Math.hypot(...v);
      return v.map(x => x / nv);
    });
    for (let it = 0; it < iters; it++) {
      for (let m = 0; m < d; m++) {
        const v = new Array(dims[m]).fill(0);
        for (let idx = 0; idx < T.length; idx++) {
          let p = T[idx];
          if (p === 0) continue;
          const dig = tab[idx];
          for (let k = 0; k < d; k++) if (k !== m) p *= U[k][dig[k]];
          v[dig[m]] += p;
        }
        const nv = Math.hypot(...v);
        if (nv < 1e-300) break;
        U[m] = v.map(x => x / nv);
      }
    }
    const val = innerRank1(T, tab, U);
    if (!best || Math.abs(val) > Math.abs(best.val)) best = { val, vecs: U };
  }
  return best;
}
function subtractRank1(T, tab, U, lambda) {
  const d = U.length;
  for (let idx = 0; idx < T.length; idx++) {
    let p = lambda;
    const dig = tab[idx];
    for (let k = 0; k < d; k++) p *= U[k][dig[k]];
    T[idx] -= p;
  }
}

/* ============================================================
   PART 1 — spectral-norm probe (w-probe)
   ============================================================ */
(function probe() {
  const dims = [4, 4, 4];
  const tab = wcDigitsTable(dims);
  const rng0 = mulberry32(20260716);
  const T = new Float64Array(64);
  for (let i = 0; i < 64; i++) T[i] = randn(rng0);
  const nrm = froNorm(T);
  for (let i = 0; i < 64; i++) T[i] /= nrm;
  const sigmaHat = Math.abs(rankOneBest(T, dims, tab, 8, 60, 555).val);

  const slicesEl = document.getElementById("probe-slices");
  const vecsEl = document.getElementById("probe-vecs");
  const valEl = document.getElementById("probe-val");
  const noteEl = document.getElementById("probe-note");
  let U = null, sweeps = 0, seed = 42, timer = null;

  function resetProbe() {
    seed += 17;
    const rng = mulberry32(seed);
    U = dims.map(nk => {
      const v = Array.from({ length: nk }, () => randn(rng));
      const nv = Math.hypot(...v);
      return v.map(x => x / nv);
    });
    sweeps = 0;
    render();
  }
  function sweep() {
    for (let m = 0; m < 3; m++) {
      const v = new Array(4).fill(0);
      for (let idx = 0; idx < 64; idx++) {
        let p = T[idx];
        const dig = tab[idx];
        for (let k = 0; k < 3; k++) if (k !== m) p *= U[k][dig[k]];
        v[dig[m]] += p;
      }
      const nv = Math.hypot(...v);
      if (nv > 1e-300) U[m] = v.map(x => x / nv);
    }
    sweeps++;
    render();
  }
  function drawSlices() {
    slicesEl.innerHTML = "";
    const scale = Math.max(...Array.from(T).map(Math.abs));
    for (let k = 0; k < 4; k++) {
      const wrap = document.createElement("div");
      wrap.className = "slice";
      const M = Array.from({ length: 4 }, (_, i) => Array.from({ length: 4 }, (_, j) => T[i + 4 * (j + 4 * k)]));
      const grid = document.createElement("div");
      renderHeatmap(grid, M, { scale, small: true, showVal: false });
      wrap.appendChild(grid);
      const lab = document.createElement("div");
      lab.className = "slice-label";
      lab.textContent = `[:, :, ${k + 1}]`;
      wrap.appendChild(lab);
      slicesEl.appendChild(wrap);
    }
  }
  function render() {
    vecsEl.innerHTML = "";
    ["u", "v", "w"].forEach((name, k) => {
      const row = document.createElement("div");
      row.style.display = "flex"; row.style.alignItems = "center"; row.style.gap = "8px"; row.style.marginBottom = "4px";
      const lab = document.createElement("span");
      lab.style.cssText = "font-size:12px;color:var(--muted);width:14px";
      lab.textContent = name;
      row.appendChild(lab);
      const hm = document.createElement("div");
      renderHeatmap(hm, [U[k]], { scale: 1, small: true });
      row.appendChild(hm);
      vecsEl.appendChild(row);
    });
    const val = innerRank1(T, tab, U);
    valEl.innerHTML = val.toFixed(3);
    noteEl.innerHTML = `sweep ${sweeps} · best multi-start estimate: σ̂ ≈ <b>${sigmaHat.toFixed(3)}</b> · total energy ‖𝒯‖<sub>F</sub> = 1. ` +
      `One rank-1 pattern can extract ~${Math.round(100 * sigmaHat * sigmaHat)}% of the energy; the rest is invisible to any single probe.`;
  }
  document.getElementById("probe-step").addEventListener("click", sweep);
  document.getElementById("probe-reset").addEventListener("click", resetProbe);
  const autoBtn = document.getElementById("probe-auto");
  autoBtn.addEventListener("click", () => {
    if (timer) { clearInterval(timer); timer = null; autoBtn.textContent = "⏵ auto"; return; }
    autoBtn.textContent = "⏸ pause";
    timer = setInterval(() => { sweep(); if (sweeps >= 25) { clearInterval(timer); timer = null; autoBtn.textContent = "⏵ auto"; } }, 350);
  });
  drawSlices();
  resetProbe();
  onSchemeChange(() => { drawSlices(); render(); });
})();

/* ============================================================
   PART 2 — worst-case error vs parameter budget (w-budget)
   ============================================================ */
(function budget() {
  const sN = document.getElementById("bud-n"), sD = document.getElementById("bud-d");
  const oN = document.getElementById("bud-n-out"), oD = document.getElementById("bud-d-out");
  const chartEl = document.getElementById("budget-chart");
  const noteEl = document.getElementById("budget-note");
  function update() {
    const n = +sN.value, d = +sD.value;
    oN.textContent = n; oD.textContent = d;
    const E = d * Math.log10(n);          // log10 of N = n^d
    const N = Math.pow(n, d);
    const M = 60;
    const xs = Array.from({ length: M + 1 }, (_, i) => (i / M) * E);
    const fe = xs.map(e => Math.sqrt(Math.max(0, 1 - Math.pow(10, e) / N)));
    const se = xs.map(e => {
      const P = Math.pow(10, e);
      return P >= N ? 0 : Math.min(1, Math.sqrt(d * n / P));
    });
    const ticks = [];
    for (let k = 0; k <= Math.floor(E); k++) ticks.push({ v: k, label: `10${supStr(k)}` });
    lineChart(chartEl, {
      xs, yMin: 0, yMax: 1,
      label: "Worst-case error versus parameter budget in Frobenius and spectral norms",
      series: [
        { name: "L² (Frobenius)", color: cssVar("--accent-2"), ys: fe, noDots: true },
        { name: "spectral", color: cssVar("--accent"), ys: se, noDots: true }
      ],
      yTicks: [0, 0.25, 0.5, 0.75, 1].map(v => ({ v, label: String(v) })),
      xTicks: ticks,
      xLabel: "parameters P (log scale)",
      tooltip: (x, i) => `<b>P ≈ ${fmtCount(Math.round(Math.pow(10, x)))}</b>` +
        `<br>L² worst case: ${fe[i].toFixed(3)}<br>spectral worst case: ${se[i].toFixed(3)}`
    });
    const pRaw = Math.round(100 * d * n);
    const pSig = Math.min(pRaw, N);
    noteEl.innerHTML = `At n=${n}, d=${d}: N = n<sup>d</sup> = ${fmtCount(N)}. Spectral error 0.1 costs ` +
      `P ≈ ${pRaw > N ? "min(dn/ε², N)" : "dn/ε²"} = ${fmtCount(pSig)} (${(100 * pSig / N) < 0.1 ? "&lt;0.1" : (100 * pSig / N).toFixed(1)}% of N); ` +
      `Frobenius error 0.1 costs P ≈ 0.99·N = ${fmtCount(Math.round(0.99 * N))}.`;
  }
  [sN, sD].forEach(s => s.addEventListener("input", update));
  update();
  onSchemeChange(update);
})();

/* ============================================================
   PART 3 — the greedy lab (w-greedy)
   ============================================================ */
(function greedy() {
  const chartEl = document.getElementById("greedy-chart");
  const statusEl = document.getElementById("greedy-status");
  const noteEl = document.getElementById("greedy-note");
  const autoBtn = document.getElementById("greedy-auto");
  let preset = "random";
  let dims, tab, R, K = null, maxSteps, seedT = 0;
  let sig = [], fro = [], nextTerm = null, timer = null, genId = 0;

  function build() {
    genId++;
    if (timer) { clearInterval(timer); timer = null; autoBtn.textContent = "⏵ auto"; }
    if (preset === "random") {
      dims = [8, 8, 8]; maxSteps = 40; K = null;
      tab = wcDigitsTable(dims);
      const rng = mulberry32(90210 + seedT);
      R = new Float64Array(512);
      for (let i = 0; i < 512; i++) R[i] = randn(rng);
      const nrm = froNorm(R);
      for (let i = 0; i < 512; i++) R[i] /= nrm;
    } else {
      dims = [32, 32]; K = 16; maxSteps = 20;
      tab = wcDigitsTable(dims);
      R = new Float64Array(1024);
      for (let j = 0; j < K; j++) R[j + 32 * j] = 1 / Math.sqrt(K);   // K equal singular values 1/√K, ‖T‖_F = 1
    }
    sig = []; fro = [froNorm(R)];
    nextTerm = rankOneBest(R, dims, tab, 4, 30, 1000 + seedT);
    sig.push(Math.abs(nextTerm.val));
    draw();
  }
  function step() {
    if (sig.length > maxSteps) return;
    subtractRank1(R, tab, nextTerm.vecs, nextTerm.val);
    fro.push(froNorm(R));
    nextTerm = rankOneBest(R, dims, tab, 4, 30, 2000 + 31 * sig.length + seedT);
    sig.push(Math.abs(nextTerm.val));
    draw();
  }
  function draw() {
    const t = sig.length - 1;   // completed steps
    const xs = Array.from({ length: sig.length }, (_, i) => i);
    const env = xs.map(i => (i === 0 ? 1 : Math.min(1, 1 / Math.sqrt(i))));
    lineChart(chartEl, {
      xs: xs.length > 1 ? xs : [0, 1],
      yMin: 0, yMax: 1,
      label: "Greedy rank-1 decrement: spectral and Frobenius residuals versus step",
      series: [
        { name: "envelope 1/√t", color: cssVar("--accent-3"), ys: xs.length > 1 ? env : [1, 1], dashed: true, noDots: true },
        { name: "‖ℛ‖_F", color: cssVar("--accent-2"), ys: xs.length > 1 ? fro.slice(0, xs.length) : [fro[0], fro[0]], noDots: true, labelAt: "start" },
        { name: "‖ℛ‖_σ", color: cssVar("--accent"), ys: xs.length > 1 ? sig : [sig[0], sig[0]], labelAt: "start" }
      ],
      yTicks: [0, 0.25, 0.5, 0.75, 1].map(v => ({ v, label: String(v) })),
      xTickEvery: xs.length > 21 ? 5 : (xs.length > 11 ? 2 : 1),
      xLabel: "greedy step t (rank used so far)",
      tooltip: (x, i) => `<b>t = ${x}</b> (rank ${x})<br>‖ℛ‖<sub>σ</sub> ≈ ${sig[i] != null ? sig[i].toFixed(3) : "—"}` +
        `<br>‖ℛ‖<sub>F</sub> = ${fro[i] != null ? fro[i].toFixed(3) : "—"}<br>envelope: ${i === 0 ? "1" : (1 / Math.sqrt(i)).toFixed(3)}`
    });
    statusEl.innerHTML = `t = ${t} · current ‖ℛ‖<sub>σ</sub> ≈ ${sig[t].toFixed(3)} · ‖ℛ‖<sub>F</sub> = ${fro[t].toFixed(3)}`;
    noteEl.innerHTML = preset === "flat"
      ? `The flat matrix has K = 16 singular values of 1/√16 = 0.25 each. The greedy removes exactly one per step: ` +
      `σ stays pinned at 0.25 — <b>exactly the envelope's value 1/√16 at t = 16</b> — then everything is gone at once. ` +
      `Getting below 0.25 requires rank ≥ 16, so the 1/√t envelope cannot be uniformly improved: ` +
      `this tensor (a matrix!) proves rank Θ(1/ε²) is necessary at every order.`
      : `Random tensors are the L²-incompressible worst case — yet σ starts at only ≈ ${sig[0].toFixed(2)} ` +
      `(they are nearly rank-0 in spectral norm!) and keeps falling, while ‖ℛ‖<sub>F</sub> barely moves: ` +
      `each rank-1 term grabs the largest visible pattern, but almost all the energy is invisible to every probe. ` +
      `σ values are multi-start power-iteration estimates (exact σ is NP-hard).`;
  }
  document.getElementById("greedy-step").addEventListener("click", step);
  document.getElementById("greedy-reset").addEventListener("click", () => { seedT += 7; build(); });
  autoBtn.addEventListener("click", () => {
    if (timer) { clearInterval(timer); timer = null; autoBtn.textContent = "⏵ auto"; return; }
    autoBtn.textContent = "⏸ pause";
    const myGen = genId;
    timer = setInterval(() => {
      if (genId !== myGen || sig.length > maxSteps) { clearInterval(timer); timer = null; autoBtn.textContent = "⏵ auto"; return; }
      step();
    }, 350);
  });
  document.querySelectorAll("#greedy-preset button").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#greedy-preset button").forEach(b => { b.classList.remove("on"); b.setAttribute("aria-pressed", "false"); });
      btn.classList.add("on");
      btn.setAttribute("aria-pressed", "true");
      preset = btn.dataset.p;
      build();
    });
  });
  build();
  onSchemeChange(draw);
})();

/* ============================================================
   PART 5 — the per-cut adversary (w-adversary)
   ============================================================ */
(function adversary() {
  const d = 6;
  const kSlider = document.getElementById("adv-k"), kOut = document.getElementById("adv-k-out");
  const eSlider = document.getElementById("adv-e"), eOut = document.getElementById("adv-e-out");
  const diagEl = document.getElementById("adv-diagram");
  const chartEl = document.getElementById("adv-chart");
  const noteEl = document.getElementById("adv-note");
  const EPS = [0.35, 0.25, 0.15, 0.10];

  function drawDiagram(k) {
    const xs = Array.from({ length: d }, (_, i) => 60 + i * 88);
    const y = 60, legY = 128;
    let s = `<svg viewBox="0 0 560 160" class="chart" role="img" aria-label="Padded flat-matrix adversary across one cut of the chain" style="width:100%;max-width:640px">`;
    for (let i = 0; i < d - 1; i++) {
      const attacked = (i === k - 1);
      s += `<line x1="${xs[i] + 18}" y1="${y}" x2="${xs[i + 1] - 18}" y2="${y}"
        stroke="${attacked ? "var(--neg)" : "var(--baseline)"}" stroke-width="${attacked ? 3 : 2}"/>`;
      s += `<text x="${(xs[i] + xs[i + 1]) / 2}" y="${y - 10}" text-anchor="middle" font-size="11.5"
        fill="${attacked ? "var(--neg)" : "var(--muted)"}" font-weight="${attacked ? 700 : 400}">${attacked ? "bond ≥ K" : "free"}</text>`;
    }
    for (let i = 0; i < d; i++) {
      const inM = (i === k - 1 || i === k);
      s += `<line x1="${xs[i]}" y1="${y + 16}" x2="${xs[i]}" y2="${legY}" stroke="var(--muted)" stroke-width="2" stroke-dasharray="3 3"/>`;
      s += `<rect x="${xs[i] - 17}" y="${y - 15}" width="34" height="30" rx="7" fill="${inM ? "var(--neg)" : "var(--accent-2)"}"/>`;
      s += `<text x="${xs[i]}" y="${y + 5}" text-anchor="middle" fill="#fff" font-size="11.5" font-weight="700">${inM ? "M" : "u"}</text>`;
      s += `<text x="${xs[i]}" y="${legY + 14}" text-anchor="middle" font-size="11.5" fill="var(--muted)">i${["₁", "₂", "₃", "₄", "₅", "₆"][i]}</text>`;
    }
    s += `</svg>`;
    diagEl.innerHTML = s;
  }
  function update() {
    const k = +kSlider.value;
    const eps = EPS[+eSlider.value - 1];
    kOut.textContent = k;
    eOut.textContent = eps.toFixed(2);
    const K = Math.ceil(1 / (2 * eps * eps));
    drawDiagram(k);
    const rMax = Math.min(K + 10, 64);
    const xs = Array.from({ length: rMax + 1 }, (_, r) => r);
    const err = xs.map(r => (r < K ? 1 / Math.sqrt(K) : 0));
    const ticks = [];
    for (let r = 0; r <= rMax; r += rMax > 30 ? 10 : 5) ticks.push({ v: r, label: String(r) });
    lineChart(chartEl, {
      xs, yMin: 0, yMax: 0.55,
      label: "Exact best spectral error versus bond dimension at the attacked cut",
      series: [{ name: "best error", color: cssVar("--accent"), ys: err, noDots: rMax > 30 }],
      yTicks: [0, 0.25, 0.5].map(v => ({ v, label: String(v) })),
      xTicks: ticks,
      xLabel: `bond dimension r at the attacked cut (K = ${K})`,
      refLine: { v: eps, label: `target ε = ${eps}` },
      marker: K,
      tooltip: (r, i) => `<b>bond r = ${r}</b><br>best spectral error: ${err[i].toFixed(3)}` +
        (r < K ? `<br>= 1/√K &gt; ε — not good enough` : `<br>0 — exact once r = K`)
    });
    noteEl.innerHTML = `Adversary at cut ${k}: a matrix with K = ⌈1/(2ε²)⌉ = <b>${K}</b> equal singular values across modes ` +
      `i${["₁", "₂", "₃", "₄", "₅", "₆"][k - 1]}, i${["₁", "₂", "₃", "₄", "₅", "₆"][k]}, unit vectors elsewhere. ` +
      `Any approximant with bond r &lt; K at this cut has spectral error 1/√K ≈ ${(1 / Math.sqrt(K)).toFixed(3)} &gt; ε. ` +
      `Every cut has such an adversary, so a worst-case TT needs <b>all</b> bonds ≥ K (requires mode size n ≥ ${K}); ` +
      `dense interior cores then cost n·K² each — the ε⁻⁴.`;
  }
  kSlider.addEventListener("input", update);
  eSlider.addEventListener("input", update);
  update();
  onSchemeChange(update);
})();

/* ============================================================
   PART 6 — format shootout (w-shootout)
   ============================================================ */
(function shootout() {
  const sN = document.getElementById("sh-n"), sD = document.getElementById("sh-d");
  const oN = document.getElementById("sh-n-out"), oD = document.getElementById("sh-d-out");
  const chartEl = document.getElementById("shootout-chart");
  const noteEl = document.getElementById("shootout-note");
  function costs(n, d, eps) {
    const N = Math.pow(n, d);
    const ie2 = 1 / (eps * eps);
    const cp = Math.min(d * n * ie2, N);
    const tt = Math.min(2 * n * ie2 + Math.max(0, d - 2) * n * ie2 * ie2, N);
    const rt = Math.min(n, ie2);
    const tucker = Math.min(Math.pow(rt, d) + d * n * rt, N);
    return { cp, tt, tucker, full: N };
  }
  function update() {
    const n = +sN.value, d = +sD.value;
    oN.textContent = n; oD.textContent = d;
    const M = 30;
    const eLo = Math.log10(2), eHi = Math.log10(50);   // ε from 0.5 down to 0.02
    const xs = Array.from({ length: M + 1 }, (_, i) => eLo + (i / M) * (eHi - eLo));
    const data = xs.map(x => costs(n, d, 1 / Math.pow(10, x)));
    const L = key => data.map(c => Math.log10(c[key]));
    const yMax = Math.ceil(d * Math.log10(n)) + 1;
    const ticks = [0.5, 0.3, 0.2, 0.1, 0.05, 0.02].map(e => ({ v: Math.log10(1 / e), label: String(e) }));
    lineChart(chartEl, {
      xs, yMin: 0, yMax,
      label: "Worst-case parameters versus target spectral error for CP, TT, Tucker, and full storage",
      series: [
        { name: "Full nᵈ", color: cssVar("--accent-4"), ys: L("full"), noDots: true, labelAt: "start" },
        { name: "Tucker", color: cssVar("--accent-3"), ys: L("tucker"), noDots: true, labelAt: "start" },
        { name: "TT (dense)", color: cssVar("--accent-2"), ys: L("tt"), noDots: true },
        { name: "CP", color: cssVar("--accent"), ys: L("cp"), noDots: true }
      ],
      yTicks: Array.from({ length: Math.floor(yMax / 2) + 1 }, (_, i) => ({ v: i * 2, label: `10${supStr(i * 2)}` })),
      xTicks: ticks,
      xLabel: "target spectral error ε (log scale, tighter →)",
      tooltip: (x, i) => {
        const eps = 1 / Math.pow(10, x), c = data[i];
        return `<b>ε = ${eps.toFixed(3)}</b><br>CP: ${fmtCount(Math.round(c.cp))}` +
          `<br>TT (dense): ${fmtCount(Math.round(c.tt))}<br>Tucker: ${fmtCount(Math.round(c.tucker))}` +
          `<br>Full: ${fmtCount(c.full)}`;
      }
    });
    const c1 = costs(n, d, 0.1);
    noteEl.innerHTML = `At ε = 0.1: CP ${fmtCount(Math.round(c1.cp))} · TT ${fmtCount(Math.round(c1.tt))} · ` +
      `Tucker ${fmtCount(Math.round(c1.tucker))} · full ${fmtCount(c1.full)}. ` +
      `The per-cut lower bounds hold while 1/(2ε²) ≤ n = ${n}, i.e. ε ≥ ${(1 / Math.sqrt(2 * n)).toFixed(2)}. ` +
      `At very coarse ε, Tucker's still-small core can transiently undercut dense TT — asymptotically the ` +
      `exponents 2 &lt; 4 &lt; 2d decide. Curves cap at n<sup>d</sup> (storing 𝒯 outright).`;
  }
  [sN, sD].forEach(s => s.addEventListener("input", update));
  update();
  onSchemeChange(update);
})();

/* ============================================================
   PART 4 — anatomy of the cliff (w-cliff), log–log
   ============================================================ */
(function cliff() {
  const sN = document.getElementById("cl-n"), sD = document.getElementById("cl-d");
  const oN = document.getElementById("cl-n-out"), oD = document.getElementById("cl-d-out");
  const chartEl = document.getElementById("cliff-chart");
  const noteEl = document.getElementById("cliff-note");
  function update() {
    const n = +sN.value, d = +sD.value;
    oN.textContent = n; oD.textContent = d;
    const E = d * Math.log10(n);                       // log10 N
    const N = Math.pow(n, d);
    const floorExp = 0.5 * Math.log10(d * n) - (d / 2) * Math.log10(n);   // log10 of √(dn)/n^{d/2}
    const yMin = Math.floor((floorExp - 0.8) * 10) / 10, yMax = 0.15;
    const M = 60;
    const xs = Array.from({ length: M + 1 }, (_, i) => (i / M) * E);
    const greedy = xs.map(e => Math.min(0, 0.5 * (Math.log10(d * n) - e)));
    const floorYs = xs.map(() => floorExp);
    const froVal = xs.map(e => Math.sqrt(Math.max(0, 1 - Math.pow(10, e) / N)));
    const fro = froVal.map(v => (v <= Math.pow(10, yMin) ? yMin : Math.log10(v)));
    const xTicks = [], yTicks = [];
    for (let k = 0; k <= Math.floor(E); k += Math.ceil(E / 8)) xTicks.push({ v: k, label: `10${supStr(k)}` });
    for (let k = 0; k >= Math.ceil(yMin); k--) yTicks.push({ v: k, label: k === 0 ? "1" : `10${supStr(k)}` });
    lineChart(chartEl, {
      xs, yMin, yMax,
      label: "Log-log anatomy of the spectral-norm cliff: greedy bound, floor, and the wall at P equals n to the d, all meeting in one point",
      series: [
        { name: "L² (Frobenius)", color: cssVar("--accent-2"), ys: fro, noDots: true, labelAt: "start" },
        { name: "floor", color: cssVar("--accent-3"), ys: floorYs, dashed: true, noDots: true, labelAt: "start" },
        { name: "spectral", color: cssVar("--accent"), ys: greedy, noDots: true }
      ],
      yTicks, xTicks,
      marker: E,
      xLabel: "parameters P (log scale) — dashed vertical line: P = nᵈ = N",
      tooltip: (x, i) => {
        const P = Math.pow(10, x);
        return `<b>P ≈ ${fmtCount(Math.round(P))}</b>` +
          `<br>spectral bound: ${fmtSci(Math.pow(10, greedy[i]))}` +
          `<br>L²: ${froVal[i] <= Math.pow(10, yMin) ? "0 (exact)" : fmtSci(froVal[i])}` +
          `<br>floor: ${fmtSci(Math.pow(10, floorExp))}`;
      }
    });
    const floorVal = Math.pow(10, floorExp);
    const Rstar = Math.round(N / (d * n));
    noteEl.innerHTML = `At n=${n}, d=${d}: N = ${fmtCount(N)}; floor ≈ ${fmtSci(floorVal)}; ` +
      `left kink at P = dn = ${fmtCount(d * n)}. The greedy line meets the floor exactly at P = N, ` +
      `i.e. at rank R = N/(dn) = ${fmtCount(Rstar)} — the generic-rank scale where exact representation takes over. ` +
      `Even reaching 2×floor already costs P = N/4 = ${fmtCount(Math.round(N / 4))}: the endgame is where all the money goes.`;
  }
  [sN, sD].forEach(s => s.addEventListener("input", update));
  update();
  onSchemeChange(update);
})();

/* ============================================================
   nav: progress bar + scrollspy
   ============================================================ */
(function nav() {
  const bar = document.getElementById("progressbar");
  const links = Array.from(document.querySelectorAll("#navlinks a"));
  const secs = links.map(a => document.querySelector(a.getAttribute("href")));
  function onScroll() {
    const doc = document.documentElement;
    const frac = doc.scrollTop / Math.max(1, doc.scrollHeight - doc.clientHeight);
    bar.style.width = (frac * 100).toFixed(2) + "%";
    let active = 0;
    secs.forEach((s, i) => { if (s && s.getBoundingClientRect().top < 140) active = i; });
    links.forEach((a, i) => a.classList.toggle("active", i === active));
  }
  document.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();
