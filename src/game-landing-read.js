/** Reading aids of the game landings and the hub (src/game-landing.js): which section of
 * "On this page" is being read, and how far down the reading part the page is. Pure. */
/** Index of the section being read: the last one whose top has passed the reading line, the last
 * section once the page is at its end, -1 above the first. `tops`: viewport offsets in page order. */
export function activeIndex(tops,line,atEnd=false){
 if(!tops.length)return -1;
 if(atEnd)return tops.length-1;
 let at=-1;
 for(let i=0;i<tops.length;i++)if(tops[i]<=line)at=i;
 return at;
}
/** Reading progress 0…1 of a scroll offset between where the reading part starts and ends. */
export function progressOf(y,start,end){
 if(!(end>start))return y>=start?1:0;
 return Math.min(1,Math.max(0,(y-start)/(end-start)));
}
/** The text a copy button copies from a snippet: the lines as shown, without trailing spaces or
 * blank lines at either end. */
export const snippetText=text=>String(text??'').replace(/\r\n?/g,'\n').split('\n').map(l=>l.replace(/[ \t]+$/,'')).join('\n').replace(/^\n+|\n+$/g,'');
