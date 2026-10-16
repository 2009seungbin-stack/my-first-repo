// @ts-check
import {validateEnvironment} from '../core/parser.js';
import {POLICY} from '../core/policy.js';
const PREFIX='nerulio.preflight.v1.',INDEX=PREFIX+'index';
/** @typedef {Pick<Storage,'getItem'|'setItem'|'removeItem'>} Store */
/** @typedef {{id:string,name:string,vertical:string,updatedAt:string,sample:boolean}} SetupEntry */
/** @param {Store} storage @returns {SetupEntry[]} */
export function listSetups(storage){
 const raw=storage.getItem(INDEX);if(!raw)return [];
 const x=JSON.parse(raw);
 if(x.schemaVersion!==1||!Array.isArray(x.setups)||x.setups.length>POLICY.maxSetups)throw Error('Unsupported or corrupt saved setup index');
 return x.setups.filter((/** @type {SetupEntry} */ e)=>e&&typeof e.id==='string'&&/^[\w-]{1,80}$/.test(e.id)&&typeof e.name==='string');
}
/** @param {Store} storage @param {import('../core/types').PreflightEnvironment} input @param {string} [id] */
export function saveSetup(storage,input,id=crypto.randomUUID()){
 if(!/^[\w-]{1,80}$/.test(id))throw Error('Invalid setup ID');
 const environment=validateEnvironment(input),list=listSetups(storage),key=PREFIX+'setup.'+id,previous=storage.getItem(key);
 if(!list.some(s=>s.id===id)&&list.length>=POLICY.maxSetups)throw Error('Maximum 50 saved setups');
 const metadata={id,name:environment.name,vertical:environment.vertical,updatedAt:new Date().toISOString(),sample:environment.sample};
 const next=[metadata,...list.filter(s=>s.id!==id)];
 storage.setItem(key,JSON.stringify({schemaVersion:1,environment}));
 try{storage.setItem(INDEX,JSON.stringify({schemaVersion:1,setups:next}));}
 catch(e){if(previous)storage.setItem(key,previous);else storage.removeItem(key);throw e;}
 return id;
}
/** @param {Store} storage @param {string} id */
export function loadSetup(storage,id){
 if(!listSetups(storage).some(e=>e.id===id))throw Error('Saved setup not found');
 const raw=storage.getItem(PREFIX+'setup.'+id);if(!raw)throw Error('Saved setup is missing');
 const x=JSON.parse(raw);if(x.schemaVersion!==1)throw Error('Unsupported saved setup schema');
 return validateEnvironment(x.environment);
}
/** @param {Store} storage @param {string} id @param {string} name */
export function renameSetup(storage,id,name){
 const env=loadSetup(storage,id);env.name=name;saveSetup(storage,env,id);
}
/** @param {Store} storage @param {string} id */
export function deleteSetup(storage,id){
 const list=listSetups(storage);
 storage.setItem(INDEX,JSON.stringify({schemaVersion:1,setups:list.filter(e=>e.id!==id)}));
 storage.removeItem(PREFIX+'setup.'+id);
}
