/**
 * A2UI v0.9 — 4개 시나리오 데이터 (mock)
 * Ported from design_handoff_safetysaas/app/a2ui-data.jsx + risk-data.jsx
 */

import type { CoTStep } from "@/types";
import { A2UI_CATALOG_BASIC } from "./a2ui";

const CAT = A2UI_CATALOG_BASIC;

export interface A2UIAnswer {
  keys: string[];
  status: string[];
  cot: CoTStep[];
  md: string;
  a2ui: object[];
}

/* ================================================================
   1) 인시던트 보고 폼
   ================================================================ */
export const A2UI_INCIDENT: A2UIAnswer = {
  keys: ["인시던트", "장애 보고", "incident", "보고서 폼", "인시던트 생성"],
  status: ["요청을 분석하고 있어요", "인시던트 스키마를 불러오고 있어요", "A2UI 서피스를 생성하고 있어요"],
  cot: [
    { title: "의도 파악", detail: "사용자가 텍스트 답변이 아니라 입력 폼(생성형 UI)을 원한다고 판단. A2UI 서피스로 응답한다." },
    { title: "카탈로그 선택", detail: "클라이언트가 지원하는 Basic Catalog 로 createSurface 후 입력 컴포넌트(ChoicePicker·TextField·CheckBox)를 구성." },
    { title: "검증 규칙 부착", detail: "'증상 요약' 필드와 제출 버튼에 required 체크를 달아 클라이언트 측에서 유효성을 강제." },
  ],
  md: "장애 내용을 바로 접수할 수 있도록 **인시던트 보고 폼**을 생성했어요. 아래에서 작성 후 제출하면 인시던트가 등록됩니다.",
  a2ui: [
    { version: "v0.9", createSurface: { surfaceId: "incident_form", catalogId: CAT, theme: { primaryColor: "#E5484D", agentDisplayName: "Incident Bot" }, sendDataModel: true } },
    { version: "v0.9", updateComponents: { surfaceId: "incident_form", components: [
      { id: "root", component: "Card", child: "form_col" },
      { id: "form_col", component: "Column", children: ["hdr", "sev_label", "sev_pick", "svc_field", "sum_field", "impact_check", "submit_btn"] },
      { id: "hdr", component: "Row", children: ["hdr_ico", "hdr_txt"], align: "center" },
      { id: "hdr_ico", component: "Icon", name: "alert", size: 20 },
      { id: "hdr_txt", component: "Text", text: "인시던트 보고", variant: "h2" },
      { id: "sev_label", component: "Text", text: "심각도", variant: "caption" },
      { id: "sev_pick", component: "ChoicePicker", variant: "mutuallyExclusive", value: { path: "/incident/severity" },
        options: [{ label: "P1 · 치명적", value: "P1" }, { label: "P2 · 높음", value: "P2" }, { label: "P3 · 보통", value: "P3" }] },
      { id: "svc_field", component: "TextField", label: "영향 서비스", value: { path: "/incident/service" }, variant: "shortText", placeholder: "예: order-service" },
      { id: "sum_field", component: "TextField", label: "증상 요약", value: { path: "/incident/summary" }, variant: "longText", placeholder: "무슨 일이 발생했나요?",
        checks: [{ call: "required", args: { value: { path: "/incident/summary" } }, message: "증상 요약은 필수입니다." }] },
      { id: "impact_check", component: "CheckBox", label: "고객 영향이 발생했습니다", value: { path: "/incident/customerImpact" } },
      { id: "submit_btn", component: "Button", text: "인시던트 생성", variant: "primary",
        checks: [{ call: "required", args: { value: { path: "/incident/summary" } }, message: "증상 요약을 입력해야 생성할 수 있어요." }],
        action: { event: { name: "create_incident", context: {
          service: { path: "/incident/service" }, severity: { path: "/incident/severity" },
          summary: { path: "/incident/summary" }, customerImpact: { path: "/incident/customerImpact" } } } } },
    ] } },
    { version: "v0.9", updateDataModel: { surfaceId: "incident_form", path: "/incident", value: { severity: "P2", service: "order-service", summary: "", customerImpact: false } } },
  ],
};

/* ================================================================
   2) 카나리 배포 승인 패널
   ================================================================ */
export const A2UI_DEPLOY: A2UIAnswer = {
  keys: ["배포", "deploy", "롤아웃", "카나리", "canary", "배포 승인", "payment-service 카나리"],
  status: ["요청을 분석하고 있어요", "배포 파이프라인 상태를 확인하고 있어요", "A2UI 승인 패널을 생성하고 있어요"],
  cot: [
    { title: "대상 식별", detail: "payment-service v2.4.1 의 프로덕션 카나리 배포 요청으로 해석." },
    { title: "승인 가드 설계", detail: "헬스체크 확인(CheckBox)과 카나리 비중(Slider)을 묶어, 둘 다 만족할 때만 '배포 시작'이 활성화되도록 Button checks 를 구성." },
    { title: "양방향 바인딩", detail: "슬라이더 값은 /deploy/canary 에 즉시 반영되고, formatString 텍스트가 실시간으로 갱신된다." },
  ],
  md: "프로덕션 **카나리 배포 승인 패널**을 준비했어요. 헬스체크를 확인하고 트래픽 비중을 정한 뒤 배포를 시작하세요.",
  a2ui: [
    { version: "v0.9", createSurface: { surfaceId: "deploy_panel", catalogId: CAT, theme: { primaryColor: "#1F8A5B", agentDisplayName: "Deploy Bot" }, sendDataModel: true } },
    { version: "v0.9", updateComponents: { surfaceId: "deploy_panel", components: [
      { id: "root", component: "Card", child: "col" },
      { id: "col", component: "Column", children: ["title", "sub", "canary_slider", "canary_txt", "div", "health_check", "btn_row"] },
      { id: "title", component: "Text", text: "카나리 배포 승인", variant: "h2" },
      { id: "sub", component: "Text", text: "payment-service · v2.4.1 → production", variant: "caption" },
      { id: "canary_slider", component: "Slider", label: "카나리 트래픽 비중", min: 0, max: 100, step: 5, value: { path: "/deploy/canary" } },
      { id: "canary_txt", component: "Text", text: { call: "formatString", args: { value: "신버전으로 **${/deploy/canary}%** 의 트래픽을 전환합니다." } } },
      { id: "div", component: "Divider", axis: "horizontal" },
      { id: "health_check", component: "CheckBox", label: "스테이징 헬스체크 통과를 확인했습니다", value: { path: "/deploy/healthOk" } },
      { id: "btn_row", component: "Row", children: ["cancel_btn", "deploy_btn"], justify: "spaceBetween" },
      { id: "cancel_btn", component: "Button", text: "취소", variant: "borderless", action: { event: { name: "cancel_deploy", context: {} } } },
      { id: "deploy_btn", component: "Button", text: "배포 시작", variant: "primary",
        checks: [{ condition: { call: "and", args: { values: [
          { path: "/deploy/healthOk" },
          { call: "numeric", args: { value: { path: "/deploy/canary" }, min: 1 } }] } },
          message: "헬스체크를 확인하고 카나리 비중을 1% 이상으로 설정하세요." }],
        action: { event: { name: "start_deploy", context: {
          service: "payment-service", version: "v2.4.1",
          canary: { path: "/deploy/canary" }, healthOk: { path: "/deploy/healthOk" } } } } },
    ] } },
    { version: "v0.9", updateDataModel: { surfaceId: "deploy_panel", path: "/deploy", value: { canary: 10, healthOk: false } } },
  ],
};

/* ================================================================
   3) 서비스 상태 카드
   ================================================================ */
export const A2UI_STATUS: A2UIAnswer = {
  keys: ["상태 카드", "서비스 상태", "status card", "상태 대시보드", "헬스 카드", "payment 상태"],
  status: ["요청을 분석하고 있어요", "관측 지표를 조회하고 있어요", "A2UI 상태 카드를 생성하고 있어요"],
  cot: [
    { title: "지표 수집", detail: "payment-service 의 p99 지연·에러율·RPS 를 데이터 모델에 적재." },
    { title: "표시 전용 바인딩", detail: "Text 컴포넌트를 formatString 으로 데이터 모델에 바인딩해 값이 바뀌면 자동으로 갱신되도록 구성." },
    { title: "기간 선택 제공", detail: "ChoicePicker 로 조회 기간을 바꿀 수 있게 하고, 새로고침 액션을 서버로 전송." },
  ],
  md: "`payment-service` 의 **실시간 상태 카드**입니다. 기간을 바꾸거나 새로고침을 누르면 에이전트가 지표를 다시 조회해요.",
  a2ui: [
    { version: "v0.9", createSurface: { surfaceId: "status_card", catalogId: CAT, theme: { primaryColor: "#2A6FDB", agentDisplayName: "Observability Bot" }, sendDataModel: true } },
    { version: "v0.9", updateComponents: { surfaceId: "status_card", components: [
      { id: "root", component: "Card", child: "col" },
      { id: "col", component: "Column", children: ["hdr", "range_pick", "div", "metrics_row", "refresh_btn"] },
      { id: "hdr", component: "Row", children: ["hdr_ico", "hdr_txt"], align: "center" },
      { id: "hdr_ico", component: "Icon", name: "activity", size: 19 },
      { id: "hdr_txt", component: "Text", text: "payment-service 상태", variant: "h2" },
      { id: "range_pick", component: "ChoicePicker", variant: "mutuallyExclusive", value: { path: "/status/range" },
        options: [{ label: "15분", value: "15m" }, { label: "1시간", value: "1h" }, { label: "24시간", value: "24h" }] },
      { id: "div", component: "Divider", axis: "horizontal" },
      { id: "metrics_row", component: "Row", children: ["m1", "m2", "m3"], justify: "spaceBetween" },
      { id: "m1", component: "Column", children: ["m1_v", "m1_l"], weight: 1, align: "start" },
      { id: "m1_v", component: "Text", text: { call: "formatString", args: { value: "${/status/p99}ms" } }, variant: "h1" },
      { id: "m1_l", component: "Text", text: "p99 지연", variant: "caption" },
      { id: "m2", component: "Column", children: ["m2_v", "m2_l"], weight: 1, align: "start" },
      { id: "m2_v", component: "Text", text: { call: "formatString", args: { value: "${/status/errorRate}%" } }, variant: "h1" },
      { id: "m2_l", component: "Text", text: "에러율", variant: "caption" },
      { id: "m3", component: "Column", children: ["m3_v", "m3_l"], weight: 1, align: "start" },
      { id: "m3_v", component: "Text", text: { path: "/status/rps" }, variant: "h1" },
      { id: "m3_l", component: "Text", text: "RPS", variant: "caption" },
      { id: "refresh_btn", component: "Button", text: "새로고침", variant: "secondary",
        action: { event: { name: "refresh_status", context: { range: { path: "/status/range" } } } } },
    ] } },
    { version: "v0.9", updateDataModel: { surfaceId: "status_card", path: "/status", value: { range: "1h", p99: 842, errorRate: 1.3, rps: "2.4k" } } },
  ],
};

/* ================================================================
   4) 위험성평가 자동작성 폼
   ================================================================ */
export const A2UI_RISK: A2UIAnswer = {
  keys: ["위험성평가", "공종", "위험성 평가", "자동작성", "안전 평가", "위험 요인"],
  status: ["요청을 분석하고 있어요", "위험성평가 스키마를 로딩하고 있어요", "A2UI 입력 폼을 생성하고 있어요"],
  cot: [
    { title: "도메인 파악", detail: "산업안전보건법 기반 위험성평가 양식 생성 요청. 공종명과 작업환경/장비 태그를 입력받아 자동 생성한다." },
    { title: "입력 폼 설계", detail: "공종 Select + 작업환경·장비 TagInput 으로 구성. 입력 완료 후 '생성' 버튼으로 generate_risk 액션을 트리거." },
    { title: "검증 규칙", detail: "공종명은 필수 입력. 비어있으면 버튼이 비활성화된다." },
  ],
  md: "**위험성평가 자동작성 폼**입니다. 공종을 선택하고, 작업환경이나 장비 태그를 추가한 뒤 생성 버튼을 누르세요.",
  a2ui: [
    { version: "v0.9", createSurface: { surfaceId: "risk_form", catalogId: CAT, theme: { primaryColor: "#0E7C66", agentDisplayName: "Safety Bot" }, sendDataModel: true } },
    { version: "v0.9", updateComponents: { surfaceId: "risk_form", components: [
      { id: "root", component: "Card", child: "col" },
      { id: "col", component: "Column", children: ["title", "sub", "div", "trade_field", "env_field", "submit_btn"] },
      { id: "title", component: "Text", text: "위험성평가 자동작성", variant: "h2" },
      { id: "sub", component: "Text", text: "공종과 작업환경을 입력하면 위험요인·개선대책을 자동으로 생성합니다.", variant: "caption" },
      { id: "div", component: "Divider", axis: "horizontal" },
      { id: "trade_field", component: "Select", label: "공종", value: { path: "/risk/trade" }, placeholder: "공종 선택",
        options: [
          { label: "배관", value: "배관" }, { label: "용접", value: "용접" }, { label: "비계", value: "비계" },
          { label: "전기", value: "전기" }, { label: "굴착", value: "굴착" }, { label: "도장", value: "도장" },
        ],
        checks: [{ call: "required", args: { value: { path: "/risk/trade" } }, message: "공종을 선택해 주세요." }] },
      { id: "env_field", component: "TagInput", label: "작업환경·장비 태그 (선택)", value: { path: "/risk/envTags" },
        placeholder: "예: 고소, 밀폐, 크레인…",
        suggestions: ["저온", "고온", "밀폐", "화기", "분진", "소음", "진동", "고소", "양중", "크레인", "지게차", "용접기", "그라인더"] },
      { id: "submit_btn", component: "Button", text: "위험성평가 생성", variant: "primary",
        checks: [{ call: "required", args: { value: { path: "/risk/trade" } }, message: "공종을 선택해야 생성할 수 있어요." }],
        action: { event: { name: "generate_risk", context: {
          trade: { path: "/risk/trade" }, tags: { path: "/risk/envTags" } } } } },
    ] } },
    { version: "v0.9", updateDataModel: { surfaceId: "risk_form", path: "/risk", value: { trade: "", envTags: [] } } },
  ],
};

/* ================================================================
   A2UI action replies (mock server round-trip)
   ================================================================ */
export interface A2UIActionPayload {
  name: string;
  surfaceId: string;
  sourceComponentId?: string;
  timestamp: string;
  context: Record<string, unknown>;
  dataModel?: Record<string, unknown>;
}

export interface A2UIActionReply {
  md: string;
  a2ui?: object[];
}

/* ---- Risk table builder --------------------------------------- */
interface RiskRow {
  task: string;
  cause: string;
  situation: string;
  current: string;
  improve: string;
  p: string;
  s: string;
  risk: string;
  p2: string;
  s2: string;
  risk2: string;
  ppe: string[];
  law: string;
  status: string;
}

const R_NUM: Record<string, number> = { "상": 3, "중": 2, "하": 1 };
function riskLevel(poss: string, sev: string): string {
  const sc = (R_NUM[poss] || 1) * (R_NUM[sev] || 1);
  return sc >= 6 ? "상" : sc >= 3 ? "중" : "하";
}

type HazardTemplate = {
  task: string; cause: string; situation: string; current: string; improve: string;
  p: string; s: string; p2: string; s2: string; ppe: string[]; law: string;
};

const TRADE_HAZARDS: Record<string, HazardTemplate[]> = {
  "배관": [
    { task: "배관 자재 인양·운반", cause: "중량물 수동 취급으로 인한 근골격계 부담", situation: "배관 자재를 인력으로 운반하던 중 허리·어깨에 무리가 가해져 근골격계 질환 발생", current: "2인 1조 운반", improve: "운반 보조기구(대차) 사용, 적정 중량 분배 및 작업 전 스트레칭 실시", p: "중", s: "하", p2: "하", s2: "하", ppe: ["안전모", "안전화", "장갑"], law: "산업안전보건법 제5조, KOSHA GUIDE G-119-2015" },
    { task: "배관 용접 접합", cause: "용접 불티에 의한 화재 발생", situation: "배관 접합부 용접 작업 중 발생한 불티가 주변 가연물에 착화되어 화재 발생", current: "소화기 비치", improve: "작업 전 가연물 제거 및 불티방지포 설치, 화재감시자 배치", p: "중", s: "상", p2: "하", s2: "중", ppe: ["안전모", "용접면", "방염장갑"], law: "산업안전보건법 제241조, KOSHA GUIDE D-19-2017" },
    { task: "배관 압력시험", cause: "시험 압력 초과로 인한 배관 파열", situation: "배관 압력시험 중 규정 압력 초과로 배관 파열 및 비산물 부상", current: "압력계 확인", improve: "단계별 승압 및 안전밸브 설치, 시험 구간 출입 통제", p: "중", s: "상", p2: "하", s2: "중", ppe: ["안전모", "보안경", "안전화"], law: "산업안전보건기준에 관한 규칙 제292조" },
  ],
  "용접": [
    { task: "아크 용접 작업", cause: "용접 흄·유해가스 흡입으로 인한 건강장해", situation: "밀폐·반밀폐 공간에서 용접 중 발생한 흄과 유해가스를 흡입하여 호흡기 질환 발생", current: "자연 환기", improve: "국소배기장치 설치 및 강제 환기, 송기마스크 착용, 작업 전·중 가스 농도 측정", p: "중", s: "상", p2: "하", s2: "중", ppe: ["용접면", "방진마스크", "내열장갑"], law: "산업안전보건기준에 관한 규칙 제232조, KOSHA GUIDE H-80-2018" },
    { task: "전기 용접", cause: "용접기 누전으로 인한 감전", situation: "젖은 작업 환경에서 용접기 케이블 피복 손상으로 누전 발생하여 작업자 감전", current: "절연장갑 착용", improve: "자동전격방지기 설치 및 작동 확인, 접지 실시 및 케이블 피복 손상 점검", p: "중", s: "상", p2: "하", s2: "중", ppe: ["용접면", "절연장갑", "절연화"], law: "산업안전보건기준에 관한 규칙 제306조" },
    { task: "용접 불티 비산", cause: "용접 불티 비산으로 인한 화재·폭발", situation: "용접 불티가 하부 또는 주변 가연물에 착화되어 화재 및 폭발 발생", current: "소화기 비치", improve: "불티방지포·방화포 설치, 화재감시자 배치 및 작업허가서 발급", p: "중", s: "상", p2: "하", s2: "중", ppe: ["용접면", "방염복", "내열장갑"], law: "산업안전보건법 제241조" },
  ],
  "비계": [
    { task: "비계 조립·해체", cause: "고소작업 중 추락", situation: "비계 조립·해체 작업 중 작업발판 미설치 또는 안전대 미체결로 작업자 추락", current: "안전대 착용 지시", improve: "작업발판 전면 설치 및 안전난간 설치, 안전대 부착설비 설치 및 체결 확인", p: "상", s: "상", p2: "하", s2: "중", ppe: ["안전모", "안전대", "안전화"], law: "산업안전보건기준에 관한 규칙 제42조, 제56조" },
    { task: "비계 자재 인양", cause: "고소에서 자재·공구 낙하", situation: "비계 상부에서 자재나 공구가 낙하하여 하부 통행 작업자가 부상", current: "출입 통제", improve: "낙하물 방지망·방호선반 설치, 자재 인양 시 인양로프 사용", p: "중", s: "상", p2: "하", s2: "중", ppe: ["안전모", "안전화"], law: "산업안전보건기준에 관한 규칙 제14조" },
  ],
  "전기": [
    { task: "활선·정전 작업", cause: "충전부 접촉으로 인한 감전", situation: "정전 미확인 또는 활선 근접 작업 중 충전부에 접촉하여 감전·아크화상 발생", current: "절연장갑 착용", improve: "정전 후 검전·단락접지 실시 및 시건장치, 활선 작업 시 절연용 방호구 설치", p: "상", s: "상", p2: "하", s2: "중", ppe: ["절연장갑", "절연화", "보안경"], law: "산업안전보건기준에 관한 규칙 제319조, 제321조" },
    { task: "분전반 작업", cause: "아크 플래시로 인한 화상", situation: "분전반·배전반 작업 중 단락으로 아크 플래시가 발생하여 작업자 화상 및 실명", current: "차단기 차단", improve: "작업 전 무전압 확인 및 아크 보호복 착용, 절연 공구 사용", p: "중", s: "상", p2: "하", s2: "중", ppe: ["아크보호복", "절연장갑", "안면보호구"], law: "산업안전보건기준에 관한 규칙 제301조" },
  ],
  "굴착": [
    { task: "토사 굴착", cause: "굴착면 토사 붕괴", situation: "굴착 기울기 미준수 또는 지하수 영향으로 굴착면이 붕괴되어 작업자 매몰 발생", current: "굴착면 관찰", improve: "지반 조건별 안전기울기 준수 및 흙막이 지보공 설치, 계측관리 실시", p: "상", s: "상", p2: "하", s2: "중", ppe: ["안전모", "안전화", "안전대"], law: "산업안전보건기준에 관한 규칙 제338조, 제339조" },
    { task: "굴착기 사용", cause: "굴착기 선회·후진 중 협착·충돌", situation: "굴착기 작업 반경 내 근로자 접근으로 선회·후진 중 협착·충돌하여 중상 발생", current: "후방 경고음", improve: "작업 반경 출입 통제 및 유도원 배치, 후방감시카메라·접근경보장치 설치", p: "상", s: "상", p2: "하", s2: "중", ppe: ["안전모", "안전화", "안전조끼"], law: "산업안전보건기준에 관한 규칙 제200조" },
  ],
  "도장": [
    { task: "유기용제 도장", cause: "유기용제 증기 흡입·중독", situation: "환기 불량 공간에서 유기용제 도장 작업 중 증기를 흡입하여 중독·질식 발생", current: "마스크 착용", improve: "강제 환기 및 국소배기장치 설치, 방독마스크 지급 및 정화통 교체 주기 관리", p: "중", s: "상", p2: "하", s2: "중", ppe: ["방독마스크", "보호장갑", "보안경"], law: "산업안전보건기준에 관한 규칙 제420조" },
    { task: "도장 화기 작업", cause: "유기용제 증기 인화로 인한 화재·폭발", situation: "도장·건조 중 정전기 또는 화기로 유기용제 증기가 인화되어 화재·폭발 발생", current: "화기 금지 표지", improve: "방폭형 전기설비 사용 및 정전기 제거, 화기 작업 분리 및 소화설비 비치", p: "중", s: "상", p2: "하", s2: "중", ppe: ["방독마스크", "정전기방지복"], law: "산업안전보건기준에 관한 규칙 제232조" },
  ],
};

const TAG_HAZARDS: Record<string, HazardTemplate> = {
  "고소": { task: "{trade} 고소 작업", cause: "고소작업 중 추락", situation: "2m 이상 고소에서 {trade} 작업 중 안전대 미체결·발판 미흡으로 추락하여 중상 발생", current: "안전대 지급", improve: "작업발판·안전난간 설치 및 안전대 부착설비 확보, 추락방호망 설치", p: "상", s: "상", p2: "하", s2: "중", ppe: ["안전모", "안전대", "안전화"], law: "산업안전보건기준에 관한 규칙 제42조" },
  "밀폐": { task: "밀폐공간 {trade} 작업", cause: "산소결핍·유해가스로 인한 질식", situation: "밀폐공간 {trade} 작업 중 산소결핍 또는 유해가스가 축적되어 질식 재해 발생", current: "출입 명부 관리", improve: "작업 전·중 산소 및 유해가스 농도 측정, 강제 환기 및 송기마스크 착용", p: "중", s: "상", p2: "하", s2: "중", ppe: ["송기마스크", "안전대", "가스측정기"], law: "산업안전보건기준에 관한 규칙 제619조" },
  "화기": { task: "{trade} 화기 작업", cause: "화기 사용으로 인한 화재·폭발", situation: "{trade} 작업 중 화기·불티가 가연물에 착화되어 화재 및 폭발 발생", current: "소화기 비치", improve: "화기작업 허가제 운영 및 화재감시자 배치, 가연물 제거·불티방지포 설치", p: "중", s: "상", p2: "하", s2: "중", ppe: ["방염복", "내열장갑", "소화기"], law: "산업안전보건법 제241조" },
  "크레인": { task: "{trade} 크레인 작업", cause: "크레인 전도·인양물 낙하", situation: "이동식 크레인 아웃트리거 미설치·지반 침하로 전도되거나 인양물이 낙하하여 재해 발생", current: "운전자 점검", improve: "아웃트리거 확장 및 지반 보강, 정격하중·작업반경 준수, 신호수 배치", p: "상", s: "상", p2: "하", s2: "중", ppe: ["안전모", "안전화", "안전조끼"], law: "산업안전보건기준에 관한 규칙 제146조" },
  "저온": { task: "동절기 {trade} 작업", cause: "한랭 노출로 인한 동상·저체온증", situation: "동절기 옥외 {trade} 작업 중 장시간 한랭에 노출되어 동상 및 저체온증 발생", current: "방한복 지급", improve: "휴게·난방 공간 마련 및 작업 시간 조정, 방한 보호구 지급", p: "중", s: "중", p2: "하", s2: "하", ppe: ["방한모", "방한장갑", "안전화"], law: "산업안전보건기준에 관한 규칙 제567조" },
  "고온": { task: "고온기 {trade} 작업", cause: "폭염 노출로 인한 온열질환", situation: "고온·다습 환경에서 {trade} 작업 중 열사병·열탈진 등 온열질환 발생", current: "그늘막 설치", improve: "물·그늘·휴식의 3대 기본수칙 준수, 폭염특보 시 작업 단축·중지", p: "중", s: "상", p2: "하", s2: "중", ppe: ["냉각보호구", "안전모", "안전화"], law: "산업안전보건기준에 관한 규칙 제566조" },
  "분진": { task: "{trade} 분진 발생 작업", cause: "분진 흡입으로 인한 호흡기 질환", situation: "{trade} 작업 중 발생한 분진을 흡입하여 진폐 등 호흡기 질환 발생", current: "방진마스크 지급", improve: "습식 작업 및 국소배기·집진장치 설치, 방진마스크 착용", p: "중", s: "중", p2: "하", s2: "하", ppe: ["방진마스크", "보안경", "안전모"], law: "산업안전보건기준에 관한 규칙 제607조" },
  "용접기": { task: "{trade} 용접기 사용", cause: "용접기 감전·불티 화재", situation: "{trade} 작업 중 용접기 누전 감전 또는 불티 비산으로 화재가 발생하여 재해 발생", current: "전격방지기 부착", improve: "자동전격방지기 작동 확인 및 접지, 불티방지포·화재감시자 배치", p: "중", s: "상", p2: "하", s2: "중", ppe: ["용접면", "절연장갑", "방염복"], law: "산업안전보건기준에 관한 규칙 제306조" },
  "지게차": { task: "{trade} 지게차 운반", cause: "지게차 충돌·협착", situation: "{trade} 작업장 내 지게차 운행 중 보행자와 충돌하거나 협착되어 재해 발생", current: "운행 통로 표시", improve: "보행자·차량 동선 분리 및 제한속도 준수, 후방경보·룸미러 설치", p: "중", s: "상", p2: "하", s2: "중", ppe: ["안전모", "안전화", "안전조끼"], law: "산업안전보건기준에 관한 규칙 제172조" },
  "그라인더": { task: "{trade} 그라인더 작업", cause: "연삭 파편 비산·절단", situation: "{trade} 작업 중 그라인더 숫돌 파손·반발로 파편이 비산하거나 신체가 절단되어 재해 발생", current: "보안경 착용", improve: "덮개·반발방지 가드 설치 및 규격 숫돌 사용, 보안경·안면보호구 착용", p: "중", s: "중", p2: "하", s2: "하", ppe: ["보안경", "안면보호구", "장갑"], law: "산업안전보건기준에 관한 규칙 제122조" },
  "양중": { task: "{trade} 양중 작업", cause: "인양물 낙하·협착", situation: "{trade} 양중 작업 중 줄걸이 불량·과부하로 인양물이 낙하하거나 협착되어 재해 발생", current: "신호수 배치", improve: "줄걸이 점검 및 정격하중 준수, 작업 반경 통제·유도원 배치", p: "중", s: "상", p2: "하", s2: "중", ppe: ["안전모", "안전화", "장갑"], law: "산업안전보건기준에 관한 규칙 제163조" },
  "소음": { task: "{trade} 고소음 작업", cause: "강렬한 소음 노출로 인한 소음성 난청", situation: "{trade} 작업 중 85dB 이상의 강렬한 소음에 장기간 노출되어 소음성 난청 발생", current: "귀마개 비치", improve: "저소음 장비 사용 및 소음원 격리, 청력보호구 지급·착용 관리", p: "중", s: "중", p2: "하", s2: "하", ppe: ["귀마개", "귀덮개", "안전모"], law: "산업안전보건기준에 관한 규칙 제512조" },
};

function tmpl(str: string, trade: string): string {
  return str.replace(/\{trade\}/g, trade);
}

export function buildRiskRows(trade: string, tags: string[]): RiskRow[] {
  const baseHazards = TRADE_HAZARDS[trade] || [];
  const tagHazards: HazardTemplate[] = [];
  for (const tag of (tags || [])) {
    const h = TAG_HAZARDS[tag];
    if (h) tagHazards.push(h);
  }

  return [...baseHazards, ...tagHazards].map((h) => ({
    task: tmpl(h.task, trade),
    cause: tmpl(h.cause, trade),
    situation: tmpl(h.situation, trade),
    current: tmpl(h.current, trade),
    improve: tmpl(h.improve, trade),
    p: h.p, s: h.s, risk: riskLevel(h.p, h.s),
    p2: h.p2, s2: h.s2, risk2: riskLevel(h.p2, h.s2),
    ppe: h.ppe,
    law: h.law,
    status: "초안",
  }));
}

export function buildRiskResultA2UI(trade: string, tags: string[]): object[] {
  const rows = buildRiskRows(trade, tags);
  const surfaceId = `risk_result_${Date.now()}`;
  return [
    { version: "v0.9", createSurface: { surfaceId, catalogId: CAT, theme: { primaryColor: "#0E7C66", agentDisplayName: "Safety Bot" }, sendDataModel: true } },
    { version: "v0.9", updateComponents: { surfaceId, components: [
      { id: "root", component: "Card", child: "col" },
      { id: "col", component: "Column", children: ["title", "sub", "table"] },
      { id: "title", component: "Text", text: `${trade} 위험성평가 결과`, variant: "h2" },
      { id: "sub", component: "Text", text: `총 ${rows.length}개 위험요인 · ${tags && tags.length ? tags.join(", ") + " 환경 포함" : "기본 환경"}`, variant: "caption" },
      { id: "table", component: "DataTable", rows: { path: "/rows" },
        columns: [
          { key: "task",     label: "작업 단계",     kind: "text",      w: 110 },
          { key: "cause",    label: "위험 요인",     kind: "text",      w: 130 },
          { key: "situation",label: "재해 시나리오", kind: "para",      w: 180 },
          { key: "p",        label: "가능성",        kind: "select",    w: 68,  options: ["상", "중", "하"] },
          { key: "s",        label: "중대성",        kind: "select",    w: 68,  options: ["상", "중", "하"] },
          { key: "risk",     label: "위험도",        kind: "risk",      w: 60  },
          { key: "improve",  label: "개선대책",      kind: "para",      w: 200 },
          { key: "p2",       label: "가능성",        kind: "select",    w: 68,  options: ["상", "중", "하"] },
          { key: "s2",       label: "중대성",        kind: "select",    w: 68,  options: ["상", "중", "하"] },
          { key: "risk2",    label: "잔류위험도",    kind: "arrowrisk", w: 70  },
          { key: "ppe",      label: "보호구",        kind: "tags",      w: 150 },
          { key: "law",      label: "관련 법령",     kind: "para",      w: 180 },
          { key: "status",   label: "상태",          kind: "status",    w: 64  },
          { key: "_",        label: "액션",          kind: "actions",   w: 80  },
        ],
      },
    ] } },
    { version: "v0.9", updateDataModel: { surfaceId, path: "/rows", value: rows } },
  ];
}

/* ---- Action reply factory ------------------------------------- */
export function a2uiActionReply(action: A2UIActionPayload): A2UIActionReply {
  const ctx = action.context || {};
  switch (action.name) {
    case "create_incident":
      return {
        md: `✅ **인시던트가 생성되었습니다.** \`INC-${Math.floor(1000 + Math.random() * 9000)}\`\n\n` +
          `- 서비스: \`${ctx.service || "-"}\`\n- 심각도: **${ctx.severity || "-"}**\n- 고객 영향: ${ctx.customerImpact ? "있음" : "없음"}\n\n> ${ctx.summary || ""}\n\n온콜 담당자에게 페이지를 발송했어요.`,
      };
    case "start_deploy":
      return {
        md: `🚀 **배포를 시작했습니다.** \`${ctx.service || "?"} ${ctx.version || ""}\`\n\n카나리 트래픽 **${ctx.canary}%** 로 롤아웃 중입니다. p99 와 에러율을 모니터링하다가 임계값 초과 시 자동 롤백돼요.`,
      };
    case "cancel_deploy":
      return { md: "배포를 취소했어요. 변경 사항은 적용되지 않았습니다." };
    case "refresh_status":
      return { md: `🔄 \`${ctx.range || "1h"}\` 기준으로 지표를 다시 조회했어요. 위 카드의 값이 갱신되었습니다.` };
    case "generate_risk": {
      const trade = String(ctx.trade || "");
      const tags = Array.isArray(ctx.tags) ? ctx.tags.map(String) : [];
      const rows = buildRiskRows(trade, tags);
      return {
        md: `✅ **${trade || "??"} 위험성평가**를 자동생성했습니다. 총 **${rows.length}개** 위험요인이 도출됐어요.\n\n- 개선대책을 검토하고 상태 버튼을 눌러 진행 상태(초안 → 검토 → 승인)를 관리하세요.\n- 행 복제·제외·삭제가 가능합니다.`,
        a2ui: buildRiskResultA2UI(trade, tags),
      };
    }
    default:
      return { md: `\`${action.name}\` 액션을 접수했어요.` };
  }
}

/* ---- All A2UI answers ----------------------------------------- */
export const A2UI_ANSWERS: A2UIAnswer[] = [
  A2UI_INCIDENT,
  A2UI_DEPLOY,
  A2UI_STATUS,
  A2UI_RISK,
];
