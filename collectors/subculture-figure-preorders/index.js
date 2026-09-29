// @ts-check
/** MANUAL_SOURCE: figures and premium merchandise (price, pre-order window, release month).
 *
 * Why manual: manufacturers publish product pages without a documented API; release months slip often and
 * are announced as page edits or delay notices. Curators copy the list price, pre-order window and release
 * month from the manufacturer's own product page (Good Smile Company, Kotobukiya, Alter, MegaHouse, FuRyu,
 * Bandai Spirits/Tamashii, Aniplex+, …) and re-check monthly and on delay notices.
 */
export default {
 id:'subculture-figure-preorders',
 vertical:'subculture',
 mode:'manual',
 freshnessHours:24*30,
 hosts:[],
 minIntervalMs:0,
 terms:'Manufacturer product pages only (check each site\'s robots.txt); no retailer or reseller prices.',
 channels:['Manufacturer product pages and their "delay notice" / news pages'],
 workflow:[
  'Record manufacturer_name, price with currency and tax note, preorder_start/preorder_end as stated, release_date at month precision.',
  'Relations: merchandise_of the character and the franchise.',
  'On a delay notice: update release_date (the diff engine keeps the old value in history) and add a note.',
 ],
 async collect(){throw Error('manual adapter: maintained by curators');},
};
