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
| `FREE_DAILY_JOBS` | 변수 | Free heavy 작업/일. 기본 30 |
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
| `NERULIO_ENV` | — | 로컬 테스트 전용(`development`). 운영에 설정하지 않는다 |

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
10. **테스트 Pro 확인** (결제 없이 운영자가 부여):
    ```sh
    npx wrangler d1 execute nerulio-preview --remote --config ops/d1.wrangler.toml --command "SELECT id,email FROM users"
    npx wrangler d1 execute nerulio-preview --remote --config ops/d1.wrangler.toml --command "INSERT INTO subscriptions(provider,external_subscription_id,user_id,plan,status,current_period_end,cancel_at_period_end,updated_at) VALUES('manual','manual-test-1','<USER_ID>','pro','active',<만료 epoch ms>,0,<현재 epoch ms>)"
    ```
    헤더 Pro 배지, 광고 요청 0, heavy 무제한을 확인한 뒤 행을 삭제한다. `provider='manual'`은 결제가 아니라 운영자 부여임을 기록으로 남긴다.
11. **그 다음에만 결제 연결**: [BILLING.md](BILLING.md)의 출시 순서를 따른다.

## Worker 라우팅과 비용

`_routes.json`은 빌드가 생성한다.

| 빌드 | `include` | `exclude` | Worker 호출 |
| --- | --- | --- | --- |
| 서비스만 | `/api/*`, `/_worker.js/*` | — | API 호출 시에만. HTML·JS·CSS·이미지·예제는 정적 제공 |
| 서비스 + 광고 | `/*` | `/src/*`, `/assets/*`, `/ai-runtime/*`, `/verify/*`, CSS, favicon, robots, sitemap들, ads.txt | HTML(응답별 nonce CSP 필요)과 API만 |

호출량 추정: 페이지 보기 1회 = `/me` 1회 (+ 광고 빌드에서는 HTML 1회). heavy 작업 1회 = `authorize` 1회. 진행률 폴링은 없다(진행률은 로컬 엔진이 관리). 결제 후 활성화 확인만 최대 5회 재조회한다.

D1 사용량(대략): 익명 `/me`는 쿠키가 있으면 1행 읽기, 첫 방문은 0. heavy 작업 1회는 한 트랜잭션에서 약 4행 쓰기(작업 기록 삽입·확정, 일일 카운터, 네트워크 버킷). 요금·무료 한도(작성 시점 Workers Free 일 10만 요청, D1 Free 일 500만 행 읽기·10만 행 쓰기)는 변경될 수 있으므로 대시보드의 현재 요금표로 확인한다. 파일 크기는 API 비용과 무관하다(2 GB 영상도 `{toolId, operationId}` 한 번).

## Rate limiting

Cloudflare Rate Limiting은 스팸·버스트 방지용이다. 정확한 하루 30회 계산은 D1이 한다. **커스텀 도메인(Cloudflare zone)** 이 필요하며 `*.pages.dev`에는 WAF 규칙을 걸 수 없다. 권장 규칙 예 (Security → WAF → Rate limiting rules):

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
