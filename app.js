/* ============================================================
   Tensor Decompositions, Interactively — all widgets.
   Vanilla JS, no dependencies. All numerics run in-browser.
   ============================================================ */
"use strict";

/* utilities (rng, linalg, heatmap, lineChart, onSchemeChange, …) live in lib.js */

/* ============================================================
   WIDGET 1 — order-3 tensor explorer (4×3×2)
   ============================================================ */
(function explorer() {
  const I = 4, J = 3, K = 2;
  const rng = mulberry32(20250816);
  const T = Array.from({ length: I }, () => Array.from({ length: J }, () => Array.from({ length: K },
    () => Math.round((rng() * 2 - 1) * 9))));
  const slicesEl = document.getElementById("explorer-slices");
  const readout = document.getElementById("explorer-readout");
  let mode = "entry";

  function cells() { return slicesEl.querySelectorAll(".hm-cell"); }

  function render() {
    slicesEl.innerHTML = "";
    for (let k = 0; k < K; k++) {
      const wrap = document.createElement("div");
      wrap.className = "slice";
      const M = Array.from({ length: I }, (_, i) => Array.from({ length: J }, (_, j) => T[i][j][k]));
      const grid = document.createElement("div");
      renderHeatmap(grid, M, { scale: 9 });
      grid.querySelectorAll(".hm-cell").forEach(c => { c.dataset.k = k; });
      wrap.appendChild(grid);
      const lab = document.createElement("div");
      lab.className = "slice-label";
      lab.textContent = `frontal slice  X[:, :, ${k + 1}]`;
      wrap.appendChild(lab);
      slicesEl.appendChild(wrap);
    }
    cells().forEach(c => {
      c.addEventListener("mouseenter", () => highlight(+c.dataset.i, +c.dataset.j, +c.dataset.k));
    });
    slicesEl.addEventListener("mouseleave", clear);
  }
  function clear() {
    cells().forEach(c => c.classList.remove("hl", "dim"));
    readout.textContent = "hover an entry…";
  }
  function highlight(i, j, k) {
    const inSet = (ci, cj, ck) => {
      switch (mode) {
        case "entry": return ci === i && cj === j && ck === k;
        case "fiber1": return cj === j && ck === k;
        case "fiber2": return ci === i && ck === k;
        case "fiber3": return ci === i && cj === j;
        case "slice3": return ck === k;
      }
    };
    cells().forEach(c => {
      const hit = inSet(+c.dataset.i, +c.dataset.j, +c.dataset.k);
      c.classList.toggle("hl", hit);
      c.classList.toggle("dim", !hit);
    });
    const names = {
      entry: `entry X[${i + 1},${j + 1},${k + 1}] = ${T[i][j][k]}`,
      fiber1: `mode-1 fiber X[:, ${j + 1}, ${k + 1}] — vary the 1st index, 4 entries`,
      fiber2: `mode-2 fiber X[${i + 1}, :, ${k + 1}] — vary the 2nd index, 3 entries`,
      fiber3: `mode-3 fiber X[${i + 1}, ${j + 1}, :] — vary the 3rd index, one entry per slice`,
      slice3: `frontal slice X[:, :, ${k + 1}] — a 4×3 matrix`
    };
    readout.innerHTML = `<b>X[${i + 1},${j + 1},${k + 1}] = ${T[i][j][k]}</b> · highlighted: ${names[mode]}`;
  }
  document.querySelectorAll("#explorer-controls .seg button").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#explorer-controls .seg button").forEach(b => { b.classList.remove("on"); b.setAttribute("aria-pressed", "false"); });
      btn.classList.add("on");
      btn.setAttribute("aria-pressed", "true");
      mode = btn.dataset.hl;
      clear();
    });
  });
  render();
  onSchemeChange(render);
})();

/* ============================================================
   WIDGET 2 — outer-product playground
   ============================================================ */
(function outer() {
  const a = [1.5, 1.0, -0.5, 0.5], b = [1.0, -1.0, 0.5], c = [1.0, 0.6];
  const vecs = { a, b, c };
  const holders = { a: "vec-a", b: "vec-b", c: "vec-c" };
  const slicesEl = document.getElementById("outer-slices");
  const readout = document.getElementById("outer-readout");

  function makeSliders(name) {
    const el = document.getElementById(holders[name]);
    vecs[name].forEach((v, idx) => {
      const row = document.createElement("div");
      row.className = "vec-slider";
      row.innerHTML = `<span style="font-size:11.5px;color:var(--muted);width:22px">${name}<sub>${idx + 1}</sub></span>
        <input type="range" min="-2" max="2" step="0.1" value="${v}">
        <output>${v.toFixed(1)}</output>`;
      const input = row.querySelector("input"), out = row.querySelector("output");
      input.addEventListener("input", () => {
        vecs[name][idx] = parseFloat(input.value);
        out.textContent = vecs[name][idx].toFixed(1);
        render();
      });
      el.appendChild(row);
    });
  }
  function render() {
    slicesEl.innerHTML = "";
    const scale = Math.max(1e-9,
      Math.max(...a.map(Math.abs)) * Math.max(...b.map(Math.abs)) * Math.max(...c.map(Math.abs)));
    for (let k = 0; k < c.length; k++) {
      const wrap = document.createElement("div");
      wrap.className = "slice";
      const M = a.map(ai => b.map(bj => ai * bj * c[k]));
      const grid = document.createElement("div");
      renderHeatmap(grid, M, {
        scale,
        onHover: (i, j) => {
          readout.innerHTML = `X[${i + 1},${j + 1},${k + 1}] = a<sub>${i + 1}</sub>·b<sub>${j + 1}</sub>·c<sub>${k + 1}</sub> = ` +
            `(${a[i].toFixed(1)})·(${b[j].toFixed(1)})·(${c[k].toFixed(1)}) = <b>${(a[i] * b[j] * c[k]).toFixed(2)}</b>`;
        }
      });
      wrap.appendChild(grid);
      const lab = document.createElement("div");
      lab.className = "slice-label";
      lab.textContent = `X[:, :, ${k + 1}]  =  c${k + 1} · (a ⊗ b)`;
      wrap.appendChild(lab);
      slicesEl.appendChild(wrap);
    }
    readout.textContent = "hover an entry to see its formula";  // reset: old formulas go stale on slider change
  }
  makeSliders("a"); makeSliders("b"); makeSliders("c");
  render();
  onSchemeChange(render);
})();

/* ============================================================
   WIDGET 3 — CPD via ALS on a 4×4×4 rank-3 tensor
   ============================================================ */
(function cpd() {
  const I = 4, J = 4, K = 4, TRUE_RANK = 3;
  // ground-truth tensor from seeded rank-3 factors
  const rng0 = mulberry32(424242);
  const randMat = (r, cN, rng) => Array.from({ length: r }, () => Array.from({ length: cN }, () => randn(rng)));
  const A0 = randMat(I, TRUE_RANK, rng0), B0 = randMat(J, TRUE_RANK, rng0), C0 = randMat(K, TRUE_RANK, rng0);
  const T = new Float64Array(I * J * K);
  const idx = (i, j, k) => i + I * (j + J * k);
  for (let i = 0; i < I; i++) for (let j = 0; j < J; j++) for (let k = 0; k < K; k++) {
    let s = 0;
    for (let r = 0; r < TRUE_RANK; r++) s += A0[i][r] * B0[j][r] * C0[k][r];
    T[idx(i, j, k)] = s;
  }
  const normT = Math.sqrt(T.reduce((s, v) => s + v * v, 0));

  function reconstruct(A, B, C) {
    const R = A[0].length, out = new Float64Array(I * J * K);
    for (let i = 0; i < I; i++) for (let j = 0; j < J; j++) for (let k = 0; k < K; k++) {
      let s = 0;
      for (let r = 0; r < R; r++) s += A[i][r] * B[j][r] * C[k][r];
      out[idx(i, j, k)] = s;
    }
    return out;
  }
  function relErr(A, B, C) {
    const That = reconstruct(A, B, C);
    let s = 0;
    for (let n = 0; n < T.length; n++) { const d = T[n] - That[n]; s += d * d; }
    return Math.sqrt(s) / normT;
  }
  /* mode-n MTTKRP: T(n) · KhatriRao(...) */
  function mttkrp(mode, A, B, C) {
    const R = (mode === 1 ? B : A)[0].length;
    const dims = [I, J, K];
    const out = zeros(dims[mode - 1], R);
    for (let i = 0; i < I; i++) for (let j = 0; j < J; j++) for (let k = 0; k < K; k++) {
      const t = T[idx(i, j, k)];
      if (mode === 1) for (let r = 0; r < R; r++) out[i][r] += t * B[j][r] * C[k][r];
      else if (mode === 2) for (let r = 0; r < R; r++) out[j][r] += t * A[i][r] * C[k][r];
      else for (let r = 0; r < R; r++) out[k][r] += t * A[i][r] * B[j][r];
    }
    return out;
  }
  function alsFit(R, seed) {
    const rng = mulberry32(seed);
    let A = randMat(I, R, rng), B = randMat(J, R, rng), C = randMat(K, R, rng);
    let best = Infinity;
    for (let it = 0; it < 600; it++) {
      A = transpose(solveLin(hadamard(gramT(B), gramT(C)), transpose(mttkrp(1, A, B, C))));
      B = transpose(solveLin(hadamard(gramT(A), gramT(C)), transpose(mttkrp(2, A, B, C))));
      C = transpose(solveLin(hadamard(gramT(A), gramT(B)), transpose(mttkrp(3, A, B, C))));
      if (it % 20 === 19) {
        const e = relErr(A, B, C);
        if (e < 1e-14) break;
        if (best - e < 1e-15 && it > 100) break;
        best = Math.min(best, e);
      }
    }
    return { A, B, C, err: relErr(A, B, C) };
  }

  const fits = {}; // R -> {A,B,C,err}
  function fitFor(R, forceSeed) {
    if (forceSeed != null || !fits[R]) {
      let best = null;
      const base = forceSeed != null ? forceSeed : 1000 * R;
      for (let s = 0; s < 4; s++) {
        const f = alsFit(R, base + s * 77 + 1);
        if (!best || f.err < best.err) best = f;
        if (best.err < 1e-13) break;
      }
      fits[R] = best;
    }
    return fits[R];
  }

  const slider = document.getElementById("cpd-rank");
  const rankOut = document.getElementById("cpd-rank-out");
  const errEl = document.getElementById("cpd-err");
  const verdictEl = document.getElementById("cpd-verdict");
  const chartEl = document.getElementById("cpd-errchart");
  const uniNote = document.getElementById("cpd-uni-note");
  const btnPerm = document.getElementById("cpd-permute");
  const btnScale = document.getElementById("cpd-rescale");
  let refitCounter = 0;

  function drawFactors(f) {
    const scale = Math.max(...[f.A, f.B, f.C].flat(2).map(Math.abs));
    renderHeatmap(document.getElementById("cpd-A"), f.A, { scale, small: true });
    renderHeatmap(document.getElementById("cpd-B"), f.B, { scale, small: true });
    renderHeatmap(document.getElementById("cpd-C"), f.C, { scale, small: true });
  }
  function drawChart() {
    const xs = [1, 2, 3, 4, 5];
    const ys = xs.map(R => Math.log10(Math.max(fits[R] ? fits[R].err : 1, 1e-16)));
    lineChart(chartEl, {
      xs, yMin: -16, yMax: 0,
      label: "CPD relative error versus number of components R",
      series: [{ name: "rel. error", color: cssVar("--accent"), ys }],
      yTicks: [0, -4, -8, -12, -16].map(v => ({ v, label: v === 0 ? "1" : `10${supStr(v)}` })),
      xLabel: "number of components R",
      marker: +slider.value,
      tooltip: (x, i) => `<b>R = ${x}</b><br>relative error: ${fmtSci(Math.pow(10, ys[i]))}` +
        (x === TRUE_RANK ? "<br><b>= the true rank</b>" : "")
    });
  }
  function supStr(n) {
    const map = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
    return String(n).split("").map(ch => map[ch] || ch).join("");
  }
  function update(forceSeed) {
    const R = +slider.value;
    rankOut.textContent = R;
    const f = fitFor(R, forceSeed);
    errEl.innerHTML = fmtSci(Math.max(f.err, 1e-16));
    verdictEl.textContent =
      f.err < 1e-6 ? `≈ 0 (machine precision): R = ${R} ≥ true rank ${TRUE_RANK} — exact fit`
        : `R = ${R} < true rank ${TRUE_RANK}: the best rank-${R} model can’t represent T`;
    drawFactors(f);
    drawChart();
    btnPerm.disabled = R < 2;
    btnScale.disabled = false;
    uniNote.innerHTML = R >= 2
      ? "Now try the buttons: the factors will change, the tensor won’t."
      : "Rescaling works at any R; permuting needs R ≥ 2.";
  }
  slider.addEventListener("input", () => update());
  document.getElementById("cpd-refit").addEventListener("click", () => {
    refitCounter++;
    update(90000 + refitCounter * 131);
  });
  btnPerm.addEventListener("click", () => {
    const f = fits[+slider.value];
    [f.A, f.B, f.C].forEach(M => M.forEach(row => { const t = row[0]; row[0] = row[1]; row[1] = t; }));
    f.err = relErr(f.A, f.B, f.C);
    drawFactors(f);
    errEl.innerHTML = fmtSci(Math.max(f.err, 1e-16));
    uniNote.innerHTML = `Swapped components 1 ⇄ 2 in <b>all three factors</b> — relative error still ${fmtSci(Math.max(f.err, 1e-16))}. Permutation is a “trivial” ambiguity.`;
  });
  btnScale.addEventListener("click", () => {
    const f = fits[+slider.value];
    f.scaledUp = !f.scaledUp;               // toggle so repeated clicks stay bounded
    const lam = f.scaledUp ? 2 : 0.5;
    f.A.forEach(row => row[0] *= lam);
    f.B.forEach(row => row[0] /= lam);
    f.err = relErr(f.A, f.B, f.C);
    drawFactors(f);
    errEl.innerHTML = fmtSci(Math.max(f.err, 1e-16));
    uniNote.innerHTML = `Multiplied a₁ by λ=${f.scaledUp ? "2" : "½"} and divided b₁ by the same λ — relative error still ${fmtSci(Math.max(f.err, 1e-16))}. Scaling inside a component is the other trivial ambiguity.`;
  });

  // precompute all fits (fast), then first paint
  for (let R = 1; R <= 5; R++) fitFor(R);
  update();
  onSchemeChange(() => update());
})();

/* ---------------- generic-rank mini calculator ---------------- */
(function grank() {
  const slider = document.getElementById("grank-i");
  const out = document.getElementById("grank-i-out");
  const res = document.getElementById("grank-result");
  function upd() {
    const I = +slider.value;
    // ceil(I^3/(3I-2)) is the generic complex rank for every I except the
    // famous defective cube I = 3, whose generic rank is 5 (Strassen)
    const rg = I === 3 ? 5 : Math.ceil(I * I * I / (3 * I - 2));
    out.textContent = I;
    res.innerHTML = `generic rank of a ${I}×${I}×${I} tensor → <b>${rg}</b>&nbsp; (over ℂ; smallest typical rank over ℝ — a matrix that size caps at ${I})`;
  }
  slider.addEventListener("input", upd);
  upd();
})();

/* ============================================================
   WIDGET 4 — Tucker / truncated HOSVD on 8×8×8
   ============================================================ */
(function tucker() {
  const N = 8;
  const lin = Array.from({ length: N }, (_, i) => i / (N - 1));
  const T = new Float64Array(N * N * N);
  const idx = (i, j, k) => i + N * (j + N * k);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++)
    T[idx(i, j, k)] = 1 / (1 + lin[i] + lin[j] + lin[k]);
  const normT = Math.sqrt(T.reduce((s, v) => s + v * v, 0));

  // Gram matrices of the three unfoldings, eigendecomposed once
  function gramMode(mode) {
    const G = zeros(N, N);
    if (mode === 1) {
      for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
        let s = 0;
        for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) s += T[idx(a, j, k)] * T[idx(b, j, k)];
        G[a][b] = s;
      }
    } else if (mode === 2) {
      for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
        let s = 0;
        for (let i = 0; i < N; i++) for (let k = 0; k < N; k++) s += T[idx(i, a, k)] * T[idx(i, b, k)];
        G[a][b] = s;
      }
    } else {
      for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
        let s = 0;
        for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) s += T[idx(i, j, a)] * T[idx(i, j, b)];
        G[a][b] = s;
      }
    }
    return G;
  }
  const eig1 = jacobiEig(gramMode(1)), eig2 = jacobiEig(gramMode(2)), eig3 = jacobiEig(gramMode(3));

  function projector(eig, R) { // P = U_R U_Rᵀ  (N×N)
    const P = zeros(N, N);
    for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
      let s = 0;
      for (let r = 0; r < R; r++) s += eig.vecs[a][r] * eig.vecs[b][r];
      P[a][b] = s;
    }
    return P;
  }
  function applyMode(Tin, P, mode) {
    const out = new Float64Array(N * N * N);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
      let s = 0;
      for (let a = 0; a < N; a++) {
        s += mode === 1 ? P[i][a] * Tin[idx(a, j, k)]
          : mode === 2 ? P[j][a] * Tin[idx(i, a, k)]
            : P[k][a] * Tin[idx(i, j, a)];
      }
      out[idx(i, j, k)] = s;
    }
    return out;
  }
  function hosvdErr(R1, R2, R3) {
    let X = applyMode(T, projector(eig1, R1), 1);
    X = applyMode(X, projector(eig2, R2), 2);
    X = applyMode(X, projector(eig3, R3), 3);
    let s = 0;
    for (let n = 0; n < T.length; n++) { const d = T[n] - X[n]; s += d * d; }
    return Math.sqrt(s) / normT;
  }
  const uniformErr = [];
  for (let r = 1; r <= N; r++) uniformErr.push(hosvdErr(r, r, r));

  const s1 = document.getElementById("tk-r1"), s2 = document.getElementById("tk-r2"), s3 = document.getElementById("tk-r3");
  const o1 = document.getElementById("tk-r1-out"), o2 = document.getElementById("tk-r2-out"), o3 = document.getElementById("tk-r3-out");
  const errEl = document.getElementById("tk-err"), paramsEl = document.getElementById("tk-params"), ratioEl = document.getElementById("tk-ratio");
  const chartEl = document.getElementById("tk-errchart"), diagEl = document.getElementById("tucker-diagram");
  const supStr = n => String(n).split("").map(ch => ({ "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" }[ch] || ch)).join("");

  function drawDiagram(R1, R2, R3) {
    diagEl.innerHTML = `
    <svg viewBox="0 0 420 150" style="width:100%;max-width:420px" class="chart" aria-label="Tucker network diagram">
      <line x1="150" y1="75" x2="210" y2="75" stroke="var(--baseline)" stroke-width="2"/>
      <line x1="250" y1="55" x2="310" y2="30" stroke="var(--baseline)" stroke-width="2"/>
      <line x1="250" y1="95" x2="310" y2="120" stroke="var(--baseline)" stroke-width="2"/>
      <line x1="110" y1="75" x2="70"  y2="75" stroke="var(--muted)" stroke-width="2" stroke-dasharray="3 3"/>
      <line x1="330" y1="22" x2="370" y2="14" stroke="var(--muted)" stroke-width="2" stroke-dasharray="3 3"/>
      <line x1="330" y1="128" x2="370" y2="136" stroke="var(--muted)" stroke-width="2" stroke-dasharray="3 3"/>
      <rect x="210" y="50" width="40" height="50" rx="8" fill="var(--accent)"/>
      <text x="230" y="80" text-anchor="middle" fill="#fff" font-size="15" font-weight="700">𝒢</text>
      <circle cx="130" cy="75" r="20" fill="var(--accent-2)"/>
      <text x="130" y="80" text-anchor="middle" fill="#fff" font-size="13" font-weight="700">U</text>
      <circle cx="322" cy="26" r="20" fill="var(--accent-2)"/>
      <text x="322" y="31" text-anchor="middle" fill="#fff" font-size="13" font-weight="700">V</text>
      <circle cx="322" cy="124" r="20" fill="var(--accent-2)"/>
      <text x="322" y="129" text-anchor="middle" fill="#fff" font-size="13" font-weight="700">W</text>
      <text x="180" y="68" text-anchor="middle" font-size="12" fill="var(--ink-2)">R₁=${R1}</text>
      <text x="280" y="34" text-anchor="middle" font-size="12" fill="var(--ink-2)">R₂=${R2}</text>
      <text x="280" y="120" text-anchor="middle" font-size="12" fill="var(--ink-2)">R₃=${R3}</text>
      <text x="58" y="70" text-anchor="middle" font-size="12" fill="var(--muted)">I=8</text>
      <text x="382" y="12" text-anchor="middle" font-size="12" fill="var(--muted)">J=8</text>
      <text x="382" y="146" text-anchor="middle" font-size="12" fill="var(--muted)">K=8</text>
    </svg>`;
  }
  function update() {
    const R1 = +s1.value, R2 = +s2.value, R3 = +s3.value;
    o1.textContent = R1; o2.textContent = R2; o3.textContent = R3;
    const err = hosvdErr(R1, R2, R3);
    errEl.innerHTML = fmtSci(Math.max(err, 1e-16));
    const p = R1 * R2 * R3 + N * (R1 + R2 + R3);
    paramsEl.innerHTML = `${p} vs 512`;
    ratioEl.innerHTML = p < 512
      ? `compression ×${(512 / p).toFixed(1)} — core ${R1}·${R2}·${R3} = ${R1 * R2 * R3}, factors 8·(${R1}+${R2}+${R3}) = ${N * (R1 + R2 + R3)}`
      : `no compression at these ranks (core + factors ≥ full tensor)`;
    drawDiagram(R1, R2, R3);
    const xs = Array.from({ length: N }, (_, i) => i + 1);
    lineChart(chartEl, {
      xs, yMin: -16, yMax: 0,
      label: "Tucker relative error versus uniform multilinear rank",
      series: [{ name: "rel. error", color: cssVar("--accent-2"), ys: uniformErr.map(e => Math.log10(Math.max(e, 1e-16))) }],
      yTicks: [0, -4, -8, -12, -16].map(v => ({ v, label: v === 0 ? "1" : `10${supStr(v)}` })),
      xLabel: "uniform multilinear rank (R, R, R)",
      marker: (R1 === R2 && R2 === R3) ? R1 : null,
      tooltip: (x, i) => `<b>(R,R,R) = (${x},${x},${x})</b><br>relative error: ${fmtSci(Math.max(uniformErr[i], 1e-16))}<br>params: ${x * x * x + N * 3 * x} vs 512`
    });
  }
  [s1, s2, s3].forEach(s => s.addEventListener("input", update));
  update();
  onSchemeChange(update);
})();

/* ============================================================
   WIDGET 5 — tensor-network diagrams (Tucker / TT / HT)
   ============================================================ */
(function tnDiagrams() {
  const diagEl = document.getElementById("tn-diagram");
  const capEl = document.getElementById("tn-caption");
  const captions = {
    tucker: "Tucker = a star: one order-3 core 𝒢 connected to a factor matrix per mode. Core size R₁R₂R₃ — fine at order 3, exponential (R^d) at order d.",
    tt: "Tensor Train = the minimal (linear) tree: a chain of order-≤3 cores. Storage grows linearly in the order d — the workhorse format in high dimensions.",
    ht: "Hierarchical Tucker = a binary tree: leaf matrices feed pairwise into transfer cores up to the root. Also linear in d; this is paper eq. (3)."
  };
  const node = (x, y, label, info, shape = "circle", color = "var(--accent-2)") => `
    <g class="tn-node" data-info="${info}">
      ${shape === "circle"
      ? `<circle cx="${x}" cy="${y}" r="20" fill="${color}"/>`
      : `<rect x="${x - 22}" y="${y - 18}" width="44" height="36" rx="8" fill="${color}"/>`}
      <text x="${x}" y="${y + 4.5}" text-anchor="middle" fill="#fff" font-size="12.5" font-weight="700">${label}</text>
    </g>`;
  const edge = (x1, y1, x2, y2, label, lx, ly, dangling = false) => `
    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${dangling ? "var(--muted)" : "var(--baseline)"}"
      stroke-width="2" ${dangling ? 'stroke-dasharray="3 3"' : ""}/>
    ${label ? `<text x="${lx}" y="${ly}" text-anchor="middle" font-size="11.5" fill="var(--ink-2)">${label}</text>` : ""}`;

  const diagrams = {
    tucker: () => `
      <svg viewBox="0 0 560 240" class="chart" role="img" aria-label="Tucker star network">
        ${edge(280, 120, 170, 60, "R₁", 222, 80)}
        ${edge(280, 120, 390, 60, "R₂", 338, 80)}
        ${edge(280, 120, 280, 200, "R₃", 293, 168)}
        ${edge(170, 60, 100, 30, "I", 128, 36, true)}
        ${edge(390, 60, 460, 30, "J", 432, 36, true)}
        ${edge(280, 200, 350, 228, "K", 322, 228, true)}
        ${node(280, 120, "𝒢", "Core tensor 𝒢 ∈ R^{R₁×R₂×R₃} — mixes every triple of factor columns.", "rect", "var(--accent)")}
        ${node(170, 60, "U", "Factor matrix U ∈ R^{I×R₁}: one dangling edge (output index I), one bond edge (R₁).")}
        ${node(390, 60, "V", "Factor matrix V ∈ R^{J×R₂}.")}
        ${node(280, 200, "W", "Factor matrix W ∈ R^{K×R₃}.")}
      </svg>`,
    tt: () => {
      const xs = [100, 240, 380, 520].map(x => x - 30);
      let s = `<svg viewBox="0 0 560 200" class="chart" role="img" aria-label="Tensor train chain">`;
      for (let i = 0; i < 3; i++) s += edge(xs[i], 80, xs[i + 1], 80, `R${["₁", "₂", "₃"][i]}`, (xs[i] + xs[i + 1]) / 2, 68);
      for (let i = 0; i < 4; i++) s += edge(xs[i], 80, xs[i], 160, `I${["₁", "₂", "₃", "₄"][i]}`, xs[i] + 16, 150, true);
      const info = i => `TT core 𝒢⁽${i}⁾ — order ${i === 1 || i === 4 ? 2 : 3}: bond edge${i === 1 || i === 4 ? "" : "s"} to neighbor${i === 1 || i === 4 ? "" : "s"} plus one output index.`;
      for (let i = 0; i < 4; i++) s += node(xs[i], 80, `𝒢⁽${i + 1}⁾`, info(i + 1), "rect", "var(--accent)");
      return s + `</svg>`;
    },
    ht: () => `
      <svg viewBox="0 0 560 280" class="chart" role="img" aria-label="Hierarchical Tucker binary tree">
        ${edge(280, 50, 160, 120, "R₅", 208, 80)}
        ${edge(280, 50, 400, 120, "R₆", 352, 80)}
        ${edge(160, 120, 95, 190, "R₁", 115, 150)}
        ${edge(160, 120, 225, 190, "R₂", 205, 150)}
        ${edge(400, 120, 335, 190, "R₃", 355, 150)}
        ${edge(400, 120, 465, 190, "R₄", 445, 150)}
        ${edge(95, 190, 95, 250, "I₁", 110, 240, true)}
        ${edge(225, 190, 225, 250, "I₂", 240, 240, true)}
        ${edge(335, 190, 335, 250, "I₃", 350, 240, true)}
        ${edge(465, 190, 465, 250, "I₄", 480, 240, true)}
        ${node(280, 50, "𝒢⁽³⁾", "Root core 𝒢⁽³⁾ ∈ R^{R₅×R₆} — joins the two halves.", "rect", "var(--accent)")}
        ${node(160, 120, "𝒢⁽¹⁾", "Transfer core 𝒢⁽¹⁾ ∈ R^{R₅×R₁×R₂} — merges modes 1,2.", "rect", "var(--accent)")}
        ${node(400, 120, "𝒢⁽²⁾", "Transfer core 𝒢⁽²⁾ ∈ R^{R₆×R₃×R₄} — merges modes 3,4.", "rect", "var(--accent)")}
        ${node(95, 190, "U⁽¹⁾", "Leaf factor U⁽¹⁾ ∈ R^{I₁×R₁}.")}
        ${node(225, 190, "U⁽²⁾", "Leaf factor U⁽²⁾ ∈ R^{I₂×R₂}.")}
        ${node(335, 190, "U⁽³⁾", "Leaf factor U⁽³⁾ ∈ R^{I₃×R₃}.")}
        ${node(465, 190, "U⁽⁴⁾", "Leaf factor U⁽⁴⁾ ∈ R^{I₄×R₄}.")}
      </svg>`
  };
  let current = "tucker";
  function render() {
    diagEl.innerHTML = diagrams[current]();
    capEl.textContent = captions[current];
    diagEl.querySelectorAll(".tn-node").forEach(n => {
      n.setAttribute("tabindex", "0");
      n.addEventListener("mouseenter", () => { capEl.textContent = n.dataset.info; });
      n.addEventListener("focus", () => { capEl.textContent = n.dataset.info; });
      n.addEventListener("mouseleave", () => { capEl.textContent = captions[current]; });
      n.addEventListener("blur", () => { capEl.textContent = captions[current]; });
    });
  }
  document.querySelectorAll("#tn-tabs button").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#tn-tabs button").forEach(b => { b.classList.remove("on"); b.setAttribute("aria-pressed", "false"); });
      btn.classList.add("on");
      btn.setAttribute("aria-pressed", "true");
      current = btn.dataset.tn;
      render();
    });
  });
  render();
})();

/* ============================================================
   WIDGET 6 — storage explorer
   ============================================================ */
(function storage() {
  const sN = document.getElementById("st-n"), sR = document.getElementById("st-r");
  const oN = document.getElementById("st-n-out"), oR = document.getElementById("st-r-out");
  const chartEl = document.getElementById("storage-chart");
  const supStr = n => String(n).split("").map(ch => ({ "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" }[ch] || ch)).join("");
  function counts(d, n, r) {
    return {
      full: Math.pow(n, d),
      tucker: Math.pow(r, d) + d * n * r,
      tt: 2 * n * r + Math.max(0, d - 2) * n * r * r,
      ht: d * n * r + Math.max(0, d - 2) * r * r * r + r * r
    };
  }
  function update() {
    const n = +sN.value, r = +sR.value;
    oN.textContent = n; oR.textContent = r;
    const xs = [];
    for (let d = 2; d <= 14; d++) xs.push(d);
    const data = xs.map(d => counts(d, n, r));
    const L = key => data.map(c => Math.log10(c[key]));
    const yMax = Math.ceil(Math.max(...L("full"), ...L("tucker"))) + 1;
    lineChart(chartEl, {
      xs, yMin: 0, yMax,
      label: "Parameter counts versus tensor order d for full, Tucker, TT, and HT formats",
      series: [
        { name: "Full nᵈ", color: cssVar("--accent"), ys: L("full") },
        { name: "Tucker", color: cssVar("--accent-2"), ys: L("tucker") },
        { name: "TT", color: cssVar("--accent-3"), ys: L("tt") },
        { name: "HT", color: cssVar("--accent-4"), ys: L("ht") }
      ],
      yTicks: Array.from({ length: Math.floor(yMax / 3) + 1 }, (_, i) => ({ v: i * 3, label: `10${supStr(i * 3)}` })),
      xLabel: "tensor order d",
      refLine: { v: 9, label: "10⁹ ≈ a billion parameters (GPT-2 was 1.5B)" },
      tooltip: (d, i) => {
        const c = data[i];
        return `<b>order d = ${d}</b>` +
          `<br>Full: ${fmtCount(c.full)}` +
          `<br>Tucker: ${fmtCount(Math.round(c.tucker))}` +
          `<br>TT: ${fmtCount(Math.round(c.tt))}` +
          `<br>HT: ${fmtCount(Math.round(c.ht))}`;
      }
    });
  }
  [sN, sR].forEach(s => s.addEventListener("input", update));
  update();
  onSchemeChange(update);
})();

/* ============================================================
   WIDGET 7 — symmetric CPD from NN derivatives (numeric check)
   ============================================================ */
(function moments() {
  const DIN = 3, D1 = 4;
  let seed = 777;
  const anEl = document.getElementById("mom-analytic");
  const fdEl = document.getElementById("mom-fd");
  const diffEl = document.getElementById("mom-diff");

  function tanh3(u) { const t = Math.tanh(u); return (6 * t * t - 2) * (1 - t * t); } // tanh'''
  function run() {
    const rng = mulberry32(seed);
    const A1 = Array.from({ length: D1 }, () => Array.from({ length: DIN }, () => 0.8 * (2 * rng() - 1)));
    const a2 = Array.from({ length: D1 }, () => 2 * rng() - 1);
    const x0 = Array.from({ length: DIN }, () => 0.5 * (2 * rng() - 1));
    const f = x => {
      let s = 0;
      for (let i = 0; i < D1; i++) {
        let u = 0;
        for (let p = 0; p < DIN; p++) u += A1[i][p] * x[p];
        s += a2[i] * Math.tanh(u);
      }
      return s;
    };
    // analytic: Σ_i a2_i tanh'''(w_i·x0) a1_i ⊗ a1_i ⊗ a1_i
    const Tan = [];
    for (let p = 0; p < DIN; p++) { Tan.push([]); for (let q = 0; q < DIN; q++) Tan[p].push([0, 0, 0]); }
    for (let i = 0; i < D1; i++) {
      let u = 0;
      for (let p = 0; p < DIN; p++) u += A1[i][p] * x0[p];
      const g = a2[i] * tanh3(u);
      for (let p = 0; p < DIN; p++) for (let q = 0; q < DIN; q++) for (let s2 = 0; s2 < DIN; s2++)
        Tan[p][q][s2] += g * A1[i][p] * A1[i][q] * A1[i][s2];
    }
    // finite differences: (1/8h³) Σ_{s1,s2,s3=±1} s1 s2 s3 f(x + h(s1 e_p + s2 e_q + s3 e_s))
    const h = 0.01;
    const Tfd = [];
    for (let p = 0; p < DIN; p++) {
      Tfd.push([]);
      for (let q = 0; q < DIN; q++) {
        Tfd[p].push([]);
        for (let s2 = 0; s2 < DIN; s2++) {
          let acc = 0;
          for (const g1 of [-1, 1]) for (const g2 of [-1, 1]) for (const g3 of [-1, 1]) {
            const x = x0.slice();
            x[p] += h * g1; x[q] += h * g2; x[s2] += h * g3;
            acc += g1 * g2 * g3 * f(x);
          }
          Tfd[p][q].push(acc / (8 * h * h * h));
        }
      }
    }
    // render slices with a shared scale
    const scale = Math.max(1e-12, ...Tan.flat(2).map(Math.abs), ...Tfd.flat(2).map(Math.abs));
    const drawSlices = (el, T3) => {
      el.innerHTML = "";
      for (let k = 0; k < DIN; k++) {
        const wrap = document.createElement("div");
        wrap.className = "slice";
        const M = Array.from({ length: DIN }, (_, p) => Array.from({ length: DIN }, (_, q) => T3[p][q][k]));
        const grid = document.createElement("div");
        renderHeatmap(grid, M, { scale, showVal: true });
        wrap.appendChild(grid);
        const lab = document.createElement("div");
        lab.className = "slice-label";
        lab.textContent = `[:, :, ${k + 1}]`;
        wrap.appendChild(lab);
        el.appendChild(wrap);
      }
    };
    drawSlices(anEl, Tan);
    drawSlices(fdEl, Tfd);
    let md = 0;
    for (let p = 0; p < DIN; p++) for (let q = 0; q < DIN; q++) for (let s2 = 0; s2 < DIN; s2++)
      md = Math.max(md, Math.abs(Tan[p][q][s2] - Tfd[p][q][s2]));
    diffEl.innerHTML = fmtSci(md);
  }
  document.getElementById("mom-run").addEventListener("click", () => { seed += 13; run(); });
  run();
  onSchemeChange(run);
})();

/* ============================================================
   cheat-table hover tips
   ============================================================ */
(function cheat() {
  const tip = document.getElementById("cheat-tip");
  document.querySelectorAll("#cheat-table tbody tr").forEach(tr => {
    tr.setAttribute("tabindex", "0");
    const show = () => { tip.textContent = tr.dataset.tip; };
    tr.addEventListener("mouseenter", show);
    tr.addEventListener("focus", show);
  });
})();

/* ============================================================
   WIDGET 8 — quiz
   ============================================================ */
(function quiz() {
  const QS = [
    {
      q: "A tensor 𝒯 has CP rank R. What does that mean?",
      opts: [
        "R is the smallest number of rank-1 tensors that sum to 𝒯",
        "𝒯 has R nonzero entries",
        "R equals the size of the first mode",
        "𝒯 has R frontal slices"
      ],
      correct: 0,
      why: "Tensor rank generalizes matrix rank: the minimal number of outer products a ⊗ b ⊗ c needed to build the tensor."
    },
    {
      q: "Which decomposition is essentially unique under mild conditions (order ≥ 3)?",
      opts: ["Tucker", "CPD", "Tensor Train", "Hierarchical Tucker"],
      correct: 1,
      why: "The CPD is unique up to permuting components and rescaling within a component (Kruskal-type conditions). Tucker and tree networks are never unique — you can rotate the core and counter-rotate a factor."
    },
    {
      q: "How many parameters does a rank-R CPD of an I×J×K tensor use?",
      opts: ["I·J·K", "R·(I + J + K)", "R³", "R·I·J·K"],
      correct: 1,
      why: "One factor matrix per mode: A is I×R, B is J×R, C is K×R — that's R(I+J+K) numbers instead of IJK."
    },
    {
      q: "For an order-d tensor, the Tucker core alone has r^d entries. How does Tensor-Train storage grow with d?",
      opts: ["Also exponentially", "Linearly in d", "Quadratically in d", "It doesn't depend on d"],
      correct: 1,
      why: "Every TT core is a tensor of order ≤ 3 (size ≤ r×n×r), and there are d of them: ≈ d·n·r² total. That linear scaling is why TT/HT dominate in high dimensions."
    },
    {
      q: "Can the CP rank of a tensor exceed all of its mode dimensions?",
      opts: [
        "No — rank ≤ min dimension, like matrices",
        "Yes — a generic I×I×I tensor has rank ≈ I³/(3I−2), roughly I²/3",
        "Only for complex-valued tensors",
        "Only for order ≥ 4"
      ],
      correct: 1,
      why: "Unlike matrices, tensor rank routinely exceeds every dimension: the factor matrices simply get more columns than rows. The generic rank of a cubic tensor is ⌈I³/(3I−2)⌉ (over ℂ; for real tensors this is the smallest typical rank)."
    },
    {
      q: "You compute the third derivative ∇⁽³⁾f of a 2-layer network f(x) = a₂ᵀσ(A₁x + b₁). What do you get?",
      opts: [
        "A generic full-rank tensor with no structure",
        "A Tucker decomposition with orthogonal factors",
        "A symmetric CPD whose factors are the rows of A₁, with rank = number of hidden neurons",
        "A tensor train with bond dimension 2"
      ],
      correct: 2,
      why: "Paper eq. 9: ∇⁽³⁾f = Σᵢ γ⁽ⁱ⁾ a₁⁽ⁱ⁾⊗a₁⁽ⁱ⁾⊗a₁⁽ⁱ⁾. Since the CPD is unique, decomposing this tensor recovers the first-layer weights — the basis of polynomial-time learning and identifiability results."
    },
    {
      q: "A generic tensor has a small TT/HT rank. Its CP rank is…",
      opts: [
        "the same — the formats are equivalent",
        "always smaller",
        "exponentially larger — which is why deep sum-product networks can be exponentially more efficient than shallow ones",
        "unrelated to the TT rank"
      ],
      correct: 2,
      why: "A generic tensor of bounded TT/HT ranks < r has CP rank at least r^{d/2}. Translated to networks: realizing a generic deep (HT/TT) sum-product network with a shallow (CPD) one needs exponential width."
    }
  ];
  const holder = document.getElementById("quiz");
  const scoreEl = document.getElementById("quiz-score");
  let score = 0, answered = 0;
  QS.forEach((item, qi) => {
    const card = document.createElement("div");
    card.className = "qcard";
    card.innerHTML = `<div class="qtext">${qi + 1}. ${item.q}</div>`;
    item.opts.forEach((opt, oi) => {
      const btn = document.createElement("button");
      btn.className = "qopt";
      btn.type = "button";
      btn.textContent = opt;
      btn.addEventListener("click", () => {
        if (card.classList.contains("answered")) return;
        card.classList.add("answered");
        answered++;
        if (oi === item.correct) { score++; btn.classList.add("correct"); }
        else {
          btn.classList.add("wrong");
          card.querySelectorAll(".qopt")[item.correct].classList.add("correct");
        }
        scoreEl.textContent = `${score} / ${QS.length}` + (answered === QS.length ? (score === QS.length ? " 🎉 perfect" : "") : "");
      });
      card.appendChild(btn);
    });
    const ex = document.createElement("div");
    ex.className = "qexplain";
    ex.textContent = item.why;
    card.appendChild(ex);
    holder.appendChild(card);
  });
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
