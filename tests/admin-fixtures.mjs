// Fixtures for the admin app, shaped exactly like ADMIN-CONTRACT.md (test-only; never shipped).
// Values follow the approved mockup (preview D1, 2026-09-29) so screenshots read like the real app.
const M=6e4,H=36e5,D=864e5;
/** @param {number} now */
export function fixtures(now=Date.now()){
 const c=(id,vertical,schedule,state,extra={})=>({id,vertical,mode:schedule==='manual'?'manual':'auto',freshnessHours:schedule==='30m'?2:24,schedule,last_success_at:null,last_error:null,last_run_at:null,observations:null,changes:null,rows_written:null,next_run_at:schedule==='manual'?null:now+(schedule==='30m'?6*M:6*H-7*M),state,...extra});
 const ok=(id,vertical,schedule,ago,obs,ch,rows)=>c(id,vertical,schedule,'ok',{last_success_at:now-ago,last_run_at:now-ago,observations:obs,changes:ch,rows_written:rows});
 const collectors=[
  c('steam-news','games','6h','failing',{last_run_at:now-34*M,last_error:"ingest: Error: D1 REST: Your account has exceeded D1's free tier daily row write limit. Upgrade to a paid plan or wait until tomorrow (midnight UTC) for the limit to reset.",consecutive_failures:1}),
  c('steam-news-subculture','subculture','6h','never'),
  c('steam-store','games','6h','never',{freshnessHours:168}),
  c('studio-compat-kb-watch','studio','6h','never'),
  c('studio-github-releases','studio','6h','never'),
  ok('claude-status','ai','30m',51*M,12,47,190),
  ok('openai-status','ai','30m',42*M,9,29,120),
  ok('anilist-schedule','subculture','6h',55*M,46,95,410),
  ok('nvidia-datacenter-drivers','hardware','6h',47*M,20,179,760),
  ok('claude-release-notes','ai','6h',52*M,31,113,380),
  ok('openai-api-changelog','ai','6h',43*M,22,64,250),
  ok('gemini-api-changelog','ai','6h',49*M,18,47,160),
  ok('blender-releases','studio','6h',53*M,8,11,40),
  ok('github-releases','ai','6h',48*M,40,6,30),
  ok('reaper-whatsnew','studio','6h',41*M,3,2,12),
  ...['ai-plans-manual','gpu-specs-manual','studio-vendor-manual','subculture-figure-preorders','subculture-kr-collabs','subculture-official-news'].map(id=>c(id,id.startsWith('ai')?'ai':id.startsWith('gpu')?'hardware':id.startsWith('studio')?'studio':'subculture','manual','manual')),
 ];
 const count=s=>collectors.filter(x=>x.state===s).length;
 // Workers Paid (coordinator 2026-09-29): month-to-date vs the monthly included amount.
 const days=Array.from({length:14},(_,i)=>({day:new Date(now-(13-i)*D).toISOString().slice(0,10),rowsRead:900000+i*41000,rowsWritten:i===7?107000:180000+(i%4)*52000}));
 const usage={plan:'paid',period:'month',today:{rowsRead:1380000,rowsWritten:212400},month:{rowsRead:38400000,rowsWritten:6120000},included:{rowsReadMonth:25000000000,rowsWrittenMonth:50000000},limit:{rowsRead:25000000000,rowsWritten:50000000},days};
 const usageDaily={today:{rowsRead:38400,rowsWritten:1240},limit:{rowsRead:5000000,rowsWritten:100000},days:days.slice(-2).map(d=>({...d,rowsWritten:Math.min(d.rowsWritten,107000)}))};
 const traffic={humanPageviews:1834,botRequests:5210,aiBotRequests:1488,topBot:{name:'Googlebot',category:'search',requests:1622}};
 const overview={generatedAt:now,collectors:{ok:count('ok'),failing:count('failing'),stale:count('stale'),manual:count('manual'),never:count('never'),items:collectors.filter(x=>['failing','never','stale'].includes(x.state))},
  usage,radar:{today:381,importance2plus:29,conflicts:3},flags:{open:2},community:{postsToday:0,commentsToday:0,newUsersToday:0},
  status:[{service:'Claude',state:'operational',since:now-51*M,url:'https://status.claude.com'},{service:'OpenAI · ChatGPT',state:'degraded',since:now-42*M,url:'https://status.openai.com'}],
  graph:{entities:1600,facts:6559,events:409},traffic};
 const runs={'steam-news':{items:[]},'claude-status':{items:Array.from({length:6},(_,i)=>({started_at:now-51*M-i*30*M,finished_at:now-51*M-i*30*M+7600,error:i===3?'fetch https://status.claude.com/api/v2/summary.json: HTTP 503':null,observations:12,changes:i?0:47,rows_written:i?4:190,queries:31}))}};
 const radar={generatedAt:now,counts:{changes:381},next:'cursor-2',
  conflicts:[
   {id:101,entity:'리퍼',vertical:'studio',property:'최신 버전',current:{value:'7.80',verification:'OFFICIAL'},proposed:{value:'7.81',verification:'AUTOMATED',source:'reaper-whatsnew'}},
   {id:102,entity:'도쿄 리벤저스 삼천전쟁',vertical:'subculture',property:'방영일',current:{value:'2026-10-02',verification:'OFFICIAL'},proposed:{value:'2026-10-03',verification:'COMMUNITY_VERIFIED',source:'anilist-schedule'},note:'하루 차이: 일본 시간(JST)과 UTC 기준 차이일 수 있습니다.'},
   {id:103,entity:'란마 1/2 (2024) 3기',vertical:'subculture',property:'방영일',current:{value:'2026-10-03',verification:'OFFICIAL'},proposed:{value:'2026-10-04',verification:'AUTOMATED',source:'anilist-schedule'}}],
  proposals:[{id:'prop1',vertical:'hardware',channel:'RTX 5070',property:'전력(TGP)',value:245,unit:'W',current:{value:250,unit:'W',verification:'OFFICIAL'},source:'https://example.com/rtx-5070-spec',author:'회원A',at:now-3*H,note:'제조사 표 기준'}],
  changes:[
   {id:9001,vertical:'studio',kind:'version_released',text:'리퍼 7.81 출시',importance:2,detected_at:now-41*M,adapter:'reaper-whatsnew'},
   {id:9002,vertical:'ai',kind:'event_changed',text:'OpenAI API 일정 변경',importance:2,detected_at:now-44*M,adapter:'openai-api-changelog'},
   {id:9003,vertical:'ai',kind:'version_released',text:'llama.cpp b11236–b11240',importance:2,detected_at:now-48*M,adapter:'github-releases',count:5},
   {id:9004,vertical:'ai',kind:'event_changed',text:'Gemini API 일정 변경',importance:2,detected_at:now-49*M,adapter:'gemini-api-changelog',count:3,note:'같은 값이 3번 기록됨 · 중복 확인'},
   {id:9005,vertical:'subculture',kind:'event_announced',text:'원피스 1181화 방영',importance:1,detected_at:now-56*M,adapter:'anilist-schedule'}]};
 const radar2={changes:[{id:8990,vertical:'hardware',kind:'fact_changed',text:'RTX 5070 드라이버 580.95',importance:1,detected_at:now-2*H,adapter:'nvidia-datacenter-drivers'}],next:null};
 const day=d=>new Date(now-d*D).toISOString().slice(0,10);
 const community={generatedAt:now,tiles:{posts:42,comments:318,users:9,flags:2},spark:[18,22,25,21,30,33,42].map((p,i)=>({day:day(6-i),posts:p,comments:p*7})),
  channels:[{entity_id:'ai:claude',name:'클로드',vertical:'ai',posts:12,comments:96},{entity_id:'subculture:one-piece',name:'원피스',vertical:'subculture',posts:6,comments:58},{entity_id:'hardware:rtx-5070',name:'RTX 5070',vertical:'hardware',posts:7,comments:41}],
  verticals:[{vertical:'ai',posts:17},{vertical:'subculture',posts:9},{vertical:'hardware',posts:8},{vertical:'studio',posts:5},{vertical:'games',posts:3}],
  newUsers:[{name:'노을빛고양이',created_at:now-22*M,posts:1,comments:3},{name:'로컬LLM초보',created_at:now-37*M,posts:0,comments:1}]};
 const hours=Array.from({length:24},(_,i)=>({t:now-(23-i)*H,human:Math.round(40+60*Math.sin(i/24*Math.PI)**2+(i%5)*4),bot:Math.round(150+80*((i*7)%5)/5)}));
 const trafficFull={range:'today',generatedAt:now,totals:{human:2210,verifiedBot:3120,declaredBot:1540,suspectedBot:550},humans:{pageviews:1834,visitors:612},
  bots:[{name:'Googlebot',category:'search',verified:true,requests:1622},{name:'GPTBot',category:'ai',verified:true,requests:804},{name:'ClaudeBot',category:'ai',verified:true,requests:412},{name:'bingbot',category:'search',verified:true,requests:390},{name:'AhrefsBot',category:'seo',verified:false,requests:388},{name:'PerplexityBot',category:'ai',verified:false,requests:272},{name:'facebookexternalhit',category:'social',verified:true,requests:96},{name:'UptimeRobot',category:'monitor',verified:false,requests:60},{name:'python-requests',category:'library',verified:false,requests:520},{name:'(이름 없음)',category:'other',verified:false,requests:646}],
  topPages:{human:[{path:'/ko/ai/claude/',n:402},{path:'/ko/',n:310},{path:'/ko/image/upscale/',n:188},{path:'/ko/radar/',n:120}],bot:[{path:'/sitemap.xml',n:880},{path:'/ko/ai/claude/',n:522},{path:'/robots.txt',n:410},{path:'/en/games/caves-of-qud/',n:260}]},
  series:hours,coverage:{workerSeesHtml:false,note:'도구 페이지(정적 HTML)는 Worker를 거치지 않아 봇 요청이 빠집니다. 사람 수는 페이지 안 비콘으로 셉니다.'}};
 const modQueue={items:[
  {target:'discussion:d1',reasons:['spam','other'],count:3,firstAt:now-12*M,note:'카톡방 홍보',preview:'무료 API 크레딧 무제한 받는 법 (링크)',excerpt:'여기 가입하면 크레딧 계속 나옵니다 → bit.ly/… 카톡방도 있어요',status:'published',author:'user-ab12cd',authorId:'u-spam',url:'/ko/ai/claude/214'},
  {target:'comment:c9',reasons:['abuse'],count:1,firstAt:now-40*M,note:null,preview:'그 벤치 조작이잖아요. 올린 사람 제정신인가',excerpt:null,status:'published',author:'벤치러',authorId:'u-bench',url:'/ko/hardware/rtx-5070/88',context:'RTX 5070 실측 벤치'}],
  hidden:[],proposals:[],log:[{actor_id:'admin',action:'hide',target_kind:'comment',target_id:'c1',reason:'외부 홍보 링크',created_at:now-12*M,label:'광고 댓글'},{actor_id:'admin',action:'dismiss',target_kind:'discussion',target_id:'d0',reason:'정상 후기, 신고 사유 없음',created_at:now-D,label:'RTX 5070 후기'}]};
 return {collectors:{generatedAt:now,items:collectors},overview,usage,usageDaily,runs,radar,radar2,community,traffic:trafficFull,modQueue,prefs:{collectorFailN:2,statusStale:true,usageThresholds:[80,95],flags:'hourly',aiIncident:true,proposals:false,newUsers:true,quiet:{from:'23:00',to:'07:00'}}};
}
