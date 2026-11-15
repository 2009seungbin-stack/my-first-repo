/** Shared, side-effect-free palette presets for task and Studio converters. */
// EGA drives each channel with two bits, so its 64 colours are every mix of these four levels.
const EGA_LEVELS=['00','55','aa','ff'];
export const PALETTES=Object.freeze({
 gameboy:['#0f380f','#306230','#8bac0f','#9bbc0f'],
 pico8:['#000000','#1d2b53','#7e2553','#008751','#ab5236','#5f574f','#c2c3c7','#fff1e8','#ff004d','#ffa300','#ffec27','#00e436','#29adff','#83769c','#ff77a8','#ffccaa'],
 sweetie16:['#1a1c2c','#5d275d','#b13e53','#ef7d57','#ffcd75','#a7f070','#38b764','#257179','#29366f','#3b5dc9','#41a6f6','#73eff7','#f4f4f4','#94b0c2','#566c86','#333c57'],
 endesga32:['#be4a2f','#d77643','#ead4aa','#e4a672','#b86f50','#733e39','#3e2731','#a22633','#e43b44','#f77622','#feae34','#fee761','#63c74d','#3e8948','#265c42','#193c3e','#124e89','#0099db','#2ce8f5','#ffffff','#c0cbdc','#8b9bb4','#5a6988','#3a4466','#262b44','#181425','#ff0044','#68386c','#b55088','#f6757a','#e8b796','#c28569'],
 nes:['#000000','#fcfcfc','#f8f8f8','#bcbcbc','#7c7c7c','#a4e4fc','#3cbcfc','#0078f8','#0000fc','#b8b8f8','#6888fc','#0058f8','#0000bc','#d8b8f8','#9878f8','#6844fc','#4428bc','#f8b8f8','#f878f8','#d800cc','#940084','#f8a4c0','#f85898','#e40058','#a80020','#f0d0b0','#f87858','#f83800','#a81000','#fce0a8','#fca044','#e45c10','#881400','#f8d878','#f8b800','#ac7c00','#503000','#d8f878','#b8f818','#00b800','#007800','#b8f8b8','#58d854','#00a800','#006800','#b8f8d8','#58f898','#00a844','#005800','#00fcfc','#00e8d8','#008888','#004058'],
 mono:['#000000','#ffffff'],
 gray4:['#000000','#555555','#aaaaaa','#ffffff'],
 nokia3310:['#43523d','#c7f0d8'],
 cga16:['#000000','#0000aa','#00aa00','#00aaaa','#aa0000','#aa00aa','#aa5500','#aaaaaa','#555555','#5555ff','#55ff55','#55ffff','#ff5555','#ff55ff','#ffff55','#ffffff'],
 ega64:EGA_LEVELS.flatMap(r=>EGA_LEVELS.flatMap(g=>EGA_LEVELS.map(b=>'#'+r+g+b))),
 c64:['#000000','#ffffff','#68372b','#70a4b2','#6f3d86','#588d43','#352879','#b8c76f','#6f4f25','#433900','#9a6759','#444444','#6c6c6c','#9ad284','#6c5eb5','#959595'],
 zxspectrum:['#000000','#0000d7','#d70000','#d700d7','#00d700','#00d7d7','#d7d700','#d7d7d7','#0000ff','#ff0000','#ff00ff','#00ff00','#00ffff','#ffff00','#ffffff'],
 db16:['#140c1c','#442434','#30346d','#4e4a4e','#854c30','#346524','#d04648','#757161','#597dce','#d27d2c','#8595a1','#6daa2c','#d2aa99','#6dc2ca','#dad45e','#deeed6'],
 db32:['#000000','#222034','#45283c','#663931','#8f563b','#df7126','#d9a066','#eec39a','#fbf236','#99e550','#6abe30','#37946e','#4b692f','#524b24','#323c39','#3f3f74','#306082','#5b6ee1','#639bff','#5fcde4','#cbdbfc','#ffffff','#9badb7','#847e87','#696a6a','#595652','#76428a','#ac3232','#d95763','#d77bba','#8f974a','#8a6f30'],
 arne16:['#000000','#9d9d9d','#ffffff','#be2633','#e06f8b','#493c2b','#a46422','#eb8931','#f7e26b','#2f484e','#44891a','#a3ce27','#1b2632','#005784','#31a2f2','#b2dcef'],
 slso8:['#0d2b45','#203c56','#544e68','#8d697a','#d08159','#ffaa5e','#ffd4a3','#ffecd6'],
 nyx8:['#08141e','#0f2a3f','#20394f','#f6d6bd','#c3a38a','#997577','#816271','#4e495f'],
 oil6:['#fbf5ef','#f2d3ab','#c69fa5','#8b6d9c','#494d7e','#272744'],
 ammo8:['#040c06','#112318','#1e3a29','#305d42','#4d8061','#89a257','#bedc7f','#eeffcc'],
 kirokaze:['#332c50','#46878f','#94e344','#e2f3e4'],
 icecream:['#7c3f58','#eb6b6f','#f9a875','#fff6d3'],
 ayy4:['#00303b','#ff7777','#ffce96','#f1f2da']
});
/** Display names are proper nouns, so one label serves every language; the one descriptive name is localised. */
export const PALETTE_LABELS=Object.freeze({gameboy:'Game Boy',gray4:Object.freeze({ko:'2비트 회색조',en:'2-bit grayscale',ja:'2ビット グレースケール'}),nes:'NES',cga16:'CGA 16',ega64:'EGA 64',c64:'Commodore 64',zxspectrum:'ZX Spectrum',nokia3310:'Nokia 3310',mono:'1-bit',pico8:'PICO-8',
 sweetie16:'Sweetie 16',endesga32:'Endesga 32',db16:'DawnBringer 16',db32:'DawnBringer 32',arne16:'Arne 16',slso8:'SLSO8',nyx8:'Nyx8',oil6:'Oil 6',ammo8:'Ammo-8',kirokaze:'Kirokaze Gameboy',icecream:'Ice Cream GB',ayy4:'AYY4'});
/** Menu order: hardware and fantasy-console palettes first, then community palettes. */
export const PALETTE_GROUPS=Object.freeze([
 Object.freeze({id:'system',label:Object.freeze({ko:'게임기 · 컴퓨터',en:'Consoles & computers',ja:'ゲーム機・パソコン'}),keys:Object.freeze(['gameboy','gray4','nes','pico8','cga16','ega64','c64','zxspectrum','nokia3310','mono'])}),
 Object.freeze({id:'community',label:Object.freeze({ko:'커뮤니티 팔레트',en:'Community palettes',ja:'コミュニティパレット'}),keys:Object.freeze(['sweetie16','endesga32','db16','db32','arne16','slso8','nyx8','oil6','ammo8','kirokaze','icecream','ayy4'])})
]);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const paletteLabel=(key,locale='en')=>{const label=PALETTE_LABELS[key];return typeof label==='string'?label:label?label[locale]||label.en:key;};
/** Grouped <option> markup for a palette <select>; `current` is the selected key. */
export function paletteOptions(current='',locale='en'){
 return PALETTE_GROUPS.map(g=>`<optgroup label="${esc(g.label[locale]||g.label.en)}">${g.keys.map(k=>`<option value="${k}"${current===k?' selected':''}>${esc(paletteLabel(k,locale))} (${PALETTES[k].length})</option>`).join('')}</optgroup>`).join('');
}
/** Colour chips for one palette, reusing the Pixel Lab swatch classes. */
export function paletteSwatches(key){
 return (Object.hasOwn(PALETTES,key)?PALETTES[key]:[]).map(c=>`<span class="plab-chip" style="--c:${c}" title="${c}"></span>`).join('');
}
