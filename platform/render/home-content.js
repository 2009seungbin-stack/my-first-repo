// @ts-check
/** Public starting points use existing tools and examples, without activity or performance claims. */
import {html} from './html.js';
import {discoveryTopics} from '../discovery.js';

/** @param {string} l */
export function renderHomeContent(l){
 const ko=l==='ko',lang=ko?'ko':'en',base=`/${lang}/`;
 const workflows=ko?[
  {path:'image/compress/',title:'이미지 용량 줄이기',body:'PNG·JPG·WebP를 열고 압축 단계를 고르세요. 결과의 용량과 화질을 비교한 뒤 저장합니다.',result:'결과: 압축한 이미지',guide:'지원 형식·실측 예제·문제 해결 보기'},
  {path:'sprite-slicer/',title:'스프라이트 시트를 애니메이션으로',body:'시트를 열고 프레임 크기와 범위를 지정하세요. 애니메이션을 재생해 잘린 부분을 확인하고 엔진용으로 내보냅니다.',result:'결과: 나눈 프레임과 애니메이션',guide:'자르기·미리보기·내보내기 안내'},
  {path:'preflight/',title:'작업 전에 환경 점검하기',body:'OBS·Blender·Godot 작업을 골라 환경 정보를 확인하세요. 점검 결과의 근거와 적용 범위를 읽고 보고서를 저장합니다.',result:'결과: 환경 점검 보고서',guide:'작업별 점검 도구 열기'}
 ]:[
  {path:'image/compress/',title:'Reduce an image’s file size',body:'Open a PNG, JPG or WebP and choose a compression level. Compare the output size and image quality before saving.',result:'Output: a compressed image',guide:'Formats, measured examples and troubleshooting'},
  {path:'sprite-slicer/',title:'Turn a sprite sheet into animation',body:'Open a sheet and set the frame size and range. Play the animation to check the cuts, then export for your engine.',result:'Output: split frames and animation',guide:'Slicing, preview and export guide'},
  {path:'preflight/',title:'Check your setup before a project',body:'Choose an OBS, Blender or Godot workflow and review your environment. Read the evidence and scope of each finding, then save the report.',result:'Output: an environment check report',guide:'Open the workflow checks'}
 ];
 return html`<section class="box home-start" aria-labelledby="home-title" data-home-start>
<div class="home-intro"><p class="home-kicker">${ko?'브라우저 도구 · 정보와 비교 · 커뮤니티':'Browser tools · reference pages · community'}</p><h1 id="home-title">${ko?'파일을 다듬고, 게임 에셋을 만들고, 작업 환경을 점검하세요.':'Prepare files, build game assets and check your setup.'}</h1><p>${ko?'Nerulio는 이미지·PDF·미디어 도구와 2D 게임 에셋 스튜디오를 제공합니다. AI·게임·PC 정보에서는 출처와 확인 기록을 보고, 커뮤니티에서 질문과 사용 경험을 나눌 수 있습니다.':'Nerulio brings together image, PDF and media tools with a 2D game asset studio. Explore sources and check histories for AI, games and PC hardware, or share questions and experience in the community.'}</p><div class="home-actions"><a class="btn p" href="${base}tools/">${ko?'도구 전체 보기':'Browse all tools'} ›</a><a class="btn" href="${base}about/">${ko?'Nerulio 소개':'About Nerulio'}</a></div></div>
<div class="bh"><h2>${ko?'어떤 작업을 하시나요?':'What would you like to do?'}</h2></div><ul class="home-workflows">${workflows.map(x=>html`<li><h3><a href="${base}${x.path}">${x.title} ›</a></h3><p>${x.body}</p><span class="fine">${x.result}</span><a class="home-guide" href="${base}${x.path}">${x.guide} ›</a></li>`)}</ul></section>
<section class="box home-example" aria-labelledby="home-example-title" data-home-example><div class="bh"><h2 id="home-example-title">${ko?'스튜디오로 만든 작업 예제':'An example from the studio'}</h2></div><figure><a href="${base}tools/#workflow"><img src="/assets/home/shot-hero-${lang}-1280.webp" width="1280" height="760" loading="lazy" decoding="async" alt="${ko?'스프라이트 시트와 애니메이션 타임라인을 연 Nerulio 스튜디오':'Nerulio studio with a sprite sheet and animation timeline'}"></a><figcaption>${ko?'GrafxKid의 Classic Hero(CC0)를 애니메이션 5개로 나누고 피벗·허트박스·히트박스를 지정한 기존 작업 예제입니다.':'An existing example using GrafxKid’s Classic Hero (CC0), split into five animations with pivots, hurtboxes and hitboxes.'} <a href="${base}tools/#workflow">${ko?'작업 흐름과 내보내기 안내':'See the workflow and export guide'} ›</a></figcaption></figure></section>`;
}

/** An empty board still leads to useful material; it never invents posts or user activity.
 * @param {string} l @param {string|null} vertical */
export function renderBoardResources(l,vertical){
 const ko=l==='ko',lang=ko?'ko':'en',topic=discoveryTopics(l).find(x=>x.id===vertical);
 return html`<section class="box" data-board-resources><div class="bh"><h2>${ko?'먼저 살펴볼 정보와 도구':'Useful starting points'}</h2></div><div class="pad"><p>${ko?'아직 게시글이 없습니다. 그동안 아래 자료와 도구를 이용하거나, 직접 확인한 경험과 질문을 남겨 주세요.':'There are no posts yet. Explore these resources and tools, or share a question or something you have tried.'}</p>${topic?html`<p><a href="${topic.href}"><b>${topic.name} ›</b></a></p><p class="fine">${topic.description}</p>`:''}<p><a href="/${lang}/tools/">${ko?'이미지·PDF·게임 도구':'Image, PDF and game tools'} ›</a> · <a href="/${lang}/preflight/">${ko?'작업 환경 점검':'Environment checks'} ›</a></p></div></section>`;
}
