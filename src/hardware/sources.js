// @ts-check
/** Declared scheduled-collection targets, shared with the reader-facing coverage guide.
 * A target is not a current availability, successful-fetch or sale-inventory claim.
 * board is the collector endpoint; page is the corresponding human-readable marketplace.
 */
export const MARKET_SOURCES=Object.freeze([
 {id:'giggle',name:'기글하드웨어',country:'KR',currency:'KRW',host:'gigglehd.com',board:'https://gigglehd.com/gg/index.php?mid=bbs&category=14058',page:'https://gigglehd.com/gg/index.php?mid=bbs&category=14058'},
 {id:'hardforum',name:'HardForum RSS',country:'US',currency:'USD',host:'hardforum.com',board:'https://hardforum.com/forums/for-sale-trade.17/index.rss',page:'https://hardforum.com/forums/for-sale-trade.17/'},
 {id:'hardwarefr',name:'Hardware.fr',country:'FR',currency:'EUR',host:'forum.hardware.fr',board:'https://forum.hardware.fr/hfr/AchatsVentes/Hardware/liste_sujet-1.htm',page:'https://forum.hardware.fr/hfr/AchatsVentes/Hardware/liste_sujet-1.htm'}
]);
