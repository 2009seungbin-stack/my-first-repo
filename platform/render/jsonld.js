// @ts-check
/** Search metadata describes visible content and actual sources. No offers, reviews, authors
 * or publication dates are manufactured to make a page qualify for a rich result. */
import {pickFact} from '../db/channel.js';
import {verticalOf} from '../verticals/index.js';
import {label} from '../labels.js';
import {renderMarkdown} from '../markdown.js';
import {channelPath} from '../channels.js';

/** @param {unknown} v */
const text=v=>typeof v==='string'&&v.trim()?v.trim():undefined;
/** Explicit HTTP(S) source URL, without credentials or a fabricated fallback. @param {unknown} value */
const sourceUrl=value=>{try{const u=new URL(String(value));return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.href:undefined;}catch{return undefined;}};
/** @param {unknown} v */
const list=v=>Array.isArray(v)?v.map(text).filter(Boolean):undefined;
/** Preserve the precision of a sourced date rather than inventing a day. @param {unknown} v */
const date=v=>typeof v==='string'&&/^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/.test(v)?v:undefined;
/** @param {unknown} v */
const integer=v=>typeof v==='number'&&Number.isInteger(v)&&v>=0?v:undefined;
/** @param {unknown} v */
const timestamp=v=>typeof v==='number'&&Number.isFinite(v)&&v>0&&v<=864e13?new Date(v).toISOString():undefined;
/** @param {Record<string,any>} o */
const present=o=>Object.fromEntries(Object.entries(o).filter(([,v])=>v!==undefined&&v!==null));

/** @param {import('../db/channel.js').Entity} e @param {import('../db/channel.js').Fact[]} facts @param {string} l @param {string} url @param {string} origin */
export function channelJsonLd(e,facts,l,url,origin){
 const trusted=new Set(['OFFICIAL','AUTOMATED','COMMUNITY_VERIFIED']);
 // Use the visible wiki's row, then omit uncertain rows instead of substituting a conflicting value.
 const f=(/** @type {string} */ p)=>{const row=pickFact(facts,p,{region:l==='ko'?'KR':'US',language:l});return row&&trusted.has(row.verification)?row.value:undefined;};
 const name=e.names[l]||e.names.en||Object.values(e.names)[0]||'',description=text(e.descriptions[l]||e.descriptions.en);
 const home=sourceUrl(f('homepage'));
 /** @type {Record<string,any>} */let thing={'@type':'Thing',name};
 switch(`${e.vertical}:${e.type}`){
  case 'games:game':thing={'@type':'CreativeWork',additionalType:'https://schema.org/VideoGame',name,genre:list(f('genres')),datePublished:date(f('release_date')),inLanguage:list(f('official_languages'))};break;
  case 'hardware:gpu':thing={'@type':'Thing',additionalType:'https://schema.org/Product',name,category:'Graphics card'};break;
  case 'ai:service':case 'studio:app':case 'studio:plugin':case 'ai:runtime':thing={'@type':'CreativeWork',additionalType:'https://schema.org/SoftwareApplication',name,version:text(f('latest_version')),datePublished:date(f('release_date'))};break;
  case 'ai:model':thing={'@type':'CreativeWork',additionalType:'https://schema.org/SoftwareApplication',name,datePublished:date(f('release_date'))};break;
  case 'subculture:work':thing={'@type':f('media_type')==='film'?'Movie':f('media_type')==='tv_anime'?'TVSeries':'CreativeWork',name,datePublished:date(f('release_date')),numberOfEpisodes:integer(f('episodes'))};break;
  // Fictional characters are not represented as real people.
  case 'subculture:character':thing={'@type':'Thing',name};break;
 }
 if(description)thing.description=description;
 if(home)thing.url=home;
 thing['@id']=`${origin}/#entity-${encodeURIComponent(e.id)}`;
 const aliases=[...new Set(Object.values(e.names).map(text).filter(n=>n&&n!==name))];if(aliases.length)thing.alternateName=aliases;
 const sources=[...new Map((e.official_urls||[]).map(x=>[sourceUrl(x.url),x])).entries()].filter(([url])=>url).map(([url,x])=>present({'@type':'WebPage',url,name:text(x.label)}));
 const v=verticalOf(e.vertical),breadcrumbId=`${url}#breadcrumb`;
 return {'@context':'https://schema.org','@graph':[
  present({'@type':'CollectionPage','@id':`${url}#webpage`,url,name,description,inLanguage:l,isPartOf:{'@id':`${origin}/#website`},breadcrumb:{'@id':breadcrumbId},about:present(thing),...(sources.length?{citation:sources}:{})}),
  {'@type':'BreadcrumbList','@id':breadcrumbId,itemListElement:[
   {'@type':'ListItem',position:1,name:'Nerulio',item:`${origin}${l==='ko'?'/':`/${l}/`}`},
   {'@type':'ListItem',position:2,name:v?label(v.label,l):e.vertical,item:`${origin}/${l}/${e.vertical}/`},
   {'@type':'ListItem',position:3,name,item:url}]}]};
}

/** Full text from the safe markdown renderer, including code blocks. Decode entities after removing
 * markup so literal user-provided <tags> remain text. @param {string} md */
export function schemaText(md){
 const entities=/** @type {Record<string,string>} */({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"});
 return renderMarkdown(md).replace(/<\/?(?:p|div|li|ul|ol|pre|blockquote|h[1-6]|br|hr|table|tr|td|th)\b[^>]*>/gi,' ').replace(/<[^>]*>/g,'').replace(/&(?:amp|lt|gt|quot|#39);/g,s=>entities[s]||s).replace(/\s+/g,' ').trim();
}

/** Human posts are forums/Q&A; collected Radar posts are publisher articles. Canonical post language
 * is used for every URL. @param {any} m @param {string} url @param {any} s */
export function postJsonLd(m,url,s){
 const p=m.post,l=p.locale==='en'?'en':'ko',origin=new URL(url).origin;
 const person=(/** @type {any} */ a)=>{
  if(a.bot)return {'@type':'Organization','@id':`${origin}/#organization`,name:'Nerulio'};
  const name=a.anon_id?`${a.author_name||'ㅇㅇ'} (${a.anon_id})`:a.author_name||s.anonymous;
  const hasProfile=!!a.author_name&&!a.anon_id&&a.author_name!=='ㅇㅇ'&&!/^user-[0-9a-z]{6}$/.test(a.author_name);
  return {'@type':'Person',name,...(hasProfile?{url:`${origin}/${l}/community/u/${encodeURIComponent(a.author_name)}`}:{})};
 };
 const text=schemaText(p.body_md),comments=m.comments.filter((/** @type {any} */ c)=>!c.deleted);
 const asComment=(/** @type {any} */ c,/** @type {string} */ type='Comment')=>present({'@type':type,'@id':`${url}#c-${c.id}`,text:schemaText(c.body_md),datePublished:timestamp(c.created_at),dateModified:timestamp(c.edited_at),author:person(c),upvoteCount:integer(c.up),url:`${url}#c-${c.id}`});
 const common=present({'@id':`${url}#post`,url,inLanguage:l,datePublished:timestamp(p.created_at),dateModified:timestamp(p.edited_at),author:person(p),isPartOf:{'@type':'CollectionPage',url:origin+channelPath(l,m.channel)},mainEntityOfPage:{'@id':`${url}#webpage`}});
 if(!p.bot&&p.kind==='question'&&comments.length){
  const acc=p.solved?comments.find((/** @type {any} */ c)=>c.id===p.solved):null;
  return {'@context':'https://schema.org','@type':'QAPage','@id':`${url}#webpage`,url,inLanguage:l,mainEntity:present({...common,'@type':'Question',name:p.title,text,answerCount:comments.length,upvoteCount:integer(p.up),
   ...(acc?{acceptedAnswer:asComment(acc,'Answer')}:{}),suggestedAnswer:comments.filter((/** @type {any} */ c)=>!acc||c.id!==acc.id).slice(0,10).map((/** @type {any} */ c)=>asComment(c,'Answer'))})};
 }
 const ids=new Set(comments.map((/** @type {any} */ c)=>c.id)),byParent=new Map();
 for(const c of comments){const parent=ids.has(c.parent_id)?c.parent_id:null;byParent.set(parent,[...(byParent.get(parent)||[]),c]);}
 /** @param {string|null} parent @param {Set<string>} [seen] @returns {any[]} */
 const thread=(parent,seen=new Set())=>(byParent.get(parent)||[]).filter((/** @type {any} */ c)=>!seen.has(c.id)).map((/** @type {any} */ c)=>{const next=new Set(seen);next.add(c.id);const replies=thread(c.id,next);return {...asComment(c),...(replies.length?{comment:replies}:{})};});
 return {'@context':'https://schema.org',...common,'@type':p.bot?'Article':'DiscussionForumPosting',headline:p.title,text,commentCount:comments.length,
  interactionStatistic:present({'@type':'InteractionCounter',interactionType:'https://schema.org/LikeAction',userInteractionCount:integer(p.up)}),comment:thread(null)};
}
