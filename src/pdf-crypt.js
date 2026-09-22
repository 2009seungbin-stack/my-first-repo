/** The PDF standard security handler, in the browser and nowhere else.
 * pdf-lib cannot encrypt, so this implements ISO 32000 algorithms 2, 2.A, 2.B and 7-13 on top of
 * WebCrypto: AES-256 (revision 6) for everything we write, plus AES-128 (AESV2) and RC4 reading
 * so that files other tools protected can be opened. MD5 and RC4 are here because WebCrypto
 * refuses them by design; they are only ever used to read revision 2-4 documents.
 * No key, password or file byte leaves the page. */
const PAD=Uint8Array.from([0x28,0xbf,0x4e,0x5e,0x4e,0x75,0x8a,0x41,0x64,0x00,0x4e,0x56,0xff,0xfa,0x01,0x08,0x2e,0x2e,0x00,0xb6,0xd0,0x68,0x3e,0x80,0x2f,0x0c,0xa9,0xfe,0x64,0x53,0x69,0x7a]);
export const cat=(...parts)=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;};
const bytesOf=s=>new TextEncoder().encode(s);
export const random=n=>crypto.getRandomValues(new Uint8Array(n));
const MD5_SHIFTS=[7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
const MD5_K=Int32Array.from({length:64},(_,i)=>Math.floor(Math.abs(Math.sin(i+1))*4294967296));
export function md5(input){
 const size=input.length+9+63&~63,padded=new Uint8Array(size),view=new DataView(padded.buffer);
 padded.set(input);padded[input.length]=0x80;
 view.setUint32(size-8,input.length*8>>>0,true);view.setUint32(size-4,Math.floor(input.length/536870912),true);
 let a0=0x67452301,b0=0xefcdab89|0,c0=0x98badcfe|0,d0=0x10325476;
 for(let chunk=0;chunk<size;chunk+=64){
  let a=a0,b=b0,c=c0,d=d0;
  for(let i=0;i<64;i++){
   const f=i<16?b&c|~b&d:i<32?d&b|~d&c:i<48?b^c^d:c^(b|~d),g=i<16?i:i<32?(5*i+1)%16:i<48?(3*i+5)%16:7*i%16;
   const sum=f+a+MD5_K[i]+view.getInt32(chunk+g*4,true)|0,shift=MD5_SHIFTS[i];
   a=d;d=c;c=b;b=b+(sum<<shift|sum>>>32-shift)|0;
  }
  a0=a0+a|0;b0=b0+b|0;c0=c0+c|0;d0=d0+d|0;
 }
 const out=new Uint8Array(16),o=new DataView(out.buffer);
 o.setInt32(0,a0,true);o.setInt32(4,b0,true);o.setInt32(8,c0,true);o.setInt32(12,d0,true);
 return out;
}
export function rc4(key,data){
 const s=new Uint8Array(256);for(let i=0;i<256;i++)s[i]=i;
 for(let i=0,j=0;i<256;i++){j=j+s[i]+key[i%key.length]&255;const t=s[i];s[i]=s[j];s[j]=t;}
 const out=new Uint8Array(data.length);
 for(let k=0,i=0,j=0;k<data.length;k++){i=i+1&255;j=j+s[i]&255;const t=s[i];s[i]=s[j];s[j]=t;out[k]=data[k]^s[s[i]+s[j]&255];}
 return out;
}
const importKey=raw=>crypto.subtle.importKey('raw',raw.slice(),'AES-CBC',false,['encrypt','decrypt']);
/** CBC without padding, both ways. WebCrypto always pads, so encryption drops the extra block and
 * decryption appends a block crafted to decrypt into a full pad block, which WebCrypto then strips. */
async function encryptRaw(key,iv,data){
 const out=new Uint8Array(await crypto.subtle.encrypt({name:'AES-CBC',iv},key,data));
 return out.subarray(0,data.length);
}
async function decryptRaw(key,iv,data){
 if(!data.length||data.length%16)return null;
 const pad=new Uint8Array(16).fill(16),last=data.subarray(data.length-16);
 for(let i=0;i<16;i++)pad[i]^=last[i];
 const tail=await encryptRaw(key,new Uint8Array(16),pad);
 return new Uint8Array(await crypto.subtle.decrypt({name:'AES-CBC',iv},key,cat(data,tail)));
}
const unpad=data=>{const n=data[data.length-1];return n>=1&&n<=16&&n<=data.length?data.subarray(0,data.length-n):data;};
/** Algorithm 2.B: the revision 6 hardened password hash. */
async function hash2B(password,salt,extra,revision){
 let k=new Uint8Array(await crypto.subtle.digest('SHA-256',cat(password,salt,extra)));
 if(revision===5)return k;
 let e=Uint8Array.from([0]),i=0;
 while(i<64||e[e.length-1]>i-32){
  const block=cat(password,k,extra),k1=new Uint8Array(block.length*64);
  for(let n=0;n<64;n++)k1.set(block,n*block.length);
  e=await encryptRaw(await importKey(k.subarray(0,16)),k.subarray(16,32),k1);
  let sum=0;for(let n=0;n<16;n++)sum+=e[n];
  k=new Uint8Array(await crypto.subtle.digest(['SHA-256','SHA-384','SHA-512'][sum%3],e));
  i++;
 }
 return k.subarray(0,32);
}
/** Permission bits, as the spec numbers them from 1. Bits 1-2 are always clear, 7-8 and 13+ set. */
export const PERMISSION_BITS={print:4,modify:8,copy:16,annotate:32,forms:256,accessible:512,assemble:1024,printHigh:2048};
export function permissionValue(allow={}){
 let p=-1&~3&~Object.values(PERMISSION_BITS).reduce((a,b)=>a|b,0);
 for(const [name,bit] of Object.entries(PERMISSION_BITS))if(allow[name])p|=bit;
 if(allow.print)p|=PERMISSION_BITS.printHigh;
 if(allow.annotate)p|=PERMISSION_BITS.forms;
 if(allow.copy)p|=PERMISSION_BITS.accessible;
 if(allow.modify)p|=PERMISSION_BITS.assemble|PERMISSION_BITS.forms;
 return p|0;
}
const utf8Password=text=>bytesOf(String(text??'')).subarray(0,127);
/** Everything a revision 6 /Encrypt dictionary needs, for a freshly generated file key. */
export async function buildV5Security({password='',ownerPassword='',permissions=-3904,encryptMetadata=true}={}){
 const fileKey=random(32),user=utf8Password(password),owner=utf8Password(ownerPassword||password);
 const uv=random(8),uk=random(8);
 const U=cat(await hash2B(user,uv,new Uint8Array(0),6),uv,uk);
 const UE=await encryptRaw(await importKey(await hash2B(user,uk,new Uint8Array(0),6)),new Uint8Array(16),fileKey);
 const ov=random(8),ok=random(8);
 const O=cat(await hash2B(owner,ov,U,6),ov,ok);
 const OE=await encryptRaw(await importKey(await hash2B(owner,ok,U,6)),new Uint8Array(16),fileKey);
 const perms=new Uint8Array(16);
 perms.set([permissions&255,permissions>>8&255,permissions>>16&255,permissions>>24&255,255,255,255,255,encryptMetadata?84:70,97,100,98]);
 perms.set(random(4),12);
 const Perms=await encryptRaw(await importKey(fileKey),new Uint8Array(16),perms);
 return {fileKey,U,O,UE,OE,Perms,permissions,encryptMetadata,V:5,R:6};
}
/** AESV3: one random IV per string and per stream, the file key used directly. */
export async function encryptAESV3(fileKey,data){
 const key=await importKey(fileKey),iv=random(16);
 return cat(iv,new Uint8Array(await crypto.subtle.encrypt({name:'AES-CBC',iv},key,data)));
}
// ---- reading an existing /Encrypt dictionary
const latin1=text=>Uint8Array.from(String(text??''),c=>c.charCodeAt(0)&255);
const padPassword=text=>cat(latin1(text).subarray(0,32),PAD).subarray(0,32);
/** Algorithm 2: the revision 2-4 file key from an already padded 32-byte password. */
function legacyFileKey(padded,{O,P,id,R,length,encryptMetadata}){
 const p=new Uint8Array(4);new DataView(p.buffer).setInt32(0,P,true);
 let input=cat(padded,O.subarray(0,32),p,id);
 if(R>=4&&!encryptMetadata)input=cat(input,Uint8Array.from([255,255,255,255]));
 const size=R===2?5:Math.max(5,Math.min(16,length>>3));
 let k=md5(input);
 if(R>=3)for(let i=0;i<50;i++)k=md5(k.subarray(0,size));
 return k.subarray(0,size);
}
/** Algorithm 6: rebuild /U from a candidate key and compare. */
function opensDocument(key,{U,id,R}){
 let expected;
 if(R===2)expected=rc4(key,PAD);
 else{let d=rc4(key,md5(cat(PAD,id)));for(let i=1;i<=19;i++)d=rc4(Uint8Array.from(key,b=>b^i),d);expected=d;}
 for(let i=0;i<(R===2?32:16);i++)if(expected[i]!==U[i])return false;
 return true;
}
/** Algorithm 7: an owner password yields the padded user password, which then yields the key. */
function userPasswordFromOwner(text,{O,R,length}){
 const size=R===2?5:Math.max(5,Math.min(16,length>>3));
 let k=md5(padPassword(text));
 if(R>=3)for(let i=0;i<50;i++)k=md5(k.subarray(0,size));
 const owner=k.subarray(0,size);
 let user=O.subarray(0,32);
 if(R===2)return rc4(owner,user);
 for(let i=19;i>=0;i--)user=rc4(Uint8Array.from(owner,b=>b^i),user);
 return user;
}
/** Does this password open the document, and with which file key? Null when it does not. */
export async function fileKeyFor(password,info){
 const {V,R,U,O,UE,OE}=info;
 if(V>=5){
  const pwd=utf8Password(password),empty=new Uint8Array(0);
  for(const [hash,vsalt,ksalt,extra,wrapped] of [[U.subarray(0,32),U.subarray(32,40),U.subarray(40,48),empty,UE],[O.subarray(0,32),O.subarray(32,40),O.subarray(40,48),U.subarray(0,48),OE]]){
   const check=await hash2B(pwd,vsalt,extra,R);
   if(!check.every((b,i)=>b===hash[i]))continue;
   const key=await decryptRaw(await importKey(await hash2B(pwd,ksalt,extra,R)),new Uint8Array(16),wrapped);
   if(key)return key.subarray(0,32);
  }
  return null;
 }
 const asUser=legacyFileKey(padPassword(password),info);
 if(opensDocument(asUser,info))return asUser;
 const asOwner=legacyFileKey(userPasswordFromOwner(password,info),info);
 return opensDocument(asOwner,info)?asOwner:null;
}
/** Per-object key and cipher for revisions 2-4; revision 5+ uses the file key unchanged. */
export async function decryptObject(info,fileKey,num,gen,data,method){
 if(!data.length)return data;
 if(info.V>=5||method==='AESV3'){
  if(data.length<=16)return new Uint8Array(0);
  const out=await decryptRaw(await importKey(fileKey),data.subarray(0,16),data.subarray(16));
  return out?unpad(out):null;
 }
 const tail=Uint8Array.from([num&255,num>>8&255,num>>16&255,gen&255,gen>>8&255]);
 const salt=method==='AESV2'?bytesOf('sAlT'):new Uint8Array(0);
 const objKey=md5(cat(fileKey,tail,salt)).subarray(0,Math.min(fileKey.length+5,16));
 if(method==='AESV2'){
  if(data.length<=16)return new Uint8Array(0);
  const out=await decryptRaw(await importKey(objKey),data.subarray(0,16),data.subarray(16));
  return out?unpad(out):null;
 }
 return rc4(objKey,data);
}
