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

- News combines published `news` records from system accounts with recent verified
  official release metadata from the existing radar collectors. Releases link to
  original sources and never become fabricated editorial articles. System stories use new
  `/[ko|en]/news/<channel>/<number>` addresses and have no comments or voting.
  Automated news is labelled and its article pages remain noindex.
- Tool tests and AI commentary read only `status: published` articles from the existing digest
  pipeline. Drafts are neither published nor exposed by this change. Publishing
  follows `docs/AI-DIGEST.md`, including the owner's bounded autonomous-publication
  authorization, evidence requirements and honest AI-assistance disclosure.

When either stream is empty, the home says that there are no published articles.
Empty commentary indexes and all automatically collected news indexes are noindex
and not added to the sitemap. Closed community URLs are
removed from the production sitemap. Reference directories, official facts,
history, hardware tools, brackets and the static asset/file tools remain public.
Reference pages no longer show community submission controls.
Retained community activity does not qualify references or derived pages for
public search discovery. The owner override and substantive editorial-description
gate remain, consistently across robots and sitemaps.

Validation: `node --test tests/public-site.test.mjs` verifies server-side closure,
read-only rendering, separation of news from human posts, draft isolation, retained
records and sitemap consistency. Legacy community tests exercise retained modules,
not the production site's availability.
