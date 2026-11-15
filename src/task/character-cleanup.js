// Pure text clean-up actions for the character counter. Each returns a new string; nothing is
// applied unless the user presses the matching button, and the editor's undo history keeps the original.
export const CLEANUPS=Object.freeze(['trimLines','collapseSpaces','removeBlankLines','joinLines']);
const SPACE='[ \\t\\u00a0\\u3000]';
const NO_SPACE_SCRIPT=/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}、。「」『』（）！？ー]/u;
export function cleanText(input,action){
 const text=String(input??'').replace(/\r\n|\r/gu,'\n');
 if(action==='trimLines')return text.split('\n').map(line=>line.replace(new RegExp(`${SPACE}+$`,'u'),'')).join('\n').replace(/^\n+|\n+$/gu,'');
 // A run of spaces keeps its first character, so a full-width space stays full-width.
 if(action==='collapseSpaces')return text.replace(new RegExp(`(${SPACE})${SPACE}+`,'gu'),'$1');
 if(action==='removeBlankLines')return text.split('\n').filter(line=>line.trim()).join('\n');
 if(action==='joinLines'){
  const lines=text.split('\n').map(line=>line.trim()).filter(Boolean);let out=lines[0]||'';
  // Chinese and Japanese lines are joined without a space; everything else gets one space.
  for(const line of lines.slice(1)){const a=[...out].at(-1),b=[...line][0];out+=(NO_SPACE_SCRIPT.test(a)&&NO_SPACE_SCRIPT.test(b)?'':' ')+line;}
  return out;
 }
 throw new RangeError('Unknown clean-up action');
}
