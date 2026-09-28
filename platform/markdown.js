// @ts-check
/** User text (wiki sections, discussions, comments, report notes) → safe HTML.
 * Never trusts input HTML: everything is escaped first, then a small Markdown subset is applied
 * to the escaped text. Links: http(s) only, rel="nofollow ugc noopener noreferrer". Images: only
 * files Nerulio stored itself (uploads path), never remote URLs. */
export const esc=(/** @type {unknown} */ s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
export const MAX_MARKDOWN=40000;
const UPLOAD_PATH=/^\/u\/[a-z0-9]{8,64}\/(thumb|medium|full)\.(webp|png|jpg)$/;

/** Validate a link target; returns a safe absolute/relative href or null. @param {string} raw */
export function safeHref(raw){
 const s=raw.replace(/&amp;/g,'&').trim();
 if(/^\/(?!\/)[\w\-./?=&%#~+]*$/.test(s))return s;            // same-site path
 try{const u=new URL(s);if((u.protocol==='https:'||u.protocol==='http:')&&!u.username&&!u.password)return u.href;}catch{}
 return null;
}
/** Inline formatting on already-escaped text. @param {string} t */
function inline(t){
 /** @type {string[]} */const codes=[];
 t=t.replace(/`([^`\n]{1,500})`/g,(_,c)=>{codes.push(c);return `\u0000${codes.length-1}\u0000`;});
 t=t.replace(/!\[([^\]\n]{0,200})\]\(([^)\s]{1,300})\)/g,(m,alt,src)=>{
  const s=src.replace(/&amp;/g,'&');return UPLOAD_PATH.test(s)?`<img src="${esc(s)}" alt="${alt}" loading="lazy" decoding="async">`:alt;
 });
 t=t.replace(/\[([^\]\n]{1,300})\]\(([^)\s]{1,2000})\)/g,(m,label,href)=>{
  const h=safeHref(href);if(!h)return label;
  const ext=/^https?:/.test(h);return `<a href="${esc(h)}"${ext?' rel="nofollow ugc noopener noreferrer" target="_blank"':''}>${label}</a>`;
 });
 // Bare URLs become links too.
 t=t.replace(/(^|[\s(])(https?:\/\/[^\s<>()"]{3,2000})/g,(m,pre,url)=>{const h=safeHref(url);return h?`${pre}<a href="${esc(h)}" rel="nofollow ugc noopener noreferrer" target="_blank">${url}</a>`:m;});
 t=t.replace(/\*\*([^*\n]{1,500})\*\*/g,'<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]{1,500})\*/g,'$1<em>$2</em>').replace(/~~([^~\n]{1,500})~~/g,'<del>$1</del>');
 return t.replace(/\u0000(\d+)\u0000/g,(_,i)=>`<code>${codes[Number(i)]}</code>`);
}
/** @param {string} md @param {{headingBase?:number}} [o] */
export function renderMarkdown(md,o={}){
 const base=o.headingBase??3;
 const src=esc(String(md??'').slice(0,MAX_MARKDOWN).replace(/\r\n?/g,'\n'));
 const lines=src.split('\n');/** @type {string[]} */const out=[];let i=0;
 while(i<lines.length){
  const line=lines[i];
  if(/^```/.test(line)){const buf=[];i++;while(i<lines.length&&!/^```/.test(lines[i]))buf.push(lines[i++]);i++;out.push(`<pre><code>${buf.join('\n')}</code></pre>`);continue;}
  const h=/^(#{1,3})\s+(.{1,200})$/.exec(line);
  if(h){const lv=Math.min(6,base+h[1].length-1);out.push(`<h${lv}>${inline(h[2])}</h${lv}>`);i++;continue;}
  if(/^&gt;\s?/.test(line)){const buf=[];while(i<lines.length&&/^&gt;\s?/.test(lines[i]))buf.push(lines[i++].replace(/^&gt;\s?/,''));out.push(`<blockquote>${inline(buf.join('<br>'))}</blockquote>`);continue;}
  if(/^\s*[-*]\s+/.test(line)){const buf=[];while(i<lines.length&&/^\s*[-*]\s+/.test(lines[i]))buf.push(`<li>${inline(lines[i++].replace(/^\s*[-*]\s+/,''))}</li>`);out.push(`<ul>${buf.join('')}</ul>`);continue;}
  if(/^\s*\d+[.)]\s+/.test(line)){const buf=[];while(i<lines.length&&/^\s*\d+[.)]\s+/.test(lines[i]))buf.push(`<li>${inline(lines[i++].replace(/^\s*\d+[.)]\s+/,''))}</li>`);out.push(`<ol>${buf.join('')}</ol>`);continue;}
  if(!line.trim()){i++;continue;}
  const buf=[];while(i<lines.length&&lines[i].trim()&&!/^(```|#{1,3}\s|&gt;|\s*[-*]\s+|\s*\d+[.)]\s+)/.test(lines[i]))buf.push(lines[i++]);
  out.push(`<p>${inline(buf.join('<br>'))}</p>`);
 }
 return out.join('');
}
/** Plain text excerpt for feeds/meta descriptions. @param {string} md @param {number} [n] */
export function plainExcerpt(md,n=160){
 const t=String(md??'').replace(/```[\s\S]*?```/g,' ').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/[#>*_`~-]+/g,' ').replace(/\s+/g,' ').trim();
 return t.length>n?t.slice(0,n-1).trimEnd()+'…':t;
}
