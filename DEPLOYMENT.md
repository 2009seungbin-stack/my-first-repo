# FileForge 운영 배포 가이드

현재 기본 빌드는 **광고 없는 정적 사이트**다. 이 저장소의 커밋/검사 통과는 Cloudflare 배포 성공, Google 색인 또는 AdSense 승인을 의미하지 않는다. 실제 도메인·Google 계정·광고 단위는 운영자가 설정한다.

> **계정·Free/Pro·결제 계층(선택)**: `SERVICE_API=on`일 때만 빌드된다. 켜기 전에 [docs/CLOUDFLARE.md](docs/CLOUDFLARE.md)의 D1·secret·OAuth 순서를 먼저 완료한다. 설계는 [docs/SERVICE-ARCHITECTURE.md](docs/SERVICE-ARCHITECTURE.md), 인증은 [docs/AUTH.md](docs/AUTH.md), 결제는 [docs/BILLING.md](docs/BILLING.md), 요금 정책은 [docs/PRICING-MODEL.md](docs/PRICING-MODEL.md). 서비스 빌드에서 AdSense는 `/api/v1/me`가 `ads:true`일 때만 런타임에 로드된다(Pro는 광고 요청 0).

### 현재 공개 배포 (2026-09-20)

공개 주소는 https://fileforge-studio.pages.dev/ 이다. Cloudflare Pages 프로젝트 `fileforge-studio`에 `2009seungbin-stack/my-first-repo`를 연결했다. **`main`에 push하면 Cloudflare가 자동으로 빌드·배포한다.** 수동 ZIP 업로드는 운영 업데이트 절차로 사용하지 않는다.

프로젝트 **Settings → Build**에서 `npm run build`, 출력 `dist`, 루트 디렉터리 비움, 운영 브랜치 `main`, Automatic deployments Enabled, Build system Version 3으로 설정했다. GitHub 앱 접근 범위는 이 저장소 하나다. 운영 환경 변수는 아래와 같으며, `ADSENSE_CLIENT`·광고 슬롯·`ADSENSE_CMP_READY`는 아직 설정하지 않았다.

| Production 변수 | 값 |
| --- | --- |
| `SITE_URL` | `https://fileforge-studio.pages.dev` |
| `ADSENSE_VERIFICATION_CLIENT` | `ca-pub-8363911006404719` |
| `SKIP_DEPENDENCY_INSTALL` | `true` |

로컬에서 같은 빌드를 확인할 때:

```powershell
$env:SITE_URL='https://fileforge-studio.pages.dev'
$env:ADSENSE_VERIFICATION_CLIENT='ca-pub-8363911006404719'
npm run build
```

확인용 게시자 값은 로그인된 AdSense 계정에서 발급된 공개 ID다. 광고 스크립트·광고 단위·광고용 Worker는 활성화하지 않는다. 배포 성공과 AdSense 심사 승인은 별개다. 업데이트 후 **Deployments**에서 최신 Git 커밋과 성공 상태를 확인한다. 빌드가 실패하면 해당 배포의 로그를 확인하고 코드를 수정해 다시 push한다.

AdSense에서 ads.txt 소유권 확인 성공 후 검토 요청을 제출했고, 화면 상태는 **준비 중 / 사이트의 광고 게재 가능 여부 검토 중**이었다. 자동 광고와 자동 최적화는 모두 사용 안 함으로 확인했다. Google CMP의 동의·동의하지 않음·옵션 관리 3개 선택사항을 설정했지만, 실제 지역별 동의 동작과 광고 게재는 아직 검증하지 않았으므로 `ADSENSE_CMP_READY`는 설정하지 않는다. 승인 후 실제 광고 단위와 CMP 검증을 완료하고 광고 빌드로 전환한다.

Git 연결 복구: 설치된 Cloudflare GitHub 앱이 계정 목록에 나타나지 않아 사용자 승인 후 앱을 해제하고, Pages의 GitHub 연결 흐름에서 이 저장소만 선택해 다시 설치·인증했다. 이후 기존 프로젝트 **Settings → Build → Git repository → Connect**에서 연결했다. 작업 시점의 대시보드는 이 전환을 지원했으며 기존 `pages.dev` 주소를 유지했다. 이전 Direct Upload 빌드 `67a95ae7-108f-417d-951f-d91eca586a01`은 과거 배포 기록이다.

## 1. Cloudflare Pages 만들기

1. Cloudflare Dashboard → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**(Git 저장소 가져오기)를 선택한다. Workers 배포가 아니라 Pages의 Git 연동을 선택한다.
2. GitHub를 연결하고 `2009seungbin-stack/my-first-repo` 접근을 허용한다.
3. 다음 설정을 입력하고 **Save and Deploy**를 누른다.

| 설정 | 값 |
| --- | --- |
| Git provider | GitHub |
| Repository | `2009seungbin-stack/my-first-repo` |
| Production branch | `main` |
| Framework preset | None |
| Root directory | 저장소 루트, 비워 둠 |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node | `.node-version`의 `22.23.2` |

프로젝트에는 npm 의존성이 없으므로 `npm install`은 필요 없다. 자동 설치도 생략하려면 **Settings → Variables and Secrets**에서 `SKIP_DEPENDENCY_INSTALL=true`를 추가한다. Node 버전 환경 변수를 따로 지정했다면 `.node-version`과 충돌하지 않게 삭제하거나 같은 값으로 맞춘다. `package.json`의 Node `>=20` 호환 범위는 유지한다.

4. 배포 로그가 성공하면 제공된 HTTPS `pages.dev` 주소를 연다. `/`, `/en/image/upscale/`, `/ko/image/remove-bg/`, `/ja/pdf/merge/`와 새로고침을 확인한다.
5. 존재하지 않는 URL은 **HTTP 404**여야 한다. 최상위 `404.html`이 있어 Pages의 무조건적인 SPA fallback을 사용하지 않는다. 각 목적/언어 경로는 실제 `index.html`이다. `_redirects`로 전체 경로를 홈으로 보내지 않는다.

공식 참고: [Git 연동](https://developers.cloudflare.com/pages/get-started/git-integration/), [빌드 설정](https://developers.cloudflare.com/pages/configuration/build-configuration/), [Node와 설치 생략 설정](https://developers.cloudflare.com/pages/configuration/build-image/).

## 2. 커스텀 도메인과 SITE_URL

실제 도메인을 확보한 뒤 Pages 프로젝트 → **Custom domains → Set up a custom domain**에서 연결한다. 루트 도메인은 Cloudflare zone/nameserver 설정을 완료한다. 외부 DNS의 서브도메인은 Pages에서 도메인을 먼저 등록한 후 안내된 CNAME을 설정한다. 인증서 발급과 활성 상태를 확인한다. [공식 도메인 연결 절차](https://developers.cloudflare.com/pages/configuration/custom-domains/)

**Settings → Variables and Secrets → Production**에 `SITE_URL`을 실제 HTTPS 대표 주소로 지정하고 재배포한다. 예를 들어 도메인을 실제로 확보했다면 `https://실제도메인/` 형태다. 이 문자열을 그대로 입력하지 않는다. 주소에는 사용자 정보·쿼리·fragment를 넣지 않는다. root domain 배포에는 GitHub 저장소 이름을 붙이지 않는다.

로컬 빌드 문법:

```sh
# example.com은 문법 설명용 예약 도메인이다. 운영에는 본인 주소를 쓴다.
SITE_URL=https://example.com npm run build
```

```powershell
$env:SITE_URL='https://example.com'
npm run build
Remove-Item Env:SITE_URL
```

- 값이 있으면 canonical, ko/en/ja 및 x-default hreflang, Open Graph URL, sitemap의 절대주소와 robots의 sitemap 위치가 생성된다.
- 값이 없으면 canonical/hreflang/og:url을 생략한다. `robots.txt`는 크롤링을 허용하고 `sitemap.xml`은 URL 없는 유효 XML로 생성한다. 도메인을 추측하거나 `pages.dev`를 자동 채우지 않는다. **Search Console 제출 전에는 반드시 SITE_URL을 설정하고 재배포한다.**
- 별칭 경로는 대표 기능 URL로 canonical을 통합한다. 쿼리 설정은 canonical이나 sitemap에 추가하지 않는다. sitemap은 별칭을 제외한 3개 언어의 대표 공개 페이지를 포함한다.
- `main`의 `프로젝트.pages.dev`는 임시 운영 확인 주소다. 커스텀 도메인 전환 후에는 `SITE_URL`을 그 도메인으로 통일하고, 필요하면 Cloudflare에서 기본 pages.dev → 대표 도메인 리디렉션을 설정한다.
- 브랜치/해시 프리뷰는 운영 도메인과 별개다. `CF_PAGES_BRANCH`가 `main`이 아니거나 `SITE_ENV=preview`이면 광고를 강제로 끄고 HTML/HTTP `noindex`, `robots Disallow: /`, 빈 sitemap을 생성한다. Preview 환경에는 광고 변수를 넣지 않는다. `SITE_URL`은 비워 두거나 운영 주소를 사용해도 되며 프리뷰 검색 노출은 차단된다. 검색 제외는 접근 제어가 아니므로 비공개 프리뷰가 필요하면 Cloudflare Access를 별도로 설정한다.

## 3. 정책과 연락처

`/about/`, `/privacy/`, `/terms/`, `/contact/` 및 각 `ko/en/ja` 페이지를 확인한다. 도구 페이지의 정책 링크는 새 탭으로 열려 작업을 보존한다. 도구 내부 언어 변경은 기존 상태를 유지한다. 일반적인 새로고침/페이지 이동은 메모리의 작업을 지우므로 먼저 다운로드한다.

현재 연락 채널은 [공개 GitHub Issues](https://github.com/2009seungbin-stack/my-first-repo/issues)다. 작업 시점에 저장소가 공개이고 Issues가 활성화되어 있음을 GitHub API로 확인했다. 가짜 이메일이나 운영자 신원을 만들지 않았다. 나중에 Issues를 닫거나 저장소를 비공개로 전환한다면 **배포 전에 운영자가 실제 연락 방법을 설정해야 한다.** 별도 비공개 문의 방법이 필요한 운영자는 실제 주소를 제공하고 정책을 갱신한다.

개인정보 안내는 선택 파일을 서버에 업로드하는 API가 없는 점과, 호스팅/CDN/모델 요청 및 언어 저장·브라우저 캐시를 구분한다. 분석 도구는 추가하지 않았다. Cloudflare Web Analytics, Zaraz 등 대시보드 기능을 별도로 켜면 정책을 그 실제 동작에 맞게 수정한다. 운영자 정보나 관할별 필수 고지 사항도 실제 운영 주체 기준으로 검토한다.

## 4. AdSense 신청과 단계별 활성화

**기본값: 꺼짐.** `ADSENSE_CLIENT`가 없으면 광고 스크립트/광고 DOM/빈 광고 공간/Google 광고 요청/광고용 Pages Worker가 없다. `ads.txt`도 기본적으로 없지만, `ADSENSE_VERIFICATION_CLIENT`에 실제 게시자 ID를 넣으면 광고 실행 없이 소유권 확인용 파일만 생성한다. 이 확인 모드도 HTTPS `SITE_URL`이 필요하고 프리뷰에서는 파일을 생성하지 않는다. 두 게시자 변수를 함께 쓰면 동일한 ID여야 한다. 소스에 테스트 계정이나 임의 게시자 값을 넣어 운영하지 않는다.

1. 실제 사이트와 정책·문의 페이지를 공개하고 모바일 동작을 확인한다. AdSense에 사이트를 추가한다. 승인 여부와 시기는 Google 판단이며 이 구현이 승인을 보장하지 않는다.
2. Google에서 발급한 실제 Publisher ID(`ca-pub-` 뒤 숫자 16자리)를 받는다. 신청 과정에서 이미 발급될 수 있다. AdSense **Auto ads는 OFF**로 유지한다. 자동/앵커/전면 광고로 편집기 안에 임의 삽입하지 않도록 한다.
3. Google **Privacy & Messaging**에서 해당 사이트용 인증 동의 메시지를 설정·게시한다. EEA/UK/Switzerland 대상 Google 인증 CMP 요구사항을 확인한다. 별도 인증 CMP를 쓰려면 해당 업체의 실제 통합이 추가로 필요하다. `ADSENSE_CMP_READY`는 CMP가 아니라 **운영자가 설정·검증했음을 확인하는 빌드 게이트**다. 가짜 쿠키 팝업이나 동의 신호를 생성하지 않는다.
4. Production에 `ADSENSE_CLIENT`를 실제 값으로 설정한다. 잘못된 형식은 빌드가 실패한다. HTTPS `SITE_URL`도 필요하다. 이 단계에서는 AdSense 스크립트와 `ads.txt`만 생성되고, 수동 slot 변수가 없으면 광고 박스는 생성하지 않는다. Auto ads를 꺼 두어야 이 구분이 유지된다.
5. 승인과 동의 구성을 확인한 후 AdSense에서 반응형 **디스플레이 광고 단위**를 만들고 아래 값을 넣는다. 콘텐츠 2번은 선택 사항이다.

| Production 환경 변수 | 운영자가 넣을 실제 값 |
| --- | --- |
| `ADSENSE_CLIENT` | Google이 발급한 전체 `ca-pub-…` 값 |
| `ADSENSE_SLOT_CONTENT_1` | 첫 수동 광고 단위의 숫자 10자리 ID |
| `ADSENSE_SLOT_CONTENT_2` | 둘째 광고 단위의 숫자 10자리 ID, 선택 |
| `ADSENSE_CMP_READY` | 실제 CMP 구성을 검증한 뒤 `true` |

슬롯 변수가 있는데 CMP 확인이 없으면 빌드를 실패시킨다. 광고는 **편집기 → 관련 도구 → 기능 설명 → 광고 1 → FAQ → 광고 2** 순서다. 정책 페이지에는 수동 광고를 배치하지 않는다. 언어에 맞게 광고/Advertisement/広告를 표시한다. 언어나 내부 도구 변경 시 설명 부분만 교체하고 기존 광고 노드와 iframe은 DOM에 붙어 있는 상태로 유지해 새 요청을 만들지 않는다. 자동 갱신, 광고 클릭 유도, 광고 시청 조건 다운로드는 없다. 광고 차단 또는 로드 실패가 편집/저장 기능을 막지 않는다.

`dist/ads.txt`는 실제 `ADSENSE_VERIFICATION_CLIENT` 또는 `ADSENSE_CLIENT`의 `ca-`를 제거한 게시자 ID로 Google 직접 계정 형식을 생성한다. Google이 계정에 표시하는 원문과 반드시 대조한다. 계정/판매 관계가 다른 경우에는 운영자가 제공받은 레코드에 맞게 수정한다. 두 ID가 모두 없거나 프리뷰 빌드이면 파일을 만들지 않는다. 두 환경 변수를 삭제하고 재배포하면 오래된 ads.txt와 광고용 Worker도 제거된다.

공식 참고: [광고 배치 정책](https://support.google.com/adsense/answer/1346295?hl=en), [인증 CMP 요구사항](https://support.google.com/adsense/answer/13554116?hl=en), [ads.txt 가이드](https://support.google.com/adsense/answer/12171612?hl=en).

### 광고와 CSP

Google은 변경되는 광고 도메인의 단순 허용목록 대신 strict CSP를 안내한다. 광고 활성 빌드에만 `dist/_worker.js`와 `_routes.json`을 생성한다. Pages advanced-mode Worker는 `env.ASSETS.fetch()`로 기존 정적 HTML을 받아 **응답마다 144비트 난수 nonce**를 모든 스크립트에 부여하고 nonce + strict-dynamic CSP를 설정한다. 고정 nonce를 빌드 파일에 넣지 않는다. 사용자 파일 처리/업로드 서버를 추가하는 구조가 아니다.

광고 HTML의 CSP는 Google의 변경 가능한 리소스 출처와 런타임을 허용하기 위해 HTTPS 외부 리소스와 eval을 허용한다. 광고가 없는 빌드의 기존 제한적인 CSP에는 이 변경이 없다. 기존 상대경로 `<base>`를 위해 `base-uri 'self'`는 유지한다. 응답 HTML은 nonce 재사용을 막도록 `no-store`이고 자산은 별도 제공한다. **광고 활성 상태를 다른 정적 호스트에 그대로 올리면 이 Worker가 실행되지 않으므로 지원하지 않는다.** Cloudflare Pages에서 Worker 배포·할당량·CSP와 실제 광고 요청을 확인해야 한다.

로컬 서버는 같은 nonce/CSP 변환 함수를 사용해 HTTP 검사를 한다. 별도로 Wrangler/workerd에서도 Worker 컴파일과 동작을 검사했다. 실제 Pages 프로젝트의 Functions 호환 날짜는 검증 기준인 `2026-09-18`로 맞춘 뒤 운영에서 확인한다. 로컬 검사는 Cloudflare 공개 엣지나 실제 Google 광고/CMP 검증을 대체하지 않는다. 테스트의 합성 ID는 네트워크 차단 fixture이고 실제 요청에는 사용하지 않는다. [Google CSP 통합 안내](https://support.google.com/adsense/answer/16283098?hl=en)

## 5. 운영자 체크리스트

- [ ] Cloudflare Pages Git 배포 성공, main 커밋 일치
- [ ] 커스텀 도메인 연결과 인증서 활성화, HTTPS 확인
- [ ] Production `SITE_URL` 설정 후 재배포
- [ ] 홈과 언어별 하위 URL 직접 접속·새로고침·404 확인
- [ ] `sitemap.xml` 절대주소와 `robots.txt` 확인
- [ ] Search Console에 실제 도메인 소유권 확인, sitemap 제출
- [ ] 주요 URL을 URL 검사로 확인하고 실제 색인 상태 추적
- [ ] About/Privacy/Terms/Contact와 실제 연락 채널 확인
- [ ] 모바일 실제 기기에서 편집·언어 전환·다운로드 확인
- [ ] AdSense 신청 및 실제 Publisher ID 확인
- [ ] Auto ads OFF, 수동 배치 사용
- [ ] Google Privacy & Messaging 또는 인증 CMP 게시 및 지역별 동의/거절 검증
- [ ] `ADSENSE_CLIENT`, 실제 slot ID, CMP 확인 값 설정 후 재배포
- [ ] `ads.txt`를 AdSense 원문과 대조
- [ ] 광고 활성 Worker 정상 실행, 응답별 nonce 변화와 CSP 오류 확인
- [ ] 실제 광고가 편집/다운로드/내비게이션에서 분리되는지 확인
- [ ] 광고 로드 실패·동의 거절 상태에서도 다운로드 가능한지 확인

## 6. 로컬 검증

```sh
npm run check
npm test
npm run build
node tools/serve.mjs --dist
# http://127.0.0.1:4173
```

브라우저 검사는 선택적인 개발 의존성만 사용한다. 제품 빌드에는 추가 설치가 없다.

```sh
python -m pip install playwright pillow
python -m playwright install chromium
python tests/seo-browser.py
```

위 SEO 검사는 자체 격리 빌드와 서버를 만들고 종료한다. 기본/도메인/광고/프리뷰 설정, 언어·메타데이터·정책·모바일·상태 보존을 확인한다. 기존 편집기 회귀 검사와 재현 명령, 실제 실행 결과 및 미검증 범위는 [docs/TESTING.md](docs/TESTING.md)를 참고한다.
