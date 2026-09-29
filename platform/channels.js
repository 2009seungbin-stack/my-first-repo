// @ts-check
/** The community's channels (owner decision 2026-09-29, docs/n2/CHANNELS.md): 7 big boards instead of one
 * per entity. A post lives in one channel, carries a 말머리 (flair) of that channel, and 0–3 entity tags
 * that cross channels (an AI post tagged RTX 5070 also shows on the RTX 5070 page).
 * migrations/0014_channels.sql holds the same ids; the config here (names, flairs, order) is code. */

/** @typedef {'ai'|'games'|'hw'|'studio'|'sub'|'free'|'notice'} ChannelId */
/** @typedef {{id:ChannelId,vertical:string|null,names:{ko:string,en:string},tile:{ko:string,en:string},desc:{ko:string,en:string},flairs:string[],inBar:boolean,labels?:Record<string,{ko:string,en:string}>}} Channel */

/** @type {readonly Channel[]} */
export const CHANNELS=Object.freeze(/** @type {Channel[]} */([
 {id:'ai',vertical:'ai',names:{ko:'AI',en:'AI'},tile:{ko:'AI',en:'AI'},inBar:true,
  desc:{ko:'Claude·ChatGPT·제미나이부터 로컬 LLM까지',en:'Claude, ChatGPT and Gemini to local LLMs'},
  flairs:['news','info','question','review','guide','benchmark','free'],
  labels:{guide:{ko:'팁',en:'Tips'}}},
 {id:'games',vertical:'games',names:{ko:'게임',en:'Games'},tile:{ko:'게',en:'G'},inBar:true,
  desc:{ko:'게임 소식·공략·한글패치·작동 리포트',en:'Game news, guides, Korean patches and compatibility reports'},
  flairs:['news','info','question','guide','patch','report','screenshot','free']},
 {id:'hw',vertical:'hardware',names:{ko:'PC·하드웨어',en:'PC & hardware'},tile:{ko:'PC',en:'PC'},inBar:true,
  desc:{ko:'그래픽카드·견적·드라이버·벤치',en:'Graphics cards, builds, drivers and benchmarks'},
  flairs:['news','info','question','buy','benchmark','review','free']},
 {id:'studio',vertical:'studio',names:{ko:'창작 도구',en:'Creative tools'},tile:{ko:'창',en:'C'},inBar:true,
  desc:{ko:'DAW·플러그인·블렌더·고도·OBS',en:'DAWs, plugins, Blender, Godot and OBS'},
  flairs:['news','question','report','guide','screenshot','free'],
  labels:{report:{ko:'호환',en:'Compatibility'},guide:{ko:'팁',en:'Tips'},screenshot:{ko:'작업물',en:'Work'}}},
 {id:'sub',vertical:'subculture',names:{ko:'애니·서브컬처',en:'Anime & subculture'},tile:{ko:'애',en:'A'},inBar:true,
  desc:{ko:'애니·만화·캐릭터·성우·행사·굿즈',en:'Anime, manga, characters, voice actors, events and goods'},
  flairs:['news','info','review','event','screenshot','question','free'],
  labels:{review:{ko:'감상',en:'Impressions'},screenshot:{ko:'팬아트',en:'Fan art'}}},
 {id:'free',vertical:null,names:{ko:'자유',en:'Free talk'},tile:{ko:'자',en:'F'},inBar:true,
  desc:{ko:'주제 없는 잡담 · 태그는 선택',en:'Anything goes · tags optional'},
  flairs:['free','question','info']},
 {id:'notice',vertical:null,names:{ko:'공지·건의',en:'Notices & feedback'},tile:{ko:'공',en:'N'},inBar:false,
  desc:{ko:'운영 공지 · 사이트·도구 건의',en:'Announcements and site feedback'},
  flairs:['notice','feedback']},
]));
export const CHANNEL_IDS=/** @type {readonly ChannelId[]} */(Object.freeze(CHANNELS.map(c=>c.id)));
/** @param {string|null|undefined} id @returns {Channel|null} */
export const channelById=id=>CHANNELS.find(c=>c.id===id)||null;
/** Entity vertical → its default channel ('tools' and anything unknown → 자유). @param {string} vertical */
export function channelOfVertical(vertical){return CHANNELS.find(c=>c.vertical===vertical)?.id||'free';}
/**
 * The channel a tag's posts go to by default (the write button on an entity page). A subculture work that
 * is a game (블루 아카이브, 명일방주: media_type "game") defaults to 게임; its tag still shows it on the
 * anime side. Local LLM runtimes and models are AI entities already; GPUs are hardware.
 * @param {{vertical:string,type:string}} e @param {{property:string,value:unknown}[]} [facts]
 */
export function defaultChannelOf(e,facts=[]){
 if(e.type==='work'&&facts.some(f=>f.property==='media_type'&&f.value==='game'))return 'games';
 return channelOfVertical(e.vertical);
}
/** The placeholder entity of a post without tags (migrations/0014: hidden, never shown). @param {string} ch */
export const placeholderEntity=ch=>`channel:${ch}`;
export const isPlaceholder=(/** @type {string} */ id)=>id.startsWith('channel:');

/** 말머리 names, the same in every channel unless the channel renames one (팁 for guide in AI, 호환 for
 * reports in 창작 도구). Stored values (discussions.flair) are these keys. */
export const FLAIR_LABELS=Object.freeze(/** @type {Record<string,{ko:string,en:string}>} */({
 notice:{ko:'공지',en:'Notice'},news:{ko:'소식',en:'News'},info:{ko:'정보',en:'Info'},question:{ko:'질문',en:'Question'},
 review:{ko:'사용기',en:'Review'},guide:{ko:'공략',en:'Guide'},benchmark:{ko:'벤치',en:'Benchmark'},buy:{ko:'견적',en:'Buying advice'},
 patch:{ko:'한글패치',en:'Korean patch'},report:{ko:'리포트',en:'Report'},screenshot:{ko:'스샷',en:'Screenshot'},
 event:{ko:'행사·굿즈',en:'Events & goods'},feedback:{ko:'건의',en:'Feedback'},free:{ko:'잡담',en:'Talk'},
}));
/** @param {string|null|undefined} channel @param {string} flair @param {string} l */
export function flairLabel(channel,flair,l){
 const lang=l==='ko'?'ko':'en';
 return channelById(channel)?.labels?.[flair]?.[lang]||FLAIR_LABELS[flair]?.[lang]||flair;
}
/** 말머리 a writer may pick in a channel. Staff may also post a 공지 in any channel. @param {string} channel @param {{staff?:boolean}} [o] */
export function writableFlairs(channel,o={}){
 const c=channelById(channel);if(!c)return [];
 const list=c.flairs.filter(f=>f!=='notice');
 return o.staff?['notice',...list]:list;
}
/** discussions.kind keeps a value its CHECK accepts (migrations/0004); the flair column holds the rest. */
const LEGACY_KIND=/** @type {Record<string,string>} */({info:'guide',review:'free',buy:'question',event:'news',feedback:'free'});
/** @param {string} flair */
export const storedKind=flair=>LEGACY_KIND[flair]||flair;

/** Tag chips of a quiet channel (topped up by the channel's own most used tags once it has posts). */
export const FEATURED_TAGS=Object.freeze(/** @type {Record<string,string[]>} */({
 ai:['service:claude','service:chatgpt','service:gemini-app','service:claude-code','service:codex','runtime:ollama','runtime:llama-cpp','runtime:lm-studio','gpu:rtx-5070'],
 games:['game:steam-2379780','game:steam-1086940','game:steam-1285190','game:steam-377160','game:steam-1030300','work:blue-archive-game','event:g-star-2026'],
 hw:['gpu:rtx-5070','gpu:rtx-5090','gpu:rx-9070-xt','vendor:nvidia','vendor:amd','runtime:llama-cpp'],
 studio:['app:logic-pro','app:ableton-live','plugin:fabfilter-pro-q-4','app:blender','app:godot','app:obs-studio'],
 sub:['work:the-apothecary-diaries-tv-s3','work:jojos-bizarre-adventure-steel-ball-run','franchise:chiikawa','franchise:frieren','event:g-star-2026'],
 free:['service:claude','game:steam-2379780','gpu:rtx-5070'],
 notice:[],
}));
/** Tag rules. */
export const TAG_LIMIT=3;

/* ---------- URLs ---------- */
/** @param {string} l @param {string} ch */
export const channelPath=(l,ch)=>`/${l}/community/${ch}/`;
/** @param {string} l @param {string} ch @param {number} no */
export const postPath=(l,ch,no)=>`/${l}/community/${ch}/${no}`;
/** The write page, with the channel's tag and 말머리 picked. @param {string} l @param {string} ch @param {{tag?:string|null,kind?:string|null}} [o] */
export function writePath(l,ch,o={}){
 const q=new URLSearchParams();if(o.tag)q.set('tag',o.tag);if(o.kind)q.set('kind',o.kind);
 const s=q.toString().replace(/%3A/gi,':');return `/${l}/community/${ch}/write${s?`?${s}`:''}`;
}
/** "한글패치 모음": the 게임 channel's 한글패치 말머리, pinned in the channel bar. @param {string} l */
export const patchCollectionPath=l=>`${channelPath(l,'games')}?kind=patch`;
/** The channel bar for everyone (an island reorders it by the reader's pins). @param {string} l */
export function channelBarLinks(l){
 const lang=l==='ko'?'ko':'en';
 return CHANNELS.filter(c=>c.inBar).map(c=>({id:c.id,name:c.names[lang],href:channelPath(l,c.id)}));
}
