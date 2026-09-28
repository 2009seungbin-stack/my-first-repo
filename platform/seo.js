// @ts-check
/** The content gate (architecture §6): a channel page is indexed only when it has enough of its own
 * content — sourced facts, relations, a written description, community posts — so hundreds of
 * name-only pages (a publisher with no facts) never compete in search as thin pages. The same rule
 * decides the page's robots meta and whether it is listed in the entity sitemaps. */
import {typeDef} from './verticals/index.js';
import {VERTICALS} from './schema.js';

/** Sitemap files served by the Worker (PLATFORM=on): one per vertical + the community pages. */
export const PLATFORM_SITEMAPS=Object.freeze(VERTICALS.map(v=>`sitemap-n2-${v}.xml`));

/**
 * @param {{vertical:string,type:string,index_state?:string}} e
 * @param {{facts:number,relations:number,posts:number,description:boolean}} c
 */
export function contentScore(e,c){return c.facts+c.relations+Math.min(c.posts,5)+(c.description?2:0);}
/** @param {{vertical:string,type:string,index_state?:string}} e @param {{facts:number,relations:number,posts:number,description:boolean}} c */
export function indexable(e,c){
 if(e.index_state==='index')return true;
 if(e.index_state==='noindex')return false;
 const min=typeDef(e.vertical,e.type)?.indexMin??3;
 // Enough material overall, and something beyond bare numbers: a description, posts, or a rich fact sheet.
 return contentScore(e,c)>=min+2&&(c.description||c.posts>0||c.facts>=min+3);
}
