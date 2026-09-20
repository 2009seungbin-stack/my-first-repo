# 검증 기록 · Cloudflare / SEO / AdSense 준비 · 2026-09-20

## 현재 실행 결과

- `npm run check`: 모든 `src/`와 `tools/` JavaScript 모듈 문법 검사 통과.
- `npm test`: **613개 테스트 케이스 통과**. 기존 605개를 유지하고 배포 관련 8개를 추가했다. 기존 번역 421개 항목의 언어/변수 일치, 순수 이미지·ZIP·GIF 로직, 라우팅·HTML 검사 등을 포함한다. 추가 검사는 여러 assertion으로 콘텐츠 완성도, 정책, canonical/sitemap, 환경 변수 거부, 프리뷰 차단, nonce CSP, 빌드 전환을 검사한다. 기능 613개를 뜻하지 않는다.
- 고정한 **Node 22.23.2** 실행 파일을 공식 배포 SHA-256과 대조한 뒤 문법·613개 테스트·빌드를 실행해 통과했다. 개발 환경 Node 24.15.0에서도 npm 명령을 실행했다. Node 20은 지원 범위를 유지했지만 이번에 해당 바이너리로 실행하지 않았다.
- `npm run build`: **128개 정적 진입 HTML**과 별도 `404.html`, 스타일, JS/Worker 자산, robots/sitemap 생성. 운영 도메인이 있을 때 sitemap은 별칭을 제외한 **78개 언어별 대표 URL**을 포함한다.
- `python tests/browser.py`: **62개 HTTP 브라우저 assertion 통과**. 원래 메모리 대체 모드의 71개와 모드가 다르므로 합산하지 않는다. 확대 PNG의 실제 치수, 압축 WebP 실제 용량, 단색 제거 alpha, 픽셀 PNG, 구간 GIF의 형식/프레임 수, 언어별 UI, 설정·결과 보존, 하위 배포 경로를 확인했다. 언어 변경 전후 다운로드 PNG의 SHA-256이 같았다.
- `python tests/seo-browser.py`: **402개 HTTP 브라우저 assertion 통과**. 아래 네 가지 빌드를 독립 출력 폴더와 서버로 검사했다. Google 요청은 가로채며 실제 광고를 요청하지 않았다.
- `python tests/edge-browser.py`: **Wrangler 4.135.0 / workerd에서 13개 assertion 통과**. 실제 Pages 로컬 실행기의 Worker 컴파일, ASSETS 바인딩, HTML별 nonce, strict CSP 아래 편집기 실행, 광고 슬롯 분리, 정적 자산/ads.txt, 정책/404를 확인했다. 광고 스크립트는 mock이고 공개 엣지 배포 검증은 아니다.

## SEO 브라우저 검사 범위

| 빌드 | 설정과 검사 |
| --- | --- |
| disabled | SITE_URL/광고 없음, 절대 SEO 주소 생략, 최초 로드 외부 요청 없음 |
| production | 예약 테스트 도메인으로 canonical·OG URL·hreflang 설정 |
| ads | 합성 ID와 두 slot fixture, Google script 응답을 로컬 mock으로 대체 |
| preview | 운영 광고 변수 상속 상황에서도 광고 차단, noindex HTTP/HTML |

각 모드에서 홈, 영어 업스케일, 한국어 배경제거/압축, 일본어 PDF 합치기, Pixelize에 직접 접속하고 새로고침했다. title/h1/description, 설명·FAQ, canonical/언어 관계, 쿼리의 canonical 제외를 확인했다. ko/en/ja 정책 페이지 12개의 독립 문서와 언어 전환, 실제 404, trailing slash 리디렉션의 쿼리 보존도 검사했다.

실제 확대 결과를 만든 뒤 ja→ko→en을 거쳐 파일 바이트와 쿼리 설정이 보존되는지 확인했다. 입력 중인 확대 방식 설정도 남았다. 320px/390px 뷰포트에서 세 언어의 가로 넘침을 확인했다. 데스크톱/모바일 전체 페이지 스크린샷을 저장하고 상단 편집기와 하단 콘텐츠 분리를 검토했다.

광고 mock은 실제 DOM iframe을 생성한다. 언어 변경 때 광고 노드/iframe을 분리하지 않아 script나 iframe 요청이 새로 생기지 않는 것을 검사한다. 광고 위치는 편집기 밖 콘텐츠 영역이며, 기본 빌드에 광고 markup이 없음을 검사한다. 광고 활성 응답에는 매번 다른 nonce를 적용하고 CSP/본문이 일치하는지도 Node 테스트로 확인한다.

## 재현

```sh
npm run check
npm test
npm run build
python -m pip install playwright pillow
python -m playwright install chromium
python tests/seo-browser.py
```

기존 편집기 HTTP 회귀 검사는 서버 두 개를 사용한다. PowerShell에서 별도 터미널로 실행한다.

```powershell
# 터미널 1
node tools/serve.mjs --dist
# 터미널 2
$env:PORT='4174'
$env:BASE_PATH='/my-first-repo'
node tools/serve.mjs --dist
# 터미널 3
python tests/browser.py
```

완료 후 위 두 서버만 Ctrl+C로 종료한다. GIF 회귀 검사는 ffmpeg가 있으면 실행하며 이번 환경에서는 실행해 통과했다. 없으면 SKIP으로 보고한다. `--in-memory` 대체 모드는 기존 환경 지원용으로 유지하지만 이번 작업의 62개는 HTTP 실행 수치다. 원래 71개 메모리 검사를 이번 실행 결과로 재사용하지 않았다.

`test-results/`의 다운로드, 스크린샷, JSON 보고서와 로그는 Git에서 제외한다. 합성 Publisher ID는 격리 테스트 안에서만 사용하며 테스트 산출물을 배포하지 않는다. 기본 배포 산출물은 저장소 루트 `dist/`이고 광고가 꺼져 있다.

광고 활성 Worker의 별도 실행기 검사(먼저 SEO 검사로 fixture를 생성):

```powershell
$env:WRANGLER_SEND_METRICS='false'
npx --yes wrangler@4.135.0 pages dev test-results/seo/ads/dist --port 4275 --ip 127.0.0.1 --compatibility-date=2026-09-18 --show-interactive-dev-session=false --persist-to test-results/wrangler-state
# 별도 터미널
python tests/edge-browser.py
```

Wrangler는 선택적인 로컬 개발 도구이며 npm 의존성에 추가하지 않았다. 위 테스트 주소를 공개 배포하거나 Google 광고를 실제로 요청하지 않는다.

## 아직 실제 운영 환경에서 검증하지 않은 것

- Cloudflare 계정 연결, Git 자동 배포, 실제 공개 HTTPS 및 커스텀 도메인 DNS/인증서.
- Cloudflare 엣지에서 광고 활성 `_worker.js` 실행 및 플랫폼 할당량/캐시 동작.
- 실제 Google 광고 게재, 인증 CMP의 지역별 노출·동의·거절, AdSense 승인.
- Search Console 소유권 확인·sitemap 수집·실제 색인/검색 순위.
- 외부 PDF/HEIC/MP3/AI 엔진 전체 처리, 실물 모바일/저사양 기기 성능.

기존 실행 환경에서는 HTTP가 막혀 메모리 대체 검사를 사용했으나 이번 Windows 환경의 로컬 HTTP 검사는 가능했다. 이 차이를 실제 공개 배포 검증과 혼동하지 않는다.
