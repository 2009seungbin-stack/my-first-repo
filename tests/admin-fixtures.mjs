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
 const usage={plan:'paid',period:'month',resetAt:Date.UTC(new Date(now).getUTCFullYear(),new Date(now).getUTCMonth()+1,1),databases:2,today:{rowsRead:1380000,rowsWritten:212400},month:{rowsRead:38400000,rowsWritten:6120000},included:{rowsReadMonth:25000000000,rowsWrittenMonth:50000000},limit:{rowsRead:25000000000,rowsWritten:50000000},days};
 const usageDaily={today:{rowsRead:38400,rowsWritten:1240},limit:{rowsRead:5000000,rowsWritten:100000},days:days.slice(-2).map(d=>({...d,rowsWritten:Math.min(d.rowsWritten,107000)}))};
 const traffic={humanPageviews:1834,botRequests:5210,aiBotRequests:1488,topBot:{name:'Googlebot',category:'search',verified:true,requests:1622}};
 const overview={generatedAt:now,collectors:{ok:count('ok'),failing:count('failing'),stale:count('stale'),manual:count('manual'),never:count('never'),items:collectors.filter(x=>['failing','never','stale'].includes(x.state))},
  usage,radar:{today:381,importance2plus:29,conflicts:3},flags:{open:2},community:{postsToday:0,commentsToday:0,newUsersToday:0},
  status:[{service:'Claude',adapter:'claude-status',state:'ok',since:now-51*M,checkedAt:now-51*M,url:'https://status.claude.com/'},{service:'OpenAI',adapter:'openai-status',state:'stale',since:now-2.5*H,checkedAt:now-2.5*H,url:'https://status.openai.com/'}],
  graph:{entities:1600,facts:6559,events:409},traffic};
 const runs={'steam-news':{items:[]},'claude-status':{items:Array.from({length:6},(_,i)=>({id:600-i,started_at:now-51*M-i*30*M,finished_at:now-51*M-i*30*M+7600,status:i===3?'error':'ok',error:i===3?'fetch https://status.claude.com/api/v2/summary.json: HTTP 503':null,observations:12,changes:i?0:47,rows_written:i?4:190,queries:31}))}};
 // server/platform/admin.js radar(): changes carry title/detail (describeChange, Korean), channel + url.
 const ch=(id,vertical,channel,slug,title,detail,importance,ago,source,extra={})=>({id,entity_id:`${vertical}:${slug}`,channel,vertical,url:`/ko/${vertical}/${slug}/`,kind:'version_released',property:null,title,detail,importance,visibility:'public',source,detected_at:now-ago,effective_at:now-ago,...extra});
 const radar={changes:[
   ch(9005,'studio','리퍼','reaper','리퍼 7.81 출시','',2,41*M,'src:reaper-whatsnew'),
   ch(9004,'ai','OpenAI API','openai-api','OpenAI API 일정 변경','시작 2026-05-05',2,44*M,'src:openai-api-changelog',{kind:'event_changed'}),
   ch(9003,'ai','llama.cpp','llama-cpp','llama.cpp b11240','b11236–b11240 5건',2,48*M,'src:github-releases'),
   ch(9002,'ai','Gemini API','gemini-api','Gemini API 일정 변경','같은 값이 3번 기록됨',2,49*M,'src:gemini-api-changelog',{kind:'event_changed',visibility:'pending'}),
   ch(9001,'subculture','원피스','one-piece','원피스 1181화 방영','',1,56*M,'src:anilist-schedule',{kind:'event_announced'})],
  conflicts:[
   {id:101,fact_id:5001,entity_id:'studio:reaper',channel:'리퍼',vertical:'studio',url:'/ko/studio/reaper/',property:'latest_version',label:'최신 버전',region:'*',current:{value:'7.80',unit:null,verification:'OFFICIAL',source:'src:reaper-site',isCurrent:true},proposed:{value:'7.81',verification:'AUTOMATED',source:'src:reaper-whatsnew',by:'collector:reaper-whatsnew'},created_at:now-41*M},
   {id:102,fact_id:5002,entity_id:'subculture:tokyo-revengers-3',channel:'도쿄 리벤저스 삼천전쟁',vertical:'subculture',url:'/ko/subculture/tokyo-revengers-3/',property:'air_date',label:'방영일',region:'*',current:{value:'2026-10-02',unit:null,verification:'OFFICIAL',source:'src:official',isCurrent:true},proposed:{value:'2026-10-03',verification:'COMMUNITY_VERIFIED',source:'src:anilist-schedule',by:'collector:anilist-schedule'},created_at:now-2*H},
   {id:103,fact_id:5003,entity_id:'subculture:ranma-3',channel:'란마 1/2 (2024) 3기',vertical:'subculture',url:'/ko/subculture/ranma-3/',property:'air_date',label:'방영일',region:'JP',current:{value:'2026-10-03',unit:null,verification:'OFFICIAL',source:null,isCurrent:true},proposed:{value:'2026-10-04',verification:'AUTOMATED',source:'src:anilist-schedule',by:'collector:anilist-schedule'},created_at:now-3*H}],
  proposals:[{id:'prop1',entity_id:'hardware:rtx-5070',channel:'RTX 5070',vertical:'hardware',url:'/ko/hardware/rtx-5070/',property:'tgp',label:'전력(TGP)',value:245,unit:'W',current:250,source:'https://example.com/rtx-5070-spec',note:'제조사 표 기준',author:'회원A',created_at:now-3*H}],
  next:9001};
 const radar2={changes:[ch(8990,'hardware','RTX 5070','rtx-5070','RTX 5070 드라이버 580.95','',1,2*H,'src:nvidia-datacenter-drivers')],conflicts:[],proposals:[],next:null};
 const day=d=>new Date(now-d*D).toISOString().slice(0,10);
 const community={generatedAt:now,tiles:{posts:42,comments:318,users:9,flags:2},spark:[18,22,25,21,30,33,42].map((p,i)=>({day:day(6-i),posts:p,comments:p*7})),
  channels:[{entity_id:'ai:claude',name:'클로드',vertical:'ai',posts:12,comments:96},{entity_id:'subculture:one-piece',name:'원피스',vertical:'subculture',posts:6,comments:58},{entity_id:'hardware:rtx-5070',name:'RTX 5070',vertical:'hardware',posts:7,comments:41}],
  verticals:[{vertical:'ai',posts:17},{vertical:'subculture',posts:9},{vertical:'hardware',posts:8},{vertical:'studio',posts:5},{vertical:'games',posts:3}],
  newUsers:[{name:'노을빛고양이',created_at:now-22*M,posts:1,comments:3},{name:'로컬LLM초보',created_at:now-37*M,posts:0,comments:1}]};
 const hours=Array.from({length:24},(_,i)=>({t:now-(23-i)*H,human:Math.round(40+60*Math.sin(i/24*Math.PI)**2+(i%5)*4),bot:Math.round(150+80*((i*7)%5)/5)}));
 // Shape of server/traffic.js mapTraffic (nerulio/traffic): GPTBot/ClaudeBot/Yeti are always "declared".
 const trafficFull={range:'today',generatedAt:new Date(now).toISOString(),totals:{human:2210,verifiedBot:2108,declaredBot:2552,suspectedBot:550},
  humans:{pageviews:1834,visitors:612,unconfirmed:37,sources:{search:820,direct:540,social:190,ai:122,internal:140,other:22},devices:{mobile:1210,desktop:560,tablet:64},browsers:{Chrome:1102,Safari:388,'Samsung Internet':201,Firefox:88,Edge:55},locales:{ko:1520,en:210,ja:66,other:38},countries:[{country:'KR',n:1502},{country:'US',n:160},{country:'JP',n:70},{country:'XX',n:12}]},
  bots:[{name:'Googlebot',category:'search',verified:true,requests:1622},{name:'GPTBot',category:'ai',verified:false,requests:804},{name:'ClaudeBot',category:'ai',verified:false,requests:412},{name:'bingbot',category:'search',verified:true,requests:390},{name:'AhrefsBot',category:'seo',verified:false,requests:388},{name:'PerplexityBot',category:'ai',verified:false,requests:272},{name:'facebookexternalhit',category:'social',verified:true,requests:96},{name:'Yeti',category:'search',verified:false,requests:60},{name:'python-requests',category:'library',verified:false,suspected:true,requests:420},{name:'Datacenter · Amazon',category:'other',verified:false,suspected:true,requests:130}],
  aiBotRequests:1488,
  topPages:{human:[{path:'/ko/ai/claude/',n:402},{path:'/ko/',n:310},{path:'/ko/image/upscale/',n:188},{path:'/ko/radar/',n:120}],bot:[{path:'/sitemap.xml',n:880},{path:'/ko/ai/claude/',n:522},{path:'/robots.txt',n:410},{path:'/en/games/caves-of-qud/',n:260}]},
  series:hours.map(x=>({...x,t:new Date(x.t).toISOString()})),
  coverage:{workerSeesHtml:false,note:'정적 HTML은 Worker를 거치지 않아 봇은 robots.txt·사이트맵·커뮤니티/채널 페이지에서만 보입니다. 사람은 비콘으로 모든 페이지에서 집계됩니다.',recording:true,seen:['beacon','robots.txt','sitemaps','platform pages'],unseen:['static HTML without JavaScript (bots on tool pages)','JS/CSS/images (assets)']}};
 const modQueue={items:[
  {target:'discussion:d1',reasons:['spam','other'],count:3,firstAt:now-12*M,note:'카톡방 홍보',preview:'무료 API 크레딧 무제한 받는 법 (링크)',excerpt:'여기 가입하면 크레딧 계속 나옵니다 → bit.ly/… 카톡방도 있어요',status:'published',author:'user-ab12cd',authorId:'u-spam',url:'/ko/ai/claude/214'},
  {target:'comment:c9',reasons:['abuse'],count:1,firstAt:now-40*M,note:null,preview:'그 벤치 조작이잖아요. 올린 사람 제정신인가',excerpt:null,status:'published',author:'벤치러',authorId:'u-bench',url:'/ko/hardware/rtx-5070/88',context:'RTX 5070 실측 벤치'}],
  hidden:[],proposals:[],log:[{actor_id:'admin',action:'hide',target_kind:'comment',target_id:'c1',reason:'외부 홍보 링크',created_at:now-12*M,label:'광고 댓글'},{actor_id:'admin',action:'dismiss',target_kind:'discussion',target_id:'d0',reason:'정상 후기, 신고 사유 없음',created_at:now-D,label:'RTX 5070 후기'}]};
 return {collectors:{generatedAt:now,items:collectors},overview,usage,usageDaily,runs,radar,radar2,community,traffic:trafficFull,modQueue,prefs:{collectorFailN:2,statusStale:true,usageThresholds:[80,95],flags:'hourly',aiIncident:true,proposals:false,newUsers:true,quiet:{from:'23:00',to:'07:00'}}};
}
