# Nerulio 2.0 운영 공개 절차서

프리뷰(`https://n2-preview.nerulio.pages.dev`)에서 점검을 마친 뒤 운영(`https://nerulio.com`)을 켜는 순서다. 위에서부터 순서대로 한다. **(오너)** 표시는 대시보드나 비밀값 입력이 필요해서 오너가 직접 해야 하는 단계이고, **(Claude)** 는 세션에서 처리할 수 있는 단계다. 운영 D1 작업은 오너가 그때 명시적으로 허락해야 한다.

값·ID는 식별자만 적는다. 비밀값은 여기 적지 않는다.

| 항목 | 값 |
| --- | --- |
| Cloudflare 계정 | `e55ee37eeb66f0f64efd04c0b65b585a` |
| Pages 프로젝트 | `nerulio` |
| D1 운영 / 프리뷰 | `nerulio-prod` (`bc890e90-fca6-4837-82ad-0574c2378293`) / `nerulio-preview` (`d9554f4a-6cbe-4ffc-af39-880ce61152ef`) |
| R2 운영 / 프리뷰 | `nerulio-uploads` / `nerulio-uploads-preview` |
| Analytics Engine 데이터셋 | `nerulio_traffic` (운영·프리뷰 공용, 환경은 데이터 안에 기록됨) |

## 0. 공개 전 확인 (프리뷰)

- 유동 글쓰기(닉네임·비밀번호), 이미지 올리기, 지문 고정닉 가입·로그인, 신고 → 자동 숨김 → 관리 앱 복구, 작성자 삭제 후 이미지·글이 바로 404.
- 관리 앱: 홈, 수집기(실패 없음), D1 사용량, 방문자(봇/사람), 푸시 테스트 알림.
- 도구 페이지가 예전과 같은지(사용 제한·로그인 요구 없음), `/ko/pricing/`이 404인지.

## 1. 운영 D1 (Claude, 오너 허락 후)

1. 마이그레이션 적용: `npx --yes wrangler@4.135.0 d1 migrations apply nerulio-prod --remote --config ops/d1.wrangler.toml` (0011 이후 전부).
2. 정리 SQL: `npx --yes wrangler@4.135.0 d1 execute nerulio-prod --remote --config ops/d1.wrangler.toml --file ops/sql/2026-09-29-data-cleanup.sql`
3. GitHub Secret `CF_D1_DATABASE_ID_PROD` = `bc890e90-fca6-4837-82ad-0574c2378293` (다중 D1 수집을 쓰는 버전이 main에 있을 때). 그다음 Actions → seed-sync를 전체 분야로 한 번 수동 실행 → 운영 DB에 한국어 이름·날짜 수정 반영. 수집기도 다음 실행부터 운영 DB에 함께 쓴다.
4. 확인: `SELECT vertical,COUNT(*) FROM entities GROUP BY 1` → 5개 분야, 1,580개.

## 2. Pages 운영 환경 설정

Workers & Pages → nerulio → Settings → 오른쪽 위 **Production**.

**바인딩 (오너)** — Bindings → + Add

| 종류 | 변수 이름 | 값 |
| --- | --- | --- |
| D1 database | `DB` | `nerulio-prod` |
| Analytics engine | `TRAFFIC` | `nerulio_traffic` |
| R2 bucket | `UPLOADS` | `nerulio-uploads` |

**변수 (오너, Text)**

| 이름 | 값 |
| --- | --- |
| `SERVICE_API` | `on` |
| `PLATFORM` | `on` |
| `TOOL_METERING` | `off` |
| `SITE_URL` | `https://nerulio.com` (이미 있음) |

**비밀값 (Claude가 생성해서 값을 보지 않고 넣는다)** — `SESSION_SECRET`(프리뷰와 다른 값), `ANON_ID_SECRET`(한 번 정하면 바꾸지 않는다), `VAPID_PUBLIC_KEY`·`VAPID_PRIVATE_KEY`·`VAPID_SUBJECT`, `NOTIFY_TOKEN`, `CF_ACCOUNT_ID`. 예: `node tools/admin-keys.mjs --json` → `wrangler pages secret bulk <파일> --project-name nerulio` (파일은 넣은 즉시 지운다).

**비밀값 (오너)** — `ADMIN_SETUP_CODE`(16자 이상, 운영용 새 코드), `CF_ANALYTICS_TOKEN`·`GITHUB_DISPATCH_TOKEN`(프리뷰와 같은 토큰 재사용 가능), `TURNSTILE_SITE_KEY`(Text)·`TURNSTILE_SECRET_KEY`(이미 운영에 있음). 운영에서는 Turnstile이 없으면 비로그인 글쓰기가 막힌다.

## 3. GitHub 설정 (Claude)

- 변수 `NOTIFY_URL` = `https://nerulio.com`, Secret `NOTIFY_TOKEN` = 운영 값 (알림 대상을 운영 관리 앱으로 옮김).

## 4. 배포와 확인

1. 운영 재배포: main에 새 커밋이 들어가거나 대시보드 Deployments → 최신 운영 배포 → Retry. 변수·바인딩은 **다음 배포부터** 적용된다.
2. `https://nerulio.com/api/v1/health` → `configured:true`, `database:true`, `metering:false`, `turnstile:true`, `passkey.signup:true`.
3. 도구 페이지 몇 개(무거운 도구, 스튜디오)가 예전과 같은지, 광고가 그대로인지.
4. `https://nerulio.com/ko/community/`, 채널, Claude 장애 페이지, 검색, 레이더.
5. **관리 앱 패스키 재등록**: 패스키는 도메인에 묶여서 프리뷰(`*.pages.dev`)에서 만든 것은 운영에서 쓸 수 없다. 폰으로 `https://nerulio.com/admin/` → 이 휴대폰 등록하기 → 운영 `ADMIN_SETUP_CODE` → 지문. 홈 화면에 설치, 알림 켜기, 테스트 알림.
6. 유동 글 한 개와 이미지 한 장을 올렸다가 비밀번호로 지워서 바로 404가 되는지.

## 5. 검색 등록 (오너)

- Google Search Console (2009seungbin 계정, 도메인 속성 `sc-domain:nerulio.com`) → Sitemaps → `sitemap.xml` 다시 제출 (`sitemap-n2-*` 포함).
- 네이버 서치어드바이저 → 사이트맵 제출.

## 6. 운영 초기

- 처음에는 AI·한글패치·GPU 주제 위주로 조용히 연다. 신고 → 임시조치 → 처리 흐름을 관리 앱으로 직접 돌려 본다.
- CSAM Scanning Tool(nerulio.com → Caching → Configuration)이 켜져 있는지, 대시보드에 검사 기록이 생기는지 확인한다.

## 되돌리기

Production 변수에서 `PLATFORM`(과 필요하면 `SERVICE_API`)을 지우고 재배포하면 예전 정적 사이트로 돌아간다. D1·R2 데이터는 그대로 남는다.
