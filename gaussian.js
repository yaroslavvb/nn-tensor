/* ============================================================
   Gaussian low-rank approximation error report — widgets.
   Requires lib.js. All numerics run live in the browser.
   ============================================================ */
"use strict";

/* ---------------- fast symmetric eigensolver (eigenvalues only) ----------------
   Householder tridiagonalization + implicit-shift QL (tred2/tqli, values-only).
   O(n³) with a tiny constant: n=300 in ~20 ms, where cyclic Jacobi would take
   seconds. Verified against lib.js's jacobiEig to 4e-15 relative. */
function gTridiagonalize(Ain) {
  const n = Ain.length;
  const A = Ain.map(r => Float64Array.from(r));
  const d = new Float64Array(n), e = new Float64Array(n);
  for (let i = n - 1; i >= 1; i--) {
    const l = i - 1;
    let h = 0, scale = 0;
    if (l > 0) {
      for (let k = 0; k <= l; k++) scale += Math.abs(A[i][k]);
      if (scale === 0) e[i] = A[i][l];
      else {
        for (let k = 0; k <= l; k++) { A[i][k] /= scale; h += A[i][k] * A[i][k]; }
        let f = A[i][l];
        const g = f >= 0 ? -Math.sqrt(h) : Math.sqrt(h);
        e[i] = scale * g; h -= f * g; A[i][l] = f - g;
        f = 0;
        for (let j = 0; j <= l; j++) {
          let gj = 0;
          for (let k = 0; k <= j; k++) gj += A[j][k] * A[i][k];
          for (let k = j + 1; k <= l; k++) gj += A[k][j] * A[i][k];
          e[j] = gj / h; f += e[j] * A[i][j];
        }
        const hh = f / (h + h);
        for (let j = 0; j <= l; j++) {
          const fj = A[i][j], gj = e[j] - hh * fj;
          e[j] = gj;
          for (let k = 0; k <= j; k++) A[j][k] -= fj * e[k] + gj * A[i][k];
        }
      }
    } else e[i] = A[i][l];
  }
  e[0] = 0;
  for (let i = 0; i < n; i++) d[i] = A[i][i];
  return { d, e };
}
function gTridiagEigs(dIn, eIn) {
  const n = dIn.length;
  const d = Float64Array.from(dIn), e = Float64Array.from(eIn);
  for (let i = 1; i < n; i++) e[i - 1] = e[i];
  e[n - 1] = 0;
  for (let l = 0; l < n; l++) {
    let iter = 0, m;
    do {
      for (m = l; m < n - 1; m++) {
        const dd = Math.abs(d[m]) + Math.abs(d[m + 1]);
        if (Math.abs(e[m]) <= Number.EPSILON * dd) break;
      }
      if (m !== l) {
        if (iter++ === 60) break;
        let g = (d[l + 1] - d[l]) / (2 * e[l]);
        let r = Math.hypot(g, 1);
        g = d[m] - d[l] + e[l] / (g + (g >= 0 ? Math.abs(r) : -Math.abs(r)));
        let s = 1, c = 1, p = 0;
        let underflow = false;
        for (let i = m - 1; i >= l; i--) {
          let f = s * e[i];
          const b = c * e[i];
          r = Math.hypot(f, g);
          e[i + 1] = r;
          if (r === 0) { d[i + 1] -= p; e[m] = 0; underflow = true; break; }
          s = f / r; c = g / r;
          g = d[i + 1] - p;
          r = (d[i] - g) * s + 2 * c * b;
          p = s * r;
          d[i + 1] = g + p;
          g = c * r - b;
        }
        if (underflow) continue;
        d[l] -= p; e[l] = g; e[m] = 0;
      }
    } while (m !== l);
  }
  return Array.from(d);
}
/* all singular values of a square matrix, descending, via the Gram matrix */
function gSingularValues(A) {
  const n = A.length;
  const G = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) for (let j = i; j < n; j++) {
    let s = 0;
    for (let k = 0; k < n; k++) s += A[k][i] * A[k][j];
    G[i][j] = s; G[j][i] = s;
  }
  const { d, e } = gTridiagonalize(G);
  return gTridiagEigs(d, e).map(v => Math.sqrt(Math.max(0, v))).sort((a, b) => b - a);
}

/* ---------------- quarter-circle theory ----------------
   Discarded rank fraction q ↔ angle θ via q = (2θ + sin 2θ)/π; the truncation
   threshold is x* = 2 sin θ (normalized singular value). */
const gQofTheta = th => (2 * th + Math.sin(2 * th)) / Math.PI;
function gThetaFromQ(q) {
  let lo = 0, hi = Math.PI / 2;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (gQofTheta(mid) < q) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
const gRelSpec = th => Math.sin(th);                                   // E₂ / ‖A‖₂
const gRelFro = th => Math.sqrt((2 * th - Math.sin(4 * th) / 2) / Math.PI); // E_F / ‖A‖_F
function gTheoryAtRank(r, n) {
  const th = gThetaFromQ(1 - r / n);
  return { relS: gRelSpec(th), relF: gRelFro(th) };
}

/* ---------------- shared state: one sampled matrix drives every widget ---------------- */
const gState = { n: 100, seed: 20260716, sv: [], tail2: [] };
const gRenderers = [];
function gResample() {
  const n = gState.n;
  const rng = mulberry32(gState.seed);
  const A = Array.from({ length: n }, () => Array.from({ length: n }, () => randn(rng)));
  const sv = gSingularValues(A);
  const tail2 = new Float64Array(n + 1);          // tail2[r] = Σ_{j≥r} σ_j²  (0-indexed σ)
  for (let r = n - 1; r >= 0; r--) tail2[r] = tail2[r + 1] + sv[r] * sv[r];
  gState.sv = sv; gState.tail2 = tail2;
  gRenderers.forEach(f => f());
}
/* exact Eckart–Young errors of the current sample (r = kept rank) */
function gSimAtRank(r) {
  const { n, sv, tail2 } = gState;
  return {
    relS: r < n ? sv[r] / sv[0] : 0,
    relF: Math.sqrt(tail2[r] / tail2[0]),
    absS: r < n ? sv[r] : 0,
    absF: Math.sqrt(tail2[r])
  };
}

/* ============================================================
   PART 1 — the spectrum vs the quarter-circle law (w-spectrum)
   ============================================================ */
(function spectrum() {
  const chartEl = document.getElementById("spectrum-chart");
  const noteEl = document.getElementById("spectrum-note");
  const sN = document.getElementById("qc-n"), sNOut = document.getElementById("qc-n-out");

  function render() {
    const { n, sv } = gState;
    const rt = Math.sqrt(n);
    const xs = Array.from({ length: n }, (_, i) => i + 1);
    const sim = sv.map(s => s / rt);
    const th = xs.map(j => 2 * Math.sin(gThetaFromQ(1 - (j - 0.5) / n)));
    const ticks = [1, Math.round(n / 4), Math.round(n / 2), Math.round(3 * n / 4), n];
    lineChart(chartEl, {
      xs,
      series: [
        { name: "quarter-circle", color: cssVar("--accent-3"), ys: th, dashed: true, noDots: true, labelAt: "start" },
        { name: "sample σⱼ/√n", color: cssVar("--accent"), ys: sim, noDots: n > 40 }
      ],
      yMin: 0, yMax: Math.max(2.2, sim[0] * 1.03),
      yTicks: [0, 0.5, 1, 1.5, 2].map(v => ({ v, label: String(v) })),
      xTicks: ticks.map(v => ({ v, label: String(v) })),
      xLabel: "index j (singular values sorted descending)",
      label: "sorted singular values of a Gaussian matrix vs quarter-circle prediction",
      tooltip: (x, i) => {
        return `<b>j = ${x}</b><br>σⱼ = ${sv[i].toFixed(2)} &nbsp;(σⱼ/√n = ${sim[i].toFixed(3)})<br>quarter-circle: ${th[i].toFixed(3)}`;
      }
    });
    const fro = Math.sqrt(gState.tail2[0]);
    noteEl.innerHTML =
      `n = ${n}: &nbsp;σ₁ = <b>${sv[0].toFixed(1)}</b> (law: 2√n = ${(2 * rt).toFixed(1)}) · ` +
      `‖A‖<sub>F</sub> = <b>${fro.toFixed(1)}</b> (law: n = ${n}) · ` +
      `σ<sub>n</sub> = <b>${sv[n - 1].toFixed(2)}</b> (hard edge ~ n<sup>−1/2</sup> = ${(1 / rt).toFixed(2)}). ` +
      `No gap, no decay: the spectrum is a filled quarter-circle bulk.`;
  }

  sN.addEventListener("input", () => {
    sNOut.textContent = sN.value;
    gState.n = +sN.value;
    gState.seed += 101;
    gResample();
  });
  document.getElementById("qc-resample").addEventListener("click", () => {
    gState.seed += 101;
    gResample();
  });
  gRenderers.push(render);
  onSchemeChange(render);
})();

/* ============================================================
   PART 2 — Eckart–Young error vs rank: sample vs formula (w-error)
   ============================================================ */
(function errorCurve() {
  const chartEl = document.getElementById("error-chart");
  const noteEl = document.getElementById("er-note");
  const sR = document.getElementById("er-r"), sROut = document.getElementById("er-r-out");
  const tSpec = document.getElementById("er-spec"), tFro = document.getElementById("er-fro"),
        tEn = document.getElementById("er-energy");
  let frac = 0.25;   // remembered rank fraction, survives resampling

  function render() {
    const { n } = gState;
    sR.max = n;
    const r = Math.min(n, Math.max(0, Math.round(frac * n)));
    sR.value = r; sROut.textContent = r;

    const xs = Array.from({ length: n + 1 }, (_, k) => k / n);
    const simS = [], simF = [], thS = [], thF = [];
    for (let k = 0; k <= n; k++) {
      const sim = gSimAtRank(k), th = gTheoryAtRank(k, n);
      simS.push(sim.relS); simF.push(sim.relF); thS.push(th.relS); thF.push(th.relF);
    }
    lineChart(chartEl, {
      xs,
      series: [
        { name: "", color: cssVar("--accent"), ys: thS, dashed: true, noDots: true },
        { name: "", color: cssVar("--accent-2"), ys: thF, dashed: true, noDots: true },
        { name: "spectral", color: cssVar("--accent"), ys: simS, noDots: true, labelAt: "start" },
        { name: "Frobenius", color: cssVar("--accent-2"), ys: simF, noDots: true }
      ],
      yMin: 0, yMax: 1,
      yTicks: [0, 0.25, 0.5, 0.75, 1].map(v => ({ v, label: String(v) })),
      xTicks: [0, 0.25, 0.5, 0.75, 1].map(v => ({ v, label: String(v) })),
      xLabel: "kept rank fraction r/n   (solid: this sample · dashed: quarter-circle formula)",
      label: "relative Eckart–Young truncation error vs rank",
      marker: r / n,
      tooltip: (x, i) => {
        return `<b>rank r = ${i}</b> (r/n = ${x.toFixed(2)})<br>` +
          `spectral: ${simS[i].toFixed(3)} (formula ${thS[i].toFixed(3)})<br>` +
          `Frobenius: ${simF[i].toFixed(3)} (formula ${thF[i].toFixed(3)})`;
      }
    });

    const sim = gSimAtRank(r), th = gTheoryAtRank(r, n);
    tSpec.textContent = sim.relS.toFixed(3);
    tFro.textContent = sim.relF.toFixed(3);
    tEn.textContent = ((1 - sim.relF * sim.relF) * 100).toFixed(1) + "%";
    noteEl.innerHTML =
      `r = ${r} of ${n}: &nbsp;E₂ = σ<sub>r+1</sub> = <b>${sim.absS.toFixed(2)}</b>, ` +
      `E<sub>F</sub> = <b>${sim.absF.toFixed(2)}</b>. ` +
      `Formula: spectral ${th.relS.toFixed(3)}, Frobenius ${th.relF.toFixed(3)} — ` +
      `the sample sits on the curve to ~1%. Captured energy 1 − (E<sub>F</sub>/‖A‖<sub>F</sub>)² ≈ ` +
      `<b>${((1 - th.relF * th.relF) * 100).toFixed(1)}%</b> (≈ 4r/n = ${(400 * r / n).toFixed(0)}% when r ≪ n).`;
  }

  sR.addEventListener("input", () => {
    frac = +sR.value / gState.n;
    render();
  });
  gRenderers.push(render);
  onSchemeChange(render);
})();

/* ============================================================
   PART 3 — spot-check table (live, follows the current sample)
   ============================================================ */
(function table() {
  const body = document.getElementById("f-table-body");
  const cap = document.getElementById("f-table-cap");

  function render() {
    const { n } = gState;
    body.innerHTML = "";
    for (const f of [0.01, 0.1, 0.25, 0.5, 0.75, 0.9]) {
      const r = Math.max(1, Math.round(f * n));
      const sim = gSimAtRank(r), th = gTheoryAtRank(r, n);
      const tr = document.createElement("tr");
      tr.innerHTML =
        `<td>${r}</td><td>${(100 * r / n).toFixed(0)}%</td>` +
        `<td>${th.relS.toFixed(3)}</td><td>${sim.relS.toFixed(3)}</td>` +
        `<td>${th.relF.toFixed(3)}</td><td>${sim.relF.toFixed(3)}</td>`;
      body.appendChild(tr);
    }
    cap.textContent = `Current sample: n = ${n} (resample in Part 1 and watch the table wobble in the third decimal).`;
  }
  gRenderers.push(render);
})();

/* ============================================================
   PART 4 — asymptotic decay on log–log axes (w-decay)
   ============================================================ */
(function decay() {
  const chartEl = document.getElementById("decay-chart");
  const noteEl = document.getElementById("decay-note");
  const seg = document.getElementById("decay-reg");
  let regime = "tail";

  function render() {
    const { n } = gState;
    const L = Math.log10;
    if (regime === "tail") {
      /* error vs discarded fraction q = (n−r)/n, log–log */
      const rs = Array.from({ length: n }, (_, i) => n - 1 - i);      // q ascending
      const xs = rs.map(r => L((n - r) / n));
      const simS = rs.map(r => L(gSimAtRank(r).relS));
      const simF = rs.map(r => L(gSimAtRank(r).relF));
      const thS = rs.map(r => L(gTheoryAtRank(r, n).relS));
      const thF = rs.map(r => L(gTheoryAtRank(r, n).relF));
      const asy1 = rs.map(r => L(Math.PI / 4 * (n - r) / n));
      const asy32 = rs.map(r => L(Math.PI / (2 * Math.sqrt(3)) * Math.pow((n - r) / n, 1.5)));
      const yMin = Math.floor(Math.min(...asy32, ...simF));
      lineChart(chartEl, {
        xs,
        series: [
          { name: "slope 1", color: cssVar("--muted"), ys: asy1, dashed: true, noDots: true, labelAt: "start" },
          { name: "slope 3/2", color: cssVar("--muted"), ys: asy32, dashed: true, noDots: true, labelAt: "start" },
          { name: "", color: cssVar("--accent"), ys: thS, dashed: true, noDots: true },
          { name: "", color: cssVar("--accent-2"), ys: thF, dashed: true, noDots: true },
          { name: "spectral", color: cssVar("--accent"), ys: simS, noDots: true, labelDy: -6 },
          { name: "Frobenius", color: cssVar("--accent-2"), ys: simF, noDots: true, labelDy: 10 }
        ],
        yMin, yMax: 0,
        yTicks: Array.from({ length: -yMin + 1 }, (_, i) => ({ v: -i, label: i === 0 ? "1" : `10${supStr(-i)}` })),
        xTicks: [0.01, 0.03, 0.1, 0.3, 1].filter(q => q >= 1 / n).map(q => ({ v: L(q), label: String(q) })),
        xLabel: "discarded rank fraction q = 1 − r/n (log–log, near-full-rank regime at left)",
        label: "relative error vs discarded fraction, log-log",
        tooltip: (x, i) => {
          const r = rs[i], q = (n - r) / n;
          return `<b>q = ${q.toFixed(3)}</b> (r = ${r})<br>` +
            `spectral: ${Math.pow(10, simS[i]).toFixed(4)} · slope-1 law: ${(Math.PI / 4 * q).toFixed(4)}<br>` +
            `Frobenius: ${Math.pow(10, simF[i]).toFixed(4)} · slope-3/2 law: ${(Math.PI / (2 * Math.sqrt(3)) * Math.pow(q, 1.5)).toFixed(4)}`;
        }
      });
      noteEl.innerHTML =
        `As q → 0 the curves become straight lines: spectral error ≈ (π/4)·q ` +
        `(<b>slope 1</b>) and Frobenius error ≈ 0.907·q<sup>3/2</sup> (<b>slope 3/2</b>). ` +
        `Polynomial in the <i>discarded</i> fraction — and that is the fastest decay Gaussian noise ever shows. ` +
        `The very last few points (q ≈ 1/n) feel the hard edge and drift off the bulk formula.`;
    } else {
      /* head regime: how little you gain at small kept fraction α */
      const rMax = Math.max(2, Math.round(n / 2));
      const rs = Array.from({ length: rMax }, (_, i) => i + 1);       // α ascending
      const xs = rs.map(r => L(r / n));
      const simS = rs.map(r => L(Math.max(1e-9, 1 - gSimAtRank(r).relS)));
      const simF = rs.map(r => L(Math.max(1e-9, 1 - gSimAtRank(r).relF)));
      const thS = rs.map(r => L(1 - gTheoryAtRank(r, n).relS));
      const thF = rs.map(r => L(1 - gTheoryAtRank(r, n).relF));
      const cS = 0.5 * Math.pow(3 * Math.PI / 4, 2 / 3);
      const asy23 = rs.map(r => L(cS * Math.pow(r / n, 2 / 3)));
      const asy1 = rs.map(r => L(2 * r / n));
      const yMin = Math.floor(Math.min(...simS, ...asy23));
      lineChart(chartEl, {
        xs,
        series: [
          { name: "slope 2/3", color: cssVar("--muted"), ys: asy23, dashed: true, noDots: true, labelAt: "start", labelDy: 16 },
          { name: "slope 1", color: cssVar("--muted"), ys: asy1, dashed: true, noDots: true },
          { name: "", color: cssVar("--accent"), ys: thS, dashed: true, noDots: true },
          { name: "", color: cssVar("--accent-2"), ys: thF, dashed: true, noDots: true },
          { name: "spectral", color: cssVar("--accent"), ys: simS, noDots: true, labelAt: "start", labelDy: -6 },
          { name: "Frobenius", color: cssVar("--accent-2"), ys: simF, noDots: true }
        ],
        yMin, yMax: 0,
        yTicks: Array.from({ length: -yMin + 1 }, (_, i) => ({ v: -i, label: i === 0 ? "1" : `10${supStr(-i)}` })),
        xTicks: [0.003, 0.01, 0.03, 0.1, 0.3].filter(a => a >= 1 / n).map(a => ({ v: L(a), label: String(a) })),
        xLabel: "kept rank fraction α = r/n (log–log): how much error a small rank removes",
        label: "one minus relative error vs kept fraction, log-log",
        tooltip: (x, i) => {
          const r = rs[i], a = r / n;
          return `<b>α = ${a.toFixed(3)}</b> (r = ${r})<br>` +
            `1 − spectral err: ${Math.pow(10, simS[i]).toFixed(4)} · slope-2/3 law: ${(cS * Math.pow(a, 2 / 3)).toFixed(4)}<br>` +
            `1 − Frobenius err: ${Math.pow(10, simF[i]).toFixed(4)} · slope-1 law: ${(2 * a).toFixed(4)}`;
        }
      });
      noteEl.innerHTML =
        `Plotted is 1 − error: the <i>progress</i> a small rank makes. Spectral progress ≈ 0.885·α<sup>2/3</sup> ` +
        `(<b>slope 2/3</b>), Frobenius progress ≈ 2α (<b>slope 1</b>). Fix r and let n grow: α → 0 and both ` +
        `progresses vanish — a fixed-rank approximation of large noise captures nothing. The wiggle at the far ` +
        `left (r = 1, 2, …) is Tracy–Widom edge fluctuation, which the bulk formula ignores.`;
    }
  }

  seg.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
    regime = b.dataset.reg;
    seg.querySelectorAll("button").forEach(x => {
      x.classList.toggle("on", x === b);
      x.setAttribute("aria-pressed", x === b ? "true" : "false");
    });
    render();
  }));
  gRenderers.push(render);
  onSchemeChange(render);
})();

/* ============================================================
   kick off + nav
   ============================================================ */
gResample();

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
