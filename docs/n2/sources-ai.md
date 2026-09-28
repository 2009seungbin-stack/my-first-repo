# AI vertical — sources, collectors and coverage

Branch `nerulio/n2-data-ai`. Research and retrieval date for every curated fact: **2026-09-28**.
Seed files: `data/seed/ai/{openai,anthropic,google,open-models,runtimes}.json` (format: `docs/n2/SEED-FORMAT.md`).

## 1. Coverage (launch seed)

<!-- COVERAGE -->
| File | Entities | Facts | Relations | Availability | Versions | Sources |
| --- | --- | --- | --- | --- | --- | --- |
| `anthropic.json` | 1 provider, 15 model, 4 service, 7 plan, 15 feature | 212 | 52 | 104 | 0 | 40 |
| `google.json` | 1 provider, 19 model, 6 service, 5 plan, 11 feature | 249 | 54 | 85 | 0 | 57 |
| `open-models.json` | 42 model, 5 provider | 369 | 115 | 0 | 0 | 60 |
| `openai.json` | 1 provider, 24 model, 3 service, 7 plan, 13 feature | 305 | 66 | 65 | 0 | 49 |
| `runtimes.json` | 4 runtime | 19 | 0 | 0 | 21 | 36 |
| **Total** | **183** (8 provider, 100 model, 13 service, 19 plan, 39 feature, 4 runtime) | **1154** | **287** | **254** | **21** | **242** |

Relations by predicate: offers 13, made_by 100, successor_of 10, has_plan 19, part_of 40, includes_model 31, runs_on 72, variant_of 2.

Access method for every curated source: a Claude research agent opened the page (WebFetch, curl of the official Markdown/`.md.txt` export, or a real browser tab in Korea for the KR storefront) on 2026-09-28. Automated refresh of these pages is **manual** (see §3); the changelog/status/release adapters in §2 are the automated layer on top.

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
All adapters: `error: null`, `validation: []`.

| Adapter | HTTP | Output | Full-target run (no `--limit`): links to models |
| --- | --- | --- | --- |
| `openai-status` | 3× 200 (36 KB JSON, 86 KB Atom, 10.5 KB widget) | 25 incident events (≈120-day window) | 3 incidents linked to models; services by component group |
| `claude-status` | 1× 200 (36 KB Atom) | 25 incident events | 10 linked to models |
| `openai-api-changelog` | 1× 200 (71 KB) | 54 events (180-day window) | 14 linked; 21 model ids not in the seed are reported in `unmatched_models` (e.g. gpt-live-1, gpt-image-2.5-flare, transcription models) |
| `claude-release-notes` | 1× 200 (113 KB) | 80 events (cap) | 27 linked |
| `gemini-api-changelog` | 1× 200 (59 KB) | 42 events | 12 linked |
| `github-releases` | 6× 200 | 3 partial runtime entities: llama.cpp v0.5.0 (newer nightly b11229 in note), Ollama v0.34.4 (v0.40.0-rc0 in note), vLLM v0.30.0; 5–6 versions each | — |
| `ai-plans-manual` | — | manual (no fetch) | — |

On Windows, `collect.mjs` prints `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` after some runs (Node
closing undici handles during `process.exit`); the JSON report and output are complete before it.

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
Grouped by host; every entry was retrieved 2026-09-28. Kinds: OFFICIAL unless noted.

### `anthropic.json` (40 sources)

- **platform.claude.com** (20, OFFICIAL): [Models overview (Claude Platform docs)](https://platform.claude.com/docs/en/about-claude/models/overview) · [Pricing (Claude Platform docs)](https://platform.claude.com/docs/en/about-claude/pricing) · [Model deprecations (Claude Platform docs)](https://platform.claude.com/docs/en/about-claude/model-deprecations) · [Claude Platform release notes](https://platform.claude.com/docs/en/release-notes/overview) · [Claude Fable 5.1 (Claude Platform docs model page)](https://platform.claude.com/docs/en/models/fable-5-1/overview) · [Claude Mythos 5.1 (Claude Platform docs model page)](https://platform.claude.com/docs/en/models/mythos-5-1/overview) · [Claude Opus 5.5 (Claude Platform docs model page)](https://platform.claude.com/docs/en/models/opus-5-5/overview) · [Claude Sonnet 5 (Claude Platform docs model page)](https://platform.claude.com/docs/en/models/sonnet-5/overview) · [Claude Haiku 4.5 (Claude Platform docs model page)](https://platform.claude.com/docs/en/models/haiku-4-5/overview) · [Claude Fable 5 (Claude Platform docs model page)](https://platform.claude.com/docs/en/models/fable-5/overview) · [Claude Mythos 5 (Claude Platform docs model page)](https://platform.claude.com/docs/en/models/mythos-5/overview) · [Claude Opus 5 (Claude Platform docs model page)](https://platform.claude.com/docs/en/models/opus-5/overview) · [Claude Opus 4.8 (Claude Platform docs model page)](https://platform.claude.com/docs/en/models/opus-4-8/overview) · [Claude Opus 4.7 (Claude Platform docs model page)](https://platform.claude.com/docs/en/models/opus-4-7/overview) · [Claude Opus 4.6 (Claude Platform docs model page)](https://platform.claude.com/docs/en/models/opus-4-6/overview) · [Claude Sonnet 4.6 (Claude Platform docs model page)](https://platform.claude.com/docs/en/models/sonnet-4-6/overview) · [Claude Opus 4.5 (Claude Platform docs model page)](https://platform.claude.com/docs/en/models/opus-4-5/overview) · [Claude Sonnet 4.5 (Claude Platform docs model page)](https://platform.claude.com/docs/en/models/sonnet-4-5/overview) · [Fast mode (research preview) (Claude Platform docs)](https://platform.claude.com/docs/en/build-with-claude/fast-mode) · [Computer use tool (Claude Platform docs)](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool)
- **www.anthropic.com** (7, OFFICIAL): [Anthropic Privacy Policy](https://www.anthropic.com/legal/privacy) · [Claude Opus 4.1 (Anthropic news, 2025-08-05)](https://www.anthropic.com/news/claude-opus-4-1) · [Claude 2 (Anthropic news, 2023-07-11)](https://www.anthropic.com/news/claude-2) · [Introducing Claude (Anthropic news, 2023-03-14)](https://www.anthropic.com/news/introducing-claude) · [Claude 3.7 Sonnet and Claude Code (Anthropic news, 2025-02-24)](https://www.anthropic.com/news/claude-3-7-sonnet) · [Collaborate with Claude on Projects (Anthropic news, 2024-06-25)](https://www.anthropic.com/news/projects) · [Introducing computer use, a new Claude 3.5 Sonnet, and Claude 3.5 Haiku (Anthropic news, 2024-10-22)](https://www.anthropic.com/news/3-5-models-and-computer-use)
- **claude.com** (7, OFFICIAL): [Plans & Pricing  Claude by Anthropic](https://claude.com/pricing) · [플랜 및 요금제  Claude by Anthropic (Korean)](https://claude.com/ko/pricing) · [Claude Cowork and chat are now one Claude (Claude blog, 2026-09-16)](https://claude.com/blog/cowork-is-now-claude) · [Claude Cowork product page](https://claude.com/product/cowork) · [Claude takes research to new places (Claude blog, 2025-04-15)](https://claude.com/blog/research) · [Claude web search now available globally on all plans (Claude blog)](https://claude.com/blog/web-search) · [Introducing web search on the Anthropic API (Claude blog, 2025-05-07)](https://claude.com/blog/web-search-api)
- **support.claude.com** (3, OFFICIAL): [What is the Max plan? (Claude Help Center)](https://support.claude.com/en/articles/11049741-what-is-the-max-plan) · [Release notes (Claude Help Center, Claude apps)](https://support.claude.com/en/articles/12138966-release-notes) · [Claude Fable models on your plan (Claude Help Center)](https://support.claude.com/en/articles/15424964-claude-fable-models-on-your-plan)
- **code.claude.com** (2, OFFICIAL): [Claude Code overview (Claude Code docs)](https://code.claude.com/docs/en/overview) · [Use Claude Code in the cloud (Claude Code docs)](https://code.claude.com/docs/en/claude-code-on-the-web)
- **status.claude.com** (1, OFFICIAL_API): [Claude status page components (status.claude.com)](https://status.claude.com/api/v2/components.json)

### `google.json` (57 sources)

- **ai.google.dev** (26, OFFICIAL): [Gemini API — Models](https://ai.google.dev/gemini-api/docs/models) · [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing) · [Gemini API — Release notes](https://ai.google.dev/gemini-api/docs/changelog) · [Gemini API — Deprecations](https://ai.google.dev/gemini-api/docs/deprecations) · [Gemini API model page — gemini-3.8-flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash) · [Gemini API model page — gemini-3.7-flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.7-flash) · [Gemini API model page — gemini-3.6-flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.6-flash) · [Gemini API model page — gemini-3.5-flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash) · [Gemini API model page — gemini-3.5-flash-lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite) · [Gemini API model page — gemini-3.1-flash-lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite) · [Gemini API model page — gemini-3.1-pro-preview](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-pro-preview) · [Gemini API model page — gemini-3-flash-preview](https://ai.google.dev/gemini-api/docs/models/gemini-3-flash-preview) · [Gemini API model page — gemini-3.8-live](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-live) · [Gemini API model page — gemini-3.8-live-extended-thinking](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-live-extended-thinking) · [Gemini API model page — gemini-3.8-flash-tts](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash-tts) · [Gemini API model page — gemini-3.8-flash-lite-tts](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash-lite-tts) · [Gemini API model page — gemini-3.1-flash-image](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-image) · [Gemini API model page — gemini-3-pro-image](https://ai.google.dev/gemini-api/docs/models/gemini-3-pro-image) · [Gemini API model page — gemini-2.5-pro](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-pro) · [Gemini API model page — gemini-2.5-flash](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash) · [Gemini API model page — gemini-2.5-flash-lite](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-lite) · [Gemini API model page — gemini-2.5-flash-image](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-image) · [Gemini API model page — gemini-omni-flash](https://ai.google.dev/gemini-api/docs/models/gemini-omni-flash) · [Gemini API documentation](https://ai.google.dev/gemini-api/docs) · [Gemini Deep Research agent (Gemini API)](https://ai.google.dev/gemini-api/docs/deep-research) · [Antigravity Agent (Gemini API)](https://ai.google.dev/gemini-api/docs/antigravity-agent)
- **gemini.google** (11, OFFICIAL): [Google AI Pro & Ultra — Gemini subscriptions (United States)](https://gemini.google/us/subscriptions/?hl=en) · [Google AI Pro 및 Ultra — Gemini 구독 (대한민국)](https://gemini.google/kr/subscriptions/?hl=ko) · [Gemini Deep Research](https://gemini.google/us/overview/deep-research/?hl=en) · [Gemini Live](https://gemini.google/us/overview/gemini-live/?hl=en) · [Gemini Canvas](https://gemini.google/us/overview/canvas/?hl=en) · [Gems](https://gemini.google/us/overview/gems/?hl=en) · [Image generation in Gemini (Nano Banana 2)](https://gemini.google/us/overview/image-generation/?hl=en) · [Gemini Omni — video generation](https://gemini.google/us/overview/video-generation/?hl=en) · [Lyria 3.5 music generation in Gemini](https://gemini.google/us/overview/music-generation/?hl=en) · [Gemini Spark](https://gemini.google/us/overview/agent/spark/?hl=en) · [Gemini in Chrome](https://gemini.google/us/overview/gemini-in-chrome/?hl=en)
- **deepmind.google** (6, OFFICIAL): [Gemini 3.8 Flash model card](https://deepmind.google/models/model-cards/gemini-3-8-flash/) · [Gemini 3.7 Flash model card](https://deepmind.google/models/model-cards/gemini-3-7-flash/) · [Gemini 3.6 Flash model card](https://deepmind.google/models/model-cards/gemini-3-6-flash/) · [Gemini 3.5 Flash-Lite model card](https://deepmind.google/models/model-cards/gemini-3-5-flash-lite/) · [Gemini 3.8 Audio model card](https://deepmind.google/models/model-cards/gemini-3-8-audio/) · [Gemini 3.1 Flash Image model card](https://deepmind.google/models/model-cards/gemini-3-1-flash-image/)
- **blog.google** (4, OFFICIAL): [Bard becomes Gemini: Try Ultra 1.0 and a new mobile app today (Feb 8, 2024)](https://blog.google/products/gemini/bard-gemini-advanced-app/) · [Gemini API and more new AI tools for developers and enterprises (Dec 13, 2023)](https://blog.google/technology/ai/google-gemini-pro-imagen-duet-ai-update/) · [Jules, our asynchronous coding agent, is now available for everyone (Aug 6, 2025)](https://blog.google/technology/google-labs/jules-now-available/) · [Gemini CLI: your open-source AI agent (Jun 25, 2025)](https://blog.google/technology/developers/introducing-gemini-cli-open-source-ai-agent/)
- **support.google.com** (2, OFFICIAL): [Get started with the Gemini mobile app - Gemini Apps Help](https://support.google.com/gemini/answer/14554984?hl=en) · [Use Gemini Spark to manage your tasks & workflows in Gemini Apps - Gemini Apps Help](https://support.google.com/gemini/answer/17094507?hl=en)
- **jules.google** (2, OFFICIAL): [Jules - An Autonomous Coding Agent](https://jules.google/) · [Jules changelog](https://jules.google/docs/changelog/)
- **careers.google.com** (1, OFFICIAL): [Mountain View (Global HQ) - Google Careers](https://careers.google.com/locations/mountain-view/)
- **ai.google** (1, OFFICIAL): [Google AI](https://ai.google/)
- **aistudio.google.com** (1, OFFICIAL): [Google AI Studio and the Gemini API Status](https://aistudio.google.com/status)
- **github.com** (1, OFFICIAL): [google-gemini/gemini-cli (GitHub)](https://github.com/google-gemini/gemini-cli)
- **antigravity.google** (1, OFFICIAL): [Download Google Antigravity](https://antigravity.google/download)
- **one.google.com** (1, OFFICIAL): [Cloud Storage가 포함된 Google AI 요금제 - Google One (대한민국)](https://one.google.com/about/google-ai-plans/?hl=ko)

### `open-models.json` (60 sources)

- **huggingface.co** (25, OFFICIAL): [openai/gpt-oss-20b](https://huggingface.co/openai/gpt-oss-20b) · [openai/gpt-oss-120b](https://huggingface.co/openai/gpt-oss-120b) · [Qwen/Qwen3.8-2.4T-A95B model card](https://huggingface.co/Qwen/Qwen3.8-2.4T-A95B) · [Qwen/Qwen3.8-27B model card](https://huggingface.co/Qwen/Qwen3.8-27B) · [Qwen/Qwen3.8-Flash-Next model card](https://huggingface.co/Qwen/Qwen3.8-Flash-Next) · [Qwen/Qwen3.6-27B model card](https://huggingface.co/Qwen/Qwen3.6-27B) · [Qwen/Qwen3.6-35B-A3B model card](https://huggingface.co/Qwen/Qwen3.6-35B-A3B) · [Qwen/Qwen3.5-397B-A17B model card](https://huggingface.co/Qwen/Qwen3.5-397B-A17B) · [Qwen/Qwen3.5-122B-A10B model card](https://huggingface.co/Qwen/Qwen3.5-122B-A10B) · [Qwen/Qwen3.5-27B model card](https://huggingface.co/Qwen/Qwen3.5-27B) · [Qwen/Qwen3.5-9B model card](https://huggingface.co/Qwen/Qwen3.5-9B) · [Qwen/Qwen3.5-4B model card](https://huggingface.co/Qwen/Qwen3.5-4B) · [Qwen/Qwen3-Coder-Next model card](https://huggingface.co/Qwen/Qwen3-Coder-Next) · [google/gemma-4-31B-it model card (covers all Gemma 4 sizes)](https://huggingface.co/google/gemma-4-31B-it) · [mistralai/Mistral-Medium-3.5-128B model card](https://huggingface.co/mistralai/Mistral-Medium-3.5-128B) · [mistralai/Mistral-Small-4-119B-2603 model card](https://huggingface.co/mistralai/Mistral-Small-4-119B-2603) · [mistralai/Mistral-Large-3-675B-Instruct-2512 model card](https://huggingface.co/mistralai/Mistral-Large-3-675B-Instruct-2512) · [mistralai/Ministral-3-14B-Instruct-2512 model card](https://huggingface.co/mistralai/Ministral-3-14B-Instruct-2512) · [mistralai/Ministral-3-8B-Instruct-2512 model card](https://huggingface.co/mistralai/Ministral-3-8B-Instruct-2512) · [mistralai/Ministral-3-3B-Instruct-2512 model card](https://huggingface.co/mistralai/Ministral-3-3B-Instruct-2512) · [mistralai/Devstral-2-123B-Instruct-2512 model card](https://huggingface.co/mistralai/Devstral-2-123B-Instruct-2512) · [mistralai/Devstral-Small-2-24B-Instruct-2512 model card](https://huggingface.co/mistralai/Devstral-Small-2-24B-Instruct-2512) · [deepseek-ai/DeepSeek-V4.1-Flash model card](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash) · [deepseek-ai/DeepSeek-V4-Pro model card (DeepSeek-V4 preview series)](https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro) · [deepseek-ai/DeepSeek-R1 model card](https://huggingface.co/deepseek-ai/DeepSeek-R1)
- **docs.mistral.ai** (9, OFFICIAL): [Mistral pricing (docs)](https://docs.mistral.ai/inference/pricing) · [Mistral Medium 3.5 (Mistral docs)](https://docs.mistral.ai/models/mistral-medium-3-5-26-04) · [Mistral Small 4 (Mistral docs)](https://docs.mistral.ai/models/mistral-small-4-0-26-03) · [Mistral Large 3 (Mistral docs)](https://docs.mistral.ai/models/mistral-large-3-25-12) · [Ministral 3 14B (Mistral docs)](https://docs.mistral.ai/models/ministral-3-14b-25-12) · [Ministral 3 8B (Mistral docs)](https://docs.mistral.ai/models/ministral-3-8b-25-12) · [Ministral 3 3B (Mistral docs)](https://docs.mistral.ai/models/ministral-3-3b-25-12) · [Devstral 2 (Mistral docs)](https://docs.mistral.ai/models/devstral-2-25-12) · [Devstral Small 2 (Mistral docs)](https://docs.mistral.ai/models/devstral-small-2-25-12)
- **github.com** (8, OFFICIAL): [xai-org/grok-1 (README: Model Specifications, License)](https://github.com/xai-org/grok-1) · [Llama 4 Model Card](https://github.com/meta-llama/llama-models/blob/main/models/llama4/MODEL_CARD.md) · [Llama 3.3 Model Card](https://github.com/meta-llama/llama-models/blob/main/models/llama3_3/MODEL_CARD.md) · [Llama 3.2 Model Card (1B/3B)](https://github.com/meta-llama/llama-models/blob/main/models/llama3_2/MODEL_CARD.md) · [Llama 3.2-Vision Model Card](https://github.com/meta-llama/llama-models/blob/main/models/llama3_2/MODEL_CARD_VISION.md) · [Llama 3.1 Model Card](https://github.com/meta-llama/llama-models/blob/main/models/llama3_1/MODEL_CARD.md) · [QwenLM/Qwen3.8 README (News)](https://github.com/QwenLM/Qwen3.8) · [QwenLM/Qwen3.8-Flash-Next README](https://github.com/QwenLM/Qwen3.8-Flash-Next)
- **docs.x.ai** (6, OFFICIAL): [SpaceXAI (xAI) API documentation index](https://docs.x.ai/llms.txt) · [Models and pricing](https://docs.x.ai/developers/models) · [Release notes](https://docs.x.ai/developers/release-notes) · [Grok 4.7 (model page)](https://docs.x.ai/developers/models/grok-4.7) · [Grok 4.6 (model page)](https://docs.x.ai/developers/models/grok-4.6) · [Grok 4.3 (model page)](https://docs.x.ai/developers/models/grok-4.3)
- **api-docs.deepseek.com** (4, OFFICIAL): [Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing) · [DeepSeek-V4.1-Flash Release (2026/09/10)](https://api-docs.deepseek.com/news/news260910) · [DeepSeek V4 Preview Release (2026/04/24)](https://api-docs.deepseek.com/news/news260424) · [DeepSeek-R1 Release (2025/01/20)](https://api-docs.deepseek.com/news/news250120)
- **mistral.ai** (2, OFFICIAL): [Mistral AI homepage](https://mistral.ai/) · [Mistral AI legal notice](https://mistral.ai/legal)
- **cdn.openai.com** (1, OFFICIAL): [gpt-oss-120b & gpt-oss-20b Model Card](https://cdn.openai.com/pdf/419b6906-9da6-406c-a19d-1bb078ac7637/oai_gpt-oss_model_card.pdf)
- **www.deepseek.com** (1, OFFICIAL): [DeepSeek homepage](https://www.deepseek.com/en)
- **cdn.deepseek.com** (1, OFFICIAL): [DeepSeek Privacy Policy](https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html)
- **qwen.ai** (1, OFFICIAL): [Qwen homepage](https://qwen.ai/)
- **www.llama.com** (1, OFFICIAL): [Llama developer site (redirects to dev.meta.ai)](https://www.llama.com/)
- **ai.google.dev** (1, OFFICIAL): [Gemma releases](https://ai.google.dev/gemma/docs/releases)

### `openai.json` (49 sources)

- **developers.openai.com** (28, OFFICIAL): [Pricing  OpenAI API](https://developers.openai.com/api/docs/pricing) · [Deprecations  OpenAI API](https://developers.openai.com/api/docs/deprecations) · [Changelog  OpenAI API](https://developers.openai.com/api/docs/changelog) · [Models  OpenAI API](https://developers.openai.com/api/docs/models) · [GPT-6 Astra Model  OpenAI API](https://developers.openai.com/api/docs/models/gpt-6-astra) · [GPT-6 Sol Model  OpenAI API](https://developers.openai.com/api/docs/models/gpt-6-sol) · [GPT-6 Luna Model  OpenAI API](https://developers.openai.com/api/docs/models/gpt-6-luna) · [GPT-5.6 Sol Model  OpenAI API](https://developers.openai.com/api/docs/models/gpt-5.6-sol) · [GPT-5.6 Terra Model  OpenAI API](https://developers.openai.com/api/docs/models/gpt-5.6-terra) · [GPT-5.6 Luna Model  OpenAI API](https://developers.openai.com/api/docs/models/gpt-5.6-luna) · [GPT-5.5 Model  OpenAI API](https://developers.openai.com/api/docs/models/gpt-5.5) · [GPT-5.5 Pro Model  OpenAI API](https://developers.openai.com/api/docs/models/gpt-5.5-pro) · [GPT-5.4 Model  OpenAI API](https://developers.openai.com/api/docs/models/gpt-5.4) · [GPT-5.4 Pro Model  OpenAI API](https://developers.openai.com/api/docs/models/gpt-5.4-pro) · [GPT-5.4 mini Model  OpenAI API](https://developers.openai.com/api/docs/models/gpt-5.4-mini) · [GPT-5.4 nano Model  OpenAI API](https://developers.openai.com/api/docs/models/gpt-5.4-nano) · [GPT-5.3-Codex Model  OpenAI API](https://developers.openai.com/api/docs/models/gpt-5.3-codex) · [GPT-5.2 Model  OpenAI API](https://developers.openai.com/api/docs/models/gpt-5.2) · [GPT-5.1 Model  OpenAI API](https://developers.openai.com/api/docs/models/gpt-5.1) · [GPT-5 Model  OpenAI API](https://developers.openai.com/api/docs/models/gpt-5) · [GPT-5 mini Model  OpenAI API](https://developers.openai.com/api/docs/models/gpt-5-mini) · [o3 Model  OpenAI API](https://developers.openai.com/api/docs/models/o3) · [o4-mini Model  OpenAI API](https://developers.openai.com/api/docs/models/o4-mini) · [GPT-4.1 Model  OpenAI API](https://developers.openai.com/api/docs/models/gpt-4.1) · [GPT-4o Model  OpenAI API](https://developers.openai.com/api/docs/models/gpt-4o) · [GPT Image 2 Model  OpenAI API](https://developers.openai.com/api/docs/models/gpt-image-2) · [GPT Image 2.5 Sunburst Model  OpenAI API](https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst) · [GPT-Realtime-2.1 Model  OpenAI API](https://developers.openai.com/api/docs/models/gpt-realtime-2.1)
- **learn.chatgpt.com** (16, OFFICIAL): [Pricing  ChatGPT docs](https://learn.chatgpt.com/docs/pricing) · [Models  ChatGPT docs](https://learn.chatgpt.com/docs/models) · [Quickstart  ChatGPT docs](https://learn.chatgpt.com/docs/quickstart) · [Codex cloud  ChatGPT docs](https://learn.chatgpt.com/docs/cloud) · [Codex CLI  ChatGPT docs](https://learn.chatgpt.com/docs/codex/cli) · [Get started with ChatGPT Work  ChatGPT docs](https://learn.chatgpt.com/docs/get-started-with-work) · [ChatGPT Voice  ChatGPT docs](https://learn.chatgpt.com/docs/features/voice) · [Memories  ChatGPT docs](https://learn.chatgpt.com/docs/customization/memories) · [Projects and chats  ChatGPT docs](https://learn.chatgpt.com/docs/projects) · [Scheduled tasks  ChatGPT docs](https://learn.chatgpt.com/docs/automations) · [Image generation  ChatGPT docs](https://learn.chatgpt.com/docs/image-generation) · [Web search  ChatGPT docs](https://learn.chatgpt.com/docs/web-search) · [Browser  ChatGPT docs](https://learn.chatgpt.com/docs/browser) · [Sites  ChatGPT docs](https://learn.chatgpt.com/docs/sites) · [Computer Use  ChatGPT docs](https://learn.chatgpt.com/docs/computer-use) · [Plugins  ChatGPT docs](https://learn.chatgpt.com/docs/plugins)
- **openai.com** (2, OFFICIAL): [Privacy Policy  OpenAI](https://openai.com/policies/privacy-policy/) · [Introducing ChatGPT  OpenAI](https://openai.com/index/chatgpt/)
- **status.openai.com** (1, OFFICIAL): [OpenAI Status](https://status.openai.com/)
- **chatgpt.com** (1, OFFICIAL): [요금제  ChatGPT (Korean storefront)](https://chatgpt.com/ko-KR/pricing/)
- **help.openai.com** (1, OFFICIAL): [About ChatGPT Pro tiers  OpenAI Help Center](https://help.openai.com/en/articles/9793128-about-chatgpt-pro-tiers)

### `runtimes.json` (36 sources)

- **ollama.com** (12, OFFICIAL): [Download Ollama](https://ollama.com/download) · [Ollama library: gpt-oss (tags)](https://ollama.com/library/gpt-oss/tags) · [Ollama library: llama3.3 (tags)](https://ollama.com/library/llama3.3/tags) · [Ollama library: llama3.1 (tags)](https://ollama.com/library/llama3.1/tags) · [Ollama library: llama4 (tags)](https://ollama.com/library/llama4/tags) · [Ollama library: qwen3.5 (tags)](https://ollama.com/library/qwen3.5/tags) · [Ollama library: qwen3.6 (tags)](https://ollama.com/library/qwen3.6/tags) · [Ollama library: qwen3.8 (tags)](https://ollama.com/library/qwen3.8/tags) · [Ollama library: gemma4 (tags)](https://ollama.com/library/gemma4/tags) · [Ollama library: deepseek-r1 (tags)](https://ollama.com/library/deepseek-r1/tags) · [Ollama library: devstral-2 (tags)](https://ollama.com/library/devstral-2/tags) · [Ollama library: ministral-3 (tags)](https://ollama.com/library/ministral-3/tags)
- **lmstudio.ai** (11, OFFICIAL): [Download LM Studio](https://lmstudio.ai/download) · [LM Studio changelog](https://lmstudio.ai/changelog/lmstudio) · [LM Studio docs - System Requirements](https://lmstudio.ai/docs/app/system-requirements) · [LM Studio model catalog: gpt-oss](https://lmstudio.ai/models/gpt-oss) · [LM Studio model catalog: qwen3.5](https://lmstudio.ai/models/qwen3.5) · [LM Studio model catalog: qwen3.6](https://lmstudio.ai/models/qwen3.6) · [LM Studio model catalog: qwen3.8](https://lmstudio.ai/models/qwen3.8) · [LM Studio model catalog: gemma-4](https://lmstudio.ai/models/gemma-4) · [LM Studio model catalog: deepseek-v4-flash](https://lmstudio.ai/models/deepseek-v4-flash) · [LM Studio model catalog: devstral-2](https://lmstudio.ai/models/devstral-2) · [LM Studio model catalog: ministral](https://lmstudio.ai/models/ministral)
- **github.com** (7, OFFICIAL_API/OFFICIAL): [llama.cpp releases (GitHub)](https://github.com/ggml-org/llama.cpp/releases) · [llama.cpp build b11229 (release assets)](https://github.com/ggml-org/llama.cpp/releases/tag/b11229) · [llama.cpp README](https://github.com/ggml-org/llama.cpp) · [Ollama releases (GitHub)](https://github.com/ollama/ollama/releases) · [Ollama GitHub repository (README, LICENSE)](https://github.com/ollama/ollama) · [vLLM releases (GitHub)](https://github.com/vllm-project/vllm/releases) · [vLLM GitHub repository (README, LICENSE)](https://github.com/vllm-project/vllm)
- **docs.vllm.ai** (3, OFFICIAL): [vLLM docs - Installation](https://docs.vllm.ai/en/latest/getting_started/installation/index.html) · [vLLM docs - GPU installation (requirements)](https://docs.vllm.ai/en/latest/getting_started/installation/gpu/index.html) · [vLLM docs - Supported Models](https://docs.vllm.ai/en/latest/models/supported_models.html)
- **llama.app** (2, OFFICIAL): [llama.app - Official home for llama.cpp](https://llama.app) · [llama.app - Models (curated open models that run in llama.cpp)](https://llama.app/models)
- **docs.ollama.com** (1, OFFICIAL): [Ollama docs - Hardware support](https://docs.ollama.com/gpu)

## 5. Known gaps, conflicts and staleness

**Prices and plans**
- **Claude in Korea is priced in USD**: claude.com/ko/pricing (browser and curl from Korea) shows USD, so KR-scoped
  Claude facts are USD with a note; there is no KRW Claude price. Max 20x has no KR price (the page says "from $100").
- **ChatGPT US prices** come from learn.chatgpt.com/docs/pricing and the Help Center (chatgpt.com/pricing answers 403
  to non-browser fetches); KR prices were read in a browser from chatgpt.com/ko-KR/pricing. No KR price for Pro 20x,
  no US price for the Business Premium seat. Pro 20x sign-ups are paused since 2026-09-10 (note).
- **Google AI plans**: no page shows a yearly price → no `price_yearly`; Ultra is sold as two plans (5x/20x).
- No page states VAT handling for Korea except Anthropic's "applicable tax not included" → no VAT notes elsewhere.
- Plan prices, promotional API prices (GPT-5.6 Sol through at least 2026-11-21; Gemini 3.6–3.8 Flash until
  2026-12-31) and long-context tiers are in fact `note`s; all `fast` facts go stale on **2026-10-12** (14-day SLA).

**Conflicts between official pages (resolved conservatively, noted in the seed)**
- ChatGPT Sites: the Sites doc says Plus/Pro, the pricing matrix says no → only Business/Enterprise recorded.
- Claude Design/Slides/Docs on Free: pricing table says no, a 2026-09-16 Help Center note says every plan → followed
  the pricing page (unavailable).
- Gemini in Chrome auto browse: two official pages disagree on preview vs available → no `status` fact.

**Deliberately not in the seed**
- Discontinued: Sora (app 2026-04-26, API 2026-09-24). ChatGPT Atlas (Help Center search snippet says it stopped
  2026-08-09 — page not opened, so no entity either way).
- Too thin or unverifiable: Google Flow (age-gated page), NotebookLM (renamed "Gemini Notebook"?, unconfirmed),
  Personal Intelligence / Deep Think / Gemini Agent, Claude Mythos Preview, @Claude/Claude Tag, Claude Science,
  Claude Security, Claude for Microsoft 365, Grok 2 (licence only), DeepSeek V3.2 / R1-0528 (no parameter count).
- Trimmed to the 100-model ceiling: chat-latest (alias), gemini-3-pro (retired preview), veo-3.1 (per-second price),
  gemini-embedding-2, codestral-2508 (API only), grok-2.
- Usage limits: none stored (no official numbers were used; "limits vary" pages stay unquantified).

**Open-weight models (GPU-fit input)**
- `parameters_b` is the maker's stated number (exact wording in each note). Some cards only give round sizes
  (Llama 3.1 8B, 3.3 70B, Qwen 27B/9B/4B). Hugging Face `safetensors.total` would be exact but is computed by HF,
  not stated by the maker → not used.
- Three models store more weights than the headline count — the VRAM tool must read the notes: Qwen3.8-Flash-Next
  (+51B n-gram embedding +4B MTP ≈ 180B stored), DeepSeek-V4.1-Flash (+196B Engram memory ≈ 763B stored),
  Gemma 4 E2B/E4B (5.1B/8B incl. embeddings; effective 2.3B/4.5B).
- `runs_on` (72 relations) only where the runtime's own model list names the model: ollama.com/library/*/tags,
  lmstudio.ai/models/*, docs.vllm.ai supported models ("latest" = developer preview docs), llama.app/models (the
  official llama.cpp site). Cloud-only listings (Ollama/LM Studio "cloud" models) are excluded.
- No HQ country for Meta, Alibaba, xAI (no official page stated it in a fetchable form). xAI's docs now say
  "SpaceXAI (xAI)" — kept "xAI" with the alias.

**Runtimes**: LM Studio is proprietary (no named licence → omitted); its GPU backends come from its changelog; no
first-release dates. llama.cpp's `docs/release.md` still says no GitHub Release objects are created, which is stale.

**Status pages**: the Gemini API / AI Studio status page (aistudio.google.com/status) is a JS app with no documented
feed → no collector. Google Cloud Service Health (`status.cloud.google.com/incidents.json`, documented) only covers
Vertex AI products ("Gemini on Agent Platform"), not the Gemini Developer API → not used, to avoid mislabelling.
The Claude Atom feed has no component list or impact, so Claude incidents link to services only by product names in
the text.

## 6. Suggested core changes
1. **Incidents**: add `incident` to `EVENT_KINDS`/`events.kind` (the `changes` table already has it) and accept the
   event keys the AI collectors emit: `key` (stable external id for de-duplication across runs), `status`
   (`confirmed`/`ended`), `impact`, `components`.
2. **`validate-seed.mjs <dir>`** reports every file as a duplicate of itself on Windows: `seedFiles()` returns
   absolute paths, the argument path is relative → the `Set` keeps both. Normalise with `path.resolve` before the union.
3. **`collectorContext.get`**: allow an adapter to send an auth header from an allowlisted env var (e.g.
   `GITHUB_TOKEN` to api.github.com only) — unauthenticated GitHub is 60 req/h per runner IP.
4. **`collect.mjs`**: set `process.exitCode` instead of `process.exit()` to avoid the Windows libuv assertion.
5. **Vocabulary** (not added — no need was hard enough to touch `platform/verticals/ai.js`; agents asked for these):
   `api_cache_write_price`; a price validity end (`until` scope, for promotional prices); per-unit prices (per image /
   second / minute); `retirement_date` separate from `deprecation_date` (providers use both words; the seed stores
   the shutdown/retirement date in `deprecation_date` when the provider publishes one — OpenAI, Google, Anthropic —
   and Mistral's own "deprecation date" otherwise, each with a note saying which); a `limited`
   status (invite-only / existing-users-only models); a `note` on availability rows (some rows carry one; the
   validator ignores it); `seats_max`; stored vs active vs effective parameters for MoE/embedding-heavy models.
