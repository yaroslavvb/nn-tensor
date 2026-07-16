/* ============================================================
   Why CP Rank Explodes — deep-dive widgets.
   Requires lib.js (rng, linalg, matRank, renderHeatmap, lineChart, …).
   All ranks/fits computed live in the browser.
   ============================================================ */
"use strict";

/* ---------------- order-d tensor helpers (flat array, mode 0 fastest) ---------------- */
function strides(dims) {
  const s = [1];
  for (let k = 1; k < dims.length; k++) s.push(s[k - 1] * dims[k - 1]);
  return s;
}
function digitsTable(dims) {
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
/* unfolding by subset S (array of 0-based mode indices) → matrix (array of rows) */
function unfoldingMatrix(T, dims, S) {
  const d = dims.length;
  const Sset = new Set(S);
  const rowsModes = S.slice().sort((a, b) => a - b);
  const colsModes = Array.from({ length: d }, (_, k) => k).filter(k => !Sset.has(k));
  const rows = rowsModes.reduce((a, k) => a * dims[k], 1);
  const cols = colsModes.reduce((a, k) => a * dims[k], 1);
  const st = strides(dims);
  const M = zeros(rows, cols);
  for (let r = 0; r < rows; r++) {
    // decode row multi-index over rowsModes (first listed fastest)
    let rr = r; const multi = new Array(d).fill(0);
    for (const k of rowsModes) { multi[k] = rr % dims[k]; rr = Math.floor(rr / dims[k]); }
    for (let c = 0; c < cols; c++) {
      let cc = c;
      for (const k of colsModes) { multi[k] = cc % dims[k]; cc = Math.floor(cc / dims[k]); }
      let flat = 0;
      for (let k = 0; k < d; k++) flat += multi[k] * st[k];
      M[r][c] = T[flat];
    }
  }
  return M;
}
/* generic CP-ALS for an order-d tensor stored flat; returns best rel. error over restarts */
function cpFitErr(dims, T, R, baseSeed, restarts = 5, iters = 350) {
  const d = dims.length, N = T.length;
  const tab = digitsTable(dims);
  const normT = Math.sqrt(T.reduce((s, v) => s + v * v, 0));
  const relErr = F => {
    let s = 0;
    for (let n = 0; n < N; n++) {
      let acc = 0;
      for (let r = 0; r < R; r++) {
        let p = 1;
        for (let k = 0; k < d; k++) p *= F[k][tab[n][k]][r];
        acc += p;
      }
      const dv = T[n] - acc; s += dv * dv;
    }
    return Math.sqrt(s) / normT;
  };
  let best = Infinity;
  for (let rs = 0; rs < restarts; rs++) {
    const rng = mulberry32(baseSeed + rs * 991);
    const F = dims.map(nk => Array.from({ length: nk }, () => Array.from({ length: R }, () => randn(rng))));
    let prev = Infinity;
    for (let it = 0; it < iters; it++) {
      for (let m = 0; m < d; m++) {
        const M = zeros(dims[m], R);
        for (let n = 0; n < N; n++) {
          const t = T[n];
          if (t === 0) continue;
          const dig = tab[n];
          for (let r = 0; r < R; r++) {
            let p = t;
            for (let k = 0; k < d; k++) if (k !== m) p *= F[k][dig[k]][r];
            M[dig[m]][r] += p;
          }
        }
        let V = null;
        for (let k = 0; k < d; k++) {
          if (k === m) continue;
          const G = gramT(F[k]);
          V = V ? hadamard(V, G) : G;
        }
        F[m] = transpose(solveLin(V, transpose(M)));
      }
      if (it % 20 === 19) {
        const e = relErr(F);
        if (e < 1e-13) { prev = e; break; }
        if (prev - e < 1e-14 && it > 80) { prev = e; break; }
        prev = e;
      }
    }
    const e = relErr(F);
    if (e < best) best = e;
    if (best < 1e-12) break;
  }
  return best;
}
/* chain-of-links tensor L_d: order 2d, mode size 2, modes (i1,j1,i2,j2,…) */
function linksTensor(d) {
  const dims = new Array(2 * d).fill(2);
  const N = 1 << (2 * d);
  const tab = digitsTable(dims);
  const T = new Float64Array(N);
  for (let n = 0; n < N; n++) {
    let ok = true;
    for (let k = 0; k < d; k++) if (tab[n][2 * k] !== tab[n][2 * k + 1]) { ok = false; break; }
    T[n] = ok ? 1 : 0;
  }
  return { T, dims };
}

/* ============================================================
   PART 2 — bipartition rank table (w-bip)
   ============================================================ */
(function bip() {
  const dims = [2, 2, 2, 2];
  const N = 16;
  const rng = mulberry32(20260716);
  const rank1Term = () => {
    const vs = dims.map(nk => Array.from({ length: nk }, () => randn(rng)));
    const tab = digitsTable(dims);
    const T = new Float64Array(N);
    for (let n = 0; n < N; n++) {
      let p = 1;
      for (let k = 0; k < 4; k++) p *= vs[k][tab[n][k]];
      T[n] = p;
    }
    return T;
  };
  const T1 = rank1Term();
  const T3 = new Float64Array(N);
  for (let t = 0; t < 3; t++) { const term = rank1Term(); for (let n = 0; n < N; n++) T3[n] += term[n]; }

  const subsets = [[0], [0, 1], [0, 2], [0, 3], [0, 1, 2], [0, 1, 3], [0, 2, 3]];
  const lab = S => {
    const name = k => "i" + ["₁", "₂", "₃", "₄"][k];
    const A = S.map(name).join(""), B = [0, 1, 2, 3].filter(k => !S.includes(k)).map(name).join("");
    return `{${A}} | {${B}}`;
  };
  const tbody = document.querySelector("#bip-table tbody");
  let maxR3 = 0;
  subsets.forEach(S => {
    const M1 = unfoldingMatrix(T1, dims, S), M3 = unfoldingMatrix(T3, dims, S);
    const r1 = matRank(M1), r3 = matRank(M3);
    maxR3 = Math.max(maxR3, r3);
    const rows = M3.length, cols = M3[0].length;
    const tr = document.createElement("tr");
    tr.innerHTML = `<td style="font-weight:600">${lab(S)}</td><td>${rows} × ${cols}</td>
      <td class="dots" style="letter-spacing:0">${r1}</td><td class="dots" style="letter-spacing:0">${r3}</td>`;
    tbody.appendChild(tr);
  });
  document.getElementById("bip-note").innerHTML =
    `Strongest bound for the second tensor: <b>CP rank ≥ ${maxR3}</b> (its true CP rank is 3 — here the balanced splits are tight; in general the bound can be loose, never wrong).`;
})();

/* ============================================================
   PART 3 — TT tensor cut explorer (w-cut)
   ============================================================ */
(function cut() {
  const d = 6, n = 2, r = 2;
  const dims = new Array(d).fill(n);
  let seed = 31337;
  let T = null;

  function buildTT() {
    // The true generic ranks are (2 on every contiguous cut, 8 on the crossing split),
    // but a very ill-conditioned random draw can fool the numerical rank test —
    // rejection-sample the seed so the widget always shows the generic truth.
    for (let tries = 0; tries < 50; tries++) {
      const rng = mulberry32(seed + tries);
      // cores: G1[i] 1×r, G2..G5[i] r×r, G6[i] r×1
      const core = (ri, ro) => Array.from({ length: n }, () => Array.from({ length: ri }, () => Array.from({ length: ro }, () => randn(rng))));
      const G = [core(1, r)];
      for (let k = 1; k < d - 1; k++) G.push(core(r, r));
      G.push(core(r, 1));
      const tab = digitsTable(dims);
      const N = tab.length;
      T = new Float64Array(N);
      for (let idx = 0; idx < N; idx++) {
        let v = G[0][tab[idx][0]]; // 1×r
        for (let k = 1; k < d; k++) v = matmul(v, G[k][tab[idx][k]]);
        T[idx] = v[0][0];
      }
      let ok = matRank(unfoldingMatrix(T, dims, [0, 2, 4])) === 8;
      for (let k = 1; ok && k < d; k++)
        ok = matRank(unfoldingMatrix(T, dims, Array.from({ length: k }, (_, i) => i))) === r;
      if (ok) { seed += tries; return; }
    }
  }

  const modeSeg = document.getElementById("cut-mode");
  const slider = document.getElementById("cut-k");
  const sliderWrap = document.getElementById("cut-slider-wrap");
  const kOut = document.getElementById("cut-k-out");
  const diagEl = document.getElementById("cut-diagram");
  const rankEl = document.getElementById("cut-rank");
  const noteEl = document.getElementById("cut-note");
  const boundEl = document.getElementById("cut-bound");
  const boundNoteEl = document.getElementById("cut-bound-note");
  let mode = "cut";

  function drawDiagram(k) {
    const xs = Array.from({ length: d }, (_, i) => 60 + i * 88);
    const y = 60, legY = 130;
    const cross = mode === "cross";
    const sideOf = i => (i % 2 === 0 ? "A" : "B");
    let s = `<svg viewBox="0 0 560 160" class="chart" role="img" aria-label="TT chain with a ${cross ? "crossing split" : "contiguous cut"}" style="width:100%;max-width:640px">`;
    for (let i = 0; i < d - 1; i++) {
      const crossed = cross || (i === k - 1);
      s += `<line x1="${xs[i] + 18}" y1="${y}" x2="${xs[i + 1] - 18}" y2="${y}"
        stroke="${crossed ? "var(--neg)" : "var(--baseline)"}" stroke-width="2" ${crossed ? 'stroke-dasharray="4 4"' : ""}/>`;
      s += `<text x="${(xs[i] + xs[i + 1]) / 2}" y="${y - 10}" text-anchor="middle" font-size="11" fill="var(--ink-2)">2</text>`;
    }
    for (let i = 0; i < d; i++) {
      s += `<line x1="${xs[i]}" y1="${y + 18}" x2="${xs[i]}" y2="${legY}" stroke="var(--muted)" stroke-width="2" stroke-dasharray="3 3"/>`;
      const fill = cross ? (sideOf(i) === "A" ? "var(--accent)" : "var(--accent-2)") : "var(--accent)";
      s += `<rect x="${xs[i] - 18}" y="${y - 16}" width="36" height="32" rx="7" fill="${fill}"/>`;
      s += `<text x="${xs[i]}" y="${y + 5}" text-anchor="middle" fill="#fff" font-size="12" font-weight="700">𝒢${supStr(i + 1)}</text>`;
      s += `<text x="${xs[i]}" y="${legY + 14}" text-anchor="middle" font-size="11.5" fill="var(--muted)">i${["₁", "₂", "₃", "₄", "₅", "₆"][i]}${cross ? (sideOf(i) === "A" ? " · A" : " · B") : ""}</text>`;
    }
    if (!cross) {
      const cx = (xs[k - 1] + xs[k]) / 2;
      s += `<line x1="${cx}" y1="20" x2="${cx}" y2="150" stroke="var(--neg)" stroke-width="2" stroke-dasharray="6 4"/>`;
      s += `<text x="${cx}" y="14" text-anchor="middle" font-size="13">✂</text>`;
    }
    s += `</svg>`;
    diagEl.innerHTML = s;
  }

  function update() {
    const k = +slider.value;
    kOut.textContent = k;
    sliderWrap.style.display = mode === "cut" ? "" : "none";
    const S = mode === "cut" ? Array.from({ length: k }, (_, i) => i) : [0, 2, 4];
    const rank = matRank(unfoldingMatrix(T, dims, S));
    rankEl.textContent = rank;
    drawDiagram(k);
    if (mode === "cut") {
      noteEl.textContent = `contiguous split: first ${k} mode${k > 1 ? "s" : ""} vs the rest — exactly one bond crossed, so the rank equals the bond dimension`;
      boundEl.textContent = `≥ ${rank}`;
      boundNoteEl.textContent = "true but useless — TT keeps every contiguous cut this small";
    } else {
      noteEl.textContent = "crossing split {i₁,i₃,i₅} vs {i₂,i₄,i₆} — all 5 bonds crossed at once";
      boundEl.textContent = `≥ ${rank}`;
      boundNoteEl.textContent = rank === 8
        ? `${rank} = 2³ = r^⌊d/2⌋: exponential, from a single unfolding of a TT-rank-2 tensor`
        : `${rank}: large — from a single unfolding of a TT-rank-2 tensor`;
    }
  }

  modeSeg.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      modeSeg.querySelectorAll("button").forEach(b => { b.classList.remove("on"); b.setAttribute("aria-pressed", "false"); });
      btn.classList.add("on");
      btn.setAttribute("aria-pressed", "true");
      mode = btn.dataset.m;
      update();
    });
  });
  slider.addEventListener("input", update);
  const reseedBtn = document.getElementById("cut-reseed");
  if (reseedBtn) reseedBtn.addEventListener("click", () => { seed += 101; buildTT(); update(); });
  buildTT();
  update();
  onSchemeChange(update);
})();

/* ============================================================
   PART 4 — chain-of-links bipartition explorer (w-links)
   ============================================================ */
(function links() {
  let d = 3;
  let sideA = null; // boolean per mode, true = A
  const chipsEl = document.getElementById("links-chips");
  const statusEl = document.getElementById("links-status");
  const rankEl = document.getElementById("links-rank");
  const formulaEl = document.getElementById("links-formula");
  const hmEl = document.getElementById("links-heatmap");
  const matTitle = document.getElementById("links-mat-title");
  const noteEl = document.getElementById("links-note");
  let cache = {};

  const modeName = m => `${m % 2 === 0 ? "i" : "j"}${["₁", "₂", "₃", "₄"][Math.floor(m / 2)]}`;

  function setPreset(p) {
    sideA = new Array(2 * d).fill(false);
    if (p === "cut1") sideA[0] = true;
    else if (p === "cut2") { sideA[0] = true; sideA[1] = true; }
    else if (p === "cross") for (let m = 0; m < 2 * d; m++) sideA[m] = (m % 2 === 0);
  }

  function isContiguous() {
    // prefix or suffix in the interleaved mode order?
    const idxA = sideA.map((v, i) => v ? i : -1).filter(i => i >= 0);
    if (idxA.length === 0 || idxA.length === 2 * d) return false;
    const contig = arr => arr.every((v, i) => i === 0 || v === arr[i - 1] + 1);
    return (contig(idxA) && (idxA[0] === 0 || idxA[idxA.length - 1] === 2 * d - 1));
  }

  function render() {
    // chips
    chipsEl.innerHTML = "";
    for (let m = 0; m < 2 * d; m++) {
      const b = document.createElement("button");
      b.className = "btn";
      b.style.fontWeight = "700";
      b.style.borderColor = sideA[m] ? "var(--accent)" : "var(--accent-2)";
      b.style.color = sideA[m] ? "var(--accent)" : "var(--accent-2)";
      b.textContent = `${modeName(m)} : ${sideA[m] ? "A" : "B"}`;
      b.setAttribute("aria-label", `toggle mode ${modeName(m)}, currently side ${sideA[m] ? "A" : "B"}`);
      b.addEventListener("click", () => { sideA[m] = !sideA[m]; render(); });
      chipsEl.appendChild(b);
    }
    // link status
    statusEl.innerHTML = "";
    let severed = 0;
    for (let k = 0; k < d; k++) {
      const sv = sideA[2 * k] !== sideA[2 * k + 1];
      if (sv) severed++;
      const span = document.createElement("span");
      span.className = "readout";
      span.style.marginTop = "0";
      span.innerHTML = `link ${k + 1} (${modeName(2 * k)},${modeName(2 * k + 1)}): ${sv ? "<b style='color:var(--neg)'>severed</b>" : "intact"}`;
      statusEl.appendChild(span);
    }
    // rank
    const S = sideA.map((v, i) => v ? i : -1).filter(i => i >= 0);
    const key = d + ":" + S.join(",");
    const { T, dims } = cache[d] || (cache[d] = linksTensor(d));
    if (S.length === 0 || S.length === 2 * d) {
      rankEl.textContent = "—";
      formulaEl.textContent = "put at least one mode on each side";
      hmEl.innerHTML = "";
      matTitle.textContent = "unfolding matrix";
      noteEl.textContent = "An empty side means there is no matrix to unfold into.";
      return;
    }
    const M = unfoldingMatrix(T, dims, S);
    const rank = matRank(M);
    const predicted = Math.pow(2, severed);
    rankEl.textContent = rank;
    formulaEl.innerHTML = `${severed} severed link${severed === 1 ? "" : "s"} → predicted 2${supStr(severed)} = ${predicted} ${rank === predicted ? "✓" : "✗"}`;
    matTitle.textContent = `unfolding matrix — ${M.length} × ${M[0].length}, entries 0/1`;
    const cellPx = Math.max(8, Math.min(22, Math.floor(560 / M[0].length)));
    renderHeatmap(hmEl, M, { scale: 1, showVal: false, cellPx });
    const isIdentity = severed === d && S.length === d;
    noteEl.innerHTML = isContiguous()
      ? `This is a <b>contiguous</b> cut in the interleaved order — one of the ${2 * d - 1} splits TT controls. Rank stays ≤ 2, whatever d is.`
      : isIdentity
        ? `This is the <b>crossing split</b>: the unfolding is the ${M.length}×${M[0].length} <b>identity matrix</b> (after ordering), rank 2${supStr(d)} — so CP rank ≥ ${predicted}, while every TT bond is ≤ 2.`
        : `A <b>crossing</b> split — invisible to TT. Its rank multiplies 2 for every severed link.`;
  }

  document.querySelectorAll("#links-d button").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#links-d button").forEach(b => { b.classList.remove("on"); b.setAttribute("aria-pressed", "false"); });
      btn.classList.add("on");
      btn.setAttribute("aria-pressed", "true");
      d = +btn.dataset.d;
      setPreset("cross");
      render();
    });
  });
  document.querySelectorAll("#w-links [data-preset]").forEach(btn => {
    btn.addEventListener("click", () => { setPreset(btn.dataset.preset); render(); });
  });
  setPreset("cross");
  render();
  onSchemeChange(render);
})();

/* ============================================================
   PART 5 — ALS vs theory (w-als)
   ============================================================ */
(function als() {
  const chartEl = document.getElementById("als-chart");
  const statusEl = document.getElementById("als-status");
  const verdictEl = document.getElementById("als-verdict");
  let d = 2;
  const results = {}; // d -> array errs by R (1-indexed)

  function draw() {
    const N = 1 << d;
    const xs = Array.from({ length: N }, (_, i) => i + 1);
    const theory = xs.map(R => Math.sqrt((N - R) / N));
    const errs = results[d] || [];
    // pending ranks are null — lineChart skips their dots, so only real fits are shown
    const alsYs = xs.map(R => (errs[R] != null ? errs[R] : null));
    lineChart(chartEl, {
      xs, yMin: 0, yMax: 1,
      label: `ALS best relative error versus CP rank R for the chain of ${d} links, with the theoretical optimum`,
      series: [
        { name: "theory √((N−R)/N)", color: cssVar("--accent-2"), ys: theory, dashed: true, noDots: true, labelAt: "start" },
        { name: "ALS", color: cssVar("--accent"), ys: alsYs, noLine: true }
      ],
      yTicks: [0, 0.25, 0.5, 0.75, 1].map(v => ({ v, label: String(v) })),
      xLabel: `CP rank R of the fitted model (N = 2^d = ${N})`,
      tooltip: (R, i) => `<b>R = ${R}</b><br>theory: ${theory[i].toFixed(3)}<br>ALS: ${errs[R] != null ? fmtSci(Math.max(errs[R], 1e-16)) : "…"}`
    });
  }

  let runId = 0;
  function run() {
    const myRun = ++runId;      // cancels any older setTimeout chain
    const dLoc = d;
    const N = 1 << dLoc;
    if (results[dLoc] && results[dLoc].filter(e => e != null).length >= N) { draw(); finish(); return; }
    results[dLoc] = results[dLoc] || [];
    const { T, dims } = linksTensor(dLoc);
    let R = 1;
    statusEl.textContent = "fitting…";
    const step = () => {
      if (runId !== myRun) return;
      if (R > N) { draw(); finish(); return; }
      statusEl.textContent = `fitting R = ${R} / ${N}…`;
      results[dLoc][R] = cpFitErr(dims, T, R, 5000 + 37 * R + dLoc, 5, 350);
      draw();
      R++;
      setTimeout(step, 10);
    };
    setTimeout(step, 10);
  }
  function finish() {
    const N = 1 << d;
    statusEl.textContent = "done";
    const exact = results[d][N];
    verdictEl.innerHTML = `The dots trace the exact optimum √((N−R)/N): no rank below N = 2${supStr(d)} = ${N} gets close, ` +
      `and at R = ${N} the fit is exact (ALS error ${fmtSci(Math.max(exact, 1e-16))}). ` +
      `The same tensor in TT format never needs a bond larger than 2. ` +
      `(ALS is a local method — a dot a hair above the dashed line just means a restart stalled.)`;
  }

  document.querySelectorAll("#als-d button").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#als-d button").forEach(b => { b.classList.remove("on"); b.setAttribute("aria-pressed", "false"); });
      btn.classList.add("on");
      btn.setAttribute("aria-pressed", "true");
      d = +btn.dataset.d;
      verdictEl.textContent = "";
      run();
    });
  });
  run();
  onSchemeChange(draw);
})();

/* ============================================================
   PART 6 — growth chart (w-growth)
   ============================================================ */
(function growth() {
  const slider = document.getElementById("gr-r");
  const out = document.getElementById("gr-r-out");
  const chartEl = document.getElementById("growth-chart");
  function update() {
    const r = +slider.value;
    out.textContent = r;
    const xs = [];
    for (let dd = 2; dd <= 16; dd++) xs.push(dd);
    const shallow = xs.map(dd => Math.pow(r, Math.floor(dd / 2)));
    const deep = xs.map(dd => dd * r * r * r);
    const yMax = Math.ceil(Math.log10(Math.max(...shallow, ...deep))) + 1;
    lineChart(chartEl, {
      xs, yMin: 0, yMax,
      label: "Guaranteed CP components of a generic TT tensor versus TT parameter count, as order grows",
      series: [
        { name: "CP ≥ r^⌊d/2⌋", color: cssVar("--accent"), ys: shallow.map(Math.log10) },
        { name: "TT ≈ d·r³", color: cssVar("--accent-2"), ys: deep.map(Math.log10) }
      ],
      yTicks: Array.from({ length: Math.floor(yMax / 2) + 1 }, (_, i) => ({ v: i * 2, label: `10${supStr(i * 2)}` })),
      xLabel: "tensor order d",
      tooltip: (dd, i) => `<b>d = ${dd}</b><br>CP components needed: ≥ ${fmtCount(shallow[i])}<br>TT parameters: ${fmtCount(deep[i])}`
    });
  }
  slider.addEventListener("input", update);
  update();
  onSchemeChange(update);
})();

/* ============================================================
   PART 8 — quiz
   ============================================================ */
(function quiz2() {
  const QS = [
    {
      q: "The CP rank of a tensor is lower-bounded by the matrix rank of…",
      opts: [
        "only its contiguous unfoldings",
        "only the balanced unfoldings",
        "every bipartition unfolding — any way of splitting the modes into two groups",
        "no unfolding: matrix ranks say nothing about CP rank"
      ],
      correct: 2,
      why: "A rank-1 tensor stays a rank-1 matrix under ANY regrouping of modes, so a CP-rank-R tensor has every unfolding of rank ≤ R. One big unfolding certifies a big CP rank."
    },
    {
      q: "The minimal TT bond dimensions equal the ranks of which unfoldings?",
      opts: [
        "The contiguous prefix cuts {1..k} vs the rest",
        "All 2^(d−1) − 1 bipartitions",
        "The odd-vs-even split",
        "Only the middle cut"
      ],
      correct: 0,
      why: "TT-SVD computes exactly these: r_k = rank(T⟨{1..k}⟩). That is only d−1 special bipartitions — TT is blind to crossing splits, which is the whole loophole."
    },
    {
      q: "The chain-of-links tensor 𝓛_d (d identity links, order 2d) has TT bonds ≤ 2. Its CP rank is…",
      opts: ["2", "2d", "d²", "2^d — its odds-vs-evens unfolding is the 2^d × 2^d identity"],
      correct: 3,
      why: "The crossing split severs all d links and produces the identity matrix of size 2^d, so CP ≥ 2^d; expanding each δ into its 2 terms gives a matching construction, so CP = 2^d exactly."
    },
    {
      q: "Which inequality holds for every tensor?",
      opts: [
        "CP rank ≤ every TT rank",
        "every TT rank ≤ CP rank",
        "TT rank = CP rank",
        "no general relation exists"
      ],
      correct: 1,
      why: "Contiguous cuts are bipartitions, so the Lemma gives r_k ≤ rank_CP. The reverse fails exponentially — that asymmetry IS the depth-separation phenomenon."
    },
    {
      q: "For almost every order-d tensor (mode sizes ≥ r) with TT ranks ≤ r, the CP rank is at least…",
      opts: ["r", "r·d", "r^⌊d/2⌋ — exponential in the order", "2^r"],
      correct: 2,
      why: "Khrulkov–Novikov–Oseledets (ICLR 2018): generically the crossing unfolding reaches rank r^⌊d/2⌋ (their general bound is min(n,r)^⌊d/2⌋ for mode size n), and the Lemma converts that into a CP lower bound. Translated to sum-product networks: generic deep functions need exponentially wide shallow networks."
    }
  ];
  const holder = document.getElementById("quiz2");
  const scoreEl = document.getElementById("quiz2-score");
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
