# Nerulio 2.0 경쟁·레퍼런스 사이트 분석

작성: 2026-09-29 · 대상: 채널(라이브 패널 + 게시판 + 위키 박스) 설계 · 범위: 한국 커뮤니티, 토픽 트래커, 호환성 DB

## 0. 조사 방법과 신뢰 표기

- 방법: WebSearch(검색 결과 요약)와 WebFetch(원문 열람).
- **WebFetch 차단**: 이 세션의 네트워크 프록시가 아래 도메인을 막았다. 원문을 직접 열지 못했으므로 해당 내용은 검색 결과 요약이나 기존 지식에 근거한다.
  - protondb.com, steamdb.info, isdown.app, namu.wiki, arca.live, quasarzone.com, techpowerup.com, openrouter.ai, artificialanalysis.ai, hanpe.net, steamapp.net, production-expert.com, anichart.net, willitrunai.com
- 열람에 성공한 곳은 github.com뿐이다. ProtonDB 데이터 저장소, ProtonDB 스키마 이슈, SteamDB 데포 해설 gist를 열었다.
- 각 주장 뒤에 근거 표기를 붙였다.
  - **[F]** 원문을 직접 열람함.
  - **[S]** 검색 결과 요약. 결과에 붙은 URL을 인용한다.
  - **[K]** 기존 지식. 2026-09 시점에 재확인하지 못했으므로 출시 전에 다시 확인해야 한다.
- 비교 대상의 트래픽과 매출은 확인하지 못했다. 이 문서의 규모 비교는 모두 정성적이다.

---

## 1. 요약: 핵심 결론 11개

1. **"Is X down?" 시장은 두 갈래로 나뉘어 있다.**
   - Downdetector는 크라우드 신고의 급증을 시간대별 기준선과 비교해 판정한다 [S].
   - IsDown과 StatusGator는 공식 상태 페이지를 컴포넌트 단위로 정규화하고, 사용자 신고를 "조기 경보"로 겹친다 [S].
   - 두 방식을 한 페이지에 합친 **한국어 AI 서비스 전용 페이지는 없다**. Nerulio의 Claude 채널 라이브 패널이 바로 이 조합이다.
2. **ProtonDB는 한글패치 호환 리포트에 거의 그대로 이식할 수 있는 모델이다.**
   - 막연한 별점 대신 질문지(열림/실행/그래픽·오디오·입력·세이브·안정성 결함, 사용한 커스텀, 버전, 시스템 정보)를 받는다.
   - 메달은 사이트가 계산한다 [F: 스키마 이슈 #7] [S].
   - 1인당 최신 리포트 1건만 집계하고, 작성하려면 Steam 로그인이 필요하다 [S].
3. **ProtonDB의 약점도 이미 공개적으로 지적되어 있다.**
   - 등급 인플레이션, 오래된 리포트가 현재 등급에 섞이는 문제, 평가 기준의 주관성이 꼽힌다 (Valve Proton 이슈 #2638, Notebookcheck 기사) [S].
   - Nerulio는 리포트를 **게임 빌드에 고정**하고, 새 빌드가 나오면 "미확인"으로 자동 강등해서 이 약점을 넘을 수 있다.
4. **SteamDB의 경쟁력은 "변경 이력"이다.**
   - PICS의 changelist, 빌드와 데포 변경, 가격, 동시접속자를 시간순으로 쌓는다 [F: gist] [S].
   - 공개 API가 없고 한국어 해석도 없다. 한패 호환성과도 연결되어 있지 않다.
   - Nerulio는 모든 엔티티에 대해 "변경 이력 타임라인"이라는 공통 문법을 가져와야 한다.
5. **한글패치 허브(스팀앱, 한글로게임, 한패)는 링크 DB에 머물러 있다** [S].
   - 커뮤니티에서도 "게임 업데이트 후 패치가 깨질 수 있으니 지원 빌드를 확인하라"고 안내한다 [S].
   - 그런데 **빌드 불일치를 자동으로 경고하는 곳은 확인되지 않았다**. Nerulio가 가장 쉽게 차별화할 수 있는 지점이다.
6. **로컬 LLM "내 GPU에서 돌아가나"는 SEO 경쟁이 이미 치열하다.**
   - willitrunai, llmrun, modelfit, turbollm 같은 "GPU별 모델 목록" 프로그래매틱 페이지가 영어권 검색을 점유하고 있다 [S].
   - 대부분 추정치다. 측정된 tok/s는 r/LocalLLaMA에 흩어져 있다.
   - 한국어 페이지와 "실측 리포트 + 추정의 명시적 구분"은 비어 있다.
7. **모델 비교 사이트(Artificial Analysis, OpenRouter, LMArena)는 영어와 USD 기준이다** [S].
   - 한국어 성능, 원화 가격, 한국 결제와 부가세, 서비스 장애 이력을 한 화면에 모은 곳은 없다.
   - Nerulio는 벤치마크를 재생산하지 말고 **출처를 붙여 요약하고 링크**해야 한다.
8. **한국 커뮤니티의 UX 문법은 사실상 표준이다.**
   - 말머리 탭, 념글과 개념글, 글번호, [댓글수], 추천/비추천이 여기에 해당한다.
   - DC 마이너갤의 념글 기준은 글 리젠에 따라 자동으로 바뀌고, 최댓값은 100이다 [S].
   - 아카라이브는 채널마다 념글 기준을 따로 설정한다 [S].
   - 사용자는 이 문법을 기대한다. 새로 만들지 말고 그대로 따라야 한다.
9. **커뮤니티 위키는 실패하기 쉽다.**
   - 아카라이브 채널 위키(2021 도입, 나무마크 문법)는 "정보는 공지글로 올리는 관행 때문에 잘 쓰이지 않는다"는 평가를 받는다 [S].
   - 나무위키는 속도는 압도적이지만 출처 기준이 약하고 의견이 섞인다는 비판이 공식 문서에까지 있다 [S].
   - 따라서 Nerulio 위키 박스는 **자유 서술 위키가 아니라 "출처 붙은 사실 행"**이어야 한다.
10. **구독과 알림이 재방문의 엔진이다.**
    - ITAD 위시리스트, MFC의 아이템별 changelog 종(bell), AniList 방영 캘린더, StatusGator 알림이 여기에 해당한다 [S].
    - Nerulio는 "이 엔티티의 사실이나 상태가 바뀌면 알림"을 채널 공통 기능으로 가져야 한다.
11. **수익 모델에는 세 가지 패턴이 있다.**
    - 광고와 후원: MAL Supporter($2.99/월), AniList 기부, ProtonDB Patreon [S].
    - B2B 데이터와 알림 SaaS: StatusGator($72~274/월), Downdetector 엔터프라이즈 [S].
    - 제휴와 협찬: 퀘이사존. 협찬과 이벤트 공정성 논란이 반복되었다 [S].
    - Nerulio는 초기에 광고와 제휴 링크(가격, 예약)로 시작하되, **협찬 표시와 편집 독립성 규칙을 먼저 공개**해야 한다.

---

## 2. 비교표

| 사이트 | 하는 일 | 강점 | Nerulio가 파고들 틈 |
|---|---|---|---|
| 아카라이브 | 주제 채널형 커뮤니티 | 채널 생성과 운영 자율, 채널별 념글 기준, 말머리, 채널 위키 | 채널에 구조화된 데이터(라이브 패널)가 없다. 위키는 거의 쓰이지 않는다 |
| DC인사이드 | 갤러리(정식/마이너/미니) | 규모, 속도, 개념글 자동 기준, 매니저가 편집하는 말머리 | 정보가 휘발된다. 사실과 출처를 구조화하지 않는다. 유동 익명성 때문에 신뢰가 낮다 |
| 퀘이사존 | 하드웨어 뉴스, 벤치 칼럼, 장터 | 해외 하드웨어 뉴스를 빠르게 번역한다. 자체 벤치마크가 있다 | 로컬 LLM 적합성이나 VRAM 관점이 없다. 협찬과 이벤트 신뢰 논란이 있다 |
| 루리웹 | 게임 뉴스와 정보, 유게, 예판핫딜 | 게임과 서브컬처 정보게시판, BEST, 예판핫딜 | 정보가 게시글 단위로 흩어진다. 엔티티(게임, 굿즈) 페이지가 없다 |
| 나무위키 | 범용 위키 | 이슈 반영 속도, 틀(내비게이션), 게임과 GPU 문서의 깊이 | 출처가 약하고 서술이 주관적이다. 실시간 상태나 가격 같은 동적 데이터를 담지 못한다 |
| Downdetector | 크라우드 장애 신고 | 기준선 대비 급증 판정, 24시간 차트(20분 단위), 지도, 댓글 | AI 서비스를 컴포넌트 단위로 보지 않는다. 한국어 AI 맥락이 없다. 공식 인시던트와 연결이 약하다 |
| IsDown / StatusGator | 공식 상태 페이지 집계와 알림 | 수천 개 서비스를 컴포넌트 단위로 정규화, 조기 경보, B2B 알림 | 영어 B2B 중심이다. 커뮤니티 증상 토론이 없다 |
| Artificial Analysis | 모델 지능, 속도, 가격 지수 | 방법론이 공개된 합성 지수(v4.3.2), 비교 도구 | 한국어 성능과 원화 가격이 없다. 사용자 체감이나 장애 정보가 없다 |
| OpenRouter | 모델 라우팅과 모델 페이지 | 제공자별 가격, 지연, 처리량, 가용성 | API 개발자 전용이다. 소비자 앱(Claude.ai 등)의 한국 사용 맥락이 없다 |
| LMArena | 블라인드 투표 순위 | 대규모 투표, Bradley-Terry 방식, 스타일 보정 | 한국어 프롬프트 순위를 분리해서 보여주지 않는다(확인하지 못함) |
| TechPowerUp GPU DB | GPU 사양 DB | 방대한 사양, 상대 성능, MSRP | 한국 가격(원화)이 없다. LLM 적합성이 없다 |
| VRAM 계산기 (apxml 등) | 모델, 양자화, 컨텍스트 → VRAM | 프레임워크 프리셋, GPU→모델 목록 | 추정치만 있고 실측 리포트가 없다. 한국어가 없다 |
| r/LocalLLaMA | 로컬 LLM 커뮤니티 | 실측 tok/s와 설정 노하우 | 구조화되지 않았다. 검색할 수 없는 스레드에 묻힌다 |
| SteamDB | Steam 메타데이터 이력 | changelist, 빌드와 데포, 가격, 동접 이력 | 한국어가 없다. 공개 API가 없다. 한패나 호환성과 연결되지 않는다 |
| ProtonDB | Linux/Deck 호환 리포트 | 질문지형 리포트, 계산된 메달, ODbL 공개 데이터 | 오래된 리포트가 섞이고 등급이 인플레된다. 빌드에 고정되어 있지 않다 |
| IsThereAnyDeal | 가격 비교와 역대 최저가 | 30개 이상 스토어, 위시리스트 알림, API | 한국 스토어 커버리지를 확인하지 못했다. 한국어가 없다 |
| 스팀앱 / 한글로게임 / 한패 | 유저 한글패치 링크 DB | 국내 최대 규모, 스팀 계정 연동, 건의 탭 | 패치와 게임 빌드의 호환 여부를 추적하지 않는다. 구조화된 리포트가 없다 |
| Production Expert / Sweetwater | macOS × DAW·플러그인 호환표 | OS마다 차트를 새로 만들고, 200개 이상 제조사를 망라한다 | 한국어가 없다. DAW 버전별 사용자 리포트가 없다. 변경 알림이 없다 |
| AniList / AniChart / MAL | 방영 일정, 목록 관리 | 카운트다운, 시즌 차트, 개인 리스트 | 한국 방영과 OTT 시간이 없다. 굿즈와 연결되지 않는다 |
| 애니시아 | 한국 애니 편성표와 자막 | 한국 자막 링크, 휴방과 종영 정보 | 굿즈나 커뮤니티와 연결되지 않는다 |
| MyFigureCollection | 피규어 DB | 85만 개 이상 항목, 발매 캘린더, 아이템별 changelog 구독 | 한국 예약처나 원화 정보가 없다. 영어 전용이다 |

---

## 3. 사이트별 노트

### A. 한국 커뮤니티

**아카라이브** (arca.live는 fetch 차단. 검색 요약과 지식에 근거)
- **사용자가 얻는 것**: 주제별 채널. 게임, 서브컬처, AI 채널이 많다. 탭은 전체글, 개념글(념글), 말머리로 나뉜다. 메인에는 [실시간] 인기글이 있고 카테고리로 거를 수 있다 [S: siderlab.kr/blog/20009].
- **채널 생성**: 2018년 8월에 도입되었다. 3000포인트로 개설하고, 구독자 100명을 넘기면 공개 채널로 승격된다. 운영진이 승격을 거부할 수도 있다 [S: thewiki.kr/w/아카라이브/채널].
- **념글**: 추천 기준은 채널 설정마다 다르다 [S: 같은 곳].
- **채널 위키**: 2021-07-14에 도입되었다. 나무마크 문법을 쓰고, 구독자 100명 이상인 채널이 조건이다. "정보는 공지글로 올리는 관행 때문에 잘 쓰이지 않는다" [S: namu.wiki/w/채널위키, namu.wiki/w/아카라이브].
- **코어 루프**: 구독 채널 → 념글 확인 → 댓글과 추천 → 아카콘(이모티콘) [K].
- **재방문 요인**: 알림, 념글, 채널 고유의 밈과 문화 [K].
- **신뢰**: 채널 관리자와 부관리자가 말머리 규칙과 공지로 운영한다. 사실 검증 장치는 없다.
- **UGC**: 글, 댓글, 아카콘 판매(창작자 수익) [K].
- **SEO**: 개별 글 URL이 순위에 오른다. 채널 소개 페이지는 약하다 [K].
- **수익**: 광고, 아카콘 [K].
- **Nerulio의 틈**: 채널 UX는 그대로 따른다. 채널 상단에 "라이브 패널 + 출처 붙은 사실"을 얹으면 아카라이브가 구조적으로 할 수 없는 가치가 생긴다. 공지글로 흩어지던 정보를 **념글 → 위키 사실 승격** 흐름으로 흡수한다.

**DC인사이드** (검색 요약과 지식)
- **구조**: 정식, 마이너, 미니 갤러리가 있다. 마이너갤 매니저가 말머리를 만들고 편집한다 [S: namu.wiki/w/디시인사이드/마이너 갤러리].
- **개념글**: 추천 기준이 글 리젠에 따라 자동으로 오르내리고, 최댓값은 100이다 [S: 같은 곳]. 실베(실시간 베스트)는 운영자가 고르는 목록이라 념글과 다르다 [S: namu.wiki/w/실시간 베스트 갤러리].
- **작성자 구분**: 고정닉, 반고닉, 유동(비로그인, 비밀번호로 수정과 삭제)으로 나뉜다 [S: ko.wikipedia.org/wiki/디시인사이드의_용어].
- **재방문 요인**: 속도와 밈. 글번호와 [댓글수]가 활동량을 나타낸다.
- **신뢰**: 사실상 없다. 념글도 인기 신호일 뿐이다.
- **SEO**: 갤러리 글이 롱테일 검색에서 강하다 [K].
- **수익**: 광고, 디시콘 [K].
- **Nerulio의 틈**: "동적 념글 기준" 알고리즘은 채택한다. 유동의 완전 익명성은 피하고, 로그인과 닉네임 기반 평판을 쓴다. 정보는 휘발되지 않도록 사실 행으로 남긴다.

**퀘이사존** (quasarzone.com은 fetch 차단. 검색 요약에 근거)
- **사용자가 얻는 것**:
  - 뉴스: 하드웨어, 게임, 모바일, 파트너 뉴스.
  - 퀘이사 칼럼과 벤치마크: CPU와 GPU 게임 벤치. 예로 인조이 17종 CPU 벤치가 있다.
  - 커뮤니티: 질문, 잡담, 정보, 장터 [S: quasarzone.com/bbs/qn_hardware, qc_bench, qf_cmr/views/2702073].
- **재방문 요인**: 신제품 루머와 사양 기사. 출시 전 "지금까지 알려진 모든 것" 형식의 기사가 여기에 해당한다 [S: qn_hardware/views/1806281].
- **신뢰**:
  - 자체 벤치를 하지만 협찬 샘플을 쓴다는 점을 밝히고 있다.
  - 이벤트 당첨 조작 논란으로 고소까지 갔고, 퀘이사플레이 객관성에 대한 의문도 제기되었다 [S: namu.wiki/w/퀘이사존].
- **수익**: 파트너 뉴스, 협찬, 이벤트, 광고, 장터 [S] [K].
- **Nerulio의 틈**:
  - GPU 채널에서 퀘이사존 벤치를 링크하되, LLM 관점(VRAM, tok/s)은 Nerulio가 직접 채운다.
  - 협찬이나 제휴가 있으면 사실 행과 글에 **표시를 강제**한다. 퀘이사존 논란이 교훈이다.

**루리웹** (검색 요약)
- **구성**: 뉴스와 겜툰, 게임 게시판, 유저 정보게시판, 유머게시판, BEST(오늘, 주간, 월간 / 조회순, 추천순), 예판핫딜 게시판 [S: namu.wiki/w/루리웹/게시판, bbs.ruliweb.com/news/board/1020].
- **재방문 요인**: 정보게시판의 서브컬처 속보, 예판핫딜.
- **UGC**: 사용자가 정보를 퍼오고 핫딜을 제보한다.
- **Nerulio의 틈**:
  - 예판핫딜 게시판은 **애니 굿즈 예약 패널**의 입력원이 된다. 사용자 제보를 받고, 마감일과 가격을 구조화한다.
  - BEST의 기간 필터(오늘, 주간, 월간)는 념글 탭에 그대로 쓴다.

**나무위키** (namu.wiki는 fetch 차단. 검색 요약과 지식)
- **다루는 방식**:
  - 게임 문서는 "게임 문서 틀"과 프로필 표 문법을 우선 쓴다 [S: namu.wiki/w/나무위키:편집합의/특정 분야/창작물].
  - GPU는 시리즈 문서(GeForce 50) 안에 사양표를 둔다 [S].
  - AI 모델 문서도 출시 직후 생긴다 [K].
- **속도**: 이슈가 생기면 몇 분에서 몇 시간 안에 반영된다 [K]. 루리웹에 "RTX 5070 나무위키 근황" 같은 밈 글이 올라올 정도로 영향력이 크다 [S: bbs.ruliweb.com/community/board/300143/read/69768729].
- **신뢰**: 공식 비판 문서가 인정한다. 의견과 추측이 섞이고, 출처를 왜곡하거나 맥락 없이 인용하는 문제가 있으며, 엄격한 출처 요구가 없다 [S: namu.wiki/w/나무위키/비판 및 문제점].
- **SEO**: 한국어 엔티티 검색의 1위권이다 [K].
- **Nerulio의 틈**:
  - 나무위키와 서술로 경쟁하지 않는다. **"확인일 + 출처 + 검증 라벨"이 붙은 사실 행과 동적 상태**로 경쟁한다.
  - 나무위키가 못 하는 것이 대상이다: 오늘 장애 여부, 현재 패치 호환, 다음 화까지 남은 시간.
  - 나무위키 링크는 "더 읽기"로 둔다.

### B. AI 서비스 상태와 모델 비교

**Downdetector** (검색 요약)
- **판정 방식**: 사용자 신고량을 시간대, 요일, 지역별 기준선과 비교한다. 임계치를 넘으면 장애로 표시한다 [S: isthatdown.com/resources/what-is-downdetector, martinuke0.github.io].
- **페이지 구성**: 24시간 신고 차트(20분 단위), 지도, 도시별 신고 수, 가장 많이 보고된 문제, 댓글 [S: en.wikipedia.org/wiki/Downdetector].
- **규모와 소유**: 25,000개 이상 서비스, 64개국. 2026-03에 Ookla와 함께 Accenture에 인수되었다 [S: news.slashdot.org 2026-03-03].
- **수익**: 무료 소비자 페이지로 SEO 트래픽을 모으고, 엔터프라이즈 데이터를 판다 [S] [K].
- **약점**:
  - 신고 급증이 원인을 설명하지 못한다. 공식 인시던트와 연결이 약하다.
  - AI처럼 "로그인은 되는데 특정 모델만 오류" 같은 **컴포넌트 수준 증상을 구분하지 못한다** [K].

**IsDown / StatusGator** (isdown.app은 fetch 차단. 검색 요약)
- **IsDown**:
  - 6,000개 이상 서비스의 공식 상태 페이지를 몇 분 간격으로 읽고, 크라우드 신고와 합쳐 "벤더가 발표하기 전에" 감지한다고 주장한다.
  - Anthropic은 컴포넌트 5개를 모니터한다.
  - 페이지 종류: 서비스별 "Is X down?", 하위 서비스별(예: /status/anthropic/claude-on-vertex-ai), reports-map [S: isdown.app/status/anthropic, isdown.app/status/claude-ai].
- **StatusGator**:
  - 공식 상태와 "Early Warning Signals"(크라우드와 비공식 신호)를 섞는다.
  - 무료 플랜은 모니터 50개, 5분 간격. 유료는 $72, $137, $274/월 [S: statusgator.com/features/early-warning-signals, statusgator.com/plans, outmano.com].
- **SEO**: "is claude down" 같은 쿼리를 서비스별, 컴포넌트별 정적 페이지로 수집한다 [S].
- **Nerulio의 틈**:
  - 한국어 "클로드 장애", "클로드 안됨" 쿼리.
  - 한국 시간대 기준 이력.
  - **채널 게시판의 '장애' 말머리 글을 증거 스트림으로 붙이는 것**. IsDown에는 토론이 없다.

**Artificial Analysis** (fetch 차단. 검색 요약)
- **Intelligence Index v4.3.2**: 10개 평가의 가중 합성이다. 평가당 비용은 입력, 캐시, 추론, 출력 토큰 가격으로 계산한다.
- **제공하는 것**: 모델 최대 5개 비교, 출시별 페이지(/models/releases/...), 오픈소스 모델 필터 [S: artificialanalysis.ai/models, artificialanalysis.ai/models/releases/claude-opus-5-5].
- **수익**: 기업용 리포트와 인사이트 [K].
- **Nerulio의 틈**: 지수를 **출처와 확인일을 붙여 인용**만 한다. 원화 가격, 한국어 품질 코멘트(커뮤니티), 장애 이력을 함께 보여준다.

**OpenRouter** (fetch 차단. 검색 요약)
- **모델 페이지**: 제공자별 가격, 컨텍스트, 지연과 처리량(p50~p99, 5분 롤링), 가용성을 보여준다. 모델 비교 페이지와 순위도 있다 [S: openrouter.ai/docs/guides/routing/provider-selection, openrouter.ai/compare].
- **수익**: 크레딧 구매 수수료 [K].
- **Nerulio의 틈**: API 사용자와 소비자 사이의 간극. "Claude 앱 한국 결제와 요금제"는 OpenRouter가 다루지 않는다.

**LMArena (Arena)** (검색 요약)
- **방법**: 블라인드 A/B 투표에 Bradley-Terry 모델을 적합한다. 스타일 보정이 있고, 2026-01에 투표 중복 제거를 도입했다 [S: arena.ai/faq, arena.ai/blog/leaderboard-changelog].
- **Nerulio의 틈**: 채널 게시판에 한국어 체감 비교 말머리(예: "비교")를 둔다. 순위 자체는 링크로만 인용한다.

### C. 하드웨어와 로컬 LLM

**TechPowerUp GPU Database** (fetch 차단. 검색 요약)
- **제공하는 것**: GPU별 사양, 기준 GPU 대비 상대 성능(%), 출시 MSRP [S: nvidiareview.com/techpowerup-gpu].
- **재방문 요인**: 사양 조회의 기준 레퍼런스 역할.
- **Nerulio의 틈**: 사양은 제조사 공식 페이지를 출처로 한다. 원화 가격(다나와 등)과 LLM VRAM 적합성을 더한다.

**VRAM 계산기와 GPU별 모델 페이지** (검색 요약)
- **apxml "Can You Run This LLM?"**: 모델, 정밀도, 컨텍스트, 하드웨어를 입력하면 적합 여부와 가중치, KV 캐시, 오버헤드 분해를 보여준다. vLLM, llama.cpp 등 프레임워크 프리셋이 있다. v4.0이 2026-09-26에 나왔다 [S: apxml.com/tools/vram-calculator].
- **GPU별 모델 페이지**: willitrunai.com/gpus/rtx-5070-12gb, llmrun.dev/gpu/rtx-5070, modelfit.io/gpu/rtx-5070, turbollm.dev/gpu/rtx-5070 [S].
  - 이런 페이지가 "RTX 5070 로컬 LLM" 영어 쿼리를 점유하고 있다.
  - 내용은 7~9B Q4에 약 59 tok/s, Q4_K_M 권장 같은 **출처가 불분명한 수치**다.
- **Nerulio의 틈**:
  - 한국어 버전.
  - **추정(ESTIMATE, 방법 공개)과 실측(COMMUNITY 리포트)을 분리해서 표시**한다.
  - 리포트 폼은 ProtonDB식으로 받는다: GPU, 드라이버, 백엔드, 모델, 양자화, 컨텍스트, tok/s.

**r/LocalLLaMA** (지식)
- **특징**: 실측과 노하우의 원천이지만 스레드 속에 흩어져 있다 [K].
- **Nerulio의 틈**: 채널 게시판의 "실측" 말머리 글을 구조화된 리포트로 변환하는 버튼을 둔다.

### D. 게임

**SteamDB** (steamdb.info는 fetch 차단. gist [F]와 검색 요약)
- **데이터 수집**: SteamKit으로 PICS에 접속해 changelist를 폴링한다. 앱이나 패키지가 바뀌면 전역 changenumber가 증가하고, 빌드 ID는 실제 콘텐츠 패치를 나타낸다. 익명 로그인으로 데포 목록과 브랜치 갱신 시각을 얻을 수 있고, 과거 "first seen" 기록은 재현할 수 없다 [F: gist.github.com/mdeguzis/35116dbf762d4e71966bbe89062653c5] [S: steamdb.info/faq].
- **페이지 종류**:
  - 앱별 패치노트: /app/{id}/patchnotes.
  - 빌드와 데포 이력: 무음 안티치트 추가 같은 변화를 먼저 포착한다 [S: tech-insider.org].
  - 동접 차트, 가격 이력, 세일 목록 [S].
- **SEO**: "{게임} player count", "{게임} patch notes", "price history"로 앱마다 여러 페이지가 순위에 오른다 [S].
- **수익**: 광고, 후원, 브라우저 확장으로 인한 충성도 [K].
- **Nerulio의 틈**:
  - 한국어 요약.
  - **"이 업데이트로 한패가 깨졌나?"라는 질문에 답하는 연결**.
  - 공개 API가 없으니 스크래핑하지 않는다. Nerulio는 공식 Steam Web API의 뉴스와 스토어 데이터로 자체 이력을 쌓는다. 기존 수집기 정책은 docs/n2/sources-games.md에 있다.

**ProtonDB** (protondb.com은 fetch 차단. GitHub [F]와 검색 요약)
- **리포트 스키마** [F: github.com/maxpoulin64/protondb-api/issues/7]:
  - 결과: `opens`, `startsPlay`, `installs`, `verdict`.
  - 결함: `audioFaults`, `graphicalFaults`, `inputFaults`, `performanceFaults`, `saveGameFaults`, `stabilityFaults`, `windowingFaults`, `significantBugs`, 그리고 세부 결함 `followUp`.
  - 환경: `customizationsUsed`, `protonVersion`, `launcher`, `isImpactedByAntiCheat`, 멀티플레이 시도 여부, `duration`, `notes`.
  - 시스템: `systemInfo`(cpu, gpu, gpuDriver, kernel, os, ram), `timestamp`.
  - 이 이슈는 "yes"/"no" 문자열 불리언, 필드 누락, 형식 변경을 지적한다. 교훈은 **스키마 버전을 명시**하라는 것이다.
- **운영 규칙**:
  - 2019-10-28에 막연한 평가에서 질문지 방식으로 바꾸었고, 등급을 새로 산정했다 [S: boilingsteam.com/protondb-ratings-revised].
  - Steam 로그인이 필수다. 공개 프로필이면 소유 여부와 플레이타임도 전송된다.
  - 같은 게임에 여러 번 리포트해도 되지만 **최신 1건만 집계**한다. 최소 사양 미달 시스템은 집계에서 제외한다 [S: protondb.com/help/site-questions 경유 검색 요약].
- **부가 기능**:
  - 탐색 정렬에 `wilsonRating`이 있다 [S: protondb.com/explore?sort=wilsonRating].
  - Deck Verified를 통합했고, Steam Deck 필터와 Decky 배지 플러그인이 있다 [S].
- **데이터와 수익**: 월별 덤프를 ODbL로 공개한다 [F: github.com/bdefore/protondb-data]. 후원은 Patreon이다 [S].
- **약점**: 등급이 부정확하다는 지적(Valve Proton 이슈 #2638), 기준이 주관적이라는 비판 [S: github.com/ValveSoftware/Proton/issues/2638, notebookcheck.net].
- **Nerulio에 주는 교훈**:
  - 질문지와 계산된 판정, 1인 1표(최신), 로그인과 소유 신호, Wilson 정렬, 공개 덤프를 가져온다.
  - 여기에 **빌드와 버전 고정, 시간 감쇠**를 더한다.

**IsThereAnyDeal** (검색 요약)
- **제공하는 것**: 30개 이상 스토어, 번들과 쿠폰, 위시리스트 알림, 스토어별 역대, 1년, 3개월 최저가, 공개 API [S: docs.isthereanydeal.com, isthereanydeal.com/waitlist].
- **한국**: 스토어 커버리지를 확인하지 못했다.
- **Nerulio의 틈**: 가격은 핵심이 아니다. 게임 채널 패널에서 역대 최저가를 링크로 보여주고, 한국 원화 스토어 가격은 공식 스토어 값만 쓴다.

**한국 한글패치 허브** (fetch 차단. 검색 요약)
- **스팀앱** (steamapp.net/hangul): 국내 최대 유저 한국어패치 DB와 링크 모음. 스팀 계정 연동, 누락 패치 제보용 "건의" 탭 [S: fmkorea.com/5928759498, bbs.ruliweb.com/pc/board/300058/read/30576773].
- **한글로게임**: 사이트와 Steam 큐레이터를 함께 운영한다 [S]. **한패** (hanpe.net): "원작자 존중"을 표방하고 최신 업데이트 목록을 둔다 [S]. 기타: ITCM 한국어패치 DB, 한글모아 [S].
- **커뮤니티 관행**: 가이드들은 "지원 게임 버전, 빌드 ID, 최신 업데이트 날짜를 확인하라"고 안내한다 [S: vgamelifev.com 가이드].
- **Nerulio의 틈**:
  - 링크 DB 이상이 필요하다. **패치 버전 × 게임 빌드 × 리포트**를 연결하고, 게임이 업데이트되면 자동으로 "미확인"으로 표시한다.
  - 파일 호스팅은 금지하고 작성자 페이지만 링크한다. 이 규칙은 SEED-FORMAT 규칙 5에 있다.

### E. DAW와 플러그인 호환

- **Production Expert**: macOS 버전마다 호환 차트를 새로 만든다. Ventura, Sequoia, Tahoe, 그리고 다음 버전 "Golden Gate" 차트까지 있다. Apple Silicon 호환 DB도 있다(Native, Rosetta, 미지원) [S: production-expert.com/apple-macos-tahoe-audio-compatibility-chart, .../apple-silicon-audio-compatibility-guide].
- **Sweetwater**: 200개 이상 제조사의 호환 정보를 링크로 모은 가이드 [S: sweetwater.com/sweetcare/articles/macos-tahoe-26-compatibility-guide].
- **벤더 페이지**: UJAM, Neural DSP, Source Elements 등이 각자 공지한다. 형식이 제각각이고, "Ableton Live 11·12의 Tahoe 호환은 아직 업데이트 없음" 같은 상태가 흩어져 있다 [S].
- **Roaring Apps / Scan Pro Audio**: 검색에서 현행 자료를 찾지 못했다. 근거가 없으므로 판단하지 않는다.
- **Nerulio의 틈**:
  - 한국어로 된 **DAW 버전 × OS 버전 매트릭스**. 각 칸에 공식 벤더 성명(OFFICIAL)과 사용자 리포트(COMMUNITY)를 분리해서 표시한다.
  - "상태가 바뀌면 알림".
  - OS 베타 시즌(6~9월)이 트래픽 피크다 [K].

### F. 애니와 굿즈

- **AniList / AniChart**: 시즌 차트, 방영 캘린더와 카운트다운, 개인 리스트 연동. 광고와 기부로 운영한다 [S: anichart.net, anilist.co/forum/thread/2340].
- **MAL**: 광고, Supporter($2.99/월), 제휴. 2025-05에 Gaudiy가 인수했다 [S: myanimelist.net/membership/faq, achriom.com].
- **animeschedule.net**: 사용자 시간대 기준 편성표 [S].
- **애니시아**: 한국 애니 편성표와 자막 링크, 종영, 예정, 휴방 표시, 공개 API(데스크톱 앱이 사용). **애니플러스** 한일 동시방영 [S: github.com/qkdxorjs1002/AniSched-Desktop, aniplustv.com].
- **MyFigureCollection**: 85만 개 이상 항목. 위시리스트, 주문, 소장 목록, 발매 캘린더. **아이템별 changelog 종을 누르면 정보가 바뀔 때 알림**을 받는다 [S: musingsofanotaku.com, myfigurecollection.net/blogpost/24123].
- **Nerulio의 틈**:
  - "다음 화 KST 카운트다운 + 한국 OTT/방송 시간 + 휴방 여부"를 하나로 묶는다.
  - "예약 마감 D-n 굿즈" 패널: 공식 판매처 링크와 원화 가격, 루리웹 예판핫딜식 사용자 제보를 받는다.

---

## 4. Nerulio가 가져올 것 / 피할 것

### 가져올 것
- **한국 커뮤니티 문법**: 말머리 탭, 념글 탭(오늘, 주간, 월간), 글번호, [댓글수], 추천. 념글 기준은 DC처럼 **리젠 연동 동적 기준**(상한 있음)으로 하고, 채널마다 오버라이드할 수 있게 한다(아카라이브).
- **ProtonDB식 질문지 리포트**: 판정은 사이트가 계산하고, 1인 최신 1건만 집계하며, 로그인과 소유 신호를 쓰고, Wilson 하한으로 정렬하고, ODbL 공개 덤프를 제공한다.
- **SteamDB식 변경 이력**: 모든 엔티티(모델 가격, 서비스 상태, 게임 빌드, 패치 버전, 드라이버, DAW 버전, 방영 회차)에 **시간순 이벤트 타임라인**을 둔다. 관찰 시각과 원천 시각을 구분한다(gist의 교훈: "first seen"은 관찰값).
- **IsDown과 Downdetector 결합**: 공식 컴포넌트 상태를 1순위로, 사용자 신고의 기준선 대비 급증을 2순위로 보여준다. 24시간 차트, 증상별 집계, 공식 인시던트 링크를 둔다.
- **MFC, ITAD, AniList식 구독**: 엔티티 단위의 "변경 시 알림".
- **프로그래매틱 SEO 페이지**: "is X down", "{GPU}에서 돌아가는 로컬 LLM", "{게임} 한글패치 호환", "{DAW} {macOS} 호환". 단, **실데이터가 있는 페이지만** 인덱싱한다.

### 피할 것
- **나무위키식 자유 서술**: 출처 없는 의견과 추측은 위키 박스에 넣지 않는다. 사실은 행 단위로 쓰고 출처, 확인일, 라벨을 붙인다.
- **ProtonDB의 시간 무시 집계**: 오래된 빌드의 리포트가 현재 판정을 결정하지 않도록 한다.
- **단일 메달의 과신**: 판정은 항상 "근거 n건, 최근 빌드 기준 n건"과 함께 표시한다.
- **Downdetector식 원인 불명 급증 경보**: 경보 문구는 "신고 급증(원인 미확인)"과 "공식 인시던트"를 명확히 구분한다.
- **퀘이사존식 협찬 불투명**: 제휴 링크와 협찬은 표시를 강제하고, 이벤트 추첨은 기록을 공개한다.
- **DC식 완전 익명과 비밀번호 삭제**: 신뢰 신호를 쌓을 수 없으므로 리포트 작성에는 로그인을 요구한다.
- **아카라이브식 "위키 따로, 공지 따로" 분리**: 사용되지 않는 위키를 만들지 않도록, 념글과 공지에서 **원클릭으로 사실을 승격**시킨다.
- **차단되었거나 API가 없는 사이트의 스크래핑**(SteamDB, 한패 허브 등): 링크와 인용만 한다. 패치 파일 재호스팅은 금지한다.
- **출처 없는 tok/s 숫자**(GPU별 모델 페이지들): 추정값은 ESTIMATE 라벨과 계산식을 공개한다.

---

## 5. 우선순위 기능과 페이지 목록 (15)

노력: **S** = 며칠, **M** = 1~3주, **L** = 3주 이상. 기존 seed와 수집기 인프라(docs/n2/sources-*.md, SEED-FORMAT)를 전제로 한다.

1. **엔티티 변경 이력 타임라인** (공통 컴포넌트) · **M**
   - 무엇: 채널과 엔티티마다 "무엇이 언제 바뀌었나"를 시간순으로 보여준다. 대상은 가격, 상태, 빌드, 패치, 드라이버, DAW 버전, 회차.
   - 각 행에 관찰 시각, 원천 시각, 출처, 라벨을 붙인다.
   - 근거: SteamDB의 changelist와 빌드 이력이 가장 강한 재방문 요인이다 [F][S].
   - 모든 라이브 패널이 이 이벤트 로그 위에 올라간다.
2. **"지금 {서비스} 장애?" 페이지** (/c/claude/status 등) · **M**
   - 공식 상태 페이지 컴포넌트를 정규화해서 보여준다.
   - Nerulio 신고 버튼: 증상 선택(로그인, 응답 오류, 느림, 특정 모델, 결제)과 KST 24시간 차트.
   - 기준선 대비 급증 배지, 공식 인시던트 링크, 게시판 '장애' 말머리 최신 글을 함께 둔다.
   - 근거: Downdetector의 기준선 판정, IsDown과 StatusGator의 공식+크라우드 결합 [S]. 한국어 전용 페이지는 부재하다.
3. **한글패치 호환 리포트 폼** (ProtonDB 이식) · **M**
   - 필드:
     - 게임 빌드(자동 제안: 최신 업데이트 날짜와 버전), 패치 이름과 버전(작성자 링크), 설치 성공, 실행, 텍스트 표시.
     - 결함 체크: 미번역, 깨짐, 폰트, 크래시, 세이브, 업적.
     - 조치: 파일 교체, 폰트, 런처. 플랫폼: Windows, Steam Deck. 메모.
   - 판정(작동, 부분, 불가)은 사이트가 계산한다. 1인 최신 1건만 집계하고, Steam 연동 시 소유와 플레이타임 배지를 붙인다.
   - 근거: ProtonDB 스키마 [F], 운영 규칙 [S].
4. **패치-빌드 불일치 자동 경고** · **S**
   - 게임의 `last_update_at`이 패치의 마지막 "작동" 리포트보다 새로우면 "게임 업데이트 이후 미확인"으로 표시하고, 리포트 작성을 유도한다.
   - 근거: 한패 허브에는 없는 기능이다. 커뮤니티 가이드가 사람에게 수동 확인을 요구한다 [S].
   - 기존 steam-news 수집기를 그대로 활용한다.
5. **엔티티 구독과 알림** ("이 패치나 모델 가격, 상태가 바뀌면 알려줘") · **M**
   - 근거: MFC의 changelog 종, ITAD 위시리스트, StatusGator 알림 [S].
   - 재방문 엔진이다. 1번 타임라인 이벤트를 트리거로 쓴다.
6. **채널 게시판 한국형 UX 완성** · **M**
   - 말머리 탭, 념글 탭(오늘, 주간, 월간), 글번호, [댓글수], 공지 고정.
   - 동적 념글 기준: 최근 N일 추천 분포의 상위 분위수에 상한을 둔다. 채널별 오버라이드를 허용한다.
   - 근거: DC 마이너갤의 자동 기준(최대 100), 아카라이브의 채널별 설정, 루리웹 BEST의 기간 필터 [S].
7. **념글과 공지에서 위키 사실로 승격하는 흐름** · **M**
   - 글에서 "사실 제안"을 만든다: 값, 출처 URL, 확인일.
   - 관리자나 평판 사용자가 승인하면 COMMUNITY 사실 행이 되고, 원 글에 역링크를 단다.
   - 근거: 아카라이브 채널 위키가 공지 관행 때문에 쓰이지 않는다 [S]. 나무위키의 출처 문제 [S].
8. **GPU 채널: 로컬 LLM 적합 패널 + 실측 리포트** · **M**
   - 추정: VRAM = 가중치 + KV 캐시 + 오버헤드. 계산식을 공개하고 ESTIMATE 라벨을 붙인다.
   - 실측 리포트 폼: GPU, 드라이버, 백엔드, 모델, 양자화, 컨텍스트, tok/s, 프롬프트 처리 속도.
   - 실측이 추정보다 우선한다.
   - 근거: apxml 계산기 방식, r/LocalLLaMA의 실측 문화 [S] [K]. 경쟁 페이지들의 출처 불명 수치 [S].
9. **"{GPU}에서 돌아가는 로컬 LLM" 프로그래매틱 페이지** · **S** (8번 이후)
   - 근거: willitrunai, llmrun, modelfit, turbollm이 영어 쿼리를 점유하고 있다 [S]. 한국어는 부재하다.
   - 실측이 1건 이상 있거나 공개 추정식이 있는 조합만 인덱싱한다.
10. **AI 채널 모델 가격표(USD 공식가 + 가격 변경 이력)** · **S**
    - 공식 가격 페이지만 출처로 쓴다. 원화 환산은 note로 두고 사실로 기록하지 않는다(SEED-FORMAT 규칙 6).
    - Artificial Analysis와 OpenRouter 수치는 링크로 인용한다.
    - 근거: 두 사이트는 영어와 USD 기준이다 [S]. 가격 변경은 1번 타임라인의 좋은 이벤트다.
11. **DAW 버전 × OS 버전 호환 매트릭스** · **M**
    - 각 칸을 공식 벤더 성명(OFFICIAL, 날짜)과 사용자 리포트(COMMUNITY: 작동, 문제, 불가)로 나눈다. macOS 새 버전마다 열을 추가한다.
    - 근거: Production Expert가 OS마다 차트를 새로 만든다. Sweetwater는 200개 이상 벤더 링크를 모은다. 벤더 공지는 흩어져 있다 [S].
12. **애니 다음 화 카운트다운(KST) + 한국 방영, OTT, 휴방 표시** · **S~M**
    - 근거: AniChart의 카운트다운, 애니시아의 휴방과 종영 표시와 공개 API, 애니플러스 동시방영 [S].
    - 한국 시간 기준 통합이 비어 있다.
13. **굿즈 예약 마감 캘린더 + 사용자 제보** · **M**
    - 공식 판매처 링크, 원화 가격, 예약 마감일, 발매 예정 월을 보여준다. 사용자 제보를 받고 확인되면 승격한다.
    - 근거: MFC 발매 캘린더와 아이템 구독, 루리웹 예판핫딜 게시판 [S].
14. **리포트 공개 데이터 덤프** (ODbL, 월별) · **S**
    - 근거: ProtonDB가 ODbL로 월별 덤프를 공개하고, 생태계 도구(Decky 배지, 브라우저 확장)가 이를 이용한다 [F][S].
    - 신뢰, 백링크, 외부 도구 생태계를 얻는다. 스키마 버전을 명시한다(ProtonDB 이슈 #7의 교훈).
15. **신뢰 정렬과 표기 체계** · **S~M**
    - Wilson 하한 정렬, "최근 빌드 기준 n건 / 전체 n건", 협찬과 제휴 배지 강제.
    - 판정 산식 공개 페이지(/about/ratings)를 둔다.
    - 근거: ProtonDB의 wilsonRating 정렬과 2019년 등급 개편 [S], 등급 인플레 비판 [S], 퀘이사존 협찬과 이벤트 논란 [S].

### 권장 순서
- **1단계** (채널 출시 필수): 1, 6, 2, 4, 10
- **2단계** (차별화): 3, 5, 7, 8
- **3단계** (확장과 SEO): 9, 12, 11, 13, 14, 15

---

## 6. 참고 URL

- **ProtonDB**
  - https://github.com/bdefore/protondb-data
  - https://github.com/maxpoulin64/protondb-api/issues/7
  - https://boilingsteam.com/protondb-ratings-revised/
  - https://github.com/ValveSoftware/Proton/issues/2638
  - https://www.protondb.com/help/site-questions
  - https://www.protondb.com/explore?page=0&sort=wilsonRating
- **SteamDB**
  - https://gist.github.com/mdeguzis/35116dbf762d4e71966bbe89062653c5
  - https://steamdb.info/faq/
  - https://steamdb.info/patchnotes/
  - https://tech-insider.org/steamdb-vs-isthereanydeal-vs-gg-deals-2026/
- **장애 모니터링**
  - https://isdown.app/status/anthropic
  - https://isdown.app/status/claude-ai
  - https://statusgator.com/features/early-warning-signals
  - https://statusgator.com/plans
  - https://isthatdown.com/resources/what-is-downdetector
  - https://en.wikipedia.org/wiki/Downdetector
  - https://news.slashdot.org/story/26/03/03/1825201/accenture-acquires-ookla-downdetector-as-part-of-12-billion-deal
- **모델 비교**
  - https://artificialanalysis.ai/models
  - https://openrouter.ai/docs/guides/routing/provider-selection
  - https://arena.ai/faq
  - https://arena.ai/blog/leaderboard-changelog
- **하드웨어와 로컬 LLM**
  - https://apxml.com/tools/vram-calculator
  - https://willitrunai.com/gpus/rtx-5070-12gb
  - https://llmrun.dev/gpu/rtx-5070
  - https://modelfit.io/gpu/rtx-5070/
  - https://nvidiareview.com/techpowerup-gpu/
- **게임 가격과 한글패치**
  - https://docs.isthereanydeal.com/
  - https://www.fmkorea.com/5928759498
  - https://bbs.ruliweb.com/pc/board/300058/read/30576773
  - https://hanpe.net/hanguls
  - https://www.hangulogame.com/
- **DAW 호환**
  - https://www.production-expert.com/apple-macos-tahoe-audio-compatibility-chart
  - https://www.sweetwater.com/sweetcare/articles/macos-tahoe-26-compatibility-guide/
- **애니와 굿즈**
  - https://anichart.net/airing
  - https://anilist.co/forum/thread/2340
  - https://myanimelist.net/membership/faq
  - https://github.com/qkdxorjs1002/AniSched-Desktop
  - https://myfigurecollection.net/blogpost/24123
- **한국 커뮤니티**
  - https://thewiki.kr/w/아카라이브/채널
  - https://siderlab.kr/blog/20009-arcalive-channel-popular-boards-guide/
  - https://namu.wiki/w/채널위키
  - https://namu.wiki/w/디시인사이드/마이너%20갤러리
  - https://ko.wikipedia.org/wiki/디시인사이드의_용어
  - https://namu.wiki/w/퀘이사존
  - https://quasarzone.com/bbs/qc_bench
  - https://namu.wiki/w/루리웹/게시판
  - https://namu.wiki/w/나무위키/비판%20및%20문제점
