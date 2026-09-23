/** Character sets for game fonts, built from the game's own translation files, so a font atlas holds
 * exactly the glyphs the game shows (a Korean UI with 700 strings needs ~600 syllables, not 11 172).
 * Pure: bytes/text in, plain data out. No DOM.
 *
 * readTranslations(name, bytes|text) understands the formats games ship strings in and returns the
 * shipped text only (never keys, ids, comments or syntax):
 *   .po/.pot (msgstr; msgid only for a template), CSV/TSV (RFC 4180, multi-line cells; a header row of
 *   locale codes such as Godot's `keys,en,ko` becomes selectable columns), JSON (every string value;
 *   i18next/flat/nested; a top-level object keyed by locale becomes columns), Apple .strings (UTF-16 or
 *   UTF-8), .NET .resx, XLIFF 1.2/2.0 (<target>, else <source>), Android strings.xml, Java
 *   .properties (\uXXXX escapes), Godot Translation .tres (`messages = {…}` values), plain .txt.
 * Placeholders and markup are not glyphs the player sees ("{0}", "%1$s", "{{name}}", "<b>", "[color=red]")
 * and are removed by default — the report counts what was removed, so nothing disappears silently.
 * buildCharset() unions the chosen sources, counts every character, orders glyphs by frequency (the
 * most used ones land on the first atlas page) and reports per-source numbers. */
const cp=c=>c.codePointAt(0);
// ------------------------------------------------------------------ bytes → text
/** UTF-8 / UTF-16 (BOM or zero-byte pattern) decoding. Apple .strings files are often UTF-16. */
export function decodeText(input){
 if(typeof input==='string')return input;
 const b=input instanceof Uint8Array?input:new Uint8Array(input);
 if(b[0]===0xef&&b[1]===0xbb&&b[2]===0xbf)return new TextDecoder('utf-8').decode(b.subarray(3));
 if(b[0]===0xff&&b[1]===0xfe)return new TextDecoder('utf-16le').decode(b.subarray(2));
 if(b[0]===0xfe&&b[1]===0xff)return new TextDecoder('utf-16be').decode(b.subarray(2));
 // BOM-less UTF-16: every other byte zero in an ASCII-heavy file
 const n=Math.min(b.length,512);let evenZero=0,oddZero=0;for(let i=0;i<n;i++)if(!b[i])(i%2?oddZero++:evenZero++);
 if(n>=8&&oddZero>n*.3&&evenZero<n*.05)return new TextDecoder('utf-16le').decode(b);
 if(n>=8&&evenZero>n*.3&&oddZero<n*.05)return new TextDecoder('utf-16be').decode(b);
 return new TextDecoder('utf-8').decode(b);
}
export const FORMATS=Object.freeze(['po','csv','tsv','json','strings','resx','xliff','android','properties','tres','txt']);
/** Format from the file name, then from the content when the extension is generic (.xml, .txt). */
export function detectFormat(name,text=''){
 const n=String(name||'').toLowerCase(),ext=/\.([a-z0-9]+)$/.exec(n)?.[1]||'';
 const byExt={po:'po',pot:'po',csv:'csv',tsv:'tsv',json:'json',strings:'strings',resx:'resx',xlf:'xliff',xliff:'xliff',properties:'properties',tres:'tres',txt:'txt'}[ext];
 if(byExt)return byExt;
 const head=String(text).slice(0,2000);
 if(ext==='xml'){if(/<resources[\s>]/.test(head))return 'android';if(/<xliff[\s>]/.test(head))return 'xliff';if(/<root[\s>]/.test(head)&&/<data\s/.test(text))return 'resx';}
 if(/^\s*[{[]/.test(head))return 'json';
 if(/^\s*msgid\s+"/m.test(head))return 'po';
 return 'txt';
}
/** Locale written in a file path: ko.po, strings_ko.xml, values-ko/strings.xml, ko-KR.json, messages.ja.json. */
export function localeFromName(name){
 const n=String(name||'').replace(/\\/g,'/');
 const m=/(?:^|[\/._-])(values-)?([a-z]{2,3})(?:[-_]([A-Za-z]{2,4}))?(?=[\/._-]|$)/g;let hit=null,x;
 const known=new Set(['ko','ja','zh','en','fr','de','es','it','pt','ru','pl','tr','th','vi','id','ar','nl','sv','uk','cs','hu','ro','fi','da','no','nb','el','he','hi','ms']);
 while((x=m.exec(n)))if(known.has(x[2]))hit=x[2]+(x[3]?'-'+x[3]:'');
 return hit;
}
// ------------------------------------------------------------------ format readers → [{text,key,line,col}]
const unescapeC=s=>s.replace(/\\(u\{[0-9a-fA-F]+\}|U[0-9a-fA-F]{8}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[0-7]{1,3}|.)/g,(m,e)=>{
 if(e[0]==='u'&&e[1]==='{')return String.fromCodePoint(parseInt(e.slice(2,-1),16));
 if(e[0]==='U'||e[0]==='u'&&e.length===5)return String.fromCodePoint(parseInt(e.slice(1),16));
 if(e[0]==='x')return String.fromCharCode(parseInt(e.slice(1),16));
 if(/^[0-7]+$/.test(e))return String.fromCharCode(parseInt(e,8));
 return {n:'\n',t:'\t',r:'\r','"':'"',"'":"'",'\\':'\\',a:'',b:'',f:'',v:''}[e]??e;});
const XML_ENT={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
export const unescapeXML=s=>s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,(m,c)=>c.replace(/&/g,'\u0000amp;')).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(m,e)=>e[0]==='#'?String.fromCodePoint(e[1].toLowerCase()==='x'?parseInt(e.slice(2),16):parseInt(e.slice(1),10)):XML_ENT[e]??m).replace(/\u0000amp;/g,'&');
const lineAt=(text,index)=>{let n=1;for(let i=0;i<index&&i<text.length;i++)if(text.charCodeAt(i)===10)n++;return n;};
function readPO(text){
 const out=[],lines=text.split(/\r?\n/);let cur=null,field=null;
 const flush=()=>{if(cur){const vals=Object.entries(cur.str).sort((a,b)=>a[0]-b[0]).map(e=>e[1]);const tpl=vals.every(v=>!v);
  for(const v of tpl?[cur.id,cur.plural].filter(Boolean):vals)if(v)out.push({text:v,key:cur.ctxt?cur.ctxt+'|'+cur.id:cur.id,line:cur.line,template:tpl});}cur=null;field=null;};
 lines.forEach((raw,i)=>{
  const line=raw.trim();
  if(!line||line.startsWith('#')){if(!line&&cur&&Object.keys(cur.str).length)flush();return;}
  const m=/^(msgctxt|msgid_plural|msgid|msgstr(?:\[(\d+)\])?)\s+"((?:\\.|[^"\\])*)"$/.exec(line);
  if(m){
   if(cur&&(Object.keys(cur.str).length||m[1]==='msgid'&&cur.id||m[1]==='msgctxt'&&(cur.id||cur.ctxt)))flush();
   if(!cur)cur={id:'',plural:'',ctxt:'',str:{},line:i+1};
   const v=unescapeC(m[3]);
   if(m[1]==='msgctxt'){cur.ctxt=v;field=['ctxt'];}else if(m[1]==='msgid'){cur.id=v;field=['id'];}else if(m[1]==='msgid_plural'){cur.plural=v;field=['plural'];}
   else{const k=m[2]??'0';cur.str[k]=v;field=['str',k];}
   return;
  }
  const c=/^"((?:\\.|[^"\\])*)"$/.exec(line);
  if(c&&cur&&field){const v=unescapeC(c[1]);if(field[0]==='str')cur.str[field[1]]+=v;else cur[field[0]]+=v;}
 });
 flush();
 // msgid "" / msgstr "Project-Id-Version…" is the header, not text
 return out.filter(e=>!(e.key===''&&/Content-Type:|Project-Id-Version:|Language:/.test(e.text)));
}
/** RFC 4180 records (quoted cells may contain separators, quotes and line breaks). */
export function parseDelimited(text,sep){
 const rows=[];let row=[],cell='',q=false,line=1,start=1;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(q){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else q=false;}else{if(c==='\n')line++;cell+=c;}continue;}
  if(c==='"'&&cell==='')q=true;
  else if(c===sep){row.push(cell);cell='';}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push({cells:row,line:start});row=[];cell='';line++;start=line;}
  else cell+=c;
 }
 if(cell!==''||row.length){row.push(cell);rows.push({cells:row,line:start});}
 return rows.filter(r=>r.cells.some(c=>c!==''));
}
const LOCALE_RE=/^[a-z]{2,3}(?:[-_][A-Za-z]{2,4})?$/;
function readDelimited(text,sep){
 const rows=parseDelimited(text,sep);if(!rows.length)return {entries:[],columns:[]};
 const head=rows[0].cells.map(c=>c.trim());
 const localeCols=head.map((c,i)=>LOCALE_RE.test(c)&&i>0?i:-1).filter(i=>i>=0);
 const keyish=/^(keys?|id|name|identifier|string_?id|context)$/i.test(head[0]||'');
 const hasHeader=localeCols.length>0||keyish;
 const columns=hasHeader?head.map((name,i)=>({index:i,name,locale:LOCALE_RE.test(name)?name.replace('_','-'):null,key:i===0&&(keyish||localeCols.length>0)})):head.map((_,i)=>({index:i,name:`#${i+1}`,locale:null,key:false}));
 const entries=[];
 for(const r of rows.slice(hasHeader?1:0))r.cells.forEach((cell,i)=>{if(cell&&!columns[i]?.key)entries.push({text:cell,key:hasHeader&&columns[0]?.key?r.cells[0]:'',line:r.line,col:i,locale:columns[i]?.locale||null});});
 return {entries,columns:columns.filter(c=>!c.key)};
}
function readJSON(text){
 let v;try{v=JSON.parse(text.replace(/^\uFEFF/,''));}catch(e){throw Error(`This JSON file could not be parsed (${e.message})`);}
 const entries=[],walk=(x,path,locale)=>{
  if(typeof x==='string'){if(x)entries.push({text:x,key:path,locale});}
  else if(Array.isArray(x))x.forEach((y,i)=>walk(y,path+'['+i+']',locale));
  else if(x&&typeof x==='object')for(const [k,y] of Object.entries(x))walk(y,path?path+'.'+k:k,locale);
 };
 // {"en":{…},"ko":{…}} → one column per locale
 const top=v&&typeof v==='object'&&!Array.isArray(v)?Object.keys(v):[];
 const byLocale=top.length>=1&&top.every(k=>LOCALE_RE.test(k))&&top.every(k=>v[k]&&typeof v[k]==='object');
 if(byLocale){for(const k of top)walk(v[k],'',k.replace('_','-'));return {entries,columns:top.map((k,i)=>({index:i,name:k,locale:k.replace('_','-')}))};}
 walk(v,'',null);
 return {entries,columns:[]};
}
function readStrings(text){
 const out=[],src=text.replace(/\/\*[\s\S]*?\*\//g,m=>m.replace(/[^\n]/g,' ')).replace(/(^|[^:"\\])\/\/[^\n]*/g,(m,a)=>a+' '.repeat(m.length-a.length));
 const re=/"((?:\\.|[^"\\])*)"\s*=\s*"((?:\\.|[^"\\])*)"\s*;/g;let m;
 while((m=re.exec(src)))out.push({text:unescapeC(m[2]),key:unescapeC(m[1]),line:lineAt(text,m.index)});
 return out;
}
function readResx(text){
 const out=[],re=/<data\b([^>]*)>([\s\S]*?)<\/data>/g;let m;
 while((m=re.exec(text))){
  if(/\btype\s*=|mimetype\s*=/.test(m[1]))continue;// embedded binary resources are not text
  const v=/<value>([\s\S]*?)<\/value>/.exec(m[2]);if(!v)continue;
  out.push({text:unescapeXML(v[1]),key:/name\s*=\s*"([^"]*)"/.exec(m[1])?.[1]||'',line:lineAt(text,m.index)});
 }
 return out;
}
const stripTags=s=>s.replace(/<(?:g|x|ph|pc|sc|ec|bx|ex|bpt|ept|it|mrk)\b[^>]*\/?>|<\/(?:g|pc|bpt|ept|it|mrk|ph)>/g,'');
function readXliff(text){
 const out=[],unit=/<(trans-unit|unit)\b([^>]*)>([\s\S]*?)<\/\1>/g;let m;
 const lang=/target-language\s*=\s*"([^"]+)"/.exec(text)?.[1]||/trgLang\s*=\s*"([^"]+)"/.exec(text)?.[1]||null;
 while((m=unit.exec(text))){
  const id=/\bid\s*=\s*"([^"]*)"/.exec(m[2])?.[1]||'',targets=[...m[3].matchAll(/<target\b[^>]*>([\s\S]*?)<\/target>/g)].map(x=>x[1]);
  const pick=targets.length?targets:[...m[3].matchAll(/<source\b[^>]*>([\s\S]*?)<\/source>/g)].map(x=>x[1]);
  for(const t of pick)out.push({text:unescapeXML(stripTags(t)),key:id,line:lineAt(text,m.index),locale:targets.length?lang:null,source:!targets.length});
 }
 return out;
}
const androidUnescape=s=>unescapeXML(s.replace(/<\/?(?:b|i|u|font|xliff:g)\b[^>]*>/g,'')).replace(/^"([\s\S]*)"$/,'$1').replace(/\\(u[0-9a-fA-F]{4}|.)/g,(m,e)=>e[0]==='u'&&e.length===5?String.fromCharCode(parseInt(e.slice(1),16)):({n:'\n',t:'\t',"'":"'",'"':'"','\\':'\\','@':'@','?':'?'}[e]??e));
function readAndroid(text){
 const out=[];let m;
 const str=/<string\b([^>]*)>([\s\S]*?)<\/string>/g;
 while((m=str.exec(text))){if(/translatable\s*=\s*"false"/.test(m[1]))continue;out.push({text:androidUnescape(m[2]),key:/name\s*=\s*"([^"]*)"/.exec(m[1])?.[1]||'',line:lineAt(text,m.index)});}
 const group=/<(string-array|plurals)\b([^>]*)>([\s\S]*?)<\/\1>/g;
 while((m=group.exec(text))){const key=/name\s*=\s*"([^"]*)"/.exec(m[2])?.[1]||'';for(const it of m[3].matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/g))out.push({text:androidUnescape(it[1]),key,line:lineAt(text,m.index)});}
 return out;
}
function readProperties(text){
 const out=[],lines=text.split(/\r?\n/);
 for(let i=0;i<lines.length;i++){
  let line=lines[i].replace(/^\s+/,'');const at=i+1;
  if(!line||line[0]==='#'||line[0]==='!')continue;
  while(/(^|[^\\])(\\\\)*\\$/.test(line)&&i+1<lines.length)line=line.slice(0,-1)+lines[++i].replace(/^\s+/,'');
  const m=/^((?:\\.|[^:=\s\\])*)\s*[:=\s]\s*([\s\S]*)$/.exec(line);if(!m)continue;
  const v=m[2].replace(/\\(u[0-9a-fA-F]{4}|.)/g,(x,e)=>e[0]==='u'&&e.length===5?String.fromCharCode(parseInt(e.slice(1),16)):({n:'\n',t:'\t',r:'\r',f:''}[e]??e));
  if(v)out.push({text:v,key:m[1],line:at});
 }
 return out;
}
function readTres(text){
 // Godot Translation resource: messages = { "key": "value", … } (Godot 4 writes a Dictionary)
 const out=[],m=/\bmessages\s*=\s*\{([\s\S]*?)\n\}/.exec(text)||/\bmessages\s*=\s*\{([\s\S]*?)\}/.exec(text);
 if(!m)throw Error('This .tres has no Translation `messages` dictionary');
 const re=/"((?:\\.|[^"\\])*)"\s*:\s*"((?:\\.|[^"\\])*)"/g;let x;
 while((x=re.exec(m[1])))out.push({text:unescapeC(x[2]),key:unescapeC(x[1]),line:lineAt(text,m.index+x.index)});
 const locale=/\blocale\s*=\s*"([^"]+)"/.exec(text)?.[1]||null;
 return out.map(e=>({...e,locale}));
}
/** One translation file → its shipped strings. `columns` lists selectable language columns for
 * CSV/TSV/JSON files that hold several languages. */
export function readTranslations(name,input,{format=null}={}){
 const text=decodeText(input).replace(/^\uFEFF/,''),fmt=format||detectFormat(name,text);
 let entries,columns=[];
 if(fmt==='po')entries=readPO(text);
 else if(fmt==='csv'||fmt==='tsv')({entries,columns}=readDelimited(text,fmt==='tsv'?'\t':','));
 else if(fmt==='json')({entries,columns}=readJSON(text));
 else if(fmt==='strings')entries=readStrings(text);
 else if(fmt==='resx')entries=readResx(text);
 else if(fmt==='xliff')entries=readXliff(text);
 else if(fmt==='android')entries=readAndroid(text);
 else if(fmt==='properties')entries=readProperties(text);
 else if(fmt==='tres')entries=readTres(text);
 else entries=text.split(/\r?\n/).map((t,i)=>({text:t,key:'',line:i+1})).filter(e=>e.text);
 const locale=localeFromName(name);
 return {name:String(name||''),format:fmt,locale,columns,entries:entries.map(e=>({...e,locale:e.locale??(columns.length?null:locale)}))};
}
// ------------------------------------------------------------------ placeholders and markup
export const STRIP_RULES=Object.freeze([
 ['icu',/\{\s*[A-Za-z_][\w.]*\s*,\s*(?:plural|select|selectordinal)\s*,((?:[^{}]|\{[^{}]*\})*)\}/g],// ICU plural/select: keep the branch texts
 ['printf',/%(?:\d+\$)?[-+0#]*(?:\d+|\*)?(?:\.(?:\d+|\*))?(?:hh|h|ll|l|L|z|j|t)?[diufFeEgGxXcs@%]/g],// %s %1$d %.2f %@ %% (no space flag: "100% complete" stays text)
 ['dollar',/\$\{[\w.]+\}|\$\([\w.]+\)|\$[A-Za-z_]\w*\$?/g],                    // ${x} $(x) $name
 ['braces',/\{\{\s*[\w.$-]*\s*\}\}|\{\s*[\w.$-]*(?:\s*[,:][^{}]*)?\s*\}/g],        // {0} {name} {{name}} {0:N2}
 ['markup',/<\/?[A-Za-z][\w:-]*(?:\s+[^<>]*)?\/?>/g],                           // <b> </color> <br/>
 ['bbcode',/\[\/?(?:b|i|u|s|color|size|font|url|img|center|right|wave|shake|rainbow|outline_color|outline_size|bgcolor|fgcolor|code|p|indent|ul|ol|table|cell|hint|lb|rb|sprite|link)(?:=[^\]]*)?\]/gi]// Godot/Unity rich text
]);
/** Removes what the player never sees; returns the visible text and what was removed per rule. */
export function visibleText(text,{rules=STRIP_RULES.map(r=>r[0])}={}){
 let s=String(text);const removed={};
 for(const [id,re] of STRIP_RULES){
  if(!rules.includes(id))continue;
  s=s.replace(re,(m,inner)=>{removed[id]=(removed[id]||0)+1;
   if(id==='icu')return String(inner).replace(/(?:^|\s)(?:=\d+|zero|one|two|few|many|other|[\w-]+)\s*\{([^{}]*)\}/g,' $1 ').replace(/#/g,'0');
   return '';});
 }
 return {text:s,removed};
}
// ------------------------------------------------------------------ charsets
const range=(a,b)=>{const out=[];for(let i=a;i<=b;i++)out.push(i);return out;};
/** Fixed sets for when there is no translation file yet. KS X 1001 and JIS X 0208 come from the
 * browser's own legacy decoders (the standards' exact tables, not a list typed in here). */
export const PRESETS=Object.freeze({
 ascii:()=>range(0x20,0x7e),
 latin1:()=>[...range(0x20,0x7e),...range(0xa0,0xff)],
 digits:()=>[0x20,...range(0x30,0x39)],
 'latin-ext-a':()=>range(0x100,0x17f),
 'cjk-punct':()=>[...range(0x3000,0x303f),...range(0xff01,0xff5e),0x2026,0x2014,0x2018,0x2019,0x201c,0x201d,0x00b7,0x203b],
 kana:()=>[...range(0x3041,0x3096),...range(0x3099,0x309f),...range(0x30a0,0x30ff),...range(0x31f0,0x31ff)],
 'hangul-jamo':()=>range(0x3131,0x318e),
 'ks-x-1001-hangul':()=>legacy('euc-kr',0xb0,0xc8,0xa1,0xfe),        // 2 350 common Hangul syllables
 'jis-x-0208-kanji-1':()=>legacy('shift_jis',0x88,0x98,0x40,0xfc,{from:0x889f,to:0x9872}),// 2 965 level-1 kanji
 'hangul-all':()=>range(0xac00,0xd7a3)                                  // 11 172 — shown with its size
});
function legacy(enc,lead0,lead1,trail0,trail1,{from=0,to=0xffff}={}){
 let dec;try{dec=new TextDecoder(enc);}catch{throw Error(`This browser has no ${enc} decoder`);}
 const out=new Set();
 for(let a=lead0;a<=lead1;a++)for(let b=trail0;b<=trail1;b++){
  const code=a<<8|b;if(code<from||code>to||b===0x7f)continue;
  const ch=dec.decode(new Uint8Array([a,b]));if(ch.length&&ch!=='\ufffd'){const c=cp(ch);if(c>0x2e7f)out.add(c);}
 }
 return [...out].sort((x,y)=>x-y);
}
const invisible=c=>c<0x20||c===0x7f||(c>=0x80&&c<0xa0)||c===0xad||c===0x200b||c===0x200c||c===0x200d||c===0x2060||c===0xfeff||(c>=0xfe00&&c<=0xfe0f)||(c>=0xe0100&&c<=0xe01ef);
/** Characters of a text with counts. Line breaks, tabs, control and zero-width characters are not
 * glyphs; the space is kept (engines need its advance). */
export function countChars(text,into=new Map()){
 for(const ch of String(text)){const c=cp(ch);if(invisible(c))continue;into.set(c,(into.get(c)||0)+1);}
 return into;
}
/** Unions sources into one ordered glyph list.
 * sources: [{id, kind:'preset', preset} | {id, kind:'text', text} | {id, kind:'file', file:readTranslations() result, columns:[locale|index…]|null, locales:[…]|null}]
 * order: 'frequency' (most used first; presets after all counted text, in code point order) or 'codepoint'. */
export function buildCharset(sources,{order='frequency',strip=true,rules,exclude=''}={}){
 const counts=new Map(),perSource=[],removed={},excluded=new Set([...String(exclude)].map(cp));
 const fromPresets=new Set();
 for(const s of sources){
  const before=new Set(counts.keys());let strings=0,chars=0;
  if(s.kind==='preset'){const f=PRESETS[s.preset];if(!f)throw Error(`Unknown character set ${s.preset}`);for(const c of f())fromPresets.add(c);perSource.push({id:s.id,kind:'preset',preset:s.preset,glyphs:f().length});continue;}
  const texts=s.kind==='text'?[String(s.text||'')]:s.file.entries.filter(e=>{
   if(s.columns?.length&&e.col!=null)return s.columns.includes(e.col)||s.columns.includes(e.locale);
   if(s.locales?.length&&e.locale)return s.locales.includes(e.locale)||s.locales.includes(e.locale.split('-')[0]);
   return true;}).map(e=>e.text);
  for(const t of texts){
   const v=strip?visibleText(t,{rules}):{text:t,removed:{}};
   for(const [k,n] of Object.entries(v.removed))removed[k]=(removed[k]||0)+n;
   countChars(v.text,counts);strings++;chars+=[...v.text].length;
  }
  perSource.push({id:s.id,kind:s.kind,strings,chars,newGlyphs:[...counts.keys()].filter(c=>!before.has(c)).length});
 }
 for(const c of excluded){counts.delete(c);fromPresets.delete(c);}
 const counted=[...counts.keys()];
 const rest=[...fromPresets].filter(c=>!counts.has(c)).sort((a,b)=>a-b);
 const codepoints=order==='codepoint'?[...new Set([...counted,...rest])].sort((a,b)=>a-b):[...counted.sort((a,b)=>counts.get(b)-counts.get(a)||a-b),...rest];
 return {codepoints,counts,perSource,removed,stats:scriptStats(codepoints)};
}
/** How many glyphs of each script: what makes an atlas big. */
export function scriptStats(codepoints){
 const s={total:codepoints.length,latin:0,hangul:0,jamo:0,kana:0,han:0,cjkPunct:0,other:0};
 for(const c of codepoints){
  if(c<0x250)s.latin++;else if(c>=0xac00&&c<=0xd7a3)s.hangul++;else if(c>=0x1100&&c<=0x11ff||c>=0x3130&&c<=0x318f)s.jamo++;
  else if(c>=0x3040&&c<=0x30ff||c>=0x31f0&&c<=0x31ff||c>=0xff66&&c<=0xff9f)s.kana++;
  else if(c>=0x4e00&&c<=0x9fff||c>=0x3400&&c<=0x4dbf||c>=0xf900&&c<=0xfaff||c>=0x20000&&c<=0x3ffff)s.han++;
  else if(c>=0x3000&&c<=0x303f||c>=0xff00&&c<=0xffef)s.cjkPunct++;else s.other++;
 }
 return s;
}
/** Characters a font cannot draw, most used first, with where they occur (first few places). */
export function missingGlyphs(codepoints,hasGlyph,{counts=null,files=[]}={}){
 const missing=codepoints.filter(c=>c!==0x20&&!hasGlyph(c));
 if(!missing.length)return [];
 const want=new Set(missing),where=new Map();
 for(const f of files)for(const e of f.entries){for(const ch of e.text){const c=cp(ch);if(!want.has(c))continue;let w=where.get(c);if(!w)where.set(c,w=[]);if(w.length<3&&!w.some(x=>x.file===f.name&&x.line===e.line))w.push({file:f.name,line:e.line,key:e.key||''});}}
 return missing.map(c=>({codepoint:c,char:String.fromCodePoint(c),count:counts?.get(c)||0,where:where.get(c)||[]})).sort((a,b)=>b.count-a.count||a.codepoint-b.codepoint);
}
