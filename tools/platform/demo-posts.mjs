/** Sample board content for local previews and renderer tests ONLY — never imported by the Worker or
 * the build, never written to production D1. Facts on the pages still come from the real seed data;
 * these rows only fill the boards so the layout can be judged. Every demo user id starts with
 * "demo:" and the preview banner says the posts are samples. */
import {createPost} from '../../platform/community.js';
import {defaultChannelOf,channelById} from '../../platform/channels.js';

const MIN=6e4,HOUR=36e5,DAY=864e5;
const USERS=[
 ['demo:u1','코드장인','trusted'],['demo:u2','정리왕','contributor'],['demo:u3','ㅇㅇ','new'],['demo:u4','헤비유저','new'],['demo:u5','대학원생','new'],
 ['demo:u6','운영C','curator'],['demo:u7','입문','new'],['demo:u8','덱유저','new'],['demo:u9','로그라이커','trusted'],['demo:u10','패치제작자','maintainer'],
 ['demo:u11','측정러','trusted'],['demo:u12','AI그림','contributor'],['demo:u13','고민중','new'],['demo:u14','비트메이커','contributor'],['demo:u15','원작러','new'],['demo:u16','굿즈헌터','contributor'],
];
/** [tag entity id (or a channel id for an untagged post), 말머리, title, body, author, minutes ago, up, down, views, comments?, opts]
 * opts.tags: more tags (up to 3 in all); opts.channel: a channel other than the tag's default one. */
const POSTS=[
 ['service:claude','question','지금 API만 느린 거 맞죠? 앱은 멀쩡한데','콘솔에서 호출하면 응답이 평소보다 늦게 옵니다. 앱은 괜찮아요.','demo:u3',9,3,0,640],
 ['service:claude','news','Claude Opus 5.5 출시 — API $4 / $20, 1M 컨텍스트','공식 모델·가격 문서 기준으로 레이더봇이 올린 소식입니다.','system:radar-bot',6*DAY/MIN,31,2,5100],
 ['service:claude','free','Opus 5.5로 한 달 논문 정리한 후기','1M 컨텍스트라 논문 여러 편을 한 번에 넣고 비교시키는 게 편했습니다.\n\n- 표 정리는 거의 손 안 댐\n- 인용 확인은 여전히 직접','demo:u5',70,47,2,3600,[['demo:u1','비교 프롬프트 공유 가능할까요?',8],['demo:u5','본문 아래에 붙여둘게요',3,1]]],
 ['service:claude','guide','프로젝트에 파일 올릴 때 이렇게 나누면 답이 좋아짐','파일을 주제별로 나누고 파일 이름에 날짜를 붙이면 최신 자료를 먼저 참고합니다.','demo:u2',160,88,3,4400,[],{best:true}],
 ['service:claude','question','Max 오늘 한도 빨리 차는 사람?','체감상 오후에 빨리 찹니다. 다들 어떠신가요?','demo:u4',132,21,4,2800],
 ['service:claude','question','Sonnet이랑 Opus 코딩 체감 차이 큼?','작은 스크립트는 차이를 모르겠는데 리팩터링은 어떤가요?','demo:u7',230,8,0,2500],
 ['service:claude','guide','Claude Code로 레거시 PHP 리팩터링 해봄 (길음)','테스트부터 만들게 하고 나서 단계별로 바꾸니 안전했습니다.','demo:u1',250,52,1,3000],
 ['service:claude','question','한국 카드로 Pro 결제하면 부가세 포함임?','결제 화면에서 세금이 따로 붙는지 궁금합니다.','demo:u3',300,2,0,980],
 ['service:claude','notice','[정리] 요금제·한도는 공식 문서에 적힌 것만 모읍니다','채널 위키의 요금제 표는 공식 요금 페이지 기준입니다. 체감 한도는 글로 남겨 주세요.','demo:u6',3*DAY/MIN,140,2,12000,[],{pinned:true}],
 ['service:claude','free','Claude Code 새 버전 한국어 입력 좋아졌네요','터미널에서 한글 조합이 끊기던 게 없어졌어요.','demo:u1',55,12,0,900],
 ['service:claude','question','API 키 조직 권한 설정 어디서 함?','Console에서 찾기가 어렵네요.','demo:u7',420,1,0,410],
 ['game:steam-333640','report','최신 버전 + 한글패치 Steam Deck에서 정상 작동','덱에서 새 버전 받고 패치 다시 적용했는데 대사, 메뉴 모두 정상입니다.','demo:u8',40,4,0,311],
 ['game:steam-333640','question','업뎃 뜨면 패치 다시 깔아야 됨?','Steam이 파일을 덮어쓰면 다시 깔아야 하나요?','demo:u3',44,1,0,205,[['demo:u10','네, 게임 파일이 바뀌면 다시 적용해 주세요.',12]]],
 ['game:steam-333640','patch','패치 제작자: 다음 버전에서 메뉴 폰트 수정 예정','메뉴 폰트 테이블이 바뀌어 일부 글자가 깨질 수 있습니다. 대사에는 영향이 없습니다.','demo:u10',65,88,1,2400,[],{best:true}],
 ['game:steam-333640','guide','초반 생존 빌드 다시 정리 (최신 버전 기준)','돌연변이 선택부터 첫 마을까지의 순서를 정리했습니다.','demo:u9',150,57,2,3200],
 ['game:steam-333640','free','이 게임 한글로 하니까 완전 다른 게임 같음','텍스트 양이 많아서 패치 없이는 힘들었어요.','demo:u9',200,6,0,530],
 ['gpu:rtx-5070','benchmark','5070 vs 4070 SUPER — 14B Q4 토큰/초 비교 (표)','llama.cpp, 8K 컨텍스트, 같은 프롬프트로 세 번씩 재서 중앙값만 적었습니다.','demo:u11',80,142,3,6100,[],{best:true}],
 ['gpu:rtx-5070','question','12GB로 코딩 모델 뭐가 제일 쓸만함?','로컬에서 자동완성 용도로 쓰려고 합니다.','demo:u7',38,9,0,1400],
 ['gpu:rtx-5070','report','새 드라이버 후 ComfyUI 첫 실행 크래시 → 재부팅으로 해결','드라이버 설치 직후 한 번만 그랬습니다.','demo:u12',45,12,0,820],
 ['gpu:rtx-5070','question','5070 vs 5060 Ti 16GB, 로컬 LLM이면?','VRAM이 더 중요한지 속도가 더 중요한지 고민입니다.','demo:u13',99,11,1,2900],
 ['app:ableton-live','question','macOS 새 버전 올려도 Live 괜찮나요?','공연 앞두고 있어서 조심스럽네요.','demo:u14',30,6,0,700],
 ['app:ableton-live','guide','Live 12 오디오 인터페이스 버퍼 설정 정리','녹음할 때와 믹스할 때 버퍼를 다르게 두는 법.','demo:u14',400,31,0,2100],
 ['work:bleach-tybw-the-calamity','free','다음 화 예고 보고 온 사람','작화 기대됩니다.','demo:u15',25,57,1,2400],
 ['work:bleach-tybw-the-calamity','question','원작 몇 권부터 이번 내용임?','애니만 봐서 궁금합니다.','demo:u7',90,6,0,1800],
 ['work:bleach-tybw-the-calamity','news','굿즈 예약 일정 공식 공지 모음','공식 공지 링크만 모았습니다.','demo:u16',300,44,0,3300],
 ['service:claude','review','Claude로 5070 로컬 모델이랑 비교해 본 사용기','같은 요약 작업을 클라우드와 로컬(14B)로 돌려 비교했어요.','demo:u11',140,18,0,1300,[],{tags:['gpu:rtx-5070']}],
 ['gpu:rtx-5070','buy','150만 원 견적 봐주세요 (로컬 LLM + 게임)','5070 기준으로 파워 750W면 충분할까요?','demo:u13',75,5,0,640,[['demo:u11','750W 골드면 충분해요.',4]]],
 ['work:bleach-tybw-the-calamity','event','팝업스토어 입장 예약 열렸어요','공식 공지 링크: 예약은 선착순입니다.','demo:u16',120,14,0,900],
 ['free','free','요즘 다들 점심 뭐 드세요','회사 근처가 다 비싸졌네요.','demo:u7',35,3,0,210],
 ['free','question','모니터 암 추천 있나요?','27인치 두 대 올릴 예정입니다.','demo:u13',260,2,0,330],
 ['notice','feedback','[건의] 모바일에서 채널 바 고정 순서 바꾸기','전체 채널 시트에서 순서를 바꿀 수 있으면 좋겠어요.','demo:u2',180,9,0,400],
];

/** @param {any} db D1 binding @param {number} now */
export async function insertDemoContent(db,now){
 const stmts=USERS.map(([id,name,tier],i)=>db.prepare(`INSERT OR IGNORE INTO users (id,email,display_name,provider,provider_subject,created_at) VALUES (?,NULL,?,'demo',?,?)`).bind(id,name,id,now-400*DAY+i*DAY));
 stmts.push(...USERS.map(([id,name,tier])=>db.prepare(`INSERT OR IGNORE INTO user_profiles (user_id,display_name,tier,created_at,updated_at) VALUES (?,?,?,?,?)`).bind(id,name,tier,now-300*DAY,now)));
 await db.batch(stmts);
 const exists=async(/** @type {string} */ id)=>!!(await db.prepare('SELECT 1 FROM entities WHERE id=?').bind(id).first());
 let n=0,c=0;
 // Oldest first so post numbers grow with time.
 const list=[...POSTS].sort((a,b)=>Number(b[5])-Number(a[5]));
 for(const [entity,kind,title,body,author,ago,up,down,views,comments=[],opts={}] of list){
  const o=/** @type {{tags?:string[],channel?:string,pinned?:boolean,best?:boolean}} */(opts);
  let channel=channelById(String(entity))?.id||null,tags=/** @type {string[]} */([]);
  if(!channel){
   const e=await db.prepare('SELECT vertical,type FROM entities WHERE id=?').bind(String(entity)).first();
   if(!e)continue;
   const facts=(await db.prepare("SELECT property,value FROM facts WHERE entity_id=? AND property='media_type' AND is_current=1").bind(String(entity)).all()).results.map((/** @type {any} */ f)=>({property:f.property,value:JSON.parse(f.value)}));
   channel=o.channel||defaultChannelOf({vertical:String(e.vertical),type:String(e.type)},facts);
   tags=[String(entity)];
  }
  for(const t of o.tags||[])if(await exists(t))tags.push(t);
  const created=now-Number(ago)*MIN,id=`demo-${++n}`;
  await createPost(db,{id,channel,kind:String(kind),tags,title:String(title),body:String(body),locale:'ko',authorId:String(author)},created);
  const cs=/** @type {any[]} */(comments);
  await db.batch([db.prepare('UPDATE discussions SET up_count=?,down_count=?,view_count=?,comment_count=?,pinned=?,best_at=? WHERE id=?').bind(up,down,views,cs.length,o.pinned?1:0,o.best?created+HOUR:null,id),
   ...cs.map(([a,text,cup,parent],i)=>db.prepare('INSERT INTO comments (id,discussion_id,parent_id,author_id,body_md,up_count,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind(`${id}-c${i}`,id,parent!==undefined?`${id}-c${parent-1}`:null,a,text,cup,created+(i+1)*5*MIN,created+(i+1)*5*MIN))]);
  c+=cs.length;
 }
 // Sample "is it down?" clicks on Claude: a quiet week and a few clicks in the last hours — below the spike
 // rule (SPIKE: 5 people in an hour), so previews show "리포트 N건", never a made-up 급증.
 if(await exists('service:claude')){
  const sym=['slow','error','slow','down','limit'],rows=[];
  for(let i=0;i<40;i++)rows.push(now-DAY-(i*4.1*HOUR)%(6*DAY));
  for(let i=0;i<4;i++)rows.push(now-(i*37)*MIN);
  await db.batch(rows.map((at,i)=>db.prepare("INSERT INTO community_reports (id,kind,entity_id,env,result,user_id,created_at,updated_at) VALUES (?,'issue','service:claude',?,'broken',?,?,?)").bind(`demo-issue-${i}`,JSON.stringify({symptom:sym[i%sym.length]}),USERS[i%USERS.length][0],at,at)));
 }
 return {posts:n,comments:c};
}
