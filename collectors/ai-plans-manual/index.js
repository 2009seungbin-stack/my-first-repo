// @ts-check
/** MANUAL_SOURCE: consumer/team plan prices, plan → model/feature availability and API model prices.
 *
 * Why manual (reviewed 2026-09-28, details in docs/n2/sources-ai.md):
 *  - chatgpt.com/pricing, claude.com/pricing and the Google One / gemini.google plan pages are client-rendered,
 *    geo-dependent (the currency and even the plan list depend on the visitor's country and sign-in state) and
 *    have no documented API or feed; scraping them from a CI runner would record the runner's country, not KR/US.
 *  - API model prices are published as documentation pages (developers.openai.com/api/docs/pricing,
 *    platform.claude.com/docs/en/about-claude/pricing, ai.google.dev/gemini-api/docs/pricing) whose table layout
 *    changes without notice; a parser would silently drift. Price changes are instead surfaced by the automated
 *    changelog adapters (openai-api-changelog, claude-release-notes, gemini-api-changelog), and a curator updates
 *    data/seed/ai/*.json from the official page.
 * Curated values live in data/seed/ai/{openai,anthropic,google}.json with per-fact sources and retrieval dates. */
export default {
 id:'ai-plans-manual',vertical:'ai',mode:'manual',freshnessHours:24*14,
 hosts:[],minIntervalMs:0,
 terms:'No automated fetching. Curators open the official pricing/help pages in a browser (US and KR storefronts) and update the seed files.',
 pages:[
  'https://chatgpt.com/pricing','https://help.openai.com/','https://developers.openai.com/api/docs/pricing',
  'https://claude.com/pricing','https://support.claude.com/','https://platform.claude.com/docs/en/about-claude/pricing',
  'https://gemini.google/subscriptions/','https://one.google.com/about/plans','https://ai.google.dev/gemini-api/docs/pricing',
 ],
 async collect(){throw Error('ai-plans-manual is a MANUAL_SOURCE adapter');},
};
