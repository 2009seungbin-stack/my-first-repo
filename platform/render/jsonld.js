// @ts-check
/** schema.org data for a channel page, by entity type, built only from current sourced facts
 * (nothing is filled in when a fact is missing), plus the breadcrumb Nerulio › vertical › channel. */
import {pickFact} from '../db/channel.js';
import {verticalOf} from '../verticals/index.js';
import {label} from '../labels.js';
import {nameOf} from './ui.js';
import {PLATFORM_NAMES} from './format.js';

/** @param {import('../db/channel.js').Entity} e @param {import('../db/channel.js').Fact[]} facts @param {string} l @param {string} url @param {string} origin */
export function channelJsonLd(e,facts,l,url,origin){
 const f=(/** @type {string} */ p)=>pickFact(facts,p)?.value;
 const name=nameOf(e,l),description=e.descriptions[l]||e.descriptions.en||undefined;
 const home=f('homepage');
 /** @type {Record<string,any>} */let thing={'@type':'Thing',name};
 const list=(/** @type {unknown} */ v)=>Array.isArray(v)?v.map(x=>PLATFORM_NAMES[x]||x):undefined;
 switch(`${e.vertical}:${e.type}`){
  case 'games:game':thing={'@type':'VideoGame',name,gamePlatform:list(f('platforms')),genre:list(f('genres')),datePublished:f('release_date'),inLanguage:list(f('official_languages'))};break;
  case 'hardware:gpu':thing={'@type':'Product',name,category:'Graphics card',releaseDate:f('release_date')};break;
  case 'ai:service':case 'studio:app':case 'studio:plugin':case 'ai:runtime':thing={'@type':'SoftwareApplication',name,operatingSystem:list(f('platforms')||f('os_support')),applicationCategory:e.vertical==='studio'?'MultimediaApplication':'BusinessApplication',softwareVersion:f('latest_version'),datePublished:f('release_date')};break;
  case 'ai:model':thing={'@type':'SoftwareApplication',name,applicationCategory:'DeveloperApplication',datePublished:f('release_date')};break;
  case 'subculture:work':thing={'@type':f('media_type')==='film'?'Movie':f('media_type')==='tv_anime'?'TVSeries':'CreativeWork',name,datePublished:f('release_date'),numberOfEpisodes:f('episodes')};break;
  case 'subculture:character':thing={'@type':'Person',name};break;
 }
 if(description)thing.description=description;
 if(home)thing.url=home;
 const v=verticalOf(e.vertical);
 return {'@context':'https://schema.org','@graph':[
  {'@type':'CollectionPage','@id':url,url,name,inLanguage:l,about:Object.fromEntries(Object.entries(thing).filter(([,x])=>x!==undefined&&x!==null))},
  {'@type':'BreadcrumbList',itemListElement:[
   {'@type':'ListItem',position:1,name:'Nerulio',item:`${origin}/${l}/community/`},
   {'@type':'ListItem',position:2,name:v?label(v.label,l):e.vertical,item:`${origin}/${l}/radar/?v=${e.vertical}`},
   {'@type':'ListItem',position:3,name,item:url}]}]};
}
