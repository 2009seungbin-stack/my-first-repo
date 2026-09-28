# Distribution validation — 2026-09-28

Executed in the isolated `codex/nerulio-distribution` worktree, based on production main `19d422c`.

| Check | Result |
| --- | --- |
| `node --test tests/distribution.test.mjs` | 32 passed, zero failures |
| `npm test` | 2,278 tests: 2,277 passed, one skipped, zero failed |
| `npm run check` | Passed |
| `SITE_URL=https://nerulio.com npm run build` | 904 static entry pages built |
| `python tools/audit-seo.py` | 472 pages, 19,189 internal links, zero errors |
| Local CLI dry run | Selected `/en/game/godot-pixel-art-blurry/`; validation passed; payload published=false; no state mutation or remote call |
| Explicit-route CLI dry run | `/en/game/aseprite-to-godot/` selected and validated |
| All eight article recipes | Source digests current; structure, canonical, tags, novelty, CTA and evidence checks pass |
| Live target preflight | All eight source URLs returned indexable HTML and exact self canonical |
| Workflow YAML | Parsed successfully; branch/event/concurrency/defaults asserted in tests |
| Credentials/API | Tests use fake HTTP; no real credentialed DEV request or external post |

Local runtime was Node v24.15.0 on Windows. CI specifies Node 22. The first GitHub run passed
syntax, all Node tests, build, SEO audits and browser suites through Studio Tile, then exposed a
pre-existing Texture worker race during asset selection. The last successful production-main
run had passed, and the original Texture suite also passed locally, so a deterministic regression
was added that holds an old generation response until the next picture is loading. It fails
against the original implementation and passes after invalidating old work at selection time.

The fix also prevents stale convention/seam results after selection or workspace deactivation,
and clears the previous convention before rendering a newly generated map. The extended local
Texture browser suite passes 42 checks, including the forced worker race, pixel readback, export,
undo, project recovery, translations and mobile layout. No SEO registry or export format changed.
The updated GitHub run is a separate result; service and engine-rendering benchmarks have not
been rerun locally.

Failure-path coverage includes POST success with a lost response, post creation followed by a
failed final journal save, absent remote reconciliation, malformed JSON/article objects, hostile
redirect destinations, repeated pagination, missing/noindex/wrong-canonical source pages,
edited remote drafts, fingerprint collisions, cadence limits, secret redaction, file locks and
two Git writers attempting to save even identical state. The latter uses isolated local bare
repositories and normal pushes, not the production repository's state branch.

Not established by these checks: DEV account authorization, actual remote draft/publish success,
platform listing approval, Google indexing, visitor growth or conversion performance. Those are
operator/integration outcomes rather than unit-test claims.
