# 인증과 세션

Free 도구 사용에는 **로그인이 필요 없다.** 예외는 스튜디오 엔진 내보내기: 계정 없이 하루 `FREE_ANON_STUDIO_EXPORTS`회(기본 3) 뒤에는 무료 로그인(GitHub·Discord, Google은 보류)이 필요하다(새 탭에서 열려 작업 중인 탭과 프로젝트는 그대로). 그 밖의 로그인은 커뮤니티 참여(글·댓글·구독·추천·신고), Pro 구매와 계정 관리에 쓴다. 로그아웃하면 그날 사용량이 브라우저의 익명 식별자로 되돌아가고, 계정당 동시 세션은 `MAX_SESSIONS_PER_USER`(기본 5)개까지다.

## 식별자 종류

| 쿠키 | 내용 | 속성 | 수명 |
| --- | --- | --- | --- |
| `nerulio_anon` | 128비트 무작위 ID + HMAC-SHA256(`SESSION_SECRET`, `anon/v1`) 서명 | HttpOnly, Secure, SameSite=Lax, Path=/ | 400일 |
| `nerulio_session` | 256비트 무작위 토큰 (원문) | HttpOnly, Secure, SameSite=Lax, Path=/ | 30일 |
| `nerulio_oauth` | 제공자·state·PKCE verifier·nonce·복귀 경로(·연결할 계정)의 서명된 묶음 | HttpOnly, Secure, SameSite=Lax, Path=/api/v1/auth/ | 10분 |
| `nerulio_human` | Turnstile 통과 표시 (통과한 식별자 — 로그인 시 계정, 아니면 익명 ID — 에 결합, 서명) | HttpOnly, Secure, SameSite=Lax | 12시간 |

- 서명이 맞지 않는 `nerulio_anon`은 신뢰하지 않고 새로 발급한다(임의 ID로 DB 행을 만들 수 없음).
- 익명 방문자는 heavy 작업을 실행하기 전까지 **DB 행이 생기지 않는다.**
- `localStorage`의 어떤 값도 식별·권한 판단에 쓰지 않는다.
- `Secure`는 로컬 개발의 `http://localhost`/`127.0.0.1`에서만 생략된다.

## 세션

- 로그인 성공 시 `crypto.getRandomValues`로 32바이트 토큰을 만들고 D1 `sessions`에는 **SHA-256(token)만** 저장한다. DB가 유출되어도 세션 쿠키를 복원할 수 없다.
- 조회: `token_hash = ? AND expires_at > now`. 만료된 세션은 즉시 무효이며, 브라우저의 죽은 쿠키는 다음 응답에서 삭제된다.
- 로그아웃(`POST /auth/logout`): 서버에서 해당 해시 행을 삭제하고 쿠키를 만료시킨다. 같은 토큰을 재사용해도 로그인되지 않는다(테스트).
- 재로그인: 이 브라우저의 이전 세션 행을 삭제하고 새 토큰을 발급한다(세션 누적·고정 방지).
- 정리: 만료 세션은 `DELETE ... WHERE expires_at <= now`로 authorize 요청의 약 1/500 확률로 또는 `/admin/cleanup`에서 제거.
- Pro 상태 캐시: 브라우저는 `/me`를 페이지당 1번 메모리에만 보관한다. 구독 변경은 다음 페이지 로드에 반영된다(최대 한 페이지 수명만큼의 지연). 서버는 매 요청 D1에서 판정한다.

## 로그인 제공자 (GitHub · Discord · Google)

코드: `server/oauth/flow.js`(공통 흐름), `server/oauth/{github,discord,google}.js`(제공자별), `server/oauth/providers.js`(설정·표시 순서). 제공자는 client ID와 secret이 **둘 다** 설정된 경우에만 제공된다(`/api/v1/health`의 `github`/`discord`/`google`, `/api/v1/me`와 `/api/v2/state`의 `providers`). 설정 절차는 [CLOUDFLARE.md "소셜 로그인"](CLOUDFLARE.md#소셜-로그인-github--discord--google).

흐름: `GET /api/v1/auth/{provider}/start?return=/ko/ai/claude/[&link=1]` → 제공자 동의 화면 → `GET /api/v1/auth/{provider}/callback` → `return` 경로(`?login=ok`) 또는 계정 페이지(`?login=failed&reason=…&provider=…&return=…`).

- **state**: 32바이트 무작위, 서명된 `nerulio_oauth` 쿠키(host-only, `Path=/api/v1/auth/`, 10분)와 상수 시간 비교. 쿠키에는 제공자도 들어 있어 다른 제공자의 콜백이나 다른 탭의 흐름은 토큰 교환 전에 거부된다(`reason=state`). 모든 콜백이 쿠키를 지우므로 같은 콜백 URL의 재사용도 `state`로 거부되고, 쿠키를 복사해 재사용해도 제공자가 한 번 쓴 code를 거부한다(`exchange`).
- **PKCE (S256)**: 48바이트 verifier, `code_challenge=BASE64URL(SHA256(verifier))`. GitHub(`plain`은 거부)·Discord·Google 모두 S256.
- **redirect_uri**: 요청을 받은 호스트의 `origin + /api/v1/auth/{provider}/callback`.
- **복귀 경로**: `/`로 시작하는 같은 사이트 상대 경로만 허용 (`//host`, 스킴, 역슬래시, 공백·제어 문자 거부 → `/account/`). open redirect 없음.
- **실패 사유**(`reason`): `denied`(동의 취소), `provider`(제공자가 오류로 돌려보냄), `state`, `code`, `exchange`(code 교환 거부), `unavailable`(제공자 5xx·네트워크·10초 시간 초과), `subject`/`issuer`/`audience`/`nonce`/`expired`/`token`(응답 검증 실패), `link_session`, `linked_elsewhere`, `already_linked`. 계정 페이지가 한·영·일 문구와 **다시 시도** 링크로 보여 준다.
- **토큰**: 제공자 액세스 토큰은 콜백 안에서 프로필을 읽는 데만 쓰고 저장하지 않는다. 프로필 사진은 가져오지 않는다.

| 제공자 | scope | 계정 키(subject) | 이메일 | 이름 / 핸들 |
| --- | --- | --- | --- | --- |
| GitHub (OAuth App) | `read:user user:email` | 숫자 사용자 ID (로그인 이름은 바뀔 수 있어 키로 쓰지 않음) | `/user/emails`의 `primary && verified`만, 없을 수 있음 | `name`(없으면 login) / login |
| Discord | `identify email` | 사용자 ID (snowflake) | `verified === true`일 때만 | `global_name`(없으면 username) / username |
| Google (OIDC, 보류) | `openid email profile` | `sub` | `email_verified`일 때만 | `name` / 없음 |

Google의 ID 토큰은 PKCE로 묶인 code 교환 응답으로 Google 토큰 엔드포인트에서 TLS로 직접 받는다(OIDC Core §3.1.3.7). 그래도 `iss`·`aud`·`exp`·`nonce`·`sub` 형식을 모두 검사한다.

### 계정과 로그인 수단 (`user_identities`, migration 0011)

- 로그인 수단 = `(provider, provider_subject)`. 한 수단은 정확히 한 계정에 속한다. `users.provider/provider_subject`는 계정의 첫 수단을 가리키는 기존 열로 남는다(0011이 기존 계정의 수단을 옮겨 둔다).
- **이메일로 계정을 합치지 않는다.** 같은 이메일의 GitHub 계정과 Discord 계정은 서로 다른 Nerulio 계정이다(다른 사람이 그 이메일로 제공자 계정을 만들어 기존 계정에 들어오는 탈취를 막는다).
- **연결**: 로그인한 회원이 계정 페이지 "연결된 로그인"에서 `start?link=1`로 시작한다. 콜백에서 같은 세션인지 다시 확인하고(`link_session`), 그 수단이 다른 계정의 것이면 거부(`linked_elsewhere` — 계정은 조용히 합쳐지지 않는다), 같은 제공자의 다른 계정이 이미 연결돼 있어도 거부(`already_linked`). 연결은 세션을 바꾸지 않는다.
- **해제**: `POST /api/v1/auth/unlink {provider}` (same-origin). 다른 수단이나 관리자 패스키가 남아 있을 때만 허용(`409 OPERATION_CONFLICT`, `reason:"last_method"`). 해제한 수단이 첫 수단이었다면 `users.provider/provider_subject`를 남은 수단으로 넘겨, 해제된 제공자 계정이 나중에 새 계정으로 가입할 수 있게 한다.
- `GET /api/v1/auth/identities` → `{providers, identities:[{provider,email,since}], passkeys, canUnlink}` (계정 페이지 전용, `/me`에는 넣지 않아 페이지뷰마다의 D1 읽기를 늘리지 않는다).
- 이메일·이름은 계정 페이지에만 보이는 비공개 표시 정보다. 커뮤니티에는 닉네임만 보인다. 새 계정의 닉네임은 `user-xxxxxx`이고, GitHub·Discord의 **핸들**(공개 아이디)이 규칙·예약어·중복 검사를 통과하면 내 정보 화면에 미리 채워 **제안**만 한다 — 회원이 저장해야 공개된다. Google 이름(실명일 수 있음)은 제안하지 않는다.

### 로컬 E2E

`tests/service-browser.py`의 `social` 시나리오가 로컬 mock 제공자(GitHub·Discord)로 전체 redirect 흐름을 돈다. Worker는 `OAUTH_TEST_ORIGIN`(루프백 `http://127.0.0.1:포트`만)으로 제공자 주소를 바꾸는데, 이 값은 `NERULIO_ENV=development`인 **로컬 빌드에서만** 적용되고 Pages 빌드(preview·production)에서는 무시된다(테스트).

## CSRF / Origin

상태를 바꾸는 모든 브라우저 엔드포인트(`jobs/authorize`, `auth/logout`, `auth/unlink`, `billing/checkout`, `billing/portal`, `admin/cleanup`)는:

1. `Sec-Fetch-Site`가 있으면 `same-origin`이어야 한다(`same-site` 형제 서브도메인도 거부).
2. `Origin`이 있으면 요청 호스트의 origin 또는 `SITE_URL`의 origin이어야 한다.
3. `Origin`이 없으면 `Sec-Fetch-Site: same-origin`이어야 한다.
4. `Content-Type: application/json` 필수 → 교차 출처 단순 폼 POST 불가.

webhook만 예외이며 대신 결제사 서명으로 검증한다. CORS는 허용하지 않는다.

## 관리자

`/api/v1/admin/*`는 `ADMIN_GOOGLE_SUBJECTS`(쉼표 구분 Google `sub`)에 있는 사용자가 **12시간 이내에 로그인한 세션**일 때만 동작하고, 그 외에는 존재를 드러내지 않도록 404를 반환한다. 운영 시에는 Cloudflare Access(Zero Trust)로 `/api/v1/admin/*` 경로를 추가 보호하는 것을 권장한다. 관리 API는 집계 숫자만 반환하며 파일 관련 데이터는 애초에 존재하지 않는다. 관리자 화면(`/admin/`)은 아직 제공하지 않는다.

## 로그인 남용

제공자 로그인(GitHub·Discord·Google) 자체가 봇 방지를 어느 정도 제공한다. `/auth/*/start`는 Worker의 분당 제한(`signin`)을 거친다. 추가로 Cloudflare WAF Rate Limiting 규칙으로 `/api/v1/auth/*`의 IP당 요청 수를 제한한다([CLOUDFLARE.md](CLOUDFLARE.md)).
