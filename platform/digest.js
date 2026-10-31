// @ts-check
/** The AI weekly digest (docs/AI-DIGEST.md): human-reviewed commentary for game-asset and file
 * workflows, served by the Worker at /{l}/ai/digest/ and /{l}/ai/digest/{slug}/.
 * Only published articles exist here (the build writes nothing else into digest-data.js), and every
 * reader filters on status again, so a draft can never be rendered, listed, linked or sitemapped.
 * While a language has no published article, its digest index is noindex, unlinked and unlisted. */
import DATA from './digest-data.js';
import {PLATFORM_LOCALES} from './schema.js';

/** @typedef {{title:string,url:string}} DigestSource */
/** @typedef {{slug:string,locale:string,date:string,updated:string,title:string,summary:string,status:string,sources:DigestSource[],body:string}} DigestArticle */

/** @type {readonly DigestArticle[]} */
let ARTICLES=DATA;
/** Replace the article list (tests with fixtures, the local dev server). Drafts are dropped here too.
 * @param {readonly DigestArticle[]} list */
export function useDigestArticles(list){ARTICLES=Object.freeze(list.filter(a=>a.status==='published'));}

/** Published articles of a language, newest first. @param {string} l @returns {DigestArticle[]} */
export function digestArticles(l){
 return ARTICLES.filter(a=>a.status==='published'&&a.locale===l).sort((a,b)=>b.date.localeCompare(a.date)||a.slug.localeCompare(b.slug));
}
/** @param {string} l @param {string} slug */
export const digestArticle=(l,slug)=>digestArticles(l).find(a=>a.slug===slug)||null;
/** @param {string} l */
export const digestIndexPath=l=>`/${l}/ai/digest/`;
/** @param {string} l @param {string} slug */
export const digestArticlePath=(l,slug)=>`/${l}/ai/digest/${slug}/`;

/** The one place that decides whether the digest is linked (the AI entry of the menu, the home page's
 * AI area): a link only when the language has at least one published article.
 * @param {string} l @returns {{name:string,href:string}|null} */
export function digestLink(l){
 if(!digestArticles(l).length)return null;
 return {name:l==='ko'?'AI 주간 해설':'AI weekly digest',href:digestIndexPath(l)};
}

/** Sitemap entries (published only): the index of every language with an article, then each article;
 * alternates only between published translations. @param {string} origin
 * @returns {{alt:Record<string,string>,lastmod:number}[]} */
export function digestSitemapEntries(origin){
 const time=(/** @type {DigestArticle[]} */ list)=>Math.max(0,...list.map(a=>Date.parse(a.updated||a.date)||0));
 const langs=PLATFORM_LOCALES.filter(l=>digestArticles(l).length);
 if(!langs.length)return [];
 /** @type {{alt:Record<string,string>,lastmod:number}[]} */
 const out=[{alt:Object.fromEntries(langs.map(l=>[l,origin+digestIndexPath(l)])),lastmod:time(langs.flatMap(digestArticles))}];
 const slugs=[...new Set(langs.flatMap(l=>digestArticles(l).map(a=>a.slug)))];
 for(const slug of slugs){
  const tr=langs.map(l=>digestArticle(l,slug)).filter(a=>!!a);
  out.push({alt:Object.fromEntries(tr.map(a=>[a.locale,origin+digestArticlePath(a.locale,slug)])),lastmod:time(tr)});
 }
 return out;
}
