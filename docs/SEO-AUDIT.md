# Built-site SEO validation

Build with the intended canonical origin, then inspect the actual generated HTML:

```powershell
$env:SITE_URL='https://nerulio.com'
npm run build
python tools/audit-seo.py
```

The dependency-free audit follows the sitemap index and checks every indexable page for a self canonical, one title and H1, a description, absence of noindex, reciprocal Korean/English/Japanese/x-default alternatives, existing internal link targets, and image alt attributes. It writes `test-results/seo-audit.json` and exits nonzero on errors. The full regression runs this audit and a negative fixture proving that broken canonicals, internal links and accidental noindex are rejected.

Run `node tools/lastmod.mjs --write` after changing public page content. Unchanged pages retain their timestamps. Run `python tools/regression.py` for syntax, unit, build and HTTP/browser validation, including policy branding after JavaScript runs and language switches.

The root home is intentionally language-adaptive and is the x-default; `/en/` is the explicit English home. Do not merge their canonicals. Studio application routes remain noindex; searchable guides and tool pages remain in the sitemap.

These checks verify technical prerequisites. They do not establish Google indexing, rankings, backlinks, or real-user Core Web Vitals. Measure Lighthouse/PageSpeed separately on the deployed URL and report the tested page, device, date and scores. A Lighthouse SEO score of 100 is not a comprehensive content or search-traffic score.
