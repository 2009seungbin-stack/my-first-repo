# Hardware utilities

Routes (Worker, PLATFORM=on): `/{ko,en}/hardware/used-prices/` and
`/{ko,en}/hardware/performance/`. Linked from the PC board, hardware hub, tool menu,
tool directory and hardware sitemap. No production D1 migration is required. Marketplace retrieval
needs provider credentials and permission; benchmark comparison does not.

## Country-specific used prices

Eight initial markets: KR/KRW, JP/JPY, US/USD, GB/GBP, DE/EUR, FR/EUR, CA/CAD, AU/AUD.
Country means the local marketplace/currency; it does not assert where the seller lives.
The manual price entry/calculator has been removed. Search results are fetched and rendered on the
server, with asking prices, source links, shipping cost (or unknown), retrieval time and distinct
empty/failure/not-connected states. The search works without browser JavaScript. Credentials never
reach browser code. No bulk-download API is provided.

**Operational state on 2026-10-03: no live marketplace is connected.** The eBay adapter is implemented
and tested with synthetic upstream responses in US/GB/DE/FR/CA/AU. Authenticated production data has
not been verified. KR and JP require a licensed source; they have no implemented adapter.
Do not describe this change as live automatic collection.

Cloudflare Pages setup (server environment only):
- `EBAY_APP_ID` and `EBAY_CERT_ID`: production application keyset stored as secrets.
- `EBAY_BROWSE_APPROVED=on`: set only after obtaining production Browse access and confirming the
  application meets contractual/display requirements. Keys alone do not prove approval. No sandbox
  or test listings are served to visitors.
- `EBAY_PRICE_STATS_APPROVED=on`: separate written permission for price statistics/derivation.
  Default off: display source-provided listing prices only. With permission, at least five matched
  listings are required for median and Q1–Q3. No suggested/modelled selling price is generated.

Requests use OAuth application tokens and the first 50 fixed-price, condition 3000 listings in the
selected country. Returned currency and item location must match. Model suffixes and requested GB
capacity must match. Titles exclude full systems, laptops, bundles, broken parts, boxes, sealed items,
wanted ads and duplicate IDs. This does not guarantee condition; accepted price outliers are kept.
Shipping is shown separately and never assumed free. No actual completed-sale prices are claimed.
Seller identities/profiles/photos are not retained. Titles (defensive 500-character cap) and source
URLs are displayed. A model-only search can include different memory capacities; specify GB when
needed. eBay listings are displayed separately from other providers and benchmark results.

Successful/empty snapshots expire after five minutes in the Worker isolate; failures after 30 seconds.
Concurrent searches share a request. HTML is `no-store` so it cannot extend the snapshot lifetime.
OAuth expiry has a 60-second margin and one refresh retry on access refusal. External calls have an
eight-second timeout and 1 MiB response limit. Cache hits do not consume request budgets. Misses use
the existing per-network 10/minute and isolate-wide 100/minute limiter. Without a Workers rate-limit
binding these are stopgap isolate limits, not an account-wide API quota. Verify quota/WAF/monitoring
before public activation.

Terms and documented access checked 2026-10-03:
- [Joongna terms](https://common.joongna.com/static/terms/TermsOfService_new.html?v=1741849515252),
  article 20: prior approval required for information reproduction/provision. Public HTML and robots
  allowance do not grant redistribution permission. No collector was activated.
- [eBay production requirements](https://developer.ebay.com/api-docs/buy/static/buy-requirements.html)
  and [API license](https://developer.ebay.com/join/api-license-agreement), sections 8/9: production
  access, content freshness/isolation and price-derivation restrictions.
- [Browse filters](https://developer.ebay.com/api-docs/buy/static/ref-buy-browse-filters.html),
  [supported marketplaces](https://developer.ebay.com/api-docs/buy/static/ref-marketplace-supported.html),
  [OAuth client credentials](https://developer.ebay.com/develop/guides/sell/authorization).
- [Mercari terms](https://static.jp.mercari.com/tos): no documented buyer-search API or licensed feed
  established in this work. No private endpoint or authenticated crawler implemented.

Public sources checked 2026-10-03:
- [Joongna search](https://web.joongna.com/search/RTX%204060): asking prices, including irrelevant
  full computers and adjacent model variants. Its aggregate is **not** a GPU part price.
- [Mercari search](https://jp.mercari.com/search?keyword=RTX%204060): reader checks sold/active filters.
- [eBay Advanced Search](https://www.ebay.com/sch/ebayadvsearch): active/sold searches.
- [eBay Browse API](https://developer.ebay.com/api-docs/buy/static/api-browse.html): listings discovery;
  credentials/production access are not configured. No sold-data API integration is claimed.
- Bunjang mobile search link is provided; live results require its client app/site and were not fetched.

Validation: `tests/n2-hardware-market.test.mjs` checks provider boundaries, parsing, credentials,
cache expiry/coalescing, permissions and errors. `tests/hardware-market-server.mjs` substitutes only
the eBay responses for the real SSR browser flow in `tests/hardware-tools-browser.py`: six currencies,
two unconnected markets, mobile/dark layouts and JavaScript-disabled browsing. Synthetic prices never
ship as content. These checks do not prove live provider access.

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

## Tool UI and GPU photographs

Tools reuse the portal's `chh` channel header, `mtabs` underline navigation, `cols` main/wiki layout
and `mt` comparison table. Main controls and measurements remain 14–15px or larger; two products
stay side by side on phones. Methodology, number-format details and image credits use native
details/summary. The rendering-only scope and automatic-feed status remain visible.

`platform/hardware-photos.js` maps five exact desktop GPU models to licensed real-board images:
RTX 3060, RTX 4060, RTX 4090, RX 6600 XT and Arc A770. Only explicit search aliases are accepted;
Ti, Laptop, D and different-memory aliases do not inherit another model's picture. Missing photos
are labelled in the comparison instead of substituting an unrelated card. These are labelled retail
board examples, not the actual measured submissions or an assertion of the submission's VRAM.

`assets/hardware/photos.json` records each source, author, license URL, downloaded thumbnail,
dimensions, byte count and SHA-256. Assets are unedited Wikimedia 960px thumbnails; their licenses
are separate from the site's code license. The UI's expandable credits link each author to the file
description and each license to its terms, with the original video link for the RTX 4060 still.
The RTX 4060 Commons file declares CC BY 3.0; its external-license review remains pending there.
No manufacturer-media blanket permission or manufacturer endorsement is claimed.
