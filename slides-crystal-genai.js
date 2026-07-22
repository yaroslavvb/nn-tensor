/* Widgets for "Generative AI for Crystal Structures — an interactive tour"
   (arXiv:2509.02723). Depends on lib.js (mulberry32, randn, cssVar). */
"use strict";

/* ---------- 1. Boltzmann landscape: p(x) ∝ exp(−E/kT) ---------- */
(function cgBoltzmann() {
  const plotEl = document.getElementById("cg-bz-plot");
  if (!plotEl) return;
  const tempEl = document.getElementById("cg-bz-temp");
  const readEl = document.getElementById("cg-bz-read");
  const sampleBtn = document.getElementById("cg-bz-sample");

  const W = 620, H = 340, mL = 44, mR = 14;
  const iw = W - mL - mR;
  const eTop = 16, eH = 130;          // energy panel
  const pTop = 180, pH = 110;         // probability panel
  const N = 240;

  // toy energy landscape: three wells of different depth (units: arbitrary)
  const wells = [
    { c: 0.22, w: 0.060, d: 2.6, label: "stable" },
    { c: 0.50, w: 0.045, d: 1.7, label: "metastable" },
    { c: 0.78, w: 0.055, d: 2.15, label: "metastable" }
  ];
  const E = x => {
    let e = 3.0 + 0.35 * Math.sin(9 * x);
    wells.forEach(g => { e -= g.d * Math.exp(-(((x - g.c) / g.w) ** 2)); });
    return e;
  };
  const xs = Array.from({ length: N }, (_, i) => i / (N - 1));
  const Es = xs.map(E);
  const eMin = Math.min(...Es), eMax = Math.max(...Es);

  let showSamples = false;

  function render() {
    const kT = tempEl.value / 100;            // 0.08 .. 2.0
    readEl.innerHTML = "k<sub>B</sub>T = " + kT.toFixed(2);
    const ps = Es.map(e => Math.exp(-(e - eMin) / kT));
    const Z = ps.reduce((a, b) => a + b, 0);
    const pMax = Math.max(...ps);

    const X = x => mL + x * iw;
    const YE = e => eTop + (1 - (e - eMin) / (eMax - eMin)) * eH;
    const YP = p => pTop + pH - (p / pMax) * pH;

    const ePath = xs.map((x, i) => (i ? "L" : "M") + X(x).toFixed(1) + "," + YE(Es[i]).toFixed(1)).join("");
    const pLine = xs.map((x, i) => (i ? "L" : "M") + X(x).toFixed(1) + "," + YP(ps[i]).toFixed(1)).join("");
    const pArea = pLine + "L" + X(1).toFixed(1) + "," + (pTop + pH) + "L" + X(0).toFixed(1) + "," + (pTop + pH) + "Z";

    // deterministic samples via inverse CDF
    let dots = "";
    if (showSamples) {
      const cdf = []; let acc = 0;
      ps.forEach(p => { acc += p / Z; cdf.push(acc); });
      const rng = mulberry32(42);
      for (let s = 0; s < 150; s++) {
        const u = rng();
        let i = cdf.findIndex(c => c >= u); if (i < 0) i = N - 1;
        const jit = (rng() - 0.5) * 8;
        dots += '<circle cx="' + (X(xs[i]) + jit * 0.3).toFixed(1) + '" cy="' + (pTop + pH + 12 + (s % 5) * 3.4).toFixed(1) +
          '" r="2.1" fill="' + cssVar("--accent-4") + '" opacity="0.75"/>';
      }
    }

    const labels = wells.map(g =>
      '<text x="' + X(g.c).toFixed(1) + '" y="' + (YE(E(g.c)) + 16).toFixed(1) +
      '" text-anchor="middle" font-size="10.5" fill="' + cssVar("--muted") + '">' + g.label + "</text>").join("");

    plotEl.innerHTML =
      '<svg viewBox="0 0 ' + W + " " + H + '" style="width:100%;" role="img" aria-label="Energy landscape and Boltzmann probability">' +
      '<text x="10" y="' + (eTop + 10) + '" font-size="12" fill="' + cssVar("--ink-2") + '" font-weight="600">E(x)</text>' +
      '<path d="' + ePath + '" fill="none" stroke="' + cssVar("--accent") + '" stroke-width="2.4"/>' + labels +
      '<text x="10" y="' + (pTop + 6) + '" font-size="12" fill="' + cssVar("--ink-2") + '" font-weight="600">p(x) ∝ e^(−E/k_BT)</text>' +
      '<path d="' + pArea + '" fill="' + cssVar("--accent-2") + '" opacity="0.25"/>' +
      '<path d="' + pLine + '" fill="none" stroke="' + cssVar("--accent-2") + '" stroke-width="2.2"/>' +
      '<line x1="' + mL + '" x2="' + (W - mR) + '" y1="' + (pTop + pH) + '" y2="' + (pTop + pH) + '" stroke="' + cssVar("--grid") + '"/>' +
      dots +
      (showSamples ? '<text x="' + mL + '" y="' + (H - 4) + '" font-size="10.5" fill="' + cssVar("--muted") + '">150 sampled structures (seeded)</text>' : "") +
      "</svg>";
  }

  tempEl.addEventListener("input", render);
  sampleBtn.addEventListener("click", () => { showSamples = !showSamples; sampleBtn.textContent = showSamples ? "hide samples" : "sample 150 structures"; render(); });
  if (typeof onSchemeChange === "function") onSchemeChange(render);
  render();
})();

/* ---------- 2. periodic lattice + fractional coordinates ---------- */
(function cgLattice() {
  const plotEl = document.getElementById("cg-lat-plot");
  if (!plotEl) return;
  const aEl = document.getElementById("cg-lat-a");
  const bEl = document.getElementById("cg-lat-b");
  const gEl = document.getElementById("cg-lat-g");
  const uEl = document.getElementById("cg-lat-u");
  const readEl = document.getElementById("cg-lat-read");

  const W = 560, H = 380;

  function render() {
    const a = +aEl.value, b = +bEl.value, gam = +gEl.value * Math.PI / 180;
    const u = +uEl.value / 100;
    // lattice vectors in screen px (y flipped)
    const a1 = [a, 0];
    const a2 = [b * Math.cos(gam), -b * Math.sin(gam)];
    const ox = 80, oy = H - 70;
    const P = (i, j, fx, fy) => [
      ox + (i + fx) * a1[0] + (j + fy) * a2[0],
      oy + (i + fx) * a1[1] + (j + fy) * a2[1]
    ];
    const basis = [
      { f: [0.25, 0.30], r: 9, color: cssVar("--accent"), name: "A" },
      { f: [u, 0.65], r: 7, color: cssVar("--accent-3"), name: "B" }
    ];
    let atoms = "", cells = "";
    for (let i = -1; i <= 5; i++) for (let j = -1; j <= 5; j++) {
      const c0 = P(i, j, 0, 0), c1 = P(i, j, 1, 0), c2 = P(i, j, 1, 1), c3 = P(i, j, 0, 1);
      if (Math.max(c0[0], c1[0], c2[0], c3[0]) < 0 || Math.min(c0[0], c1[0], c2[0], c3[0]) > W) continue;
      if (Math.max(c0[1], c1[1], c2[1], c3[1]) < 0 || Math.min(c0[1], c1[1], c2[1], c3[1]) > H) continue;
      const home = i === 0 && j === 0;
      cells += '<path d="M' + c0 + "L" + c1 + "L" + c2 + "L" + c3 + 'Z" fill="' +
        (home ? cssVar("--accent") : "none") + '" fill-opacity="0.08" stroke="' +
        (home ? cssVar("--accent") : cssVar("--grid")) + '" stroke-width="' + (home ? 2 : 1) + '"/>';
      basis.forEach(at => {
        const p = P(i, j, at.f[0], at.f[1]);
        atoms += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + at.r +
          '" fill="' + at.color + '" opacity="' + (home ? 1 : 0.45) + '"/>';
      });
    }
    const t1 = P(0, 0, 1, 0), t2 = P(0, 0, 0, 1);
    const arrows =
      '<line x1="' + ox + '" y1="' + oy + '" x2="' + t1[0] + '" y2="' + t1[1] + '" stroke="' + cssVar("--ink") + '" stroke-width="2.4"/>' +
      '<line x1="' + ox + '" y1="' + oy + '" x2="' + t2[0] + '" y2="' + t2[1] + '" stroke="' + cssVar("--ink") + '" stroke-width="2.4"/>' +
      '<text x="' + (t1[0] + 6) + '" y="' + (t1[1] + 14) + '" font-size="13" font-weight="700" fill="' + cssVar("--ink") + '">a₁</text>' +
      '<text x="' + (t2[0] - 18) + '" y="' + (t2[1] - 6) + '" font-size="13" font-weight="700" fill="' + cssVar("--ink") + '">a₂</text>';
    plotEl.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" style="width:100%;" role="img" aria-label="Tiled 2-D unit cell">' +
      cells + atoms + arrows + "</svg>";
    readEl.innerHTML = "lattice: a = " + a + ", b = " + b + ", γ = " + gEl.value + "° &nbsp;·&nbsp; " +
      "atom B fractional coords <b>(" + u.toFixed(2) + ", 0.65)</b> — every periodic image moves with it";
  }
  [aEl, bEl, gEl, uEl].forEach(el => el.addEventListener("input", render));
  if (typeof onSchemeChange === "function") onSchemeChange(render);
  render();
})();

/* ---------- 3. representation zoo seg toggle ---------- */
(function cgRepZoo() {
  const seg = document.getElementById("cg-rep-seg");
  if (!seg) return;
  const detail = document.getElementById("cg-rep-detail");
  const DATA = {
    pc: {
      title: "Point cloud / AXL",
      body: "Atoms as points: species A, coordinates X, lattice L = (a, b, c, α, β, γ). " +
        "The complete representation P = {(sᵢ, xᵢ, yᵢ, zᵢ)} + lattice.",
      inv: "Invertible ✓ — (A, X, L) reconstructs the crystal exactly.",
      used: "CDVAE, DiffCSP, MatterGen, FlowMM, CrystalTextLLM … the workhorse representation."
    },
    vox: {
      title: "Voxel grid",
      body: "3-D image of the cell: atoms as Gaussians on a grid, one channel per element. " +
        "Enables convolutional U-Nets; resolution is a critical hyperparameter.",
      inv: "Invertible only after segmentation back to atom positions; historically the earliest choice.",
      used: "iMatGen, ICSG3D, CCDCGAN, Uni-3DAR (octree-compressed tokens)."
    },
    gr: {
      title: "Graph",
      body: "Atoms = nodes (element features), bonds/interactions = edges (distances, angles). " +
        "Naturally permutation-invariant and geometry-aware.",
      inv: "NOT invertible on its own — loses exact geometry; paired with point clouds to refine positions.",
      used: "CDVAE, SyMat, GemsDiff, MatterGen, Chemeleon (as the encoder side)."
    },
    rec: {
      title: "Reciprocal space",
      body: "Fourier view: structure factors F(hkl) = Σⱼ fⱼ e^(−2πi(hxⱼ+kyⱼ+lzⱼ)) " +
        "capture periodicity and long-range order directly.",
      inv: "Invertible when the direct lattice L is stored alongside the structure factors.",
      used: "FTCP (hybrid real + reciprocal), LCMGM."
    },
    wy: {
      title: "Wyckoff positions",
      body: "Encode only the asymmetric unit: 230 space groups, 1 771 distinct Wyckoff positions. " +
        "Symmetry operations regenerate all equivalent atoms.",
      inv: "Invertible ✓ given occupancies + lattice; symmetry enforced by construction.",
      used: "PGCGM, WyCryst, DiffCSP++, CrystalFormer, Matra-Genoa, SymmCD, WyckoffDiff."
    }
  };
  function show(key) {
    const d = DATA[key];
    detail.innerHTML = "<h3 style='margin:0 0 6px;'>" + d.title + "</h3>" +
      "<p style='margin:0 0 8px;'>" + d.body + "</p>" +
      "<p style='margin:0 0 8px; color:var(--ink-2);'><b>Invertibility:</b> " + d.inv + "</p>" +
      "<p class='note' style='margin:0;'>Used by: " + d.used + "</p>";
  }
  seg.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      seg.querySelectorAll("button").forEach(b => { b.classList.toggle("on", b === btn); b.setAttribute("aria-pressed", b === btn); });
      show(btn.dataset.rep);
    });
  });
  show("pc");
})();

/* ---------- 4. diffusion forward/reverse on a toy 2-D crystal ---------- */
(function cgDiffusion() {
  const plotEl = document.getElementById("cg-df-plot");
  if (!plotEl) return;
  const tEl = document.getElementById("cg-df-t");
  const readEl = document.getElementById("cg-df-read");
  const fwdBtn = document.getElementById("cg-df-fwd");
  const revBtn = document.getElementById("cg-df-rev");

  const W = 520, H = 400;
  const nx = 5, ny = 5, pad = 70, cx = W / 2, cy = H / 2;
  const atoms = [];
  {
    const rng = mulberry32(7);
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const x0 = pad + i * (W - 2 * pad) / (nx - 1) - cx;
      const y0 = pad + j * (H - 2 * pad) / (ny - 1) - cy;
      atoms.push({ x0, y0, ex: randn(rng) * 120, ey: randn(rng) * 120, sp: (i + j) % 2 });
    }
  }
  const abar = t => Math.cos(Math.PI / 2 * t) ** 2;   // cosine schedule

  function render() {
    const t = tEl.value / 100;
    const ab = abar(t), sa = Math.sqrt(ab), sn = Math.sqrt(1 - ab);
    const cA = cssVar("--accent"), cB = cssVar("--accent-3");
    let ghosts = "", dots = "";
    atoms.forEach(at => {
      const x = cx + sa * at.x0 + sn * at.ex;
      const y = cy + sa * at.y0 + sn * at.ey;
      ghosts += '<circle cx="' + (cx + at.x0) + '" cy="' + (cy + at.y0) + '" r="3" fill="none" stroke="' +
        cssVar("--grid") + '" stroke-width="1.5"/>';
      dots += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (at.sp ? 8 : 10) +
        '" fill="' + (at.sp ? cB : cA) + '" opacity="0.9"/>';
    });
    const phase = t < 0.02 ? "data x₀ (crystal)" : t > 0.98 ? "pure noise xᵀ" : "xₜ — partially noised";
    readEl.innerHTML = "t = " + t.toFixed(2) + " · " + phase;
    plotEl.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" style="width:100%; max-height:52vh;" role="img" aria-label="Diffusion on a toy crystal">' +
      '<rect x="1" y="1" width="' + (W - 2) + '" height="' + (H - 2) + '" fill="none" stroke="' + cssVar("--border") + '" rx="10"/>' +
      ghosts + dots + "</svg>";
  }

  let timer = null;
  function animate(dir) {
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      let v = +tEl.value + dir * 2;
      if (v >= 100) { v = 100; clearInterval(timer); timer = null; }
      if (v <= 0) { v = 0; clearInterval(timer); timer = null; }
      tEl.value = v;
      render();
    }, 30);
  }
  fwdBtn.addEventListener("click", () => animate(+1));
  revBtn.addEventListener("click", () => animate(-1));
  tEl.addEventListener("input", () => { if (timer) { clearInterval(timer); timer = null; } render(); });
  if (typeof onSchemeChange === "function") onSchemeChange(render);
  render();
})();

/* ---------- 5. model catalog (Table III) with filter pills ---------- */
(function cgCatalog() {
  const body = document.getElementById("cg-cat-body");
  if (!body) return;
  // r: representation, a: architecture, c: conditioned, d: domain, y: year,
  // rt/at: filter tags. Source: Table III, arXiv:2509.02723.
  const M = [
    ["CrystalGAN", "Point Cloud", "GAN", 0, "Hydrides", 2019, ["pc"], ["gan"]],
    ["DD3DCS", "Voxel", "GAN", 0, "All Structures", 2019, ["vox"], ["gan"]],
    ["CondGAN", "Bag of Atoms", "GAN", 1, "Compositions", 2019, ["oth"], ["gan"]],
    ["iMatGen", "Voxel Grid", "VAE", 0, "Vanadium Oxides", 2019, ["vox"], ["vae"]],
    ["MatGAN", "One-Hot Elements", "GAN", 1, "Compositions", 2020, ["oth"], ["gan"]],
    ["GANCSP", "Point Cloud", "GAN", 1, "All Structures", 2020, ["pc"], ["gan"]],
    ["ICSG3D", "Voxel", "GAN", 1, "Cubic Alloys, Perovskites, Heusler", 2020, ["vox"], ["gan"]],
    ["CubicGAN", "Point Cloud", "GAN", 1, "Cubic Structures", 2021, ["pc"], ["gan"]],
    ["CCDCGAN", "Voxel Grid", "VAE, GAN", 1, "Bi–Se Materials", 2021, ["vox"], ["vae", "gan"]],
    ["FTCP", "Reciprocal Space, Point Cloud", "VAE", 0, "All Structures", 2022, ["rec", "pc"], ["vae"]],
    ["CDVAE", "Point Cloud, Graph", "VAE, Diffusion", 1, "All Structures", 2022, ["pc", "gr"], ["vae", "diff"]],
    ["CCDCGAN (multi-comp.)", "Voxel Grid", "VAE, GAN", 1, "All Structures", 2022, ["vox"], ["vae", "gan"]],
    ["PGCGM", "Wyckoff", "GAN", 1, "Ternaries", 2023, ["wy"], ["gan"]],
    ["XYZTransformer", "Point Cloud", "LLM", 0, "All Structures", 2023, ["pc"], ["llm"]],
    ["PCVAE", "Composition, Prototype", "VAE", 0, "Prototypes", 2023, ["oth"], ["vae"]],
    ["LCOM", "Graph, Point Cloud", "VAE, Diffusion", 1, "All Structures", 2023, ["gr", "pc"], ["vae", "diff"]],
    ["CHGlownet", "Graph", "GFlowNet", 0, "All Structures", 2023, ["gr"], ["oth"]],
    ["SLI2Cry", "Graph (SLICES)", "RNN", 0, "All Structures", 2023, ["gr"], ["oth"]],
    ["SyMat", "Graph, Point Cloud", "Diffusion", 0, "All Structures", 2023, ["gr", "pc"], ["diff"]],
    ["Crystal-GFN", "Prototype (Space Group)", "GFlowNet", 1, "Structural Prototypes", 2023, ["oth"], ["oth"]],
    ["GemsDiff", "Graph, Point Cloud", "Diffusion", 0, "All Structures", 2023, ["gr", "pc"], ["diff"]],
    ["CGMD", "Point Cloud", "Diffusion, VAE, Flow Matching", 0, "All Structures", 2024, ["pc"], ["diff", "vae", "flow"]],
    ["DP-CDVAE", "Point Cloud, Graph", "Diffusion", 0, "All Structures", 2024, ["pc", "gr"], ["diff"]],
    ["CrysTens", "Point Cloud (Pairwise Dist.)", "GAN, Diffusion", 0, "All Structures", 2024, ["pc"], ["gan", "diff"]],
    ["CrystalTextLLM", "Point Cloud", "LLM", 1, "All Structures", 2024, ["pc"], ["llm"]],
    ["DiffCSP", "Point Cloud", "Diffusion", 1, "All Structures", 2024, ["pc"], ["diff"]],
    ["DiffCSP++", "Wyckoff", "Diffusion", 0, "All Structures", 2024, ["wy"], ["diff"]],
    ["Con-CDVAE", "Point Cloud, Graph", "VAE, Diffusion", 1, "All Structures", 2024, ["pc", "gr"], ["vae", "diff"]],
    ["NSGAN", "Composition Vector", "GAN, GA", 0, "Alloys", 2024, ["oth"], ["gan", "oth"]],
    ["UniMat", "Point Cloud", "Diffusion", 1, "All Structures", 2024, ["pc"], ["diff"]],
    ["FlowMM", "Point Cloud (Flat Manifold)", "Flow Matching", 0, "All Structures", 2024, ["pc"], ["flow"]],
    ["StructRepDiff", "Embedded Atom Density", "Diffusion", 0, "All Structures", 2024, ["oth"], ["diff"]],
    ["CrystalFormer", "Wyckoff", "Transformer", 1, "All Structures", 2024, ["wy"], ["llm"]],
    ["VGD-CG", "Composition One-Hot", "GAN, VAE, Diffusion", 1, "Compositions", 2024, ["oth"], ["gan", "vae", "diff"]],
    ["LCMGM", "Reciprocal Space", "VAE, GAN", 0, "Perovskites", 2024, ["rec"], ["vae", "gan"]],
    ["GenMS", "Point Cloud", "LLM, Diffusion", 1, "All Structures", 2024, ["pc"], ["llm", "diff"]],
    ["WyCryst", "Wyckoff", "VAE", 1, "All Structures", 2024, ["wy"], ["vae"]],
    ["MatExpert", "Point Cloud (Conversational)", "LLM", 1, "All Structures", 2024, ["pc"], ["llm"]],
    ["FlowLLM", "Point Cloud (Flat Manifold)", "LLM, Flow Matching", 1, "All Structures", 2024, ["pc"], ["llm", "flow"]],
    ["Cond-CDVAE", "Point Cloud, Graph", "VAE, Diffusion", 1, "All Structures", 2024, ["pc", "gr"], ["vae", "diff"]],
    ["CrystaLLM", "CIF File", "LLM, Transformer", 1, "All Structures", 2024, ["txt"], ["llm"]],
    ["CrysText", "CIF File", "LLM", 1, "All Structures", 2024, ["txt"], ["llm"]],
    ["CGWGAN", "Wyckoff", "GAN", 0, "All Structures", 2024, ["wy"], ["gan"]],
    ["Matra-Genoa", "Wyckoff", "Transformer", 1, "All Structures", 2025, ["wy"], ["llm"]],
    ["EH-Diff", "Hypergraph, Point Cloud", "Diffusion", 0, "All Structures", 2025, ["gr", "pc"], ["diff"]],
    ["CrysBFN", "Point Cloud (Hyper-Torus)", "Bayesian", 0, "All Structures", 2025, ["pc"], ["oth"]],
    ["TransVAE-CSP", "Graph, Point Cloud, RBF", "VAE, Diffusion", 0, "All Structures", 2025, ["gr", "pc"], ["vae", "diff"]],
    ["CrystalFlow", "Graph, Point Cloud", "Continuous Normalizing Flow", 1, "All Structures", 2025, ["gr", "pc"], ["flow"]],
    ["MatLLMSearch", "Text (JSON)", "LLM, Evolutionary Search", 1, "All Structures", 2025, ["txt"], ["llm", "oth"]],
    ["Mat2Seq", "Invariant Sequence", "LLM", 1, "All Structures", 2025, ["txt"], ["llm"]],
    ["MatterGen", "Point Cloud, Graph", "Diffusion", 1, "All Structures", 2025, ["pc", "gr"], ["diff"]],
    ["TGDMat", "Point Cloud, Contextual", "Diffusion", 1, "All Structures", 2025, ["pc", "txt"], ["diff"]],
    ["NatureLM-Mat3D", "Point Cloud", "LLM", 1, "All Structures", 2025, ["pc"], ["llm"]],
    ["CrystalGRW", "Graph, Manifold", "Geodesic Random Walk", 1, "All Structures", 2025, ["gr"], ["oth"]],
    ["UniGenX", "Point Cloud", "Transformer, Diffusion", 1, "All Structures", 2025, ["pc"], ["llm", "diff"]],
    ["DAO-G", "Graph, Point Cloud", "Diffusion (EBM)", 0, "All Structures", 2025, ["gr", "pc"], ["diff"]],
    ["Uni-3DAR", "Voxel (Compressed)", "Transformer", 0, "All Structures", 2025, ["vox"], ["llm"]],
    ["Chemeleon", "Graph, Point Cloud, Text", "Diffusion, Contrastive", 1, "All Structures", 2025, ["gr", "pc", "txt"], ["diff"]],
    ["SymmCD", "Wyckoff (Binary Matrix), Graph", "Diffusion", 0, "All Structures", 2025, ["wy", "gr"], ["diff"]],
    ["WyckoffDiff", "Wyckoff, Graph", "Diffusion", 0, "Protostructures", 2025, ["wy", "gr"], ["diff"]],
    ["KLDM", "Manifold, Graph", "Diffusion", 0, "All Structures", 2025, ["gr"], ["diff"]]
  ];

  const ARCH = [["all", "all"], ["diff", "diffusion"], ["gan", "GAN"], ["vae", "VAE"], ["flow", "flow / FM"], ["llm", "LLM / transformer"], ["oth", "other"]];
  const REP = [["all", "all"], ["pc", "point cloud"], ["gr", "graph"], ["wy", "Wyckoff"], ["vox", "voxel"], ["txt", "text / CIF"], ["rec", "reciprocal"], ["oth", "other"]];
  const COND = [["all", "any"], ["yes", "yes"], ["no", "no"]];
  const state = { arch: "all", rep: "all", cond: "all" };

  function buildPills(elId, defs, key) {
    const wrap = document.getElementById(elId);
    defs.forEach(([val, label], i) => {
      const b = document.createElement("button");
      b.className = "cg-fpill" + (i === 0 ? " on" : "");
      b.textContent = label;
      b.addEventListener("click", () => {
        state[key] = val;
        wrap.querySelectorAll(".cg-fpill").forEach(p => p.classList.toggle("on", p === b));
        renderTable();
      });
      wrap.appendChild(b);
    });
  }
  buildPills("cg-cat-arch", ARCH, "arch");
  buildPills("cg-cat-rep", REP, "rep");
  buildPills("cg-cat-cond", COND, "cond");

  const countEl = document.getElementById("cg-cat-count");
  function renderTable() {
    const rows = M.filter(m =>
      (state.arch === "all" || m[7].includes(state.arch)) &&
      (state.rep === "all" || m[6].includes(state.rep)) &&
      (state.cond === "all" || (state.cond === "yes") === (m[3] === 1)));
    countEl.innerHTML = "<b>" + rows.length + "</b> / " + M.length + " models shown";
    body.innerHTML = rows.map(m =>
      "<tr><td>" + m[0] + "</td><td>" + m[1] + "</td><td>" + m[2] + "</td>" +
      '<td class="' + (m[3] ? "yes" : "no") + '">' + (m[3] ? "yes" : "no") + "</td>" +
      "<td>" + m[4] + "</td><td>" + m[5] + "</td></tr>").join("");
  }
  renderTable();
})();

/* ---------- 6. training databases bar chart (Table I) ---------- */
(function cgDatabases() {
  const barsEl = document.getElementById("cg-db-bars");
  if (!barsEl) return;
  const readEl = document.getElementById("cg-db-read");
  const segEl = document.getElementById("cg-db-scale");

  // sizes from Table I; Perov-5 / Carbon-24 from Sec. III text.
  const DB = [
    { n: "Alexandria", v: 4.5e6, s: "4.5M", task: 0, note: "Large-scale DFT-optimized inorganic crystals, MP-compatible settings · CC BY 4.0" },
    { n: "AFLOWLIB", v: 3.5e6, s: "3.5M", task: 0, note: "Automated high-throughput DFT database · academic use only" },
    { n: "OQMD", v: 1.3e6, s: "1.3M", task: 0, note: "DFT database focused on thermodynamic stability & phase diagrams · CC BY 4.0" },
    { n: "ICSD", v: 3.0e5, s: "300K", task: 0, note: "Experimentally known inorganic crystals; subset included in MP · commercial (restricted)" },
    { n: "Materials Project", v: 1.55e5, s: "155K", task: 0, note: "DFT-optimized crystals (PBE GGA/GGA+U), experimental + hypothetical · CC BY 4.0" },
    { n: "Carbon-24", v: 1.0e5, s: ">100K", task: 1, note: "Task-specific: carbon allotropes from ab initio random structure search" },
    { n: "JARVIS", v: 8.0e4, s: "80K", task: 0, note: "DFT database incl. PBEsol, OptB88vdW, TBmBJ properties · open access" },
    { n: "Perov-5", v: 1.9e4, s: "≈19K", task: 1, note: "Task-specific: curated perovskites for water splitting" }
  ];
  let scale = "log";

  function render() {
    const vmax = 4.5e6, lmin = Math.log10(1e4), lmax = Math.log10(vmax);
    barsEl.innerHTML = DB.map((d, i) => {
      const w = scale === "log"
        ? (Math.log10(d.v) - lmin) / (lmax - lmin) * 100
        : d.v / vmax * 100;
      return '<div class="cg-barrow" data-i="' + i + '"><span>' + d.n + "</span>" +
        '<div class="cg-bartrack"><div class="cg-barfill' + (d.task ? " cg-task" : "") + '" style="width:' + Math.max(1.5, w).toFixed(1) + '%"></div></div>' +
        '<span class="cg-barval">' + d.s + "</span></div>";
    }).join("");
    barsEl.querySelectorAll(".cg-barrow").forEach(row => {
      row.addEventListener("mouseenter", () => {
        const d = DB[+row.dataset.i];
        readEl.innerHTML = "<b>" + d.n + "</b> · " + d.s + " structures — " + d.note;
      });
    });
  }
  segEl.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      scale = btn.dataset.s;
      segEl.querySelectorAll("button").forEach(b => { b.classList.toggle("on", b === btn); b.setAttribute("aria-pressed", b === btn); });
      render();
    });
  });
  render();
})();
