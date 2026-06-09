# SAFETYSAAS Agent — A2UI v0.9 구현 명세

> **작성일**: 2026-06-09  
> **대상**: A2UI (Agent-to-UI) v0.9 프로토콜 프론트엔드 구현 및 4개 시나리오 인터페이스 스펙

---

## 1. A2UI v0.9 프로토콜 개요

A2UI(Agent-to-UI)는 AI 에이전트가 텍스트 대신 또는 텍스트와 함께 **구조화된 UI 서피스**를 생성하는 프로토콜입니다.  
에이전트는 컴포넌트 의도를 선언하고, 클라이언트는 자체 디자인 시스템으로 렌더링합니다.

```
Agent → [A2UI Envelope stream] → Client Renderer → User UI
```

### 1.1 메시지 순서

```
1. status phase   : "인시던트 스키마를 불러오고 있어요…" (상태 텍스트)
2. reasoning phase: CoT 추론 단계 공개
3. answer phase   : 마크다운 텍스트 토큰 스트리밍
4. a2ui phase     : A2UI 봉투(envelope) 순차 적용
   ├─ createSurface    → 서피스 생성 (skeleton 표시)
   ├─ updateComponents → 컴포넌트 트리 삽입
   └─ updateDataModel  → 초기 데이터 바인딩 (완성)
5. done           : 스트리밍 종료
```

### 1.2 봉투(Envelope) 타입

| 타입 | 역할 |
|------|------|
| `createSurface` | 서피스 메타데이터(ID, 카탈로그, 테마) 선언 |
| `updateComponents` | 컴포넌트 adjacency-list 삽입/갱신 |
| `updateDataModel` | JSON Pointer 경로로 데이터 모델 패치 |
| `deleteSurface` | 서피스 폐기 |

---

## 2. 파일 구조

```
src/
├── lib/
│   ├── a2ui.ts          ← 순수 로직 (JSON Pointer, 봉투 적용, 검증, 바인딩)
│   └── a2ui-data.ts     ← 4개 시나리오 + 위험성평가 테이블 빌더 + 액션 응답 팩토리
├── components/
│   └── A2UISurface.tsx  ← React 렌더러 (모든 컴포넌트 타입 구현)
└── styles/
    └── a2ui.css         ← 디자인 토큰 기반 A2UI 스타일
```

---

## 3. 핵심 타입

### 3.1 A2UISurfaceState (런타임 서피스 상태)

```typescript
interface A2UISurfaceState {
  surfaceId: string;                              // 서피스 고유 ID
  catalogId: string;                              // A2UI 카탈로그 URL
  theme?: {
    primaryColor?: string;                        // CSS color — 버튼·선택·포커스 링
    agentDisplayName?: string;                    // 헤더 바 표시명
    iconUrl?: string;                             // 헤더 아이콘
  };
  sendDataModel: boolean;                         // 액션 발송 시 전체 dataModel 포함 여부
  version: string;                                // "v0.9"
  components: Record<string, A2UIComponent>;      // id → 컴포넌트 정의
  dataModel: Record<string, unknown>;             // JSON Pointer 기반 데이터
  deleted: boolean;
}
```

### 3.2 A2UIComponent (컴포넌트 노드)

```typescript
interface A2UIComponent {
  id: string;
  component: string;           // "Card" | "Column" | "Row" | "Text" | "Button" | …
  [key: string]: unknown;      // 컴포넌트별 추가 props
}
```

### 3.3 Message (A2UI 관련 필드)

```typescript
interface Message {
  // … 기존 필드 …
  phase?: "status" | "reasoning" | "answer" | "a2ui" | "done" | "stopped";
  a2uiState?: A2UISurfaceState | null;  // ← 서피스 상태 (localStorage 영속)
}
```

### 3.4 A2UIActionPayload (버튼 액션 이벤트)

```typescript
interface A2UIActionPayload {
  name: string;                          // 이벤트 이름 (e.g. "create_incident")
  surfaceId: string;                     // 발생 서피스
  sourceComponentId?: string;            // 트리거 버튼 ID
  timestamp: string;                     // ISO 8601
  context: Record<string, unknown>;      // 데이터 모델에서 resolve된 값들
  dataModel?: Record<string, unknown>;   // sendDataModel=true 일 때 포함
}
```

---

## 4. 지원 컴포넌트 카탈로그

| 컴포넌트 | 타입 | 설명 |
|---------|------|------|
| `Card` | 레이아웃 | 테두리·배경 카드. `child` 또는 `children` |
| `Column` | 레이아웃 | 세로 flex. `gap`, `align` |
| `Row` | 레이아웃 | 가로 flex. `gap`, `justify`, `align` |
| `Text` | 표시 | 마크다운 인라인. `variant`: body/h1/h2/h3/caption. formatString 지원 |
| `Icon` | 표시 | 내장 아이콘 (alert/activity/check 등) |
| `Divider` | 레이아웃 | `axis`: horizontal/vertical |
| `Button` | 입력 | `variant`: primary/secondary/borderless. `checks` 유효성. `action.event` 발송 |
| `TextField` | 입력 | `variant`: shortText/longText/number. `checks` 유효성 |
| `CheckBox` | 입력 | 토글 체크박스. 양방향 바인딩 |
| `ChoicePicker` | 입력 | 세그먼트 선택. `variant`: mutuallyExclusive/multiple |
| `Slider` | 입력 | 범위 슬라이더. `min/max/step`. CSS `--a2ui-fill` 트랙 |
| `Switch` | 입력 | ON/OFF 토글 |
| `Select` | 입력 | 드롭다운. `options` 배열 |
| `TagInput` | 입력 | 멀티 태그 입력. `suggestions` 칩 제공 |
| `DataTable` | 표시+입력 | 편집 가능 테이블. `rows.path` 데이터 바인딩 |
| `Tabs` | 레이아웃 | 탭 패널. `tabs[].title/child` |
| `Modal` | 레이아웃 | 팝업 모달. `triggerLabel` 버튼 |

### 데이터 바인딩

```jsonc
// 컴포넌트 value 필드에 path 객체 사용
{ "value": { "path": "/incident/severity" } }

// formatString 동적 텍스트 보간
{ "text": { "call": "formatString", "args": { "value": "트래픽 ${/deploy/canary}%" } } }

// checks 유효성 검사
{ "checks": [{ "call": "required", "args": { "value": { "path": "/incident/summary" } }, "message": "필수입니다." }] }
```

---

## 5. 시나리오 1 — 인시던트 보고 폼

### 5.1 개요

| 항목 | 값 |
|------|-----|
| 트리거 키워드 | `인시던트`, `장애 보고`, `incident`, `보고서 폼`, `인시던트 생성` |
| surfaceId | `incident_form` |
| 테마 primaryColor | `#E5484D` (빨강) |
| agentDisplayName | `Incident Bot` |
| sendDataModel | `true` |

### 5.2 컴포넌트 트리

```
Card(root)
└── Column(form_col)
    ├── Row(hdr)
    │   ├── Icon(hdr_ico)  name=alert, size=20
    │   └── Text(hdr_txt)  "인시던트 보고" variant=h2
    ├── Text(sev_label)    "심각도" variant=caption
    ├── ChoicePicker(sev_pick)
    ├── TextField(svc_field)   label="영향 서비스"
    ├── TextField(sum_field)   label="증상 요약" variant=longText  [required check]
    ├── CheckBox(impact_check) label="고객 영향이 발생했습니다"
    └── Button(submit_btn)     "인시던트 생성" variant=primary  [required check]
```

### 5.3 데이터 모델 초기값

```json
{
  "incident": {
    "severity": "P2",
    "service": "order-service",
    "summary": "",
    "customerImpact": false
  }
}
```

### 5.4 컴포넌트 바인딩 매핑

| 컴포넌트 | 바인딩 경로 | 입력 타입 |
|---------|------------|---------|
| `sev_pick` | `/incident/severity` | `"P1"` \| `"P2"` \| `"P3"` |
| `svc_field` | `/incident/service` | `string` |
| `sum_field` | `/incident/summary` | `string` |
| `impact_check` | `/incident/customerImpact` | `boolean` |

### 5.5 액션 이벤트

**발송 (Button 클릭 시)**

```typescript
// name: "create_incident"
{
  name: "create_incident",
  surfaceId: "incident_form",
  context: {
    service: string,          // /incident/service
    severity: "P1"|"P2"|"P3", // /incident/severity
    summary: string,          // /incident/summary
    customerImpact: boolean   // /incident/customerImpact
  },
  dataModel: { /* 전체 dataModel */ }
}
```

**응답 (Mock 서버 reply)**

```markdown
✅ **인시던트가 생성되었습니다.** `INC-4821`

- 서비스: `order-service`
- 심각도: **P2**
- 고객 영향: 없음

> 요약 내용

온콜 담당자에게 페이지를 발송했어요.
```

### 5.6 유효성 검사 규칙

| 필드 | 규칙 | 에러 메시지 |
|------|------|-----------|
| `sum_field` | `required` | "증상 요약은 필수입니다." |
| `submit_btn` | `required(/incident/summary)` | "증상 요약을 입력해야 생성할 수 있어요." (버튼 비활성) |

---

## 6. 시나리오 2 — 카나리 배포 승인 패널

### 6.1 개요

| 항목 | 값 |
|------|-----|
| 트리거 키워드 | `배포`, `deploy`, `롤아웃`, `카나리`, `canary`, `배포 승인`, `payment-service 카나리` |
| surfaceId | `deploy_panel` |
| 테마 primaryColor | `#1F8A5B` (초록) |
| agentDisplayName | `Deploy Bot` |
| sendDataModel | `true` |

### 6.2 컴포넌트 트리

```
Card(root)
└── Column(col)
    ├── Text(title)         "카나리 배포 승인" variant=h2
    ├── Text(sub)           "payment-service · v2.4.1 → production" variant=caption
    ├── Slider(canary_slider) label="카나리 트래픽 비중" min=0 max=100 step=5
    ├── Text(canary_txt)    formatString: "신버전으로 **${/deploy/canary}%** 의 트래픽을 전환합니다."
    ├── Divider(div)        axis=horizontal
    ├── CheckBox(health_check) label="스테이징 헬스체크 통과를 확인했습니다"
    └── Row(btn_row)
        ├── Button(cancel_btn)  "취소" variant=borderless
        └── Button(deploy_btn)  "배포 시작" variant=primary  [guard checks]
```

### 6.3 데이터 모델 초기값

```json
{
  "deploy": {
    "canary": 10,
    "healthOk": false
  }
}
```

### 6.4 컴포넌트 바인딩 매핑

| 컴포넌트 | 바인딩 경로 | 입력 타입 | 특이사항 |
|---------|------------|---------|---------|
| `canary_slider` | `/deploy/canary` | `number` (0~100, step 5) | Slider 실시간 반영 |
| `canary_txt` | formatString 읽기 전용 | — | 슬라이더 값 즉시 표시 |
| `health_check` | `/deploy/healthOk` | `boolean` | |

### 6.5 액션 이벤트

**배포 시작 (deploy_btn 클릭)**

```typescript
// name: "start_deploy"
{
  name: "start_deploy",
  context: {
    service: "payment-service",     // 하드코딩
    version: "v2.4.1",              // 하드코딩
    canary: number,                 // /deploy/canary
    healthOk: boolean               // /deploy/healthOk
  }
}
```

**취소 (cancel_btn 클릭)**

```typescript
// name: "cancel_deploy"
{ name: "cancel_deploy", context: {} }
```

**응답 예시**

```markdown
🚀 **배포를 시작했습니다.** `payment-service v2.4.1`

카나리 트래픽 **20%** 로 롤아웃 중입니다. p99 와 에러율을 모니터링하다가 임계값 초과 시 자동 롤백돼요.
```

### 6.6 유효성 검사 규칙 (deploy_btn)

```typescript
// AND 복합 조건 — 둘 다 만족해야 버튼 활성
checks: [{
  condition: {
    call: "and",
    args: {
      values: [
        { path: "/deploy/healthOk" },           // boolean true
        { call: "numeric", args: { value: { path: "/deploy/canary" }, min: 1 } }  // canary ≥ 1
      ]
    }
  },
  message: "헬스체크를 확인하고 카나리 비중을 1% 이상으로 설정하세요."
}]
```

---

## 7. 시나리오 3 — 서비스 상태 카드

### 7.1 개요

| 항목 | 값 |
|------|-----|
| 트리거 키워드 | `상태 카드`, `서비스 상태`, `status card`, `상태 대시보드`, `헬스 카드`, `payment 상태` |
| surfaceId | `status_card` |
| 테마 primaryColor | `#2A6FDB` (파랑) |
| agentDisplayName | `Observability Bot` |
| sendDataModel | `true` |

### 7.2 컴포넌트 트리

```
Card(root)
└── Column(col)
    ├── Row(hdr)
    │   ├── Icon(hdr_ico)    name=activity, size=19
    │   └── Text(hdr_txt)    "payment-service 상태" variant=h2
    ├── ChoicePicker(range_pick)    기간 선택 (15분/1시간/24시간)
    ├── Divider(div)
    ├── Row(metrics_row)    justify=spaceBetween
    │   ├── Column(m1)  weight=1
    │   │   ├── Text(m1_v)  formatString: "${/status/p99}ms" variant=h1
    │   │   └── Text(m1_l)  "p99 지연" variant=caption
    │   ├── Column(m2)  weight=1
    │   │   ├── Text(m2_v)  formatString: "${/status/errorRate}%" variant=h1
    │   │   └── Text(m2_l)  "에러율" variant=caption
    │   └── Column(m3)  weight=1
    │       ├── Text(m3_v)  path: /status/rps variant=h1
    │       └── Text(m3_l)  "RPS" variant=caption
    └── Button(refresh_btn)    "새로고침" variant=secondary
```

### 7.3 데이터 모델 초기값

```json
{
  "status": {
    "range": "1h",
    "p99": 842,
    "errorRate": 1.3,
    "rps": "2.4k"
  }
}
```

### 7.4 컴포넌트 바인딩 매핑

| 컴포넌트 | 바인딩 경로 | 타입 | 방향 |
|---------|------------|------|------|
| `range_pick` | `/status/range` | `"15m"` \| `"1h"` \| `"24h"` | 읽기+쓰기 |
| `m1_v` | `/status/p99` | `number` | 읽기 전용 |
| `m2_v` | `/status/errorRate` | `number` | 읽기 전용 |
| `m3_v` | `/status/rps` | `string` | 읽기 전용 |

### 7.5 액션 이벤트

**새로고침 (refresh_btn)**

```typescript
// name: "refresh_status"
{
  name: "refresh_status",
  context: {
    range: "15m" | "1h" | "24h"   // /status/range 현재 값
  }
}
```

**응답 예시**

```markdown
🔄 `1h` 기준으로 지표를 다시 조회했어요. 위 카드의 값이 갱신되었습니다.
```

> **Note**: 실제 Phase 2 구현에서는 서버가 새 `updateDataModel` 봉투를 내려보내 카드 값을 갱신합니다.

---

## 8. 시나리오 4 — 위험성평가 자동작성

### 8.1 개요 (2단계 흐름)

이 시나리오는 **입력 폼 → 결과 테이블** 2단계로 구성됩니다.

```
[1단계] 위험성평가 폼 (risk_form)
  └─ 공종 선택 + 작업환경 태그 입력

사용자 "생성" 버튼 클릭
  └─ generate_risk 액션 발송

[2단계] 위험성평가 결과 DataTable (risk_result_{timestamp})
  └─ 공종·태그에 맞는 위험요인 행 자동 생성
```

---

### 8.2 1단계 — 입력 폼 (risk_form)

| 항목 | 값 |
|------|-----|
| 트리거 키워드 | `위험성평가`, `공종`, `위험성 평가`, `자동작성`, `안전 평가`, `위험 요인` |
| surfaceId | `risk_form` |
| 테마 primaryColor | `#0E7C66` (청록) |
| agentDisplayName | `Safety Bot` |

#### 컴포넌트 트리

```
Card(root)
└── Column(col)
    ├── Text(title)        "위험성평가 자동작성" variant=h2
    ├── Text(sub)          안내 문구 variant=caption
    ├── Divider(div)
    ├── Select(trade_field)   label="공종"  [required check]
    ├── TagInput(env_field)   label="작업환경·장비 태그 (선택)"
    └── Button(submit_btn)    "위험성평가 생성" variant=primary  [required check]
```

#### 데이터 모델 초기값

```json
{
  "risk": {
    "trade": "",
    "envTags": []
  }
}
```

#### 컴포넌트 바인딩 매핑

| 컴포넌트 | 바인딩 경로 | 타입 | 옵션 |
|---------|------------|------|------|
| `trade_field` | `/risk/trade` | `string` | 배관 / 용접 / 비계 / 전기 / 굴착 / 도장 |
| `env_field` | `/risk/envTags` | `string[]` | suggestions: 저온·고온·밀폐·화기·분진·소음·진동·고소·양중·크레인·지게차·용접기·그라인더 |

#### 액션 이벤트 (submit_btn)

```typescript
// name: "generate_risk"
{
  name: "generate_risk",
  context: {
    trade: string,       // /risk/trade — 선택된 공종
    tags: string[]       // /risk/envTags — 선택된 환경·장비 태그
  },
  dataModel: { risk: { trade, envTags } }
}
```

---

### 8.3 2단계 — 결과 DataTable (risk_result_{ts})

#### 테이블 컬럼 스펙

| key | label | kind | 너비 | 설명 |
|-----|-------|------|------|------|
| `task` | 작업 단계 | `text` | 110px | 작업명 |
| `cause` | 위험 요인 | `text` | 130px | 위험 원인 |
| `situation` | 재해 시나리오 | `para` | 180px | 재해 발생 상황 기술 |
| `p` | 가능성 | `select` | 68px | 상/중/하 (개선 전) |
| `s` | 중대성 | `select` | 68px | 상/중/하 (개선 전) |
| `risk` | 위험도 | `risk` | 60px | 가능성×중대성 자동 계산 |
| `improve` | 개선대책 | `para` | 200px | 안전 개선 방안 |
| `p2` | 가능성 | `select` | 68px | 상/중/하 (개선 후) |
| `s2` | 중대성 | `select` | 68px | 상/중/하 (개선 후) |
| `risk2` | 잔류위험도 | `arrowrisk` | 70px | 개선 후 위험도 |
| `ppe` | 보호구 | `tags` | 150px | PPE 태그 목록 |
| `law` | 관련 법령 | `para` | 180px | 근거 법조항 |
| `status` | 상태 | `status` | 64px | 초안→검토→승인 (클릭 사이클) |
| `_` | 액션 | `actions` | 80px | 복제 / 제외 / 삭제 버튼 |

#### 위험도 계산 공식

```
위험도 = 가능성 점수 × 중대성 점수
  상=3, 중=2, 하=1

결과:
  ≥ 6 → 상 (빨강)
  ≥ 3 → 중 (노랑)
  < 3 → 하 (초록)
```

#### 공종별 생성 위험요인 수

| 공종 | 기본 행 수 |
|------|-----------|
| 배관 | 3행 |
| 용접 | 3행 |
| 비계 | 2행 |
| 전기 | 2행 |
| 굴착 | 2행 |
| 도장 | 2행 |

> 환경·장비 태그 1개당 +1행 추가됩니다.  
> 예: 배관 + [고소, 크레인] 선택 시 3 + 2 = **5행**

#### 행 편집 기능

| 기능 | 동작 |
|------|------|
| 가능성/중대성 Select | 드롭다운으로 값 변경 (위험도는 자동 갱신 **안 됨** — Phase 2에서 구현) |
| 상태 버튼 클릭 | 초안 → 검토 → 승인 → 초안 (사이클) |
| 복제 버튼 | 해당 행을 바로 아래에 복사 |
| 제외 버튼 | 행을 취소선 처리 (excluded: true) |
| 삭제 버튼 | 행 완전 삭제 |

#### 응답 텍스트 예시

```markdown
✅ **배관 위험성평가**를 자동생성했습니다. 총 **5개** 위험요인이 도출됐어요.

- 개선대책을 검토하고 상태 버튼을 눌러 진행 상태(초안 → 검토 → 승인)를 관리하세요.
- 행 복제·제외·삭제가 가능합니다.
```

---

## 9. 데이터 흐름 요약

```
[사용자 메시지]
    ↓
pickAnswer(text)  — 키워드 매칭으로 시나리오 선택
    ↓
useChat.runAgent(botId, text)
    ├─ status 페이즈  (상태 메시지 순차 표시)
    ├─ reasoning 페이즈  (CoT 단계 표시)
    ├─ answer 페이즈  (마크다운 토큰 스트리밍)
    └─ a2ui 페이즈  (봉투 순차 적용)
         ├─ createSurface  → a2uiState 초기화 (skeleton)
         ├─ updateComponents → 컴포넌트 트리 삽입
         └─ updateDataModel → 초기 데이터 → 완성된 UI
    ↓
BotMessage → A2UISurface 렌더링

[사용자 A2UI 상호작용]
    ├─ 입력 필드 변경
    │     → onA2UIData(msgId, path, value)
    │     → msg.a2uiState.dataModel 즉시 갱신 (re-render)
    └─ 버튼 액션 클릭
          → onA2UIAction(payload)
          → 새 bot 메시지 생성
          → runActionReply(botId, action)
               ├─ 텍스트 스트리밍
               └─ (위험성평가) A2UI DataTable 봉투 스트리밍
```

---

## 10. Phase 2 확장 포인트

| 항목 | 현황 (Phase 1 Mock) | Phase 2 계획 |
|------|---------------------|-------------|
| 봉투 소스 | 클라이언트 사전 정의 배열 | FastAPI SSE로 실시간 스트리밍 |
| 액션 응답 | 클라이언트 mock (`a2uiActionReply`) | 서버가 새 봉투 스트림 반환 |
| 위험도 재계산 | 미구현 (수동 Select) | 서버가 p/s 변경 시 risk 필드 재계산 후 `updateDataModel` 발송 |
| DataTable 저장 | 없음 | 서버에 POST, 문서 생성 연동 |
| 서피스 갱신 | 없음 | 새로고침 액션 → 서버 → `updateDataModel`로 실시간 지표 갱신 |
