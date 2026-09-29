# 검색엔진 사이트맵 제출 (구글 · 네이버)

포털 PR([#64](https://github.com/2009seungbin-stack/my-first-repo/pull/64))이 **머지되고 운영에 배포된 뒤**에 한다.

- 사이트맵은 파일을 올리는 것이 아니다. 사이트가 이미 주소로 내보내고 있으니, 그 **주소를 입력**하면 된다.
- 운영 DB나 코드는 건드리지 않는다. 오너가 각 검색엔진 화면에서만 하는 일이다.

## 0. 제출할 주소

| 무엇 | 주소 |
|---|---|
| **사이트맵 색인** (아래 모두를 묶은 목차) | `https://nerulio.com/sitemap.xml` |
| 게임 도구·홈 | `https://nerulio.com/sitemap-game.xml` |
| 파일 도구 | `https://nerulio.com/sitemap-tools.xml` |
| 가이드 | `https://nerulio.com/sitemap-guides.xml` |
| 이미지 | `https://nerulio.com/sitemap-images.xml` |
| 커뮤니티·AI(포털 홈 `/` · `/en/`, 채널, AI 상태 페이지) | `https://nerulio.com/sitemap-n2-ai.xml` |
| 게임 채널 | `https://nerulio.com/sitemap-n2-games.xml` |
| PC·하드웨어 | `https://nerulio.com/sitemap-n2-hardware.xml` |
| 창작 도구 | `https://nerulio.com/sitemap-n2-studio.xml` |
| 애니·서브컬처 | `https://nerulio.com/sitemap-n2-subculture.xml` |

RSS는 네이버만 받는다.

| RSS | 주소 |
|---|---|
| Claude 장애 | `https://nerulio.com/ko/ai/claude/status/feed.xml` |
| ChatGPT 장애 | `https://nerulio.com/ko/ai/chatgpt/status/feed.xml` |
| Gemini 장애 | `https://nerulio.com/ko/ai/gemini-app/status/feed.xml` |
| 레이더 소식 | `https://nerulio.com/ko/radar/feed.xml` |

이번 PR로 바뀐 주소는 다음과 같다. 제출하면 검색엔진이 알아서 반영한다.
- 도구 모음이 `/ko/` → **`/ko/tools/`**, `/en/` → **`/en/tools/`**로 옮겨졌다.
- `/`와 `/en/`은 이제 포털 홈이다.
- `/ko/`는 `/`로 301 리다이렉트된다.

## 1. 구글 서치콘솔

1. https://search.google.com/search-console 에 들어가 **nerulio.com** 속성을 고른다.
2. 왼쪽 메뉴에서 **Sitemaps(사이트맵)**를 연다.
3. "새 사이트맵 추가" 칸에 `sitemap.xml`을 입력하고 **제출**을 누른다. 도메인은 이미 앞에 붙어 있다.
   - 목차 하나만 내면 안에 든 사이트맵 전부가 같이 읽힌다.
   - 이미 제출돼 있으면 다시 제출하면 된다. "마지막으로 읽은 날짜"가 오늘로 바뀐다.
4. 빨리 반영하고 싶은 페이지는 위쪽 **URL 검사**에 넣고 **색인 생성 요청**을 누른다. 하루에 몇 개로 제한된다.
   - `https://nerulio.com/`
   - `https://nerulio.com/ko/tools/`
   - `https://nerulio.com/ko/ai/claude/status`
5. 며칠 뒤 **페이지 색인 생성** 보고서에서 `/ko/`가 "리디렉션이 포함된 페이지"로 옮겨 갔는지 확인한다. 정상이다.

**소유 확인이 풀렸다고 나오면**
- 도메인 속성(DNS TXT로 확인한 경우)이면 영향이 없다.
- URL 접두어 속성을 **HTML 태그**로 확인했다면, 태그 값이 Cloudflare Pages 환경 변수 `GOOGLE_SITE_VERIFICATION`에 들어 있어야 포털 홈 `/`에도 그 태그가 나온다. 이번 PR에서 지원을 추가했다.
- 값을 넣었거나 바꿨다면 다시 배포한 뒤 서치콘솔에서 **확인**을 누른다.

## 2. 네이버 서치어드바이저

1. https://searchadvisor.naver.com 에 들어가 **웹마스터 도구**를 연다.
2. **사이트 등록**: 처음이면 `https://nerulio.com`을 입력한다.
3. **소유 확인**은 **HTML 태그** 방식을 고른다.
   1. 네이버가 주는 `<meta name="naver-site-verification" content="…">`에서 **content 값만** 복사한다.
   2. Cloudflare 대시보드에서 **Workers & Pages → nerulio → Settings → Variables and Secrets**(화면에 따라 Environment variables)의 Production에 `NAVER_SITE_VERIFICATION` = 복사한 값을 추가한다.
   3. 다시 배포한다. 새 커밋을 올리거나 Deployments에서 Retry deployment를 누른다.
   4. 배포가 끝나면 `https://nerulio.com/` 소스 보기에서 `naver-site-verification`이 보이는지 확인한다.
   5. 네이버에서 **소유확인**을 누른다.
   - HTML 파일 업로드 방식은 쓰지 않는다. 빌드가 루트에 임의 파일을 싣지 않기 때문이다.
4. 사이트를 고른 뒤 **요청 → 사이트맵 제출**에서 `https://nerulio.com/sitemap.xml`을 제출한다.
   - 네이버가 색인 파일을 받지 않으면 0번 표의 사이트맵 9개를 하나씩 제출한다.
5. **요청 → RSS 제출**에서 0번 표의 RSS 4개를 하나씩 제출한다.
6. **요청 → 웹 페이지 수집**에 `https://nerulio.com/`, `https://nerulio.com/ko/tools/`, `https://nerulio.com/ko/ai/claude/status`를 넣는다.
7. (선택) **설정 → 수집 설정(robots.txt)**에서 차단된 경로가 없는지 확인한다. `robots.txt`는 `Allow: /`이고 사이트맵 주소가 적혀 있다.

## 3. (선택) Bing

- https://www.bing.com/webmasters 에서 **Import from Google Search Console**을 누르면 사이트와 사이트맵을 그대로 가져온다.
- 태그로 확인한다면 값은 `BING_SITE_VERIFICATION` 환경 변수에 넣는다.

## 확인 체크리스트

- [ ] 운영 배포 후 `https://nerulio.com/`에 포털 홈이 뜬다.
- [ ] `https://nerulio.com/ko/`가 `/`로 이동한다.
- [ ] `https://nerulio.com/ko/tools/`에 도구 모음이 뜬다.
- [ ] `https://nerulio.com/sitemap.xml`을 브라우저로 열면 `sitemap-n2-ai.xml` 등이 보인다.
- [ ] 구글에 `sitemap.xml`을 제출하고, 상태가 "성공"인지 본다.
- [ ] 네이버에서 소유 확인, 사이트맵 제출, RSS 4개 제출을 마친다.
