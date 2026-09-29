/** Build pieces of the visitor/bot statistics (server/traffic.js). Active only when config.traffic
 * (SERVICE_API=on + PLATFORM=on); every other build is byte-for-byte unchanged. */
/** The beacon: one classic deferred script from our own origin (CSP script-src 'self'; ads builds
 * nonce it like every other script). Absolute path: static pages carry a relative <base>. */
export const BEACON_TAG='<script src="/src/hit.js" defer></script>';
/** @param {string} html @param {{traffic?:boolean}} config */
export function withBeacon(html,config){
 if(!config?.traffic||html.includes(BEACON_TAG))return html;
 return html.replace('</head>',BEACON_TAG+'</head>');
}
/** Crawler files that always go through the Worker in traffic builds: robots.txt is the strongest
 * "a crawler is here" signal and costs a few hundred requests a day at most. */
export const TRAFFIC_ROUTES=Object.freeze(['/robots.txt','/sitemap*']);
/** @param {string} rule an _routes.json rule */
export const crawlerFile=rule=>rule==='/robots.txt'||rule.startsWith('/sitemap');
/** Root files that stay off the Worker when TRAFFIC_HTML=on routes everything else through it. */
export const TRAFFIC_HTML_EXCLUDES=Object.freeze(['/favicon.ico','/apple-touch-icon.png','/build.txt','/404.html']);
