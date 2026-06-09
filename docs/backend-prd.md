# SAFETYSAAS Agent — 백엔드 서버 PRD (Phase 2)

> **문서 유형**: Product Requirements Document (PRD)  
> **작성일**: 2026-06-09  
> **대상**: FastAPI 기반 멀티 테넌트 지능형 에이전트 서버  
> **참조 설계서**: [설계서] 멀티 테넌트 지능형 에이전트 시스템 (LangGraph 기반)  
> **상태**: 개발 준비 (Phase 2 착수 전)

---

## 목차

1. [제품 개요](#1-제품-개요)
2. [기술 스택 확정](#2-기술-스택-확정)
3. [시스템 아키텍처](#3-시스템-아키텍처)
4. [프로젝트 파일 구조](#4-프로젝트-파일-구조)
5. [LangGraph 에이전트 노드 설계](#5-langgraph-에이전트-노드-설계)
6. [API 엔드포인트 명세](#6-api-엔드포인트-명세)
7. [ChromaDB 멀티 테넌시 설계](#7-chromadb-멀티-테넌시-설계)
8. [Gemini API 연동 및 프롬프트 설계](#8-gemini-api-연동-및-프롬프트-설계)
9. [Google STT 연동 설계](#9-google-stt-연동-설계)
10. [SSE 스트리밍 프로토콜](#10-sse-스트리밍-프로토콜)
11. [A2UI 봉투 생성 로직](#11-a2ui-봉투-생성-로직)
12. [멀티 테넌트 인증 설계](#12-멀티-테넌트-인증-설계)
13. [환경 변수 및 설정](#13-환경-변수-및-설정)
14. [개발 단계 로드맵](#14-개발-단계-로드맵)
15. [비기능 요구사항](#15-비기능-요구사항)

---

## 1. 제품 개요

### 1.1 목적

SAFETYSAAS Agent 백엔드 서버는 산업 안전관리 도메인에 특화된 **멀티 테넌트 AI 에이전트 API** 입니다.  
음성(STT) 또는 텍스트 입력을 받아, 고객사별(tenant) 맞춤 SOP 문서와 공통 법령 지식을 계층적으로 검색(RAG)하여 스트리밍 응답을 반환합니다.

### 1.2 핵심 요구사항

| 번호 | 요구사항 | 우선순위 |
|------|---------|---------|
| R-01 | 텍스트·음성 입력 처리 (Google STT) | P0 |
| R-02 | LangGraph 상태 머신 기반 에이전트 오케스트레이션 | P0 |
| R-03 | ChromaDB 멀티 테넌트 계층적 RAG (SOP → 법령 Fallback) | P0 |
| R-04 | Gemini API LLM 연동 + Ollama 교체 가능 설계 | P0 |
| R-05 | Server-Sent Events(SSE) 스트리밍 응답 | P0 |
| R-06 | A2UI v0.9 봉투 생성 및 스트리밍 | P1 |
| R-07 | SaaS 데이터 저장 API 연동 (Save 인텐트) | P1 |
| R-08 | 테넌트별 문서 인덱싱 API | P1 |
| R-09 | JWT 기반 멀티 테넌트 인증 | P2 |

### 1.3 프론트엔드 연동 대상

- **SAFETYSAAS Agent 프론트엔드** (Next.js 14, A2UI v0.9)
- 현재 Phase 1에서 Mock 스트리밍으로 동작 중 → Phase 2에서 이 서버로 교체

---

## 2. 기술 스택 확정

| 항목 | 확정 기술 | 비고 |
|------|---------|------|
| **웹 프레임워크** | FastAPI 0.111+ | async, SSE 지원 |
| **LLM (현재)** | Google Gemini API (`gemini-1.5-flash` / `gemini-1.5-pro`) | 비용·속도 균형 |
| **LLM (향후)** | Ollama (`llama3`, `mistral` 등) | 온프레미스 전환 시 |
| **에이전트 오케스트레이션** | LangGraph 0.2+ | 상태 머신, 조건 분기 |
| **Vector DB** | ChromaDB 0.5+ | 메타데이터 필터링, 로컬/서버 모드 |
| **임베딩 모델** | `models/text-embedding-004` (Gemini) | Ollama 전환 시 `nomic-embed-text` |
| **STT** | Google Cloud Speech-to-Text v2 | 한국어 우선, 다국어 지원 |
| **인증** | python-jose (JWT) + passlib | 멀티 테넌트 식별 |
| **비동기 HTTP** | httpx (async) | 외부 SaaS API 호출 |
| **설정 관리** | pydantic-settings | .env 기반 |
| **로깅** | structlog | JSON 구조화 로그 |
| **컨테이너** | Docker + docker-compose | ChromaDB 서버 모드 포함 |

---

## 3. 시스템 아키텍처

### 3.1 전체 요청 흐름

```
┌─────────────────────────────────────────────────────────┐
│                  SAFETYSAAS Frontend                     │
│            (Next.js 14 + A2UI v0.9)                      │
└────────────────────┬────────────────────────────────────┘
                     │ POST /api/v1/chat/stream (SSE)
                     │ POST /api/v1/stt/transcribe
                     │ POST /api/v1/documents/ingest
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  FastAPI Server                          │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Auth/JWT   │  │  STT Router  │  │  Doc Ingest   │  │
│  │  Middleware │  │  (Google STT)│  │  (ChromaDB)   │  │
│  └──────┬──────┘  └──────┬───────┘  └───────────────┘  │
│         │                │                               │
│         ▼                ▼                               │
│  ┌─────────────────────────────────────────────────┐    │
│  │           LangGraph Agent Graph                  │    │
│  │                                                  │    │
│  │  Input_Processor → Intent_Router                 │    │
│  │       ↓ (Query/Both)      ↓ (Save)              │    │
│  │  SOP_Retriever        SaaS_Executor              │    │
│  │       ↓ (score < 0.8)                            │    │
│  │  Global_Retriever                                │    │
│  │       ↓                                          │    │
│  │  Final_Responder ──────────────────────────────► │    │
│  │       ↓ SSE chunks                               │    │
│  └──────────────────────────────────────────────────┘    │
└────────────────────┬────────────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
  ┌──────────────┐     ┌──────────────────┐
  │  ChromaDB    │     │  Google Gemini   │
  │  (Vector DB) │     │  API             │
  │              │     │                  │
  │ - tenant_sop │     │ - gemini-1.5-    │
  │ - global_law │     │   flash/pro      │
  └──────────────┘     │ - embedding-004  │
                       └──────────────────┘
```

### 3.2 LangGraph 상태 그래프 분기 로직

```
START
  │
  ▼
Input_Processor
  │ (audio)             │ (text)
  ▼                     ▼
Google_STT_Node    ─── Language_Identifier
                              │
                              ▼
                       Intent_Router
                    ┌─────────┼──────────┐
               Query│    Both │          │Save
                    ▼         ▼          ▼
             SOP_Retriever  SOP_Retriever  SaaS_Executor
                    │         │                │
            score≥0.8│    score<0.8│           │
                    │         ▼                │
                    │   Global_Retriever        │
                    │         │                │
                    └────┬────┘                │
                         ▼                     │
                  Final_Responder ◄────────────┘
                         │
                       END (SSE stream done)
```

---

## 4. 프로젝트 파일 구조

```
safetysaas-server/
├── app/
│   ├── main.py                    FastAPI 앱 생성, 미들웨어, 라우터 등록
│   ├── config.py                  pydantic-settings 환경 변수 모델
│   ├── dependencies.py            Depends() 공통 의존성 (DB, LLM, 인증)
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── v1/
│   │   │   ├── __init__.py
│   │   │   ├── chat.py            POST /api/v1/chat/stream (SSE)
│   │   │   ├── stt.py             POST /api/v1/stt/transcribe
│   │   │   ├── documents.py       POST /api/v1/documents/ingest
│   │   │   │                      GET  /api/v1/documents/list
│   │   │   │                      DELETE /api/v1/documents/{doc_id}
│   │   │   ├── auth.py            POST /api/v1/auth/token
│   │   │   └── health.py          GET  /api/v1/health
│   │
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── graph.py               LangGraph 그래프 정의 (StateGraph 조립)
│   │   ├── state.py               AgentState TypedDict 정의
│   │   └── nodes/
│   │       ├── __init__.py
│   │       ├── input_processor.py    노드 1: 입력 타입 판별 + STT 분기
│   │       ├── intent_router.py      노드 2: 의도/도메인/언어 분류 (Gemini)
│   │       ├── sop_retriever.py      노드 3: 테넌트 전용 SOP RAG
│   │       ├── global_retriever.py   노드 4: 공통 법령/매뉴얼 RAG (Fallback)
│   │       ├── saas_executor.py      노드 5: SaaS API 저장 실행
│   │       └── final_responder.py    노드 6: 최종 응답 생성 + SSE 스트리밍
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── llm/
│   │   │   ├── __init__.py
│   │   │   ├── base.py            LLMProvider 추상 인터페이스
│   │   │   ├── gemini.py          Gemini API 구현체
│   │   │   └── ollama.py          Ollama 구현체 (향후 전환용)
│   │   ├── stt/
│   │   │   ├── __init__.py
│   │   │   ├── base.py            STTProvider 추상 인터페이스
│   │   │   └── google_stt.py      Google Speech-to-Text v2 구현체
│   │   ├── vector_store/
│   │   │   ├── __init__.py
│   │   │   ├── chroma_client.py   ChromaDB 연결 + 컬렉션 관리
│   │   │   └── embeddings.py      임베딩 함수 (Gemini / Ollama 교체 가능)
│   │   └── saas/
│   │       ├── __init__.py
│   │       └── saas_api.py        외부 SaaS API 클라이언트 (httpx)
│   │
│   ├── prompts/
│   │   ├── intent_router.py       의도 분류 프롬프트 템플릿
│   │   ├── rag_synthesis.py       계층적 RAG 합성 프롬프트 템플릿
│   │   └── final_responder.py     최종 응답 + 다국어 제어 프롬프트
│   │
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── chat.py                ChatRequest, ChatResponse, SSEEvent
│   │   ├── documents.py           IngestRequest, DocumentMeta
│   │   ├── stt.py                 STTRequest, STTResponse
│   │   └── auth.py                TokenRequest, TokenResponse, TenantInfo
│   │
│   ├── middleware/
│   │   ├── __init__.py
│   │   ├── auth.py                JWT 검증 미들웨어
│   │   └── tenant.py              tenant_id 헤더 추출 미들웨어
│   │
│   └── utils/
│       ├── __init__.py
│       ├── streaming.py           SSE 이벤트 포맷터 + A2UI 봉투 빌더
│       └── logger.py              structlog 설정
│
├── tests/
│   ├── conftest.py
│   ├── test_chat.py
│   ├── test_rag.py
│   └── test_stt.py
│
├── scripts/
│   └── ingest_sample.py           샘플 문서 인덱싱 CLI 스크립트
│
├── docker-compose.yml             FastAPI + ChromaDB 서버 모드
├── Dockerfile
├── requirements.txt
├── .env.example
└── README.md
```

---

## 5. LangGraph 에이전트 노드 설계

### 5.1 AgentState (그래프 공유 상태)

```python
# app/agents/state.py
from typing import TypedDict, Optional, Literal, Any

class AgentState(TypedDict):
    # 입력 컨텍스트
    tenant_id: str
    input_type: Literal["audio", "text"]
    raw_input: bytes | str          # audio bytes 또는 text
    raw_query: str                  # STT 변환 후 텍스트

    # 분류 결과
    detected_lang: str              # "ko", "en", ...
    intent: Literal["Query", "Save", "Both"]
    domain: Literal["Customer_Support", "Safety_Manual", "General"]
    urgency: int                    # 1-5

    # RAG 결과
    sop_results: list[dict]         # SOP 검색 결과 (score 포함)
    global_results: list[dict]      # 법령 검색 결과
    sop_score_max: float            # SOP 최고 유사도 점수

    # 액션 결과
    action_result: Optional[dict]   # SaaS API 응답

    # 출력
    final_response: str             # 최종 답변 텍스트
    sources: list[dict]             # 인용 출처 목록
    a2ui_envelopes: list[dict]      # A2UI 봉투 목록 (필요 시)

    # 스트리밍 콜백
    stream_callback: Any            # SSE 전송 함수 (callable)
```

### 5.2 노드별 상세 명세

#### 노드 1: Input_Processor

```
역할    : 입력 타입(audio/text) 판별 및 STT 분기
입력    : raw_input (bytes | str), input_type
처리    :
  - input_type == "audio" → Google STT 호출 → raw_query 업데이트
  - input_type == "text"  → raw_query = raw_input (그대로)
출력    : raw_query (str)
다음 노드: Language_Identifier (intent_router 내부 통합)
```

#### 노드 2: Intent_Router

```
역할    : 언어 감지 + 의도/도메인/긴급도 분류
입력    : raw_query
LLM 호출: Gemini (intent_router 프롬프트)
출력    :
  - detected_lang: "ko" | "en" | ...
  - intent: "Query" | "Save" | "Both"
  - domain: "Customer_Support" | "Safety_Manual" | "General"
  - urgency: 1~5
조건 분기:
  - intent == "Save"  → SaaS_Executor
  - intent == "Query" → SOP_Retriever
  - intent == "Both"  → SOP_Retriever + SaaS_Executor (병렬)
```

#### 노드 3: SOP_Retriever

```
역할    : 테넌트 전용 SOP 문서 RAG 검색
입력    : tenant_id, raw_query
처리    :
  - ChromaDB 컬렉션: "tenant_sop"
  - 메타데이터 필터: {"tenant_id": tenant_id}
  - 임베딩 후 유사도 검색 (top_k=5)
  - 최고 유사도 점수 sop_score_max 기록
출력    : sop_results (list), sop_score_max (float)
조건 분기:
  - sop_score_max >= 0.8 → Final_Responder (SOP만으로 충분)
  - sop_score_max < 0.8  → Global_Retriever (Fallback)
```

#### 노드 4: Global_Retriever

```
역할    : 공통 법령/매뉴얼 RAG 검색 (SOP Fallback)
입력    : raw_query, sop_results
처리    :
  - ChromaDB 컬렉션: "global_law"
  - 메타데이터 필터: {"doc_type": "law" | "manual"}
  - 임베딩 후 유사도 검색 (top_k=3)
출력    : global_results (list)
다음 노드: Final_Responder
```

#### 노드 5: SaaS_Executor

```
역할    : SaaS 시스템에 데이터 저장
입력    : raw_query, tenant_id, detected_lang
처리    :
  1. Gemini로 파라미터 추출
     (Status, Category, date, inspector 등)
  2. 외부 SaaS API POST 호출 (httpx async)
  3. 응답(성공/실패) 기록
출력    : action_result (dict)
다음 노드: Final_Responder
```

#### 노드 6: Final_Responder

```
역할    : 최종 답변 생성 + SSE 스트리밍
입력    : sop_results, global_results, action_result, detected_lang
LLM 호출: Gemini (streaming mode)
처리    :
  1. RAG 합성 프롬프트로 SOP/법령 컨텍스트 합성
  2. detected_lang 언어로 답변 생성
  3. SSE 토큰 스트리밍 (stream_callback 호출)
  4. 완료 후 sources, a2ui_envelopes 생성
출력    : final_response (str), sources (list), a2ui_envelopes (list)
```

---

## 6. API 엔드포인트 명세

### 6.1 POST /api/v1/chat/stream — 채팅 스트리밍

**Request**

```http
POST /api/v1/chat/stream
Content-Type: application/json
Authorization: Bearer <jwt_token>
X-Tenant-ID: tenant_abc
```

```json
{
  "query": "안전화 착용 기준이 어떻게 돼?",
  "input_type": "text",
  "session_id": "sess_xyz",
  "send_data_model": true
}
```

**Response** — `text/event-stream` (SSE)

```
data: {"event": "status", "data": {"text": "안전 매뉴얼을 검색하고 있어요…"}}

data: {"event": "reasoning", "data": {"step": "SOP 문서 3건 검색됨", "index": 1}}
data: {"event": "reasoning", "data": {"step": "유사도 0.92 — SOP 기준 충족", "index": 2}}

data: {"event": "token", "data": {"text": "안전화 착용 기준은 "}}
data: {"event": "token", "data": {"text": "산업안전보건법 제38조에 따라 "}}
...

data: {"event": "sources", "data": {"sources": [{"id": 1, "title": "안전보호구 SOP", "type": "sop"}]}}

data: {"event": "a2ui", "data": { ...A2UI envelope... }}

data: {"event": "done", "data": {"session_id": "sess_xyz"}}
```

### 6.2 POST /api/v1/stt/transcribe — 음성→텍스트

**Request**

```http
POST /api/v1/stt/transcribe
Content-Type: multipart/form-data
Authorization: Bearer <jwt_token>
```

```
audio_file: <binary .wav/.mp3/.webm>
language_code: ko-KR   (선택, 기본값: ko-KR)
```

**Response**

```json
{
  "transcript": "오늘 안전 점검 이상 없음. 이 내용 등록해줘.",
  "confidence": 0.97,
  "detected_language": "ko",
  "duration_seconds": 4.2
}
```

### 6.3 POST /api/v1/documents/ingest — 문서 인덱싱

**Request**

```http
POST /api/v1/documents/ingest
Content-Type: multipart/form-data
Authorization: Bearer <jwt_token>
X-Tenant-ID: tenant_abc
```

```
file: <PDF | DOCX | TXT>
doc_type: sop | law | manual      (sop = 테넌트 전용, law/manual = 공통)
title: "안전보호구 착용 SOP v2.1"
tags: ["안전화", "보호구", "화학물질"]
```

**Response**

```json
{
  "doc_id": "doc_abc123",
  "chunk_count": 24,
  "tenant_id": "tenant_abc",
  "doc_type": "sop",
  "status": "indexed"
}
```

### 6.4 POST /api/v1/auth/token — JWT 발급

**Request**

```json
{
  "tenant_id": "tenant_abc",
  "api_key": "sk-safetysaas-..."
}
```

**Response**

```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 86400,
  "tenant_id": "tenant_abc"
}
```

### 6.5 GET /api/v1/health — 헬스체크

```json
{
  "status": "ok",
  "version": "1.0.0",
  "services": {
    "chromadb": "ok",
    "gemini": "ok",
    "google_stt": "ok"
  }
}
```

---

## 7. ChromaDB 멀티 테넌시 설계

### 7.1 컬렉션 구조

```
ChromaDB
├── Collection: "tenant_sop"
│   메타데이터 스키마:
│   {
│     "tenant_id": "tenant_abc",    ← 테넌트 격리 필수 필터
│     "doc_id": "doc_xyz",
│     "doc_type": "sop",
│     "title": "안전보호구 SOP",
│     "chunk_index": 3,
│     "source_page": 12
│   }
│
└── Collection: "global_law"
    메타데이터 스키마:
    {
      "doc_type": "law" | "manual",
      "law_code": "산업안전보건법_제38조",
      "title": "보호구 착용 기준",
      "effective_date": "2024-01-01",
      "chunk_index": 1
    }
```

### 7.2 테넌트 격리 쿼리 패턴

```python
# SOP 검색 — tenant_id 필터 강제 적용
results = collection.query(
    query_embeddings=[embedding],
    n_results=5,
    where={"tenant_id": {"$eq": tenant_id}},   # 필수
    include=["documents", "metadatas", "distances"]
)

# 유사도 점수 = 1 - distance (ChromaDB cosine)
scores = [1 - d for d in results["distances"][0]]
sop_score_max = max(scores) if scores else 0.0
```

### 7.3 임베딩 전략

```python
# app/services/vector_store/embeddings.py

class EmbeddingProvider:
    """LLM 교체 시 임베딩도 함께 교체되도록 추상화"""

    def __init__(self, provider: str = "gemini"):
        if provider == "gemini":
            # Google Generative AI Embeddings
            self.model = "models/text-embedding-004"
        elif provider == "ollama":
            # Ollama 로컬 임베딩 (전환 시)
            self.model = "nomic-embed-text"

    async def embed(self, texts: list[str]) -> list[list[float]]:
        ...
```

### 7.4 청킹 전략

| 문서 타입 | 청킹 방식 | chunk_size | overlap |
|---------|---------|-----------|---------|
| SOP (PDF/DOCX) | RecursiveCharacterTextSplitter | 512 tokens | 50 tokens |
| 법령 (TXT) | 조문 단위 분할 (§ 기준) | 256 tokens | 20 tokens |
| 매뉴얼 (PDF) | 섹션 헤더 기준 분할 | 400 tokens | 40 tokens |

---

## 8. Gemini API 연동 및 프롬프트 설계

### 8.1 LLM Provider 추상화

```python
# app/services/llm/base.py
from abc import ABC, abstractmethod

class LLMProvider(ABC):
    @abstractmethod
    async def chat(self, messages: list[dict], **kwargs) -> str: ...

    @abstractmethod
    async def stream(self, messages: list[dict], **kwargs): ...
        # async generator → yield str chunks

    @abstractmethod
    async def embed(self, texts: list[str]) -> list[list[float]]: ...
```

```python
# app/services/llm/gemini.py
import google.generativeai as genai

class GeminiProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "gemini-1.5-flash"):
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(model)

    async def stream(self, messages, **kwargs):
        response = await self.model.generate_content_async(
            messages, stream=True, **kwargs
        )
        async for chunk in response:
            yield chunk.text
```

### 8.2 Intent Router 프롬프트

```python
# app/prompts/intent_router.py

INTENT_ROUTER_PROMPT = """
Role: 질문 분류 전문가 (산업 안전관리 도메인)

다음 사용자 입력을 분석하여 JSON으로만 출력하라.

출력 형식:
{{
  "detected_lang": "ko",
  "domain": "Customer_Support" | "Safety_Manual" | "General",
  "intent": "Query" | "Save" | "Both",
  "urgency": 1~5
}}

분류 규칙:
1. "저장해줘", "등록해줘", "기록해", "입력해줘" → intent = "Save"
2. "조회해줘", "알려줘", "찾아줘", "어떻게 돼?" → intent = "Query"
3. 저장과 조회 동시 요구 → intent = "Both"
4. 사고/부상/긴급 키워드 → urgency = 5
5. domain은 문맥으로 판단 (안전/SOP 관련 → Safety_Manual)

사용자 입력: {raw_query}

JSON 출력:
"""
```

### 8.3 계층적 RAG 합성 프롬프트

```python
# app/prompts/rag_synthesis.py

RAG_SYNTHESIS_PROMPT = """
Role: 산업 안전관리 전문 지식 분석가

[Context 1 - 테넌트 SOP 문서]
{sop_context}

[Context 2 - 공통 법령/매뉴얼]
{global_context}

지침:
1. 반드시 Context 1(SOP)에서 먼저 답을 찾아라.
2. Context 1이 없거나 불충분한 경우에만 Context 2(법령)를 참고하라.
3. 두 Context가 충돌 시 Context 1(테넌트 SOP)을 우선한다.
4. 답변 마지막에 출처를 명시하라: [출처: SOP] 또는 [출처: 법령]
5. 전문 용어는 사용자 언어 옆에 원문 병기: 예) 안전 장치(Safety Guard)
6. 답변 언어: {detected_lang}

사용자 질문: {raw_query}

답변:
"""
```

### 8.4 SaaS 파라미터 추출 프롬프트

```python
# app/prompts/saas_executor.py

SAAS_PARAM_EXTRACT_PROMPT = """
다음 사용자 입력에서 안전 점검 기록에 필요한 파라미터를 추출하여 JSON으로 출력하라.

추출 항목:
- status: 점검 결과 (정상/이상/수리필요/해당없음)
- category: 점검 분류 (안전점검/설비점검/화재예방/화학물질 등)
- location: 점검 위치 (언급 없으면 null)
- inspector: 점검자 이름 (언급 없으면 null)
- notes: 특이사항 (언급 없으면 null)
- inspection_date: 점검일자 (YYYY-MM-DD, 언급 없으면 오늘)

사용자 입력: {raw_query}

JSON 출력:
"""
```

---

## 9. Google STT 연동 설계

### 9.1 지원 오디오 포맷

| 포맷 | MIME | 최대 크기 |
|------|------|---------|
| WAV (LINEAR16) | audio/wav | 10MB |
| MP3 | audio/mpeg | 10MB |
| WebM (Opus) | audio/webm | 10MB |
| OGG (Opus) | audio/ogg | 10MB |
| FLAC | audio/flac | 10MB |

### 9.2 Google STT 설정

```python
# app/services/stt/google_stt.py
from google.cloud import speech_v2

class GoogleSTTService:
    def __init__(self, project_id: str, credentials_path: str):
        self.client = speech_v2.SpeechAsyncClient.from_service_account_file(
            credentials_path
        )
        self.project_id = project_id

    async def transcribe(
        self,
        audio_bytes: bytes,
        language_code: str = "ko-KR",
        mime_type: str = "audio/wav"
    ) -> dict:
        config = speech_v2.RecognitionConfig(
            auto_decoding_config=speech_v2.AutoDetectDecodingConfig(),
            language_codes=[language_code, "en-US"],   # 다국어 지원
            model="long",
            features=speech_v2.RecognitionFeatures(
                enable_automatic_punctuation=True,
                enable_word_confidence=True,
            )
        )
        request = speech_v2.RecognizeRequest(
            recognizer=f"projects/{self.project_id}/locations/global/recognizers/_",
            config=config,
            content=audio_bytes,
        )
        response = await self.client.recognize(request=request)
        result = response.results[0]
        alternative = result.alternatives[0]
        return {
            "transcript": alternative.transcript,
            "confidence": alternative.confidence,
            "detected_language": result.language_code,
        }
```

### 9.3 STT → 에이전트 연동 흐름

```
POST /api/v1/chat/stream (input_type: "audio", audio_data: base64)
  ↓
Input_Processor 노드
  ↓ GoogleSTTService.transcribe()
  raw_query 업데이트
  ↓
Intent_Router 노드 (이후 동일 흐름)
```

> **선택**: 별도 `/api/v1/stt/transcribe` 엔드포인트도 제공하여  
> 프론트엔드에서 STT 결과를 텍스트로 받아 별도 채팅 요청을 보낼 수 있게 함

---

## 10. SSE 스트리밍 프로토콜

### 10.1 SSE 이벤트 타입 정의

| event | 역할 | data 구조 |
|-------|------|---------|
| `status` | 상태 안내 메시지 | `{"text": string}` |
| `reasoning` | CoT 추론 단계 | `{"step": string, "index": number}` |
| `token` | 텍스트 토큰 스트리밍 | `{"text": string}` |
| `sources` | RAG 출처 목록 | `{"sources": Source[]}` |
| `a2ui` | A2UI 봉투 | A2UI Envelope object |
| `action` | SaaS 실행 결과 | `{"status": "ok"|"error", "message": string}` |
| `error` | 에러 | `{"code": string, "message": string}` |
| `done` | 스트림 종료 | `{"session_id": string}` |

### 10.2 FastAPI SSE 구현 패턴

```python
# app/api/v1/chat.py
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.agents.graph import build_agent_graph
import json

router = APIRouter()

@router.post("/chat/stream")
async def chat_stream(request: ChatRequest, tenant: TenantInfo = Depends(get_tenant)):
    async def event_generator():
        async def sse(event: str, data: dict):
            yield f"data: {json.dumps({'event': event, 'data': data}, ensure_ascii=False)}\n\n"

        graph = build_agent_graph()
        state = AgentState(
            tenant_id=tenant.tenant_id,
            input_type=request.input_type,
            raw_input=request.query,
            stream_callback=sse,
            ...
        )
        async for chunk in graph.astream(state):
            # graph 내부에서 stream_callback 호출
            # chunk는 노드 완료 이벤트 → SSE는 노드 내부에서 직접 yield
            pass

        yield f"data: {json.dumps({'event': 'done', 'data': {'session_id': request.session_id}})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        }
    )
```

---

## 11. A2UI 봉투 생성 로직

Final_Responder 노드가 완료된 후, 응답 내용에 따라 A2UI 봉투를 선택적으로 생성합니다.

### 11.1 A2UI 봉투 생성 조건

| 조건 | 생성되는 A2UI 서피스 |
|------|-------------------|
| intent == "Save" 성공 | 저장 결과 확인 카드 |
| domain == "Safety_Manual" + urgency >= 4 | 인시던트 보고 폼 |
| 위험성평가 관련 질문 | 위험성평가 DataTable |
| 기타 조회 응답 | A2UI 없음 (텍스트만) |

### 11.2 SSE A2UI 이벤트 순서

```
data: {"event": "a2ui", "data": {"createSurface": {...}}}
(300ms delay)
data: {"event": "a2ui", "data": {"updateComponents": {...}}}
(300ms delay)
data: {"event": "a2ui", "data": {"updateDataModel": {...}}}
```

### 11.3 봉투 생성 유틸리티

```python
# app/utils/streaming.py

def build_incident_surface(severity: str = "P2", service: str = "") -> list[dict]:
    """인시던트 보고 폼 A2UI 봉투 3개 반환"""
    return [
        {"createSurface": {"surfaceId": "incident_form", ...}},
        {"updateComponents": {"components": [...]}},
        {"updateDataModel": {"path": "/incident", "value": {
            "severity": severity,
            "service": service,
            "summary": "",
            "customerImpact": False
        }}}
    ]
```

---

## 12. 멀티 테넌트 인증 설계

### 12.1 JWT 페이로드

```json
{
  "sub": "tenant_abc",
  "tenant_id": "tenant_abc",
  "tenant_name": "ABC 산업",
  "plan": "pro",
  "iat": 1718000000,
  "exp": 1718086400
}
```

### 12.2 미들웨어 동작

```
요청 헤더: Authorization: Bearer <token>
  ↓
JWTMiddleware
  - 토큰 검증
  - tenant_id 추출
  - request.state.tenant_id 설정
  ↓
각 API 핸들러에서 tenant_id 사용
  ↓
ChromaDB 쿼리: where={"tenant_id": request.state.tenant_id}
```

### 12.3 개발 환경 인증 우회

```python
# .env
DEV_MODE=true
DEV_TENANT_ID=dev_tenant
```

`DEV_MODE=true` 시 JWT 검증 생략, `DEV_TENANT_ID` 고정 사용

---

## 13. 환경 변수 및 설정

### 13.1 .env.example

```bash
# ─── LLM ───────────────────────────────────────
GEMINI_API_KEY=AIzaSy...
GEMINI_CHAT_MODEL=gemini-1.5-flash
GEMINI_PRO_MODEL=gemini-1.5-pro
GEMINI_EMBEDDING_MODEL=models/text-embedding-004

# Ollama (향후 전환 시)
# LLM_PROVIDER=ollama
# OLLAMA_BASE_URL=http://localhost:11434
# OLLAMA_MODEL=llama3

# ─── Google STT ────────────────────────────────
GOOGLE_APPLICATION_CREDENTIALS=/app/credentials/gcp-key.json
GOOGLE_CLOUD_PROJECT_ID=your-project-id
STT_DEFAULT_LANGUAGE=ko-KR

# ─── ChromaDB ──────────────────────────────────
CHROMA_MODE=server                  # server | local
CHROMA_HOST=chromadb
CHROMA_PORT=8000
CHROMA_COLLECTION_SOP=tenant_sop
CHROMA_COLLECTION_LAW=global_law

# ─── Auth ──────────────────────────────────────
JWT_SECRET_KEY=your-super-secret-key
JWT_ALGORITHM=HS256
JWT_EXPIRE_HOURS=24

# ─── Server ────────────────────────────────────
HOST=0.0.0.0
PORT=8080
CORS_ORIGINS=http://localhost:3000,https://your-domain.com
LOG_LEVEL=INFO

# ─── SaaS API ──────────────────────────────────
SAAS_API_BASE_URL=https://api.yoursaas.com
SAAS_API_KEY=sk-saas-...

# ─── Dev ───────────────────────────────────────
DEV_MODE=false
DEV_TENANT_ID=dev_tenant
```

### 13.2 pydantic-settings 모델

```python
# app/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    gemini_api_key: str
    gemini_chat_model: str = "gemini-1.5-flash"
    gemini_embedding_model: str = "models/text-embedding-004"

    google_cloud_project_id: str
    google_application_credentials: str
    stt_default_language: str = "ko-KR"

    chroma_mode: str = "server"
    chroma_host: str = "chromadb"
    chroma_port: int = 8000
    chroma_collection_sop: str = "tenant_sop"
    chroma_collection_law: str = "global_law"

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 24

    cors_origins: list[str] = ["http://localhost:3000"]
    log_level: str = "INFO"

    dev_mode: bool = False
    dev_tenant_id: str = "dev_tenant"

    class Config:
        env_file = ".env"
```

---

## 14. 개발 단계 로드맵

### Phase 2-A: 기반 구조 (1~2주)

- [ ] FastAPI 프로젝트 초기화 (폴더 구조, 의존성)
- [ ] LLM Provider 추상화 + Gemini 구현체
- [ ] ChromaDB 연결 + 컬렉션 생성 + 임베딩 유틸리티
- [ ] JWT 인증 미들웨어
- [ ] `GET /api/v1/health` 헬스체크 엔드포인트

### Phase 2-B: 문서 인덱싱 (1주)

- [ ] `POST /api/v1/documents/ingest` — PDF/DOCX/TXT 파싱 + 청킹 + ChromaDB 저장
- [ ] `GET /api/v1/documents/list` — 테넌트 문서 목록
- [ ] `scripts/ingest_sample.py` — 샘플 SOP/법령 문서 일괄 인덱싱 CLI
- [ ] 테넌트 격리 검증 테스트

### Phase 2-C: LangGraph 에이전트 (2주)

- [ ] `AgentState` TypedDict 정의
- [ ] 6개 노드 구현 (Input_Processor → Final_Responder)
- [ ] 조건 분기 엣지 (SOP score 기반 Fallback, Intent 기반 분기)
- [ ] 각 노드 단위 테스트

### Phase 2-D: STT + 스트리밍 (1주)

- [ ] Google STT 서비스 구현 + `POST /api/v1/stt/transcribe`
- [ ] SSE 이벤트 포맷터 구현
- [ ] `POST /api/v1/chat/stream` — 전체 스트리밍 파이프라인 연결
- [ ] 프론트엔드 연동 테스트 (Next.js useChat.ts 수정)

### Phase 2-E: A2UI + SaaS 연동 (1주)

- [ ] A2UI 봉투 빌더 (`app/utils/streaming.py`)
- [ ] `SaaS_Executor` 노드 — 파라미터 추출 + API 호출
- [ ] 위험성평가 DataTable 봉투 서버 측 생성
- [ ] 엔드투엔드 시나리오 4개 검증

---

## 15. 비기능 요구사항

### 성능

| 항목 | 목표값 |
|------|-------|
| TTF(Time to First Token) | < 2초 (텍스트 입력) |
| TTF (음성 입력) | < 4초 (STT 1.5초 + LLM 2초) |
| ChromaDB 검색 p99 | < 200ms |
| 동시 세션 처리 | ≥ 50 세션 (단일 서버) |

### 보안

- 모든 ChromaDB 쿼리에 `tenant_id` 필터 강제 — 테넌트 데이터 격리 필수
- JWT 만료 시간 24시간, Refresh Token 별도 관리
- 오디오 파일 서버 미보관 — 처리 후 즉시 메모리에서 제거
- API 키는 .env + 서버 환경 변수로만 관리, 코드에 하드코딩 금지

### LLM 교체 가능성

`LLMProvider` 추상 클래스를 통해 **Gemini → Ollama 교체 시 노드 코드 수정 없이** `config.LLM_PROVIDER` 값만 변경으로 전환 가능하도록 설계

### Docker 구성

```yaml
# docker-compose.yml
services:
  api:
    build: .
    ports: ["8080:8080"]
    env_file: .env
    depends_on: [chromadb]
    volumes:
      - ./credentials:/app/credentials:ro

  chromadb:
    image: chromadb/chroma:latest
    ports: ["8000:8000"]
    volumes:
      - chroma_data:/chroma/chroma

volumes:
  chroma_data:
```

---

## 관련 문서

- [설계서 원본](../SAFETYSAAS-02.%20%5B설계서%5D%20멀티%20테넌트%20지능형%20에이전트%20시스템%20(LangGraph%20기반).pdf)
- [Phase 1 프론트엔드 구현 내역](./phase1-implementation.md)
- [A2UI v0.9 인터페이스 스펙](./a2ui-spec.md)
