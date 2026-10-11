# AI 창작 커뮤니티 — community side (2026-10-11)

Owner decision 2026-10-11: Nerulio is an AI creation community. Posts can carry a **recipe** (the prompt +
the in-browser finishing steps, `nerulio.recipe/1`, `platform/recipe.js`) that anyone can replay on their own
image in the workbench (`/{l}/make/?recipe=<post id>`, MAKER). Contract: `nerulio-handoff/AI-COMMUNITY-CONTRACT.md`.

## Channels (`platform/channels.js`, `migrations/0015_ai_community.sql`)
Bar order: 프사·프로필 `pfp` · 이모티콘·스티커 `sticker` · 도트 `pixel` · 배경화면 `wall` · 레시피 질문 `howto` · 자유 `free` · 공지 `notice`.

| Channel | 말머리 | 규격 row (preset landings) |
| --- | --- | --- |
| pfp | 작품 `share` · 팁 `tip` · 질문 · 잡담 | round-pfp |
| sticker | 카톡 대화용 `kakao` · LINE 판매 `line` · 디스코드 · 텔레그램 · 움짤 `anim` · 질문 | kakao-emoticon, line-sticker, discord-emoji, telegram-sticker |
| pixel | 작품 · 정리 전후 `fix` · 팁 · 질문 | ai-pixel-fix |
| wall | 폰 `phone` · PC `pc` · 팁 · 질문 | phone-wallpaper |
| howto | 질문 · 만들어 주세요 `request` · 팁 | — |
| free | 잡담 · 질문 · 정보 | — |
| notice | 건의 (공지: staff) | — |

The 2026-09-29 channels `games sub hw ai studio` are **archived**: `inBar:false`, `readOnly:true`. Their posts
and URLs keep working; members cannot post there (API 403 `read_only`; the write page 302s to 자유 with the tag);
staff may still post a 공지. An entity page's "이 태그로 글쓰기" and the old `entityId` API shape go to 자유.
New 말머리 are stored in `discussions.flair`; `kind` keeps a value of the 0004 CHECK (`storedKind`).

## Data (0015)
`discussions` + `recipe_json` (validated, NULL = none), `remix_of`, `remix_count`, `try_count`, `ai_generated`,
`generator`, `prompt` (≤ 2000), `consent_at`; table `recipe_try_days(discussion_id, day, n)` (KST day) for
이번 주 유행. `remix_count` is **recounted** from the published children whenever a remix is written, hidden,
restored or deleted (`platform/community.js remixRecount*`), so it never drifts.

## API (`server/platform/api.js`)
- `POST /api/v2/posts` (members and 유동) accepts `recipe` (object or JSON string → `validateRecipe`), `remixOf`
  (published post with a recipe), `generator` (chatgpt gemini midjourney sd novelai other; default: the
  recipe's), `prompt` (default: the recipe's), `ai` (default true when any of these is set), `consent`.
  **`consent: true` is required when the body attaches images** (checked after the images' ownership).
  Prompts and recipe titles asking for nude/undressing edits are refused (`reason:'ai_blocked'`, `AI_BLOCKED`).
- `GET /api/v2/recipes/{id}` → `{id,title,channel,no,url,recipe,generator,prompt,author,tries,remixes}`,
  published only, `Cache-Control: public, max-age=60, s-maxage=60` (edge-cached).
- `POST /api/v2/recipes/{id}/try` → `{counted,tries}`. No account; once per network (/24 or /48) per recipe per
  KST day, ≤ 200 recipes a day and 30 requests a minute per network (`RECIPE_TRY`). The workbench calls it once
  per run on the visitor's own image; the post page never calls it.
- Reports: `sexual`, `minor`, `deepfake` join `csam`, `illegal_filming`, `privacy` in `REPORT.severe` — **one
  report hides the post at once** pending review (admin push as before).

## Images: before/after
The feed and the board show a post's images from its body. An image whose alt text is `원본` / `Original` /
`before` / `source` is the **source**; every other image is a result (`platform/db/channel.js SOURCE_ALT`).
The workbench posts `![원본](/u/…)` and `![결과](/u/…)`. AI posts (recipe, prompt, AI flag or remix) show their
images as a grid with a ZIP download instead of inline.

## Write page hand-off (optional; the workbench also posts directly)
Open `/{l}/community/{ch}/write?from=make[&remix=<id>]` after putting
`sessionStorage['nerulio:recipe-draft'] = JSON.stringify({recipe, generator?, prompt?, remixOf?, title?, body?})`.
The form shows the recipe, pre-fills the AI fields and sends `recipe`/`remixOf` with the post (same validation).

## Pages
Home (`/`, `/en/`): upload strip → `/{l}/make/`, tabs 인기 · 최신 · 념글 · 레시피만 (`?sort=recipes`, noindex),
feed of the seven boards only. 레시피 모음 `/{l}/community/recipes/` (`?sort=new&ch=&page=`), 이번 주 유행
`/{l}/community/trends/` (hand-picked `TRENDS` in `platform/render/rail.js` + this week's tries). Right column:
이번 주 유행, 규격 바로 맞추기, 지켜 주세요. Policy `#ai` (ko/en).

## SEO
`platform/seo.js ARCHIVED_VERTICALS=['ai','games']`: their hubs, entity pages, histories and comparison pages are
noindex and their n2 sitemaps are gone; the Radar is noindex. `sitemap-n2-community.xml` lists the home, boards,
recipe lists, posts (in their own language) and the AI service status pages (still indexed).

## Tests
`tests/aic-community.test.mjs` (migration on a production-shaped DB, API, renders, sitemaps),
`tests/aic-browser.py` (dev server, 1440/390, connectors, overflow, flows; screenshots `test-results/aic-*.png`).
Demo content: `tools/platform/demo-aic.mjs` (dev server and render tests only).
