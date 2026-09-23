import {readdirSync} from 'node:fs';import {spawnSync} from 'node:child_process';
// A listed folder may not exist yet while a Lab is still being built; an empty read is not a failure.
const modules=folder=>{try{return readdirSync(folder);}catch{return [];}};
for(const folder of ['src','src/task','src/game','src/game/exporters','src/game/pack','src/game/export','src/studio','src/studio/canvas','src/studio/core','src/studio/ui','src/studio/workspaces','src/studio/sprite','server','tools'])for(const file of modules(folder).filter(f=>/\.(mjs|js)$/.test(f))){const r=spawnSync(process.execPath,['--check',`${folder}/${file}`],{stdio:'inherit'});if(r.status)process.exit(r.status);}
console.log('All source and tool modules passed syntax checks.');
