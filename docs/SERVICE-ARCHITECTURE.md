# Nerulio 서비스 아키텍처 (Local-first SaaS)

Nerulio의 파일 처리 엔진(이미지·PDF·미디어·게임 에셋·AI)은 **사용자 브라우저에서만** 실행된다. Cloudflare는 파일 처리 서버가 아니라 **control plane**이다: 계정, 세션, Free/Pro 판정, 하루 사용량, 광고 표시 여부, 구독 상태, 결제 webhook, 남용 방지만 담당한다.

```
USER DEVICE ──────────────────────────────────────────────┐
  Image / PDF / Media / Game Asset / AI engines (local)    │  파일·파일명·결과는 여기서만 존재
  src/entitlement.js ── GET /api/v1/me (페이지당 1회)        │
                     └─ POST /api/v1/jobs/authorize         │  {operationId, toolId} 만 전송
                                                            │
Cloudflare Pages ── static HTML/CSS/JS/예제/소셜 이미지 (Worker 미경유)
        └── _worker.js/ (advanced mode)
              ├─ /api/v1/*  → server/api.js ── D1 (binding DB)
              ├─ /_worker.js/* → 404 (소스 비공개)
              └─ 광고 빌드의 HTML → env.ASSETS.fetch + 응답별 nonce CSP (tools/ads-worker.mjs 재사용)
Turnstile ── /verify/ iframe (자체 CSP), 서버 Siteverify
Billing provider ── 서명된 webhook → /api/v1/billing/webhook → subscriptions
```

## 활성화 방식 (opt-in)

`SERVICE_API=on` 빌드 변수가 없으면 결과물은 **기존 정적 사이트와 동일**하다 (Worker 없음, 계정 페이지 없음, `nerulio-service` meta 없음). 이 브랜치를 `main`에 병합해도 운영 사이트는 운영자가 D1·secret을 준비하고 변수를 켜기 전까지 바뀌지 않는다. `SERVICE_API=on`인데 `DB` 바인딩이나 `SESSION_SECRET`(32자 이상)이 없으면 API는 `SERVICE_NOT_CONFIGURED`(503)를 반환하고, 클라이언트는 모든 도구를 제한 없이 허용한다(광고는 기존처럼 표시).

## 코드 구조

| 위치 | 역할 |
| --- | --- |
| `src/quota.js` | 모든 도구 ID의 quota class(`none`/`heavy`) 단일 정의. 브라우저와 Worker가 같은 파일을 사용. 기본 Free 한도 `DEFAULT_FREE_DAILY_JOBS=30`은 이 한 곳에만 있다 |
| `src/entitlement.js` | 브라우저에서 `/api/v1`을 호출하는 유일한 모듈. `/me` 메모리 캐시, `authorize(toolId)`, grace, 헤더 배지 |
| `src/upgrade-modal.js`, `src/human-check.js`, `src/service-ui.js`, `src/service.css`, `src/service-content.js` | 필요할 때만 lazy import. 도구 첫 화면에는 로드되지 않음 |
| `src/account-page.js`, `src/pricing-page.js`, `src/verify-page.js` | `/account/`, `/pricing/`, `/verify/` 전용 |
| `server/index.js` | Pages advanced-mode 진입점 (`dist/_worker.js/index.js`) |
| `server/api.js` | 라우터, origin 검사, 엔드포인트 |
| `server/usage.js` | 원자적·멱등 quota 처리 |
| `server/identity.js`, `server/auth-google.js` | 익명 식별자, 세션, Google OIDC |
| `server/billing/*` | 결제사 추상화, sandbox/Paddle 어댑터, webhook 처리 |
| `migrations/*.sql` | D1 스키마 (wrangler migrations 형식) |
| `tools/service-build.mjs` | 서비스 빌드 산출물 (Worker 번들, `_routes.json`, 페이지, 헤더) |

처리 엔진(`image.js`, `pdf*.js`, `media*.js`, `recipes.js`, AI worker 등)에는 네트워크 코드가 추가되지 않았다. 실행 지점 세 곳(`experience.run`, `toolkit.run`, `app.js`의 heavy 편집 동작)에서 로컬 처리 **시작 전에** `authorize()`만 호출한다.

## API (`/api/v1`)

| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/health` | 구성 여부(boolean)만. secret·사유 문자열 없음 |
| GET | `/me` | `{loggedIn, plan, ads, usage, user?, subscription?, billing:{mode}, turnstileSiteKey}` |
| GET | `/usage` | 오늘 사용량 |
| POST | `/jobs/authorize` | `{operationId(UUID), toolId, turnstileToken?}` → 허용 시 `{allowed:true, used, limit, remaining, resetAt}`; 한도 초과 시 HTTP 429 `{allowed:false, reason:"daily_limit", resetAt, error:{code:"DAILY_LIMIT"}}` |
| GET | `/auth/google/start`, `/auth/google/callback` | Google OIDC |
| POST | `/auth/logout` | 서버 세션 삭제 |
| POST | `/billing/checkout`, `/billing/portal` | 로그인 필요 |
| POST | `/billing/webhook` | 결제사 서명 검증 후 처리 (origin 검사 없음) |
| GET/POST | `/admin/stats`, `/admin/cleanup` | 집계 전용 관리 API (아래) |

공통 오류 형식은 `{"error":{"code","message"}}`이며 클라이언트는 `code`로만 분기한다. 사용자에게 보이는 문구는 `src/service-content.js`(ko/en/ja)에 있다. 스택/SQL 오류는 응답에 포함되지 않고 Worker 로그에만 남는다.

모든 API 응답: `Content-Type: application/json`, `Cache-Control: no-store`, `nosniff`, `X-Frame-Options: DENY`, `default-src 'none'` CSP. **CORS 헤더를 절대 보내지 않는다** (`Access-Control-Allow-*` 없음).

요청 본문은 짧은 문자열 필드의 **닫힌 집합**이다. 허용되지 않은 필드(`file`, `fileName`, `size`, base64 등)가 하나라도 있으면 처리 전에 400으로 거부하고, 본문은 1 KiB(checkout 4 KiB)를 넘을 수 없다. 즉 파일 데이터는 구조적으로 API에 들어올 수 없다.

## Free / Pro와 quota

- 품질은 Free/Pro 동일. 워터마크·해상도 제한 없음. 차이는 광고와 heavy 작업 하루 횟수뿐이다.
- `none` 도구(자르기·회전·크기·변환·PDF 페이지 편집·팔레트 등)는 **API를 호출하지 않는다.**
- `heavy` 도구는 실행 1회당 1회 차감. 처리 도중 실패해도 차감은 되돌리지 않는다(남용 방지 단순화; 운영 데이터를 보고 조정 가능).
- 하루 = **UTC 날짜**. 초기화 시각은 모두에게 00:00 UTC(한국 09:00). 계정 페이지와 모달에 남은 시간을 표시.
- 한도: `FREE_DAILY_JOBS` (기본 30, 1~10000).
- 원자성: 한 번의 `db.batch()`(D1 트랜잭션)에서 ① `(subject, operationId)` pending 선점 ② `used < limit`일 때만 `+1` upsert ③ 결과 확정 ④ 조회. SELECT→JS 증가→UPDATE를 쓰지 않는다. 60개 동시 요청에 limit 30이면 정확히 30개만 허용됨을 테스트한다.
- 멱등성: 같은 `operationId` 재시도는 저장된 결정을 반환하고 다시 차감하지 않는다. 네트워크 실패 시 클라이언트는 **같은 ID로** 1회 재시도한다. 같은 ID를 다른 도구에 쓰면 409.
- 로그인하면 오늘의 익명 사용량이 계정으로 이월된다(`MAX`), 로그인으로 한도가 초기화되지 않는다.

## 장애 시 동작 (fail-open)

| 상황 | 동작 |
| --- | --- |
| 빌드에 서비스 없음 | 모든 도구 무제한, API 호출 없음 |
| `SERVICE_NOT_CONFIGURED` | 모든 도구 무제한, 광고는 기존처럼 |
| `/me` 실패 | 도구 정상. 헤더 계정 링크 숨김. **광고는 표시하지 않음**(Pro 사용자를 잘못 판단하지 않기 위해) |
| `authorize` 네트워크/5xx 장애 | 같은 ID로 1회 재시도 → 실패 시 기기별 UTC 하루 **3회 grace** (`localStorage` `nerulio.grace.v1`) → 소진 후 heavy 도구만 일시 중지 안내 |
| 페이지와 Worker 버전 불일치(`UNKNOWN_TOOL`/`NOT_METERED`) | 허용 (도구를 막지 않음) |
| 광고 스크립트 차단/실패 | 빈 광고 영역 제거, 도구·다운로드·이동에 영향 없음 |

grace 카운터는 보조 수단이며 권한 판단이 아니다. 개발자 도구로 우회할 수 있다는 점은 의도적으로 수용한다(아래 한계 참고).

## 개인정보 보장

- API로 보내는 것: `operationId`, `toolId`, (필요 시) Turnstile token. 파일·파일명·크기·해시·결과·미리보기는 없음. `tests/service-browser.py`가 실제 요청을 가로채 파일명·base64·크기를 검사한다.
- D1에는 파일 관련 컬럼이 없다. 관리 API도 집계 숫자만 제공한다.
- 익명 식별자는 무작위 값 + HMAC 서명(`nerulio_anon`, HttpOnly). 파일 정보와 연결하지 않는다.
- 네트워크 남용 버킷은 `HMAC(SESSION_SECRET, 날짜+IP(/64))`의 앞 32자로, 매일 바뀌며 원래 주소로 되돌릴 수 없다.
- 개인정보처리방침은 `SERVICE_API=on` 빌드에서 쿠키·보관 기간·저장 항목을 실제 동작대로 표시한다.

## 알려진 한계

- **클라이언트 우회 가능성**: 처리 코드가 브라우저에 있으므로 전문가는 개발자 도구로 `authorize` 호출을 건너뛸 수 있다. 이를 막으려고 처리를 서버로 옮기지 않는다(설계 원칙). 보안 우선순위는 결제 무결성·세션·계정·봇·DB 안전이다.
- **익명 쿠키 삭제**: 쿠키를 지우면 새 익명 한도가 생긴다. 네트워크 버킷이 `ANON_NETWORK_DAILY_JOBS`(기본 한도×4)를 넘으면 Turnstile을 요구해 대량 반복을 억제하지만(설정된 경우), 완전한 차단은 아니다.
- **실패한 작업도 1회 차감**된다.
- Pages Functions에는 cron이 없어 만료 세션/오래된 사용량 정리는 authorize 요청의 약 1/500에서 `waitUntil`로 수행하거나 `/admin/cleanup`으로 수동 실행한다. 만료 세션은 조회 시 이미 무시된다.

## 미래 확장

- **Cloud Jobs**: 현재는 GPU 서버, 파일 업로드, R2 사용자 파일, 서버 FFmpeg가 없다. 향후 `quota.js`에 `cloud` 같은 class를 추가하고 별도 `/api/v1/cloud-jobs/*` 네임스페이스로 붙일 수 있도록 로컬 엔진·권한 판정·API 버전을 분리해 두었다.
- **Team / Credits / API**: `subscriptions.plan`은 문자열이며 Pro 판정은 `plan='pro'`만 본다. 새 플랜은 스키마 변경 없이 `plan` 값과 판정 함수(`server/identity.js subscriptionFor`)만 확장한다. Credits가 필요해지면 별도 ledger 테이블을 migration으로 추가한다.
