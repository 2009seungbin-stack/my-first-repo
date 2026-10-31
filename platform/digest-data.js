// @ts-check
/** The published AI weekly digest articles (docs/AI-DIGEST.md). Replaced in
 * dist/_worker.js/platform/digest-data.js by tools/build.mjs with the articles of content/ai-digest/
 * whose status is `published` (tools/digest-build.mjs); drafts never reach the build output.
 * This source default is empty: tests and the dev server set their own list (platform/digest.js). */
export default Object.freeze(/** @type {import('./digest.js').DigestArticle[]} */([]));
