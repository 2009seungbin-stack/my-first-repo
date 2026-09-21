# 가격 모델

## 요약

| | Nerulio Free | Nerulio Pro |
| --- | --- | --- |
| 도구 | 전부 | 전부 |
| 결과 품질 | 원본 품질 그대로 | 동일 |
| 처리 위치 | 사용자 기기 | 사용자 기기 |
| 워터마크 / 해상도 제한 | 없음 | 없음 |
| heavy 작업 | 하루 `FREE_DAILY_JOBS`회 (기본 30) | 무제한 |
| 광고 | 표시 (광고 빌드에서) | 없음 — 스크립트 요청 자체가 없음 |
| 가입 | 필요 없음 | Google 로그인 |

가격은 코드에 없다. `PRO_PRICE_AMOUNT` / `PRO_PRICE_CURRENCY` / `PRO_PRICE_INTERVAL` 빌드 변수 → `src/service-content.js priceText()` 한 곳에서 `Intl.NumberFormat`으로 모든 언어·페이지·모달에 표시한다. 값이 없으면 "가격은 출시 시 공개"로 표시한다. 실제 청구 금액은 결제사의 가격(`BILLING_PRICE_ID`)이 결정하므로 두 값을 함께 바꾼다.

## 철학

- **Free 품질을 낮추지 않는다.** 검색으로 들어온 사용자가 첫 결과에서 실망하면 성장이 멈춘다. 워터마크·저해상도·느린 모드가 없다.
- **처리 비용이 서버에 없다.** 모든 처리가 기기에서 일어나므로 Pro는 "서버 자원 구매"가 아니라 "광고 없음 + 제한 없음"이라는 편의다.
- **가벼운 작업은 세지 않는다.** 자르기 하나 하러 온 사람은 한도나 계정을 의식할 일이 없다.
- **조용한 UX.** 남은 횟수는 계정 페이지, 한도 모달, 남은 횟수가 5회 이하일 때의 작은 안내에만 보인다. 도구 화면을 대시보드로 만들지 않는다.

## heavy 분류 (`src/quota.js`)

| heavy | none |
| --- | --- |
| AI 확대(`upscale`), AI 배경 제거(`remove-bg`의 portrait/general 모드), 이미지 압축(`compress`), PDF 압축(`pdf-compress`), 영상 내보내기(`media`, `video-trim`, `video-compress`), GIF(`video-gif`), 오디오(`video-mp3`), 게임 에셋 파이프라인(`refiner`, `texture-map`), 배치 팩(`marketplace-pack`, `print-pack`) | 자르기, 회전/뒤집기, 크기 조절, 변환, HEIC, 도트화/팔레트, 단색 배경 제거, PDF 편집·병합·분할·JPG 변환, 영상 프레임 추출, 스프라이트/아틀라스/타일/여백/파비콘 등 나머지 레시피 |

- 서버는 같은 표를 사용해 모르는 `toolId`(`UNKNOWN_TOOL`)와 `none` 도구(`NOT_METERED`)를 거부한다. 클라이언트가 임의 ID로 행을 만들 수 없다.
- 새 도구를 추가하면 `QUOTA_CLASSES`에 반드시 분류를 넣어야 한다(테스트가 모든 `INTENTS` ID의 분류 존재를 강제).

## 하루의 기준

UTC 날짜. 전 세계 모든 사용자가 같은 순간(00:00 UTC, 한국 09:00, 일본 09:00)에 초기화된다. 시간대 추정·조작 문제가 없다. 사용자에게는 "초기화까지 10시간 42분"처럼 남은 시간만 보여준다.

## 한도 조정

`FREE_DAILY_JOBS`를 바꾸고 재배포한다(1–10000). 코드 변경은 필요 없다. 운영 데이터(`/api/v1/admin/stats`의 `freeHeavyJobsToday`, `deniedToday`)를 보고 10/20/30/50 등으로 조정한다. 가격 페이지의 "하루 N회" 문구도 같은 변수로 빌드된다.

## 향후 확장

- **Team**: `subscriptions.plan='team'` + 좌석 테이블(migration). Pro 판정 함수에 plan 집합만 추가.
- **Cloud Credits**: 로컬로 불가능한 작업을 위한 향후 `cloud` quota class와 credit ledger 테이블. 현재 서버 처리·파일 업로드는 없다.
- **API**: `/api/v1`과 분리된 키 기반 네임스페이스. 현재 범위 아님.
