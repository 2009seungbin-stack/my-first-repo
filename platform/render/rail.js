// @ts-check
/** The right column of the portal pages (home feed, posts, recipe lists) since the AI 창작 pivot (2026-10-11,
 * mockup 1): 이번 주 유행 (the trends picked by hand here + the recipes tried most in the last 7 days),
 * 규격 바로 맞추기 (the workbench presets) and 지켜 주세요 (the three rules), then the footer links.
 * The AI service status helpers stay here: the status pages, the status card and the outage watcher use them. */
import {html} from './html.js';
import {postHref} from './ui.js';
import {trendingRecipes} from '../db/channel.js';
import {trendsPath,makePath} from '../channels.js';
import {MAKE_TOOLS,makeHref} from '../tools-nav.js';
import * as RECIPE from '../recipe.js';
import {icon} from './icons.js';

const DAY=864e5;

/* ---------- AI 창작 rail ---------- */

/** @typedef {{id:string,ko:string,en:string,where:{ko:string,en:string},preset:string,desc:{ko:string,en:string},channel:string}} Trend */
/** 이번 주 유행, picked by hand (owner/editor; update this list as trends move — research/AI-COMMUNITY-LANDSCAPE.md):
 * what people are making with which service, and the workbench preset that finishes it. */
export const TRENDS=Object.freeze(/** @type {Trend[]} */([
 {id:'figure-sticker',ko:'피규어 사진 → 스티커',en:'Figure photo → stickers',where:{ko:'제미나이',en:'Gemini'},preset:'line-sticker',channel:'sticker',
  desc:{ko:'제미나이(나노바나나)로 내 사진을 피규어 느낌 캐릭터로 바꾸고, 시트를 나눠 LINE·카톡 규격 스티커로 다듬어요.',en:'Turn a photo into a figure-style character with Gemini (Nano Banana), split the sheet and size the stickers for LINE or KakaoTalk.'}},
 {id:'ghibli-pfp',ko:'지브리풍 프사',en:'Ghibli-style avatar',where:{ko:'ChatGPT',en:'ChatGPT'},preset:'round-pfp',channel:'pfp',
  desc:{ko:'ChatGPT로 그린 지브리풍 그림을 원형 프사로 자르고, 하얗게 뜨는 테두리를 정리해요.',en:'Crop a Ghibli-style ChatGPT drawing into a round avatar and clean the white fringe.'}},
 {id:'photoshoot',ko:'화보 촬영 컷',en:'Photo-shoot cuts',where:{ko:'ChatGPT',en:'ChatGPT'},preset:'phone-wallpaper',channel:'wall',
  desc:{ko:'본인 사진으로 만든 화보 컷을 고화질로 키워 폰 배경화면 해상도에 맞춰요. 다른 사람 사진은 쓰지 마세요.',en:'Upscale photo-shoot cuts made from your own photo to your phone’s wallpaper size. Never use other people’s photos.'}},
 {id:'pixel-character',ko:'AI 도트 캐릭터',en:'AI pixel characters',where:{ko:'ChatGPT',en:'ChatGPT'},preset:'ai-pixel-fix',channel:'pixel',
  desc:{ko:'AI가 그린 도트는 픽셀 크기가 제각각이에요. 격자에 맞추고 팔레트를 줄여 진짜 도트로 정리해요.',en:'AI pixel art has uneven pixels: snap it to a grid and reduce the palette.'}},
]));
/** Korean day (YYYY-MM-DD) of a time: recipe_try_days rows are per KST day. @param {number} t */
export const kstDate=t=>new Date(t+9*3600e3).toISOString().slice(0,10);
/** A preset's short name and size for the rail and the boards: the menu's name (tools-nav.js) and the size of
 * the preset's fit spec in platform/recipe.js (FIT_SPECS), else the preset's own spec line.
 * @param {string} slug @param {string} l */
export function presetLabel(slug,l){
 const lang=l==='ko'?'ko':'en',p=/** @type {any} */(RECIPE).PRESETS?.find((/** @type {any} */ x)=>x.slug===slug),t=MAKE_TOOLS.find(x=>x.slug===slug);
 const fit=p?.fit?/** @type {any} */(RECIPE).FIT_SPECS?.[p.fit]:null;
 return {slug,name:t?.[lang]||p?.names?.[lang]||slug,spec:fit?`${fit.w}×${fit.h}`:t?.spec||p?.spec||''};
}

/** @param {any} db @param {{now:number}} o */
export async function loadRail(db,o){
 const tried=await trendingRecipes(db,{since:kstDate(o.now-6*DAY),limit:3});
 return {now:o.now,tried};
}

/** The three rules of the community (the policy page has the full text). @param {string} l */
export function rulesBox(l){
 const ko=l==='ko';
 return html`<section class="rbox rules3" aria-labelledby="rail-rules"><div class="rbh"><h2 id="rail-rules">${ko?'지켜 주세요':'House rules'}</h2><a href="/${l}/community/policy#ai">${ko?'운영정책':'Rules'} ›</a></div>
<ul class="rrules"><li>${ko?'전연령만 — 성인물은 바로 지워져요':'All ages only — adult content is removed at once'}</li><li>${ko?'실제 사람 사진은 본인 것만 (또는 허락받은 성인)':'Real people: only your own photo (or adults who agreed)'}</li><li>${ko?'신고가 들어오면 먼저 숨기고 확인해요':'Reported posts are hidden first, then checked'}</li></ul></section>`;
}
/** 규격 바로 맞추기: the workbench presets with their sizes. @param {string} l */
export function presetsBox(l){
 const ko=l==='ko';
 return html`<section class="rbox" aria-labelledby="rail-spec"><div class="rbh"><h2 id="rail-spec">${ko?'규격 바로 맞추기':'Fit to a size'}</h2><a href="${makePath(l)}">${ko?'작업대':'Workbench'} ›</a></div>
<ul class="rspec">${MAKE_TOOLS.map(x=>{const p=presetLabel(x.slug,l);return html`<li><a href="${makeHref(l,x)}"><span>${p.name}</span><span class="mono">${p.spec}</span></a></li>`;})}</ul></section>`;
}
/** 이번 주 유행: the hand-picked trends, then the recipes tried most this week. @param {Awaited<ReturnType<typeof loadRail>>} r @param {string} l */
export function trendsBox(r,l){
 const ko=l==='ko',lang=ko?'ko':'en';
 const rows=[...TRENDS.slice(0,3).map(x=>({href:`${trendsPath(l)}#${x.id}`,name:x[lang],where:x.where[lang]})),
  ...(r.tried||[]).map(p=>({href:postHref(l,p),name:p.title,where:ko?`해보기 ${p.week}`:`${p.week} tries`}))];
 return html`<section class="rbox" aria-labelledby="rail-trends"><div class="rbh"><h2 id="rail-trends"><span class="hot">${icon('trend',16)}</span>${ko?'이번 주 유행':'Trending this week'}</h2><a href="${trendsPath(l)}">${ko?'유행 모음':'All trends'} ›</a></div>
<ol class="rtrend">${rows.map((x,i)=>html`<li><a href="${x.href}"><span class="rk mono">${i+1}</span><span class="rn">${x.name}</span><span class="rw">${x.where}</span></a></li>`)}</ol></section>`;
}
const footer=(/** @type {string} */ l)=>{const ko=l==='ko';return html`<p class="rfoot"><a href="/${l}/about/">Nerulio</a> · <a href="/${l}/terms/">${ko?'이용약관':'Terms'}</a> · <a href="/${l}/privacy/">${ko?'개인정보 처리방침':'Privacy'}</a> · <a href="/${l}/community/policy">${ko?'운영정책':'Rules'}</a> · <a href="/${l}/community/transparency">${ko?'투명성':'Transparency'}</a></p>`;};
/** @param {Awaited<ReturnType<typeof loadRail>>} r @param {string} l @param {unknown} [lead] sections that go first (a post's recipe tools) */
export function renderRail(r,l,lead=''){
 const ko=l==='ko';
 return html`<aside class="rrail" aria-label="${ko?'유행과 규격':'Trends and sizes'}">${lead}${trendsBox(r,l)}${presetsBox(l)}${rulesBox(l)}${footer(l)}</aside>`;
}

/* ---------- AI service status (status pages, status card, outage watcher) ---------- */

/** The services with a status page, with their provider (whose incidents count too), a short name and the
 * Korean name people type when it breaks ("클로드 안 됨", "챗GPT 먹통", "제미나이 오류"). */
export const RAIL_SERVICES=Object.freeze([
 {id:'service:claude',provider:'provider:anthropic',short:'Claude',ko:'클로드'},
 {id:'service:chatgpt',provider:'provider:openai',short:'ChatGPT',ko:'챗GPT'},
 {id:'service:gemini-app',provider:'provider:google',short:'Gemini',ko:'제미나이'},
]);
/** An official incident: an event from a status page (status.claude.com, status.openai.com …). @param {{url:string|null}} x */
export const isStatusIncident=x=>!!x.url&&/status\./.test(x.url);

/** @typedef {'bad'|'warn'|'ok'|'unk'} StatusState */
/** Status of one service: an open official incident, a spike of user reports, a checked "no incident",
 * or (no status collector) the user-report count only.
 * @param {{open:boolean,spike:boolean,checked:boolean,total24:number}} x @returns {StatusState} */
export const statusState=x=>x.open?'bad':x.spike?'warn':x.checked?'ok':'unk';
/** @param {StatusState} state @param {number} total24 @param {string} l */
export function statusText(state,total24,l){
 const ko=l==='ko';
 if(state==='bad')return ko?'공식 장애':'Incident';
 if(state==='warn')return ko?'리포트 급증':'Reports spiking';
 if(state==='ok')return ko?'정상':'Operational';
 return total24?(ko?`리포트 ${total24}건`:`${total24} reports`):(ko?'리포트 없음':'No reports');
}
