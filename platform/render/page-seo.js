// @ts-check
/** A single connected graph per page. Uses public brand identity and actual page metadata only. */
import {siteGraph,BRAND} from '../../src/brand.js';

/** Merge page-specific schema with stable page/site/publisher identity, preserving specialized
 * CollectionPage and QAPage nodes and custom graph order. No fake dates or reviews.
 * @param {{l:string,title:string,description:string,canonical:string,jsonld?:object|null,noindex?:boolean}} o */
export function pageJsonLd(o){
 const origin=new URL(o.canonical).origin,root=`${origin}/`,pageId=`${o.canonical}#webpage`;
 const {site,org}=siteGraph(root,o.l);site.inLanguage=/** @type {any} */([...BRAND.supportedLanguages]);
 /** @type {Record<string,any>} */const input=o.jsonld||{};
 /** @type {Record<string,any>[]} */const supplied=Array.isArray(input['@graph'])?input['@graph']:input['@type']?[input]:[];
 const nodes=supplied.map(x=>{const {'@context':_,...node}=x;return node;});
 const base={'@type':'WebPage','@id':pageId,url:o.canonical,name:o.title,description:o.description,inLanguage:o.l,isPartOf:{'@id':site['@id']},publisher:{'@id':org['@id']}};
 const specific=nodes.findIndex(x=>x['@id']===pageId);
 if(specific>=0)nodes[specific]={...base,...nodes[specific]};else nodes.push(base);
 // Individual discussions and articles are primary entities of their canonical page.
 const primary=nodes.find(x=>x['@type']==='DiscussionForumPosting'||x['@type']==='Article');
 const page=nodes.find(x=>x['@id']===pageId);
 if(primary){if(!primary['@id'])primary['@id']=`${o.canonical}#post`;primary.mainEntityOfPage={'@id':pageId};if(page&&!page.mainEntity)page.mainEntity={'@id':primary['@id']};}
 for(const identity of [site,org]){const i=nodes.findIndex(x=>x['@id']===identity['@id']);if(i<0)nodes.push(identity);else nodes[i]={...identity,...nodes[i]};}
 return {'@context':'https://schema.org','@graph':nodes};
}
