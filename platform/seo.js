// @ts-check
/** The content gate (architecture §6): a channel page is indexed only when it has enough of its own
 * content — sourced facts, relations, a written description, community posts — so hundreds of
 * name-only pages (a publisher with no facts) never compete in search as thin pages. The same rule
 * decides the page's robots meta and whether it is listed in the entity sitemaps.
 *
 * AI 창작 pivot (2026-10-11): the site is an AI creation community now. The auto-generated entity pages of the
 * AI and game verticals (/{l}/ai/*, /{l}/games/*: hubs, tag pages, change histories) and the Radar stay
 * reachable but are noindex and out of the sitemaps; the community sitemap lists the home, the boards, the
 * recipe lists and the posts. The AI service status pages (/{l}/ai/{slug}/status) stay indexed. */
import {typeDef} from './verticals/index.js';
import {VERTICALS} from './schema.js';

/** Verticals whose entity pages are archived for search (noindex, no sitemap). */
export const ARCHIVED_VERTICALS=Object.freeze(['ai','games']);
/** @param {string} vertical */
export const archivedVertical=vertical=>ARCHIVED_VERTICALS.includes(vertical);
/** Sitemap files served by the Worker (PLATFORM=on): the community (home, boards, recipe lists, posts, the AI
 * status pages) and one per vertical that is still indexed. */
export const PLATFORM_SITEMAPS=Object.freeze(['sitemap-n2-community.xml',...VERTICALS.filter(v=>!archivedVertical(v)).map(v=>`sitemap-n2-${v}.xml`)]);

/**
 * @param {{vertical:string,type:string,index_state?:string}} e
 * @param {{facts:number,relations:number,posts:number,description:boolean}} c
 */
export function contentScore(e,c){return c.facts+c.relations+Math.min(c.posts,5)+(c.description?2:0);}
/** @param {{vertical:string,type:string,index_state?:string}} e @param {{facts:number,relations:number,posts:number,description:boolean}} c */
export function indexable(e,c){
 if(archivedVertical(e.vertical))return false;
 if(e.index_state==='index')return true;
 if(e.index_state==='noindex')return false;
 const min=typeDef(e.vertical,e.type)?.indexMin??3;
 // Enough material overall, and something beyond bare numbers: a description, posts, or a rich fact sheet.
 return contentScore(e,c)>=min+2&&(c.description||c.posts>0||c.facts>=min+3);
}
