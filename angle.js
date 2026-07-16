/* ============================================================
   Angular-error report — widgets.
   Requires lib.js. All numerics run live in the browser.
   ============================================================ */
"use strict";

const DEG = 180 / Math.PI;

/* ---------------- tiny 2×2 toolkit (Part 1) ---------------- */
function aMv2(M, x) { return [M[0][0] * x[0] + M[0][1] * x[1], M[1][0] * x[0] + M[1][1] * x[1]]; }
function aMm2(A, B) {
  return [[A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1]],
          [A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1]]];
}
function aInv2(M) {
  const d = M[0][0] * M[1][1] - M[0][1] * M[1][0];
  return [[M[1][1] / d, -M[0][1] / d], [-M[1][0] / d, M[0][0] / d]];
}
function aSpec2(M) { // σ_max of a 2×2, closed form
  const [a, b, c, d] = [M[0][0], M[0][1], M[1][0], M[1][1]];
  const t = a * a + b * b + c * c + d * d, det = a * d - b * c;
  return Math.sqrt((t + Math.sqrt(Math.max(0, t * t - 4 * det * det))) / 2);
}
function aAngle2(u, v) {
  const dot = u[0] * v[0] + u[1] * v[1];
  const den = Math.hypot(u[0], u[1]) * Math.hypot(v[0], v[1]);
  return Math.acos(Math.min(1, Math.max(-1, dot / Math.max(den, 1e-300))));
}

/* ============================================================
   PART 1 — angle vs input direction for a 2×2 pair (w-sweep)
   ============================================================ */
(function sweep() {
  const chartEl = document.getElementById("sweep-chart");
  const noteEl = document.getElementById("sw-note");
  const tWorst = document.getElementById("sw-worst"), tNorm = document.getElementById("sw-norm"),
        tBound = document.getElementById("sw-bound");
  const sEps = document.getElementById("sw-eps"), sEpsOut = document.getElementById("sw-eps-out");
  const sScale = document.getElementById("sw-scale"), sScaleOut = document.getElementById("sw-scale-out");

  const A = [[1.8, 0.6], [0.0, 0.9]];
  const invA = aInv2(A);
  let eSeed = 7, E = null;
  function newE() {
    const rng = mulberry32(eSeed);
    const raw = [[randn(rng), randn(rng)], [randn(rng), randn(rng)]];
    const s = aSpec2(aMm2(raw, invA));       // normalize so ‖E A⁻¹‖₂ = 1: slider ε IS η
    E = raw.map(row => row.map(v => v / s));
  }
  newE();

  /* inf over a>0 of ‖a·C − I‖₂ — convex in a, ternary search in log space */
  function scaleInvEta(C) {
    const f = a => aSpec2([[a * C[0][0] - 1, a * C[0][1]], [a * C[1][0], a * C[1][1] - 1]]);
    let lo = -5, hi = 5;
    for (let i = 0; i < 120; i++) {
      const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
      if (f(Math.exp(m1)) < f(Math.exp(m2))) hi = m2; else lo = m1;
    }
    return f(Math.exp((lo + hi) / 2));
  }

  function render() {
    const eps = +sEps.value, alpha = Math.pow(10, +sScale.value);
    sEpsOut.textContent = eps.toFixed(2);
    sScaleOut.textContent = alpha.toFixed(2);
    const B = A.map((row, i) => row.map((v, j) => alpha * (v + eps * E[i][j])));

    const xs = [], ys = [];
    let worst = 0;
    for (let k = 0; k <= 360; k++) {
      const phi = k / 2;                      // 0..180° in 0.5° steps
      const x = [Math.cos(phi / DEG), Math.sin(phi / DEG)];
      const ang = aAngle2(aMv2(A, x), aMv2(B, x)) * DEG;
      xs.push(phi); ys.push(ang);
      worst = Math.max(worst, ang);
    }
    const C = aMm2(B, invA);
    const etaNaive = aSpec2([[C[0][0] - 1, C[0][1]], [C[1][0], C[1][1] - 1]]);
    const eta = scaleInvEta(C);
    const boundDeg = eta < 1 ? Math.asin(eta) * DEG : null;
    const normAB = aSpec2(A.map((row, i) => row.map((v, j) => v - B[i][j])));

    const yMax = worst > 90 ? 180 : 90;
    lineChart(chartEl, {
      xs,
      series: [{ name: "∠(Ax, Bx)", color: cssVar("--accent"), ys, noDots: true }],
      yMin: 0, yMax,
      yTicks: (yMax === 90 ? [0, 30, 60, 90] : [0, 45, 90, 135, 180]).map(v => ({ v, label: v + "°" })),
      xTicks: [0, 45, 90, 135, 180].map(v => ({ v, label: v + "°" })),
      xLabel: "input direction φ of x = (cos φ, sin φ)   (x and −x give the same angle)",
      label: "output angle between Ax and Bx vs input direction",
      refLine: boundDeg != null ? { v: boundDeg, label: `arcsin η = ${boundDeg.toFixed(1)}°` } : null,
      tooltip: (x, i) => `<b>φ = ${x.toFixed(1)}°</b><br>∠(Ax, Bx) = ${ys[i].toFixed(2)}°`
    });

    tWorst.textContent = worst.toFixed(1) + "°";
    tNorm.textContent = normAB.toFixed(2);
    tBound.textContent = boundDeg != null ? boundDeg.toFixed(1) + "°" : "none (η ≥ 1)";
    noteEl.innerHTML =
      `ε = ${eps.toFixed(2)}, α = ${alpha.toFixed(2)}: &nbsp;‖A − B‖₂ = <b>${normAB.toFixed(2)}</b> ` +
      `(α drags it anywhere), worst angle = <b>${worst.toFixed(1)}°</b> (α-invariant). ` +
      `Naive bound arcsin‖BA⁻¹ − I‖₂: ${etaNaive < 1 ? "arcsin " + etaNaive.toFixed(2) + " = " + (Math.asin(etaNaive) * DEG).toFixed(1) + "°" : "void (η = " + etaNaive.toFixed(2) + " ≥ 1)"} — ` +
      `after the free rescaling, η = ${eta.toFixed(2)}${eta < 1 ? "" : " (still ≥ 1)"}. ` +
      `No function of ‖A − B‖ alone can compute the angle.`;
  }

  sEps.addEventListener("input", render);
  sScale.addEventListener("input", render);
  document.getElementById("sw-newE").addEventListener("click", () => { eSeed += 13; newE(); render(); });
  onSchemeChange(render);
  render();
})();

/* ============================================================
   PART 2 — tangent-ball geometry (w-ball) + required-error calc
   ============================================================ */
(function ball() {
  const host = document.getElementById("ball-svg");
  const noteEl = document.getElementById("ball-note");
  const sEta = document.getElementById("ball-eta"), sEtaOut = document.getElementById("ball-eta-out");

  const svgNS = "http://www.w3.org/2000/svg";
  const add = (parent, tag, attrs, text) => {
    const e = document.createElementNS(svgNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    parent.appendChild(e); return e;
  };

  function render() {
    const eta = +sEta.value;
    sEtaOut.textContent = eta.toFixed(2);
    host.innerHTML = "";
    const W = 640, H = 400, ox = 80, oy = 200, L = 180;
    const tipx = ox + L, r = eta * L;
    const svg = add(host, "svg", {
      viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img",
      "aria-label": "tangent-ball picture of the arcsin bound", style: "width:100%"
    });
    const defs = add(svg, "defs", {});
    for (const [id, color] of [["arrA", cssVar("--ink-2")], ["arrB", cssVar("--accent-2")]]) {
      const m = add(defs, "marker", { id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" });
      add(m, "path", { d: "M0,0 L10,5 L0,10 z", fill: color });
    }

    if (eta < 1) {
      const beta = Math.asin(eta);
      /* cone of possible Bx directions, filled */
      const R = 560, steps = 40;
      let d = `M${ox},${oy}`;
      for (let k = 0; k <= steps; k++) {
        const t = beta - 2 * beta * k / steps;   // +β → −β
        d += `L${(ox + R * Math.cos(t)).toFixed(1)},${(oy - R * Math.sin(t)).toFixed(1)}`;
      }
      d += "Z";
      add(svg, "path", { d, fill: cssVar("--accent"), opacity: 0.09 });
      add(svg, "path", { d, fill: "none", stroke: cssVar("--accent"), opacity: 0.35, "stroke-width": 1 });
      /* worst Bx = tangent ray */
      const tl = L * Math.sqrt(1 - eta * eta);
      const Tx = ox + tl * Math.cos(beta), Ty = oy - tl * Math.sin(beta);
      add(svg, "line", { x1: ox, y1: oy, x2: Tx, y2: Ty, stroke: cssVar("--accent-2"), "stroke-width": 2.5, "marker-end": "url(#arrB)" });
      add(svg, "text", { x: Tx + 8, y: Ty - 8, "font-size": 12.5, "font-weight": 600, fill: cssVar("--accent-2") }, "worst Bx (tangent)");
      /* angle arc */
      const ar = 52;
      let da = `M${ox + ar},${oy}`;
      for (let k = 1; k <= 16; k++) {
        const t = beta * k / 16;
        da += `L${(ox + ar * Math.cos(t)).toFixed(1)},${(oy - ar * Math.sin(t)).toFixed(1)}`;
      }
      add(svg, "path", { d: da, fill: "none", stroke: cssVar("--ink-2"), "stroke-width": 1.5 });
      add(svg, "text", {
        x: ox + 68 * Math.cos(beta / 2), y: oy - 68 * Math.sin(beta / 2) + 4,
        "font-size": 12.5, "font-weight": 600, fill: cssVar("--ink-2")
      }, `arcsin η = ${(beta * DEG).toFixed(1)}°`);
    } else {
      add(svg, "rect", { x: 0, y: 0, width: W, height: H, fill: cssVar("--neg"), opacity: 0.06 });
      add(svg, "text", { x: W / 2, y: 36, "text-anchor": "middle", "font-size": 14, "font-weight": 600, fill: cssVar("--neg") },
        "η ≥ 1: the ball contains the origin — Bx can point anywhere, up to 180°");
    }

    /* the ball of possible Bx endpoints */
    add(svg, "circle", { cx: tipx, cy: oy, r: Math.max(r, 0.1), fill: cssVar("--accent-2"), opacity: 0.08 });
    add(svg, "circle", { cx: tipx, cy: oy, r: Math.max(r, 0.1), fill: "none", stroke: cssVar("--accent-2"), "stroke-dasharray": "5 4", "stroke-width": 1.5 });
    add(svg, "text", { x: tipx + r + 12, y: oy - 8, "font-size": 12, fill: cssVar("--muted") }, "‖Bx − Ax‖ ≤ η‖Ax‖");
    /* Ax arrow */
    add(svg, "line", { x1: ox, y1: oy, x2: tipx - 4, y2: oy, stroke: cssVar("--ink-2"), "stroke-width": 2.5, "marker-end": "url(#arrA)" });
    add(svg, "text", { x: ox + L / 2, y: oy + 20, "text-anchor": "middle", "font-size": 13, "font-weight": 600, fill: cssVar("--ink-2") }, "Ax");
    add(svg, "circle", { cx: ox, cy: oy, r: 3, fill: cssVar("--ink-2") });
    add(svg, "text", { x: ox - 12, y: oy + 4, "font-size": 12, fill: cssVar("--muted") }, "0");

    noteEl.innerHTML = eta < 1
      ? `η = ${eta.toFixed(2)} ⇒ worst possible angle arcsin η = <b>${(Math.asin(eta) * DEG).toFixed(1)}°</b>, ` +
        `attained when the error vector is tangent — i.e. orthogonal to the worst Bx. ` +
        `Sharp: nothing about A or B enters except the single number η = ‖(B−A)A⁻¹‖₂.`
      : `η = ${eta.toFixed(2)} ≥ 1: some output can be cancelled entirely (this is exactly what a ` +
        `low-rank B does on its kernel) — the angular guarantee is void.`;
  }

  sEta.addEventListener("input", render);
  onSchemeChange(render);
  render();

  /* mini-calc: required relative error for a target angle at given κ */
  const mT = document.getElementById("mc-theta"), mTOut = document.getElementById("mc-theta-out");
  const mK = document.getElementById("mc-kappa"), mKOut = document.getElementById("mc-kappa-out");
  const mOut = document.getElementById("mc-out");
  function calc() {
    const th = +mT.value, kap = Math.pow(10, +mK.value);
    mTOut.textContent = th + "°";
    mKOut.textContent = kap >= 100 ? Math.round(kap).toLocaleString("en-US") : kap.toFixed(1);
    const eta = Math.sin(th / DEG);
    mOut.innerHTML = `need η = ‖(B−A)A⁻¹‖₂ ≤ sin ${th}° = <b>${eta.toFixed(3)}</b>; ` +
      `via σ<sub>min</sub> that costs relative spectral error ‖A−B‖₂/‖A‖₂ ≤ sin θ / κ = <b>${fmtSci(eta / kap)}</b>.`;
  }
  mT.addEventListener("input", calc);
  mK.addEventListener("input", calc);
  calc();
})();

/* ============================================================
   shared Gaussian sample for Parts 3–4
   ============================================================ */
const aState = { n: 100, seed: 20260716, sv: [], tail2: [], medDeg: [] };
const aRenderers = [];
function aResample() {
  const n = aState.n;
  const rng = mulberry32(aState.seed);
  const A = Array.from({ length: n }, () => Array.from({ length: n }, () => randn(rng)));
  const sv = gSingularValues(A);
  const tail2 = new Float64Array(n + 1);
  for (let r = n - 1; r >= 0; r--) tail2[r] = tail2[r + 1] + sv[r] * sv[r];

  /* median angle over random inputs: x uniform on the sphere ⇒ its singular-basis
     coefficients are too, so no singular vectors are needed — only the σ's */
  const S = 400, perRank = Array.from({ length: n - 1 }, () => new Float64Array(S));
  for (let s = 0; s < S; s++) {
    const e = new Float64Array(n);
    let total = 0;
    for (let j = 0; j < n; j++) { const c = randn(rng); e[j] = sv[j] * sv[j] * c * c; total += e[j]; }
    let head = 0;
    for (let r = 1; r < n; r++) { head += e[r - 1]; perRank[r - 1][s] = Math.atan(Math.sqrt(Math.max(0, total - head) / head)) * DEG; }
  }
  aState.medDeg = perRank.map(row => { const a = Array.from(row).sort((x, y) => x - y); return (a[S / 2 - 1] + a[S / 2]) / 2; });
  aState.sv = sv; aState.tail2 = tail2;
  aRenderers.forEach(f => f());
}

/* ============================================================
   PART 3 — the 90° wall vs the typical angle (w-wall)
   ============================================================ */
(function wall() {
  const chartEl = document.getElementById("wall-chart");
  const noteEl = document.getElementById("wall-note");
  const sEps = document.getElementById("wall-eps"), sEpsOut = document.getElementById("wall-eps-out");

  function render() {
    const { n, sv, tail2, medDeg } = aState;
    const k = +sEps.value, eps = Math.pow(10, k);
    sEpsOut.textContent = Number.isInteger(k) ? (k === 0 ? "1" : `10${supStr(k)}`) : eps.toExponential(1);

    const xs = Array.from({ length: n - 1 }, (_, i) => i + 1);            // r = 1..n−1
    const adv = xs.map(r => Math.atan(sv[r] / (eps * sv[0])) * DEG);      // sv[r] = σ_{r+1}
    const theory = xs.map(r => Math.asin(Math.sqrt(tail2[r] / tail2[0])) * DEG);
    lineChart(chartEl, {
      xs,
      series: [
        { name: "", color: cssVar("--accent-2"), ys: theory, dashed: true, noDots: true },
        { name: "adversarial x", color: cssVar("--accent"), ys: adv, noDots: true, labelAt: "start", labelDy: 18 },
        { name: "random x", color: cssVar("--accent-2"), ys: medDeg, noDots: true }
      ],
      yMin: 0, yMax: 90,
      yTicks: [0, 30, 60, 90].map(v => ({ v, label: v + "°" })),
      xTicks: [1, 25, 50, 75, 99].map(v => ({ v, label: String(v) })),
      xLabel: "kept rank r   (solid: this sample · dashed: arcsin 𝓔_F from the same σ's)",
      label: "angle between Ax and A_r x: adversarial vs random inputs",
      tooltip: (x, i) =>
        `<b>rank r = ${x}</b><br>adversarial (ε = ${eps.toExponential(0)}): ${adv[i].toFixed(2)}°<br>` +
        `random x median: ${medDeg[i].toFixed(2)}°<br>arcsin 𝓔_F: ${theory[i].toFixed(2)}°`
    });
    const rMid = Math.floor(n / 2);
    noteEl.innerHTML =
      `At r = ${rMid}: adversarial angle <b>${adv[rMid - 1].toFixed(1)}°</b> vs typical ` +
      `<b>${medDeg[rMid - 1].toFixed(1)}°</b> (arcsin 𝓔_F = ${theory[rMid - 1].toFixed(1)}°). ` +
      `The adversarial input is arctan(σ<sub>r+1</sub>/εσ₁) with an ε-whisker of kept signal: ` +
      `ε → 0 pins it to 90° at <em>every</em> rank — no rank short of ${n} buys a single degree ` +
      `of worst-case improvement. The typical curve, meanwhile, is the Frobenius error curve of the ` +
      `<a href="gaussian.html">Gaussian page</a> passed through an arcsine.`;
  }

  sEps.addEventListener("input", render);
  document.getElementById("wall-resample").addEventListener("click", () => { aState.seed += 101; aResample(); });
  aRenderers.push(render);
  onSchemeChange(render);
})();

/* ============================================================
   PART 4 — restricted-input bound: promise vs spectral gap (w-restricted)
   ============================================================ */
(function restricted() {
  const chartEl = document.getElementById("rest-chart");
  const noteEl = document.getElementById("rest-note");
  const sG = document.getElementById("rest-gamma"), sGOut = document.getElementById("rest-gamma-out");
  const seg = document.getElementById("rest-mode");
  let mode = "noise";
  const BOOST = 8, RSIG = 20;

  function render() {
    const { n, sv } = aState;
    const gamma = +sG.value;
    sGOut.textContent = gamma.toFixed(2);
    const s = mode === "signal" ? sv.map((v, j) => (j < RSIG ? BOOST * v : v)) : sv;
    const gfac = Math.sqrt(1 - gamma * gamma) / gamma;
    const arccosG = Math.acos(gamma) * DEG;

    const xs = Array.from({ length: n - 1 }, (_, i) => i + 1);
    const bound = xs.map(r => Math.atan((s[r] / s[r - 1]) * gfac) * DEG);   // s[r]/s[r−1] = σ_{r+1}/σ_r
    lineChart(chartEl, {
      xs,
      series: [{ name: "bound", color: cssVar("--accent"), ys: bound, noDots: true }],
      yMin: 0, yMax: 90,
      yTicks: [0, 30, 60, 90].map(v => ({ v, label: v + "°" })),
      xTicks: [1, 25, 50, 75, 99].map(v => ({ v, label: String(v) })),
      xLabel: "kept rank r   (inputs promised to keep ≥ γ of their mass in the top-r subspace)",
      label: "restricted-input angle bound vs rank",
      refLine: { v: arccosG, label: `arccos γ = ${arccosG.toFixed(1)}° (gapless level)` },
      tooltip: (x, i) =>
        `<b>rank r = ${x}</b><br>σ<sub>r+1</sub>/σ<sub>r</sub> = ${(s[x] / s[x - 1]).toFixed(3)}<br>` +
        `angle bound: ${bound[i].toFixed(2)}°`
    });
    noteEl.innerHTML = mode === "noise"
      ? `Pure noise: the spectrum is gapless, σ<sub>r+1</sub>/σ<sub>r</sub> ≈ 1 at every rank, so the ` +
        `guarantee hugs <b>arccos γ = ${arccosG.toFixed(1)}°</b> — the matrix contributes nothing; ` +
        `you get out exactly the input concentration you promised. (The dip at the far right is the ` +
        `hard edge: the last σ's are genuinely tiny.)`
      : `With a planted rank-${RSIG} signal the ratio σ<sub>${RSIG + 1}</sub>/σ<sub>${RSIG}</sub> ≈ 1/${BOOST} opens a gap: at ` +
        `r = ${RSIG} the bound drops to <b>${bound[RSIG - 1].toFixed(1)}°</b> against the gapless level ` +
        `${arccosG.toFixed(1)}° — a spectral gap converts input concentration into angular accuracy ` +
        `at a discount. Away from the gap, noise behavior resumes.`;
  }

  seg.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
    mode = b.dataset.mode;
    seg.querySelectorAll("button").forEach(x => {
      x.classList.toggle("on", x === b);
      x.setAttribute("aria-pressed", x === b ? "true" : "false");
    });
    render();
  }));
  sG.addEventListener("input", render);
  aRenderers.push(render);
  onSchemeChange(render);
})();

/* ---------------- Part 4 mini-calc: exact SPD angle from κ ---------------- */
(function kappaCalc() {
  const sK = document.getElementById("kap-slider");
  const outK = document.getElementById("kap-out-k"), out = document.getElementById("kap-out");
  function calc() {
    const kap = Math.pow(10, +sK.value);
    outK.textContent = kap >= 100 ? Math.round(kap).toLocaleString("en-US") : kap.toFixed(1);
    const sinT = (kap - 1) / (kap + 1);
    out.innerHTML = `sin Θ = (κ−1)/(κ+1) = <b>${sinT.toFixed(4)}</b> ⇒ worst-case angle ` +
      `Θ = <b>${(Math.asin(sinT) * DEG).toFixed(1)}°</b> — exact, no closeness of B to A required. ` +
      `Checkpoints: κ = 1 → 0°, κ = 3 → 30°, κ → ∞ → 90°.`;
  }
  sK.addEventListener("input", calc);
  calc();
})();

/* ============================================================
   kick off + nav
   ============================================================ */
aResample();

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
