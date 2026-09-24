# 결제 (Billing)

> **현재 상태: live 결제는 연결되어 있지 않다.** 검증된 것은 내부 `sandbox` provider를 통한 end-to-end 흐름(체크아웃 생성 → 서명된 webhook → Pro 활성화 → 취소 → Free 복귀)뿐이다. Paddle 어댑터는 공개 문서 기준으로 작성되었고 실제 Paddle sandbox 계정으로 검증하지 않았다.

## 원칙

1. Pro 권한은 **D1 `subscriptions` 행만**으로 판정한다. 그 행은 **서명이 검증된 webhook**(또는 운영자가 직접 넣는 `provider='manual'` 테스트 행)만 쓴다.
2. 체크아웃 성공 리디렉트는 아무 권한도 주지 않는다. `/account/?checkout=success`는 webhook 반영을 기다리며 `/me`를 최대 5회(2·4·8·16·30초) 다시 확인할 뿐이다.
3. `localStorage` 등 클라이언트 값으로 Pro를 판단하지 않는다.
4. 카드 정보는 저장하지 않는다. 저장: 상태, 기간 종료일, 해지 예약 여부, 결제사의 customer/subscription ID.

## Provider 추상화 (`server/billing/`)

```
createCheckout({user, env, origin, fetcher})   → {url}
verifyWebhook({headers, body, env, now})       → boolean   (서명 + 5분 재전송 창)
normalizeWebhook(payload, env)                 → {eventId, type, occurredAt, subscription|null}
portal({customerId, subscriptionId, env, ...}) → {url}     (구독 관리/해지)
getSubscription(...)                           → 정합성 점검용 (미구현, null)
```

정규화된 subscription: `{externalSubscriptionId, externalCustomerId, userId, plan, status, currentPeriodEnd, cancelAtPeriodEnd}`. 새 결제사는 이 파일 하나를 추가하고 `PROVIDERS`에 등록하면 된다. 해지는 결제사 포털에서 수행하고, 그 결과로 오는 webhook이 계정을 Free로 되돌린다.

| Provider | 상태 |
| --- | --- |
| `sandbox` | 내부 테스트용. 결제 없음. 체크아웃은 `/account/?checkout=sandbox`로 이동만 하고 **아무것도 부여하지 않는다.** Pro는 `BILLING_WEBHOOK_SECRET`로 서명된 webhook(`tools/billing-sandbox.mjs`)이 도착해야 시작된다. **운영(production) 빌드에서는 설정해도 자동으로 꺼진다.** |
| `paddle` | Paddle Billing(merchant of record, 한국 판매자 지원). webhook 서명(`Paddle-Signature: ts;h1`) 검증·정규화는 합성 서명으로 단위 테스트됨. 체크아웃은 `POST /transactions`의 `checkout.url`을 사용하는데, 이 URL은 Paddle에 **기본 결제 링크(default payment link)** 로 등록된 우리 사이트 페이지에서 Paddle.js가 열어야 한다 — **그 페이지는 아직 구현되지 않았다.** 운영 전 필수 작업. |

결제사를 아직 확정하지 않았다면 어댑터 구조만 사용하고, 확정 후 해당 어댑터를 sandbox에서 끝까지 검증한다. Stripe는 한국 법인/개인 판매자를 직접 지원하지 않으므로 MoR(Paddle, Lemon Squeezy 등) 또는 국내 PG(토스페이먼츠 등) 어댑터가 현실적이다.

## 모드 안전장치 (`server/config.js`)

| 설정 | production 빌드 | preview 빌드 |
| --- | --- | --- |
| `BILLING_PROVIDER` 없음 | off | off |
| `BILLING_PROVIDER=sandbox` | **거부 → off** | sandbox |
| `BILLING_PROVIDER=paddle`, `BILLING_MODE=sandbox` | sandbox | sandbox |
| `BILLING_PROVIDER=paddle`, `BILLING_MODE=live` | live | **거부 → off** |
| 필수 secret 누락 | off | off |

production/preview 구분은 빌드 시 `CF_PAGES_BRANCH`(또는 `SITE_ENV=preview`)로 결정되어 Worker 번들(`build-info.js`)에 고정된다. off일 때 가짜 성공 상태를 만들지 않고 가격 페이지는 "아직 결제를 받지 않습니다"를 표시한다.

## Webhook 처리

```
결제사 → POST /api/v1/billing/webhook
  ├─ 본문 ≤ 256 KiB, 원문 그대로 서명 검증 (실패 401, 5분 초과 타임스탬프 거부)
  ├─ normalize (알 수 없는 이벤트 400)
  └─ D1 batch (한 트랜잭션)
       1. billing_events(provider,event_id) pending 삽입 — 중복이면 아무것도 안 함
       2. 이번 batch가 이벤트를 선점했고, 사용자 존재하고, occurredAt ≥ 저장된 updated_at 일 때만 subscriptions upsert
       3. 이벤트 processed / ignored 확정
```

- 같은 이벤트가 여러 번 와도 한 번만 반영(`duplicate:true`).
- 늦게 도착한 오래된 이벤트는 최신 상태를 덮지 않는다.
- 우리 사용자 ID가 없는 이벤트는 이미 소유한 구독만 갱신할 수 있고, 아니면 `ignored`로 기록된다.
- `billing_events`는 90일 보관(결제사 재시도 창보다 길다).

## 구독 수명주기와 Pro 판정

Pro 판정(`server/identity.js grantsPro`, 2026-09-24 소유자 결정): `plan='pro'`(= Pro로 파는 가격 ID)이고 분쟁 표시가 없고 계정이 플래그되지 않았을 때만.

| 상황 | 결과 |
| --- | --- |
| 결제 완료 webhook (active / trialing) | `current_period_end`까지 Pro |
| 해지 예약 (`cancel_at_period_end=1`) | 기간 종료까지 Pro, 계정 페이지에 종료일 표시 |
| `canceled` (자발적 환불 포함) | **결제한 기간이 끝날 때까지 Pro**, 그다음 Free. 기간 종료일이 없는 canceled 이벤트는 저장된 종료일을 유지 |
| `past_due` (카드 재시도 중) | 처음 past_due가 된 때부터 `PAST_DUE_GRACE_DAYS`일(기본 7, 3–7) Pro, 그다음 Free. 계정 페이지에 유예 종료일 |
| 차지백·분쟁 (`adjustment.*`의 `chargeback`, `chargeback_warning`) | **즉시 Free + 계정 플래그**(`users.flagged_at`, `flag_reason='chargeback'`). 나중에 오는 active 이벤트도 되살리지 못하고, 새 결제는 `ACCOUNT_FLAGGED`로 거부. 해제는 운영자가 검토 후 SQL로(`UPDATE users SET flagged_at=NULL,flag_reason=NULL WHERE id=…` + 해당 구독 `disputed_at=NULL`) |
| 환불 `refund`·`credit`·`chargeback_reverse` | 기록만(Pro 판정은 구독 상태가 결정) |
| `paused`, 알 수 없는 상태, 알 수 없는 가격 ID | Free |

가격: 월간 `BILLING_PRICE_ID`, 연간 `BILLING_PRICE_ID_YEARLY`, 기존 가입자가 남아 있는 옛 가격은 `BILLING_PRICE_IDS_LEGACY`(쉼표 구분). 이 목록에 없는 가격은 절대 Pro가 아니다. 가격 페이지는 `PRO_PRICE_MONTHLY_AMOUNT`/`PRO_PRICE_YEARLY_AMOUNT`/`PRO_PRICE_CURRENCY`로 두 주기를 표시하고 연간 절약률은 두 값으로 계산한다(4.99×12 → 40 ≈ 33%). Paddle webhook은 `subscription.*`와 `adjustment.*`를 켠다.

`NERULIO_ENV=development`는 Cloudflare Pages에서 만든 빌드(`CF_PAGES=1`)에서 무시된다 — 운영 빌드에서 sandbox 결제가 켜질 수 없다(`/health`가 경고).

## 출시 순서

1. Free quota와 광고를 preview에서 검증.
2. 운영자 테스트 Pro 행으로 Pro/광고 제거 검증 ([CLOUDFLARE.md](CLOUDFLARE.md) 9–10단계).
3. preview에서 `BILLING_PROVIDER=sandbox`로 체크아웃→webhook→Pro→취소 end-to-end 확인.
4. 실제 결제사 어댑터를 그 결제사의 sandbox로 end-to-end 확인 (Paddle이면 결제 링크 페이지 구현 포함).
5. 그 다음에만 production에 live 자격 증명을 설정.
