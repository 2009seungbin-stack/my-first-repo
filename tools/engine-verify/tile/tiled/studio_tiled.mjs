/** What the Studio's Tiled rule says about the sample map of a bundle (the same grid exportBundle
 * used: sampleCase()). Prints {offset, cells:{"x,y":tileId}, gaps:[[x,y]...]}.
 *   node tools/engine-verify/tile/tiled/studio_tiled.mjs <model.json> */
import {readFileSync} from 'node:fs';
import {resolveTiled,tileId} from '../../../../src/game/tiles/tiled.js';
import {standardCases,getter} from '../cases.mjs';
import {sampleCase} from '../../../../src/game/tiles/exports.js';
const ts=JSON.parse(readFileSync(process.argv[2],'utf8'));
const g=sampleCase(ts,standardCases(ts.terrains.length)).grid;
const r=resolveTiled(ts,{w:g.w,h:g.h,get:getter(g)});
const cells={},gaps=[];
for(const c of r.cells){if(c.id){const [col,row]=c.id.split(',').map(Number);cells[c.x+','+c.y]=tileId(ts,col,row);}else gaps.push([c.x,c.y]);}
console.log(JSON.stringify({offset:r.offset,w:r.w,h:r.h,cells,gaps}));
