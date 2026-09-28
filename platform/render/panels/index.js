// @ts-check
/** Channel panels: the live block at the top of a channel and the facts in its wiki box, one module
 * per kind of channel. A panel = {types, load(ctx) → data, top(data,ctx), wiki(data,ctx), side?(data,ctx),
 * live?(data)}. load() does all reads (through platform/db); the render functions are pure. */
import ai from './ai.js';
import game from './game.js';
import gpu from './gpu.js';
import studio from './studio.js';
import ip from './ip.js';
import model from './model.js';
import generic from './generic.js';

/** @typedef {import('../../db/channel.js').Entity} Entity */
/** @typedef {import('../../db/channel.js').Fact} Fact */
/** @typedef {{db:any,entity:Entity,facts:Fact[],l:string,now:number,region:string}} PanelContext */
/** @typedef {{id:string,types:string[],load(ctx:PanelContext):Promise<any>,top(d:any,ctx:PanelContext):unknown,wiki(d:any,ctx:PanelContext):unknown,side?(d:any,ctx:PanelContext):unknown,live?(d:any,ctx:PanelContext):boolean}} Panel */

/** @type {Panel[]} */
export const PANELS=[ai,model,game,gpu,studio,ip];
/** The panel for a channel ("vertical:type"), or the generic facts panel. @param {Entity} e @returns {Panel} */
export function panelFor(e){return PANELS.find(p=>p.types.includes(`${e.vertical}:${e.type}`))||generic;}
