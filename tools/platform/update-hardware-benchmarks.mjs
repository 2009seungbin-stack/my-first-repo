/** Refresh from the official documented CC0 daily archive. No credentials or D1 changes.
 * Review the resulting data diff and run validation before releasing it. */
import {mkdtemp,writeFile,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../../',import.meta.url));
const dir=await mkdtemp(path.join(tmpdir(),'nerulio-blender-'));
const archive=path.join(dir,'snapshot.zip');
try{
 const r=await fetch('https://opendata.blender.org/snapshots/opendata-latest.zip',{signal:AbortSignal.timeout(120000)});
 if(!r.ok)throw Error(`Blender snapshot HTTP ${r.status}`);
 const bytes=await r.arrayBuffer();if(bytes.byteLength>250e6)throw Error('Snapshot exceeds 250 MB review threshold');
 await writeFile(archive,Buffer.from(bytes));
 const result=spawnSync(process.env.PYTHON||'python',['tools/platform/hardware-benchmarks.py',archive],{cwd:root,stdio:'inherit'});
 if(result.error)throw result.error;if(result.status)throw Error(`Aggregator exited ${result.status}`);
}finally{await unlink(archive).catch(()=>{});await rmdir(dir);}
