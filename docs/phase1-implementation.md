# SAFETYSAAS Agent — Phase 1 구현 수행 내역

> **작성일**: 2026-06-08  
> **단계**: Phase 1 — 프론트엔드 (목업 스트리밍)  
> **상태**: ✅ 완료

---

## 1. 프로젝트 개요

SAFETYSAAS Agent의 Next.js 14 (App Router) 프론트엔드를 디자인 핸드오프 번들(`design_handoff_safetysaas`)을 기반으로 재구현했습니다.  
백엔드(FastAPI) 연동은 Phase 2에서 진행하며, 이번 단계는 **스트리밍 시뮬레이션(setTimeout 기반)** 으로 동작합니다.

---

## 2. 기술 스택

| 항목 | 선택 | 버전 |
|------|------|------|
| 프레임워크 | Next.js (App Router) | 14.2.x |
| 언어 | TypeScript | 5.x |
| 스타일 | 전역 CSS + CSS 변수 (토큰) | — |
| 아이콘 | lucide-react | 최신 |
| 마크다운 렌더링 | marked | 14.x (CJS 호환) |
| 폰트 | Pretendard Variable + JetBrains Mono | CDN |
| 상태 관리 | React useState / useCallback (Zustand 미사용) | — |
| 영속성 | localStorage | — |

> **마크다운 라이브러리 변경 사유**  
> `react-markdown` v8/v10은 ESM 전용 모듈로, Next.js webpack 컴파일 단계에서 무한 대기 현상 발생.  
> CJS 호환인 `marked` v14로 교체 후 정상 동작 확인.

---

## 3. 파일 구조

```
safetysaas/
├── docs/
│   └── phase1-implementation.md   ← 이 파일
├── src/
│   ├── app/
│   │   ├── layout.tsx             루트 레이아웃, 폰트 CDN 로드
│   │   ├── page.tsx               앱 셸 조립 (상태/이벤트 연결)
│   │   └── globals.css            전체 CSS (토큰 import + 모든 컴포넌트 스타일)
│   ├── components/
│   │   ├── Sidebar.tsx            대화 히스토리 사이드바
│   │   ├── Topbar.tsx             모델 칩, 테마 토글, 사이드바 접기
│   │   ├── EmptyState.tsx         초기 화면 (추천 카드 6개 + 기능 칩)
│   │   ├── BotMessage.tsx         AI 응답 (아바타 + StatusLine→CoT→Prose 순서)
│   │   ├── UserMessage.tsx        사용자 말풍선 (파일 첨부 칩 포함)
│   │   ├── StatusLine.tsx         스피너 + shimmer 텍스트 애니메이션
│   │   ├── CoT.tsx                추론 과정 접기/펼치기 (grid-rows 0fr→1fr)
│   │   ├── Prose.tsx              marked 기반 마크다운 렌더러 (코드블록 복사, [N] 인용)
│   │   ├── MsgActions.tsx         복사 / 좋아요 / 싫어요 / 다시 생성
│   │   ├── Composer.tsx           입력창 (자동 리사이즈, 파일 첨부, 마이크, Enter 전송)
│   │   └── SourcePanel.tsx        우측 슬라이드 출처 패널 (flash 효과)
│   ├── hooks/
│   │   ├── useChat.ts             스트리밍 엔진 + 세션 상태 + localStorage 영속성
│   │   └── useTheme.ts            라이트/다크 테마 토글 (data-theme 방식)
│   ├── lib/
│   │   ├── data.ts                4개 시나리오 목업 응답 + pickAnswer()
│   │   └── utils.ts               uid, genTitle, sleep, groupSessions, guessFileIcon
│   ├── styles/
│   │   └── tokens.css             라이트/다크 CSS 변수 (디자인 토큰)
│   └── types/
│       └── index.ts               Session, Message, Source, CoTStep 등 타입
├── next.config.mjs
├── tsconfig.json
└── package.json
```

---

## 4. 구현된 기능 목록

### 4.1 레이아웃 & 반응형
- [x] `280px` 사이드바 + `1fr` 메인 컬럼 그리드 레이아웃
- [x] 데스크톱: 사이드바 접기/펼치기 (`sb-collapsed`, `width: 0 + opacity: 0`)
- [x] 모바일(≤860px): 사이드바 오버레이 드로어 + 스크림
- [x] 스크롤 시 Topbar `backdrop-filter blur(8px)` + border 노출

### 4.2 디자인 토큰
- [x] 라이트 테마 CSS 변수 (oklch 기반)
- [x] 다크 테마 CSS 변수 (`[data-theme="dark"]`)
- [x] `localStorage`에 테마 영속 저장
- [x] Pretendard Variable / JetBrains Mono 폰트

### 4.3 사이드바
- [x] 브랜드 마크 (그라디언트 + 흰색 다이아몬드)
- [x] 새 대화 버튼
- [x] 히스토리 그룹화: 오늘 / 지난 7일 / 이전
- [x] 활성 대화 강조 (sidebar-active + accent 색)
- [x] 삭제 버튼 (hover 시 노출)
- [x] 사용자 행 (하단 고정, 아바타 그라디언트)

### 4.4 Empty State
- [x] 그라디언트 텍스트 인사말
- [x] 추천 카드 6개 (2열 그리드, hover 시 translateY(-2px))
- [x] 기능 칩 (RAG / 스트리밍 / 추론 / 파일 / A2UI 안내)

### 4.5 스트리밍 엔진 (`useChat.ts`)
- [x] **Phase 1**: `status` → `reasoning(CoT)` → `answer(토큰)` 순서 시뮬레이션
- [x] 응답 중단 (`stop`) — 스트리밍 즉시 종료, 부분 텍스트 보존
- [x] 다시 생성 (`regenerate`) — 이전 사용자 메시지로 재실행
- [x] 페이지 리로드 시 중단된 스트리밍 자동 복구
- [x] 자동 스크롤 (autoStick — 하단 120px 이내일 때 유지)

### 4.6 메시지 렌더링
- [x] **BotMessage**: 아바타 `pulseAva` 애니메이션 (스트리밍 중)
- [x] **StatusLine**: 스피너 + shimmer 그라디언트 애니메이션
- [x] **CoT**: grid-template-rows 0fr→1fr 접기/펼치기, 마지막 스텝 blink
- [x] **Prose**: marked 마크다운, 코드블록(언어 라벨 + 복사 버튼), `[N]` → 인용 칩, 스트리밍 캐럿
- [x] **SourceSummary**: 완료 후 참고 자료 pill 목록
- [x] **MsgActions**: 복사 / 👍 / 👎 / 다시 생성 / 공유

### 4.7 Composer (입력창)
- [x] textarea 1줄~220px 자동 리사이즈
- [x] `Enter` → 전송, `Shift+Enter` → 줄바꿈
- [x] 파일 첨부 (드래그&드롭 + 버튼, 최대 5개)
- [x] 파일 첨부 칩 (아이콘 + 이름 + 크기 + 삭제)
- [x] 마이크 버튼 (음성 입력 시뮬레이션, `recPulse` 애니메이션)
- [x] 전송 버튼 (disabled 스타일) / 중단 버튼 전환
- [x] 드래그 오버 시 dashed border + accent-soft 배경
- [x] focus 시 accent border + ring

### 4.8 Source Panel
- [x] 우측 고정 슬라이드 패널 (`min(440px, 90vw)`)
- [x] `transform: translateX(100%)` ↔ `translateX(0)` 전환
- [x] 스크림 (클릭 시 패널 닫기)
- [x] 인용 번호 클릭 → 해당 출처로 스크롤 + `flash` 애니메이션
- [x] 출처 타입별 레이블 (소스 코드 / 문서 / API 명세 / 로그 / 대시보드)

### 4.9 세션 관리
- [x] `localStorage` 키 `safetysaas_agent_v1` 에 전체 세션 배열 영속 저장
- [x] 첫 메시지로 세션 제목 자동 생성 (38자 제한)
- [x] 세션 선택 / 삭제
- [x] 새 대화 시작 (진행 중 스트리밍 자동 취소)

### 4.10 목업 응답 시나리오 (8개 — 텍스트 4 + A2UI 4)

**텍스트 RAG 응답**
| 키워드 | 시나리오 |
|--------|---------|
| 타임아웃 / timeout / 간헐적 | order→payment 타임아웃 원인 및 해결 (코드블록 + 표 + 인용) |
| 결제 승인 / 명세 / 페이로드 | POST /api/v1/payments/approve 요청·응답 명세 |
| 서킷브레이커 / Resilience4j | application.yml 설정 예시 |
| 로그 / 에러 로그 / order-service | 로그 분석 결과 요약 |

**A2UI 생성형 UI 시나리오**
| 키워드 | 시나리오 | 주요 컴포넌트 |
|--------|---------|-------------|
| 인시던트 / incident / 장애 보고 | 인시던트 보고 폼 (Incident Bot) | ChoicePicker · TextField · CheckBox · Button |
| 배포 / canary / 카나리 / deploy | 카나리 배포 승인 패널 (Deploy Bot) | Slider · CheckBox · Button (guard checks) |
| 상태 카드 / 서비스 상태 | payment-service 상태 카드 (Observability Bot) | ChoicePicker · Text formatString 바인딩 |
| 위험성평가 / 공종 | 위험성평가 자동작성 (Safety Bot) | Select · TagInput → DataTable 결과 |

### 4.11 A2UI v0.9 프로토콜 구현

- **진행 방식**: `createSurface` → `updateComponents` → `updateDataModel` 봉투를 300~500ms 간격으로 순차 적용 (progressive rendering, skeleton → 구조 → 데이터)
- **양방향 바인딩**: `onA2UIData(msgId, path, value)` 콜백으로 surface dataModel 즉시 반영 (Slider, ChoicePicker, TextField, CheckBox 등)
- **서버 액션 round-trip**: Button 클릭 → `onA2UIAction(payload)` → 새 bot 메시지 스트리밍 (텍스트 응답 or DataTable A2UI)
- **위험성평가 시나리오**: 공종(Select) + 환경·장비 태그(TagInput) 입력 → `generate_risk` 액션 → `buildRiskResultA2UI()` 가 해당 공종 위험요인 + 태그 위험요인을 조합한 DataTable 서피스 생성
- **상태 저장**: A2UI surface state(`a2uiState`)는 `Message` 안에 포함되어 localStorage에 영속 저장

---

## 5. 알려진 제한사항 (Phase 2에서 해결)

| 항목 | 현황 | Phase 2 계획 |
|------|------|-------------|
| 백엔드 | 없음 (setTimeout 시뮬레이션) | FastAPI SSE 스트리밍 연동 |
| RAG | 목업 데이터 고정 | 실제 문서 인덱싱 + 벡터 검색 |
| A2UI 생성형 UI | ✅ **구현 완료** (4개 시나리오, 액션 round-trip) | — |
| 인증 | 없음 | JWT |
| 코드 하이라이팅 | ✅ **구현 완료** (highlight.js) | — |
| 마크다운 sanitize | ✅ **구현 완료** (DOMPurify) | — |

---

## 6. 로컬 실행 방법

```bash
cd D:\dev\TUI\safetysaas

# 개발 서버
npm run dev
# → http://localhost:3000

# 프로덕션 빌드
npm run build
npm start
```

---

## 7. 트러블슈팅 기록

### react-markdown ESM 충돌 (해결)
- **증상**: `npm run dev` 후 브라우저에 아무것도 표시되지 않음. 서버 로그는 `○ Compiling / ...` 에서 무한 대기
- **원인**: `react-markdown` v8/v10이 ESM 전용 모듈 — Next.js webpack이 CJS 컨텍스트에서 로드 실패
- **해결**: `react-markdown` + `remark-gfm` 제거 → `marked` v14 (CJS 호환) 로 교체. `Prose.tsx`를 `dangerouslySetInnerHTML` 기반으로 재작성

### marked v14 Renderer API 변경 (해결)
- **증상**: `renderer.code` 타입 오류 — `(code: string, lang?: string)` 시그니처 불일치
- **원인**: marked v14에서 renderer 메서드가 문자열 대신 객체(`{ text, lang }`)를 수신하도록 변경
- **해결**: `(renderer as any).code = ({ text, lang }) => ...` 형태로 수정

### DOMPurify Config 타입 오류 (해결)
- **증상**: `DOMPurify.Config` 타입을 명시하면 `PARSER_MEDIA_TYPE` 호환성 오류 발생
- **원인**: `@types/dompurify`와 `dompurify` 내장 타입 간 `DOMParserSupportedType` 정의 불일치
- **해결**: 타입 명시 제거 (`const PURIFY_CONFIG = { ... }` — TypeScript 추론으로 처리)
