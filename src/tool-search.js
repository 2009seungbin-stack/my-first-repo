/** Ranked tool search for the Explore dialog (Ctrl/⌘+K). Pure: no DOM, no storage. */
const fold=text=>String(text??'').normalize('NFKC').toLocaleLowerCase();
const squash=text=>fold(text).replace(/[\s\-_·・./]+/g,'');
/** Lower-cased query words. @param {string} query */
export function queryTokens(query){return fold(query).split(/\s+/).filter(Boolean);}
/** True when two words differ by at most one insertion, deletion or substitution. */
export function nearlyEqual(a,b){
 if(a===b)return true;
 if(Math.abs(a.length-b.length)>1)return false;
 let i=0,j=0,edits=0;
 while(i<a.length&&j<b.length){
  if(a[i]===b[j]){i++;j++;continue;}
  if(++edits>1)return false;
  if(a.length>b.length)i++;else if(b.length>a.length)j++;else{i++;j++;}
 }
 return edits+(a.length-i)+(b.length-j)<=1;
}
function prepare(entry){
 const title=fold(entry.title),aliases=(entry.aliases||[]).map(fold);
 return {title,aliases,id:fold(entry.id),description:fold(entry.description),words:title.split(/[\s\-_·・/()]+/).filter(Boolean),aliasWords:aliases.flatMap(a=>a.split(/[\s\-_·・/()]+/)).filter(Boolean)};
}
/** Best score of one query word against one tool; 0 means the word does not match. */
function tokenScore(token,e){
 if(e.title.startsWith(token))return 100;
 if(e.words.some(word=>word.startsWith(token)))return 85;
 if(e.title.includes(token))return 70;
 if(e.aliases.some(alias=>alias.startsWith(token)))return 60;
 if(e.aliasWords.some(word=>word.startsWith(token)))return 55;
 if(e.aliases.some(alias=>alias.includes(token)))return 45;
 if(e.id.includes(token))return 40;
 if(e.description.includes(token))return 20;
 // One typo is forgiven for words long enough to stay unambiguous.
 if(token.length>=4&&[...e.words,...e.aliasWords].some(word=>nearlyEqual(token,word.slice(0,Math.max(token.length,Math.min(word.length,token.length+1))))))return 10;
 return 0;
}
/** @typedef {{id:string,title:string,description?:string,aliases?:string[]}} ToolEntry */
/** Ids of the tools matching every query word, best match first; an empty query keeps the given order.
 * @param {ToolEntry[]} entries @param {string} query @returns {string[]} */
export function searchTools(entries,query){
 const tokens=queryTokens(query);
 if(!tokens.length)return entries.map(entry=>entry.id);
 const joined=squash(query),scored=[];
 entries.forEach((entry,index)=>{
  const e=prepare(entry);let score=0,all=true;
  for(const token of tokens){const s=tokenScore(token,e);if(!s){all=false;break;}score+=s;}
  if(all)score=score/tokens.length+(e.title===tokens.join(' ')?50:0);
  // "배경제거" finds "배경 제거": spacing and punctuation are ignored as a fallback.
  else if(joined.length>=2&&squash(entry.title).includes(joined))score=squash(entry.title)===joined?110:squash(entry.title).startsWith(joined)?75:65;
  else if(joined.length>=2&&(entry.aliases||[]).some(alias=>squash(alias).includes(joined)))score=42;
  else return;
  scored.push({id:entry.id,score,index});
 });
 return scored.sort((a,b)=>b.score-a.score||a.index-b.index).map(item=>item.id);
}
/** Escaped title with the matched query words wrapped in <mark>.
 * @param {string} text @param {string} query @param {(value:string)=>string} esc */
export function highlightMatch(text,query,esc){
 const lower=String(text).toLocaleLowerCase(),tokens=queryTokens(query);
 if(!tokens.length||lower.length!==String(text).length)return esc(text);
 const ranges=[];
 for(const token of tokens){const at=lower.indexOf(token);if(at>=0)ranges.push([at,at+token.length]);}
 if(!ranges.length)return esc(text);
 ranges.sort((a,b)=>a[0]-b[0]);
 const merged=[ranges[0].slice()];
 for(const [start,end] of ranges.slice(1)){const last=merged[merged.length-1];if(start<=last[1])last[1]=Math.max(last[1],end);else merged.push([start,end]);}
 let out='',cursor=0;
 for(const [start,end] of merged){out+=esc(text.slice(cursor,start))+'<mark>'+esc(text.slice(start,end))+'</mark>';cursor=end;}
 return out+esc(text.slice(cursor));
}
/** Next highlighted row for arrow-key movement; wraps at both ends. */
export function moveActive(index,delta,count){return count>0?((index+delta)%count+count)%count:-1;}
/** Dialog copy that only this search uses. */
export const SEARCH_UI={
 en:{count:n=>n===1?'1 tool':`${n} tools`,keys:'↑ ↓ to choose · Enter to open',none:query=>`No tool matches “${query}”.`,clear:'Clear search',allCategories:'Search every category'},
 ko:{count:n=>`도구 ${n}개`,keys:'↑ ↓ 선택 · Enter 열기',none:query=>`“${query}”와 일치하는 도구가 없습니다.`,clear:'검색어 지우기',allCategories:'전체 카테고리에서 찾기'},
 ja:{count:n=>`ツール ${n}件`,keys:'↑ ↓ で選択 · Enter で開く',none:query=>`「${query}」に一致するツールはありません。`,clear:'検索語を消去',allCategories:'すべてのカテゴリで探す'}
};
