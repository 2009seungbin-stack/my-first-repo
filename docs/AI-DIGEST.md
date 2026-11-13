# 도구 실측·AI 해설 (Tool tests and AI commentary)

Source-based commentary and reproducible tool case studies for game assets and file workflows. On 2026-11-14 the owner authorized autonomous remediation, implementation and publication through 2026-11-15 10:00 KST. An AI agent may publish technically verified original case studies within that scope. It must disclose AI assistance and the actual checks; it must never describe agent verification as human editorial review or personal experience. Existing news drafts remain drafts until their facts and relevance are checked. Nothing is public before `status: published`.

## Where it lives

| What | Where |
| --- | --- |
| Sources (drafts and published) | `content/ai-digest/YYYY-MM-DD-slug.ko.md` and `.en.md` |
| Parser and validation (build time) | `tools/digest-build.mjs` |
| Published list, the link helper, sitemap entries | `platform/digest.js` (`digestLink(l)` is the only switch for links) |
| Pages | `platform/render/digest.js`, routed in `server/platform/pages.js` |
| Index / article URLs | `/{ko,en}/ai/digest/` and `/{ko,en}/ai/digest/<slug>/` |

The pages are Worker-rendered like the rest of `/{l}/ai/` (the AI hub and tag pages are server-rendered platform pages, `PLATFORM=on` builds). `/{l}/ai/digest/` is matched before the tag-page route, so `digest` can never be a tag slug. At build time `tools/service-build.mjs` writes `dist/_worker.js/platform/digest-data.js` with the **published** articles only. `content/` is never copied into `dist/`, so a draft's text is not in the build output or in any Worker response.

## File format

```markdown
---
title: "제목"
date: 2026-10-31            # must equal the date in the file name
updated: 2026-11-02         # optional; dateModified (defaults to date)
summary: "목록·meta description·JSON-LD에 쓰는 한두 문장"
status: draft               # draft | published
sources:
  - title: "출처 이름 (게시일)"
    url: "https://..."
---
본문 (Markdown: ## 소제목, ### 하위 제목, 목록, **굵게**, [링크](https://...), 표)
```

- The URL slug is the part of the file name after the date (`2026-10-31-image-models-for-game-art.ko.md` → `/ko/ai/digest/image-models-for-game-art/`). A slug may be used once per language. The Korean and English files of one article share the slug; that is how translations are paired for hreflang.
- Each language is published on its own. hreflang links appear only between translations that are both published.
- Every file is validated by the build, drafts included (missing title, date mismatch, empty sources, non-http URL, unknown key → the build fails with the file name). `npm test` checks the files in `content/ai-digest/` too.

## Reviewing a draft

1. Read the Korean file first; it is the primary text. The English file is a translation of it.
2. Open every link in `sources`. Each factual sentence (who, what, when, numbers, availability, license terms) must be supported by one of them. If a claim cannot be found in a source, delete the claim rather than adding a vaguer one.
3. Check the dates: the items should fall in the week (or weeks) the article covers. Remove anything outside it unless the text says it is background.
4. Check that each item has the three parts: what happened, why it matters for game-asset/file workflows, what to actually do. Advice must be concrete and doable by a small team.
5. Edit freely. The byline is Nerulio (organization); no personal author name is shown or put in JSON-LD.
6. To see the page locally before publishing: set `status: published` in your working copy only, run `npm run dev:platform`, open `http://localhost:8788/ko/ai/digest/<slug>/`, then set it back if you are not publishing yet. Never deploy a working copy with an unreviewed article set to published.

## Publishing

1. Set `status: published` in the `.ko.md` (and the `.en.md` when the translation is reviewed too).
2. If you publish on a different day than the file name, rename the file and change `date` to the publication date (they must match). For later corrections, keep `date` and set `updated`.
3. Commit, then build and deploy the usual way. Nothing else needs to change.

What happens automatically once a language has at least one published article:

- `/{l}/ai/digest/` becomes indexable and lists the articles, newest first.
- The menu's AI entry ("정보·비교" group) and the home page's AI area (the reference directory's AI links) gain a link to the digest. Both come from `digestLink(l)` in `platform/digest.js`.
- The index and every published article are listed in `sitemap-n2-ai.xml` with `lastmod` (the newest `updated`/`date`).

With zero published articles in a language, its index stays reachable but is `noindex`, has no links pointing to it and is absent from sitemaps. To unpublish, set `status: draft` again and redeploy; the page returns 404 and leaves the sitemap.

## Page details

- canonical per language; `Article` JSON-LD with `headline`, `description`, `datePublished`, `dateModified`, `inLanguage`, `citation` (the sources), and Nerulio as `author` and `publisher` (the site's Organization node); a breadcrumb.
- The sources appear at the end with an honest AI-assistance note. Do not claim human review unless there is evidence of it. Local editorial figures may use `/assets/editorial/` image paths; remote images and traversal paths are rejected. Community Markdown has no access to this opt-in.
- Ad markers follow [ADS.md](ADS.md): `<!--ad:content-1-->` after the article text and `<!--ad:content-2-->` after the sources, inside a `[data-ad-host]`. Platform pages do not load an ad script today, so the markers are inert until that is decided separately.

## Quality rules

- **Sources for every fact.** Primary sources first (the company's announcement, official docs, the court or regulator); reputable reporting when no primary source is available. No invented numbers, quotes, release dates or features. When sources disagree or a detail is uncertain, leave it out or say plainly that it is unconfirmed.
- **No direct quotes unless copied from the source itself.** Paraphrase with attribution otherwise.
- **Original commentary.** The value is the "why it matters" and "what to do" for game assets, sprites, store art and file workflows. Do not rewrite press releases or list every announcement of the week; three or four items with a clear angle beat ten summaries.
- **Benchmarks and rankings** are reported as the company's own claim, if at all.
- **Policy and legal items** say they are not legal advice and point to the source text.
- **Internal links** go to tools that actually help with the advice (`/ko/game/pixel-lab/`, `/ko/sprite-slicer/` …); no link stuffing.
- **Publish when there is evidence.** Do not promise a weekly cadence or pad the archive with summaries. For news, disclose the covered dates and primary sources. For a tool case study, publish the exact inputs, license, settings, browser/version, outputs, reproducible script and limitations. Korean and English versions must agree on measurements and claims.
- **Length is not the goal.** If a week has only one item that matters, write one good item.
