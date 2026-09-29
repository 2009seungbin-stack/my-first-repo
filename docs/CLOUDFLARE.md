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

호출량 추정: 페이지 보기 1회 = `/me` 1회 (+ 광고 빌드에서는 HTML 1회). heavy 작업 1회 = `authorize` 1회. 진행률 폴링은 없다(진행률은 로컬 엔진이 관리). 결제 후 활성화 확인만 최대 5회 재조회한다.

D1 사용량(대략): 익명 `/me`는 쿠키가 있으면 1행 읽기, 첫 방문은 0. heavy 작업 1회는 한 트랜잭션에서 약 4행 쓰기(작업 기록 삽입·확정, 일일 카운터, 네트워크 버킷). 요금·무료 한도(작성 시점 Workers Free 일 10만 요청, D1 Free 일 500만 행 읽기·10만 행 쓰기)는 변경될 수 있으므로 대시보드의 현재 요금표로 확인한다. 파일 크기는 API 비용과 무관하다(2 GB 영상도 `{toolId, operationId}` 한 번).

## Rate limiting

Cloudflare Rate Limiting은 스팸·버스트 방지용이다. 정확한 하루 30회 계산은 D1이 한다. **커스텀 도메인(Cloudflare zone)** 이 필요하며 `*.pages.dev`에는 WAF 규칙을 걸 수 없다. 권장 규칙 예 (Security → WAF → Rate limiting rules): 커스텀 도메인이 생기기 전에는 Worker 안의 분당 제한(`API_RATE_PER_MINUTE`, 네트워크당, 격리 인스턴스 단위)이 폭주만 막는 임시 장치로 동작한다 — 도메인을 산 뒤 아래 규칙을 추가한다(소유자 작업).

- `starts_with(http.request.uri.path, "/api/v1/auth/")` — IP당 10초 20회 초과 시 차단
- `starts_with(http.request.uri.path, "/api/v1/")` — IP당 10초 60회 초과 시 Managed Challenge

## Preview 환경

- `CF_PAGES_BRANCH != main` 빌드는 기존대로 광고 off, `noindex`, robots Disallow.
- `nerulio-preview` D1을 바인딩해 운영 구독 데이터를 건드리지 않는다.
- `BILLING_PROVIDER=sandbox`는 preview에서만 동작하고, `BILLING_MODE=live`는 preview에서 자동 거부된다.
- preview 호스트에서 Google 로그인을 쓰려면 그 호스트의 callback URI를 Google에 등록해야 한다(브랜치 별칭 URL 권장).

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
