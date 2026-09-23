import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../src/studio/core/project.js';
import {writeProjectFile,readProjectFile,sha256Hex,imagePath,filePath} from '../src/studio/core/nerulio-file.js';
import {readZip} from '../src/studio/core/zip-read.js';
import {zip} from '../src/core.js';
// A tiny valid PNG (1×1) and a fake "font" blob: the project format must keep both byte for byte.
const PNG1=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='),c=>c.charCodeAt(0));
test('attached files (fonts) live in settings.files, count as content and round-trip through .nerulio',async()=>{
 const font=new Blob([new Uint8Array([0,1,0,0,9,8,7,6,5,4,3,2,1])],{type:'font/ttf'}),fid=await sha256Hex(font);
 const img=new Blob([PNG1],{type:'image/png'}),iid=await sha256Hex(img);
 let d=P.createProject({id:'p1',name:'fonts'});
 assert.equal(P.hasContent(d),false);
 d=P.attachFile(d,fid,{name:'Galmuri.ttf',type:'font/ttf',size:font.size,owner:'ui'});
 assert.equal(P.hasContent(d),true,'a font-only project has something to save');
 assert.equal(P.attachFile(d,fid,{name:'Galmuri.ttf',type:'font/ttf',size:font.size,owner:'ui'}),d,'re-attaching the same file is a no-op');
 assert.throws(()=>P.attachFile(d,'../x',{}),/SHA-256/);
 d=P.addAssets(d,[P.imageAsset({id:'a1',width:1,height:1,blob:iid})]);
 assert.deepEqual([...P.referencedBlobs(d)].sort(),[fid,iid].sort());
 assert.ok(P.isFileBlob(d,fid)&&!P.isFileBlob(d,iid));
 const store=new Map([[fid,font],[iid,img]]);
 const file=await writeProjectFile(d,id=>store.get(id),{savedAt:'2026-09-23T00:00:00.000Z'});
 const z=await readZip(file);
 assert.deepEqual(z.entries.map(e=>e.name).sort(),[filePath(fid),imagePath(iid),'project.json'].sort());
 const back=await readProjectFile(file);
 assert.deepEqual(back.doc,d);
 assert.deepEqual(new Uint8Array(await back.blobs.get(fid).arrayBuffer()),new Uint8Array(await font.arrayBuffer()));
 assert.equal(back.blobs.get(fid).type,'font/ttf','the file keeps its type');
 const again=await writeProjectFile(back.doc,id=>back.blobs.get(id),{savedAt:back.savedAt});
 assert.deepEqual(new Uint8Array(await again.arrayBuffer()),new Uint8Array(await file.arrayBuffer()),'byte-identical second trip');
 // tampering with the font is caught by its hash
 const manifest=JSON.stringify({format:'nerulio-project-file',fileVersion:1,savedAt:'x',project:d});
 const bad=await zip([{name:'project.json',blob:new Blob([manifest])},{name:imagePath(iid),blob:img},{name:filePath(fid),blob:new Blob([new Uint8Array([1,2,3])])}],{paths:true});
 await assert.rejects(readProjectFile(bad),/checksum/);
 const missing=await zip([{name:'project.json',blob:new Blob([manifest])},{name:imagePath(iid),blob:img}],{paths:true});
 await assert.rejects(readProjectFile(missing),/a file that is not in the file/);
 // detaching drops it from what autosave / the writer keep
 const gone=P.detachFile(d,fid);assert.deepEqual([...P.referencedBlobs(gone)],[iid]);assert.equal(P.detachFile(gone,fid),gone);
});
test('normalizeProject validates attached files',()=>{
 const d=P.attachFile(P.createProject({id:'p'}),'a'.repeat(64),{name:'x.otf',type:'font/otf',size:3,owner:'ui'});
 assert.deepEqual(P.normalizeProject(JSON.parse(JSON.stringify(d))),d);
 const bad=JSON.parse(JSON.stringify(d));bad.settings.files={'../../evil':{name:'x'}};
 assert.throws(()=>P.normalizeProject(bad),/bad id/);
 const bad2=JSON.parse(JSON.stringify(d));bad2.settings.files=[1];
 assert.throws(()=>P.normalizeProject(bad2),/must be an object/);
});
