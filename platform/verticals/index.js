// @ts-check
import ai from './ai.js';
import games from './games.js';
import hardware from './hardware.js';
import studio from './studio.js';
import subculture from './subculture.js';
/** Registry of vertical modules. Adding a vertical = one config file here + seed data + collectors. */
export const VERTICAL_DEFS=Object.freeze({ai,games,hardware,studio,subculture});
/** @param {string} id @returns {import('./_define.js').VerticalDef|null} */
export const verticalOf=id=>/** @type {Record<string,import('./_define.js').VerticalDef>} */(VERTICAL_DEFS)[id]||null;
/** @param {string} vertical @param {string} type */
export function typeDef(vertical,type){return verticalOf(vertical)?.types[type]||null;}
/** @param {string} vertical @param {string} property */
export function propertyDef(vertical,property){return verticalOf(vertical)?.properties[property]||null;}
/** The vertical a type belongs to, when the type is unique across verticals. @param {string} type */
export function verticalsForType(type){return Object.values(VERTICAL_DEFS).filter(v=>type in v.types).map(v=>v.id);}
