# Nerulio 2.0 SEO 감사 (서버 렌더 HTML 기준)

- 대상 브랜치: `claude/epic-heisenberg-ey2d3p`
- 방법: `tools/platform/preview.mjs`와 같은 방식으로 DB를 만들고(`D1Shim.migrated()` → `seedDatabase` → `insertDemoContent`, 기준 시각 2026-09-28 15:00 KST) `renderPlatformPage`로 페이지를 렌더했다. 다섯 버티컬의 `renderSitemap`도 렌더했다. 모든 판단은 **렌더된 HTML에서 실제로 본 것만** 근거로 한다.
  - 샘플 47개 URL(ko 38, en 9). 여기에는 필터·페이지 변형과 글 8개가 포함된다.
  - 엔티티 1,580개의 채널 페이지와 `/history` 페이지 전부, 서비스 13개의 `/status` 페이지를 렌더했다.
  - 사이트맵 URL 2,198개를 하나씩 렌더해 봤다.
  - `/ko/community/`에서 시작해 BFS로 내부 링크를 크롤했다(ko 3,660페이지 렌더, 발견 URL 20,297개).
- 한계: 게시판 글은 데모 데이터다. 상태 페이지의 "공식 상태 수집"처럼 운영 중에 수집기가 채우는 값은 시드 시점 상태로 보인다. 그래서 **데이터 상태에 따라 달라지는 문제**는 "이 상태일 때 어떻게 렌더되는가"로 기술했다.
- 기준 (구글 공식 문서와 업계 관행을 쓴다. 네이버 서치어드바이저의 권고는 "네이버"로 따로 표시한다)
  - title: 한글 약 30~35자를 넘으면 SERP에서 잘린다.
  - description: 한글 80~160자, 페이지마다 고유해야 한다.
  - h1: 1개.
  - canonical: 자기 자신을 가리키는 절대 URL.
  - 구조화 데이터: 선언한 @type의 필수 필드를 갖춰야 한다.

---

## 1. 요약 표

| # | 심각도 | 페이지 | 문제 | 제안 |
|---|---|---|---|---|
| 1 | high | 모든 페이지 | `og:image`, `og:type`, `og:locale`, `twitter:card`가 하나도 없다 | 페이지 유형별 OG 이미지(동적 카드 또는 버티컬 기본 이미지)와 `og:type`, `og:locale=ko_KR`, `twitter:card=summary_large_image`를 넣는다 |
| 2 | high | `/ko/ai/claude/`, `/ko/ai/claude/status`, `/ko/studio/ableton-live/` 등 ko 채널 전반 | 한국 사용자가 실제로 치는 검색어(“클로드”, “Ableton Live”)가 HTML 어디에도 없다. 시드에는 `aliases:["클로드"]`가 있지만 렌더되지 않는다 | title·description·h1 보조문구에 별칭을 1개 넣는다. 예: `지금 클로드(Claude) 장애?` |
| 3 | high | `/ko/hardware/?type=gpu&vs=a,b` | h1이 일반 문구다(“그래픽카드 VRAM·스펙 비교”). 본문의 97%가 전체 GPU 표와 같다. 색인 가능한 쌍 URL이 크롤로 285개 발견됐는데 사이트맵에는 11개뿐이다 | h1을 `RTX 4070 vs RTX 5070`으로 바꾼다. 쌍 페이지에서 전체 90행 표를 빼고 두 카드의 차이와 로컬 LLM 차이만 보여준다. 사이트맵에 없는 쌍은 noindex로 둔다 |
| 4 | high | `/ko/hardware/?type=gpu` | GPU 표의 meta description이 AI 가격표 문구다(“공식 가격 페이지 기준 요금·API 가격을 한 표로…”). 표 페이지 전부가 같은 description을 쓴다 | 표 유형별로 description을 따로 쓴다(GPU, 모델 API 가격, 요금제) |
| 5 | high | `/ko/ai/{service}/status` (13개) | 공식 상태를 수집하지 않았고 리포트가 0건이어도 색인된다(사이트맵에도 있다). h1이 상태에 따라 “ChatGPT: 공식 상태 확인 전”처럼 바뀌어 “장애”라는 단어가 빠진다. description이 “ChatGPT이(가)”로 조사를 제대로 처리하지 못한다 | h1은 `지금 {이름} 장애? — 실시간 상태`로 고정하고 상태는 h1 아래에 적는다. 조사를 제대로 처리한다. 데이터가 비었을 때의 색인 정책을 정한다 |
| 6 | medium | 사이트맵 전체 | AI 요금제·모델 가격표(`?type=plan`, `?type=model`), GPU 표, 레이더, 커뮤니티 홈, 변경 기록(색인 가능 931개), 글이 어느 사이트맵에도 없다. 허브 URL에는 lastmod가 없다 | 표·레이더·커뮤니티용 `sitemap-n2-pages.xml`을 추가하고, 글 사이트맵과 사이트맵 인덱스를 만든다 |
| 7 | medium | 채널(Product, SoftwareApplication, VideoGame), 질문 글(QAPage) | Product와 SoftwareApplication/VideoGame에 `offers`, `aggregateRating`, `review`가 없어 리치 결과 대상이 아니다(Search Console에서 오류로 잡힌다). 답이 없는 질문이 `"answerCount":0,"suggestedAnswer":[]`인 QAPage로 나간다. BreadcrumbList 2단계가 noindex 페이지(`/ko/radar/?v=ai`)를 가리킨다 | 가격 데이터가 있으면 `offers`를 넣고, 없으면 `about`의 타입을 Thing 계열로 낮춘다. 답이 0개인 질문은 DiscussionForumPosting으로 내보낸다. Breadcrumb은 화면처럼 허브(`/ko/ai/`)를 가리키게 한다 |
| 8 | medium | 채널 1,580개 | 채널마다 `?kind=`, `?sort=`, `?best=1` 조합 링크가 나간다. 크롤에서 noindex 필터 URL이 약 2만 개 발견됐다(크롤 트랩). 네이버 크롤 예산을 낭비한다 | 필터 탭에 `rel="nofollow"`를 달거나 조합 링크를 줄인다. robots.txt에서 조합 파라미터를 막는 방안도 검토한다 |
| 9 | medium | 변경 기록, 얇은 채널, 중복 제목 | 기록 페이지 931개가 색인되는데 대부분 “○○ 확인” 행이라 채널 정보와 겹친다. 넥슨게임즈처럼 본문이 220자인 채널도 색인된다. `블루 아카이브 채널` 제목이 게임과 서브컬처 두 곳에 똑같이 있고, `프로젝트 채널`도 Claude와 ChatGPT가 같은 제목이다(중복 제목 10그룹) | 기록 페이지는 “실제 변경(이전값→새값)” 행이 있을 때만 색인한다. 기능·중복 엔티티 제목에 상위 제품이나 유형을 붙인다 |
| 10 | medium | 허브, 내부 링크 | `/ko/ai/`, `/ko/hardware/` 허브에 상태·로컬 LLM·GPU 비교 페이지로 가는 링크가 0개다. 사이트맵에 있는 AI 모델 5개(gpt-5, o3 등)는 들어오는 링크가 0개(고아)다. 게임 약 100개는 noindex인 `?page=N`을 거쳐야만 닿는다. 허브 description은 24~32자로 title의 뒷부분을 되풀이한다 | 허브에 “지금 장애?”, “GPU별 로컬 LLM”, “인기 비교” 블록을 넣는다. 종료·구형 모델은 후속 모델 채널에서 링크한다. 허브 description을 제대로 쓴다 |
| 11 | medium | ko 채널 980개(색인) | description이 80자 미만인 채널이 511개다(studio 199/225, subculture 139/186, ai 115/177). 같은 문장을 쓰는 그룹이 11개다(AMD RX 9000·6000 등). 템플릿 문구(“…의 최신 변경, 공식 정보와 커뮤니티 글.”)가 색인 페이지 4곳에 나간다 | 유형 정보(VRAM, 가격, 출시일, 한국어 지원 등)로 description 뒷부분을 자동으로 채운다 |
| 12 | medium | 제목 길이 | 색인 채널 79개가 제목 60자를 넘는다(최대 106자). 로컬 LLM 페이지 67자, GPU 쌍 페이지 72자. “엔비디아 지포스” 접두어가 앞쪽을 차지한다 | 제목에는 짧은 이름(“RTX 5070”)을 먼저 쓴다. `— 소식·정보·커뮤니티` 같은 반복 꼬리는 짧게 줄인다 |
| 13 | low | 상태·기록·로컬 LLM·허브·레이더 | hreflang에 x-default가 없다(채널 페이지와 사이트맵에는 있다). 사이트맵의 상태·로컬 LLM 항목에는 x-default가 있어 HTML과 일치하지 않는다 | `page()`에서 x-default를 일괄로 넣는다 |
| 14 | low | 글 페이지 | h1 안에 종류 배지가 들어가 있다. 텍스트로는 “질문API 키 조직 권한…”처럼 붙어서 읽힌다 | 배지를 h1 밖으로 빼거나 `aria-hidden`과 공백을 넣는다 |
| 15 | low | `/ko/community/best/`, `/ko/search/` | h1이 없다(h2 “★ 념글”뿐이다). 념글 페이지에는 hreflang도 없다 | 페이지 제목을 h1로 올리고 ko/en alternates를 넣는다 |
| 16 | low | RSS | 레이더 피드가 0건이다. 레이더 페이지에는 30일치 출시와 일정이 보이는데 피드는 `change_log`만 쓴다. 채널 피드 item에는 `<description>`이 없고, 카테고리가 영문 코드(`question`, `free`)다 | 네이버에 제출할 사이트 대표 피드(레이더)에 출시와 일정을 넣고 item에 description을 넣는다. 커뮤니티 홈에서도 피드를 알린다 |
| 17 | low | GPU 쌍 리다이렉트 | 역순 쌍 요청이 `vs=rtx-4070%2Crtx-5070`으로 리다이렉트된다. canonical과 사이트맵은 `vs=rtx-4070,rtx-5070`이다 | 리다이렉트 Location을 canonical과 같은 문자열(쉼표 그대로)로 만든다 |
| 18 | low | 필터·페이지 파라미터 | `/ko/ai/?type=model&page=2`는 1페이지와 바이트까지 같은 HTML로 200을 돌려준다. `/ko/ai/?type=model&org=…&sort=cheap`은 색인 가능한데 canonical은 `?type=model`이다 | 표 페이지에는 `page`를 허용하지 않는다(리다이렉트). org 필터는 noindex로 둔다 |

(잘된 점: 사이트맵 URL 2,198개가 모두 200이고 색인 가능하며 self-canonical이다. 알 수 없는 파라미터(`?utm_source=x`)는 canonical로 301된다. 채널 필터와 페이지 변형은 `noindex,follow`다. 아일랜드는 사용자 상태만 덧붙이고 본문·댓글·차트·카운트다운은 JS 없이 HTML에 들어 있다. 모든 JSON-LD가 JSON으로 제대로 파싱된다.)

---

## 2. 상세

### F1. OG/트위터 메타가 최소한만 있다 (high, 모든 페이지)
관찰한 head(모든 페이지가 같은 구조다):
```html
<meta property="og:title" content="지금 Claude 장애? 실시간 상태와 사용자 리포트 | Nerulio">
<meta property="og:description" content="Claude이(가) 지금 안 되나요? …">
<meta property="og:url" content="https://nerulio.com/ko/ai/claude/status">
<meta property="og:site_name" content="Nerulio">
```
- 렌더한 47개 샘플 어디에도 `og:image`, `og:type`, `og:locale`, `twitter:card`가 없다.
- 네이버 검색 결과의 썸네일과 카카오톡·네이버 블로그 공유 미리보기는 `og:image`에 의존한다. 이미지가 없으면 링크 카드가 텍스트만 나오거나 공유처가 임의로 고른 이미지가 나간다. 커뮤니티 확산(단톡방이나 카페에 “지금 클로드 장애?” 링크를 공유하는 경우)이 핵심 유입 경로인데 이 부분이 비어 있다.
- `og:title`이 `| Nerulio` 접미사까지 그대로 복사된다. 공유 카드에서는 접미사 없는 제목이 더 낫다(낮은 우선순위).

**제안**: `page()`에 `og:type`(채널·허브는 `website`, 글은 `article`), `og:locale`(`ko_KR`/`en_US`)과 `og:locale:alternate`, `og:image`(상태 페이지는 “정상/장애” 카드, GPU는 스펙 카드, 나머지는 버티컬별 기본 이미지 1200×630), `twitter:card=summary_large_image`를 넣는다. 글 페이지에는 `article:published_time`도 넣는다.

### F2. 한국어 검색어(별칭)가 HTML에 없다 (high)
- `/ko/ai/claude/` HTML에서 `클로드`가 0회 나온다. 시드 `data/seed/ai/anthropic.json`에는 `"aliases": ["클로드"]`가 있다.
```html
<title>Claude 채널 — 소식·정보·커뮤니티 | Nerulio</title>
<title>지금 Claude 장애? 실시간 상태와 사용자 리포트 | Nerulio</title>
```
- `/ko/ai/chatgpt/status`에는 “챗GPT”나 “챗지피티”가 0회다.
- `/ko/studio/ableton-live/`는 title과 h1이 모두 “에이블톤 라이브”이고, 페이지 어디에도 “Ableton Live”가 0회다. 한국 사용자는 두 표기를 모두 검색한다.
- 이 서비스의 핵심 쿼리는 “클로드 장애”, “챗gpt 안됨”, “에이블톤 라이브 12” 같은 형태다. 네이버는 title과 본문 텍스트 매칭 비중이 높아서 별칭이 HTML에 없으면 검색되지 않는다.

**제안**: title에는 `지금 클로드(Claude) 장애? …`처럼 대표 한글 별칭 1개를 넣는다. h1 아래 보조 문구나 위키 박스에 “다른 이름: 클로드”를 텍스트로 노출한다. description의 첫 문장에도 별칭을 넣는다.

### F3. GPU 쌍 비교 페이지: h1이 일반적이고 본문이 거의 중복이다 (high)
`/ko/hardware/?type=gpu&vs=rtx-4070,rtx-5070`
```html
<title>엔비디아 지포스 RTX 4070 vs 엔비디아 지포스 RTX 5070 비교 — VRAM·대역폭·전력·로컬 LLM | Nerulio</title>
<link rel="canonical" href="https://nerulio.com/ko/hardware/?type=gpu&amp;vs=rtx-4070,rtx-5070">
<h1>그래픽카드 VRAM·스펙 비교</h1>
```
- h1이 `/ko/hardware/?type=gpu` 표 페이지와 같다. 쌍 이름은 h2 박스 제목에만 있다.
- 본문 텍스트 줄 비교: 쌍 페이지의 고유 줄 297개 중 287개가 GPU 전체 표 페이지와 겹친다. 쌍 페이지 = 비교 박스 + 90행 전체 표이다.
- RTX 5070 채널 한 곳에서 5개의 쌍 링크가 나간다(`vs=rtx-5070,rx-6700-xt` 등). 크롤에서 **색인 가능한 쌍 URL 285개**가 발견됐지만 사이트맵에는 후속 관계 쌍 11개(URL 22개)만 있다. 색인 가능한 거의 중복 페이지가 수백 개 생기는 구조다.
- 제목이 72자이고 “엔비디아 지포스”가 두 번 나온다. 실제 검색어는 “4070 5070 비교”, “5070 4070 차이” 형태다.
- description에 조사 오류가 있다: “RTX 4070와”(→ 4070과).

**제안**: h1은 `RTX 4070 vs RTX 5070 비교`로 쓴다. 쌍 페이지에서는 전체 표를 빼고 두 카드와 차이(%), 로컬 LLM 적합 모델의 차이, 관련 글을 보여준다. 사이트맵에 넣는 쌍만 색인하고 나머지는 `noindex,follow`로 둔다. 제목은 `RTX 4070 vs RTX 5070 비교 — VRAM·성능·로컬 LLM | Nerulio`처럼 짧게 쓴다.

### F4. 표 페이지의 description이 틀렸거나 중복이다 (high, 빠르게 고칠 수 있음)
```html
<!-- /ko/hardware/?type=gpu -->
<title>그래픽카드 VRAM·스펙 비교 — 로컬 LLM 추정 포함 | Nerulio</title>
<meta name="description" content="공식 가격 페이지 기준 요금·API 가격을 한 표로. 바뀌면 기록이 남습니다.">
```
- GPU 표에 AI 가격표 설명이 붙어 있다. 같은 43자 문구가 `/ko/ai/?type=model`, `/ko/ai/?type=plan`, `/ko/hardware/?type=gpu`에 똑같이 나간다(모두 80자 미만).
- 핵심 페이지인 AI 요금제·모델 가격표가 서로 구분되지 않는다. 네이버와 구글 모두 이런 description을 무시하고 본문에서 임의로 snippet을 뽑을 가능성이 높다.

**제안** (예)
- 요금제: “ChatGPT Plus·Claude Pro·Gemini 등 AI 요금제의 월·연 요금을 공식 가격 페이지 기준으로 한 표에 비교합니다. 가격이 바뀌면 날짜와 함께 기록합니다.”
- 모델: “GPT·Claude·Gemini 등 AI 모델 API 가격(100만 토큰당 입력·출력·캐시)을 공식 문서 기준으로 비교…”
- GPU: “RTX 50·40, 라데온 RX 9000 등 그래픽카드 90종의 VRAM·대역폭·전력과 로컬 LLM 최대 크기(추정)…”

### F5. “지금 {서비스} 장애?” 상태 페이지 (high)
```html
<title>지금 ChatGPT 장애? 실시간 상태와 사용자 리포트 | Nerulio</title>
<meta name="description" content="ChatGPT이(가) 지금 안 되나요? 공식 상태 페이지의 장애 기록과 한국 사용자 리포트(최근 24시간)를 한 번에 확인하세요.">
<h1>ChatGPT: 공식 상태 확인 전</h1>
...
<p class="empty">공식 상태 페이지를 아직 수집하지 않았습니다. 위 링크에서 직접 확인해 주세요.</p>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"ChatGPT: 공식 상태 확인 전","url":"https://nerulio.com/ko/ai/chatgpt/status","dateModified":"2026-09-28T06:00:00.000Z"}</script>
```
- title은 좋다(“지금 X 장애?”). 하지만 h1은 상태 문구(“사용자 리포트 급증”, “공식 상태 확인 전”)라서 검색 의도(“장애”)와 맞지 않고, 매번 바뀐다. JSON-LD `name`도 이 h1을 따라간다.
- description의 “Claude이(가)”, “ChatGPT이(가)”는 조사를 처리하지 못한 흔적이 그대로 노출된 것이다. 71~72자로 80자에도 못 미친다.
- 서비스 13개의 상태 페이지가 모두 `robots` 없이 색인 가능하고 사이트맵(ko/en 26개)에 있다. 공식 기록이 비었고 리포트가 0건인 상태(ChatGPT, Codex, OpenAI API, Jules, Gemini 등)에서는 본문이 “0건” 24줄과 표 24줄뿐이라 얇은 페이지다. 본문 약 820자 중 상당 부분이 시간대별 “— 0건” 반복이다.
- 사이트맵의 상태 URL `lastmod`는 엔티티 기준(2026-09-26)이라 리포트나 장애 발생과 무관하다.
- 상태 페이지는 허브(`/ko/ai/`), 커뮤니티 홈, 레이더 어디에서도 링크되지 않는다. 들어오는 링크는 5~7개이고 모두 채널과 형제 상태 페이지에서 온다.

**제안**
- h1은 `지금 {한글이름} 장애? 실시간 상태`로 고정하고, 상태 배지는 h1 아래에 둔다.
- 조사 함수(받침 판정)를 쓴다.
- 공식 상태 수집이 안 된 서비스는 noindex로 두거나 사이트맵에서 뺀다. 아니면 “최근 30일 공식 장애 n건, 평균 복구 시간” 같은 누적 정보를 보여줘 페이지가 얇지 않게 한다.
- 0건 시간대는 차트에만 두고 표는 접는다(`<details>`).
- JSON-LD `name`은 title과 맞추고, `about`에 서비스(SoftwareApplication)를 넣는다.
- `/ko/ai/` 허브에 “지금 장애?” 블록을 넣는다(서비스 13개).

### F6. 사이트맵 범위 (medium)
관찰 결과:
- 다섯 개 사이트맵의 URL 2,198개(ko 1,099개)는 모두 200, 색인 가능, self-canonical이다. 이 부분은 좋다.
- 하지만 크롤에서 **색인 가능한데 어느 사이트맵에도 없는 ko URL 1,266개**가 나왔다.

| 종류 | 개수 | 예 |
|---|---|---|
| 변경 기록 `/…/history` | 926 | `/ko/ai/claude/history` |
| GPU 쌍 `?type=gpu&vs=` | 285 | 위 F3 |
| 허브 표 `?type=…` | 25 | `/ko/ai/?type=plan`, `/ko/ai/?type=model`, `/ko/hardware/?type=gpu`, `/ko/games/?type=translation_patch` |
| 글 | 25 | `/ko/ai/claude/9` |
| 기타 | 5 | `/ko/community/`, `/ko/radar/`, `/ko/community/best/` |

- 전략 문서가 핵심으로 꼽은 **AI 요금제·모델 가격표와 레이더가 사이트맵에 없다.** `/ko/ai/?type=plan`으로 들어오는 링크는 7개뿐이다.
- 허브 항목에는 `lastmod`와 x-default가 없다.
```xml
<url><loc>https://nerulio.com/ko/ai/</loc><xhtml:link rel="alternate" hreflang="ko" .../><xhtml:link rel="alternate" hreflang="en" .../></url>
```
**제안**
- `sitemap-n2-pages.xml`을 추가한다(커뮤니티, 레이더, 허브 표 `?type=`, 선별한 GPU 쌍).
- 글 사이트맵(`sitemap-n2-posts-{vertical}.xml`, 최근 수정 순)을 만든다.
- 이 파일들을 묶는 사이트맵 인덱스를 둔다. 네이버 서치어드바이저에는 인덱스 1개를 제출한다.
- 기록 페이지는 F9에서 정한 기준을 통과할 때만 넣는다.

### F7. 구조화 데이터 (medium)
JSON-LD는 모든 페이지에서 JSON으로 제대로 파싱된다. 타입별 문제는 다음과 같다.

**(a) Product에 offers, review, aggregateRating이 없다**. `/ko/hardware/rtx-5070/`:
```json
"about":{"@type":"Product","name":"엔비디아 지포스 RTX 5070","category":"Graphics card","releaseDate":"2025-03-05","description":"…"}
```
구글 Product snippet은 셋 중 하나가 필수다. 없으면 Search Console의 “제품 스니펫”에서 잘못된 항목으로 잡힌다. 페이지에는 출시가(MSRP)가 표에 있지만 판매처 offer는 아니다.

**(b) SoftwareApplication과 VideoGame에 offers와 aggregateRating이 없다**. `/ko/ai/claude/`, `/ko/ai/claude-opus-5-5/`, `/ko/studio/ableton-live/`, `/ko/games/caves-of-qud/`(VideoGame은 SoftwareApplication의 하위 타입이다):
```json
"about":{"@type":"SoftwareApplication","name":"Claude","operatingSystem":[…],"applicationCategory":"BusinessApplication",…}
```
구글 소프트웨어 앱 리치 결과는 `offers.price`와 (`aggregateRating` 또는 `review`)가 필요하다. Claude(Free/Pro 가격)와 Ableton(에디션 가격)은 페이지에 이미 가격 데이터가 있으니 `offers`를 넣을 수 있다. 모델(`Claude Opus 5.5`, `Gemma 4 12B`)에 `SoftwareApplication/DeveloperApplication`을 쓰는 것은 의미상 어색하다.

**(c) 답이 없는 질문이 QAPage로 나간다**. `/ko/ai/claude/3`, `/ko/hardware/rtx-5070/1`:
```json
{"@type":"QAPage","mainEntity":{"@type":"Question","name":"API 키 조직 권한 설정 어디서 함?","text":"Console에서 찾기가 어렵네요.","dateCreated":"…","answerCount":0,"upvoteCount":1,"suggestedAnswer":[]}}
```
구글 QAPage는 `acceptedAnswer`나 `suggestedAnswer`가 최소 1개 필요하다. 답이 있는 `/ko/games/caves-of-qud/4`는 형식이 맞다. 권장 필드인 `author.url`은 모든 글에 없다.

**(d) BreadcrumbList가 noindex URL을 가리키고, 화면의 이동 경로와 다르다**:
```json
{"@type":"ListItem","position":2,"name":"AI","item":"https://nerulio.com/ko/radar/?v=ai"}
```
`/ko/radar/?v=ai`는 `<meta name="robots" content="noindex,follow">`이다. 반면 화면의 경로 링크는 `<a href="/ko/ai/">AI</a>`(허브)이다.

**(e)** 상태, 로컬 LLM, 허브 표, 레이더, 기록 페이지에는 BreadcrumbList가 없다. 로컬 LLM과 허브 표에는 JSON-LD 자체가 없다.

**제안**
- (a)와 (b): 가격이 있는 엔티티에는 `offers`(`price`, `priceCurrency`)를 넣고, 없으면 `about`의 타입을 `Thing`/`CreativeWork` 계열로 낮춰 리치 결과 오류를 없앤다.
- (c): 답이 0개이면 `DiscussionForumPosting`으로 내보낸다.
- (d): Breadcrumb 2단계를 `/ko/{vertical}/`로 바꾼다.
- (e): 하위 페이지에 4단계 Breadcrumb(허브 › 채널 › 상태)을 넣는다. 가격표와 GPU 표에는 `ItemList`나 `Dataset`을 검토한다.

### F8. 채널 필터 조합이 크롤 트랩이 된다 (medium)
채널 페이지마다 다음 링크가 나간다.
```html
<a href="/ko/ai/claude/?kind=news"> … <a href="/ko/ai/claude/?kind=free">
<a href="/ko/ai/claude/?sort=hot"><a href="/ko/ai/claude/?sort=top"><a href="/ko/ai/claude/?sort=activity">
<a class="best" href="/ko/ai/claude/?best=1" …>
```
- 필터된 페이지에서는 조합(`?kind=…&sort=…`, `&best=1`)으로 다시 링크가 나간다. `/ko/community/`에서 BFS로 6,000페이지를 크롤했을 때 발견 URL이 24,702개였다. 상위는 `subculture ?kind` 2,346개, `ai ?kind&sort` 1,974개 등이고 대부분 `noindex,follow` 필터 페이지다.
- 이 페이지들은 noindex지만 크롤러는 계속 방문한다. 네이버는 사이트당 수집량이 보수적이라, 크롤이 필터 변형에 쓰이면 새 채널·글·상태 페이지 수집이 늦어진다.
- 필터 변형은 title과 description이 기본 채널과 완전히 같다(`/ko/ai/claude/?page=2`, `?kind=question`, `?sort=hot`, `?best=1` 모두 `Claude 채널 — 소식·정보·커뮤니티 | Nerulio`).

**제안**: 필터와 정렬 탭 링크에 `rel="nofollow"`를 달고, 조합 링크(필터 안의 정렬)를 없앤다. `robots.txt`에서 `/*?*sort=`, `/*?*kind=*&` 같은 조합을 Disallow하는 방안도 검토한다(Disallow하면 noindex를 읽지 못하므로 nofollow를 먼저 적용한다).

### F9. 얇거나 중복인 색인 페이지 (medium)
**변경 기록**: 1,580개 중 931개가 색인 가능하다(`noindex:m.rows.length<3`). 내용은 대부분 시드 시점의 “확인” 행이다.
```text
Claude 변경 기록 · 4건 · Claude 상태 페이지 확인 https://status.claude.com/ · Claude 공식 사이트 확인 https://claude.com/ · Claude 플랫폼 확인 Web · iOS · … · Claude 출시일 확인 2023.07.11
```
- `/ko/ai/claude/history`의 본문은 535자이고, 모든 값이 채널 위키 박스와 겹친다.
- 가장 얇은 색인 기록은 `/ko/subculture/one-piece-manga/history`로 198자다.
- `/ko/games/caves-of-qud/history`에서 “Steam 앱 ID 확인 **333,640**”처럼 ID에 천 단위 쉼표가 들어간다(표시 버그).

**얇은 채널**: 색인되는 채널 중 가장 얇은 곳은 `/ko/subculture/nexon-games/`(본문 220자: 한 줄 설명, 관련 채널 1개, 글 0개)와 `/ko/ai/chatgpt-web-search/`(242자)다. 반대로 `/ko/subculture/blue-archive-game/`은 일정·D-day 등 918자가 있는데 noindex다. 콘텐츠 게이트가 “보이는 본문 양”과 따로 움직인다.

**중복 제목 10그룹**(색인 페이지끼리):
```text
블루 아카이브 채널 — 소식·정보·커뮤니티 | Nerulio   → /ko/games/blue-archive/, /ko/subculture/blue-archive/
젠레스 존 제로 채널 — …                           → games/zenless-zone-zero, subculture/zenless-zone-zero, subculture/zenless-zone-zero-game
원피스 채널 — …                                   → subculture/one-piece, one-piece-manga, one-piece-tv
프로젝트 채널 — …                                 → ai/claude-projects, ai/chatgpt-projects
```
AI 기능 채널 제목에 상위 제품명이 빠져 있다: `음성 채널`, `메모리 채널`, `검색 채널`(ChatGPT 웹 검색), `Canvas 채널`, `리서치 채널`. “ChatGPT 음성 모드”, “클로드 프로젝트” 같은 실제 검색어와 맞지 않는다.

**제안**
- 기록 페이지는 “이전값 → 새값” 변경이 1건 이상일 때만 색인한다. “확인”만 있는 기록은 noindex로 두고 채널로 canonical을 건다.
- 기능 채널 제목은 `{상위 제품} {기능}`(예: `ChatGPT 음성 모드`)으로 쓴다.
- 같은 이름의 엔티티는 제목에 유형을 붙인다: `블루 아카이브 (게임)`, `블루 아카이브 (프랜차이즈)`, `원피스 (만화)`, `원피스 (TV 애니)`.

### F10. 허브와 내부 링크 (medium)
- 허브에서 핵심 페이지로 가는 링크 수(렌더 HTML에서 셈):

| 허브 | status | local-llm | ?type=plan | GPU 쌍 |
|---|---|---|---|---|
| `/ko/ai/` | 0 | – | 2 | – |
| `/ko/hardware/` | – | 0 | – | 0 |
| `/ko/community/` | 0 | 0 | 0 | 0 |
| `/ko/radar/` | 0 | 0 | 0 | 0 |

- **고아 페이지**: `/ko/ai/claude-opus-4-1/`, `/ko/ai/gpt-5/`, `/ko/ai/gpt-5-mini/`, `/ko/ai/o3/`, `/ko/ai/o4-mini/`는 사이트맵에 있고 색인 가능하지만 크롤로 도달한 페이지 중 어디에서도 링크되지 않는다. 종료 예정 모델이라 모델 가격표에서 빠진 것으로 보인다. “o3 종료”, “GPT-5 종료일”은 실제로 검색되는 쿼리다.
- 게임 채널 약 100개는 `noindex,follow`인 `/ko/games/?type=game&page=2..N`을 통해서만 닿는다. 페이지 이동을 빼고 크롤하면 도달하지 못한 사이트맵 URL이 105개였고, 포함하면 5개였다.
- 허브의 description과 h1이 약하다.
```html
<!-- /ko/ai/ -->
<title>AI 채널 — 모델·요금제·기능, 그리고 무엇이 바뀌었는지 | Nerulio</title>
<meta name="description" content="모델·요금제·기능, 그리고 무엇이 바뀌었는지">
<h1>AI</h1>
<!-- /ko/hardware/ (본문 629자) -->
<meta name="description" content="AI·창작용 GPU: 무엇이 돌아가는지, 커뮤니티 측정으로">
<h1>하드웨어</h1>
```
**제안**
- `/ko/ai/` 허브에 “지금 장애? (13개 서비스)”와 “요금제·API 가격 비교” 블록을 넣는다.
- `/ko/hardware/` 허브에 “GPU별 로컬 LLM”(인기 카드 10개)과 “인기 비교”(후속 쌍 11개) 블록을 넣는다.
- 종료·구형 모델은 후속 모델 채널과 “종료 예정 모델” 목록에서 링크한다.
- 허브 h1은 `AI 채널 — 모델·요금제·장애`처럼 검색어를 담게 쓰고, description은 100자 안팎으로 새로 쓴다.
- 커뮤니티 홈의 “분야별 채널” 박스에 유형별 링크(요금제 비교, 한글패치 목록 등)를 넣는다.

### F11. meta description 품질 (medium)
- 색인 ko 채널 980개 중 **511개가 80자 미만**이다(중앙값 78자, 최저 9자).
  - 버티컬별로 studio 199/225, subculture 139/186, ai 115/177, hardware 57/93, games 1/299(게임은 양호).
  - 예: `/ko/studio/fabfilter-pro-q-4/` → `FabFilter의 이퀄라이저 플러그인입니다.`
  - 예: `/ko/subculture/nexon-games/` → `블루 아카이브를 개발한 국내 게임사.`
- 160자를 넘는 곳이 24개다. `/en/games/caves-of-qud/`는 172자다.
- 같은 문장을 쓰는 그룹이 11개다.
  - `AMD RDNA 4 아키텍처 기반의 AMD 라데온 RX 9000 시리즈 데스크톱 그래픽카드로, 16GB GD…` → rx-9070-xt, rx-9070, rx-9060-xt-16gb, rx-9060-xt-lp
  - `rtx-5080` = `rtx-5070-ti`, `izotope-neoverb` = `izotope-aurora` 등
- 템플릿 description이 색인 페이지에 나간다. `subculture/zenless-zone-zero-game`, `solo-leveling-tv-s1`, `solo-leveling-tv-s2`, `a-returners-magic-should-be-special-tv-s1` → `…의 최신 변경, 공식 정보와 커뮤니티 글.`
- 커뮤니티 홈은 28자다: `채널별 실시간 소식, 공식 정보와 커뮤니티 리포트.`
- 글 페이지 description은 본문 첫 부분(19~69자)이다. `/ko/ai/claude/1` → `공식 모델·가격 문서 기준으로 레이더봇이 올린 소식입니다.`

**제안**: “설명 + 유형별 핵심 사실” 템플릿을 쓴다.
- GPU: VRAM, 대역폭, 출시가, 로컬 LLM Q4 최대 크기
- 플러그인: 제조사, 가격, 호환 DAW
- 작품: 방영일, 다음 화 일정
- 모델: API 가격, 컨텍스트

description이 짧은 글은 제목과 채널명, 댓글 수로 보완한다.

### F12. 제목 길이와 반복 꼬리 (medium)
- 색인 채널 980개의 제목 길이: 중앙값 41자, 최대 106자, 60자 초과 79개.
  - 예: `에이스 컴뱃 8: 시브의 날개 (ACE COMBAT 8: WINGS OF THEVE) 채널 — 소식·정보·커뮤니티 | Nerulio`
- 로컬 LLM: `엔비디아 지포스 RTX 5070에서 돌아가는 로컬 LLM — 12GB VRAM 적합 모델 (추정·실측) | Nerulio`(67자). 핵심어(“RTX 5070 로컬 LLM”)가 “엔비디아 지포스” 뒤로 밀린다.
- 모든 채널이 같은 꼬리 `— 소식·정보·커뮤니티`를 쓴다. 검색어가 되지 않는 반복 문구라 앞부분의 고유 정보를 가린다.

**제안**
- 채널 제목은 `{이름} — {유형 핵심어} | Nerulio`로 쓴다. 예: `RTX 5070 — 스펙·가격·로컬 LLM·커뮤니티`, `Caves of Qud — 한글패치·업데이트·공략`.
- GPU는 짧은 이름(`RTX 5070`)을 먼저 쓴다.
- 로컬 LLM 제목은 `RTX 5070 로컬 LLM — 12GB에 맞는 모델 12개 | Nerulio`처럼 쓴다.

### F13. hreflang 일관성 (low)
| 페이지 | ko | en | x-default |
|---|---|---|---|
| 채널, 커뮤니티 홈 | ✓ | ✓ | ✓ (en) |
| 상태, 기록, 로컬 LLM, 허브, 허브 표, 레이더, GPU 쌍 | ✓ | ✓ | ✗ |
| 념글 `/ko/community/best/` | ✗ | ✗ | ✗ |
| 글 | self만 | – | – |

사이트맵의 상태·로컬 LLM 항목에는 x-default가 있어 HTML과 맞지 않는다. 네이버는 hreflang을 거의 쓰지 않지만 구글에서는 한 쌍의 선언이 서로 같아야 한다. 현재 x-default가 en을 가리키는 것은 한국 우선 서비스로서 검토할 만하다(국가 미지정 사용자에게 영어를 보여줌).

### F14. 글 페이지 h1에 배지가 들어간다 (low)
```html
<h1><span class="mh ">자유</span>Opus 5.5로 한 달 논문 정리한 후기</h1>
```
텍스트로 읽으면 `자유Opus 5.5로…`, `질문API 키 조직 권한…`, `벤치★ 5070 vs 4070 SUPER…`가 된다. title과 JSON-LD `headline`은 올바르다.

### F15. 념글과 검색에 h1이 없다 (low)
`/ko/community/best/`의 제목은 `<div class="bh"><h2>★ 념글</h2>`이고 h1이 없다. hreflang도 없다. `/ko/search/?q=5070`도 h1이 없다(noindex라 영향은 작다).

### F16. RSS (low, 네이버 관점에서는 중요)
```xml
<!-- /ko/radar/feed.xml -->
<rss version="2.0"><channel><title>Nerulio 레이더</title><link>https://nerulio.com/ko/radar/</link><description>AI·게임·하드웨어·창작 도구에서 바뀐 것</description><language>ko-KR</language></channel></rss>
```
- 레이더 페이지에는 최근 30일 출시와 다가오는 일정이 수십 건 보이는데 피드는 0건이다. 피드는 중요도 2 이상의 `change_log`만 쓴다.
- 채널 피드 `/ko/ai/claude/feed.xml`에는 item이 11개 있지만 `<description>`이 없고, `<category>`가 `question`, `free`처럼 내부 코드다. `atom:link rel="self"`도 없다.
- 커뮤니티 홈과 허브 head에는 RSS `<link rel="alternate">`가 없다(채널과 레이더에만 있다).

**제안**: 네이버 서치어드바이저에 제출할 대표 피드로 레이더를 정하고, 출시·일정·새 글을 합친 최신 50건을 넣는다. item에 description(요약 1~2문장)과 한국어 카테고리를 넣는다. 커뮤니티 홈에서도 레이더 피드를 알린다.

### F17. GPU 쌍 리다이렉트와 canonical 문자열 (low)
```text
GET /ko/hardware/?type=gpu&vs=rtx-5070,rtx-4070  → 301 Location: https://nerulio.com/ko/hardware/?type=gpu&vs=rtx-4070%2Crtx-5070
canonical: https://nerulio.com/ko/hardware/?type=gpu&amp;vs=rtx-4070,rtx-5070
```
리다이렉트한 URL과 canonical·사이트맵·내부 링크의 URL이 문자 단위로 다르다(`%2C`와 `,`). 두 형태 모두 200을 돌려준다.

### F18. 표 페이지의 파라미터 (low)
- `/ko/ai/?type=model&page=2`는 200을 돌려주고 1페이지와 HTML 바이트 수까지 같다(16,935B). canonical은 `?type=model`이다.
- `/ko/ai/?type=model&org=anthropic&sort=cheap`은 색인 가능한데(robots 없음) canonical이 `?type=model`이다. 본문은 7,757B로 전체 표(16,935B)와 달라서, 구글이 canonical을 무시하고 따로 색인할 수 있다. 채널 페이지에서 이 URL로 가는 링크가 있다.

**제안**: 표 페이지(`type` 지정)에서 `page`는 301로 없애고, `org`와 `sort` 필터는 `noindex,follow`로 둔다.

---

## 3. 우선순위 Top 10 (효과 ÷ 비용 순)

1. **`og:image`, `og:type`, `og:locale`, `twitter:card` 추가** (F1): `page()` 한 곳만 고치면 된다. 네이버 썸네일과 카카오 공유 카드가 이 값에 의존한다.
2. **GPU 표 description 오류 수정, 표 유형별 description 작성** (F4): 문자열 3개만 바꾸면 된다.
3. **ko title, description, h1에 한글 별칭 노출** (F2): “지금 클로드(Claude) 장애?”, “에이블톤 라이브(Ableton Live)”. 시드에 이미 `aliases`가 있다.
4. **상태 페이지 정리** (F5): h1을 `지금 {이름} 장애?`로 고정하고, “이(가)” 조사를 고치고, 공식 데이터가 없을 때의 색인 정책을 정하고, 허브에서 링크한다.
5. **GPU 쌍 페이지 정리** (F3): h1에 쌍 이름을 넣고, 전체 표를 빼 중복을 없애고, 사이트맵에 없는 쌍 약 270개는 noindex로 둔다.
6. **사이트맵 보강** (F6): 요금제·모델·GPU 표, 레이더, 커뮤니티를 담는 `sitemap-n2-pages.xml`과 글 사이트맵을 만들고, 사이트맵 인덱스를 네이버와 구글에 제출한다.
7. **구조화 데이터 수정** (F7): BreadcrumbList는 허브를 가리키게 하고, 답이 0개인 QAPage는 DiscussionForumPosting으로 바꾸고, Product와 SoftwareApplication에는 `offers`를 넣거나 타입을 낮춘다.
8. **필터와 정렬 링크에 nofollow, 조합 링크 제거** (F8): 약 2만 개의 noindex URL로 새는 크롤 예산을 막는다.
9. **변경 기록 색인 기준 강화, 중복·모호한 제목 해소** (F9): 기록 페이지는 실제 변경이 있을 때만 색인한다. `블루 아카이브 (게임)`, `ChatGPT 음성 모드`처럼 유형이나 상위 제품을 붙인다.
10. **허브에 핵심 페이지 블록 추가, 고아 페이지 연결** (F10): `/ko/ai/`에 장애 상태와 가격표, `/ko/hardware/`에 로컬 LLM과 인기 비교를 넣는다. gpt-5, o3 등 고아 모델 5개를 연결하고 허브 description을 새로 쓴다.

(다음 순서: F11 description 템플릿 → F12 제목 꼬리 단축 → F16 레이더 RSS 채우기 → F13–F15, F17–F18 정리)
