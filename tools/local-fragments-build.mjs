import {versionedAsset} from './asset-version.mjs';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const decode=value=>value.replace(/&(amp|quot|apos|lt|gt|#39);/g,(_,name)=>({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>','#39':"'"})[name]);
const skipped=/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1>/gi;
const attribute=(tag,name)=>tag.match(new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`,'i'));
/** A base URL also changes #fragment links. Qualify only anchors whose target is in this
 * document; application-state hashes and template/script content are left alone. */
export function withLocalFragments(html,route){
 if(!/<base\b[^>]*\bhref=/i.test(html))return html;
 const visible=html.replace(skipped,''),ids=new Set([...visible.matchAll(/\sid\s*=\s*(["'])(.*?)\1/gi)].map(m=>decode(m[2]))),skipTargets=new Set();
 const prefix=route.replace(/^\/+|\/+$/g,'');let count=0;
 html=html.replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1>|<a\b[^>]*>/gi,(tag,ignored)=>{
  if(ignored)return tag;
  const href=attribute(tag,'href');if(!href||!href[2].startsWith('#')||href[2]==='#')return tag;
  let id;try{id=decodeURIComponent(decode(href[2].slice(1)));}catch{return tag;}
  if(!ids.has(id))return tag;
  const classes=attribute(tag,'class')?.[2].split(/\s+/)||[];
  if(classes.some(name=>['skip','gs-skip','skip-link'].includes(name)))skipTargets.add(id);
  count++;
  return tag.replace(href[0],` href="${escape((prefix?prefix+'/':'./')+'#'+encodeURIComponent(id))}" data-local-fragment="${escape(id)}"`);
 });
 if(!count)return html;
 html=html.replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1>|<(?:main|section|article|div|span|h[1-6])\b[^>]*>/gi,(tag,ignored)=>{
  if(ignored)return tag;
  const id=attribute(tag,'id');return id&&skipTargets.has(decode(id[2]))&&!/\stabindex\s*=/i.test(tag)?tag.slice(0,-1)+' tabindex="-1">':tag;
 });
 // Keep the base before this module so its relative src resolves to the shared asset root.
 return html.replace(/<base\b[^>]*>/i,tag=>tag+`<script type="module" src="${versionedAsset('src/local-fragments.js')}" data-local-fragments></script>`);
}
