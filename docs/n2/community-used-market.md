# Community sale-post collector — 2026-10-03

The implemented collector reads public first posts or advertised RSS and stores only normalized
model, capacity, displayed price, shipping basis, source URL and observation history. No post bodies,
author identifiers, contacts or seller images are retained. Public access is not a licence to repost
forum text, so the site displays factual price observations with attribution and links.

## Implemented operation

- `collectors/_hardware-market/{collect,parse}.js`: three allowlisted sources; robots on every run;
  bounded HTTPS GETs, 1 MiB responses, 15-second timeouts, one-second pacing; only validated Giggle
  canonical post redirects are followed. HTTP 403/429 stops that source, without a bypass.
- Giggle: first three category pages; Hardware.fr: first sale-board page. At most twelve matching
  first posts per source per run. HardForum: up to thirty public RSS entries, using `content:encoded`;
  protected thread HTML is never requested. This is bounded sampling, not whole-market coverage.
- First-post/body sections bind models to one unambiguous currency price. Wanted ads, complete PCs,
  bundles, quantities, new/broken items, conflicting capacities/prices and corrupted text are rejected.
  Struck old prices and comment prices are excluded. No AI guess or outlier trimming is used.
- `platform/hardware-community.js` + migration 0015: stable source/post/model/capacity identity,
  price/status revisions, ETag/Last-Modified conditional post requests, source health. 304 verification
  does not change price observation time or sample count. Deleted/replaced first-post items retire;
  disappearing from a board/feed alone is not treated as sold. Failed sources do not commit partial facts.
- Search reads D1, never triggers collection. 7/30/90-day filters mean first observation or factual
  price/status change, **not** transaction date. Sold results require a previously observed asking item.
  Verification must be within three days and source must have succeeded. Minimum median sample is five
  identical model/capacity/shipping-basis observations. Unknown GPU capacity prevents aggregation.
- Same-post observations deduplicate; reposts and cross-site ads may still duplicate an item. Facts,
  revisions and fetch validators age out after 180 days. Country groups the community/currency and
  does not guarantee seller residence. US is the USD HardForum bucket, not geolocation evidence.
- `.github/workflows/hardware-market.yml` runs hourly at minute 23 with existing collector secrets;
  scheduled Actions may be delayed. Each source is fetched once and persisted to preview then prod.
  `node tools/platform/collect-hardware-market.mjs --sqlite test-results/market.sqlite` is a live local
  run; `--d1` uses existing D1 targets. Without a persistence flag it prints normalized observations only.
- The collector initializes only the idempotent 0015 schema; it does not reapply unrelated migrations.

Validation: deterministic parser/robots/failure/persistence/304/statistics tests, ko/en responsive
browser checks with isolated synthetic fixtures, and actual anonymous local collection on 2026-10-03.
The live run accepted one Giggle, one HardForum and five Hardware.fr observations; two French archive
items were already sold and are therefore hidden from recent sold results. Counts are a sample of
that run, not a fixed catalogue or evidence of completed transactions. Production rollout is verified
separately through CI, workflow runs and live HTTP checks.

## Sources actually checked

| Candidate | Observed public access | Suitability / limit |
| --- | --- | --- |
| KR: Giggle Hardware, community board's market category | `https://gigglehd.com/gg/index.php?mid=bbs&category=14058` returned 200, with sale/buy/bundle/completed titles. Board advertises `https://gigglehd.com/gg/bbs/rss` and `/bbs/atom`; the RSS was verified but contains unrelated categories; the collector therefore uses the category board. `https://gigglehd.com/robots.txt` allows the general crawler group. Site terms at `/gg/133042` were read. | First Korean pilot candidate. Whole community board RSS must be filtered to the market category. Recent first-page inventory contains few GPU/CPU standalone sales; one board alone will not guarantee usable sample sizes. Terms read did not establish an explicit redistribution licence. |
| HardForum For Sale / Trade | `https://hardforum.com/forums/for-sale-trade.17/index.rss` returned 200 RSS XML with titles, links, dates and partial first-post bodies. HTML board returned 403 challenge; no challenge bypass attempted. Terms were read through the web tool at `https://hardforum.com/help/terms/`. | Public feed is a practical discovery source. Excerpts can expose a component and asking price, but many truncate before the price or contain several items. USD does not prove seller country; the UI explicitly groups by USD community rather than asserting seller country. RSS availability does not authorize all commercial reuse. |
| FR: Hardware.fr Achats & Ventes / Hardware | `https://forum.hardware.fr/hfr/AchatsVentes/Hardware/liste_sujet-1.htm` and one linked sale thread were publicly readable. Robots disallows `/search.php`, `/forum1.php`, `/forum2.php`, profile and account endpoints; the observed `/hfr/` board/thread paths are different. | Public canonical board/thread discovery works. Multi-year threads are repeatedly edited to sell new items, so first-post version and edit date matter much more than thread creation or last reply. Commercial collection/display permission still needs source-specific review. |
| KR: 2CPU | Robots and sale-list URL responded. Charset is EUC-KR. Robots includes a GPTBot exclusion. | Requires correct decoding and a collection-policy review; not selected for collection. |
| KR: Coolenjoy | Robots disallows the general crawler group. | Excluded from the automatic pilot under the observed rules. |
| KR: Quasarzone | Robots request returned 403. | Access/policy not established. Do not assume unrestricted collection or bypass a block. |
| Reddit / hardwareswap | Public Atom feed returned 200, but robots disallows general crawling and points to Reddit's Public Content Policy. | Feed access alone does not establish approval for this site's commercial collection. Not a free unrestricted fallback. |
| UK: AVForums | Robots explicitly prohibits automated data mining/scraping without prior written permission. | Excluded until that permission exists. |

Saved access-probe responses are ignored local evidence under `test-results/community-market/`.
No phone numbers, author identities, account cookies, images or full forum bodies will be published.

## A real parsing failure to design around

Observed French thread:
`https://forum.hardware.fr/hfr/AchatsVentes/Hardware/corsair-frame-4000d-sujet_653233_1.htm`

Its first post was created in 2015 and edited in September 2026. The current first-post listing names
a PNY RTX 5070 Ti with an asking price of EUR 1,050 excluding shipping, and separately a case at EUR
80 excluding shipping. Replies dating to 2015 discuss prices around EUR 270 for an earlier item.
A page-wide price regex would assign the case/old-comment price to the GPU and produce false stats.
These are observed asking amounts, not verified completed transactions or a current market valuation.

The HardForum RSS also contains full-PC prices and wanted ads. A USD 750 complete PC mentioning RTX
3080 cannot become a USD 750 RTX 3080 sample. Feed publication/update timestamps may reflect thread
activity; they must not automatically be treated as item/price edit dates.

