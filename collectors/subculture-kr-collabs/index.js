// @ts-check
/** MANUAL_SOURCE: Korean collaboration cafés, pop-up stores, fan events and conventions.
 *
 * Why manual: announcements are spread over official X/Instagram accounts, brand event pages,
 * department-store pages, ticketing pages and organizer sites; none offers a documented feed or API
 * and most pages render client-side. Curators maintain these rows in the admin console (or seed files)
 * following docs/n2/sources-subculture.md §Manual workflows. runAdapter() never fetches for this adapter.
 */
export default {
 id:'subculture-kr-collabs',
 vertical:'subculture',
 mode:'manual',
 freshnessHours:24*7,
 hosts:[],
 minIntervalMs:0,
 terms:'Official announcement pages only; read via browser or the documented X oEmbed endpoint (publish.twitter.com/oembed). No scraping of search engines or social feeds.',
 /** Where curators look, in order of preference. */
 channels:[
  'Organizer sites: comicw.co.kr (Seoul/Busan Comic World), gstar.or.kr, AGF Korea official site, sites.google.com/mihoyo.com (HoYoLAND)',
  'Official Korean IP accounts on X (e.g. @WW_KR_Official) — read single posts through https://publish.twitter.com/oembed?url=<post>',
  'Brand / venue event pages: department stores (The Hyundai, Lotte, Shinsegae), café chains, animate Korea',
  'Ticketing pages (Ticketlink, Interpark/NOL, Yes24) for dates, venue and price',
  'Game official notice boards (Nexon forum, HoYoverse official sites) for in-game tie-ins',
 ],
 /** Checklist per row. */
 workflow:[
  'Open the official page; record title (en+ko), start/end with the precision given (time/day/month), region, venue, url.',
  'Pick kind: popup | collab | event | exhibition | sale (pre-order deadlines).',
  'Source kind OFFICIAL; if only a press report of the rights holder\'s announcement exists, CURATED with a note — never COMMUNITY posts.',
  'Link entities: the franchise (+ characters when named); create a collaboration/event entity only when it deserves its own page.',
  'Re-check weekly while upcoming; set status postponed/cancelled/ended when it changes.',
 ],
 async collect(){throw Error('manual adapter: maintained by curators');},
};
