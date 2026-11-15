/** Search and quick filters of the /game/ hub. Pure: the build (tools/game-landing-build.mjs) counts
 * the chips with the same functions the page (src/game-landing.js) filters with, so a count printed
 * in the markup is the number of cards the filter shows. */
/** Case- and width-insensitive form of a text: NFKC, lower case, single spaces. */
export const fold=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
/** The words of a query. */
export const tokensOf=query=>fold(query).split(' ').filter(Boolean);
/** Does `text` (already folded) contain every word of the query? An empty query matches. */
export const matchesQuery=(text,query)=>tokensOf(query).every(w=>text.includes(w));
/** Quick filters: an engine/application or a kind of asset. A card matches a chip when its title,
 * description or URL contains any of the chip's terms (terms are folded text). `not`: phrases that
 * contain a term without meaning it (TexturePacker is an atlas format, not a texture; "tiled 3×3" is
 * not the Tiled editor) — they are taken out of the text before the terms are looked for. */
export const HUB_CHIPS=Object.freeze([
 {id:'godot',label:{en:'Godot',ko:'Godot',ja:'Godot'},terms:['godot']},
 {id:'unity',label:{en:'Unity',ko:'Unity',ja:'Unity'},terms:['unity']},
 {id:'phaser',label:{en:'Phaser',ko:'Phaser',ja:'Phaser'},terms:['phaser']},
 {id:'gamemaker',label:{en:'GameMaker',ko:'GameMaker',ja:'GameMaker'},terms:['gamemaker','game maker']},
 {id:'tiled',label:{en:'Tiled',ko:'Tiled',ja:'Tiled'},terms:['tiled'],not:['tiled 3×3','tiled 3x3']},
 {id:'aseprite',label:{en:'Aseprite',ko:'Aseprite',ja:'Aseprite'},terms:['aseprite']},
 {id:'sprite',label:{en:'Sprites',ko:'스프라이트',ja:'スプライト'},terms:['sprite','스프라이트','スプライト']},
 {id:'tile',label:{en:'Tilesets',ko:'타일셋',ja:'タイルセット'},terms:['tileset','tilemap','autotile','타일셋','타일맵','오토타일','タイルセット','タイルマップ','オートタイル']},
 {id:'pixel',label:{en:'Pixel art',ko:'도트',ja:'ドット絵'},terms:['pixel art','pixel-art','도트','픽셀 아트','ドット絵','ピクセルアート']},
 {id:'texture',label:{en:'Textures',ko:'텍스처',ja:'テクスチャ'},terms:['texture','normal map','normal-map','텍스처','노멀맵','テクスチャ','ノーマルマップ'],not:['texturepacker','texture packer']},
 {id:'font',label:{en:'Bitmap fonts',ko:'비트맵 폰트',ja:'ビットマップフォント'},terms:['font','폰트','フォント']}
]);
export const chipById=id=>HUB_CHIPS.find(c=>c.id===id)||null;
export function matchesChip(text,chip){
 if(!chip)return true;
 let x=text;for(const w of chip.not||[])x=x.split(w).join(' ');
 return chip.terms.some(w=>x.includes(w));
}
/** The searchable text of a card. */
export const cardText=(title,description,path)=>fold(`${title} ${description} ${String(path||'').replace(/[/_-]+/g,' ')} ${path||''}`);
/** Which cards (folded texts) a state shows: indexes of the matches. */
export function filterCards(texts,{q='',chip=''}={}){
 const c=chipById(chip),out=[];
 texts.forEach((x,i)=>{if(matchesQuery(x,q)&&matchesChip(x,c))out.push(i);});
 return out;
}
/** State ⇄ URL (?q=…&f=…). Unknown chips are dropped; the query is trimmed and capped. */
export function readState(search){
 const p=new URLSearchParams(search||''),q=(p.get('q')||'').trim().slice(0,80),f=p.get('f')||'';
 return {q,chip:chipById(f)?f:''};
}
export function writeState(search,{q='',chip=''}={}){
 const p=new URLSearchParams(search||'');p.delete('q');p.delete('f');
 if(q.trim())p.set('q',q.trim().slice(0,80));
 if(chipById(chip))p.set('f',chip);
 const s=p.toString();return s?'?'+s:'';
}
