# Nerulio external distribution

This system reuses existing English game-development guides. It does not add SEO landing pages,
community bots, accounts or listings. Implementation base: main `19d422c` (2026-09-28).

## Implemented

- Automatically inventory all 108 indexable English game source pages from the existing sitemap,
  game and intent registries, including classifications, targets, evidence and real asset paths.
- Eight independently written, 470–550-word technical adaptations with worked examples,
  troubleshooting and a single late link to the exact source. No LLM service or paid API needed.
- Deterministic priority selection, a 28-day topic-family preference, content/source hashes,
  strict canonical and content checks, and live target validation before remote mutations.
- Local previews by default; separate private DEV draft and explicitly enabled public modes.
- Durable journal, reconciliation of both drafts and published posts, rolling seven-day limit of
  two publications, and at least 72 hours between public publications.
- GitHub Actions schedule and manual workflow, plus manual launch kits for three platforms.

Only the eight reviewed adaptations are auto-selectable. The remaining 100 inventory entries
are an editorial backlog, not automatically paraphrased articles. When the queue is exhausted,
execution stops successfully with an explicit message. Source edits invalidate the associated
adaptation until it has been reviewed. This is deliberate quality control, not an unlimited
article generator. At the maximum cadence the initial queue lasts four weeks.

## Operator steps

1. Merge this branch into production `main` after review. The workflow runs only on `main` and
   only on `schedule` or `workflow_dispatch`; it has no pull-request publication trigger.
2. Create or prepare a DEV.to account manually. Obtain its API key in the account's Extensions
   settings using the [official Forem API documentation](https://developers.forem.com/api/v1).
3. In GitHub repository **Settings → Secrets and variables → Actions → Secrets**, add
   **`DEVTO_API_KEY`**. Do not put it in a tracked file, workflow input or command line.
4. Allow this workflow to write the separate **`distribution-state`** branch. It must be able to
   create that branch and append journal commits. If repository rules prohibit that, remote
   publication fails before a post is created. Do not delete or reset this branch.
5. Run **Nerulio content distribution → Run workflow**, branch `main`, mode **dry-run**.
   Download the artifact. Review `article.md`, `payload.json`, `result.json` and `inventory.json`.
6. Run the same route with mode **draft**. This creates an unpublished DEV article. Inspect its
   formatting in DEV and confirm the original Nerulio URL in the canonical field. A remote
   draft is stored on DEV and is separate from a local-only preview.
7. When ready, add repository variable **`DISTRIBUTION_PUBLISH` = `true`**, then manually run
   mode **publish** with the exact same route. Existing drafts are promoted by ID, after checking
   the remote text still matches the reviewed article. A changed draft stops for review.
8. For ongoing publication, set repository variable **`DISTRIBUTION_MODE` = `publish`**. The
   schedule runs Monday and Thursday at 08:17 UTC (17:17 Seoul). Without this variable it remains
   `dry-run`; `draft` is also supported. Removing `DISTRIBUTION_PUBLISH` blocks public mutations.
9. Submit [itch.io](itchio.md) and [AlternativeTo](alternativeto.md) manually. Use the
   [Product Hunt kit](product-hunt.md) once gallery assets and launch timing are ready.

No external post or listing was created while implementing this system. Real credentialed API
publication and GitHub-hosted workflow execution remain operator verification steps. Local tests
use fake HTTP responses and isolated Git remotes; no credentials are needed for tests.

## Local commands (Node 20+, CI uses Node 22)

```sh
npm run distribution -- --dry-run
npm run distribution -- --dry-run --route /en/game/aseprite-to-godot/
npm run distribution -- --report
npm run test:distribution
```

Outputs go to `test-results/distribution/`. Local dry runs use the tracked empty seed ledger;
add `--state-git` to read the current operational journal. Dry runs do not modify it and never
contact DEV, even when the API key or public opt-in is present.

Remote local commands require Git push access to the repository and `DEVTO_API_KEY` in the
process environment. All CLI remote modes use the durable Git journal automatically:

```sh
npm run distribution -- --mode draft --route /en/game/aseprite-to-godot/
# Also requires DISTRIBUTION_PUBLISH=true in the environment:
npm run distribution -- --mode publish --route /en/game/aseprite-to-godot/
```

The `--force` flag is accepted only in an operator `workflow_dispatch`. It can bypass cadence
and allow inspection of an already published source; it never creates another copy or silently
rewrites a published article. To stop all scheduled writes, set `DISTRIBUTION_MODE=dry-run`.

## Journal, concurrency and retries

`ops/distribution-ledger.json` is an empty seed and local journal snapshot. The authoritative
operational ledger is `ledger.json` on the separate `distribution-state` Git branch. This keeps
bookkeeping out of `main` and avoids triggering the site's production deployment for each post.
Artifacts are diagnostic copies, not the authoritative journal.

Before any API mutation the code saves `generated`, then a durable `pending` reservation. Every
save creates a uniquely identified Git commit and uses a normal, non-force push. Concurrent
writers with the same parent cannot both advance the state branch; a rejected push prevents the
losing writer from posting. Actions also has a single concurrency group. A local `.lock` prevents
two processes using the same ledger file. A crash can leave that lock: remove it only after
checking no process still uses it.

Every remote run paginates the authenticated user's entire DEV article list and reconciles exact
canonical URLs before selection. It recovers an article created before a timeout or a failed
final journal save. A malformed response, repeated pagination, duplicate canonical, changed ID,
or absent result after an uncertain mutation stops the queue. There is no blind POST retry and
no claimed platform idempotency key.

If an attempt remains uncertain:

1. Rerun once; reconciliation may now see the created article.
2. If it still cannot, inspect the authenticated DEV dashboard, including drafts, by canonical.
   Check the latest `distribution-state` journal and artifact. Do not delete the entry.
3. If a created article's canonical was edited, restore the correct canonical in DEV and rerun.
4. Only after confirming no article was created, make a reviewed change on `distribution-state`
   clearing that entry's `uncertain` flag and retaining `status: failed`, attempts and timestamps.
   Record the reason in the commit message. Keep API secrets out of the record. The next run will
   still search DEV before creating anything. This exception is deliberately manual because an
   empty API search cannot prove an earlier timed-out request never completed.

An operator-edited remote draft is never overwritten by promotion. Reconcile it with the reviewed
local adaptation before retrying. To revise article text, edit the Markdown adaptation in this
branch and review the generated preview; no hidden generation model changes content at runtime.

## Adding or refreshing an adaptation

The inventory is derived; do not hand-edit hundreds of rows. Write a standalone Markdown article
under `tools/distribution/articles/`, add its route/file/tags/CTA/topic cluster to `manifest.json`,
and pin `sourceDigest(route)` after reading the current English source and its evidence. The digest
includes English depth copy, intent/evidence metadata and landing copy. Do not blindly refresh
digests after source changes. Keep no fabricated metrics, broad engine assurances or screenshots.

Run `npm run test:distribution`, review the preview, and regenerate the checked-in status:

```sh
node tools/distribution/cli.mjs --report --out docs/distribution
```

Validation checks structure and concrete examples in addition to length, prohibits unsupported
claim patterns and secrets, limits tags and CTA links, detects significant copied wording, and
rejects reused content fingerprints. Automated validation is not a substitute for editorial review.

## API contract and platform boundaries

The adapter implements DEV.to using [official Forem V1](https://developers.forem.com/api/v1):
authenticated paginated `GET /api/articles/me/all`, `GET /api/articles/{id}`, creation via
`POST /api/articles`, and draft promotion via `PUT /api/articles/{id}`. It sends `api-key` and the
V1 Accept header. Creation carries `canonical_url`, a maximum of four topic tags, and an explicit
`published` boolean. Redirects are rejected so credentials cannot follow another host. HTTP
response bodies and raw network/process errors are never logged. There is no generic arbitrary
Forem-host override; DEV is the configured first target.

Not implemented by design: automated Reddit/Discord/forum posts, comments/replies, fake engagement,
account creation, CAPTCHA or moderation bypass, bulk messaging, or automatic itch.io/AlternativeTo/
Product Hunt submission. The launch kits do not imply accounts or platform approval exist.
