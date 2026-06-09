"use client";
import { useMemo } from "react";
import { marked, Renderer } from "marked";
import hljs from "highlight.js";
import DOMPurify from "dompurify";

interface Props {
  md: string;
  streaming?: boolean;
  activeCite?: number | null;
  onCite?: (n: number) => void;
}

// highlight.js: 자동 감지 or 지정 언어로 코드 하이라이팅
function highlight(code: string, lang?: string): string {
  if (lang && hljs.getLanguage(lang)) {
    try {
      return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
    } catch {}
  }
  // 언어 미지정 시 자동 감지 (신뢰도 낮으면 그냥 escape)
  try {
    const result = hljs.highlightAuto(code, [
      "java", "yaml", "json", "typescript", "javascript",
      "python", "bash", "sql", "xml", "plaintext",
    ]);
    if (result.relevance > 5) return result.value;
  } catch {}
  // fallback: HTML 이스케이프만
  return code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// 코드블록 렌더러 — highlight.js 적용
function buildRenderer(): Renderer {
  const renderer = new Renderer();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (renderer as any).code = ({ text, lang }: { text: string; lang?: string }) => {
    const highlighted = highlight(text, lang);
    const langLabel = lang || "text";
    return `<div class="codeblock">
  <div class="cb-head">
    <span class="cb-lang">${langLabel}</span>
    <button class="cb-copy" data-code="${encodeURIComponent(text)}">
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
      복사
    </button>
  </div>
  <pre><code class="hljs">${highlighted}</code></pre>
</div>`;
  };

  return renderer;
}

// [N] → 클릭 가능한 인용 칩 (HTML 태그 내부 속성값은 건드리지 않음)
function injectCitations(html: string, activeCite?: number | null): string {
  // 태그 밖의 텍스트에서만 [숫자] 치환
  return html.replace(/(<[^>]+>)|(\[\d+\])/g, (match, tag, cite) => {
    if (tag) return tag; // HTML 태그는 그대로
    const n = cite.slice(1, -1);
    const active = activeCite === parseInt(n, 10) ? " active" : "";
    return `<span class="cite${active}" data-cite="${n}">${n}</span>`;
  });
}

// DOMPurify 설정: 마크다운 렌더링 결과에 필요한 태그/속성만 허용
const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    "p", "br", "strong", "em", "del", "code", "pre",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "blockquote", "hr",
    "table", "thead", "tbody", "tr", "th", "td",
    "a", "div", "span", "button", "svg", "path", "rect",
  ],
  ALLOWED_ATTR: [
    "class", "href", "target", "rel", "data-code", "data-cite",
    "xmlns", "width", "height", "viewBox", "fill", "stroke",
    "stroke-width", "stroke-linecap", "stroke-linejoin", "d", "x", "y", "rx", "ry",
  ],
  ALLOW_DATA_ATTR: false,
  // data-code, data-cite 는 직접 허용했으므로 ALLOW_DATA_ATTR false 여도 작동
  FORCE_BODY: false,
};

// 복사 버튼 이벤트 — 문서 레벨에서 한 번만 등록
if (typeof document !== "undefined") {
  document.addEventListener("click", (e) => {
    const btn = (e.target as Element).closest?.(".cb-copy") as HTMLElement | null;
    if (!btn) return;
    const code = decodeURIComponent(btn.dataset.code || "");
    navigator.clipboard?.writeText(code).catch(() => {});
    btn.classList.add("copied");
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> 복사됨`;
    setTimeout(() => {
      btn.classList.remove("copied");
      btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg> 복사`;
    }, 1500);
  });
}

export default function Prose({ md, streaming, activeCite, onCite }: Props) {
  const html = useMemo(() => {
    const renderer = buildRenderer();
    const raw = marked(md, { renderer, gfm: true, breaks: false }) as string;
    const withCites = injectCitations(raw, activeCite);
    // DOMPurify는 브라우저 환경에서만 동작 (SSR에서는 bypass)
    if (typeof window === "undefined") return withCites;
    return DOMPurify.sanitize(withCites, PURIFY_CONFIG) as string;
  }, [md, activeCite]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = (e.target as Element).closest?.("[data-cite]") as HTMLElement | null;
    if (el && onCite) {
      onCite(parseInt(el.dataset.cite!, 10));
    }
  };

  return (
    <div className="prose" onClick={handleClick}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
      {streaming && <span className="caret" />}
    </div>
  );
}
