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

## Run locally

Any static server works:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```
