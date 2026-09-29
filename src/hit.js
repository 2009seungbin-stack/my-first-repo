/* Nerulio visit counter (PLATFORM builds). One sendBeacon per pageview to /api/v2/hit, sent only
 * after the page has been visible for about a second or on the first interaction, so prerendered,
 * background and bounced-in-a-blink loads are not counted. It sends the path (no query except
 * board filters), a coarse traffic source, a device class and the browser language — no cookie,
 * no identifier; a per-tab sessionStorage flag (nerulio.hit) marks the first page of a visit.
 * Automation (navigator.webdriver) is reported as such and counted as a bot, not a person.
 * server/traffic.js validates and counts it; docs/CLOUDFLARE.md describes the data. */
(()=>{
 try{
  const n=navigator,d=document,w=window;
  if(typeof n.sendBeacon!=='function'||/^\/admin(\/|$)/.test(location.pathname))return;
  const same=h=>h.replace(/^www\./,'');
  const AI=/(^|\.)(chatgpt\.com|chat\.openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|bard\.google\.com|copilot\.microsoft\.com|you\.com|phind\.com|poe\.com|chat\.deepseek\.com|grok\.com|chat\.mistral\.ai|meta\.ai|wrtn\.ai)$/;
  const SOCIAL=/(^|\.)(facebook\.com|fb\.com|instagram\.com|t\.co|twitter\.com|x\.com|reddit\.com|youtube\.com|youtu\.be|tiktok\.com|linkedin\.com|lnkd\.in|pinterest\.[a-z.]+|discord\.com|discordapp\.com|t\.me|telegram\.org|threads\.net|bsky\.app|kakao\.com|band\.us|blog\.naver\.com|cafe\.naver\.com|dcinside\.com|fmkorea\.com|clien\.net|ruliweb\.com|arca\.live|theqoo\.net|inven\.co\.kr|quasarzone\.com|ppomppu\.co\.kr|namu\.wiki|github\.com)$/;
  const SEARCH=/(^|\.)(google\.[a-z.]+|bing\.com|naver\.com|daum\.net|yahoo\.[a-z.]+|duckduckgo\.com|yandex\.[a-z.]+|baidu\.com|ecosia\.org|search\.brave\.com|startpage\.com|qwant\.com|seznam\.cz|sogou\.com|zum\.com|kagi\.com)$/;
  let seen=false;try{seen=sessionStorage.getItem('nerulio.hit')==='1';}catch{}
  let r='direct';
  if(d.referrer){
   try{const h=same(new URL(d.referrer).hostname);r=h===same(location.hostname)?'internal':AI.test(h)?'ai':SOCIAL.test(h)?'social':SEARCH.test(h)?'search':'other';}catch{r='other';}
  }else if(seen)r='internal';// the site sends no referrer between its own pages (Referrer-Policy: no-referrer)
  const q=new URLSearchParams(location.search),keep=['kind','sort'].filter(k=>q.has(k)).map(k=>k+'='+encodeURIComponent(q.get(k).slice(0,24)));
  const coarse=w.matchMedia&&w.matchMedia('(pointer:coarse)').matches,short=Math.min(screen.width||0,screen.height||0);
  const body={p:location.pathname+(keep.length?'?'+keep.join('&'):''),r,d:!coarse?'desktop':short&&short<600?'mobile':'tablet',l:String(n.language||'').slice(0,2).toLowerCase(),e:seen?0:1,w:n.webdriver?1:0};
  let sent=false,timer=0;
  const send=()=>{if(sent)return;sent=true;clearTimeout(timer);try{n.sendBeacon('/api/v2/hit',JSON.stringify(body));sessionStorage.setItem('nerulio.hit','1');}catch{}};
  const arm=()=>{if(!sent&&!timer&&d.visibilityState==='visible')timer=setTimeout(send,1000);};
  d.addEventListener('visibilitychange',()=>{if(d.visibilityState==='visible')arm();else{clearTimeout(timer);timer=0;}});
  for(const e of ['pointerdown','keydown','scroll'])w.addEventListener(e,()=>{if(d.visibilityState==='visible')send();},{once:true,passive:true,capture:true});
  if(d.prerendering)d.addEventListener('prerenderingchange',arm,{once:true});else arm();
 }catch{}
})();
