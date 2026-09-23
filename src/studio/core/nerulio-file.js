/** The `.nerulio` project file: a ZIP (written by src/core.js `zip`, stored, no recompression of
 * PNGs) holding
 *   project.json        {format:'nerulio-project-file', fileVersion, app, savedAt, project}
 *   images/<sha256>.png every image the project references, once, named by its content hash
 * Reading verifies each image's hash against its name, so a damaged or hand-edited file is caught
 * at open time rather than exported wrong later. Round trip is exact: same document, same bytes. */
import {zip} from '../../core.js';
import {readZip} from './zip-read.js';
import {normalizeProject,referencedBlobs} from './project.js';
export const FILE_FORMAT='nerulio-project-file',FILE_VERSION=1,EXTENSION='.nerulio',MIME='application/x-nerulio-project';
export async function sha256Hex(blob){
 const buf=await (blob.arrayBuffer?blob.arrayBuffer():blob);
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',buf))].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export const imagePath=id=>`images/${id}.png`;
export function projectManifest(doc,{savedAt=new Date().toISOString(),app='nerulio-studio'}={}){
 return {format:FILE_FORMAT,fileVersion:FILE_VERSION,app,savedAt,project:doc};
}
/** @param getBlob id → Blob (PNG) for every referenced image */
export async function writeProjectFile(doc,getBlob,{savedAt,signal}={}){
 const manifest=projectManifest(doc,{savedAt});
 const entries=[{name:'project.json',blob:new Blob([JSON.stringify(manifest,null,1)],{type:'application/json'})}];
 for(const id of referencedBlobs(doc)){const b=await getBlob(id);if(!b)throw Error(`Image ${id.slice(0,8)}… is missing from memory`);entries.push({name:imagePath(id),blob:b});}
 const out=await zip(entries,{paths:true,signal});
 return new Blob([out],{type:MIME});
}
/** @returns {doc, blobs: Map<id, Blob>, savedAt} */
export async function readProjectFile(blob){
 const z=await readZip(blob);
 if(!z.has('project.json'))throw Error('This file has no project.json — it is not a Nerulio project');
 let manifest;try{manifest=JSON.parse(await z.text('project.json'));}catch{throw Error('project.json is not valid JSON');}
 if(manifest?.format!==FILE_FORMAT)throw Error('Not a Nerulio project file');
 if(!(manifest.fileVersion>=1))throw Error('Unknown project file version');
 if(manifest.fileVersion>FILE_VERSION)throw Error(`Saved by a newer Studio (file format ${manifest.fileVersion})`);
 const doc=normalizeProject(manifest.project),blobs=new Map();
 for(const id of referencedBlobs(doc)){
  const path=imagePath(id);if(!z.has(path))throw Error(`The project refers to an image that is not in the file (${path})`);
  const b=await z.blob(path,'image/png');
  if(await sha256Hex(b)!==id)throw Error(`Image ${path} does not match its checksum`);
  blobs.set(id,b);
 }
 return {doc,blobs,savedAt:String(manifest.savedAt||'')};
}
