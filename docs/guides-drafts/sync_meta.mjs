// Merges SCRATCH/guides/meta/*.json into src/guides.js GUIDES (only guides whose en/ko/ja md exist).
import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
const W='C:/Users/2009s/Desktop/SITE/.claude/worktrees/agent-aef499f5f486793c5/';
const M='C:/Users/2009s/AppData/Local/Temp/claude/C--Users-2009s-Desktop-SITE/6366d22b-5639-4c5c-b872-1c20b9b6adcd/scratchpad/guides/meta/';
const ORDER=['godot-4-sprite-sheet-animation','unity-6-slice-sprite-sheet-animation','phaser-sprite-sheet-atlas-animation','pixijs-8-spritesheet-animation','gamemaker-import-sprite-strip','defold-atlas-tile-source-flipbook','love2d-sprite-sheet-quads-anim8','aseprite-files-godot-unity-phaser',
 'godot-4-pixel-art-blurry-jitter','unity-pixel-art-blurry-pixel-perfect','pixel-art-crisp-in-browser-phaser-pixi','fix-ai-generated-pixel-art','palette-swap-sprites',
 'godot-4-terrain-autotile-47-blob','dual-grid-autotile','unity-rule-tile-autotile','tiled-wang-sets-terrain','rpg-maker-a2-autotile-to-godot','tile-seams-texture-bleeding-padding-extrude',
 'sprite-sheet-vs-texture-atlas','hitboxes-pivots-2d-animation','2d-normal-maps-lighting-godot-unity','opengl-vs-directx-normal-maps',
 'bitmap-font-sdf-msdf-game-ui','cjk-font-atlas-localization','nine-slice-ui-godot-unity-phaser'];
const metas=readdirSync(M).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(readFileSync(M+f,'utf8').replace(/^\uFEFF/,'')));
// Coordinator's section choice where a writer's differs (the index groups by these).
const SECTION={'phaser-sprite-sheet-atlas-animation':'sprites','pixijs-8-spritesheet-animation':'sprites','love2d-sprite-sheet-quads-anim8':'sprites','defold-atlas-tile-source-flipbook':'sprites','gamemaker-import-sprite-strip':'sprites','aseprite-files-godot-unity-phaser':'sprites','godot-4-sprite-sheet-animation':'sprites','unity-6-slice-sprite-sheet-animation':'sprites','hitboxes-pivots-2d-animation':'animation','palette-swap-sprites':'pixel-art','fix-ai-generated-pixel-art':'pixel-art','nine-slice-ui-godot-unity-phaser':'ui','tile-seams-texture-bleeding-padding-extrude':'tiles','sprite-sheet-vs-texture-atlas':'atlas'};
for(const g of metas)if(SECTION[g.slug])g.section=SECTION[g.slug];
const ready=metas.filter(g=>['en','ko','ja'].every(l=>existsSync(`${W}content/guides/${g.slug}/${l}.md`)));
ready.sort((a,b)=>(ORDER.indexOf(a.slug)+1||99)-(ORDER.indexOf(b.slug)+1||99));
const slugs=new Set(ready.map(g=>g.slug));
const q=s=>JSON.stringify(s);
const tri=o=>`{ko:${q(o.ko)},en:${q(o.en)},ja:${q(o.ja)}}`;
const updated=process.argv[2]||'2026-09-24';
const rows=ready.map(g=>{
 const related=(g.related||[]).filter(s=>s!==g.slug);
 const open=g.open.ws?`{ws:${q(g.open.ws)}}`:`{tool:${q(g.open.tool)}}`;
 return ` {slug:${q(g.slug)},section:${q(g.section)},engines:${q(g.engines)},updated:${q(g.updated&&/^\d{4}-\d\d-\d\d$/.test(g.updated)?g.updated:updated)},tools:${q(g.tools)},open:${open},related:${q(related)},tested:${q(g.tested||[])},\n  title:${tri(g.title)},\n  description:${tri(g.description)}}`;
});
const file=W+'src/guides.js';let src=readFileSync(file,'utf8');
src=src.replace(/export const GUIDES=Object\.freeze\(\[[\s\S]*?\n\]\);/,`export const GUIDES=Object.freeze([\n${rows.join(',\n')}\n]);`);
writeFileSync(file,src);
console.log('guides:',ready.map(g=>g.slug).join(', '));
console.log('missing related:',ready.flatMap(g=>(g.related||[]).filter(s=>!slugs.has(s)).map(s=>g.slug+'→'+s)).join(', '));
console.log('meta without full content:',metas.filter(g=>!slugs.has(g.slug)).map(g=>g.slug).join(', '));
