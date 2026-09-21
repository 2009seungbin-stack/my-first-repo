# 인증과 세션

Free 도구 사용에는 **로그인이 필요 없다.** 로그인은 Pro 구매와 계정 관리에만 쓴다.

## 식별자 종류

| 쿠키 | 내용 | 속성 | 수명 |
| --- | --- | --- | --- |
| `nerulio_anon` | 128비트 무작위 ID + HMAC-SHA256(`SESSION_SECRET`, `anon/v1`) 서명 | HttpOnly, Secure, SameSite=Lax, Path=/ | 400일 |
| `nerulio_session` | 256비트 무작위 토큰 (원문) | HttpOnly, Secure, SameSite=Lax, Path=/ | 30일 |
| `nerulio_oauth` | state·PKCE verifier·nonce·복귀 경로의 서명된 묶음 | HttpOnly, Secure, SameSite=Lax, Path=/api/v1/auth/ | 10분 |
| `nerulio_human` | Turnstile 통과 표시 (익명 ID 결합, 서명) | HttpOnly, Secure, SameSite=Lax | 12시간 |

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

## Google OAuth (OpenID Connect)

흐름: `GET /api/v1/auth/google/start?return=/ko/pricing/` → Google → `GET /api/v1/auth/google/callback`.

- **state**: 32바이트 무작위, 서명된 `nerulio_oauth` 쿠키와 상수 시간 비교. 불일치 시 토큰 교환 전에 거부 (`/account/?login=failed&reason=state`).
- **PKCE (S256)**: 48바이트 verifier, `code_challenge=BASE64URL(SHA256(verifier))`.
- **nonce**: ID 토큰의 `nonce`와 비교.
- **redirect_uri**: 요청을 받은 호스트의 `origin + /api/v1/auth/google/callback`. state 쿠키가 host-only이므로 같은 호스트로 돌아와야 한다. 사용할 모든 호스트(운영 도메인, 필요하면 pages.dev·preview)를 Google Console에 등록해야 한다.
- **ID 토큰 검증**: 토큰은 PKCE로 묶인 code 교환 응답으로 Google 토큰 엔드포인트에서 TLS로 직접 받는다(OIDC Core §3.1.3.7에 따라 서명 대신 TLS로 발급자를 인증). 그래도 `iss`(accounts.google.com), `aud`(client ID), `exp`, `nonce`, `sub` 형식을 모두 검사한다.
- **계정 키**: `(provider='google', provider_subject=sub)`. 이메일은 표시용이며 식별자로 쓰지 않는다. `email_verified`가 true일 때만 저장한다. 같은 `sub`의 이메일이 바뀌어도 같은 계정이다(테스트).
- **복귀 경로**: `/`로 시작하는 같은 사이트 상대 경로만 허용 (`//host`, 스킴, 역슬래시 거부) → open redirect 없음.
- **사용량 이월**: 로그인 시 오늘의 익명 사용량을 계정 사용량에 `MAX`로 합친다.

## CSRF / Origin

상태를 바꾸는 모든 브라우저 엔드포인트(`jobs/authorize`, `auth/logout`, `billing/checkout`, `billing/portal`, `admin/cleanup`)는:

1. `Sec-Fetch-Site`가 있으면 `same-origin`이어야 한다(`same-site` 형제 서브도메인도 거부).
2. `Origin`이 있으면 요청 호스트의 origin 또는 `SITE_URL`의 origin이어야 한다.
3. `Origin`이 없으면 `Sec-Fetch-Site: same-origin`이어야 한다.
4. `Content-Type: application/json` 필수 → 교차 출처 단순 폼 POST 불가.

webhook만 예외이며 대신 결제사 서명으로 검증한다. CORS는 허용하지 않는다.

## 관리자

`/api/v1/admin/*`는 `ADMIN_GOOGLE_SUBJECTS`(쉼표 구분 Google `sub`)에 있는 사용자가 **12시간 이내에 로그인한 세션**일 때만 동작하고, 그 외에는 존재를 드러내지 않도록 404를 반환한다. 운영 시에는 Cloudflare Access(Zero Trust)로 `/api/v1/admin/*` 경로를 추가 보호하는 것을 권장한다. 관리 API는 집계 숫자만 반환하며 파일 관련 데이터는 애초에 존재하지 않는다. 관리자 화면(`/admin/`)은 아직 제공하지 않는다.

## 로그인 남용

Google 로그인 자체가 봇 방지를 제공한다. 추가로 Cloudflare WAF Rate Limiting 규칙으로 `/api/v1/auth/*`의 IP당 요청 수를 제한한다([CLOUDFLARE.md](CLOUDFLARE.md)).
