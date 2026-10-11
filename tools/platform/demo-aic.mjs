/** Sample AI 창작 posts for local previews, renderer tests and screenshots ONLY — never imported by the Worker
 * or the build, never written to production D1. Posts in the seven boards with recipes, a remix thread, comments
 * with replies, "내 이미지로 해보기" counts and images. The images are drawn here (simple sticker characters
 * as PNG: a "원본" on a coloured background and transparent results), so nothing outside the repository is
 * needed; with an R2 bucket (the dev server's in-memory one) their bytes are stored too. Demo ids start with
 * "demo". */
import {deflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {createPost} from '../../platform/community.js';
import {RECIPE_SCHEMA,validateRecipe} from '../../platform/recipe.js';

const MIN=6e4,HOUR=36e5,DAY=864e5;

/* ---------- a tiny PNG painter ---------- */
const CRC_T=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
const crc=(/** @type {Uint8Array} */ b)=>{let c=0xffffffff;for(const x of b)c=CRC_T[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
/** @param {number} w @param {number} h @param {Uint8Array} rgba */
function png(w,h,rgba){
 const raw=new Uint8Array((w*4+1)*h);for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;raw.set(rgba.subarray(y*w*4,(y+1)*w*4),y*(w*4+1)+1);}
 const chunk=(/** @type {string} */ type,/** @type {Uint8Array} */ data)=>{const out=new Uint8Array(12+data.length),dv=new DataView(out.buffer);dv.setUint32(0,data.length);out.set(new TextEncoder().encode(type),4);out.set(data,8);dv.setUint32(8+data.length,crc(out.subarray(4,8+data.length)));return out;};
 const ihdr=new Uint8Array(13),dv=new DataView(ihdr.buffer);dv.setUint32(0,w);dv.setUint32(4,h);ihdr[8]=8;ihdr[9]=6;
 const parts=[new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',new Uint8Array(deflateSync(raw,{level:6}))),chunk('IEND',new Uint8Array(0))];
 const all=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let o=0;for(const p of parts){all.set(p,o);o+=p.length;}
 return all;
}
const hexRgb=(/** @type {string} */ h)=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
/**
 * A sticker character (round head, rounded body, eyes, a mouth) with a white border, on a transparent or
 * coloured background; `pixel` snaps it to a coarse grid (the 도트 posts).
 * @param {number} w @param {number} h @param {{color:string,bg?:string|null,border?:number,mood?:number,pixel?:number,round?:boolean}} o
 */
function character(w,h,o){
 const [r,g,b]=hexRgb(o.color),bg=o.bg?hexRgb(o.bg):null,px=new Uint8Array(w*h*4),s=Math.min(w,h);
 const cx=w/2,hy=h*0.40,hr=s*0.22,by=h*0.70,bw=s*0.25,bh=s*0.15,brad=s*0.10,border=o.border??s*0.03;
 const sdBody=(/** @type {number} */ x,/** @type {number} */ y)=>{const qx=Math.abs(x-cx)-(bw-brad),qy=Math.abs(y-by)-(bh-brad);return Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-brad;};
 const sd=(/** @type {number} */ x,/** @type {number} */ y)=>Math.min(Math.hypot(x-cx,y-hy)-hr,sdBody(x,y));
 const eye=(/** @type {number} */ x,/** @type {number} */ y)=>Math.min(Math.hypot(x-(cx-hr*0.38),y-(hy-hr*0.05)),Math.hypot(x-(cx+hr*0.38),y-(hy-hr*0.05)))-hr*0.11;
 const mouthY=hy+hr*0.35,mood=o.mood??1;
 const mouth=(/** @type {number} */ x,/** @type {number} */ y)=>{const dx=(x-cx)/(hr*0.4);if(Math.abs(dx)>1)return 9;const yy=mouthY+mood*hr*0.18*(1-dx*dx);return Math.abs(y-yy)-hr*0.05;};
 const p=o.pixel||1;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const sx=p>1?Math.floor(x/p)*p+p/2:x+0.5,sy=p>1?Math.floor(y/p)*p+p/2:y+0.5;
  const d=sd(sx,sy),cov=(/** @type {number} */ v)=>p>1?(v<0?1:0):Math.max(0,Math.min(1,0.5-v));
  const fill=cov(d),edge=cov(d-border),dark=Math.max(cov(eye(sx,sy)),cov(mouth(sx,sy)))*fill;
  let R=255,G=255,B=255,A=edge;            // the white border ring
  R=R*(1-fill)+r*fill;G=G*(1-fill)+g*fill;B=B*(1-fill)+b*fill;
  R=R*(1-dark)+21*dark;G=G*(1-dark)+23*dark;B=B*(1-dark)+26*dark;
  if(bg){R=R*A+bg[0]*(1-A);G=G*A+bg[1]*(1-A);B=B*A+bg[2]*(1-A);A=1;}
  const i=(y*w+x)*4;px[i]=R;px[i+1]=G;px[i+2]=B;px[i+3]=Math.round(A*255);
 }
 return png(w,h,px);
}

/* ---------- posts ---------- */
const USERS=[['demo:a1','감자칩'],['demo:a2','뭉게'],['demo:a3','pixelpan'],['demo:a4','멍멍'],['demo:a5','디코장'],['demo:a6','노을'],['demo:a7','바탕화면장인'],['demo:a8','운영자']];
/** A recipe as the workbench stores it: validated (every parameter written out) by platform/recipe.js.
 * @param {string} generator @param {string} prompt @param {[string,Record<string,unknown>][]} steps @param {{w:number,h:number,count?:number}} result @param {'single'|'sheet'} [expect] */
function recipe(generator,prompt,steps,result,expect='single'){
 const v=validateRecipe({schema:RECIPE_SCHEMA,source:{generator,...(prompt?{prompt}:{}),ai:true},input:{expect},steps:steps.map(([op,p])=>({op,v:1,p})),result:{w:result.w,h:result.h,frames:1,count:result.count||1}});
 if(!v.ok)throw Error(`demo recipe: ${/** @type {any} */(v).error}`);
 return /** @type {any} */(v).recipe;
}
const COLORS=['#e07a5f','#f2a541','#7fb069','#5aa9e6','#8e7dbe','#c4411d'];
/** @typedef {{id:string,ch:string,kind:string,title:string,body:string,author:string,anon?:string|null,ago:number,up:number,views:number,tries?:number,recipe?:any,generator?:string,prompt?:string,remixOf?:string,images?:{w:number,h:number,color:string,bg?:string,source?:boolean,mood?:number,pixel?:number}[],comments?:[string,string,number,number?][],best?:boolean,pinned?:boolean}} DemoPost */
/** @type {DemoPost[]} */
const POSTS=[
 {id:'demo-aic-1',ch:'sticker',kind:'line',title:'나노바나나 피규어로 LINE 스탬프 24개 한 번에 뽑음',author:'demo:a1',anon:'118.235',ago:420,up:41,views:640,tries:96,
  body:'제미나이로 캐릭터 시트 한 장 뽑고 여기서 나눠서 LINE 규격까지 맞췄어요. 표정 24개 다 짝수 크기 맞고 여백 10px 들어갔어요. 레시피 그대로 쓰면 자기 시트로 똑같이 돼요.',
  generator:'gemini',prompt:'첨부한 캐릭터로 표정 24개를 6×4 격자에 그려줘. 흰 배경, 캐릭터마다 간격 넉넉하게, 두꺼운 외곽선, 귀여운 피규어 느낌.',
  recipe:recipe('gemini','첨부한 캐릭터로 표정 24개를 6×4 격자에 그려줘. 흰 배경, 캐릭터마다 간격 넉넉하게, 두꺼운 외곽선, 귀여운 피규어 느낌.',[['sheet.split',{mode:'auto',cols:6,rows:4}],['bg.remove',{mode:'ai',refine:true}],['crop',{mode:'subject',margin:0.08}],['sticker.border',{width:0.018}],['fit',{preset:'line.sticker'}],['export',{format:'png',pack:'zip',maxBytes:1000000}]],{w:370,h:320,count:24},'sheet'),
  images:[{w:480,h:360,color:'#e07a5f',bg:'#cfd6de',source:true},...COLORS.map((c,i)=>({w:370,h:320,color:c,mood:i%2?-1:1}))],
  comments:[['demo:a6','시트 나누기가 그림 사이 간격 좁아도 잘 잘리네요. 제 건 5×4였는데 자동으로 잡힘',6],['demo:a1','격자 인식이 애매하면 단계 1에서 칸 수 직접 넣으면 돼요',3,1],['demo:a5','디코용으로 해보기 했는데 마지막 단계만 디스코드 128로 바꾸니까 바로 됨',2]]},
 {id:'demo-aic-2',ch:'pfp',kind:'tip',title:'지브리 프사 테두리 하얗게 뜨는 거 이렇게 해결',author:'demo:a2',ago:38,up:33,views:420,tries:61,
  body:'ChatGPT로 만든 지브리풍 그림을 원형으로 자르면 가장자리가 하얗게 뜨는데, 배경 지우기에서 가장자리 다듬기를 켜고 자르면 깔끔해요.',
  generator:'chatgpt',prompt:'이 사진을 지브리 스튜디오 느낌의 따뜻한 수채화 그림으로 바꿔줘. 배경은 단순하게.',
  recipe:recipe('chatgpt','이 사진을 지브리 스튜디오 느낌의 따뜻한 수채화 그림으로 바꿔줘. 배경은 단순하게.',[['bg.remove',{mode:'ai',refine:true}],['crop',{mode:'subject',ratio:'1:1',shape:'circle',margin:0.06}],['upscale',{scale:2,engine:'ai'}],['fit',{preset:'pfp.square'}]],{w:800,h:800}),
  images:[{w:400,h:400,color:'#7fb069',bg:'#d9c7b0',source:true},{w:400,h:400,color:'#7fb069'}]},
 {id:'demo-aic-3',ch:'pixel',kind:'fix',title:'챗GPT 도트가 픽셀 크기 제각각일 때 정리 전후',author:'demo:a3',anon:'61.74',ago:60,up:29,views:380,tries:44,
  body:'AI 도트는 한 픽셀 크기가 들쭉날쭉해요. AI 도트 정리로 격자에 맞추고 16색으로 줄인 뒤 8배로 키웠어요.',
  generator:'chatgpt',prompt:'16비트 RPG 스타일의 귀여운 마법사 캐릭터 도트, 정면, 단색 배경.',
  recipe:recipe('chatgpt','16비트 RPG 스타일의 귀여운 마법사 캐릭터 도트, 정면, 단색 배경.',[['pixel.snap',{scale:0,colors:16}],['upscale',{scale:8,engine:'pixel',maxSide:2048}],['export',{format:'png'}]],{w:512,h:512}),
  images:[{w:384,h:384,color:'#3d5a80',bg:'#e6dccb',source:true,pixel:6},{w:384,h:384,color:'#3d5a80',pixel:12}]},
 {id:'demo-aic-4',ch:'sticker',kind:'kakao',title:'우리 집 강아지 표정 6종 카톡용으로',author:'demo:a4',ago:25,up:19,views:211,remixOf:'demo-aic-1',
  body:'위 LINE 레시피로 해보고 마지막만 카톡 360으로 바꿨어요. 강아지 사진은 제 강아지예요.',generator:'gemini',
  recipe:recipe('gemini','',[['sheet.split',{mode:'auto',cols:3,rows:2}],['bg.remove',{mode:'auto'}],['sticker.border',{width:0.018}],['fit',{preset:'kakao.static'}],['export',{maxBytes:150000}]],{w:360,h:360,count:6},'sheet'),
  images:[{w:360,h:360,color:'#f2a541'},{w:360,h:360,color:'#f2a541',mood:-1},{w:360,h:360,color:'#e9c46a'}]},
 {id:'demo-aic-5',ch:'sticker',kind:'question',title:'흰 테두리 두께 몇 px이 제일 자연스러움?',author:'demo:a6',anon:'211.36',ago:70,up:5,views:388,
  body:'6px로 했는데 작은 화면에서 좀 두꺼워 보여요. 다들 몇으로 하세요?',comments:[['demo:a1','LINE은 6~8px, 디스코드 128이면 3px 정도가 좋았어요',4]]},
 {id:'demo-aic-6',ch:'sticker',kind:'discord',title:'디코 서버 이모지 128로 맞춤 (리믹스)',author:'demo:a5',ago:300,up:22,views:301,remixOf:'demo-aic-1',generator:'gemini',
  body:'레시피 마지막 단계만 디스코드 128로 바꿨어요.',
  recipe:recipe('gemini','',[['sheet.split',{mode:'auto',cols:6,rows:4}],['bg.remove',{mode:'ai',refine:true}],['sticker.border',{width:0.02}],['fit',{preset:'discord.emoji'}],['export',{maxBytes:256000}]],{w:128,h:128,count:24},'sheet'),
  images:[{w:128,h:128,color:'#5aa9e6'},{w:128,h:128,color:'#8e7dbe'}]},
 {id:'demo-aic-7',ch:'wall',kind:'phone',title:'화보 컷 아이폰 17 배경화면으로 키움',author:'demo:a7',ago:200,up:15,views:260,tries:12,generator:'chatgpt',
  body:'본인 사진으로 만든 화보 컷을 고화질로 키워 아이폰 17 해상도에 맞췄어요.',prompt:'내 사진을 잡지 화보 느낌으로, 부드러운 자연광, 단색 배경.',
  recipe:recipe('chatgpt','내 사진을 잡지 화보 느낌으로, 부드러운 자연광, 단색 배경.',[['upscale',{scale:2,engine:'ai'}],['fit',{preset:'wall.iphone17'}],['export']],{w:1206,h:2622}),
  images:[{w:300,h:650,color:'#8e7dbe',bg:'#efe6f6'}]},
 {id:'demo-aic-8',ch:'howto',kind:'question',title:'챗GPT 캐릭터 시트 배경 회색 남는 문제',author:'demo:a3',anon:'61.74',ago:1500,up:17,views:402,
  body:'시트를 나누고 배경을 지워도 캐릭터 사이에 회색이 조금씩 남아요. 어떻게 하세요?',comments:[['demo:a2','프롬프트에 "완전한 흰 배경"을 넣고, 배경 지우기에서 가장자리 다듬기를 켜 보세요',9]]},
 {id:'demo-aic-9',ch:'free',kind:'free',title:'요즘 다들 뭐로 만드세요? 제미나이 vs 챗GPT',author:'demo:a6',anon:'175.223',ago:540,up:14,views:260,
  body:'스티커는 제미나이, 프사는 챗GPT가 나은 것 같아요.'},
 {id:'demo-aic-10',ch:'notice',kind:'notice',title:'Nerulio가 AI 창작 커뮤니티로 바뀌었어요',author:'demo:a8',ago:3*DAY/MIN,up:52,views:920,pinned:true,
  body:'AI로 만든 이미지를 다듬고 그 방법(레시피)을 나누는 곳이에요. 전연령만, 실존 인물은 본인 사진만 올려 주세요.'},
];

/** @param {any} db @param {number} now @param {{bucket?:any}} [o] */
export async function insertAiDemo(db,now,o={}){
 await db.batch([...USERS.map(([id,name],i)=>db.prepare(`INSERT OR IGNORE INTO users (id,email,display_name,provider,provider_subject,created_at) VALUES (?,NULL,?,'demo',?,?)`).bind(id,name,id,now-200*DAY+i*DAY)),
  ...USERS.map(([id,name])=>db.prepare(`INSERT OR IGNORE INTO user_profiles (user_id,display_name,role,created_at,updated_at) VALUES (?,?,?,?,?)`).bind(id,name,id==='demo:a8'?'moderator':'user',now-100*DAY,now))]);
 const list=[...POSTS].sort((a,b)=>b.ago-a.ago);
 let images=0;
 for(const p of list){
  const created=now-p.ago*MIN;
  // Images first (uploads rows, bytes in the bucket when there is one), then the post that shows them.
  const refs=[];
  for(const [i,im] of (p.images||[]).entries()){
   const bytes=character(im.w,im.h,{color:im.color,bg:im.bg||null,mood:im.mood,pixel:im.pixel});
   const id=createHash('sha256').update(`${p.id}:${i}`).digest('hex').slice(0,24),key=`c/${id}.png`;
   if(o.bucket)await o.bucket.put(key,bytes,{httpMetadata:{contentType:'image/png'}});
   await db.prepare("INSERT OR IGNORE INTO uploads (id,user_id,purpose,r2_key,mime,bytes,width,height,status,created_at,owner,sha256,attached_kind,attached_id) VALUES (?,?,'community',?,'image/png',?,?,?,'active',?,?,?,'discussion',?)")
    .bind(id,p.anon?'anon':p.author,key,bytes.length,im.w,im.h,created,`u:${p.author}`,createHash('sha256').update(bytes).digest('hex'),p.id).run();
   refs.push(`![${im.source?'원본':'이미지'}](/u/${id}/full.png)`);images++;
  }
  const body=refs.length?`${p.body}\n\n${refs.join('\n')}`:p.body;
  const anon=p.anon?{name:USERS.find(u=>u[0]===p.author)?.[1]||'ㅇㅇ',id:p.anon,net:'demo',pw:'demo'}:null;
  await createPost(db,{id:p.id,channel:p.ch,kind:p.kind,tags:[],title:p.title,body,locale:'ko',authorId:anon?'anon':p.author,hasImage:refs.length>0,anon,
   ai:p.recipe||p.generator||p.remixOf||refs.length?{recipeJson:p.recipe?JSON.stringify(p.recipe):null,remixOf:p.remixOf||null,generator:p.generator||null,prompt:p.prompt||null,generated:!!(p.recipe||p.generator),consentAt:refs.length?created:null}:null},created);
  const cs=p.comments||[];
  await db.batch([db.prepare('UPDATE discussions SET up_count=?,view_count=?,comment_count=?,pinned=?,best_at=?,try_count=? WHERE id=?').bind(p.up,p.views,cs.length,p.pinned?1:0,p.best||p.up>=30?created+HOUR:null,p.tries||0,p.id),
   ...cs.map(([a,text,up,parent],i)=>db.prepare('INSERT INTO comments (id,discussion_id,parent_id,author_id,body_md,up_count,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind(`${p.id}-c${i}`,p.id,parent!==undefined?`${p.id}-c${parent-1}`:null,a,text,up,created+(i+1)*3*MIN,created+(i+1)*3*MIN)),
   // This week's tries, spread over the last days (이번 주 유행).
   ...(p.tries?[0,1,2,3].map(d=>db.prepare('INSERT OR REPLACE INTO recipe_try_days (discussion_id,day,n) VALUES (?,?,?)').bind(p.id,new Date(now+9*HOUR-d*DAY).toISOString().slice(0,10),Math.max(1,Math.round((p.tries||0)/(d+3))))):[])]);
 }
 return {posts:list.length,images};
}
