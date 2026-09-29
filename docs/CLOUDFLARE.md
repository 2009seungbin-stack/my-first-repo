# Cloudflare 구성 (Pages + Worker + D1 + Turnstile)

> 이 문서의 대시보드 작업은 **아직 수행되지 않았다.** 저장소에는 코드·migration·테스트만 있다. 아래 순서대로 운영자가 진행하고, 각 단계의 확인이 끝난 뒤 다음으로 넘어간다. 실제 ID·키 값은 여기 적지 않는다.

## 구성 요소

| 항목 | 이름 / 값 |
| --- | --- |
| Pages 프로젝트 | 기존 `fileforge-studio` (Git 연동, `npm run build`, 출력 `dist`) |
| Worker | `dist/_worker.js/` 디렉터리 (advanced mode, `index.js` 진입). `/functions` 폴더는 쓰지 않는다 |
| D1 | production `nerulio-prod`, preview `nerulio-preview`, 바인딩 이름 **`DB`** |
| 호환 날짜 | Settings → Runtime → Compatibility date `2026-09-18` (로컬 검증 기준) |
| Turnstile | Managed 위젯 1개 (운영 도메인 + 필요 시 pages.dev) |

저장소 루트에 `wrangler.toml`을 두지 않는다. 두면 Pages가 그 파일을 프로젝트 설정의 기준으로 삼아 대시보드의 변수·바인딩 설정을 대체한다. D1 migration 전용 설정은 `ops/d1.wrangler.toml`에 있다.

## 변수와 secret

Pages → Settings → Variables and Secrets. **Production과 Preview에 따로** 설정한다. secret은 "Encrypt"(Secret) 유형으로 넣는다. Git·소스·프런트엔드 번들에 들어가지 않는다(빌드 테스트가 dist 전체에서 secret 값 누출을 검사한다).

| 이름 | 유형 | 용도 |
| --- | --- | --- |
| `SERVICE_API` | 변수(빌드) | `on`이어야 계정 계층이 빌드된다. 없으면 기존 정적 사이트 |
| `TOOL_METERING` | 변수(빌드+런타임) | 기본 켜짐. `off`면 계정·플랫폼은 유지하고 도구의 Free/Pro 미터링(하루 한도·업그레이드/로그인 대화상자·fail-closed·요금제별 광고)을 끈다. 도구 페이지는 `SERVICE_API` 없는 빌드와 같고 `/pricing/`은 만들지 않는다. `on`은 `SERVICE_API=on`이 필요 ([아래](#도구-미터링-끄기-tool_meteringoff)) |
| `SITE_URL` | 변수 | 기존과 동일 (canonical 등) |
| `FREE_DAILY_JOBS` | 변수 | Free heavy 작업/일 (파일 도구). 기본 30 |
| `FREE_DAILY_STUDIO_EXPORTS` | 변수(빌드+런타임) | Free 스튜디오 엔진 내보내기/일. 기본 10. 가격 페이지 문구와 Worker 한도가 같은 값을 쓴다 ([PRICING-MODEL.md](PRICING-MODEL.md)) |
| `ADSENSE_SLOT_STUDIO` | 변수(빌드) | 스튜디오 데스크톱 광고 칸의 광고 단위 ID(10자리). `ADSENSE_CLIENT`와 `ADSENSE_CMP_READY=true`가 있어야 켜진다 ([ADS.md](ADS.md)) |
| `ANON_NETWORK_DAILY_JOBS` | 변수 | 익명 네트워크 버킷 Turnstile 기준. 기본 한도×4 |
| `PRO_PRICE_AMOUNT`, `PRO_PRICE_CURRENCY`, `PRO_PRICE_INTERVAL` | 변수(빌드) | 가격 표시 (`4.99`, `USD`, `month`). 없으면 "가격은 출시 시 공개" |
| `GOOGLE_OAUTH_CLIENT_ID` | 변수 | Google OAuth 클라이언트 ID. **보류 중**: ID와 secret이 둘 다 있을 때만 Google 버튼이 보인다 |
| `GOOGLE_OAUTH_CLIENT_SECRET` | **secret** | |
| `GITHUB_OAUTH_CLIENT_ID` | 변수 | GitHub OAuth App의 Client ID. 환경마다 다른 앱([소셜 로그인](#소셜-로그인-github--discord--google)) |
| `GITHUB_OAUTH_CLIENT_SECRET` | **secret** | 같은 앱의 client secret |
| `DISCORD_OAUTH_CLIENT_ID` | 변수 | Discord 애플리케이션의 Client ID (preview·production 같은 앱 가능) |
| `DISCORD_OAUTH_CLIENT_SECRET` | **secret** | 같은 애플리케이션의 Client Secret |
| `SESSION_SECRET` | **secret** | 32자 이상 무작위. production/preview 서로 다르게. 바꾸면 모든 익명 식별자와 OAuth 진행 중 상태가 무효화됨(세션은 유지) |
| `TURNSTILE_SITE_KEY` | 변수 | 공개 site key |
| `TURNSTILE_SECRET_KEY` | **secret** | |
| `BILLING_PROVIDER` | 변수 | `none`(기본) / `sandbox`(preview 전용) / `paddle` |
| `BILLING_MODE` | 변수 | `sandbox` / `live` (live는 production만) |
| `BILLING_PRICE_ID` | 변수 | 결제사 가격 ID |
| `BILLING_API_KEY`, `BILLING_WEBHOOK_SECRET` | **secret** | 결제사 자격 증명 |
| `ADMIN_GOOGLE_SUBJECTS` | 변수 | 관리자 Google `sub` 목록 (쉼표) |
| `NERULIO_ENV` | — | 로컬 테스트 전용(`development`). Pages 빌드에서는 무시된다 |
| `TICKET_PRIVATE_KEY` | **secret** | `node tools/ticket-keys.mjs`로 생성. 권한 응답 서명(ECDSA P-256). production/preview 따로 |
| `TICKET_PUBLIC_KEY` | 변수 | 같은 도구의 공개 키. 빌드가 페이지에 넣는다 |
| `SESSION_SECRET_PREVIOUS` | **secret** | `SESSION_SECRET` 교체 시 이전 값(몇 주). 없으면 교체 순간 모든 익명 사용량이 초기화된다 |
| `FREE_ANON_STUDIO_EXPORTS` | 변수 | 계정 없이 하루 스튜디오 내보내기(기본 3, 0=항상 로그인) |
| `ANON_NETWORK_STUDIO_EXPORTS`, `ANON_NETWORK_DAILY_JOBS`, `NETWORK_DAILY_HARD_LIMIT`, `NETWORK_WIDE_DAILY_HARD_LIMIT` | 변수 | 네트워크 버킷(기본 30 / 160 soft·Turnstile / 800 / 3200) |
| `OFFLINE_GRACE_EXPORTS`, `API_RATE_PER_MINUTE`, `MAX_SESSIONS_PER_USER`, `PAST_DUE_GRACE_DAYS`, `PRO_SHARING_NETWORKS` | 변수 | 기본 3 / 120 / 5 / 7 / 10 |
| `PRO_PRICE_MONTHLY_AMOUNT`, `PRO_PRICE_YEARLY_AMOUNT`, `PRO_PRICE_CURRENCY` | 변수 | 표시 가격(예: 4.99 / 40 / USD). 연간 절약률은 계산 |
| `BILLING_PRICE_ID_YEARLY`, `BILLING_PRICE_IDS_LEGACY` | 변수 | 연간 가격 ID, Pro로 인정할 옛 가격 ID 목록 |

`SESSION_SECRET` 생성 예: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

변수 변경은 **다음 배포부터** 반영된다. 변경 후 재배포한다.

## 운영자 작업 순서

1. **D1 생성**: `npx wrangler d1 create nerulio-prod`, `npx wrangler d1 create nerulio-preview` (또는 대시보드 Storage & Databases → D1). 출력된 `database_id`를 `ops/d1.wrangler.toml`에 기입.
2. **Migration 적용** (preview 먼저):
   `npx wrangler d1 migrations apply nerulio-preview --remote --config ops/d1.wrangler.toml` → 확인 후 `nerulio-prod`.
   `npx wrangler d1 migrations list <db> --remote --config ops/d1.wrangler.toml`로 적용 상태 확인.
3. **바인딩**: Pages → Settings → Bindings → Add → D1 database, Variable name `DB`. Production → `nerulio-prod`, Preview → `nerulio-preview`.
4. **Turnstile**: 대시보드 Turnstile → Add widget → 호스트 이름 등록 → Managed → site key/secret을 위 변수에 설정.
5. **소셜 로그인**: [아래 절](#소셜-로그인-github--discord--google) — GitHub·Discord 먼저. Google은 보류(키가 없으면 버튼이 숨는다). 참고로 Google 절차: Google Cloud Console → APIs & Services → OAuth consent screen(범위 `openid email profile`) → Credentials → OAuth client ID(Web application) → Authorized redirect URIs에 `https://<운영 도메인>/api/v1/auth/google/callback` 등록(pages.dev나 preview 호스트에서도 로그인하려면 각각 추가). JavaScript origin은 필요 없다.
6. **Secret 설정**: `SESSION_SECRET`, `GITHUB_OAUTH_CLIENT_SECRET`, `DISCORD_OAUTH_CLIENT_SECRET`, (나중에) `GOOGLE_OAUTH_CLIENT_SECRET`, `TURNSTILE_SECRET_KEY` (Production/Preview 각각).
7. **배포**: Preview 환경에 먼저 `SERVICE_API=on`을 설정하고 브랜치를 push. Production은 preview 검증 후.
8. **`/api/v1/health` 확인**: `{"configured":true,"database":true,...}`. `configured:false`면 `DB` 바인딩 또는 `SESSION_SECRET`(32자 이상) 누락.
9. **익명 quota 확인**: preview에 `FREE_DAILY_JOBS=2`로 배포 → 시크릿 창에서 heavy 도구(예: `/ko/image/upscale/`) 3회 → 3번째에 업그레이드 모달, 파일 유지 확인. 가벼운 도구는 계속 동작해야 한다. 이후 원래 값으로 되돌린다.
9b. **스튜디오 한도 확인**: preview에 `FREE_DAILY_STUDIO_EXPORTS=2` → 시크릿 창에서 `/ko/game/studio/?ws=pack`에 이미지를 넣고 엔진 내보내기 3회 → 3번째에 스튜디오 한도 대화상자, 프로젝트 유지, 대화상자의 "프로젝트 저장"으로 `.nerulio` 저장 확인. 이후 원래 값으로 되돌린다.
10. **테스트 Pro 확인** (결제 없이 운영자가 부여):
    ```sh
    npx wrangler d1 execute nerulio-preview --remote --config ops/d1.wrangler.toml --command "SELECT id,email FROM users"
    npx wrangler d1 execute nerulio-preview --remote --config ops/d1.wrangler.toml --command "INSERT INTO subscriptions(provider,external_subscription_id,user_id,plan,status,current_period_end,cancel_at_period_end,updated_at) VALUES('manual','manual-test-1','<USER_ID>','pro','active',<만료 epoch ms>,0,<현재 epoch ms>)"
    ```
    헤더 Pro 배지, 광고 요청 0(스튜디오 포함: 광고 칸 없음, 캔버스가 전체 폭), heavy·스튜디오 내보내기 무제한을 확인한 뒤 행을 삭제한다. `provider='manual'`은 결제가 아니라 운영자 부여임을 기록으로 남긴다.
11. **그 다음에만 결제 연결**: [BILLING.md](BILLING.md)의 출시 순서를 따른다.

## 도구 미터링 끄기 (`TOOL_METERING=off`)

로그인 제공자와 결제가 준비되기 전에 Nerulio 2.0 플랫폼을 운영에 켤 때 쓴다. `SERVICE_API=on`은 원래 도구의 Free/Pro 미터링도 함께 켜는데, 로그인·결제가 없으면 한도에 걸린 사용자가 막힌다. 이 변수로 미터링만 끈다. 규칙은 [PRICING-MODEL.md](PRICING-MODEL.md#도구-미터링-끄기-tool_meteringoff).

| 항목 | `TOOL_METERING=off` | 기본(켜짐) |
| --- | --- | --- |
| 도구·스튜디오·랜딩·정책 페이지 HTML | `SERVICE_API` 없는 빌드와 같음(방문 통계 비콘만 추가) | 계정 meta + `/me` |
| 도구 페이지의 `/api/v1` 호출 | 없음 | 페이지당 `/me` 1회 + heavy 작업마다 `authorize` |
| 한도·업그레이드·로그인 대화상자·오프라인 토큰 | 없음 | 있음 |
| 광고 | 모두에게 표시(광고 단위가 설정된 경우) | Free에게만, `/me` 뒤 |
| `/pricing/` | 만들지 않음, 사이트맵에 없음 | 있음 |
| 계정 페이지 | 로그인·연결된 로그인·로그아웃 | + 요금제·사용량·업그레이드 |
| `/api/v1/jobs/authorize` (오래된 탭) | 항상 `allowed:true, metered:false`, D1 쓰기 없음 | 계량 |
| `/api/v1/billing/checkout` | `503 BILLING_UNAVAILABLE` | 결제사로 |
| 세션·`/api/v1/auth/*`·`/api/v2`·관리 앱·방문 통계 | 그대로 | 그대로 |

설정: Production(과 확인용 Preview)의 Variables에 `TOOL_METERING=off`를 **변수 하나로** 넣는다(Pages는 같은 변수를 빌드와 Worker 런타임에 모두 준다). 재배포 후 확인:

1. `/api/v1/health` → `"metering":false`.
2. 도구 페이지 소스에 `nerulio-service`가 없고, DevTools 네트워크 탭에서 도구 실행 시 `/api/v1/` 요청이 0건.
3. `/ko/pricing/` → 404, `/ko/account/`는 로그인 버튼만.

나중에 로그인·결제가 준비되면 변수를 지우고(또는 `on`) 재배포하면 기존 미터링이 그대로 돌아온다. 이때 요금제 페이지가 다시 생기고 사이트맵에 추가된다.

## Worker 라우팅과 비용

`_routes.json`은 빌드가 생성한다.

| 빌드 | `include` | `exclude` | Worker 호출 |
| --- | --- | --- | --- |
| 서비스만 | `/api/*`, `/_worker.js/*` | — | API 호출 시에만. HTML·JS·CSS·이미지·예제는 정적 제공 |
| 서비스 + 광고 | `/*` | `/src/*`, `/assets/*`, `/ai-runtime/*`, `/verify/*`, CSS, favicon, robots, sitemap들, ads.txt | HTML(응답별 nonce CSP 필요)과 API만 |
| 서비스 + 플랫폼 (`PLATFORM=on`, 기본 `TRAFFIC_HTML` on) | `/*` | 위 정적 목록에서 robots·sitemap을 뺀 것 + `/favicon.ico`, `/apple-touch-icon.png`, `/build.txt`, `/404.html` | 모든 HTML·robots·sitemap·API (방문자·봇 통계) |
| 서비스 + 플랫폼, `TRAFFIC_HTML=off` | `/api/*`, `/_worker.js/*`, 플랫폼 경로들, `/robots.txt`, `/sitemap*` | — | 플랫폼 페이지·robots·sitemap·API만. 도구 HTML은 정적 |

호출량 추정: 페이지 보기 1회 = `/me` 1회 (+ 광고 빌드에서는 HTML 1회). heavy 작업 1회 = `authorize` 1회. 진행률 폴링은 없다(진행률은 로컬 엔진이 관리). 결제 후 활성화 확인만 최대 5회 재조회한다.

D1 사용량(대략): 익명 `/me`는 쿠키가 있으면 1행 읽기, 첫 방문은 0. heavy 작업 1회는 한 트랜잭션에서 약 4행 쓰기(작업 기록 삽입·확정, 일일 카운터, 네트워크 버킷). 요금·무료 한도(작성 시점 Workers Free 일 10만 요청, D1 Free 일 500만 행 읽기·10만 행 쓰기)는 변경될 수 있으므로 대시보드의 현재 요금표로 확인한다. 파일 크기는 API 비용과 무관하다(2 GB 영상도 `{toolId, operationId}` 한 번).

## 방문자·봇 통계 (Workers Analytics Engine)

관리자 앱의 방문자 화면(`GET /api/v2/admin/traffic`)과 개요의 `traffic` 블록이 쓰는 데이터다. 코드: `server/traffic.js`, 비콘 `src/hit.js`. **요청마다 D1 행을 쓰지 않는다** — 이벤트는 전부 Analytics Engine 데이터 포인트이고 D1 사용량은 0이다. `SERVICE_API=on` + `PLATFORM=on` 빌드에만 들어간다(그 외 빌드는 바이트 단위로 그대로).

무엇을 세는가:

- **사람**: 모든 페이지(정적 페이지·플랫폼 페이지·요금/계정 페이지)에 `<script src="/src/hit.js" defer>`가 들어간다. 페이지가 약 1초 이상 보이거나 첫 조작이 있을 때 `navigator.sendBeacon('/api/v2/hit')` 한 번. 전송 내용은 경로(쿼리 제거, 게시판 `kind`·`sort`만 유지), 유입 분류(search/social/ai/direct/internal/other), 기기 종류, 브라우저 언어, 방문 첫 페이지 여부뿐이다. 쿠키·식별자 없음. 사이트 전체가 `Referrer-Policy: no-referrer`라 내부 이동은 referrer가 비어 있으므로, 탭의 sessionStorage 플래그 `nerulio.hit`로 내부 이동과 방문 시작을 구분한다. 비콘 요청의 UA가 봇(예: 자바스크립트를 실행하는 Googlebot 렌더러)이거나 `navigator.webdriver`면 사람이 아니라 봇으로 센다.
- **봇**: Worker가 받는 HTML·`/robots.txt`·`/sitemap*.xml`·피드 요청마다 데이터 포인트 1개. 분류는 순수 함수 `classify()` — Cloudflare `cf.verifiedBotCategory`/`cf.botManagement`(Enterprise 전용, Free·Paid에는 없음) → 공식 UA 문서 기반 표(검색·AI·SEO·소셜·모니터링) + 운영사 ASN 일치 시 `verified`, 불일치 시 `declared`(위조 가능) → HTTP 라이브러리·헤드리스·빈 UA·비브라우저 UA·호스팅 ASN·`Accept-Language`/`Sec-Fetch-Mode` 없는 브라우저 탐색은 `suspected` → 나머지는 사람 후보(`candidate`, 비콘이 오면 사람으로 확정).
- 저장하지 않는 것: IP(분당 버스트 제한이 메모리에서 1분만 쓴다), 사람의 UA 문자열(브라우저 계열·기기 종류만), 쿼리 문자열. DNT/GPC는 따로 존중하지 않는다 — 식별자·쿠키·교차 사이트 추적이 없는 1st-party 합계라서. 개인정보처리방침(`/privacy/`)에 한·영·일로 표시된다(`TRAFFIC_NOTE`).

### 운영자 설정 (소유자 작업, Production·Preview 각각)

1. **바인딩**: Workers & Pages → 프로젝트 → Settings → Bindings → Add → **Analytics engine** → Variable name `TRAFFIC`, Dataset `nerulio_traffic` → 저장 후 재배포. Production과 Preview에 같은 데이터셋을 써도 된다(각 포인트에 `production`/`preview`가 기록되고 조회가 자기 환경만 본다). 바인딩이 없으면 쓰기는 조용히 건너뛰고 비콘은 204를 받는다.
2. **토큰**: My Profile → API Tokens → Create Custom Token → 권한 **Account · Account Analytics · Read**, Account Resources는 이 계정만 → Pages secret `CF_ANALYTICS_TOKEN`. 같은 토큰을 D1 사용량 화면도 쓴다.
3. **계정 ID**: Pages 변수 `CF_ACCOUNT_ID`(대시보드 오른쪽의 32자리 hex). 데이터셋 이름을 바꿨다면 변수 `TRAFFIC_DATASET`.
4. 셋 중 하나라도 없으면 `/api/v2/admin/traffic`은 `503 {need, error:{code:'NOT_CONFIGURED'}}`를 주고 앱은 "설정 필요"를 표시한다. `need`는 `TRAFFIC` → `CF_ACCOUNT_ID` → `CF_ANALYTICS_TOKEN` 순서로 첫 번째 빠진 것.

### `TRAFFIC_HTML` 플래그와 비용

플랫폼 빌드의 기본값은 **on**: 모든 HTML이 Worker를 거쳐(`env.ASSETS.fetch`로 그대로 전달) 도구 페이지의 봇까지 보인다. 빌드 변수 `TRAFFIC_HTML=off`면 정적 HTML은 Worker를 거치지 않아 봇은 robots·sitemap·플랫폼 페이지에서만 보인다(사람은 비콘으로 계속 집계). 화면의 `coverage.workerSeesHtml`/`note`가 현재 상태를 알려 준다.

계정은 **Workers Paid**다(2026-09 기준 포함량, 대시보드 요금표로 재확인):

| 항목 | 포함량 / 월 | 초과 | 통계가 쓰는 양 |
| --- | --- | --- | --- |
| Workers 요청 (Pages Functions 포함) | 1,000만 | 100만당 $0.30 | HTML 요청 1 + 사람 페이지뷰당 비콘 1 + robots/sitemap |
| Workers CPU | 3,000만 CPU-ms | 100만 CPU-ms당 $0.02 | 요청당 약 1 ms 미만(분류 + 전달) |
| Analytics Engine 쓰기 | 1,000만 데이터 포인트 | 100만당 $0.25 | 위 요청 1개당 1개 |
| Analytics Engine 읽기 | 100만 쿼리 | 100만당 $1.00 | 화면 새로고침 1회당 5쿼리(분 단위 캐시) |
| D1 | 읽기 250억·쓰기 5,000만 행 | — | **0** (통계는 D1을 쓰지 않는다) |

계산 예: 사람 페이지뷰 하루 1만 + 봇 HTML 하루 2만 → Worker 요청 ≈ 1만(HTML) + 1만(비콘) + 2만(봇) = 하루 4만 = 월 120만 — 포함량의 12%. 포함량을 넘기는 지점은 하루 약 33만 요청이며, 그 두 배(하루 66만, 월 2,000만)여도 초과 요금은 약 $3다. Analytics Engine은 작성 시점에 과금이 시작되지 않았다. 데이터 보관은 3개월(30일 범위까지 조회).

## Rate limiting

Cloudflare Rate Limiting은 스팸·버스트 방지용이다. 정확한 하루 30회 계산은 D1이 한다. **커스텀 도메인(Cloudflare zone)** 이 필요하며 `*.pages.dev`에는 WAF 규칙을 걸 수 없다. 권장 규칙 예 (Security → WAF → Rate limiting rules): 커스텀 도메인이 생기기 전에는 Worker 안의 분당 제한(`API_RATE_PER_MINUTE`, 네트워크당, 격리 인스턴스 단위)이 폭주만 막는 임시 장치로 동작한다 — 도메인을 산 뒤 아래 규칙을 추가한다(소유자 작업).

- `starts_with(http.request.uri.path, "/api/v1/auth/")` — IP당 10초 20회 초과 시 차단 (GitHub·Discord·Google 시작/콜백 모두 이 경로)
- `starts_with(http.request.uri.path, "/api/v1/")` — IP당 10초 60회 초과 시 Managed Challenge

## Preview 환경

- `CF_PAGES_BRANCH != main` 빌드는 기존대로 광고 off, `noindex`, robots Disallow.
- `nerulio-preview` D1을 바인딩해 운영 구독 데이터를 건드리지 않는다.
- `BILLING_PROVIDER=sandbox`는 preview에서만 동작하고, `BILLING_MODE=live`는 preview에서 자동 거부된다.
- preview 호스트에서 로그인하려면 그 호스트의 callback URL을 각 제공자에 등록해야 한다. 등록한 호스트는 `https://n2-preview.nerulio.pages.dev` 하나(브랜치 별칭)이며, 다른 preview 주소(커밋별 `*.nerulio.pages.dev`)에서는 제공자가 redirect 불일치로 거부한다.

## 소셜 로그인 (GitHub · Discord · Google)

커뮤니티 회원 로그인. 코드: `server/oauth/` (공통 흐름 `flow.js`, 제공자별 `github.js`·`discord.js`·`google.js`), 설명은 [AUTH.md](AUTH.md). 각 제공자는 **client ID(변수)와 client secret(secret)이 둘 다 있을 때만** 버튼이 나타난다 — 하나라도 없으면 그 제공자는 모든 화면에서 숨고 `/api/v1/health`의 해당 값이 `false`다. Google은 코드가 준비되어 있지만 Google Cloud 약관 문제로 **보류**: `GOOGLE_OAUTH_*`를 넣지 않으면 계속 숨는다.

callback URL은 로그인을 시작한 호스트의 `/api/v1/auth/{github|discord|google}/callback`이다(state 쿠키가 host-only라 같은 호스트로 돌아와야 한다).

| 환경 | 호스트 | GitHub callback | Discord redirect |
| --- | --- | --- | --- |
| Preview | `https://n2-preview.nerulio.pages.dev` | `https://n2-preview.nerulio.pages.dev/api/v1/auth/github/callback` | `https://n2-preview.nerulio.pages.dev/api/v1/auth/discord/callback` |
| Production | `https://nerulio.com` | `https://nerulio.com/api/v1/auth/github/callback` | `https://nerulio.com/api/v1/auth/discord/callback` |

`*.pages.dev`의 운영 주소는 nerulio.com으로 301되므로 production은 nerulio.com만 등록한다.

### 0. 먼저 D1 migration (preview → production)

로그인 수단 표(`user_identities`)가 `migrations/0011_identities.sql`에 있다. **코드 배포 전에** 적용한다(기존 Google 계정은 자동으로 옮겨진다).

```sh
npx wrangler d1 migrations apply nerulio-preview --remote --config ops/d1.wrangler.toml
npx wrangler d1 migrations list nerulio-preview --remote --config ops/d1.wrangler.toml   # 0011 적용 확인
# preview 확인이 끝난 뒤
npx wrangler d1 migrations apply nerulio-prod --remote --config ops/d1.wrangler.toml
```

### 1. GitHub OAuth App (환경마다 하나씩)

GitHub OAuth App은 앱마다 client secret이 하나라서, preview secret이 새어도 production에 영향이 없도록 **preview용과 production용 앱을 따로** 만든다. (현재 GitHub은 앱 하나에 callback URL을 여러 개(최대 10개) 받지만, 앱을 나누는 편이 안전하고 동의 화면의 앱 이름으로 환경을 구분할 수 있다.)

1. GitHub 오른쪽 위 프로필 사진 → **Settings** → 왼쪽 아래 **Developer settings** → **OAuth Apps** → **New OAuth App** (처음이면 **Register a new application**).
2. 입력:
   - **Application name**: `Nerulio (preview)` / production은 `Nerulio`
   - **Homepage URL**: `https://n2-preview.nerulio.pages.dev` / `https://nerulio.com`
   - **Application description**: 비워도 된다(동의 화면에 보인다)
   - **Authorization callback URL**: 위 표의 GitHub callback (preview: `https://n2-preview.nerulio.pages.dev/api/v1/auth/github/callback`, production: `https://nerulio.com/api/v1/auth/github/callback`)
   - **Enable Device Flow**: 끈 채로 둔다
3. **Register application**.
4. 앱 화면의 **Client ID**를 복사 → Pages 변수 `GITHUB_OAUTH_CLIENT_ID`.
5. **Generate a new client secret** → 한 번만 보이는 값을 복사 → Pages secret `GITHUB_OAUTH_CLIENT_SECRET`.
6. (선택) 로고: 앱 화면 **Upload new logo**에 `assets/brand`의 아이콘. 동의 화면에만 쓰인다.

권한 범위는 코드가 요청한다: `read:user user:email`(읽기 전용). 저장하는 것은 GitHub **숫자 사용자 ID**(로그인 이름은 바뀔 수 있어 키로 쓰지 않음), 표시 이름, 로그인 이름(닉네임 제안용), **인증된 기본 이메일**(없을 수 있음)뿐이다. 액세스 토큰은 콜백 안에서 두 번 읽고 버린다.

### 2. Discord 애플리케이션 (preview·production 공용 하나)

Discord는 애플리케이션 하나에 redirect를 여러 개 등록할 수 있다.

1. <https://discord.com/developers/applications> → 오른쪽 위 **New Application** → 이름 `Nerulio` → 약관 동의 → **Create**.
2. 왼쪽 **OAuth2** 메뉴.
3. **Client information**의 **Client ID** 복사 → Pages 변수 `DISCORD_OAUTH_CLIENT_ID` (Production·Preview 둘 다 같은 값).
4. **Client Secret** → **Reset Secret** → 확인 후 나타난 값 복사 → Pages secret `DISCORD_OAUTH_CLIENT_SECRET` (둘 다 같은 값).
5. **Redirects** → **Add Redirect** 두 번: `https://n2-preview.nerulio.pages.dev/api/v1/auth/discord/callback`, `https://nerulio.com/api/v1/auth/discord/callback` → 아래 **Save Changes**.
6. **Public Client**는 끈 채로 둔다(서버가 secret을 쓰는 confidential client이고, PKCE도 함께 쓴다). OAuth2 URL Generator는 쓰지 않는다 — 로그인 URL은 코드가 만든다(scope `identify email`).
7. (선택) **General Information**에서 앱 아이콘·설명. 동의 화면에 보인다.

저장하는 것: Discord **사용자 ID**(snowflake), 표시 이름(`global_name`, 없으면 username), username(닉네임 제안용), **`verified`일 때만** 이메일.

### 3. Pages 변수·secret (환경별)

Workers & Pages → 프로젝트 → **Settings** → **Variables and Secrets** → 환경(**Production** / **Preview**) 선택 → **Add** → 이름·값 입력, secret은 Type을 **Secret**으로 → **Save**. 변수는 **다음 배포부터** 적용되므로 저장 후 재배포(Deployments → 최신 배포 **Retry deployment**, 또는 브랜치 push)한다.

| 이름 | 유형 | Preview 값 | Production 값 |
| --- | --- | --- | --- |
| `GITHUB_OAUTH_CLIENT_ID` | Text | preview 앱의 Client ID | production 앱의 Client ID |
| `GITHUB_OAUTH_CLIENT_SECRET` | Secret | preview 앱의 secret | production 앱의 secret |
| `DISCORD_OAUTH_CLIENT_ID` | Text | Discord Client ID | 같은 값 |
| `DISCORD_OAUTH_CLIENT_SECRET` | Secret | Discord Client Secret | 같은 값 |
| `GOOGLE_OAUTH_CLIENT_ID` / `_SECRET` | Text / Secret | 넣지 않는다(보류) | 넣지 않는다(보류) |

`OAUTH_TEST_ORIGIN`은 로컬 E2E 전용이다. Pages 빌드에서는 값이 있어도 무시된다 — 넣지 않는다.

### 4. 확인

1. `https://n2-preview.nerulio.pages.dev/api/v1/health` → `"github":true,"discord":true,"google":false,"providers":["github","discord"]`.
2. 시크릿 창에서 채널 글(`/ko/ai/claude/` 등)의 댓글 칸에 쓰고 **등록** → "로그인하고 참여하기" 창에 **GitHub로 계속하기**, **Discord로 계속하기**만 보이는지 → GitHub로 로그인 → 같은 글로 돌아와 댓글이 등록되는지.
3. `/ko/account/` → **연결된 로그인**에 GitHub가 있고 **Discord 연결하기** → 연결 후 두 줄, 다시 **연결 해제**.
4. 새 시크릿 창에서 GitHub 동의 화면의 **Cancel** → 계정 페이지에 "GitHub 로그인을 취소했어요. 다시 시도"가 보이는지.
5. 제공자 쪽에서 앱을 지우거나 secret을 바꾸면 로그인은 `reason=exchange`로 실패한다 — 새 secret을 Pages에 넣고 재배포.

계정 연결 규칙: 로그인 수단(제공자, 제공자 ID)마다 Nerulio 계정 하나. **이메일이 같아도 자동으로 합치지 않는다**(탈취 방지). 로그인한 회원만 계정 페이지에서 다른 제공자를 직접 연결할 수 있고, 다른 로그인 수단(또는 관리자 패스키)이 남아 있을 때만 해제할 수 있다.

## 관리 앱 (`/admin/`, `/api/v2/admin/*`)

운영자 1인용 휴대폰 관리 앱(PWA)의 서버 쪽. `SERVICE_API=on`과 `PLATFORM=on`이 모두 켜진 빌드에서만 존재한다. 로그인은 **패스키**(WebAuthn: 휴대폰 화면 잠금·지문)다. Google 로그인은 쓰지 않는다.

- 관리자는 보통의 `users` 행(provider `passkey`)에 `user_profiles.role='admin'`이 붙은 계정이다. 같은 세션 쿠키를 쓰므로 신고 처리(`/api/v2/mod/*`)와 커뮤니티 기능도 그대로 쓴다. 공개 닉네임은 `운영자`.
- 관리 API는 관리자가 아니면 모두 **404**(존재 자체를 알리지 않음). 관리자라도 로그인한 지 **12시간**이 지나면 `401 REAUTH` → 앱이 패스키 로그인을 다시 띄운다.
- 첫 패스키 등록에만 `ADMIN_SETUP_CODE`가 필요하다. 패스키가 하나라도 생기면 이 경로는 닫힌다(코드를 알아도 404). 다른 기기는 로그인한 관리자만 추가할 수 있고, 마지막 패스키는 지울 수 없다.
- 설정되지 않은 선택 기능(GitHub 실행, D1 사용량, 푸시)은 `503 NOT_CONFIGURED {need:"<이름>"}`으로 답하고 앱은 "설정 필요"로 표시한다.
- D1 쓰기를 최소화했다: 패스키 로그인 1회 = 세션 1행 + 패스키 사용 기록 2행. 30분마다 도는 알림 확인은 **실제로 푸시를 보낸 경우에만** 작은 기록 1행을 쓴다.

### 변수와 secret (Production / Preview 각각)

| 이름 | 유형 | 누가 | 용도 |
| --- | --- | --- | --- |
| `ADMIN_SETUP_CODE` | **secret** | 운영자 | 첫 패스키 등록 코드. 16자 이상 무작위. 등록이 끝나면 지워도 된다(다시 필요하면 새로 설정) |
| `VAPID_PUBLIC_KEY` | 변수 | 코디네이터 | Web Push 공개 키. `node tools/admin-keys.mjs --json`으로 생성 |
| `VAPID_PRIVATE_KEY` | **secret** | 코디네이터 | 같은 도구의 개인 키. 바꾸면 모든 기기에서 알림을 다시 켜야 한다 |
| `VAPID_SUBJECT` | 변수 | 운영자 | `mailto:운영자메일` (푸시 서비스가 문제 시 연락하는 주소). 없으면 사이트 주소 |
| `NOTIFY_TOKEN` | **secret** | 코디네이터 | CI → `POST /api/v2/admin/notify` 인증(32자 이상). **GitHub Actions secret `NOTIFY_TOKEN`에도 같은 값** |
| `GITHUB_DISPATCH_TOKEN` | **secret** | 운영자(선택) | "지금 실행" 버튼. fine-grained PAT, 저장소 `2009seungbin-stack/my-first-repo` 하나만, 권한 **Actions: Read and write** |
| `CF_ANALYTICS_TOKEN` | **secret** | 운영자(선택) | D1 사용량 화면·한도 알림. API 토큰, 권한 **Account → Account Analytics → Read** |
| `CF_ACCOUNT_ID` | 변수 | 운영자(선택) | Cloudflare 계정 ID(32자리 16진수). 사용량은 계정 안의 **모든 D1(prod+preview) 합계** |
| `CF_PLAN` | 변수 | 선택 | `paid`(기본, Workers Paid: 이번 결제 주기 누적 ÷ 월 포함량 읽기 250억·쓰기 5천만 행) / `free`(하루 500만·10만 행, 00:00 UTC 초기화) |
| `CF_BILLING_DAY` | 변수 | 선택 | Workers Paid 결제 갱신일(1–28, 기본 1). 포함량은 달력 월이 아니라 구독 시작일 기준으로 초기화된다 |
| `GITHUB_REPO`, `GITHUB_DISPATCH_REF` | 변수 | 선택 | 기본 `2009seungbin-stack/my-first-repo`, `main` |

GitHub 저장소 쪽(Settings → Secrets and variables → Actions): 변수 `NOTIFY_URL`(예: `https://nerulio.com` 또는 preview 주소)과 secret `NOTIFY_TOKEN`. 둘 중 하나라도 없으면 수집기 워크플로의 알림 단계는 조용히 건너뛴다.

### 운영자 작업 순서

1. `migrations/0010_admin.sql` 적용: preview 먼저 `npx wrangler d1 migrations apply nerulio-preview --remote --config ops/d1.wrangler.toml`, 확인 후 prod. (수집기는 이 migration 전에도 동작한다: 실행 기록의 쓰기 행 수만 빠진다.)
2. `ADMIN_SETUP_CODE` 설정: 예 `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"` → Pages secret(Preview). 재배포.
3. 휴대폰에서 `https://<preview 주소>/admin/` → "처음 설정" → 코드 입력 → 화면 잠금으로 패스키 만들기. 패스키는 **호스트마다 따로**다(preview와 nerulio.com은 각각 등록).
4. 등록 뒤 `ADMIN_SETUP_CODE`는 지워도 된다(권장).
5. 알림: 코디네이터가 `VAPID_*`, `NOTIFY_TOKEN`을 넣고, 운영자는 GitHub에 `NOTIFY_URL`을 설정 → 앱의 알림 설정에서 "알림 켜기" → "테스트 알림 보내기".
6. 선택: `GITHUB_DISPATCH_TOKEN`(GitHub → Settings → Developer settings → Fine-grained tokens → Repository access: Only select → my-first-repo → Permissions: Actions **Read and write**, 만료일 설정), `CF_ANALYTICS_TOKEN`(Cloudflare → My Profile → API Tokens → Create Custom Token → Account / Account Analytics / Read) + `CF_ACCOUNT_ID`.

### 알림 규칙

- 수집기 실패: 연속 실패 횟수가 기기 설정(1·2·3회)에 닿을 때 실패 연속 구간마다 1번. 실행 기록조차 남지 못한 워크플로 실패(D1 한도 등)는 실행마다 1번.
- D1 사용량(30분마다): 80·90·95% 등 설정한 기준을 처음 넘을 때 기간(Paid: 결제 주기, Free: UTC 하루)마다 1번.
- 상태 수집 멈춤: Claude·OpenAI 상태 수집기가 2시간 넘게 성공하지 못하면 1번. 공식 장애가 새로 열리면 1번.
- 신고: 즉시(신고 접수 순간) / 1시간마다 모아서 / 끔. 정보 제안·사실 충돌: 09:00(KST) 이후 하루 1번. 새 가입자: 30분마다 모아서.
- 방해 금지(기본 23:00–07:00 KST): 수집기 실패와 사용량 95% 이상만 보낸다. 나머지는 방해 금지가 끝난 뒤 첫 확인 때 간다.

## 로컬 검증

```sh
npm test                      # 단위 + D1(node:sqlite) 백엔드 테스트
npm run test:service          # wrangler pages dev + 로컬 D1 + Chromium end-to-end
```

`test:service`는 임시 디렉터리에 빌드하고 migration을 **로컬** D1(miniflare)에 적용한다. 운영 D1이나 실제 결제에 연결하지 않는다.
