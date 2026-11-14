// @ts-check
/** Blender's tag API does not imply a Forgejo release page exists. Keep old stored
 * observations intact while linking their known tags to the official code view.
 * @param {string} entityId @param {string} version @param {unknown} raw
 * @returns {{url:string|null,kind:'release'|'tag'}} */
export function versionNotes(entityId,version,raw){
 const url=typeof raw==='string'?raw:null;
 if(entityId!=='app:blender'||!url)return {url,kind:'release'};
 try{
  const u=new URL(url),tag=/^\/blender\/blender\/(?:releases\/tag|src\/tag)\/v(\d+\.\d+\.\d+)\/?$/.exec(u.pathname);
  if(u.origin==='https://projects.blender.org'&&!u.username&&!u.password&&tag&&version.replace(/^v/,'')===tag[1])return {url:`https://projects.blender.org/blender/blender/src/tag/v${tag[1]}`,kind:'tag'};
 }catch{}
 return {url,kind:'release'};
}
