/* ============================================================
   Shared utilities for the nn-tensor tutorial pages.
   Loaded before app.js / depth.js; classic script, global scope.
   ============================================================ */
"use strict";

/* ---------------- rng ---------------- */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randn(rng) {
  const u = Math.max(rng(), 1e-12), v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* ---------------- colors ---------------- */
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function hexToRgb(hex) {
  hex = hex.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(c1, c2, t) {
  return [0, 1, 2].map(i => Math.round(c1[i] + (c2[i] - c1[i]) * t));
}
function rgbStr(c) { return `rgb(${c[0]},${c[1]},${c[2]})`; }
function luminance(c) { return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255; }

/* diverging colormap: negative -> red pole, positive -> blue pole, 0 -> neutral */
function divergingColor(t) { // t in [-1, 1]
  const mid = hexToRgb(cssVar("--div-mid"));
  const pos = hexToRgb(cssVar("--accent"));
  const neg = hexToRgb(cssVar("--neg"));
  const c = t >= 0 ? mix(mid, pos, Math.min(1, t)) : mix(mid, neg, Math.min(1, -t));
  return c;
}

/* ---------------- formatting ---------------- */
function fmtSci(x) { // "3.2×10⁻⁷" as HTML
  if (x === 0) return "0";
  const e = Math.floor(Math.log10(Math.abs(x)));
  const m = x / Math.pow(10, e);
  if (e >= -2 && e <= 3) {
    const d = Math.abs(x) >= 100 ? 0 : Math.abs(x) >= 1 ? 2 : 3;
    return x.toFixed(d);
  }
  return `${m.toFixed(1)}×10<sup>${e}</sup>`;
}
function fmtCount(x) {
  if (x < 100000) return x.toLocaleString("en-US");
  const e = Math.floor(Math.log10(x));
  return `${(x / Math.pow(10, e)).toFixed(1)}×10<sup>${e}</sup>`;
}
function supStr(n) {
  const map = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
  return String(n).split("").map(ch => map[ch] || ch).join("");
}

/* ---------------- small dense linear algebra (matrices = array of row arrays) ---------------- */
function zeros(r, c) { return Array.from({ length: r }, () => new Array(c).fill(0)); }
function matmul(A, B) {
  const n = A.length, k = B.length, m = B[0].length, C = zeros(n, m);
  for (let i = 0; i < n; i++) for (let p = 0; p < k; p++) {
    const a = A[i][p]; if (a === 0) continue;
    for (let j = 0; j < m; j++) C[i][j] += a * B[p][j];
  }
  return C;
}
function transpose(A) {
  return A[0].map((_, j) => A.map(row => row[j]));
}
function gramT(A) { // AᵀA for A (n×r)
  const r = A[0].length, G = zeros(r, r);
  for (const row of A) for (let i = 0; i < r; i++) for (let j = 0; j < r; j++) G[i][j] += row[i] * row[j];
  return G;
}
function hadamard(X, Y) { return X.map((row, i) => row.map((v, j) => v * Y[i][j])); }
/* solve M X = B for M (r×r) SPD-ish, B (r×m); Gaussian elimination, partial pivot, tiny ridge */
function solveLin(Min, Bin) {
  const r = Min.length, m = Bin[0].length;
  const M = Min.map((row, i) => row.map((v, j) => v + (i === j ? 1e-12 : 0)));
  const B = Bin.map(row => row.slice());
  for (let col = 0; col < r; col++) {
    let piv = col;
    for (let i = col + 1; i < r; i++) if (Math.abs(M[i][col]) > Math.abs(M[piv][col])) piv = i;
    [M[col], M[piv]] = [M[piv], M[col]]; [B[col], B[piv]] = [B[piv], B[col]];
    const d = M[col][col] || 1e-300;
    for (let i = 0; i < r; i++) {
      if (i === col) continue;
      const f = M[i][col] / d;
      if (f === 0) continue;
      for (let j = col; j < r; j++) M[i][j] -= f * M[col][j];
      for (let j = 0; j < m; j++) B[i][j] -= f * B[col][j];
    }
  }
  return B.map((row, i) => row.map(v => v / (M[i][i] || 1e-300)));
}
/* cyclic Jacobi eigendecomposition for symmetric A; returns {vals, vecs} desc-sorted, vecs[i][j] = comp i of evec j */
function jacobiEig(Ain) {
  const n = Ain.length;
  const A = Ain.map(r => r.slice());
  let V = zeros(n, n); for (let i = 0; i < n; i++) V[i][i] = 1;
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p][q] * A[p][q];
    if (off < 1e-24) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(A[p][q]) < 1e-30) continue;
      const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) {
        const akp = A[k][p], akq = A[k][q];
        A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < n; k++) {
        const apk = A[p][k], aqk = A[q][k];
        A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < n; k++) {
        const vkp = V[k][p], vkq = V[k][q];
        V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq;
      }
    }
  }
  const pairs = Array.from({ length: n }, (_, i) => [A[i][i], i]).sort((a, b) => b[0] - a[0]);
  const vals = pairs.map(p => p[0]);
  const vecs = zeros(n, n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) vecs[i][j] = V[i][pairs[j][1]];
  return { vals, vecs };
}
/* ---------------- fast symmetric eigensolver (eigenvalues only) ----------------
   Householder tridiagonalization + implicit-shift QL (tred2/tqli, values-only).
   O(n³) with a tiny constant: n=300 in ~20 ms, where cyclic Jacobi would take
   seconds. Verified against jacobiEig to 4e-15 relative. */
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

/* numerical rank of a matrix (rows×cols) via eigenvalues of the smaller Gram matrix */
function matRank(M, tol = 1e-9) {
  const rows = M.length, cols = M[0].length;
  const G = rows <= cols ? matmul(M, transpose(M)) : matmul(transpose(M), M);
  const vals = jacobiEig(G).vals;               // singular values squared, desc
  const top = Math.max(vals[0], 0);
  if (top <= 0) return 0;
  return vals.filter(v => v > tol * top).length;
}

/* ---------------- heatmap rendering ---------------- */
/* draws matrix (rows×cols) into el as colored grid; scale = max|v| shared */
function renderHeatmap(el, M, opts = {}) {
  const scale = opts.scale ?? Math.max(1e-12, ...M.flat().map(Math.abs));
  const small = opts.small ?? false;
  const showVal = opts.showVal ?? true;
  const cellPx = opts.cellPx ?? null;
  el.innerHTML = "";
  M.forEach((row, i) => {
    const rowEl = document.createElement("div");
    rowEl.className = "hm-row";
    row.forEach((v, j) => {
      const cell = document.createElement("div");
      cell.className = "hm-cell" + (small ? " small" : "");
      if (cellPx) {
        cell.style.width = cellPx + "px";
        cell.style.height = cellPx + "px";
        cell.style.fontSize = Math.max(7, Math.round(cellPx * 0.32)) + "px";
        cell.style.borderRadius = Math.max(2, Math.round(cellPx * 0.12)) + "px";
      }
      const c = divergingColor(v / scale);
      cell.style.background = rgbStr(c);
      cell.style.color = luminance(c) > 0.55 ? "#0b0b0b" : "#ffffff";
      if (showVal) cell.textContent = Math.abs(v) < 0.005 ? "0" : v.toFixed(Math.abs(v) < 10 ? 1 : 0);
      if (opts.onHover) {
        cell.addEventListener("mouseenter", () => opts.onHover(i, j, v, cell));
      }
      cell.dataset.i = i; cell.dataset.j = j;
      rowEl.appendChild(cell);
    });
    el.appendChild(rowEl);
  });
}

/* ---------------- generic line chart ---------------- */
/* cfg: {xs, series:[{name, color, ys}], yTicks:[{v,label}], xLabel, refLine:{v,label}, tooltip(x,i)->html, marker, label, yMin, yMax, dashedSeries:Set} */
function lineChart(container, cfg) {
  container.innerHTML = "";
  const W = 640, H = 300, mL = 46, mR = 86, mT = 16, mB = 40;
  const iw = W - mL - mR, ih = H - mT - mB;
  const xs = cfg.xs;
  const allY = cfg.series.flatMap(s => s.ys);
  const yMin = cfg.yMin ?? Math.floor(Math.min(...allY)), yMax = cfg.yMax ?? Math.ceil(Math.max(...allY));
  const X = x => mL + (x - xs[0]) / (xs[xs.length - 1] - xs[0]) * iw;
  const Y = y => mT + (1 - (y - yMin) / Math.max(1e-9, yMax - yMin)) * ih;
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("class", "chart");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", cfg.label || "line chart");
  svg.style.width = "100%";
  const add = (parent, tag, attrs, text) => {
    const e = document.createElementNS(svgNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    parent.appendChild(e); return e;
  };
  // gridlines + y ticks
  (cfg.yTicks || []).forEach(t => {
    if (t.v < yMin || t.v > yMax) return;
    add(svg, "line", { x1: mL, x2: W - mR, y1: Y(t.v), y2: Y(t.v), stroke: "var(--grid)", "stroke-width": 1 });
    add(svg, "text", { x: mL - 6, y: Y(t.v) + 4, "text-anchor": "end", "font-size": 11, fill: "var(--muted)" }, t.label);
  });
  // x ticks — either an explicit list of {v, label}, or one label per data point
  if (cfg.xTicks) {
    cfg.xTicks.forEach(t => {
      if (t.v < xs[0] || t.v > xs[xs.length - 1]) return;
      add(svg, "text", { x: X(t.v), y: H - mB + 16, "text-anchor": "middle", "font-size": 11, fill: "var(--muted)" }, t.label);
    });
  } else {
    xs.forEach(x => {
      if (cfg.xTickEvery && (x - xs[0]) % cfg.xTickEvery !== 0) return;
      add(svg, "text", { x: X(x), y: H - mB + 16, "text-anchor": "middle", "font-size": 11, fill: "var(--muted)" }, String(x));
    });
  }
  add(svg, "text", { x: mL + iw / 2, y: H - 6, "text-anchor": "middle", "font-size": 12, fill: "var(--ink-2)" }, cfg.xLabel || "");
  // baseline
  add(svg, "line", { x1: mL, x2: W - mR, y1: Y(yMin), y2: Y(yMin), stroke: "var(--baseline)", "stroke-width": 1 });
  // reference line
  if (cfg.refLine && cfg.refLine.v > yMin && cfg.refLine.v < yMax) {
    add(svg, "line", { x1: mL, x2: W - mR, y1: Y(cfg.refLine.v), y2: Y(cfg.refLine.v), stroke: "var(--muted)", "stroke-dasharray": "4 4", "stroke-width": 1 });
    add(svg, "text", { x: mL + 4, y: Y(cfg.refLine.v) - 5, "font-size": 10.5, fill: "var(--muted)" }, cfg.refLine.label);
  }
  // series
  cfg.series.forEach(s => {
    const pts = xs.map((x, i) => [X(x), Y(s.ys[i])]);
    if (!s.noLine) add(svg, "path", {
      d: "M" + pts.map(p => p.map(v => v.toFixed(1)).join(",")).join("L"),
      fill: "none", stroke: s.color, "stroke-width": 2, "stroke-linejoin": "round",
      ...(s.dashed ? { "stroke-dasharray": "5 4" } : {})
    });
    if (!s.noDots) pts.forEach((p, i) => {
      if (s.ys[i] == null) return;   // pending/absent data point — draw nothing
      add(svg, "circle", { cx: p[0], cy: p[1], r: 3.2, fill: s.color });
    });
    // direct label at line end (or start, to avoid collisions when series coincide);
    // labelDy nudges the label vertically when several series share an anchor point
    const anchor = s.labelAt === "start" ? pts[0] : pts[pts.length - 1];
    add(svg, "text", {
      x: s.labelAt === "start" ? anchor[0] + 10 : anchor[0] + 8,
      y: (s.labelAt === "start" ? anchor[1] - 8 : anchor[1] + 4) + (s.labelDy || 0),
      "font-size": 11.5, "font-weight": 600, fill: "var(--ink-2)"
    }, s.name);
  });
  // marker (current selection)
  if (cfg.marker != null && xs.includes(cfg.marker)) {
    add(svg, "line", { x1: X(cfg.marker), x2: X(cfg.marker), y1: mT, y2: H - mB, stroke: "var(--ink-2)", "stroke-dasharray": "2 3", "stroke-width": 1 });
  }
  // hover layer
  const hoverLine = add(svg, "line", { x1: 0, x2: 0, y1: mT, y2: H - mB, stroke: "var(--ink-2)", "stroke-width": 1, opacity: 0 });
  let tip = document.querySelector(".chart-tip");
  if (!tip) { tip = document.createElement("div"); tip.className = "chart-tip"; document.body.appendChild(tip); }
  const rectHover = add(svg, "rect", { x: mL, y: mT, width: iw, height: ih, fill: "transparent" });
  rectHover.addEventListener("mousemove", ev => {
    const bbox = svg.getBoundingClientRect();
    const px = (ev.clientX - bbox.left) / bbox.width * W;
    let best = 0, bd = 1e9;
    xs.forEach((x, i) => { const d = Math.abs(X(x) - px); if (d < bd) { bd = d; best = i; } });
    hoverLine.setAttribute("x1", X(xs[best])); hoverLine.setAttribute("x2", X(xs[best]));
    hoverLine.setAttribute("opacity", 0.5);
    tip.innerHTML = cfg.tooltip(xs[best], best);
    tip.classList.add("show");
    const tw = tip.offsetWidth;
    let left = ev.clientX + 14;
    if (left + tw > window.innerWidth - 10) left = ev.clientX - tw - 14;
    tip.style.left = left + "px";
    tip.style.top = (ev.clientY + 12) + "px";
  });
  rectHover.addEventListener("mouseleave", () => { hoverLine.setAttribute("opacity", 0); tip.classList.remove("show"); });
  container.appendChild(svg);
}

/* re-render registry for light/dark switches */
const rerenderFns = [];
function onSchemeChange(fn) { rerenderFns.push(fn); }
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => rerenderFns.forEach(f => f()));
