/** Keyboard shortcuts. Pure except for the tiny event helpers at the bottom (which only read
 * fields of the event object passed in).
 *
 * A combo is written 'Mod+Shift+Z': modifiers in the fixed order Mod, Ctrl, Alt, Shift, then one
 * key. `Mod` is Ctrl on Windows/Linux and ⌘ on macOS. Letter and digit keys are matched by
 * physical position (KeyboardEvent.code), so shortcuts keep working with a Korean or Japanese IME
 * switched on, where `key` would be 'ㅋ' or a composition. Symbol keys are matched by `key`,
 * because '?' or '+' move around between layouts. */
const MOD_ORDER=['Mod','Ctrl','Alt','Shift'];
const ALIASES={cmd:'Mod',command:'Mod',meta:'Mod',mod:'Mod',control:'Ctrl',ctrl:'Ctrl',option:'Alt',opt:'Alt',alt:'Alt',shift:'Shift',esc:'Escape',del:'Delete',space:'Space',plus:'+',minus:'-',return:'Enter',left:'ArrowLeft',right:'ArrowRight',up:'ArrowUp',down:'ArrowDown'};
/** Canonical form of a written combo, or throws. */
export function parseCombo(text){
 const parts=String(text).split('+').map(s=>s.trim());
 // 'Mod++' (plus key) splits into ['Mod','','']: rebuild the literal '+'.
 const tokens=[];for(let i=0;i<parts.length;i++){if(parts[i]===''&&parts[i+1]===''){tokens.push('+');i++;}else if(parts[i]!=='')tokens.push(parts[i]);}
 const mods=new Set();let key='';
 for(const raw of tokens){
  const a=ALIASES[raw.toLowerCase()]||raw;
  if(MOD_ORDER.includes(a)){mods.add(a);continue;}
  if(key)throw Error(`Combo "${text}" has two keys`);
  key=a.length===1?a.toUpperCase():a;
 }
 if(!key)throw Error(`Combo "${text}" has no key`);
 return [...MOD_ORDER.filter(m=>mods.has(m)),key].join('+');
}
/** The key part of an event: letters/digits by physical code, the rest by produced key. */
export function eventKey(e){
 const code=e.code||'';
 if(/^Key[A-Z]$/.test(code))return code.slice(3);
 if(/^Digit\d$/.test(code))return e.shiftKey&&/^[^\w]$/.test(e.key||'')?e.key:code.slice(5);
 if(/^Numpad\d$/.test(code))return code.slice(6);
 if(code==='NumpadAdd')return '+';
 if(code==='NumpadSubtract')return '-';
 if(code==='Space'||e.key===' ')return 'Space';
 const k=e.key||'';
 if(k.length===1)return k.toUpperCase();
 return k;
}
const PUNCT={Quote:"'",Comma:',',Period:'.',Slash:'/',Semicolon:';',BracketLeft:'[',BracketRight:']',Backquote:'`',Minus:'-',Equal:'=',Backslash:'\\'};
/** Canonical combo for a keyboard event. Without Mod/Alt a symbol is taken as typed and Shift is
 * dropped ('?' is Shift+/ on one layout and something else on another). With Mod/Alt the physical
 * US-layout symbol is used and Shift kept, since Ctrl+Shift+' types different characters per layout. */
export function eventCombo(e,{mac=false}={}){
 const mods=[],mod=mac?e.metaKey:e.ctrlKey,ctrl=mac?e.ctrlKey:false;
 if(mod)mods.push('Mod');if(ctrl)mods.push('Ctrl');if(e.altKey)mods.push('Alt');
 let key=eventKey(e);
 if((mod||ctrl||e.altKey)&&PUNCT[e.code]){key=PUNCT[e.code];if(e.shiftKey)mods.push('Shift');}
 else{const symbol=key.length===1&&!/[A-Z0-9]/.test(key);if(e.shiftKey&&!symbol)mods.push('Shift');}
 return [...mods,key].join('+');
}
/** Aseprite-compatible defaults where Aseprite has a binding; the rest follow common editors. */
export const DEFAULT_KEYS=Object.freeze({
 'edit.undo':['Mod+Z'],'edit.redo':['Mod+Shift+Z','Mod+Y'],
 'edit.selectAll':['Mod+A'],'edit.deselect':['Mod+D','Escape'],'edit.delete':['Delete','Backspace'],
 'file.open':['Mod+O'],'file.save':['Mod+S'],'file.saveAs':['Mod+Shift+S'],'file.import':['Mod+I'],
 'app.palette':['Mod+K','F1'],'app.shortcuts':['?'],
 'view.zoomIn':['+','=','Mod+=','Mod+Shift+=','Mod++'],'view.zoomOut':['-','Mod+-'],'view.zoom100':['1'],'view.fit':['0','Mod+0'],
 'view.zoom200':['2'],'view.zoom400':['3'],'view.zoom800':['4'],'view.zoom1600':['5'],'view.zoom3200':['6'],
 'view.pixelGrid':["Mod+Shift+'"],'view.grid':["Mod+'"],'view.rulers':['Mod+R'],
 'tool.move':['V'],'tool.hand':['H'],'tool.zoom':['Z'],'tool.marquee':['M'],
 'frame.prev':[','],'frame.next':['.'],
 'nudge.left':['ArrowLeft'],'nudge.right':['ArrowRight'],'nudge.up':['ArrowUp'],'nudge.down':['ArrowDown'],
 'nudge.left10':['Shift+ArrowLeft'],'nudge.right10':['Shift+ArrowRight'],'nudge.up10':['Shift+ArrowUp'],'nudge.down10':['Shift+ArrowDown']
});
/** Combo → command id table. Later bindings of the same combo win (a workspace can override). */
export class Keymap{
 constructor(bindings=DEFAULT_KEYS){this.byCombo=new Map();this.byCommand=new Map();for(const [id,combos]of Object.entries(bindings))this.bind(id,combos);}
 bind(id,combos){
  for(const c of [].concat(combos)){const k=parseCombo(c);this.byCombo.set(k,id);const list=this.byCommand.get(id)||[];if(!list.includes(k))list.push(k);this.byCommand.set(id,list);}
  return this;
 }
 unbind(id){for(const k of this.byCommand.get(id)||[])if(this.byCombo.get(k)===id)this.byCombo.delete(k);this.byCommand.delete(id);return this;}
 lookup(combo){return this.byCombo.get(combo)||null;}
 combos(id){return this.byCommand.get(id)||[];}
 /** Conflicts: combos bound to more than one command in `bindings`. */
 static conflicts(bindings){
  const seen=new Map(),out=[];
  for(const [id,combos]of Object.entries(bindings))for(const c of combos){const k=parseCombo(c);if(seen.has(k)&&seen.get(k)!==id)out.push([k,seen.get(k),id]);seen.set(k,id);}
  return out;
 }
}
/** How a combo is shown: '⌘⇧Z' on macOS, 'Ctrl+Shift+Z' elsewhere. */
export function displayCombo(combo,{mac=false}={}){
 const names={ArrowLeft:'←',ArrowRight:'→',ArrowUp:'↑',ArrowDown:'↓',Escape:'Esc',Delete:'Del',Backspace:'⌫',Space:'Space',Enter:'Enter'};
 const parts=combo.split('+'),key=combo.endsWith('++')?'+':parts.pop(),mods=combo.endsWith('++')?parts.slice(0,-2):parts;
 if(mac)return mods.map(m=>({Mod:'⌘',Ctrl:'⌃',Alt:'⌥',Shift:'⇧'}[m])).join('')+(names[key]||key);
 return [...mods.map(m=>m==='Mod'?'Ctrl':m),names[key]||key].join('+');
}
/** True when keystrokes belong to a text field and must not trigger shortcuts. */
export function isTypingTarget(el){
 if(!el||!el.tagName)return false;
 if(el.isContentEditable)return true;
 const tag=el.tagName.toUpperCase();
 if(tag==='TEXTAREA'||tag==='SELECT')return true;
 if(tag!=='INPUT')return false;
 return !['checkbox','radio','button','submit','reset','range','color','file'].includes(String(el.type||'text').toLowerCase());
}
/** Keys whose browser default would scroll, zoom the page or move focus in a surprising way
 * while the Studio has the keyboard. */
export const BROWSER_DEFAULTS_TO_BLOCK=new Set(['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','PageUp','PageDown','Home','End','Mod++','Mod+=','Mod+Shift+=','Mod+-','Mod+0','Mod+S','Mod+Shift+S','Mod+O','Mod+K','Mod+R','Mod+D','Mod+A','Mod+I','Mod+Y','Mod+Z','Mod+Shift+Z',"Mod+'","Mod+Shift+'",'F1']);
