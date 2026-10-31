// @ts-check
/** The content gate (architecture §6): a channel page is indexed only when it carries ORIGINAL content,
 * so the thousands of auto-collected pages (a Steam blurb, auto-detected facts, an empty board) never
 * compete in search as thin pages. The same rule decides the page's robots meta, its hreflang cluster
 * and whether it is listed in the entity sitemaps; pages derived from an entity (change history,
 * local-LLM fit, status) follow their parent.
 *
 * An entity page in language l is indexable when index_state is not 'noindex' and one of:
 *   - index_state === 'index' (the owner's manual override),
 *   - MIN_POSTS published posts written by people (the Radar bot's news and other system accounts excluded),
 *   - an editor-written description of the page language: >= MIN_DESC_CHARS characters (ko) or
 *     MIN_DESC_WORDS words (en); a description marked "collected" (entities.description_src) never counts,
 *   - MIN_CONTRIBUTIONS community contributions: facts a moderator accepted from a member's sourced
 *     proposal (COMMUNITY_VERIFIED) plus published member compat / benchmark reports (not one-tap outage reports).
 * Collector or seed facts and relations, and the number of facts, are NOT content for this gate: they are
 * shown on the page but do not by themselves make it indexable. (typeDef.indexMin is no longer read.)
 * Thresholds were checked against the local seed: no seeded description reaches them, so only real
 * community activity or a long editorial text moves an entity out of noindex. */
import {VERTICALS} from './schema.js';

/** Sitemap files served by the Worker (PLATFORM=on): one per vertical + the community pages. */
export const PLATFORM_SITEMAPS=Object.freeze(VERTICALS.map(v=>`sitemap-n2-${v}.xml`));

export const MIN_POSTS=3;
export const MIN_CONTRIBUTIONS=3;
export const MIN_DESC_CHARS=300;
export const MIN_DESC_WORDS=60;
/** Editorial (non-collector) changes a history page needs. */
export const MIN_HISTORY_CHANGES=3;

/** @typedef {{posts?:number,contributions?:number,editorial_changes?:number}} Counts */
/** @typedef {{index_state?:string,descriptions:Record<string,string>,description_src?:Record<string,string>}} GateEntity */

/** The description a page in language l displays: its own language, else English. Korean pages may
 * fall back to English; English pages never display a Korean-only description.
 * @param {GateEntity} e @param {string} l @returns {{locale:string,text:string}|null} */
export function shownDescription(e,l){
 for(const k of l==='en'?['en']:[l,'en']){const text=String(e.descriptions?.[k]??'').trim();if(text)return {locale:k,text};}
 return null;
}
/** Is the displayed description original editorial text of substantial length?
 * @param {GateEntity} e @param {string} l */
export function editorDescription(e,l){
 const d=shownDescription(e,l);
 if(!d||e.description_src?.[d.locale]==='collected')return false;
 return d.locale==='en'?d.text.split(/\s+/).length>=MIN_DESC_WORDS:[...d.text].length>=MIN_DESC_CHARS;
}

/** Language-specific gate for page robots, hreflang and the sitemap.
 * @param {GateEntity} e @param {Counts} c @param {string} l */
export function entityIndexable(e,c,l){
 if(e.index_state==='noindex')return false;
 if(e.index_state==='index')return true;
 return (c.posts||0)>=MIN_POSTS||(c.contributions||0)>=MIN_CONTRIBUTIONS||editorDescription(e,l);
}
/** A change-history page: its parent must be indexable in that language and the history must hold
 * enough editorial (non-collector) changes of its own.
 * @param {GateEntity} e @param {Counts} c @param {string} l */
export function historyIndexable(e,c,l){
 return entityIndexable(e,c,l)&&(c.editorial_changes||0)>=MIN_HISTORY_CHANGES;
}
