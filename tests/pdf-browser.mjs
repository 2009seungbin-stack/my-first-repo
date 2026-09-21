import {PDFWorkspace} from '../src/pdf.js';
import * as L from '../assets/vendor/pdf-lib-1.17.1/pdf-lib.esm.min.js';
import {canvas,blobOf,release} from '../src/image.js';
import {md5,rc4,buildV5Security,fileKeyFor,decryptObject,encryptAESV3,permissionValue} from '../src/pdf-crypt.js';
import {protectDocument,unlockDocument,inspect} from '../src/pdf-secure.js';
export async function run(){const checks=[],rows=[],check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);},doc=await L.PDFDocument.create(),font=await doc.embedFont(L.StandardFonts.Helvetica),photo=await createImageBitmap(await(await fetch('/tests/fixtures/astronaut.png')).blob()),c=canvas(2400,2400);c.getContext('2d').drawImage(photo,0,0,2400,2400);photo.close();const jpg=await doc.embedJpg(await(await blobOf(c,'image/jpeg',.99)).arrayBuffer());release(c);
 for(let i=0;i<320;i++){const p=doc.addPage([600,800]);p.drawText(`Searchable source page ${i+1}`,{x:40,y:760,size:20,font});p.drawRectangle({x:20,y:20,width:200,height:100,color:L.rgb(.2,.5,.9)});if(i<3)p.drawImage(jpg,{x:50,y:200,width:500,height:500});}doc.getPage(1).setRotation(L.degrees(90));doc.getPage(2).setCropBox(20,30,500,700);
 const file=new File([await doc.save()], '320-pages.pdf',{type:'application/pdf'}),w=new PDFWorkspace();let ticks=0;const timer=setInterval(()=>ticks++,10),start=performance.now();try{await w.add([file]);check('320 pages loaded without bitmap previews',w.pages.length===320&&w.pages.every(p=>!p.thumb));rows.push({case:'320-page open',inputBytes:file.size,elapsedMs:performance.now()-start,uiTimerTicks:ticks});check('PDF parsing does not block all UI timers',ticks>0);
 let renders=0;const get=w.sources[0].reader.getPage.bind(w.sources[0].reader);w.sources[0].reader.getPage=async n=>{renders++;return get(n);};const p=w.pages[0];p.marks=[{type:'text',text:'Native annotation',x:.1,y:.1,size:20,color:'#ff0000'},{type:'pen',points:[[.1,.2],[.5,.2]],size:3,color:'#ff0000'},{type:'rect',x:.1,y:.3,w:.2,h:.1,size:2,color:'#008800'},{type:'highlight',x:.1,y:.4,w:.3,h:.03,color:'#ffff00'}];w.pages[1].marks=[{type:'text',text:'Rotated annotation',x:.1,y:.1,size:20}];w.pages[2].marks=[{type:'text',text:'한글 日本語',x:.1,y:.1,size:20}];
 const before=performance.now(),optimized=await w.export({optimize:true,maxSide:1200,quality:.75});check('preserve export does not render pages',renders===0);console.log(JSON.stringify(w.lastReport));check('image optimization reduces actual PDF bytes',optimized.size<file.size);check('image object actually recompressed',w.lastReport.optimizedImages>0);const result=new PDFWorkspace();try{await result.add([new File([optimized],'result.pdf',{type:'application/pdf'})]);check('preserved page count',result.pages.length===320);for(const [i,text] of [[0,'Native annotation'],[1,'Rotated annotation'],[2,'한글 日本語'],[319,'Searchable source page 320']]){const page=await result.sources[0].reader.getPage(i+1),data=await page.getTextContent();check(`page ${i+1} searchable text`,data.items.map(x=>x.str).join(' ').includes(text));page.cleanup();}const native=await L.PDFDocument.load(await optimized.arrayBuffer());check('rotation and crop preserved',native.getPage(1).getRotation().angle===90&&native.getPage(2).getCropBox().x===20);const rendered=await result.render(result.pages[0],600);const red=rendered.getContext('2d').getImageData(Math.round(rendered.width*.25),Math.round(rendered.height*.2),1,1).data;check('native pen is at normalized source position',red[0]>220&&red[1]<80);release(rendered);}finally{await result.clear();}rows.push({case:'preserve compression and native annotations',...w.lastReport,inputBytes:file.size,outputBytes:optimized.size,elapsedMs:performance.now()-before});
 const groups=await w.split({mode:'groups',groups:'1-2; 320'});check('custom split groups preserve counts',(await L.PDFDocument.load(await groups[0].blob.arrayBuffer())).getPageCount()===2&&(await L.PDFDocument.load(await groups[1].blob.arrayBuffer())).getPageCount()===1);
 const raster=await w.export({range:'1',raster:true,maxSide:800});const rr=new PDFWorkspace();try{await rr.add([new File([raster],'raster.pdf',{type:'application/pdf'})]);const text=await(await rr.sources[0].reader.getPage(1)).getTextContent();check('aggressive mode honestly removes searchable text',text.items.length===0&&w.lastReport.textPreserved===false);}finally{await rr.clear();}
 const abort=new AbortController();abort.abort();try{await w.export({},()=>{},abort.signal);throw Error('did not cancel');}catch(e){check('PDF export cancellation',e.name==='AbortError');}
 // ---- standard security handler: the primitives first, then a whole document round trip
 const hex=b=>[...b].map(v=>v.toString(16).padStart(2,'0')).join(''),utf8=t=>new TextEncoder().encode(t);
 check('md5 matches RFC 1321 for the empty string',hex(md5(utf8('')))==='d41d8cd98f00b204e9800998ecf8427e');
 check('md5 matches RFC 1321 for "abc"',hex(md5(utf8('abc')))==='900150983cd24fb0d6963f7d28e17f72');
 check('md5 matches RFC 1321 for the 80-digit string',hex(md5(utf8('12345678901234567890123456789012345678901234567890123456789012345678901234567890')))==='57edf4a22be3c955ac49da2e2107b67a');
 check('rc4 matches the published Key/Plaintext vector',hex(rc4(utf8('Key'),utf8('Plaintext')))==='bbf316e8d940af0ad3');
 check('rc4 matches the published Secret/Attack vector',hex(rc4(utf8('Secret'),utf8('Attack at dawn')))==='45a01f645fc35b383552544b9bf5');
 const security=await buildV5Security({password:'open me',ownerPassword:'owner only',permissions:permissionValue({print:true})});
 const info={V:5,R:6,U:security.U,O:security.O,UE:security.UE,OE:security.OE,id:new Uint8Array(16),length:256,encryptMetadata:true,P:security.permissions};
 check('revision 6: the user password recovers the file key',hex(await fileKeyFor('open me',info))===hex(security.fileKey));
 check('revision 6: the owner password recovers the same file key',hex(await fileKeyFor('owner only',info))===hex(security.fileKey));
 check('revision 6: a wrong password yields no key',await fileKeyFor('not it',info)===null);
 for(const n of [0,1,15,16,17,5000]){const data=new Uint8Array(n).map((_,i)=>i*13&255);
  check(`AES-256 round trip at ${n} bytes`,hex(await decryptObject(info,security.fileKey,4,0,await encryptAESV3(security.fileKey,data),'AESV3'))===hex(data));}
 const plain=await w.export({}),protect=await protectDocument(await plain.arrayBuffer(),{password:'open me',ownerPassword:'owner only',permissions:permissionValue({print:true})});
 const seen=inspect(protect.bytes);
 check('protect writes an AES-256 revision 6 handler',seen.encrypted&&seen.method==='AESV3'&&seen.revision===6&&seen.permissions===security.permissions);
 let refused='';try{await L.PDFDocument.load(protect.bytes);}catch(e){refused=e.message;}
 check('a reader refuses the protected document without the password',/encrypted/.test(refused));
 check('the protected document still parses once encryption is ignored',(await L.PDFDocument.load(protect.bytes,{ignoreEncryption:true})).getPageCount()===320);
 let wrong='';try{await unlockDocument(protect.bytes,'not it');}catch(e){wrong=e.message;}
 check('unlock refuses a wrong password instead of guessing',wrong==='WRONG_PASSWORD');
 const opened=await unlockDocument(protect.bytes,'open me');
 check('unlock leaves no encryption dictionary',!inspect(opened.bytes).encrypted);
 const reopened=new PDFWorkspace();
 try{await reopened.add([new File([opened.bytes],'unlocked.pdf',{type:'application/pdf'})]);
  check('the unlocked document opens with all of its pages',reopened.pages.length===320);
  const last=await reopened.sources[0].reader.getPage(320),words=(await last.getTextContent()).items.map(x=>x.str).join(' ');
  check('the unlocked document still has extractable text',words.includes('Searchable source page 320'));last.cleanup();
 }finally{await reopened.clear();}
 rows.push({case:'protect and unlock',inputBytes:plain.size,protectedBytes:protect.bytes.length,unlockedBytes:opened.bytes.length,...opened.report});
 }finally{clearInterval(timer);await w.clear();}return {checks,rows,scope:'320-page synthetic document; mixed JPEG, native text/vector, rotated/cropped pages and CJK annotations, plus a full AES-256 protect and unlock round trip with RFC 1321 and RC4 vectors. Arbitrary real PDF fidelity, and security handlers other than the standard one, remain unverified.'};}
