# T1 baseline and denominator audit — 2026-09-28

The CC0 `cases.json` manifest contains **76 inputs**: 69 transformations with an exact 1× source and seven `ai-real` examples without ground truth. The scoring program writes all 76 case records (`n_cases: 76`) but excludes `ai-real` from its accuracy aggregate (`aggregates.overall.n: 69`). Thus 69 and 76 describe different denominators, not missing inputs. The real generated examples may be inspected for dimensions/colours; they cannot support an exact-pixel claim.

| Ground-truth kind | n | Baseline exact size | Baseline exact pixels | Baseline within Oklab ΔE .02 | Main failure type |
|---|---:|---:|---:|---:|---|
| nearest integer | 20 | 100% | 92.2% | 94.4% | a few colour/alpha differences despite right size |
| nearest fractional | 9 | 100% | 88.6% | 91.0% | border/crop and alpha details |
| smooth resample | 14 | 93% | 70.5% | 78.2% | one untrusted lattice; extra fringe colours |
| JPEG | 10 | 80% | 4.5% | 48.4% | lossy colour cannot be exactly recovered; two untrusted grids |
| blur | 6 | 67% | 53.8% | 64.2% | two untrusted grids, soft edges |
| simulated generated | 10 | 20% (80% within ±1) | 36.1% | 53.2% | uneven cells, off-by-one size/alpha |
| **All with truth** | **69** | **81%** | **63.2%** | **75.4%** | see above |
| Real generated, **no truth** | **7** | n/a | n/a | n/a | all conservatively kept at source size |

This run used `origin/main` `cd1e69a` implementation on the T1 worktree before any product change. Commands: `PIXEL_BENCH_WORK=<T1 worktree>/.pixel-bench-work python docs/pixel-bench/png_cache.py`, `node docs/pixel-bench/run_nerulio.mjs`, then `python docs/pixel-bench/score.py t1-main-baseline .pixel-bench-work/out/nerulio --quiet`. The Pillow/numpy scorer independently reopened generated PNGs. Individual records are in `scores/t1-main-baseline.json`. Its local absolute paths are environment provenance, not portable corpus paths.

More failure separation from the individual records: 13/69 wrong exact dimensions (1 smooth, 2 JPEG, 2 blur, 8 simulated generated); 26/69 below 50% exact pixels (10 JPEG, 7 simulated generated, 4 smooth, 3 blur, 1 each nearest integer/fractional); 24/69 below 80% within ΔE .02 (7 JPEG, 7 simulated generated, 4 smooth, 3 blur, 2 nearest integer, 1 fractional). Alpha disagreement above 1% occurs in 21 cases, concentrated in simulated generated (7) and JPEG (6). Fringe colours above 10% occur in 16 cases, mostly smooth resamples (9) and JPEG (5). These thresholds are diagnostic buckets, **not** a competitor ranking.

The stored `perfectpixel.json` has `n_cases: 76`, `aggregates.overall.n: 69`, and 15 failures among the 69 truth cases (8 nearest integer, 7 nearest fractional). `snapper`, `unfake` variants and current Nerulio score files have zero missing outputs in their 69 truth cases. Before publishing any comparative claim, rerun frozen competitors and record their versions/options. The 7 real generated examples do not count as successes or failures in the accuracy denominator.
