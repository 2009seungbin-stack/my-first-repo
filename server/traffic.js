// @ts-check
/** PLACEHOLDER owned by the TRAFFIC agent (docs: admin contract). The coordinator replaces this file
 * with the real traffic module; until then the admin overview shows traffic:null and
 * GET /api/v2/admin/traffic answers 503 NOT_CONFIGURED. Keep the two exports' signatures. */

/** Compact traffic numbers for the admin overview, or null when not configured.
 * @param {any} _env @param {number} _now @returns {Promise<{humanPageviews:number,botRequests:number,aiBotRequests:number,topBot:string|null}|null>} */
export async function trafficSummary(_env,_now){return null;}
/** The full GET /api/v2/admin/traffic body, or null when not configured.
 * @param {any} _env @param {{range:'today'|'7d'|'30d',now:number}} _o @returns {Promise<Record<string,unknown>|null>} */
export async function trafficReport(_env,_o){return null;}
