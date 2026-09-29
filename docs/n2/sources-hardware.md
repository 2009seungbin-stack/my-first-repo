# Hardware vertical — sources

Status as of 2026-09-28 (branch `nerulio/n2-data-hardware`). Every fact in `data/seed/hardware/` cites a
source that was opened on its `retrieved` date. Nothing was filled from TechPowerUp, Wikipedia, reviews
or retailers; where the vendor does not state a value, the fact is omitted (the page shows "Unknown").

## 1. Source inventory

| Source | URL | Access | Documented? | Terms / robots | Cadence | Automated? |
| --- | --- | --- | --- | --- | --- | --- |
| NVIDIA GeForce spec pages | `https://www.nvidia.com/en-us/geforce/graphics-cards/{50,40,30}-series/…` | HTML, read by hand | n/a (product pages) | nvidia.com robots allows; site terms of use | on launch; static afterwards | **Manual** (`gpu-specs-manual`) |
| NVIDIA launch announcements (MSRP, availability) | `https://www.nvidia.com/en-us/geforce/news/…`, `https://nvidianews.nvidia.com/news/…` | HTML, read by hand | n/a | NVIDIA RSS feeds exist for the newsroom but "use is restricted to non-commercial purposes only" (`https://www.nvidia.com/en-us/about-nvidia/rss/`) → not used | on launch | **Manual** |
| NVIDIA workstation pages / datasheets | `https://www.nvidia.com/en-us/products/workstations/…` | HTML/PDF, by hand | n/a | as above | on launch | **Manual** |
| AMD Radeon product/spec pages, AMD press releases | `https://www.amd.com/en/products/graphics/…`, `https://www.amd.com/en/newsroom/…`, `https://ir.amd.com/` | HTML, by hand | n/a | amd.com terms of use | on launch | **Manual** |
| Intel Arc spec pages (ark), Intel newsroom | `https://www.intel.com/content/www/us/en/products/sku/…/specifications.html`, `https://newsroom.intel.com/` | HTML, by hand | n/a | intel.com terms of use; intel.com root returns 403 to non-browser clients | on launch | **Manual** |
| **NVIDIA data center driver releases** | `https://docs.nvidia.com/datacenter/tesla/drivers/releases.json` | JSON, one GET per run | **Yes** — `https://docs.nvidia.com/datacenter/tesla/drivers/supported-drivers-and-cuda-toolkit-versions.html` states "The release information can be scraped by automation tools (for example jq) by parsing the release information: releases.json." | docs.nvidia.com robots: `User-agent: *` allowed except tracking-parameter URLs (`?ncid`, `?utm`, …); `Content-Signal: search=yes, ai-input=yes` | NVIDIA updates it on each release (Last-Modified 2026-09-09 when checked) | **Automated** — adapter `nvidia-datacenter-drivers`, daily |
| llama.cpp quantization docs/source (for the ESTIMATE method) | `github.com/ggml-org/llama.cpp` at commit `03a667aa304f2a8e02a9a02b2e3fb45d64bcae7f`: `tools/quantize/README.md`, `ggml/src/ggml-common.h`, `src/llama-quant.cpp`, `tools/server/README.md` | read by hand, pinned commit | yes (project docs + source) | MIT-licensed project | re-check when presets change | n/a (constants in `platform/estimates/llm-memory.js`) |

### Investigated and not used
- **GeForce Game Ready / Studio driver releases (Windows)**: no official feed or documented API. The
  driver lookup endpoints used by nvidia.com's download form are undocumented → not used. NVIDIA's RSS
  feeds (newsroom, blog) are non-commercial only and do not cover drivers. → `MANUAL_SOURCE`.
- **`https://download.nvidia.com/XFree86/Linux-x86_64/latest.txt`** (observed responding 2026-09-28 with
  `595.91.07 595.91.07/NVIDIA-Linux-x86_64-595.91.07.run`): official host, but not documented anywhere we
  found and it gives no date → not used. Could be added later if NVIDIA documents it.
- **AMD Adrenalin release notes** (`https://www.amd.com/en/resources/support-articles/release-notes/RN-RAD-WIN-<ver>.html`):
  HTML only, no feed or index API; AMD community forum RSS is user-forum content, not an official feed. → `MANUAL_SOURCE`.
- **Intel Arc graphics driver** (Intel Download Center): HTML only, no documented feed; the intel.com
  root blocks non-browser clients (HTTP 403). → `MANUAL_SOURCE`.
- **Vendor product feeds for specs**: none of NVIDIA, AMD or Intel publishes a documented machine-readable
  GPU spec feed (none found in search or on the vendors' spec/support pages). Specs are static after launch, so manual curation is the reliable path.

## 2. Adapters

| id | mode | hosts | output |
| --- | --- | --- | --- |
| `nvidia-datacenter-drivers` | auto, 24 h, 1 request, 2 s politeness | `docs.nvidia.com` | one `driver` entity per branch (`driver:nvidia-dc-r<branch>`): `latest_version`, `branch_type` (production / lts / new_feature), `release_date` (earliest dated release listed for the branch — omitted when the oldest listed release has no date), every release as a `version` with date, channel and release-notes URL. Installer (`.run`) URLs are deliberately not stored. Facts are `ver: OFFICIAL`, source kind `FEED`. |
| `gpu-specs-manual` | manual (`MANUAL_SOURCE`) | none | no fetching; header of `collectors/gpu-specs-manual/index.js` documents the admin update procedure (seed edit or admin console, official URL + retrieved date, validate, ingest; quarterly lineup review). |

Tests (recorded fixtures only, no network): `tests/n2-collector-nvidia-datacenter-drivers.test.mjs`
(fixture `tests/fixtures/n2/collectors/nvidia-datacenter-drivers/releases.json`, a 4-branch excerpt of
the live file), `tests/n2-collector-gpu-specs-manual.test.mjs`.

Live run 2026-09-28: `node tools/platform/collect.mjs --adapter nvidia-datacenter-drivers --limit 5 --out <scratch>`
→ `error: null`, `validation: []`, 1 snapshot, 20 entities (branches R450–R615; R615 latest 615.71.09,
2026-09-09; R595 production 595.91.07; R580 LTS 580.178.04). `--limit` does not apply (feed-driven adapter).

## 3. Estimates (`platform/estimates/llm-memory.js`)

"Does an open-weight LLM fit in VRAM" is computed, never stored as a spec, and always labelled
`ESTIMATE`. `METHOD` (id `src:estimate-llm-vram-fit-v1`, kind `ESTIMATE_METHOD`) carries the method text in
en + ko. Summary:
- weights = total parameters × bits-per-weight ÷ 8, as a range: low = block size of the preset's default
  ggml type (`ggml-common.h` static_asserts; default type from `llama_ftype_get_default_type`), high =
  whole-file bits/weight llama.cpp measured on Llama-3.1-8B (`tools/quantize/README.md`). 25 presets
  from F16/BF16 down to IQ1_S. MoE: total parameters.
- KV cache (only with model config) = 2 × layers × KV heads × head dim × context × sequences × bytes per
  cache element (llama.cpp `--cache-type-k/-v` values; f16 default). Upper bound for SWA/hybrid/MLA.
- overhead = Nerulio assumption: 0.5–1.0 GiB + 0–5 % of weights (stated as an assumption, not sourced).
- verdict: does_not_fit (low total > VRAM) / tight (high total > 90 % VRAM) / fits.
- No tokens/s estimates — performance comes only from community benchmarks.
Tests: `tests/n2-estimates.test.mjs` (reproduces the README's Llama-3.1-8B sizes within 0.02 GiB).

## 4. Coverage

93 entities (90 `gpu`, 3 `vendor`), 969 facts (all `OFFICIAL`), 101 relations (93 `made_by`, 11
`successor_of`), 135 sources (134 `OFFICIAL`, 1 `ESTIMATE_METHOD`). The collector adds 20 `driver` entities at run time.

Per-file GPU coverage (number of GPUs having each property):
release_date / segment / architecture / vram_gb / memory_type / memory_bus_bits / memory_bandwidth_gbs /
shader_units / boost_clock_mhz / board_power_w / launch_price_usd / pcie

| File | GPUs | Facts | Sources | Coverage |
| --- | --- | --- | --- | --- |
| nvidia-rtx50.json (RTX 5090…5050) | 8 | 92 | 14 | 8 / 8 / 8 / 8 / 8 / 8 / 4 / 8 / 8 / 8 / 8 / 8 |
| nvidia-rtx40-30.json (RTX 4090…3050) | 22 | 238 | 29 | 20 / 22 / 22 / 22 / 22 / 22 / 1 / 22 / 22 / 22 / 19 / 22 |
| amd-radeon.json (RX 9070 XT…6600) | 26 | 283 | 41 | 19 / 26 / 26 / 26 / 26 / 26 / 26 / 26 / 24 / 26 / 20 / 12 |
| intel-arc.json (Arc B/A, Arc Pro B50–B70) | 12 | 134 | 17 | 7 / 12 / 12 / 12 / 12 / 12 / 12 / 12 / 12 / 12 / 7 / 12 |
| workstation.json (RTX PRO Blackwell, RTX Ada, Radeon PRO / AI PRO) | 22 | 216 | 30 | 17 / 22 / 22 / 22 / 22 / 20 / 21 / 20 / 3 / 22 / 3 / 22 |

`successor_of` rules: NVIDIA RTX 50 → 40 (7 links; NVIDIA's CES 2025 and RTX 5060 family articles compare each card with
its RTX 40 counterpart, and the 5060 Ti 8GB/16GB links go to the 4060 Ti with the same memory as an
inference), RTX 40 → 30 only for identical tier names (4090→3090, 4070 Ti→3070 Ti, 4070→3070, 4060 Ti 8GB→3060 Ti). There are no AMD,
Intel or workstation links, because no official source names a predecessor.

Naming (ko): NVIDIA uses "엔비디아 지포스 RTX …" (NVIDIA's ko-kr pages use "지포스 RTX" in running text,
product titles stay "GeForce"). AMD uses "AMD 라데온 RX …": AMD's Korean site writes "Radeon" in Latin letters,
so the Hangul form is the widely used transliteration and the Latin names are aliases. Intel uses
"인텔 Arc … 그래픽", as on Intel's Korean spec pages.

## 5. Known gaps / stale risks
- NVIDIA RTX 50 spec pages do not state memory bandwidth; 5090/5080/5070 Ti/5070 values come from NVIDIA's
  CES 2025 GeForce News article; 5060 Ti/5060/5050 bandwidth is omitted.
- NVIDIA spec tables say only "PCI Express Gen 5/4"; lane width is omitted where not stated.
- Product pages show current "Starting at" prices (often redacted as `$XXX.XX`); launch MSRP always comes
  from the launch announcement, never from the product page.
- `releases.json` covers NVIDIA's *data center* Linux driver branches; GeForce/Windows drivers are manual.
- NVIDIA 40/30 spec pages do not state bandwidth; the only 40/30 bandwidth value (4070 Ti SUPER) comes from
  the RTX 40 SUPER press release. NVIDIA workstation pages state no boost clock.
- Shared spec columns: the 3080 10/12GB, 3060 12/8GB and 4060 Ti 8/16GB values were assigned to variants by
  their order in NVIDIA's combined cells (e.g. 4060 Ti TGP "165 or 160" next to "16 GB or 8 GB"); each fact
  has a note saying so.
- Launch price and date are missing where the vendor published none: RX 9060 / 9050 / 9060 XT LP / 7700, RX 9060 XT
  dates, 7900 GRE price, Arc A380/A310, Arc Pro B50/B60, RTX 3080 12GB, 3060 8GB, and most workstation cards
  (their launch prices are rarely announced). The only official workstation prices are RTX 4000 SFF Ada, W7900 and W7800.
- Release dates: when the source gives only a season or quarter ("summer 2025", "Q2 2023"), we store
  year precision and quote the source text in the note. Rows where the vendor stated a month
  ("starting in April") use month precision.
- Newer SKUs found on official pages (not in training data): Arc Pro B65/B70 (Q1 2026), RX 9070 GRE global
  launch (2026-06-02, $549), RX 9050 8GB/4GB, RX 9060, RTX PRO 5500 Blackwell (page says "Coming Soon", specs
  preliminary), RTX PRO 5000 Blackwell 72GB, Radeon AI PRO R9700S/R9600D. There is no official page for an RTX 50 Super
  or an Arc B770 as of 2026-09-28.
- RX 7900 XT board power: the product page says 315 W and the 2022 launch release said 300 W. We store 315 W,
  and the note records the difference.
- Skipped: RX 7400 (in AMD's spec database, no desktop product page), RX 6700/6500 XT/6400 (out of this pass),
  mobile/embedded SKUs.
