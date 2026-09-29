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
| `SITE_URL` | 변수 | 기존과 동일 (canonical 등) |
| `FREE_DAILY_JOBS` | 변수 | Free heavy 작업/일 (파일 도구). 기본 30 |
| `FREE_DAILY_STUDIO_EXPORTS` | 변수(빌드+런타임) | Free 스튜디오 엔진 내보내기/일. 기본 10. 가격 페이지 문구와 Worker 한도가 같은 값을 쓴다 ([PRICING-MODEL.md](PRICING-MODEL.md)) |
| `ADSENSE_SLOT_STUDIO` | 변수(빌드) | 스튜디오 데스크톱 광고 칸의 광고 단위 ID(10자리). `ADSENSE_CLIENT`와 `ADSENSE_CMP_READY=true`가 있어야 켜진다 ([ADS.md](ADS.md)) |
| `ANON_NETWORK_DAILY_JOBS` | 변수 | 익명 네트워크 버킷 Turnstile 기준. 기본 한도×4 |
| `PRO_PRICE_AMOUNT`, `PRO_PRICE_CURRENCY`, `PRO_PRICE_INTERVAL` | 변수(빌드) | 가격 표시 (`4.99`, `USD`, `month`). 없으면 "가격은 출시 시 공개" |
| `GOOGLE_OAUTH_CLIENT_ID` | 변수 | Google OAuth 클라이언트 ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | **secret** | |
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
5. **Google OAuth**: Google Cloud Console → APIs & Services → OAuth consent screen(범위 `openid email profile`) → Credentials → OAuth client ID(Web application) → Authorized redirect URIs에 `https://<운영 도메인>/api/v1/auth/google/callback` 등록(pages.dev나 preview 호스트에서도 로그인하려면 각각 추가). JavaScript origin은 필요 없다.
6. **Secret 설정**: `SESSION_SECRET`, `GOOGLE_OAUTH_CLIENT_SECRET`, `TURNSTILE_SECRET_KEY` (Production/Preview 각각).
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

- `starts_with(http.request.uri.path, "/api/v1/auth/")` — IP당 10초 20회 초과 시 차단
- `starts_with(http.request.uri.path, "/api/v1/")` — IP당 10초 60회 초과 시 Managed Challenge

## Preview 환경

- `CF_PAGES_BRANCH != main` 빌드는 기존대로 광고 off, `noindex`, robots Disallow.
- `nerulio-preview` D1을 바인딩해 운영 구독 데이터를 건드리지 않는다.
- `BILLING_PROVIDER=sandbox`는 preview에서만 동작하고, `BILLING_MODE=live`는 preview에서 자동 거부된다.
- preview 호스트에서 Google 로그인을 쓰려면 그 호스트의 callback URI를 Google에 등록해야 한다(브랜치 별칭 URL 권장).

## 로컬 검증

```sh
npm test                      # 단위 + D1(node:sqlite) 백엔드 테스트
npm run test:service          # wrangler pages dev + 로컬 D1 + Chromium end-to-end
```

`test:service`는 임시 디렉터리에 빌드하고 migration을 **로컬** D1(miniflare)에 적용한다. 운영 D1이나 실제 결제에 연결하지 않는다.
