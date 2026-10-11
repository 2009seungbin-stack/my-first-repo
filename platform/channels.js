// @ts-check
/** The community's channels. A post lives in one channel, carries a 말머리 (flair) of that channel, and 0–3
 * entity tags that cross channels. migrations/0014_channels.sql and 0015_ai_community.sql hold the same ids;
 * the config here (names, flairs, order) is code.
 *
 * AI 창작 커뮤니티 (owner decision 2026-10-11, nerulio-handoff/AI-COMMUNITY-CONTRACT.md §2, docs/AI-COMMUNITY.md):
 * seven boards for what people make with AI and finish here. The 2026-09-29 channels (games sub hw ai studio)
 * are read-only archives, off the bar: their posts and URLs keep working, nobody writes new posts there
 * (staff may still post a 공지). */

/** @typedef {'pfp'|'sticker'|'pixel'|'wall'|'howto'|'free'|'notice'|'ai'|'games'|'hw'|'studio'|'sub'} ChannelId */
/** @typedef {{id:ChannelId,vertical:string|null,names:{ko:string,en:string},tile:{ko:string,en:string},desc:{ko:string,en:string},flairs:string[],inBar:boolean,readOnly?:boolean,labels?:Record<string,{ko:string,en:string}>,note?:{ko:string,en:string},presets?:string[]}} Channel */

/** Order = the channel bar and every channel list. `presets` = the 규격 row of a board (the workbench's preset
 * landings /{l}/make/<slug>/, platform/recipe.js PRESETS); `note` = a line the board shows above its posts. */
/** @type {readonly Channel[]} */
export const CHANNELS=Object.freeze(/** @type {Channel[]} */([
 {id:'pfp',vertical:null,names:{ko:'프사·프로필',en:'Profile pictures'},tile:{ko:'프',en:'P'},inBar:true,
  desc:{ko:'지브리풍·캐리커처·화보 프사를 원형·정사각으로 다듬기',en:'Ghibli-style, caricature and photo-shoot avatars, cropped round or square'},
  flairs:['share','tip','question','free'],presets:['round-pfp']},
 {id:'sticker',vertical:null,names:{ko:'이모티콘·스티커',en:'Emoji & stickers'},tile:{ko:'이',en:'S'},inBar:true,
  desc:{ko:'AI로 만든 캐릭터를 카톡·LINE·디스코드·텔레그램 규격으로',en:'AI characters sized for KakaoTalk, LINE, Discord and Telegram'},
  flairs:['kakao','line','discord','telegram','anim','question'],presets:['kakao-emoticon','line-sticker','discord-emoji','telegram-sticker'],
  note:{ko:'카카오 스토어는 AI 이모티콘을 받지 않아요 — 카톡 규격은 대화용',en:'The Kakao store does not accept AI emoticons — the KakaoTalk size is for chats'}},
 {id:'pixel',vertical:null,names:{ko:'도트',en:'Pixel art'},tile:{ko:'도',en:'PX'},inBar:true,
  desc:{ko:'AI 도트의 제각각 픽셀을 격자에 맞추고 팔레트 정리',en:'Snap uneven AI pixel art to a grid and tidy the palette'},
  flairs:['share','fix','tip','question'],presets:['ai-pixel-fix']},
 {id:'wall',vertical:null,names:{ko:'배경화면',en:'Wallpapers'},tile:{ko:'배',en:'W'},inBar:true,
  desc:{ko:'폰·PC 기종별 해상도로 키우고 맞추기',en:'Upscaled and cropped to your phone or PC screen'},
  flairs:['phone','pc','tip','question'],presets:['phone-wallpaper']},
 {id:'howto',vertical:null,names:{ko:'레시피 질문',en:'Recipe Q&A'},tile:{ko:'질',en:'Q'},inBar:true,
  desc:{ko:'이건 어떻게 만들었어요? · 만들어 주세요',en:'How was this made? · Requests'},
  flairs:['question','request','tip']},
 {id:'free',vertical:null,names:{ko:'자유',en:'Free talk'},tile:{ko:'자',en:'F'},inBar:true,
  desc:{ko:'주제 없는 잡담',en:'Anything goes'},
  flairs:['free','question','info']},
 {id:'notice',vertical:null,names:{ko:'공지',en:'Notices'},tile:{ko:'공',en:'N'},inBar:true,
  desc:{ko:'운영 공지 · 사이트·도구 건의',en:'Announcements and site feedback'},
  flairs:['notice','feedback']},
 // Archives since 2026-10-11: reachable and searchable, not in the bar, not writable.
 {id:'games',vertical:'games',names:{ko:'게임',en:'Games'},tile:{ko:'게',en:'G'},inBar:false,readOnly:true,
  desc:{ko:'게임 소식·공략·한글패치·작동 리포트 (보관된 채널)',en:'Game news, guides, Korean patches and reports (archived)'},
  flairs:['news','info','question','guide','patch','report','screenshot','free']},
 {id:'sub',vertical:'subculture',names:{ko:'애니·서브컬처',en:'Anime & subculture'},tile:{ko:'애',en:'A'},inBar:false,readOnly:true,
  desc:{ko:'애니·만화·캐릭터·성우·행사·굿즈 (보관된 채널)',en:'Anime, manga, characters, voice actors, events and goods (archived)'},
  flairs:['news','info','review','event','screenshot','question','free'],
  labels:{review:{ko:'감상',en:'Impressions'},screenshot:{ko:'팬아트',en:'Fan art'}}},
 {id:'hw',vertical:'hardware',names:{ko:'PC·하드웨어',en:'PC & hardware'},tile:{ko:'PC',en:'PC'},inBar:false,readOnly:true,
  desc:{ko:'그래픽카드·견적·드라이버·벤치 (보관된 채널)',en:'Graphics cards, builds, drivers and benchmarks (archived)'},
  flairs:['news','info','question','buy','benchmark','review','free']},
 {id:'ai',vertical:'ai',names:{ko:'AI',en:'AI'},tile:{ko:'AI',en:'AI'},inBar:false,readOnly:true,
  desc:{ko:'Claude·ChatGPT·제미나이부터 로컬 LLM까지 (보관된 채널)',en:'Claude, ChatGPT and Gemini to local LLMs (archived)'},
  flairs:['news','info','question','review','guide','benchmark','free'],
  labels:{guide:{ko:'팁',en:'Tips'}}},
 {id:'studio',vertical:'studio',names:{ko:'창작 도구',en:'Creative tools'},tile:{ko:'창',en:'C'},inBar:false,readOnly:true,
  desc:{ko:'DAW·플러그인·블렌더·고도·OBS (보관된 채널)',en:'DAWs, plugins, Blender, Godot and OBS (archived)'},
  flairs:['news','question','report','guide','screenshot','free'],
  labels:{report:{ko:'호환',en:'Compatibility'},guide:{ko:'팁',en:'Tips'},screenshot:{ko:'작업물',en:'Work'}}},
]));
export const CHANNEL_IDS=/** @type {readonly ChannelId[]} */(Object.freeze(CHANNELS.map(c=>c.id)));
/** The boards people write in (the bar), in order. */
export const OPEN_CHANNELS=Object.freeze(CHANNELS.filter(c=>!c.readOnly));
/** @param {string|null|undefined} id @returns {Channel|null} */
export const channelById=id=>CHANNELS.find(c=>c.id===id)||null;
/** A read-only (archived) channel. @param {string|null|undefined} id */
export const isReadOnly=id=>!!channelById(id)?.readOnly;
/** Entity vertical → its archived channel ('tools' and anything unknown → 자유). For reading (old URLs, tags);
 * a new post goes to writableChannel(). @param {string} vertical */
export function channelOfVertical(vertical){return CHANNELS.find(c=>c.vertical===vertical)?.id||'free';}
/**
 * The channel a tag's posts went to by default. A subculture work that is a game (블루 아카이브, 명일방주:
 * media_type "game") is 게임; GPUs are hardware.
 * @param {{vertical:string,type:string}} e @param {{property:string,value:unknown}[]} [facts]
 */
export function defaultChannelOf(e,facts=[]){
 if(e.type==='work'&&facts.some(f=>f.property==='media_type'&&f.value==='game'))return 'games';
 return channelOfVertical(e.vertical);
}
/** Where a new post goes when it starts from a channel that no longer takes posts (an entity page's write
 * button, the old entityId shape of the API): 자유. @param {string} ch */
export const writableChannel=ch=>channelById(ch)?.readOnly?'free':ch;
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
 // AI 창작 커뮤니티 (2026-10-11)
 share:{ko:'작품',en:'Work'},tip:{ko:'팁',en:'Tips'},kakao:{ko:'카톡 대화용',en:'KakaoTalk chat'},line:{ko:'LINE 판매',en:'LINE for sale'},
 discord:{ko:'디스코드',en:'Discord'},telegram:{ko:'텔레그램',en:'Telegram'},anim:{ko:'움짤',en:'Animated'},fix:{ko:'정리 전후',en:'Before & after'},
 phone:{ko:'폰',en:'Phone'},pc:{ko:'PC',en:'PC'},request:{ko:'만들어 주세요',en:'Requests'},
}));
/** @param {string|null|undefined} channel @param {string} flair @param {string} l */
export function flairLabel(channel,flair,l){
 const lang=l==='ko'?'ko':'en';
 return channelById(channel)?.labels?.[flair]?.[lang]||FLAIR_LABELS[flair]?.[lang]||flair;
}
/** 말머리 a writer may pick in a channel. Staff may also post a 공지 in any channel; an archived channel takes
 * nothing else. @param {string} channel @param {{staff?:boolean}} [o] */
export function writableFlairs(channel,o={}){
 const c=channelById(channel);if(!c)return [];
 const list=c.readOnly?[]:c.flairs.filter(f=>f!=='notice');
 return o.staff?['notice',...list]:list;
}
/** discussions.kind keeps a value its CHECK accepts (migrations/0004); the flair column holds the rest. */
const LEGACY_KIND=/** @type {Record<string,string>} */({info:'guide',review:'free',buy:'question',event:'news',feedback:'free',
 share:'screenshot',tip:'guide',kakao:'screenshot',line:'screenshot',discord:'screenshot',telegram:'screenshot',anim:'screenshot',
 fix:'screenshot',phone:'screenshot',pc:'screenshot',request:'question'});
/** @param {string} flair */
export const storedKind=flair=>LEGACY_KIND[flair]||flair;

/** Tag chips of a quiet channel (topped up by the channel's own most used tags once it has posts). The AI
 * 창작 boards start without featured tags (tags are optional there). */
export const FEATURED_TAGS=Object.freeze(/** @type {Record<string,string[]>} */({
 ai:['service:claude','service:chatgpt','service:gemini-app','service:claude-code','service:codex','runtime:ollama','runtime:llama-cpp','runtime:lm-studio','gpu:rtx-5070'],
 games:['game:steam-2379780','game:steam-1086940','game:steam-1285190','game:steam-377160','game:steam-1030300','work:blue-archive-game','event:g-star-2026'],
 hw:['gpu:rtx-5070','gpu:rtx-5090','gpu:rx-9070-xt','vendor:nvidia','vendor:amd','runtime:llama-cpp'],
 studio:['app:logic-pro','app:ableton-live','plugin:fabfilter-pro-q-4','app:blender','app:godot','app:obs-studio'],
 sub:['work:the-apothecary-diaries-tv-s3','work:jojos-bizarre-adventure-steel-ball-run','franchise:chiikawa','franchise:frieren','event:g-star-2026'],
 pfp:[],sticker:[],pixel:[],wall:[],howto:[],free:[],notice:[],
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
/** "한글패치 모음": the archived 게임 channel's 한글패치 말머리 (no longer in the menu; the URL keeps working). @param {string} l */
export const patchCollectionPath=l=>`${channelPath(l,'games')}?kind=patch`;
/** 레시피 모음 (every post with a recipe) and 이번 주 유행. @param {string} l */
export const recipesPath=l=>`/${l}/community/recipes/`;
/** @param {string} l */
export const trendsPath=l=>`/${l}/community/trends/`;
/** The workbench (MAKER, /{l}/make/): a preset landing, or remix mode for a post's recipe. @param {string} l @param {{slug?:string,recipe?:string}} [o] */
export const makePath=(l,o={})=>o.slug?`/${l}/make/${o.slug}/`:o.recipe?`/${l}/make/?recipe=${encodeURIComponent(o.recipe)}`:`/${l}/make/`;
/** The channel bar for everyone (an island reorders it by the reader's pins): the seven AI 창작 boards. @param {string} l */
export function channelBarLinks(l){
 const lang=l==='ko'?'ko':'en';
 return CHANNELS.filter(c=>c.inBar).map(c=>({id:c.id,name:c.names[lang],href:channelPath(l,c.id)}));
}
