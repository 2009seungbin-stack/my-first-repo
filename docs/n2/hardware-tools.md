# Hardware utilities

Routes (Worker, PLATFORM=on): `/{ko,en}/hardware/used-prices/` and
`/{ko,en}/hardware/performance/`. Linked from the PC board, hardware hub, tool menu,
tool directory and hardware sitemap. No production D1 migration or credentials required.

## Country-specific used prices

Eight initial markets: KR/KRW, JP/JPY, US/USD, GB/GBP, DE/EUR, FR/EUR, CA/CAD, AU/AUD.
Country means the local marketplace/currency; it does not assert where the seller lives.
Public search links only: Korea Joongna/Bunjang, Japan Mercari, the other markets' local eBay sites.
Do not scrape these sites or call their undocumented APIs. No automatic price feed is implemented.

Public sources checked 2026-10-03:
- [Joongna search](https://web.joongna.com/search/RTX%204060): asking prices, including irrelevant
  full computers and adjacent model variants. Its aggregate is **not** a GPU part price.
- [Mercari search](https://jp.mercari.com/search?keyword=RTX%204060): reader checks sold/active filters.
- [eBay Advanced Search](https://www.ebay.com/sch/ebayadvsearch): active/sold searches.
- [eBay Browse API](https://developer.ebay.com/api-docs/buy/static/api-browse.html): listings discovery;
  credentials/production access are not configured. No sold-data API integration is claimed.
- Bunjang mobile search link is provided; live results require its client app/site and were not fetched.

The calculator uses up to 200 reader-supplied local prices, one per line. It rejects invalid grouping,
foreign explicit currency labels, zero/negative amounts and ranges. No FX mixing/conversion.
Displays median, interpolated Q1–Q3, minimum/maximum and count. No automatic outlier removal.
Asking vs sold displayed prices and condition are reader-selected; the calculation cannot verify them.
Prices are held in the page, not persisted or sent to a marketplace/price service. Changing the
country reloads the form. The page explains matching model, VRAM, working condition and shipping.

## Performance data

Source: [Blender Open Data](https://opendata.blender.org/about/), documented daily
[raw snapshot](https://opendata.blender.org/snapshots/opendata-latest.zip). Archive README and
LICENSE explicitly apply CC0-1.0 to the data. Only device names, backend, score, sample count,
snapshot date and archive SHA-256 are retained; no submission user information is distributed.

Pinned benchmark: Blender 4.5.0, monster/junkshop/classroom. A submission must have all three scenes,
the same device and version, one compute device and one CPU socket, and finite positive
`samples_per_minute` for each scene. Deduplicate submission IDs, sum the three scene scores, then
take the median by exact device name and backend. Require at least 3 complete submissions.
OSes are pooled; clock, power, drivers and cooling are uncontrolled. Small samples (<10) are marked.
This is a **Cycles rendering** measure, not gaming FPS, CPU single-core or AI inference. Different
backends are labelled and their optimization differences explicitly disclosed. Device names are
not fuzzy-merged (VRAM/laptop variants may differ). The source snapshot date is always visible;
older than 30 days is historical. Optional purchase-price value uses the same local currency.

Update (reviewable code/data diff, no production writes):

```
node tools/platform/update-hardware-benchmarks.mjs
python tests/hardware-benchmarks-test.py
node --test tests/n2-hardware-tools.test.mjs
npm run typecheck
```

Or download the documented archive manually and run:
`python tools/platform/hardware-benchmarks.py archive.zip`.
Refresh is manual; no scheduled collector is claimed. Never replace the pinned version without
checking coverage and updating the methodology. The generated `data/hardware/blender.js` bundles
with the Worker; user comparisons do not trigger upstream requests.
