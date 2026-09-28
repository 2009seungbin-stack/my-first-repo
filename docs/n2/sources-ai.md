# AI vertical — sources, collectors and coverage

Branch `nerulio/n2-data-ai`. Research and retrieval date for every curated fact: **2026-09-28**.
Seed files: `data/seed/ai/{openai,anthropic,google,open-models,runtimes}.json` (format: `docs/n2/SEED-FORMAT.md`).

## 1. Coverage (launch seed)

<!-- COVERAGE -->

All curated facts are `OFFICIAL` (maker's own docs, pricing/help pages, model cards on the maker's own
Hugging Face org / GitHub, official blogs, official runtime docs/library pages). Nothing in the seed is
`COMMUNITY` or `ESTIMATE`. Currency is never converted: USD rows are US storefront prices, KRW rows are what
the official page displayed to a browser in Korea. Tax/VAT is mentioned in a `note` only where the page says it.
No usage limit (messages per hour etc.) is stored anywhere; pages that say "limits vary" stay unquantified.

## 2. Automated collectors

| Adapter | Source (host) | Access method | Documented? | Robots / terms | Cadence | Output |
| --- | --- | --- | --- | --- | --- | --- |
| `openai-status` | status.openai.com (incident.io) | `GET /api/v2/incidents.json` (times, impact), `GET /feed.atom` (affected components), `GET /proxy/status.openai.com` (component → group structure) | Atom feed is linked from the status page; the JSON endpoints were **observed responding** (incident.io serves Statuspage-compatible `/api/v2` JSON and a public read-only "Widget API", docs.incident.io/status-pages/api) | robots.txt → 404 (no rules) | hourly, 3 requests | incidents → `events` (kind `other`) linked to `service:chatgpt` / `service:openai-api` / `service:codex` by component group, models by name; else `provider:openai` |
| `claude-status` | status.claude.com (Atlassian Statuspage) | `GET /history.atom` | linked from the status page ("Subscribe → Atom") | robots.txt **disallows `/api/`** → the Statuspage JSON API is deliberately not used | hourly, 1 request | incidents → `events`; services inferred from explicit product names in the text (Claude Code, claude.ai, API/Console, Cowork), models by name/API id; else `provider:anthropic`. The feed has no component list or impact level. |
| `openai-api-changelog` | developers.openai.com | `GET /api/docs/changelog.md` | yes — the page states Markdown versions are available by appending `.md` | `Allow: /` | daily, 1 request | dated entries → `events` (`release`/`update`), `Model:` tags → model entities; unknown model ids reported in `unmatched_models` |
| `claude-release-notes` | platform.claude.com | `GET /docs/en/release-notes/overview.md` | yes — docs pages are served as `.md` (front matter names the canonical URL) | disallows `/api/` only | daily, 1 request | one `event` per bullet; backticked API ids first, names as fallback; else `service:claude-api` |
| `gemini-api-changelog` | ai.google.dev | `GET /gemini-api/docs/changelog.md.txt` | yes — ai.google.dev serves a Markdown export of every docs page | nothing disallowed | daily, 1 request | one `event` per top-level item; backticked model codes → models; else `service:gemini-api` |
| `github-releases` | api.github.com | `GET /repos/{o}/{r}/releases?per_page=10` + `GET /repos/{o}/{r}/releases/latest` for ggml-org/llama.cpp, ollama/ollama, vllm-project/vllm | yes (GitHub REST docs) | API terms; unauthenticated 60 req/h per IP | every 12 h, 6 requests | partial entity updates: `latest_version` (= /releases/latest, newer pre-release named in the note) + last 5 `versions` |
| `ai-plans-manual` | — | `mode:'manual'` (MANUAL_SOURCE) | — | — | curator, ≤14 days | nothing fetched; see §3 |

Shared pure helpers (Atom parsing, name/API-id matching, date parsing) live in `collectors/_ai-shared/util.js`
(no `index.js`, so `collect.mjs` does not treat it as an adapter).

Every adapter only emits entity ids that exist in the seed: fixed service/provider ids are asserted against
`data/seed/ai` by the unit tests (`tests/n2-collector-*.test.mjs`, recorded fixtures under
`tests/fixtures/n2/collectors/<adapter>/`, no network).

### Event shape used by the AI collectors
`EVENT_KINDS` has no `incident`, so incidents are `kind:'other'`. Adapters add keys the validator ignores and
the ingest pipeline should read (see "Suggested core changes"): `key` (stable dedupe key, e.g.
`openai-status:01M3…`), `status` (`ended` when resolved, else `confirmed`), `impact` (OpenAI only:
none/minor/major/critical), `components` (OpenAI component names), `note`, `unmatched_models`.

### Live run 2026-09-28 (`node tools/platform/collect.mjs --adapter <id> --limit 5`)
<!-- LIVE -->

## 3. MANUAL_SOURCE — why pricing and plans are not scraped
- **Consumer plan pages** (chatgpt.com/pricing, claude.com/pricing, gemini.google/subscriptions, Google One)
  are client-rendered and **geo-dependent**: currency, and sometimes the plan list, follow the visitor's
  country. A CI runner would record its own country, not US/KR. chatgpt.com/pricing also answered 403 to
  non-browser fetches. No documented API or feed exists.
- **API price tables** (developers.openai.com/api/docs/pricing, platform.claude.com/docs/en/about-claude/pricing,
  ai.google.dev/gemini-api/docs/pricing) are documentation tables whose layout changes without notice; promotional
  prices, long-context tiers and cache-write prices sit in prose. A parser would drift silently. Price changes are
  surfaced by the three changelog adapters, and a curator updates the seed from the official page.
- **Help-center availability matrices** (plan × feature × platform) are HTML articles with no feed.

## 4. Source inventory (curated seed)
<!-- INVENTORY -->

## 5. Known gaps, conflicts and staleness
<!-- GAPS -->

## 6. Suggested core changes
<!-- CORE -->
