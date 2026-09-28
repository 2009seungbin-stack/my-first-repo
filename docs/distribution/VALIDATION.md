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

Local runtime was Node v24.15.0 on Windows. CI specifies Node 22; the GitHub-hosted run is a
separate result. The existing browser, engine-rendering, service and benchmark suites were not
rerun locally: this change adds offline tooling, article text and a new workflow, and does not
change application UI, SEO registries, engine exports or deployment configuration.

Failure-path coverage includes POST success with a lost response, post creation followed by a
failed final journal save, absent remote reconciliation, malformed JSON/article objects, hostile
redirect destinations, repeated pagination, missing/noindex/wrong-canonical source pages,
edited remote drafts, fingerprint collisions, cadence limits, secret redaction, file locks and
two Git writers attempting to save even identical state. The latter uses isolated local bare
repositories and normal pushes, not the production repository's state branch.

Not established by these checks: DEV account authorization, actual remote draft/publish success,
platform listing approval, Google indexing, visitor growth or conversion performance. Those are
operator/integration outcomes rather than unit-test claims.
