/** Password protection and password removal, both entirely in the page.
 *
 * Protecting reserializes the document first, so that every stream is a raw stream, then replaces
 * each stream and each string with its AES-256 ciphertext and attaches a revision 6 /Encrypt
 * dictionary. Object streams are off for that pass: a writer that knows nothing about encryption
 * would leave the container itself in clear text.
 *
 * Unlocking cannot use pdf-lib at all — pdf-lib refuses to parse the compressed object streams
 * that Acrobat, qpdf and MuPDF write into encrypted files. So it works on the bytes: it finds
 * every `N G obj`, decrypts the streams and the strings, expands object streams into ordinary
 * objects and writes a fresh file with a plain cross-reference table. That also means a damaged
 * cross-reference section does not stop it. */
import * as L from '../assets/vendor/pdf-lib-1.17.1/pdf-lib.esm.min.js';
import {buildV5Security,encryptAESV3,fileKeyFor,decryptObject,cat,random} from './pdf-crypt.js';
const N=k=>L.PDFName.of(k);
const ascii=s=>Uint8Array.from(String(s),c=>c.charCodeAt(0)&255);
const text=(b,i,j)=>{let s='';for(let k=i;k<j&&k<b.length;k++)s+=String.fromCharCode(b[k]);return s;};
const hex=b=>{let s='';for(const v of b)s+=v.toString(16).padStart(2,'0');return s;};
const inflate=async(bytes,format='deflate')=>{
 try{return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format))).arrayBuffer());}
 catch{return format==='deflate'?inflate(bytes,'deflate-raw'):null;}
};
// ---- protect
/** Encrypt a serialized PDF with a revision 6 (AES-256) standard security handler. */
export async function protectDocument(source,{password,ownerPassword='',permissions}={}){
 if(!password)throw Error('NO_PASSWORD');
 const doc=await L.PDFDocument.load(source,{updateMetadata:false});
 const ctx=doc.context,security=await buildV5Security({password,ownerPassword,permissions});
 const encrypt=ctx.obj({Filter:N('Standard'),V:5,R:6,Length:256,StmF:N('StdCF'),StrF:N('StdCF'),
  CF:{StdCF:{CFM:N('AESV3'),AuthEvent:N('DocOpen'),Length:32}},P:security.permissions,EncryptMetadata:true});
 for(const [key,value] of [['O',security.O],['U',security.U],['OE',security.OE],['UE',security.UE],['Perms',security.Perms]])encrypt.set(N(key),L.PDFHexString.of(hex(value)));
 const encryptRef=ctx.register(encrypt),skipTag=String(encryptRef);
 const seen=new Set(),strings=[];
 const collect=object=>{
  if(object instanceof L.PDFStream)return collect(object.dict);
  const isString=v=>v instanceof L.PDFString||v instanceof L.PDFHexString;
  if(object instanceof L.PDFDict){
   if(seen.has(object))return;seen.add(object);
   for(const [key,value] of object.entries())isString(value)?strings.push([object,key,value]):collect(value);
  }else if(object instanceof L.PDFArray){
   if(seen.has(object))return;seen.add(object);
   for(let i=0;i<object.size();i++){const value=object.get(i);isString(value)?strings.push([object,i,value]):collect(value);}
  }
 };
 for(const [ref,object] of ctx.enumerateIndirectObjects())if(String(ref)!==skipTag)collect(object);
 for(const [holder,key,value] of strings)holder.set(key,L.PDFHexString.of(hex(await encryptAESV3(security.fileKey,value.asBytes()))));
 let streams=0,plain=0;
 for(const [ref,object] of ctx.enumerateIndirectObjects()){
  if(String(ref)===skipTag||!(object instanceof L.PDFStream))continue;
  if(!(object instanceof L.PDFRawStream)){plain++;continue;}
  const bytes=await encryptAESV3(security.fileKey,object.contents);
  const dict=object.dict.clone(ctx);dict.set(N('Length'),L.PDFNumber.of(bytes.length));
  ctx.assign(ref,L.PDFRawStream.of(dict,bytes));streams++;
 }
 if(plain)throw Error('UNENCRYPTABLE_STREAM');
 ctx.trailerInfo.Encrypt=encryptRef;
 ctx.trailerInfo.ID=ctx.obj([L.PDFHexString.of(hex(random(16))),L.PDFHexString.of(hex(random(16)))]);
 const bytes=await doc.save({useObjectStreams:false,updateMetadata:false});
 return {bytes,report:{pages:doc.getPageCount(),encryptedStreams:streams,encryptedStrings:strings.length,handler:'AES-256',revision:6,permissions:security.permissions}};
}
// ---- byte-level reading, used only by the unlocker
const WS=c=>c===0||c===9||c===10||c===12||c===13||c===32;
const DELIM=c=>c===40||c===41||c===60||c===62||c===91||c===93||c===123||c===125||c===47||c===37;
function skip(b,i){
 for(;;){
  while(i<b.length&&WS(b[i]))i++;
  if(b[i]===37){while(i<b.length&&b[i]!==10&&b[i]!==13)i++;continue;}
  return i;
 }
}
const literalEnd=(b,i)=>{let depth=1;while(i<b.length&&depth){if(b[i]===92)i++;else if(b[i]===40)depth++;else if(b[i]===41)depth--;i++;}return i;};
/** Shallow-typed PDF object parser that records the byte span of every string it passes. */
function readObject(b,i,strings,depth=0){
 i=skip(b,i);const c=b[i];
 if(i>=b.length||depth>48)return {value:null,end:i+1};
 if(c===47){let j=i+1;while(j<b.length&&!WS(b[j])&&!DELIM(b[j]))j++;return {value:{name:text(b,i+1,j)},end:j};}
 if(c===40){const end=literalEnd(b,i+1);strings.push({start:i,end});return {value:{string:true},end};}
 if(c===60&&b[i+1]!==60){let j=i+1;while(j<b.length&&b[j]!==62)j++;strings.push({start:i,end:j+1});return {value:{string:true},end:j+1};}
 if(c===60){
  let j=i+2;const map=new Map();
  for(;;){
   j=skip(b,j);
   if(j>=b.length)break;
   if(b[j]===62&&b[j+1]===62){j+=2;break;}
   if(b[j]!==47){j++;continue;}
   const key=readObject(b,j,strings,depth+1),value=readObject(b,key.end,strings,depth+1);
   if(value.end<=key.end){j=key.end+1;continue;}
   map.set(key.value?.name,{value:value.value,start:skip(b,key.end),end:value.end});
   j=value.end;
  }
  return {value:{dict:map},end:j};
 }
 if(c===91){
  let j=i+1;const items=[];
  for(;;){j=skip(b,j);if(j>=b.length)break;if(b[j]===93){j++;break;}const item=readObject(b,j,strings,depth+1);if(item.end<=j){j++;continue;}items.push(item.value);j=item.end;}
  return {value:{array:items},end:j};
 }
 if(text(b,i,i+4)==='true')return {value:{bool:true},end:i+4};
 if(text(b,i,i+5)==='false')return {value:{bool:false},end:i+5};
 if(text(b,i,i+4)==='null')return {value:{},end:i+4};
 let j=i;if(b[j]===43||b[j]===45)j++;
 while(j<b.length&&(b[j]>=48&&b[j]<=57||b[j]===46))j++;
 if(j===i)return {value:null,end:i+1};
 const first=Number(text(b,i,j));
 if(Number.isInteger(first)&&first>=0){
  const g=skip(b,j);
  if(b[g]>=48&&b[g]<=57){
   let m=g;while(m<b.length&&b[m]>=48&&b[m]<=57)m++;
   const r=skip(b,m);
   if(b[r]===82&&(r+1>=b.length||WS(b[r+1])||DELIM(b[r+1])))return {value:{ref:first,gen:Number(text(b,g,m))},end:r+1};
  }
 }
 return {value:{num:first},end:j};
}
const entryOf=(value,key)=>value?.dict?.get(key);
function stringBytes(b,{start,end}){
 if(b[start]===60){
  const out=[];let high=-1;
  for(let i=start+1;i<end-1;i++){const c=b[i],v=c>=48&&c<=57?c-48:c>=65&&c<=70?c-55:c>=97&&c<=102?c-87:-1;
   if(v<0)continue;if(high<0)high=v;else{out.push(high*16+v);high=-1;}}
  if(high>=0)out.push(high*16);
  return Uint8Array.from(out);
 }
 const out=[],ESCAPE={110:10,114:13,116:9,98:8,102:12};
 for(let i=start+1;i<end-1;){
  const c=b[i++];
  if(c!==92){out.push(c);continue;}
  const e=b[i++];
  if(e>=48&&e<=55){let v=e-48;for(let k=0;k<2&&b[i]>=48&&b[i]<=55;k++)v=v*8+(b[i++]-48);out.push(v&255);}
  else if(e===10)continue;
  else if(e===13){if(b[i]===10)i++;}
  else out.push(ESCAPE[e]??e);
 }
 return Uint8Array.from(out);
}
/** Every `N G obj … endobj`, in file order. Headers that turn out to sit inside another object's
 * stream body are dropped afterwards: binary image data can contain anything. */
function scanObjects(b){
 const found=[];
 for(let i=0;i+3<=b.length;i++){
  if(b[i]!==111||b[i+1]!==98||b[i+2]!==106)continue;
  if(i+3<b.length&&!WS(b[i+3])&&!DELIM(b[i+3]))continue;
  let j=i-1;while(j>=0&&WS(b[j]))j--;
  const genEnd=j+1;while(j>=0&&b[j]>=48&&b[j]<=57)j--;
  const genStart=j+1;if(genStart===genEnd||genEnd-genStart>5)continue;
  if(!WS(b[j]))continue;
  while(j>=0&&WS(b[j]))j--;
  const numEnd=j+1;while(j>=0&&b[j]>=48&&b[j]<=57)j--;
  const numStart=j+1;if(numStart===numEnd||numEnd-numStart>10)continue;
  if(numStart>0&&!WS(b[numStart-1])&&!DELIM(b[numStart-1]))continue;
  const strings=[],parsed=readObject(b,i+3,strings);
  const entry={num:Number(text(b,numStart,numEnd)),gen:Number(text(b,genStart,genEnd)),header:numStart,dictStart:skip(b,i+3),dictEnd:parsed.end,value:parsed.value,strings,stream:null};
  const after=skip(b,parsed.end);
  if(text(b,after,after+6)==='stream'){let s=after+6;if(b[s]===13)s++;if(b[s]===10)s++;entry.stream={start:s,end:-1};}
  found.push(entry);
 }
 return found;
}
const ENDSTREAM=ascii('endstream');
function findEndstream(b,from){
 for(let i=from;i+9<=b.length;i++){
  if(b[i]!==101)continue;
  let ok=true;for(let k=1;k<9;k++)if(b[i+k]!==ENDSTREAM[k]){ok=false;break;}
  if(ok)return i;
 }
 return -1;
}
function closeStreams(b,objects){
 const scalar=new Map();
 for(const entry of objects)if(entry.value?.num!==undefined)scalar.set(entry.num,entry.value.num);
 for(const entry of objects){
  if(!entry.stream)continue;
  const declared=entryOf(entry.value,'Length')?.value;
  const length=declared?.num!==undefined?declared.num:declared?.ref!==undefined?scalar.get(declared.ref):undefined;
  const start=entry.stream.start;
  let end=Number.isInteger(length)&&length>=0&&start+length<=b.length?start+length:-1;
  if(end>=0){const probe=skip(b,end);if(text(b,probe,probe+9)!=='endstream')end=-1;}
  if(end<0){
   const at=findEndstream(b,start);
   end=at<0?b.length:at;
   while(end>start&&WS(b[end-1]))end--;
  }
  entry.stream.end=end;
 }
 // A header inside an earlier object's stream body was binary noise, not an object.
 const spans=objects.filter(e=>e.stream).map(e=>[e.stream.start,e.stream.end]);
 return objects.filter(entry=>!spans.some(([from,to])=>entry.header>from&&entry.header<to));
}
/** The /Encrypt dictionary, the file identifier and the trailer references, read from the bytes. */
function securityOf(b,objects){
 const trailers=[];
 for(let i=0;i+7<=b.length;i++)if(b[i]===116&&text(b,i,i+7)==='trailer')trailers.push({value:readObject(b,i+7,[]).value,at:i+7});
 for(const entry of objects)if(entryOf(entry.value,'Type')?.value?.name==='XRef')trailers.push({value:entry.value,at:entry.dictStart});
 let encryptRef=null,inline=null,id=null,root=null,info=null;
 for(const {value,at} of trailers){
  // MuPDF writes /Encrypt as a direct dictionary in the cross-reference stream, not a reference.
  const e=entryOf(value,'Encrypt');
  if(e?.value?.ref!==undefined)encryptRef=e.value.ref;else if(e?.value?.dict)inline={num:-1,value:e.value,dictStart:e.start,dictEnd:e.end,gen:0};
  const r=entryOf(value,'Root')?.value;if(r?.ref!==undefined)root=r;
  const n=entryOf(value,'Info')?.value;if(n?.ref!==undefined)info=n;
  const identifier=entryOf(value,'ID');
  if(identifier?.value?.array?.length){const spans=[];readObject(b,identifier.start,spans);if(spans[0])id=stringBytes(b,spans[0]);}
 }
 if(!root){const catalog=objects.find(e=>entryOf(e.value,'Type')?.value?.name==='Catalog');if(catalog)root={ref:catalog.num,gen:catalog.gen};}
 const dict=(encryptRef!==null?objects.filter(e=>e.num===encryptRef).at(-1):null)||inline
  ||objects.find(e=>entryOf(e.value,'Filter')?.value?.name==='Standard'&&entryOf(e.value,'U')&&entryOf(e.value,'O'));
 if(!dict)return {encrypted:false,root,info,id};
 const get=key=>entryOf(dict.value,key)?.value;
 const named=key=>{const e=entryOf(dict.value,key);if(!e)return null;const spans=[];readObject(b,e.start,spans);return spans.length?stringBytes(b,spans[0]):null;};
 const V=get('V')?.num??0,R=get('R')?.num??(V>=5?6:3);
 const cfm=get('CF')?.dict?.get(get('StmF')?.name||'StdCF')?.value?.dict?.get('CFM')?.value?.name;
 const method=V<4?'RC4':cfm==='AESV3'?'AESV3':cfm==='AESV2'?'AESV2':cfm==='None'?'None':V>=5?'AESV3':'RC4';
 return {encrypted:true,encryptObject:dict.num,root,info,id,
  security:{V,R,length:get('Length')?.num??(V>=5?256:40),P:get('P')?.num??-1,encryptMetadata:get('EncryptMetadata')?.bool!==false,
   O:named('O')||new Uint8Array(0),U:named('U')||new Uint8Array(0),OE:named('OE')||new Uint8Array(0),UE:named('UE')||new Uint8Array(0),
   id:id||new Uint8Array(0),method}};
}
/** What a file says about its own protection, without needing the password. */
export function inspect(source){
 const b=new Uint8Array(source),found=securityOf(b,closeStreams(b,scanObjects(b)));
 if(!found.encrypted)return {encrypted:false};
 const s=found.security;
 return {encrypted:true,version:s.V,revision:s.R,method:s.method,permissions:s.P,
  handler:s.method==='AESV3'?'AES-256':s.method==='AESV2'?'AES-128':s.method==='None'?'none':`RC4 ${s.length}-bit`};
}
const splice=(b,start,end,edits)=>{
 const parts=[];let at=start;
 for(const edit of edits.slice().sort((x,y)=>x.start-y.start)){
  if(edit.start<at||edit.end>end)continue;
  parts.push(b.subarray(at,edit.start),edit.bytes);at=edit.end;
 }
 parts.push(b.subarray(at,end));
 return cat(...parts);
};
/** Objects packed inside an /ObjStm, so that a plain cross-reference table can describe them. */
function expandObjectStream(data,first,count){
 const header=[];let i=0;
 for(let n=0;n<count;n++){
  i=skip(data,i);let j=i;while(j<data.length&&data[j]>=48&&data[j]<=57)j++;const num=Number(text(data,i,j));
  i=skip(data,j);j=i;while(j<data.length&&data[j]>=48&&data[j]<=57)j++;const offset=Number(text(data,i,j));i=j;
  if(!Number.isInteger(num)||!Number.isInteger(offset))return null;
  header.push([num,offset]);
 }
 const out=[];
 for(let n=0;n<header.length;n++){
  const [num,offset]=header[n],start=first+offset,end=n+1<header.length?first+header[n+1][1]:data.length;
  if(start>=data.length||end<start)return null;
  out.push({num,gen:0,body:data.subarray(start,end)});
 }
 return out;
}
export async function unlockDocument(source,password=''){
 const b=new Uint8Array(source),objects=closeStreams(b,scanObjects(b));
 const found=securityOf(b,objects);
 if(!found.encrypted)return {bytes:b,report:{alreadyOpen:true}};
 if(!found.root)throw Error('NO_CATALOG');
 const key=await fileKeyFor(password,found.security);
 if(!key)throw Error('WRONG_PASSWORD');
 const method=found.security.method,latest=new Map();
 for(const entry of objects)latest.set(entry.num,entry);
 const out=new Map();let decryptedStreams=0,decryptedStrings=0,expanded=0;
 for(const entry of [...latest.values()].sort((a,c)=>a.num-c.num)){
  const type=entryOf(entry.value,'Type')?.value?.name;
  if(entry.num===found.encryptObject||type==='XRef')continue;
  const edits=[],cipher=method!=='None';
  if(cipher)for(const span of entry.strings){
   const plain=await decryptObject(found.security,key,entry.num,entry.gen,stringBytes(b,span),method);
   if(!plain)continue;
   edits.push({start:span.start,end:span.end,bytes:ascii('<'+hex(plain)+'>')});decryptedStrings++;
  }
  let stream=entry.stream?b.subarray(entry.stream.start,entry.stream.end):null;
  if(stream&&cipher&&!(type==='Metadata'&&!found.security.encryptMetadata)){
   const plain=await decryptObject(found.security,key,entry.num,entry.gen,stream,method);
   if(plain){stream=plain;decryptedStreams++;}
  }
  if(type==='ObjStm'){
   const filter=entryOf(entry.value,'Filter')?.value?.name;
   if(filter&&filter!=='FlateDecode')throw Error('UNSUPPORTED_OBJECT_STREAM');
   const raw=stream&&filter?await inflate(stream):stream;
   const first=entryOf(entry.value,'First')?.value?.num,count=entryOf(entry.value,'N')?.value?.num;
   const members=raw&&Number.isInteger(first)&&Number.isInteger(count)?expandObjectStream(raw,first,count):null;
   if(!members)throw Error('UNSUPPORTED_OBJECT_STREAM');
   for(const member of members){if(!out.has(member.num))out.set(member.num,member);expanded++;}
   continue;
  }
  const lengthEntry=entryOf(entry.value,'Length');
  if(stream&&lengthEntry)edits.push({start:lengthEntry.start,end:lengthEntry.end,bytes:ascii(String(stream.length))});
  out.set(entry.num,{num:entry.num,gen:entry.gen,dict:splice(b,entry.dictStart,entry.dictEnd,edits),stream});
 }
 return {bytes:serialize([...out.values()].sort((a,c)=>a.num-c.num),found),
  report:{decryptedStreams,decryptedStrings,expandedObjects:expanded,handler:method,permissions:found.security.P}};
}
function serialize(objects,found){
 const parts=[ascii('%PDF-1.7\n'),Uint8Array.from([37,226,227,207,211,10])];
 let at=parts.reduce((n,p)=>n+p.length,0);
 const push=bytes=>{parts.push(bytes);at+=bytes.length;};
 const offsets=new Map(),max=objects.reduce((n,o)=>Math.max(n,o.num),0);
 for(const object of objects){
  offsets.set(object.num,{at,gen:object.gen||0});
  push(ascii(`${object.num} ${object.gen||0} obj\n`));
  push(object.dict||object.body||ascii('null'));
  if(object.stream){push(ascii('\nstream\n'));push(object.stream);push(ascii('\nendstream'));}
  push(ascii('\nendobj\n'));
 }
 const start=at;
 let table=`xref\n0 ${max+1}\n0000000000 65535 f \n`;
 for(let n=1;n<=max;n++){
  const slot=offsets.get(n);
  table+=slot?`${String(slot.at).padStart(10,'0')} ${String(slot.gen).padStart(5,'0')} n \n`:'0000000000 65535 f \n';
 }
 push(ascii(table));
 const id=found.id?.length?`/ID[<${hex(found.id)}><${hex(found.id)}>]`:'';
 push(ascii(`trailer\n<</Size ${max+1}/Root ${found.root.ref} ${found.root.gen||0} R${found.info?`/Info ${found.info.ref} ${found.info.gen||0} R`:''}${id}>>\nstartxref\n${start}\n%%EOF\n`));
 return cat(...parts);
}
