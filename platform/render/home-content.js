// @ts-check
/** Public starting points use existing tools and examples, without activity or performance claims. */
import {html} from './html.js';
import {discoveryTopics} from '../discovery.js';
import {FILE_TOOLS,GAME_TOOLS,toolHref,toolsHome} from '../tools-nav.js';

/** @param {string} l @param {{hasCommentary?:boolean}} [options] */
export function renderHomeContent(l,{hasCommentary=true}={}){
 const ko=l==='ko',lang=ko?'ko':'en',base=`/${lang}/`;
 const workflows=ko?[
  {path:'sprite-slicer/',title:'스프라이트 시트를 애니메이션으로',body:'시트를 열고 프레임 크기와 범위를 지정하세요. 애니메이션을 재생해 잘린 부분을 확인하고 엔진용으로 내보냅니다.',result:'결과: 나눈 프레임과 애니메이션',guide:'자르기·미리보기·내보내기 안내'},
  {path:'image/compress/',title:'이미지 용량 줄이기',body:'PNG·JPG·WebP를 열고 압축 단계를 고르세요. 결과의 용량과 화질을 비교한 뒤 저장합니다.',result:'결과: 압축한 이미지',guide:'지원 형식·실측 예제·문제 해결 보기'},
  {path:'preflight/',title:'작업 전에 환경 점검하기',body:'OBS·Blender·Godot 작업을 골라 환경 정보를 확인하세요. 점검 결과의 근거와 적용 범위를 읽고 보고서를 저장합니다.',result:'결과: 환경 점검 보고서',guide:'작업별 점검 도구 열기'}
 ]:[
  {path:'sprite-slicer/',title:'Turn a sprite sheet into animation',body:'Open a sheet and set the frame size and range. Play the animation to check the cuts, then export for your engine.',result:'Output: split frames and animation',guide:'Slicing, preview and export guide'},
  {path:'image/compress/',title:'Reduce an image’s file size',body:'Open a PNG, JPG or WebP and choose a compression level. Compare the output size and image quality before saving.',result:'Output: a compressed image',guide:'Formats, measured examples and troubleshooting'},
  {path:'preflight/',title:'Check your setup before a project',body:'Choose an OBS, Blender or Godot workflow and review your environment. Read the evidence and scope of each finding, then save the report.',result:'Output: an environment check report',guide:'Open the workflow checks'}
 ];
 return html`<section class="box home-start" aria-labelledby="home-title" data-home-start>
<div class="home-intro"><p class="home-kicker">${ko?(hasCommentary?'게임 에셋 도구 · 파일 도구 · 크리에이터를 위한 AI 해설':'게임 에셋 도구 · 파일 도구 · 출처 기반 뉴스'):(hasCommentary?'Game asset tools · file tools · AI commentary for creators':'Game asset tools · file tools · source-based news')}</p><h1 id="home-title">${ko?'게임 에셋과 파일을 브라우저에서 바로 다듬으세요.':'Make game assets and prepare files right in your browser.'}</h1><p>${ko?'Nerulio는 스프라이트·픽셀·타일셋 같은 게임 에셋 도구와 이미지·PDF·영상 파일 도구를 브라우저에서 제공합니다. 파일은 기기 안에서 처리됩니다.':'Nerulio offers game asset tools such as sprites, pixel art and tilesets, plus image, PDF and video file tools, in your browser. Files are processed on your device.'}</p><div class="home-actions"><a class="btn p" href="${base}game/">${ko?'게임 에셋 도구 보기':'Browse game asset tools'} ›</a><a class="btn" href="${base}tools/">${ko?'파일 도구 보기':'Browse file tools'}</a></div></div>
<div class="bh"><h2>${ko?'게임 에셋 도구':'Game asset tools'}</h2></div><ul class="home-workflows home-toolgrid" data-home-game-tools>${GAME_TOOLS.map(x=>html`<li><h3><a href="${toolHref(lang,x)}">${x[lang]} ›</a></h3></li>`)}</ul>
<div class="bh"><h2>${ko?'파일 도구':'File tools'}</h2></div><ul class="home-workflows home-toolgrid" data-home-file-tools>${FILE_TOOLS.map(x=>html`<li><h3><a href="${toolHref(lang,x)}">${x[lang]} ›</a></h3></li>`)}<li><h3><a href="${toolsHome(lang)}">${ko?'도구 전체 보기':'All tools'} ›</a></h3></li></ul>
<div class="bh"><h2>${ko?'어떤 작업을 하시나요?':'What would you like to do?'}</h2></div><ul class="home-workflows">${workflows.map(x=>html`<li><h3><a href="${base}${x.path}">${x.title} ›</a></h3><p>${x.body}</p><span class="fine">${x.result}</span><a class="home-guide" href="${base}${x.path}">${x.guide} ›</a></li>`)}</ul></section>
<section class="box home-example" aria-labelledby="home-example-title" data-home-example><div class="bh"><h2 id="home-example-title">${ko?'스튜디오로 만든 작업 예제':'An example from the studio'}</h2></div><figure><a href="${base}tools/#workflow"><img src="/assets/home/shot-hero-${lang}-1280.webp" width="1280" height="760" loading="lazy" decoding="async" alt="${ko?'스프라이트 시트와 애니메이션 타임라인을 연 Nerulio 스튜디오':'Nerulio studio with a sprite sheet and animation timeline'}"></a><figcaption>${ko?'GrafxKid의 Classic Hero(CC0)를 애니메이션 5개로 나누고 피벗·허트박스·히트박스를 지정한 기존 작업 예제입니다.':'An existing example using GrafxKid’s Classic Hero (CC0), split into five animations with pivots, hurtboxes and hitboxes.'} <a href="${base}tools/#workflow">${ko?'작업 흐름과 내보내기 안내':'See the workflow and export guide'} ›</a></figcaption></figure></section>`;
}

/** An empty board still leads to useful material; it never invents posts or user activity.
 * @param {string} l @param {string|null} vertical */
export function renderBoardResources(l,vertical){
 const ko=l==='ko',lang=ko?'ko':'en',topic=discoveryTopics(l).find(x=>x.id===vertical);
 return html`<section class="box" data-board-resources><div class="bh"><h2>${ko?'먼저 살펴볼 정보와 도구':'Useful starting points'}</h2></div><div class="pad"><p>${ko?'아직 게시글이 없습니다. 그동안 아래 자료와 도구를 이용하거나, 직접 확인한 경험과 질문을 남겨 주세요.':'There are no posts yet. Explore these resources and tools, or share a question or something you have tried.'}</p>${topic?html`<p><a href="${topic.href}"><b>${topic.name} ›</b></a></p><p class="fine">${topic.description}</p>`:''}<p><a href="/${lang}/tools/">${ko?'이미지·PDF·게임 도구':'Image, PDF and game tools'} ›</a> · <a href="/${lang}/preflight/">${ko?'작업 환경 점검':'Environment checks'} ›</a></p></div></section>`;
}

/** The AI entry of the home page: it points where the AI section lives today (kept out of renderHomeContent,
 * whose links are all static-site routes). @param {string} l */
export function renderHomeAi(l){
 const ko=l==='ko',lang=ko?'ko':'en';
 return html`<section class="box" aria-labelledby="home-ai" data-home-ai><div class="bh"><h2 id="home-ai">AI</h2></div><div class="pad"><p>${ko?'AI 서비스·모델 정보와 요금 비교, 서비스 상태를 출처와 함께 확인하세요.':'Check AI service and model information, plan and API price comparisons, and service status, with their sources.'}</p><p><a class="btn" href="/${lang}/ai/">${ko?'AI 보기':'Explore AI'} ›</a></p></div></section>`;
}
