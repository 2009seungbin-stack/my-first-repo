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
 *   - an editor-written description in the page language itself (no fallback to another locale):
 *     >= MIN_DESC_CHARS characters (ko) or MIN_DESC_WORDS words (en); a description marked "collected"
 *     (entities.description_src) never counts,
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
/** Editorial changes a history page needs: changes.origin is 'collector' for every change a collector
 * produced, including collector output synced in seed mode (a change citing a source with an adapter). */
export const MIN_HISTORY_CHANGES=3;

/** @typedef {{posts?:number,contributions?:number,editorial_changes?:number}} Counts */
/** @typedef {{index_state?:string,descriptions:Record<string,string>,description_src?:Record<string,string>}} GateEntity */

/** Is there original editorial text of substantial length IN the page language l? A Korean page that
 * falls back to an English description has no Korean text of its own, so the fallback never counts.
 * @param {GateEntity} e @param {string} l */
export function editorDescription(e,l){
 const text=String(e.descriptions?.[l]??'').trim();
 if(!text||e.description_src?.[l]==='collected')return false;
 return l==='en'?text.split(/\s+/).length>=MIN_DESC_WORDS:[...text].length>=MIN_DESC_CHARS;
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
