# Public search and agent discovery

`tools/search-discovery.mjs` creates two navigation files from the final build outputs:

- `/llms.txt`: a compact guide to the tools directory, the shipped Lab entry points, image/PDF/media tools, policies and the public inventories. Titles and descriptions come from the canonical English pages; the tools directory is linked in Korean, English and Japanese.
- `/search-discovery.json`: each localized static sitemap candidate's self-canonical URL, language, title, description, group and known content modification date. It is a route index, not a copy of every page's text. Live community and channel entries remain discoverable through `/sitemap.xml` and the Worker sitemaps.

The sitemap registry remains the source of candidates. The emitted HTML remains the source of metadata and the final inclusion decision. `noindex`, canonical aliases, conflicting canonicals, app shells and private routes cannot enter the inventory. Preview builds and builds without `SITE_URL` generate neither file. The build fails clearly when an expected emitted page cannot be read or a canonical page lacks its title or description.

Dates reuse the sitemap content ledger (or the guide registry's content date); missing dates remain absent. Build time never becomes a content date. With the community platform enabled, the English and Korean tool directory URLs are `/en/tools/` and `/ko/tools/`, so the index does not describe the Worker portal as the game studio. Service pricing appears only when the build actually emits its indexable pages.

Build integration runs after service pages are emitted:

```js
for (const [file, contents] of Object.entries(await searchDiscoveryFiles(
  config.preview ? '' : siteURL,
  {
    readPage: route => readFile(path.join(dist, route, 'index.html'), 'utf8'),
    extra: config.service && config.metering !== false ? ['pricing'] : [],
    lastmod,
  },
))) await writeFile(path.join(dist, file), contents);
```

`searchDiscoveryLinks(siteURL)` returns the optional HTML `rel="describedby"` pointer to `/llms.txt`; pass an empty origin for previews. The public guide and JSON routes can be served as static files. Avoid wrapping them in authentication or app navigation. A JSON fetch or a guide read is metadata discovery, not a human page view.

This guide is an optional convenience for agents. The [llms.txt proposal](https://llmstxt.org/) describes a curated overview used to find relevant content. It is not a search indexing contract or a promised ranking improvement. [Google's guidance for AI features in Search](https://developers.google.com/search/docs/appearance/ai-features) applies the normal crawlability, indexing and content-quality requirements; additional AI text files or special schema are not required.

`robots.txt` continues to control crawling. Search retrieval crawlers and model training crawlers can have separate identities and policies; publishing a navigation file does not change either policy. This change adds no crawler exceptions and grants no additional access to private content.

Verify with `node --test tests/search-discovery.test.mjs`, then inspect the production files after deployment. Check their canonical URLs against the live XML sitemap and confirm that a preview build omits both files. Do not interpret file generation, crawler requests or IndexNow submission as evidence that a search engine indexed or cited a page.

## Portal metadata and validation

The portal uses one connected JSON-LD graph per indexable page. Entity pages retain their collection and breadcrumb nodes; human discussions and answered questions retain their forum/Q&A metadata. Collected Radar posts identify the site publisher without claiming how the original source was created. Text and dates come from the rendered content and stored records.

`entityIndexable` applies the same per-language content gate to channel robots metadata and the Worker sitemap. Alternate links include only indexable translations. Filtered channel views remain noindex. The sitemap lists local-LLM pages only when a GPU has the VRAM value required to render that page.

Validation commands:

```text
node --test tests/search-discovery.test.mjs tests/indexnow.test.mjs tests/platform-seo.test.mjs
npm run typecheck
node tools/audit-platform-seo.mjs
python tests/platform-seo-browser.py
python tools/regression.py
python tests/platform-browser.py
python tests/service-browser.py
```

The platform audit renders every canonical URL in freshly seeded local Worker sitemaps and checks status, robots, canonical identity, document-head metadata and reciprocal language alternates. The browser check exercises Korean/English discovery links without client JavaScript at 1440, 390 and 320 pixels, and saves screenshots under `test-results/platform-seo-browser/`.

IndexNow compares static build inventories separately from live D1 sitemaps. It waits for the deployed commit and matching static inventory before notifying additions, content-date changes and removals. This does not submit D1-only content changes or promise indexing.
