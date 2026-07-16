# nn-tensor — Tensor Decompositions, Interactively

An interactive tutorial on the common low-rank tensor decompositions — **CPD**, **Tucker**,
**Tensor Train / Hierarchical Tucker**, plus symmetric CPD, BTD, t-SVD, and Paratuck-2 —
and why they matter for the theory of neural networks.

**Live site:** https://yaroslavvb.github.io/nn-tensor/

Based on the review:

> R. Borsoi, K. Usevich, M. Clausel,
> *Low-Rank Tensor Decompositions for the Theory of Neural Networks*,
> IEEE Signal Processing Magazine. [arXiv:2508.18408](https://arxiv.org/abs/2508.18408)

## What's inside

Everything runs client-side in vanilla JS (no build step, no dependencies except KaTeX from a CDN):

- an order-3 tensor explorer (fibers & slices),
- an outer-product / rank-1 playground,
- a live **ALS** fit of a CPD on a hidden rank-3 tensor, with uniqueness experiments
  (permute / rescale components),
- a truncated **HOSVD** Tucker compressor with multilinear-rank sliders,
- clickable **tensor-network diagrams** (Tucker star, TT chain, HT binary tree),
- a **storage-complexity explorer** (full vs Tucker vs TT vs HT as order grows),
- a numeric verification that the third derivative of a 2-layer NN *is* a symmetric CPD
  whose factors are the first-layer weights (paper eq. 9),
- the paper's Table I as an interactive cheat sheet, and a quiz.

There is also a **worst-case report** ([worstcase.html](https://yaroslavvb.github.io/nn-tensor/worstcase.html))
on absolute worst-case approximation in the Frobenius (L²) vs spectral norms: incompressibility and
format-irrelevance in L², the dimension-free rank-⌈1/ε²⌉ greedy theorem in spectral norm (with a live
greedy lab where the flat-matrix worst case meets the 1/√t envelope), per-cut adversary lower bounds
for TT/Tucker, and the parameter shootout showing the CP ≺ TT ≺ Tucker ranking flip.

There is a **Gaussian-noise page** ([gaussian.html](https://yaroslavvb.github.io/nn-tensor/gaussian.html))
on the low-rank approximation error of an n×n Gaussian random matrix: Eckart–Young + the
quarter-circle law, live in-browser SVD simulations laid over the closed-form error curve
(parametrized by q = (2θ + sin 2θ)/π), and the asymptotic decay laws — spectral error ≈ (π/4)q,
Frobenius error ≈ 0.907·q^(3/2) near full rank, and captured energy ≈ 4r/n at low rank.

And a **deep-dive page** ([depth.html](https://yaroslavvb.github.io/nn-tensor/depth.html))
walking through why CP rank is exponentially larger than TT/HT rank — the bipartition-unfolding
lemma, a "chain of links" worked example whose crossing unfolding is a giant identity matrix,
live ALS fits that land exactly on the theoretical error curve √((2^d−R)/2^d), and the
Khrulkov–Novikov–Oseledets / Cohen–Sharir–Shashua depth-separation theorems.

## Run locally

Any static server works:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```
