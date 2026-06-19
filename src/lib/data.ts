import type { Source, CoTStep } from "@/types";
import { A2UI_ANSWERS, type A2UIAnswer } from "./a2ui-data";

export const SUGGESTIONS = [
  { text: "공종명으로 위험성평가를 자동작성해줘. (배관·용접 / 작업환경·장비 태그)", icon: "Shield" },
  { text: "주문 서비스가 결제 서비스 호출 시 간헐적 타임아웃이 발생해요. 원인과 해결책을 알려줘.", icon: "AlertTriangle" },
  { text: "결제 승인 API의 요청·응답 명세를 표로 정리하고 예시 페이로드를 보여줘.", icon: "Braces" },
  { text: "결제 서비스에 적용할 Resilience4j 서킷브레이커 설정 예시를 작성해줘.", icon: "Code2" },
  { text: "최근 1시간 order-service 에러 로그를 분석해서 핵심 원인을 요약해줘.", icon: "FileText" },
  { text: "payment-service 카나리 배포를 승인할 패널을 띄워줘. (A2UI 생성형 UI)", icon: "Layers" },
];

export const CAPABILITIES = [
  { icon: "Zap", label: "실시간 스트리밍 응답" },
  { icon: "BookOpen", label: "사내 문서·코드 RAG 인용" },
  { icon: "BrainCircuit", label: "단계별 추론 과정 공개" },
  { icon: "File", label: ".log / .yaml / .pdf 분석" },
  { icon: "Layers", label: "A2UI v0.9 생성형 UI 렌더링" },
];

const SRC: Record<string, Source> = {
  resilience: {
    id: 1, type: "code", icon: "GitBranch",
    title: "PaymentClientConfig.java",
    path: "msa-payment/src/main/java/.../config/PaymentClientConfig.java",
    lang: "java",
    snippet: `@Bean\npublic Resilience4JCircuitBreakerFactory cbFactory() {\n  // ⚠ 호출 타임아웃이 기본 1s 로 설정되어 있음\n  TimeLimiterConfig tl = TimeLimiterConfig.custom()\n      .timeoutDuration(Duration.ofSeconds(1))   // ← 병목 지점\n      .build();\n  return new Resilience4JCircuitBreakerFactory(cb, tl);\n}`,
    url: "#",
    urlLabel: "GitHub에서 보기",
  },
  runbook: {
    id: 2, type: "doc", icon: "FileText",
    title: "MSA 장애 대응 런북 — 결제 연동 타임아웃",
    path: "Confluence › SRE › Runbook › payment-timeout",
    snippet: "P2 등급. order→payment 구간 p99 지연이 800ms 를 초과하면 경보.\n권장 조치: (1) 커넥션 풀 포화 여부 확인, (2) TimeLimiter 2s 로 상향, (3) 재시도는 멱등 키가 있는 경우에만 1회 허용.",
    url: "#",
    urlLabel: "런북 원문 열기",
  },
  grafana: {
    id: 3, type: "doc", icon: "BarChart2",
    title: "Grafana — payment-service p99 latency",
    path: "Grafana › Dashboards › payment-service › Latency",
    snippet: "14:02~14:36 구간 p99 지연 1.4s 로 급증.\nHikariCP active connections = max(20) 도달, pending 17 관측.\n→ 커넥션 풀 고갈이 1차 원인으로 추정됨.",
    url: "#",
    urlLabel: "대시보드 열기",
  },
  paymentApi: {
    id: 1, type: "api", icon: "Braces",
    title: "POST /api/v1/payments/approve",
    path: "Swagger › payment-service › Payments",
    lang: "json",
    snippet: `{\n  "orderId": "ORD-20260601-0007",\n  "amount": 49000,\n  "currency": "KRW",\n  "method": "CARD",\n  "idempotencyKey": "5f1c…b8a2"\n}`,
    url: "#",
    urlLabel: "Swagger UI 열기",
  },
  paymentSchema: {
    id: 2, type: "doc", icon: "FileText",
    title: "결제 도메인 설계서 — 승인 상태 전이",
    path: "Confluence › Architecture › payment-state-machine",
    snippet: "승인 상태: REQUESTED → APPROVED → CAPTURED.\nidempotencyKey 는 필수이며 24h TTL. 동일 키 재요청 시 최초 결과를 그대로 반환(멱등).",
    url: "#",
    urlLabel: "설계서 열기",
  },
  cbDoc: {
    id: 1, type: "doc", icon: "FileText",
    title: "Resilience4j 적용 가이드 (사내 표준)",
    path: "Confluence › Platform › resilience4j-standard",
    snippet: "사내 표준: slidingWindow=10, failureRateThreshold=50%, waitDurationInOpenState=10s.\nTimeLimiter 는 다운스트림 p99 의 2배로 설정할 것.",
    url: "#",
    urlLabel: "가이드 열기",
  },
  cbCode: {
    id: 2, type: "code", icon: "GitBranch",
    title: "application.yml (payment-service)",
    path: "msa-payment/src/main/resources/application.yml",
    lang: "yaml",
    snippet: `resilience4j:\n  circuitbreaker:\n    instances:\n      paymentClient:\n        slidingWindowSize: 10\n        failureRateThreshold: 50`,
    url: "#",
    urlLabel: "GitHub에서 보기",
  },
  logFile: {
    id: 1, type: "log", icon: "FileText",
    title: "order-service.log (14:00–15:00)",
    path: "uploaded › order-service.log · 2.3 MB",
    lang: "plaintext",
    snippet: `14:31:02 WARN  [order] call payment-service timeout after 1000ms (orderId=ORD-…0007)\n14:31:02 ERROR [order] FeignException$GatewayTimeout: status 504\n14:31:05 WARN  [order] HikariPool-1 - Connection is not available, request timed out after 30000ms`,
    url: "#",
    urlLabel: "원본 로그 보기",
  },
};

export interface CannedAnswer {
  keys: string[];
  status: string[];
  cot: CoTStep[];
  sources?: Source[];
  md: string;
  a2ui?: object[];
}

// Re-export A2UIAnswer type for convenience
export type { A2UIAnswer };

export const ANSWERS: CannedAnswer[] = [
  {
    keys: ["타임아웃", "timeout", "결제 서비스 호출", "간헐적", "지연"],
    status: ["요청을 분석하고 있어요", "관련 런북과 대시보드를 검색하고 있어요", "order-service 코드를 살펴보고 있어요", "근거를 종합해 답변을 구성하고 있어요"],
    cot: [
      { title: "문제 정의", detail: "order-service → payment-service 동기 호출에서 간헐적 504 타임아웃 발생. 재현 빈도와 시간대를 먼저 좁힌다." },
      { title: "관측 데이터 확인", detail: "Grafana p99 지연 그래프에서 14:02~14:36 구간 1.4s 급증, HikariCP 커넥션 풀 포화 신호 확인." },
      { title: "코드 설정 점검", detail: "PaymentClientConfig 의 TimeLimiter timeoutDuration 이 1s 로 다운스트림 p99 보다 낮게 설정됨을 발견." },
      { title: "원인 가설 수립", detail: "커넥션 풀 고갈로 호출 지연 → 1s 타임아웃에 걸려 504. 풀 사이즈와 타임아웃이 동시 원인." },
      { title: "해결책 도출", detail: "런북 권장값과 사내 표준에 맞춰 풀 확장 + TimeLimiter 상향 + 멱등 재시도를 제안." },
    ],
    sources: [SRC.resilience, SRC.runbook, SRC.grafana],
    md: `결론부터 말하면, **다운스트림(payment-service)의 커넥션 풀 고갈**과 **너무 짧은 호출 타임아웃**이 겹쳐 발생한 복합 장애로 보입니다.

### 원인 분석

관측 지표상 14:02~14:36 구간에 \`payment-service\` p99 지연이 **1.4s 까지 급증**했고, 같은 시각 HikariCP의 active connection 이 최대치(20)에 도달했습니다 [3]. 그런데 \`order-service\` 쪽 호출 타임아웃은 **1초로 고정**되어 있어, 지연이 조금만 길어져도 곧바로 504로 끊깁니다 [1].

| 구분 | 현재 값 | 권장 값 | 근거 |
| --- | --- | --- | --- |
| TimeLimiter timeout | \`1s\` | \`2s\` | 다운스트림 p99 의 2배 [2] |
| Hikari maximumPoolSize | \`20\` | \`40\` | 피크 동시성 기준 |
| 재시도 | 없음 | 멱등 시 1회 | 런북 권장 [2] |

### 조치 방안

1. **타임아웃 상향** — \`PaymentClientConfig\` 의 \`timeoutDuration\` 을 2초로 올립니다 [1].
2. **커넥션 풀 확장** — payment-service 의 HikariCP \`maximum-pool-size\` 를 40으로 조정합니다.
3. **멱등 재시도** — \`idempotencyKey\` 가 있는 요청에 한해 1회 재시도를 허용합니다 [2].

\`\`\`java
// PaymentClientConfig.java — 수정안
TimeLimiterConfig tl = TimeLimiterConfig.custom()
    .timeoutDuration(Duration.ofSeconds(2))   // 1s → 2s
    .cancelRunningFuture(true)
    .build();

RetryConfig retry = RetryConfig.custom()
    .maxAttempts(2)                            // 멱등 요청 1회 재시도
    .retryExceptions(TimeoutException.class)
    .build();
\`\`\`

> ⚠️ 재시도는 반드시 **멱등 키가 있는 호출에만** 적용하세요. 결제 승인은 중복 호출 시 이중 청구 위험이 있습니다 [2].

배포 후 \`payment-service\` p99 가 800ms 이하로 안정화되는지 Grafana 경보 임계값으로 모니터링하시길 권장합니다.`,
  },
  {
    keys: ["승인 api", "결제 승인", "명세", "스펙", "페이로드", "swagger"],
    status: ["요청을 분석하고 있어요", "Swagger 명세를 조회하고 있어요", "도메인 설계서를 확인하고 있어요", "답변을 정리하고 있어요"],
    cot: [
      { title: "대상 API 식별", detail: "'결제 승인' → payment-service 의 POST /api/v1/payments/approve 로 매핑." },
      { title: "스키마 수집", detail: "Swagger 정의에서 요청/응답 필드, 필수 여부, 타입을 추출." },
      { title: "도메인 규칙 확인", detail: "설계서에서 idempotencyKey 멱등 규칙과 상태 전이를 교차 검증." },
    ],
    sources: [SRC.paymentApi, SRC.paymentSchema],
    md: `\`POST /api/v1/payments/approve\` 의 요청·응답 명세입니다 [1].

### 요청 (Request Body)

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| \`orderId\` | string | ✅ | 주문 식별자 |
| \`amount\` | integer | ✅ | 결제 금액 (최소 화폐 단위) |
| \`currency\` | string | ✅ | ISO 4217, 예: \`KRW\` |
| \`method\` | enum | ✅ | \`CARD\` / \`TRANSFER\` / \`POINT\` |
| \`idempotencyKey\` | string | ✅ | 멱등 키, 24h TTL [2] |

### 요청 예시

\`\`\`json
{
  "orderId": "ORD-20260601-0007",
  "amount": 49000,
  "currency": "KRW",
  "method": "CARD",
  "idempotencyKey": "5f1c9d20-1a3e-4c7b-9f6a-2b8d1e4cb8a2"
}
\`\`\`

### 응답 (200 OK)

\`\`\`json
{
  "paymentId": "PAY-9f6a2b8d",
  "status": "APPROVED",
  "approvedAt": "2026-06-01T14:31:07Z"
}
\`\`\`

상태는 \`REQUESTED → APPROVED → CAPTURED\` 순으로 전이되며, **동일 \`idempotencyKey\` 로 재요청하면 최초 승인 결과가 그대로 반환**됩니다(멱등 보장) [2].`,
  },
  {
    keys: ["서킷브레이커", "resilience4j", "서킷 브레이커", "circuit", "설정 예시"],
    status: ["요청을 분석하고 있어요", "사내 표준 가이드를 검색하고 있어요", "기존 설정 파일을 확인하고 있어요", "설정안을 작성하고 있어요"],
    cot: [
      { title: "표준 값 조회", detail: "사내 Resilience4j 표준에서 슬라이딩 윈도우·실패율·대기 시간 기본값을 가져온다." },
      { title: "현재 설정 비교", detail: "payment-service application.yml 의 기존 인스턴스 설정과 비교해 누락 항목을 식별." },
      { title: "통합 설정 작성", detail: "CircuitBreaker + TimeLimiter + Retry 를 일관된 인스턴스명으로 결합." },
    ],
    sources: [SRC.cbDoc, SRC.cbCode],
    md: `사내 표준에 맞춘 \`payment-service\` 의 Resilience4j 설정 예시입니다 [1].

\`\`\`yaml
resilience4j:
  circuitbreaker:
    instances:
      paymentClient:
        slidingWindowSize: 10          # 표준값 [1]
        failureRateThreshold: 50       # 50% 초과 시 OPEN
        waitDurationInOpenState: 10s   # OPEN 유지 시간
        permittedNumberOfCallsInHalfOpenState: 3
  timelimiter:
    instances:
      paymentClient:
        timeoutDuration: 2s            # 다운스트림 p99 의 2배 [1]
  retry:
    instances:
      paymentClient:
        maxAttempts: 2
        waitDuration: 200ms
\`\`\`

적용 시 핵심 포인트:

- **인스턴스명 통일** — \`circuitbreaker\`, \`timelimiter\`, \`retry\` 모두 \`paymentClient\` 로 맞춰야 합니다 [2].
- **TimeLimiter 우선순위** — \`@TimeLimiter\` → \`@CircuitBreaker\` → \`@Retry\` 순으로 어노테이션을 중첩하세요.
- **Fallback 필수** — OPEN 상태에서 사용자에게 "결제 지연" 안내를 반환하도록 \`fallbackMethod\` 를 지정합니다.`,
  },
  {
    keys: ["로그", "log", "에러 로그", "분석", "order-service"],
    status: ["업로드된 로그를 읽고 있어요", "에러 패턴을 군집화하고 있어요", "관련 코드 위치를 추적하고 있어요", "요약을 작성하고 있어요"],
    cot: [
      { title: "로그 파싱", detail: "order-service.log 2.3MB 에서 WARN/ERROR 레벨만 추출, 타임스탬프로 정렬." },
      { title: "패턴 군집화", detail: "메시지 유사도로 묶어 상위 3개 에러 유형으로 압축." },
      { title: "근본 원인 추적", detail: "504 타임아웃과 HikariCP 메시지가 동일 구간에 집중됨을 확인." },
    ],
    sources: [SRC.logFile, SRC.grafana],
    md: `업로드하신 \`order-service.log\` (14:00–15:00) 분석 결과입니다 [1].

### 에러 요약

| 유형 | 건수 | 비중 |
| --- | --- | --- |
| payment-service 호출 타임아웃 (504) | 142 | 71% |
| HikariCP connection timeout | 38 | 19% |
| 직렬화 실패 (JSON) | 20 | 10% |

### 핵심 발견

전체 에러의 **90%가 14:31 전후 4분에 집중**되어 있고, \`504 GatewayTimeout\` 직후 \`HikariPool-1 - Connection is not available\` 메시지가 뒤따릅니다 [1].

\`\`\`log
14:31:02 WARN  [order] call payment-service timeout after 1000ms
14:31:02 ERROR [order] FeignException$GatewayTimeout: status 504
14:31:05 WARN  [order] HikariPool-1 - Connection is not available
\`\`\`

**결론** — 단순 네트워크 오류가 아니라 다운스트림 커넥션 풀 고갈에서 비롯된 연쇄 지연입니다. 커넥션 풀 확장과 타임아웃 상향으로 함께 해결됩니다.`,
  },
];

export const FALLBACK: CannedAnswer = {
  keys: [],
  status: ["요청을 분석하고 있어요", "관련 사내 문서를 검색하고 있어요", "답변을 구성하고 있어요"],
  cot: [
    { title: "질문 의도 파악", detail: "사용자 요청의 핵심 키워드를 추출하고 MSA 도메인에 매핑." },
    { title: "지식 베이스 검색", detail: "사내 설계 문서·코드 레포지토리·런북에서 관련 자료를 RAG 로 조회." },
    { title: "답변 종합", detail: "검색 결과를 근거로 구조화된 답변을 작성하고 출처를 연결." },
  ],
  sources: [SRC.runbook] as Source[],
  md: `질문 주신 내용을 사내 지식 베이스 기준으로 정리해 드릴게요.

이 데모 에이전트는 **Saferyn AI Agent 플랫폼**의 운영·개발을 돕도록 구성되어 있습니다. 아래와 같은 요청에 가장 정확하게 답변합니다 [1]:

- **장애 진단** — 서비스 간 호출 타임아웃, 커넥션 풀, 서킷브레이커 등
- **API 명세** — Swagger 기반 요청/응답 스키마와 예시 페이로드
- **설정 작성** — \`application.yml\`, Resilience4j, Kafka 등
- **로그 분석** — 업로드한 \`.log\` 파일의 에러 패턴 요약

왼쪽 추천 질문을 눌러보시면 스트리밍 응답, 추론 과정, 인용 출처가 어떻게 동작하는지 바로 확인하실 수 있어요.`,
};

export function pickAnswer(text: string): CannedAnswer {
  const q = (text || "").toLowerCase();
  let best: CannedAnswer | null = null;
  let bestScore = 0;
  // Search regular answers
  for (const a of ANSWERS) {
    let s = 0;
    for (const k of a.keys) { if (q.includes(k.toLowerCase())) s++; }
    if (s > bestScore) { bestScore = s; best = a; }
  }
  // Search A2UI answers (higher priority keywords)
  for (const a of A2UI_ANSWERS) {
    let s = 0;
    for (const k of a.keys) { if (q.includes(k.toLowerCase())) s++; }
    if (s > bestScore) { bestScore = s; best = a as CannedAnswer; }
  }
  return bestScore > 0 ? best! : FALLBACK;
}
