# Community closure and the public publishing surface

The production Worker routes platform pages through `server/platform/public.js`.
Community boards, profiles, posting, comments, voting, reports, pins, proposals,
uploads and community image delivery return HTTP 410 with `X-Robots-Tag: noindex`.
The guard runs before authentication, request-body processing or database access.
Existing records are preserved. Owner administration and the aggregate visit beacon
retain their existing authorization and handlers.

The legacy community modules remain for owner operations and isolated regression
fixtures. They are not a fallback for production requests. `PUBLIC_SITE=on node
tools/platform/dev-server.mjs` previews the production publishing surface locally;
the unflagged dev server continues to run the historical community fixtures.

The Korean and English home pages show two separate streams:

- News uses published `news` records from system accounts only. Articles use new
  `/[ko|en]/news/<channel>/<number>` addresses and have no comments or voting.
  Automated news is labelled and its article pages remain noindex.
- AI commentary reads only `status: published` articles from the existing digest
  pipeline. Drafts are neither published nor exposed by this change. Publishing
  still follows `docs/AI-DIGEST.md` and requires the owner's editorial review.

When either stream is empty, the home says that there are no published articles.
Empty indexes are noindex and not added to the sitemap. Closed community URLs are
removed from the production sitemap. Reference directories, official facts,
history, hardware tools, brackets and the static asset/file tools remain public.
Reference pages no longer show community submission controls.

Validation: `node --test tests/public-site.test.mjs` verifies server-side closure,
read-only rendering, separation of news from human posts, draft isolation, retained
records and sitemap consistency. Legacy community tests exercise retained modules,
not the production site's availability.
