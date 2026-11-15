/** Ranking for the home tool finder (src/task/home.js opens it with "/" or Ctrl/⌘+K). Pure: no
 * DOM. An entry is {title,search,group,…}: `search` is the haystack the directory already builds
 * for every card (title, description, search terms, id, path), `group` the heading it sits under. */
const norm=s=>String(s||'').normalize('NFKC').toLowerCase();
export const finderWords=query=>norm(query).split(/\s+/).filter(Boolean);
/** 0 when a word is missing; otherwise higher for matches in the title, highest at its start. */
export function finderScore(words,entry){
 const title=norm(entry.title),hay=title+' '+norm(entry.search),parts=title.split(/[\s·・,\/()→\-_]+/).filter(Boolean);
 let score=1;
 for(const w of words){
  if(!hay.includes(w))return 0;
  score+=title.startsWith(w)?40:parts.some(p=>p.startsWith(w))?25:title.includes(w)?15:1;
 }
 const whole=words.join(' ');
 if(title===whole)score+=50;else if(title.startsWith(whole))score+=30;
 return score;
}
/** Matches, best first; ties keep directory order. An empty query gives the first tool of each
 * group, so the list opens as an overview of what the site does. */
export function rankTools(query,entries){
 const words=finderWords(query);
 if(!words.length){const seen=new Set();return entries.filter(e=>!seen.has(e.group)&&seen.add(e.group));}
 return entries.map((e,i)=>[finderScore(words,e),i,e]).filter(r=>r[0]>0).sort((a,b)=>b[0]-a[0]||a[1]-b[1]).map(r=>r[2]);
}
/** Next active row for a key press in a list of `count` rows (wraps; -1 when the list is empty). */
export function finderMove(active,count,key){
 if(!count)return -1;
 if(key==='Home')return 0;
 if(key==='End')return count-1;
 if(key==='ArrowDown')return (active+1)%count;
 if(key==='ArrowUp')return (active-1+count)%count;
 return active;
}
/** Favourites and recent tools: the existing local preference (src/toolkit.js, key
 * fileforge.tools.v1), which holds tool ids only. `known` filters out ids that no longer exist. */
export const TOOL_PREF_KEY='fileforge.tools.v1';
export const RECENT_MAX=3;
const list=(v,known)=>Array.isArray(v)?[...new Set(v.filter(id=>typeof id==='string'&&known(id)))]:[];
export function readToolPrefs(raw,known=()=>true){
 let p={};try{p=JSON.parse(raw||'{}')||{};}catch{/* unreadable: start empty */}
 return {favorites:list(p.favorites,known),recent:list(p.recent,known).slice(0,RECENT_MAX)};
}
/** The stored value with `id` moved to the front of the recent list (favourites and any other
 * field are kept as they are). */
export function pushRecent(raw,id){
 let p={};try{const v=JSON.parse(raw||'{}');if(v&&typeof v==='object'&&!Array.isArray(v))p=v;}catch{/* unreadable: start empty */}
 const old=Array.isArray(p.recent)?p.recent.filter(x=>typeof x==='string'):[];
 return {...p,favorites:Array.isArray(p.favorites)?p.favorites:[],recent:[id,...old.filter(x=>x!==id)].slice(0,RECENT_MAX)};
}
/** `text` cut into [segment, matched] pairs so the list can mark the typed words in a title. */
export function finderMarks(text,words){
 const s=String(text),low=s.toLowerCase(),hit=new Array(s.length).fill(false);
 if(low.length===s.length)for(const w of words){if(!w)continue;for(let i=low.indexOf(w);i>=0;i=low.indexOf(w,i+w.length))hit.fill(true,i,i+w.length);}
 const out=[];
 for(let i=0;i<s.length;i++){const last=out[out.length-1];if(last&&last[1]===hit[i])last[0]+=s[i];else out.push([s[i],hit[i]]);}
 return out;
}
