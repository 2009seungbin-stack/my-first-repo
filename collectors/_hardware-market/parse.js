/** Public first-post parsers. They deliberately discard author/contact fields and comments.
 * HTML is treated as data, never executed. No page-wide money extraction. */
export function decode(s){return s.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|euro);/gi,(_,e)=>{if(e[0]==='#'){const n=e[1].toLowerCase()==='x'?parseInt(e.slice(2),16):Number(e.slice(1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',euro:'€'}[e.toLowerCase()]||'';});}
export function text(s){return decode(s.replace(/<(script|style|del|s|strike)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<!--[\s\S]*?-->/g,'').replace(/<\/?(?:p|div|li|tr|h[1-6])\b[^>]*>|<br\b[^>]*>/gi,'\n').replace(/<[^>]*>/g,'')).replace(/\r/g,'').replace(/[\t \u00a0]+/g,' ').replace(/\n\s*\n/g,'\n').trim();}
/** Balanced element extraction, so nested divs cannot extend into replies. */
export function element(html,pattern){const m=pattern.exec(html);if(!m)return null;const tag=m[1],start=m.index+m[0].length,re=new RegExp(`<\\/?${tag}\\b[^>]*>`,'gi');re.lastIndex=start;let depth=1,n;while((n=re.exec(html))){depth+=n[0].startsWith('</')?-1:1;if(!depth)return html.slice(start,n.index);}return null;}
export function modelMatches(s){
 const re=/\b(?:RTX|GTX|RX)\s*\d{3,4}(?:\s*(?:Ti\s*Super|Super|Ti|XTX|XT|GRE))?\b|\bArc\s*[AB]\d{3}\b|(?:\bRyzen|라이젠)\s*(?:[3579]\s+)?\d{4,5}(?:X3D|X|G|F)?\b|\bi[3579][ -]\d{4,5}[A-Z]*\b|\bCore\s*Ultra\s*[579]\s*\d{3}[A-Z]*\b/gi;
 return [...s.matchAll(re)].map(m=>({model:m[0].replace(/라이젠/,'Ryzen').replace(/\s+/g,' ').replace(/^(RTX|GTX|RX)\s*(\d)/i,'$1 $2').replace(/\b(TI|SUPER|XTX|XT)\b/gi,x=>({ti:'Ti',super:'Super',xtx:'XTX',xt:'XT'}[x.toLowerCase()])).trim(),index:m.index,end:m.index+m[0].length}));
}
export const modelKey=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const unwanted=/(?:\b(?:WTB|WTT|wanted|buying|BNIB|NIB|sealed|brand new|laptop|notebook|gaming PC|computer|bundle|combo|for parts|broken|defective)\b|\[ACH\]|\[ECH\]|\b(?:neuf|scellé|portable|lot indissociable)\b|삽니다|구매|구해|노트북|본체|세트|셋트|일괄|미개봉|불량|고장|박스만)/i;
const boundary=/^(?:[-=]{5,}|.*\b(?:CORSAIR Frame|bo[iî]tier|écran|ecran|alimentation|Ram DDR|Corsair Vengeance|sodimm|NVMe|case for sale|SSD|HDD|motherboard|mainboard|mobo)\b|.*(?:메인보드|케이스 판매|램 판매))/i;
function prices(s,currency){
 let matches;
 if(currency==='KRW')matches=[...s.matchAll(/(?<![\d.,])(\d[\d,.]*)(?:\s*(만|천))?\s*원/g)].filter(m=>(m[2]?/^\d+(?:\.\d{1,2})?$/:/^(?:\d+|\d{1,3}(?:,\d{3})+)$/).test(m[1])).map(m=>Number(m[1].replace(/,/g,''))*(m[2]==='만'?10000:m[2]==='천'?1000:1));
 else if(currency==='EUR')matches=[...s.matchAll(/(?<![\d.,])(\d[\d .,]*?)\s*(?:€|euros?\b)/gi)].filter(m=>/^(?:\d+|\d{1,3}(?: \d{3})+)(?:[,.]\d{1,2})?$/.test(m[1].trim())).map(m=>Number(m[1].replace(/ /g,'').replace(',','.')));
 else matches=[...s.matchAll(/\$\s*(\d[\d,.]*)/g)].filter(m=>/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(m[1])).map(m=>Number(m[1].replace(/,/g,'')));
 return [...new Set(matches.filter(n=>Number.isFinite(n)&&n>0&&n<1e9))];
}
/** Require one price per bounded item section. Unknown units/quantity/negotiation are excluded. */
export function parseItems({title,body,source,postId,url,country,currency}){
 if(unwanted.test(title))return {items:[],excluded:1};
 const lines=text(body).split('\n').filter(Boolean),blocks=[];let block=null;
 for(const line of lines){
  const models=modelMatches(line),unique=[...new Map(models.map(m=>[modelKey(m.model),m.model])).values()];
  if(unique.length){if(block&&unique.length===1&&modelKey(block.model)===modelKey(unique[0]))block.lines.push(line);else{if(block)blocks.push(block);block={model:unique[0],lines:[line],ambiguous:unique.length>1};}}
  else if(block){if(boundary.test(line)){blocks.push(block);block=null;}else block.lines.push(line);}
 }
 if(block)blocks.push(block);
 const items=[],seen=new Set();let excluded=0;
 for(const b of blocks){
  const section=b.lines.join('\n').slice(0,2000),p=prices(section,currency);
  const titleModels=modelMatches(title),titleForItem=titleModels.length===1&&modelKey(titleModels[0].model)===modelKey(b.model)?title:'';
  const capacities=[...new Set([...(section+'\n'+titleForItem).matchAll(/\b(\d{1,2})\s*(?:GB|Go)\b|(\d{1,2})\s*기가/gi)].map(m=>m[1]||m[2]))],cap=capacities[0]||'';
  const foreign=/\b(?:CAD|AUD|JPY|GBP)\b|(?:CA|AU|C|A)\$|£|¥|円/i.test(section)||currency!=='EUR'&&/€|\bEUR\b/i.test(section)||currency!=='USD'&&/\$|\bUSD\b/i.test(section)||currency!=='KRW'&&/원|\bKRW\b/i.test(section);
  if(b.ambiguous||foreign||capacities.length>1||section.includes('\ufffd')||unwanted.test(section)||/(?:\b(?:[2-9]\s*(?:cards|GPUs|pieces)|pair|each|MSRP|retail|paid|original price)\b|[2-9]\s*(?:개|대)|개당|구입가|구매가|정가|희망.*교환)/i.test(section)||p.length!==1){excluded++;continue;}
  const key=modelKey(b.model)+'|'+cap;if(seen.has(key)){excluded++;continue;}seen.add(key);
  const basis=/(?:\bSOLD\b|^vendu(?:e)?\b|vendu(?:e)?\s+(?:à|hors)|판매\s*완료|판완|등반완료|정복됨|등산\s*완|^완[)\]])/im.test(title+'\n'+section)?'sold':'asking';
  items.push({id:`${source}:${postId}:${key}`,source,postId,url,country,currency,model:b.model,capacity:cap,price:p[0],shipping:/\bshipped\b|(?:배송|택배)비\s*포함|택포|\binclus\b|€\s*in\b/i.test(section)?0:null,basis});
 }
 return {items,excluded};
}
export function gigglePost(html,id){
 const body=element(html,new RegExp(`<([a-z]+)\\b[^>]*class="document_${id}_\\d+ xe_content"[^>]*>`,'i'));
 const header=element(html,/<(div)\b[^>]*class="top_area [^"]*"[^>]*>/i)||html;
 const title=text(header.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'');
 if(body===null||!title||!/<strong\b[^>]*class="cate[^" ]*(?: [^"]*)?"[^>]*[^>]*>장터<\/strong>/i.test(html))throw Error('SCHEMA');
 return {title,body};
}
export function frenchPost(html){
 const body=element(html,/<(div)\b[^>]*id="para\d+"[^>]*>/i),title=text(html.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1]||html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]||'');
 if(body===null||!title||!/\[VDS\]/i.test(title))throw Error('SCHEMA');
 return {title,body};
}
export function rssPosts(xml){
 if(!/<rss\b/i.test(xml)||!/<channel>/i.test(xml))throw Error('SCHEMA');
 const field=(s,k)=>decode(s.match(new RegExp(`<${k}[^>]*>([\\s\\S]*?)<\\/${k}>`,'i'))?.[1]?.replace(/^<!\[CDATA\[|\]\]>$/g,'')||'');
 return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m=>({title:field(m[1],'title'),body:field(m[1],'content:encoded')||field(m[1],'description'),url:field(m[1],'link')}));
}
