// @ts-check
/** Line icons of the platform pages (24×24, 2px stroke in the text color), drawn inline so they look the
 * same on every device: the Unicode glyphs they replace (⚙ ✎ ⚑ ◆ ✓ ★ ▲) turn into color emoji on
 * some phones. Decorative: every icon is aria-hidden and sits next to a text label or an aria-label. */
import {html,raw} from './html.js';

/** Path data per icon (stroke only unless the name ends in a filled variant below). */
const P=/** @type {Record<string,string>} */({
 home:'<path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1Z"/>',
 star:'<path d="m12 3.8 2.5 5.1 5.6.8-4 3.9 1 5.6L12 16.6l-5.1 2.6 1-5.6-4-3.9 5.6-.8Z"/>',
 radar:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12 18.5 5.5"/>',
 pin:'<path d="M12 17v5"/><path d="M9 10.8V4h6v6.8l3 3.2H6Z"/>',
 folder:'<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z"/>',
 gamepad:'<path d="M7.5 8h9a4.5 4.5 0 0 1 4.3 5.8l-1 3.2a2.4 2.4 0 0 1-4 1L14 16h-4l-1.8 2a2.4 2.4 0 0 1-4-1l-1-3.2A4.5 4.5 0 0 1 7.5 8Z"/><path d="M8 11v3M6.5 12.5h3"/><circle cx="15.5" cy="11.5" r=".6"/><circle cx="17" cy="13.5" r=".6"/>',
 compress:'<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
 convert:'<path d="M4 9a7.5 7.5 0 0 1 13.4-3.2L19.5 8"/><path d="M19.5 3.5V8H15"/><path d="M20 15a7.5 7.5 0 0 1-13.4 3.2L4.5 16"/><path d="M4.5 20.5V16H9"/>',
 resize:'<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M9 15l6-6M11 9h4v4"/>',
 eraser:'<path d="m14.5 4.5 5 5-9 9H6l-2.5-2.5a1.5 1.5 0 0 1 0-2.1Z"/><path d="M9.5 9.5l5 5M11 20h9"/>',
 film:'<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M7.5 4.5v15M16.5 4.5v15M3.5 9h4M3.5 15h4M16.5 9h4M16.5 15h4"/>',
 filePlus:'<path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5Z"/><path d="M14 3.5v5h5M12 11.5v6M9 14.5h6"/>',
 photo:'<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m20.5 16-4.5-4.5-8 8"/>',
 sprite:'<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><circle cx="12" cy="9" r="2"/><path d="M8.5 17c.6-2.3 1.8-3.5 3.5-3.5s2.9 1.2 3.5 3.5"/>',
 pixel:'<rect x="4" y="4" width="5" height="5" rx=".6"/><rect x="15" y="4" width="5" height="5" rx=".6"/><rect x="9.5" y="9.5" width="5" height="5" rx=".6"/><rect x="4" y="15" width="5" height="5" rx=".6"/><rect x="15" y="15" width="5" height="5" rx=".6"/>',
 tile:'<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.2"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.2"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.2"/><rect x="13" y="13" width="7.5" height="7.5" rx="1.2"/>',
 sheet:'<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17"/>',
 scissors:'<circle cx="6.5" cy="7" r="2.5"/><circle cx="6.5" cy="17" r="2.5"/><path d="M8.6 8.4 20 17M8.6 15.6 20 7"/>',
 palette:'<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.9 1.4-2-.5-1.3.2-2.5 1.6-2.5h2.1a3.4 3.4 0 0 0 3.4-3.4C20.5 7.3 16.7 3.5 12 3.5Z"/><circle cx="7.8" cy="11" r="1"/><circle cx="10.5" cy="7.5" r="1"/><circle cx="15" cy="8" r="1"/>',
 font:'<path d="M3.5 18.5 8 5.5l4.5 13M5.2 14h5.6"/><path d="M20 18.5v-6.2a2.8 2.8 0 0 0-5-1.7M20 15.4c-2.8-.5-5.5.2-5.5 1.9 0 1.1 1 1.7 2.1 1.7 1.8 0 3.4-1.4 3.4-3.6"/>',
 check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',
 okCircle:'<circle cx="12" cy="12" r="8.5"/><path d="m8.3 12.3 2.6 2.6 5-5.3"/>',
 alert:'<path d="M10.3 4.8 2.9 17.6A2 2 0 0 0 4.6 20.6h14.8a2 2 0 0 0 1.7-3L13.7 4.8a2 2 0 0 0-3.4 0Z"/><path d="M12 9.5v4.5M12 17.2v.1"/>',
 xCircle:'<circle cx="12" cy="12" r="8.5"/><path d="m9 9 6 6M15 9l-6 6"/>',
 dashCircle:'<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12h7"/>',
 eye:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
 bubble:'<path d="M20.5 11.5a7.5 7.5 0 0 1-11 6.6L4 19.5l1.4-4.6A7.5 7.5 0 1 1 20.5 11.5Z"/>',
 up:'<path d="M12 19V5.5M6 11.5l6-6 6 6"/>',
 down:'<path d="M12 5v13.5M6 12.5l6 6 6-6"/>',
 flame:'<path d="M12 21a6.5 6.5 0 0 0 6.5-6.5c0-4.5-4-6.5-4.5-10.5-2.7 1.8-3.6 4.4-3.5 6.4-1.2-.6-1.9-1.8-2.1-3C6.5 9.5 5.5 11.8 5.5 14.5A6.5 6.5 0 0 0 12 21Z"/>',
 clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
 pencil:'<path d="M15.5 4.5 19.5 8.5 8.5 19.5H4.5v-4Z"/><path d="m13 7 4 4"/>',
 share:'<circle cx="17.5" cy="5.5" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/><path d="m8.7 10.7 6.6-3.9M8.7 13.3l6.6 3.9"/>',
 link:'<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
 flag:'<path d="M5.5 21V4.5M5.5 4.5h11l-2 4 2 4h-11"/>',
 news:'<rect x="3.5" y="4.5" width="14" height="15" rx="2"/><path d="M17.5 8.5h3v9a2 2 0 0 1-2 2h-1M7 8.5h7M7 12h7M7 15.5h4"/>',
 calendar:'<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
 pulse:'<path d="M3 12h4l2.5-6 5 12 2.5-6h4"/>',
 sparkle:'<path d="M12 3.5c.8 4.4 3.1 6.7 7.5 7.5-4.4.8-6.7 3.1-7.5 7.5-.8-4.4-3.1-6.7-7.5-7.5 4.4-.8 6.7-3.1 7.5-7.5Z"/><path d="M19 3.5v3M17.5 5h3"/>',
 chip:'<rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/><rect x="9.5" y="9.5" width="5" height="5" rx=".5"/><path d="M9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3"/>',
 brush:'<path d="M19.5 3.5c-3 1-8 5.8-9.7 8.3l2.4 2.4c2.5-1.7 7.3-6.7 8.3-9.7Z"/><path d="M9.8 11.8c-2.3-.3-4.3 1.2-4.3 3.7 0 1.5-.8 2.6-2 3 3.5 1.4 8.4.6 8.7-4.3Z"/>',
 starBubble:'<path d="M20.5 11.5a7.5 7.5 0 0 1-11 6.6L4 19.5l1.4-4.6A7.5 7.5 0 1 1 20.5 11.5Z"/><path d="m13 7.8 1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3Z"/>',
 chat:'<path d="M4.5 5.5h15a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1H10l-4.5 3.5V17h-1a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z"/><path d="M8 10h8M8 13h5"/>',
 megaphone:'<path d="M4 10v4a1 1 0 0 0 1 1h2.5L15 19.5v-15L7.5 9H5a1 1 0 0 0-1 1Z"/><path d="M18 9a4 4 0 0 1 0 6M8 15l1 4.5h2.5"/>',
 gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7"/><circle cx="12" cy="12" r="6.5"/>',
 diamond:'<path d="M12 3 21 12 12 21 3 12Z"/>',
 pen:'<path d="M15.5 4.5 19.5 8.5 8.5 19.5H4.5v-4Z"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
});
/** Icons drawn filled in the text color. */
const FILLED=new Set(['diamondFill','starFill','upFill']);
const F=/** @type {Record<string,string>} */({
 diamondFill:'<path d="M12 3 21 12 12 21 3 12Z"/>',
 starFill:P.star,
 upFill:'<path d="M12 4.5 20 14h-5v5.5H9V14H4Z"/>',
});
/** An icon by name. @param {string} name @param {number} [size] @param {string} [cls] */
export function icon(name,size=18,cls=''){
 const filled=FILLED.has(name),d=filled?F[name]:P[name];
 if(!d)throw Error(`unknown icon ${name}`);
 return html`<svg class="i${cls?` ${cls}`:''}" width="${size}" height="${size}" viewBox="0 0 24 24" ${raw(filled?'fill="currentColor" stroke="none"':'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"')} aria-hidden="true" focusable="false">${raw(d)}</svg>`;
}
export const ICON_NAMES=Object.freeze([...Object.keys(P),...FILLED]);

/** Channel icons (the tiles on the icon column, the feed and channel headers). */
export const CHANNEL_ICON=/** @type {Record<string,string>} */({ai:'sparkle',games:'gamepad',hw:'chip',studio:'brush',sub:'starBubble',free:'chat',notice:'megaphone',patch:'pin'});
/** Tier badges: ◇ contributor, ◆ trusted, ⚑ maintainer, ✎ curator. */
export const TIER_ICON=/** @type {Record<string,string>} */({contributor:'diamond',trusted:'diamondFill',maintainer:'flag',curator:'pen'});
/** AI status shapes, so the state never rests on color alone. */
export const STATUS_ICON=/** @type {Record<string,string>} */({ok:'okCircle',warn:'alert',bad:'xCircle',unk:'dashCircle'});

/** A generated picture per nickname (a 5×5 mirrored pattern, one of six tile colors), for people without
 * a photo; the same name always gets the same picture. @param {string} name @param {number} [size] */
export function identicon(name,size=30){
 let h=2166136261;for(const ch of String(name))h=Math.imul(h^(ch.codePointAt(0)||0),16777619)>>>0;
 const tone=h%6,cells=[];
 for(let y=0;y<5;y++)for(let x=0;x<3;x++){h=Math.imul(h^(x*7+y*13),2246822519)>>>0;if(h&4)cells.push([x,y]);}
 if(!cells.length)cells.push([1,2]);
 const rects=cells.flatMap(([x,y])=>(x===2?[x]:[x,4-x]).map(cx=>`<rect x="${4+cx*3.2}" y="${4+y*3.2}" width="3.2" height="3.2"/>`)).join('');
 return html`<svg class="idc t${tone}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect class="bg" width="24" height="24" rx="12"/><g class="fg">${raw(rects)}</g></svg>`;
}

/** Empty-state picture: an open box with a dotted outline, in the muted text color. */
export const EMPTY_ART=html`<svg class="empty-art" width="72" height="56" viewBox="0 0 72 56" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 24 36 14l24 10v20L36 54 12 44Z"/><path d="M12 24l24 10 24-10M36 34v20"/><path d="M12 24 4 16l24-10 8 8M60 24l8-8-24-10-8 8" stroke-dasharray="3 4"/></svg>`;
