// @ts-check
/** 다듬기 작업대 (/{l}/make/) and its preset landings (/{l}/make/<slug>/): server-rendered inside the portal
 * chrome (ui.js page()), the same HTML for everyone (edge-cached). The workbench itself is an island
 * (src/make/make.js): pictures never leave the visitor's browser until they choose to post.
 *  /{l}/make/                 the workbench, empty (?preset=<id> opens a preset, ?recipe=<post id> = remix mode)
 *  /{l}/make/<slug>/          a preset landing: a short answer to the search (what size, how) + the workbench preloaded */
import {html} from './html.js';
import {page} from './ui.js';
import {anonFields} from './post.js';
import {PRESETS,presetBySlug,FIT_SPECS,summarize,OPS} from '../recipe.js';

export const MAKE_CSS='/src/make/make.css?v=20261011';
export const MAKE_JS='/src/make/make.js';
/** @param {string} l */
export const makePath=(l,slug='')=>`/${l}/make/${slug?`${slug}/`:''}`;

/** Search-intent copy per landing (ko first). `answer` is the direct answer to the query; `spec` rows are
 * the official numbers with where they come from; `steps` is what the preset recipe does. */
const LANDING=/** @type {Record<string,{ko:{title:string,h1:string,answer:string,spec:[string,string][],source:string,how:string[],faq:[string,string][]},en:{title:string,h1:string,answer:string,spec:[string,string][],source:string,how:string[],faq:[string,string][]}}>} */({
 'kakao-emoticon':{
  ko:{title:'카톡 이모티콘 만들기 — AI 그림을 360×360 PNG로',h1:'카톡 이모티콘 만들기 (360×360)',
   answer:'카카오톡 대화용 이모티콘은 360×360 PNG(투명 배경)로 만들면 돼요. ChatGPT·제미나이로 뽑은 표정 시트를 올리면 한 장씩 나누고, 배경을 지우고, 360×360·150KB 이하로 맞춰 ZIP으로 받을 수 있어요. 모든 처리는 이 브라우저 안에서 해요.',
   spec:[['크기','360×360 px (멈춰있는 이모티콘)'],['형식','PNG · 투명 배경'],['용량','개당 150KB 이하'],['개수','제안 시 32개 (움직이는 이모티콘 24개)']],
   source:'카카오 이모티콘 스튜디오 제안 안내를 옮긴 2차 자료 기준이에요 (2025-11 스튜디오 개편 뒤 값은 확인 중). 카카오는 AI로 만든 이모티콘 제안을 받지 않아서, 이 결과는 개인 사용·시안용이에요.',
   how:['표정이 여러 개 들어간 시트나 한 장짜리 그림을 올려요.','칸을 자동으로 찾아 나누고, 배경을 지우고, 여백을 맞춰요.','360×360 PNG가 150KB를 넘으면 색 수를 줄여 맞춰요. ZIP으로 받아요.'],
   faq:[['카톡에 판매 제안을 할 수 있나요?','아니요. 카카오는 2023년 9월부터 생성형 AI로 만든 이모티콘 제안을 받지 않아요. 친구와 나누는 개인 사용·시안으로 쓰세요.'],['시트가 6×4가 아니어도 되나요?','네. 칸을 그림마다 다시 찾아서 5×4, 4×4 시트도 나눠요. 칸 사이 배경이 거의 없는 시트는 \'격자\' 방식으로 칸 수를 직접 정할 수 있어요.']]},
  en:{title:'KakaoTalk emoticon maker — AI art to 360×360 PNG',h1:'Make KakaoTalk emoticons (360×360)',
   answer:'KakaoTalk chat emoticons are 360×360 transparent PNGs. Upload an expression sheet from ChatGPT or Gemini: it is split into single stickers, the background removed, each fitted to 360×360 under 150 KB, and you download a ZIP. Everything runs in this browser.',
   spec:[['Size','360×360 px (still emoticons)'],['Format','PNG, transparent'],['File size','≤ 150 KB each'],['Count','32 for a proposal (24 animated)']],
   source:'From secondary sources quoting the Kakao Emoticon Studio guide (values after the 2025-11 studio update not yet re-checked). Kakao does not accept AI-made emoticons for sale: this is for personal use and drafts.',
   how:['Upload a sheet of expressions or a single picture.','Cells are found and split, backgrounds removed, margins evened out.','A PNG over 150 KB gets fewer colours until it fits. Download the ZIP.'],
   faq:[['Can I submit these to Kakao for sale?','No. Since September 2023 Kakao does not accept emoticons made with generative AI. Use them privately or as drafts.'],['Does my sheet need to be 6×4?','No. Cells are detected on every picture, so 5×4 or 4×4 sheets split too. For sheets without gaps, switch the split to “grid” and set the counts.']]}},
 'line-sticker':{
  ko:{title:'LINE 스탬프 만들기 — 370×320 짝수 크기 PNG 자동 맞춤',h1:'LINE 스탬프 만들기 (370×320)',
   answer:'LINE 스탬프는 최대 370×320, 가로·세로 짝수 크기의 투명 PNG예요. 개당 1MB 이하, 8·16·24·32·40개 묶음이고 대표 이미지(240×240)와 탭 이미지(96×74)가 따로 필요해요. AI 그림 시트를 올리면 나누기·배경 지우기·흰 테두리·규격 맞추기까지 한 번에 하고 main.png·tab.png가 든 ZIP을 받아요.',
   spec:[['스탬프','최대 370×320 px · 가로·세로 짝수'],['대표 이미지','main.png 240×240'],['탭 이미지','tab.png 96×74'],['형식·용량','투명 PNG · 개당 1MB 이하 · ZIP 60MB 이하'],['개수','8 · 16 · 24 · 32 · 40개'],['움직이는 스탬프','최대 320×270 APNG · 5–20프레임 · 4초 이하']],
   source:'LINE Creators Market 공식 가이드라인 기준 (2026-10 확인). AI로 만든 스탬프는 판매할 때 AI 사용을 표시해야 한다는 안내가 있어요 (비공식 자료, 제출 전에 직접 확인하세요).',
   how:['스탬프 시트(예: 표정 24개)를 올려요.','칸 나누기 → 배경 지우기 → 피사체 맞춤 → 흰 테두리 → 370×320 맞춤이 자동으로 돼요.','규격 확인 표시를 보고 ZIP(01.png…, main.png, tab.png)을 받아요.'],
   faq:[['크기가 꼭 370×320이어야 하나요?','최대 크기예요. 이 도구는 모든 스탬프를 370×320 캔버스(짝수)에 여백 약 10px로 맞춰서 크기가 들쭉날쭉하지 않게 해요.'],['개수가 24개가 아니면요?','LINE은 8·16·24·32·40개 묶음만 받아요. 개수가 맞지 않으면 규격 확인에서 알려 줘요.']]},
  en:{title:'LINE sticker maker — 370×320 even-sized PNGs',h1:'Make LINE stickers (370×320)',
   answer:'LINE stickers are transparent PNGs of at most 370×320 with even width and height, ≤ 1 MB each, in sets of 8, 16, 24, 32 or 40, plus a main image (240×240) and a tab image (96×74). Upload an AI sticker sheet: split, background removal, white border and fitting happen in one go, and the ZIP includes main.png and tab.png.',
   spec:[['Sticker','max 370×320 px · even sides'],['Main image','main.png 240×240'],['Tab image','tab.png 96×74'],['Format','transparent PNG · ≤ 1 MB each · ZIP ≤ 60 MB'],['Count','8, 16, 24, 32 or 40'],['Animated','max 320×270 APNG · 5–20 frames · ≤ 4 s']],
   source:'LINE Creators Market guidelines (checked 2026-10). For AI-made stickers, sellers are told to mark AI use (unofficial source: check before you submit).',
   how:['Upload a sticker sheet (e.g. 24 expressions).','Split → remove background → fit subject → white border → 370×320 run automatically.','Check the spec badge and download the ZIP (01.png…, main.png, tab.png).'],
   faq:[['Must every sticker be exactly 370×320?','That is the maximum. This tool puts every sticker on a 370×320 canvas (even sides) with about 10 px margin so the set looks consistent.'],['What if I do not have 24?','LINE takes sets of 8, 16, 24, 32 or 40. The spec check tells you when the count is off.']]}},
 'discord-emoji':{
  ko:{title:'디스코드 이모지 만들기 — 128×128 · 256KB 이하',h1:'디스코드 이모지 만들기 (128×128)',
   answer:'디스코드 서버 이모지는 128×128로 보이고 파일은 256KB 이하여야 해요. 그림을 올리면 배경을 지우고 피사체를 꽉 차게 잘라 128×128 PNG로 맞춰요. 여러 개가 든 시트는 한 번에 나눠서 ZIP으로 받아요.',
   spec:[['크기','128×128 px로 표시'],['용량','256KB 이하'],['형식','PNG · GIF (움직이는 이모지)'],['스티커','320×320 · 512KB 이하 (별도 규격)']],
   source:'디스코드 고객지원 안내를 옮긴 2차 자료 기준이에요 (공식 페이지 직접 확인 못 함, 2026-10).',
   how:['그림이나 이모지 시트를 올려요.','배경 지우기 → 꽉 차게 자르기 → 128×128 맞춤.','PNG(여러 개면 ZIP)를 받아 서버 설정 › 이모지에 올려요.'],
   faq:[['움직이는 이모지도 되나요?','네. 단계에 \'움직이게\'를 넣고 저장 형식을 GIF로 바꾸면 128×128 GIF로 만들어요. 256KB를 넘으면 색 수를 줄여 맞춰요.']]},
  en:{title:'Discord emoji maker — 128×128, under 256 KB',h1:'Make Discord emoji (128×128)',
   answer:'Discord server emoji display at 128×128 and the file must be under 256 KB. Upload a picture: the background is removed, the subject cropped to fill, and it is saved as a 128×128 PNG. Sheets are split and come as a ZIP.',
   spec:[['Size','shown at 128×128 px'],['File size','≤ 256 KB'],['Format','PNG · GIF (animated)'],['Stickers','320×320 · ≤ 512 KB (separate spec)']],
   source:'From secondary sources quoting Discord support (the official page could not be checked directly, 2026-10).',
   how:['Upload a picture or an emoji sheet.','Remove background → crop to fill → fit 128×128.','Download the PNG (ZIP for several) and add it under Server Settings › Emoji.'],
   faq:[['Animated emoji?','Add the “Animate” step and save as GIF: you get a 128×128 GIF, reduced in colours when it is over 256 KB.']]}},
 'telegram-sticker':{
  ko:{title:'텔레그램 스티커 만들기 — 한 변 512px PNG',h1:'텔레그램 스티커 만들기 (512px)',
   answer:'텔레그램 정지 스티커는 한 변이 정확히 512px이고 다른 변은 512px 이하인 PNG(또는 WEBP)예요. 그림을 올리면 배경을 지우고 흰 테두리를 둘러 긴 변을 512px로 맞춰요. 받은 PNG를 @Stickers 봇에 보내면 돼요.',
   spec:[['크기','한 변 정확히 512px · 다른 변 512px 이하'],['형식','PNG 또는 WEBP · 투명 배경'],['영상 스티커','WEBM VP9 · 3초 이하 · 256KB 이하 (이 도구는 아직 정지 스티커만)']],
   source:'Telegram 공식 스티커 안내 기준 (core.telegram.org/stickers, 2026-10 확인).',
   how:['그림이나 스티커 시트를 올려요.','배경 지우기 → 흰 테두리 → 긴 변 512px 맞춤.','PNG를 받아 텔레그램 @Stickers 봇에 보내요.'],
   faq:[['정사각형이 아니어도 되나요?','네. 긴 변만 512px이면 돼요. 그래서 그림 비율을 그대로 살려요.']]},
  en:{title:'Telegram sticker maker — 512 px PNG',h1:'Make Telegram stickers (512 px)',
   answer:'Telegram static stickers are PNG (or WEBP) files with one side exactly 512 px and the other at most 512 px. Upload a picture: the background is removed, a white border added and the long side set to 512 px. Send the PNG to the @Stickers bot.',
   spec:[['Size','one side exactly 512 px · the other ≤ 512 px'],['Format','PNG or WEBP · transparent'],['Video stickers','WEBM VP9 · ≤ 3 s · ≤ 256 KB (this tool makes static stickers for now)']],
   source:'Telegram’s official sticker guide (core.telegram.org/stickers, checked 2026-10).',
   how:['Upload a picture or a sticker sheet.','Remove background → white border → long side 512 px.','Download and send the PNG to @Stickers.'],
   faq:[['Does it have to be square?','No. Only the long side must be 512 px, so the picture keeps its shape.']]}},
 'round-pfp':{
  ko:{title:'원형 프사 만들기 — 정사각형 800×800 · 원형 PNG',h1:'원형 프사 만들기',
   answer:'카카오톡·인스타그램·X는 프로필 사진을 올린 정사각형에서 원으로 잘라 보여 줘요. 그래서 얼굴이 가운데 오게 1:1로 자르는 게 핵심이에요. 이 도구는 가운데를 1:1로 잘라 800×800으로 맞추고, 원 바깥을 투명하게 한 PNG도 만들어요.',
   spec:[['권장 크기','800×800 (YouTube 권장 800×800, X 400×400)'],['카카오톡','공식 크기 안내 없음 · 1:1 원형으로 보여요'],['형식','PNG (원 바깥 투명)']],
   source:'YouTube·X 도움말 기준 (2026-10). 카카오톡은 공식 규격 안내가 없어요.',
   how:['AI로 만든 프사를 올려요.','가운데 1:1 자르기 → 800×800 → 원형.','PNG를 받아요. 앱이 원으로 자르는 곳에는 원형 단계를 꺼도 돼요.'],
   faq:[['얼굴이 가운데가 아니면요?','\'자르기\' 단계를 눌러 기준을 \'피사체\'로 바꾸면 배경을 지운 피사체를 기준으로 잘라요.']]},
  en:{title:'Round profile picture maker — 800×800 circle PNG',h1:'Make a round profile picture',
   answer:'KakaoTalk, Instagram and X show your square profile picture cropped to a circle, so the face has to sit in the middle of a 1:1 crop. This crops the centre to 1:1, fits it to 800×800, and makes a PNG with everything outside the circle transparent.',
   spec:[['Recommended','800×800 (YouTube 800×800, X 400×400)'],['KakaoTalk','no official size · shown as a 1:1 circle'],['Format','PNG (transparent outside the circle)']],
   source:'YouTube and X help pages (2026-10). KakaoTalk publishes no size.',
   how:['Upload your AI portrait.','Centre 1:1 crop → 800×800 → circle.','Download the PNG; turn the circle step off for apps that crop it themselves.'],
   faq:[['The face is not centred?','Open the Crop step and switch it to “subject” to crop around the cut-out subject.']]}},
 'phone-wallpaper':{
  ko:{title:'폰 배경화면 만들기 — AI 그림을 아이폰 17 해상도로',h1:'폰 배경화면 만들기 (아이폰 17 · 갤럭시)',
   answer:'ChatGPT·제미나이 그림은 보통 1024–1536px라 휴대폰 배경화면(아이폰 17: 1206×2622)에는 작아요. 이 도구는 AI로 2배 키운 뒤 화면 비율에 꽉 차게 잘라 정확한 해상도로 맞춰요. 규격에서 갤럭시 S25(1080×2340), 아이폰 17 Pro Max(1320×2868), PC(1920×1080·4K)도 고를 수 있어요.',
   spec:[['아이폰 17 · 17 Pro','1206×2622'],['아이폰 17 Pro Max','1320×2868'],['갤럭시 S25','1080×2340'],['PC','1920×1080 · 2560×1440 · 3840×2160']],
   source:'Apple·Samsung 제품 사양 페이지 기준 (2026-10).',
   how:['그림을 올려요 (세로 그림이 잘 맞아요).','AI로 2배 키우기 → 화면에 꽉 차게 맞춤.','PNG를 받아 사진 앱에서 배경화면으로 지정해요.'],
   faq:[['AI로 키우면 그림이 바뀌나요?','새 내용을 그려 넣는 방식이 아니라 가장자리와 질감을 또렷하게 하는 업스케일(Real-ESRGAN)이에요. 처음 쓸 때 모델(약 5MB)을 한 번 받아요.']]},
  en:{title:'Phone wallpaper maker — AI art at iPhone 17 resolution',h1:'Make a phone wallpaper (iPhone 17 · Galaxy)',
   answer:'ChatGPT and Gemini pictures are usually 1024–1536 px: too small for a phone wallpaper (iPhone 17: 1206×2622). This upscales 2× with AI, then crops to fill the screen at the exact resolution. You can also pick Galaxy S25 (1080×2340), iPhone 17 Pro Max (1320×2868) or PC (1920×1080, 4K).',
   spec:[['iPhone 17 · 17 Pro','1206×2622'],['iPhone 17 Pro Max','1320×2868'],['Galaxy S25','1080×2340'],['PC','1920×1080 · 2560×1440 · 3840×2160']],
   source:'Apple and Samsung spec pages (2026-10).',
   how:['Upload a picture (portrait pictures fit best).','AI upscale 2× → fill the screen.','Download the PNG and set it as wallpaper.'],
   faq:[['Does AI upscaling change the picture?','It sharpens edges and texture (Real-ESRGAN); it does not paint new content. The model (about 5 MB) downloads once on first use.']]}},
 'ai-pixel-fix':{
  ko:{title:'AI 도트 정리 — 픽셀 크기가 제각각인 AI 도트를 진짜 도트로',h1:'AI 도트 정리',
   answer:'ChatGPT·제미나이가 그린 "도트"는 픽셀 크기가 제각각이고 색이 번져 있어서 진짜 도트가 아니에요. 이 도구는 격자를 찾아 한 칸을 한 픽셀로 되돌리고 비슷한 색을 합쳐요. 격자를 확신하지 못하면 크기를 그대로 두고 그렇다고 알려 줘요.',
   spec:[['결과','1픽셀 = 1칸 PNG (예: 64×64)'],['확대','×8 nearest (도트 그대로)'],['색','비슷한 색 합치기 · 원하면 색 수 지정']],
   source:'Nerulio 픽셀 정리 엔진 (69개 정답 케이스 벤치에서 크기 정확도 81%, 실제 AI 도트에서는 확신이 낮은 경우가 많아요 — docs/STUDIO-PIXEL.md).',
   how:['AI 도트 그림을 올려요.','격자 찾기 → 한 칸 한 픽셀 → 색 합치기.','작은 원본과 ×8 확대본을 받아요.'],
   faq:[['격자를 못 찾으면요?','\'AI 도트 정리\' 단계에서 격자 크기(px)를 직접 넣을 수 있어요.']]},
  en:{title:'AI pixel art fixer — turn AI “pixel art” into real pixels',h1:'Fix AI pixel art',
   answer:'“Pixel art” from ChatGPT or Gemini has uneven pixel sizes and blurred colours. This finds the grid, turns each cell back into one pixel and merges near-identical colours. When it is not confident about the grid it leaves the size alone and says so.',
   spec:[['Result','one pixel per cell PNG (e.g. 64×64)'],['Upscale','×8 nearest (stays crisp)'],['Colours','near-identical colours merged · optional count']],
   source:'Nerulio’s pixel cleanup engine (81 % size accuracy on a 69-case benchmark with ground truth; on real AI pixel art it is often not confident — docs/STUDIO-PIXEL.md).',
   how:['Upload the AI pixel picture.','Find grid → one pixel per cell → merge colours.','Download the small original and the ×8 version.'],
   faq:[['No grid found?','Set the grid size (px) yourself in the “Fix AI pixel art” step.']]}},
});
export const MAKE_SLUGS=Object.freeze(Object.keys(LANDING));

/** @param {{l:string,slug?:string|null,preset?:string|null,recipe?:string|null,channels:any[]}} o @param {{origin:string}} site */
export function renderMake(o,site){
 const l=o.l==='en'?'en':'ko',ko=l==='ko',lang=ko?'ko':'en';
 const preset=o.slug?presetBySlug(o.slug):o.preset?PRESETS.find(p=>p.id===o.preset)||null:null;
 const copy=o.slug?LANDING[o.slug]?.[lang]:null;
 const remix=!!o.recipe;
 // One URL per view: a preset opened by id points at its landing; a remix is personal (noindex).
 const canonical=site.origin+(preset?makePath(l,preset.slug):makePath(l));
 const alternates={ko:site.origin+(o.slug?makePath('ko',o.slug):makePath('ko')),en:site.origin+(o.slug?makePath('en',o.slug):makePath('en'))};
 const title=copy?`${copy.title} | Nerulio`:ko?'다듬기 작업대 — AI 이미지 누끼·규격·스티커 | Nerulio':'Workbench — background removal, sizes and stickers for AI images | Nerulio';
 const description=copy?copy.answer.slice(0,155):ko?'AI로 만든 이미지를 올려 배경 지우기, 시트 나누기, 카톡·LINE·디스코드·텔레그램 규격 맞추기를 이 브라우저 안에서 해요. 서버로 보내지 않아요.':'Remove backgrounds, split sticker sheets and fit KakaoTalk, LINE, Discord and Telegram specs in your browser. Nothing is uploaded.';
 const intro=copy?html`<section class="mk-land" aria-labelledby="mk-land-h"><h1 id="mk-land-h">${copy.h1}</h1><p class="mk-answer">${copy.answer}</p></section>`:'';
 const more=copy&&preset?landing(copy,preset,l):'';
 const chips=html`<ul class="mk-presets" aria-label="${ko?'규격 바로 맞추기':'Ready presets'}">${PRESETS.map(p=>html`<li><a href="${makePath(l,p.slug)}"${preset?.id===p.id?html` aria-current="page"`:''} data-preset-link="${p.id}"><span>${p.names[lang].replace(/ 만들기$| maker$/,'')}</span><span class="mono">${p.spec.split(' · ')[0]}</span></a></li>`)}</ul>`;
 const steps=preset?summarize(preset.recipe,l).steps.filter(s=>s.op!=='export'):[];
 const body=html`<main class="mk${remix?' mk-remix':''}" id="make" data-island="make" data-l="${l}"${preset?html` data-preset="${preset.id}"`:''}${remix?html` data-recipe="${String(o.recipe)}"`:''} data-catalog="${OPS.join(',')}">
${intro}
<section class="mk-wb" aria-labelledby="mk-h">
<header class="mk-hd"><h${copy?'2':'1'} id="mk-h" class="mk-t">${remix?(ko?'내 이미지로 해보기':'Try it on my image'):(ko?'다듬기 작업대':'Workbench')}</h${copy?'2':'1'}><span class="mk-file" data-file></span><span class="sp"></span><span class="mk-local"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>${ko?'올리기 전까지 이미지는 이 브라우저 밖으로 안 나가요':'Your image stays in this browser until you post'}</span></header>
<div class="mk-drop" data-drop>
<label class="mk-pick"><input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp" data-file-input class="sr-only"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg><strong>${preset?(ko?`${preset.names.ko.replace(/ 만들기$/,'')}: 이미지 고르기`:`${preset.names.en}: choose an image`):(ko?'AI로 만든 이미지 올려서 바로 다듬기':'Drop an AI image to start')}</strong><span class="fine">${ko?'끌어 놓기 · 붙여넣기(Ctrl+V)도 돼요 · PNG·JPG·WebP':'Drag and drop or paste (Ctrl+V) · PNG, JPG, WebP'}</span><span class="btn">${ko?'이미지 고르기':'Choose image'}</span></label>
${steps.length?html`<p class="mk-will"><b>${ko?'이 레시피로 해요':'This recipe'}</b> ${steps.map(s=>s.name).join(' → ')}</p>`:chips}
<noscript><p class="fine">${ko?'다듬기 작업대는 자바스크립트가 필요해요. 이미지는 서버로 보내지 않고 이 브라우저에서 처리돼요.':'The workbench needs JavaScript. Images are processed in this browser, never uploaded.'}</p></noscript>
</div>
<div class="mk-work" data-work hidden></div>
</section>
${!copy&&!remix?html`<section class="mk-about"><h2>${ko?'규격 바로 맞추기':'Ready presets'}</h2>${preset?chips:''}<p class="fine">${ko?'단계를 바꾸면 레시피에 자동으로 기록돼요. 커뮤니티에 올리면 다른 사람이 \'내 이미지로 해보기\'로 같은 단계를 자기 이미지에 쓸 수 있어요. 얼굴 바꾸기·체형 바꾸기·옷 지우기·나이 바꾸기·워터마크 지우기 같은 단계는 이 사이트에 없어요.':'Every step you apply is recorded as a recipe. Post it and others can replay the same steps on their own image. There are no face swap, body reshape, clothing removal, age change or watermark removal steps on this site.'}</p></section>`:''}
${more}
<template id="mk-anon">${anonFields(l,makePath(l))}</template>
<link rel="stylesheet" href="${MAKE_CSS}">
<script type="module" src="${MAKE_JS}"></script>
</main>`;
 const jsonld={'@context':'https://schema.org','@type':'WebApplication',name:copy?copy.h1:ko?'Nerulio 다듬기 작업대':'Nerulio workbench',url:canonical,description,applicationCategory:'MultimediaApplication',operatingSystem:'Web',inLanguage:l,isAccessibleForFree:true,offers:{'@type':'Offer',price:'0',priceCurrency:ko?'KRW':'USD'}};
 return page({l,title,description,canonical,alternates,noindex:remix||(!!o.preset&&!o.slug),channels:o.channels,body,jsonld});
}

/** @param {{h1:string,answer:string,spec:[string,string][],source:string,how:string[],faq:[string,string][]}} c @param {typeof PRESETS[number]} p @param {string} l */
function landing(c,p,l){
 const ko=l==='ko',fit=p.fit?FIT_SPECS[p.fit]:null;
 return html`<section class="mk-land mk-land-more" aria-label="${ko?'규격과 만드는 법':'Spec and how-to'}"><div class="mk-land-cols"><div><h2>${ko?'규격':'Spec'}</h2><table class="mk-spec"><tbody>${c.spec.map(([k,v])=>html`<tr><th scope="row">${k}</th><td>${v}</td></tr>`)}</tbody></table><p class="fine">${c.source}${fit?html` <span class="mono">· ${ko?'확인':'checked'} ${fit.rev}</span>`:''}</p></div>
<div><h2>${ko?'만드는 법':'How'}</h2><ol class="mk-how">${c.how.map(x=>html`<li>${x}</li>`)}</ol></div></div>
<details class="mk-faq"><summary>${ko?'자주 묻는 질문':'Questions'}</summary>${c.faq.map(([q,a])=>html`<h3>${q}</h3><p>${a}</p>`)}</details></section>`;
}
