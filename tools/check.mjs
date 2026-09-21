import {readdirSync} from 'node:fs';import {spawnSync} from 'node:child_process';
for(const folder of ['src','src/task','server','tools'])for(const file of readdirSync(folder).filter(f=>/\.(mjs|js)$/.test(f))){const r=spawnSync(process.execPath,['--check',`${folder}/${file}`],{stdio:'inherit'});if(r.status)process.exit(r.status);}
console.log('All source and tool modules passed syntax checks.');
