// @ts-check
/** 게시판 운영정책 (/{l}/community/policy): what may be posted, how 신고 → 임시조치 → 처리 works,
 * how 념글 and verification are decided, and what Nerulio never hosts. Linked from the write form,
 * the 신고 form and every footer. Plain rules, no legal advice. */
import {html} from './html.js';
import {page} from './ui.js';
import {BEST_RULE,VERIFY_RULE} from '../community.js';

/** @param {{l:string,channels?:{name:string,href:string}[]}} o @param {{origin:string}} site */
export function renderPolicy(o,site){
 const {l}=o,ko=l==='ko',base=`/${l}/community/policy`;
 const sec=(/** @type {string} */ id,/** @type {string} */ title,/** @type {unknown} */ body)=>html`<section class="box" id="${id}"><div class="bh"><h2>${title}</h2></div><div class="pad pol">${body}</div></section>`;
 const body=ko?html`<div class="narrow"><section class="box"><div class="bh"><h1 class="wt">게시판 운영정책</h1></div><p class="pad desc">Nerulio 채널은 공식 정보(위키 박스)와 커뮤니티(게시판)를 한곳에 둡니다. 아래 규칙은 모든 채널에 똑같이 적용되고, 바뀌면 이 페이지에 날짜와 함께 남깁니다.</p></section>
${sec('rules','올리면 안 되는 것',html`<ul><li>욕설·혐오·특정인 공격, 개인정보(연락처·주소·실명 추정) 공개</li><li>도배·광고·홍보 목적의 반복 글, 대가를 받은 글을 알리지 않는 것</li><li>불법 파일, 저작권 침해물, <b>한글패치·유료 소프트웨어 파일 자체</b>의 업로드나 직접 배포 링크 (Nerulio는 패치 제작자의 배포처만 안내합니다)</li><li>청소년에게 유해한 내용, 불법 촬영물</li><li>공식 정보인 것처럼 꾸민 추측 (공식 수치는 출처와 함께 위키에만 기록됩니다)</li></ul>`)}
${sec('report','신고와 임시조치',html`<ol><li>글·댓글의 “신고”로 사유를 골라 접수합니다. 같은 사람이 같은 대상을 여러 번 신고해도 한 건으로 셉니다.</li><li>권리 침해(저작권·명예훼손 등) 신고는 운영자가 확인한 뒤 먼저 <b>임시조치</b>(글을 가리고 보관)하고 게시자에게 알립니다.</li><li>게시자가 소명하면 다시 검토해 <b>복구</b>하거나 유지합니다. 문제가 없으면 신고는 <b>기각</b>됩니다.</li><li>모든 처리는 사유와 함께 기록되고, 월별 합계는 <a href="/ko/community/transparency">운영 투명성</a>에 공개합니다.</li><li>반복 위반 계정은 기간을 정해 글쓰기가 제한될 수 있습니다.</li></ol>`)}
${sec('best','념글과 검증은 이렇게 정해집니다',html`<ul><li><b>★ 념글</b>: 24시간 안에 추천 비율 ${BEST_RULE.minRatio*100}% 이상이면서, 추천 수가 그 채널 최근 7일 글의 상위 10% 수준(최소 ${BEST_RULE.floor}, 최대 ${BEST_RULE.cap}, 글이 적은 채널은 ${BEST_RULE.minUp}) 이상일 때.</li><li><b>● 커뮤니티 검증</b>(호환 리포트): 서로 다른 ${VERIFY_RULE.minUsers}명 이상이 같은 버전 조합을 확인하고, 반대 리포트가 적으며, 기여 이력이 있는 사용자가 포함될 때. 한 사람의 리포트는 최신 1건만 셉니다.</li><li>커뮤니티 리포트는 공식 정보를 덮어쓰지 않습니다. 추정값은 항상 “≈ 추정”으로 표시하고 방법을 공개합니다.</li></ul>`)}
${sec('names','닉네임과 개인정보',html`<ul><li>글과 댓글에는 닉네임만 보입니다. 로그인한 Google 계정 이름·이메일은 공개되지 않습니다.</li><li>이미지 업로드는 현재 받지 않습니다.</li></ul>`)}</div>`
 :html`<div class="narrow"><section class="box"><div class="bh"><h1 class="wt">Community rules</h1></div><p class="pad desc">The same rules apply in every channel; changes are dated on this page.</p></section>
${sec('rules','Not allowed',html`<ul><li>Abuse, hate, harassment, sharing personal information</li><li>Spam, repeated promotion, undisclosed paid posts</li><li>Illegal or infringing files, including uploading or directly linking translation patches or paid software (Nerulio links to the author only)</li><li>Content harmful to minors</li><li>Guesses presented as official facts</li></ul>`)}
${sec('report','Reports and takedowns',html`<ol><li>Report a post or comment with a reason; repeats from one person count once.</li><li>Rights claims are hidden first (kept, not shown) and the author is notified.</li><li>After review the content is restored or stays hidden; unfounded reports are dismissed.</li><li>Every action is logged with its reason; monthly totals are on the <a href="/en/community/transparency">transparency page</a>.</li></ol>`)}
${sec('best','How best posts and verification work',html`<ul><li><b>★ Best</b>: within 24 hours, ${BEST_RULE.minRatio*100}%+ upvote ratio and upvotes at the channel's top-10 % level of the last 7 days (min ${BEST_RULE.floor}, max ${BEST_RULE.cap}).</li><li><b>● Community verified</b>: ${VERIFY_RULE.minUsers}+ different people confirm the same version combination with few contradictions; only each person's latest report counts.</li></ul>`)}</div>`;
 return page({l,title:ko?'게시판 운영정책 | Nerulio':'Community rules | Nerulio',description:ko?'Nerulio 게시판에서 올리면 안 되는 것, 신고와 임시조치, 념글과 검증 기준.':'What is not allowed, reports and takedowns, best posts and verification.',canonical:site.origin+base,channels:o.channels||[],body});
}
