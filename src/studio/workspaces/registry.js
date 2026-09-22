/** Workspace plug-in registry. Pure: holds definitions, knows nothing about the DOM.
 *
 * A workspace definition:
 *   {id, title (string key), status:'ready'|'coming', phase?:'P1'…, summary?:key,
 *    accepts?(file) → bool,              which dropped files it can open (default: images)
 *    activate(ctx) → {deactivate?(), onDocument?(doc, prev), onLocale?(), onAsset?(id)}}
 * `ctx` is described in docs/STUDIO.md: it registers tools, panels, commands, menus and keys that
 * are removed automatically when the workspace is switched away. A 'coming' workspace has no
 * activate(): the shell lists it as coming, and it never shows a button that does nothing. */
const ID=/^[a-z][a-z0-9-]{0,31}$/;
export class WorkspaceRegistry{
 constructor(){this.map=new Map();}
 register(def){
  if(!def||!ID.test(String(def.id)))throw Error('Workspace id must be lowercase letters, digits or dashes');
  if(this.map.has(def.id))throw Error(`Workspace ${def.id} is already registered`);
  if(!['ready','coming'].includes(def.status))throw Error(`Workspace ${def.id}: status must be ready or coming`);
  if(def.status==='ready'&&typeof def.activate!=='function')throw Error(`Workspace ${def.id}: a ready workspace needs activate(ctx)`);
  if(!def.title)throw Error(`Workspace ${def.id}: title key missing`);
  this.map.set(def.id,Object.freeze({...def}));return this;
 }
 get(id){return this.map.get(id)||null;}
 list(){return [...this.map.values()];}
 firstReady(){return this.list().find(w=>w.status==='ready')||null;}
}
