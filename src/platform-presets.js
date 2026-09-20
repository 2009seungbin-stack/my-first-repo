/** Chosen output sizes are presets, not claims of mandatory platform dimensions. */
export const PLATFORM_PRESETS = Object.freeze([
  {id:'etsy', name:'Etsy', width:3000, height:2000, format:'jpeg', background:'#ffffff',
    notes:'App-selected landscape size. Etsy recommends both dimensions at least 2000 px; listing transparency is unsupported.',
    source:'https://help.etsy.com/hc/en-us/articles/115015663347-Requirements-and-Best-Practices-for-Images-in-Your-Etsy-Shop', sourceCheckedAt:'2026-09-20'},
  {id:'shopify', name:'Shopify', width:2048, height:2048, format:'jpeg', background:'#ffffff',
    notes:'Shopify recommends 2048 × 2048 for square product images; theme requirements can vary.',
    source:'https://help.shopify.com/en/manual/products/product-media/product-media-types', sourceCheckedAt:'2026-09-20'}
]);
export const PRINT_RATIOS = [[2,3,'2x3'],[3,4,'3x4'],[4,5,'4x5'],[11,14,'11x14'],[1,Math.SQRT2,'A-series']];
export {BRAND} from './brand.js';
