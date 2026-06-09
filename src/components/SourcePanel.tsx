"use client";
import { useRef, useEffect } from "react";
import { BookOpen, X, ExternalLink, GitBranch, FileText, Braces, BarChart2 } from "lucide-react";
import type { Source } from "@/types";

const SRC_ICON: Record<string, React.ReactNode> = {
  GitBranch: <GitBranch size={12} />,
  FileText: <FileText size={12} />,
  Braces: <Braces size={12} />,
  BarChart2: <BarChart2 size={12} />,
};

const TYPE_LABEL: Record<string, string> = {
  code: "소스 코드", doc: "문서", api: "API 명세", log: "로그", chart: "대시보드",
};

interface Props {
  open: boolean;
  sources: Source[] | null;
  focusId: number | null;
  onClose: () => void;
}

export default function SourcePanel({ open, sources, focusId, onClose }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && focusId != null && scrollRef.current) {
      const el = scrollRef.current.querySelector<HTMLElement>(`[data-src="${focusId}"]`);
      if (el) {
        scrollRef.current.scrollTop = el.offsetTop - 12;
        el.classList.remove("flash");
        void el.offsetWidth;
        el.classList.add("flash");
      }
    }
  }, [open, focusId, sources]);

  return (
    <>
      <div className={"scrim" + (open ? " show" : "")} onClick={onClose} />
      <aside className={"src-panel" + (open ? " open" : "")}>
        <div className="sp-header">
          <BookOpen size={18} style={{ color: "var(--accent)" }} />
          <div style={{ flex: 1 }}>
            <div className="sph-title">참고한 자료</div>
            <div className="sph-sub">RAG가 인용한 사내 출처 {sources?.length ?? 0}건</div>
          </div>
          <button className="icon-btn" onClick={onClose} title="닫기"><X size={18} /></button>
        </div>
        <div className="sp-scroll" ref={scrollRef}>
          {(sources ?? []).map((s) => (
            <div className="src-detail" key={s.id} data-src={s.id}>
              <div className="sd-top">
                <span className="sd-num">{s.id}</span>
                <div className="sd-head">
                  <div className="sd-type">
                    {SRC_ICON[s.icon] ?? <FileText size={12} />} {TYPE_LABEL[s.type] ?? s.type}
                  </div>
                  <div className="sd-title">{s.title}</div>
                  <div className="sd-path">{s.path}</div>
                </div>
              </div>
              {(s.type === "doc" || s.type === "chart") ? (
                <div className="sd-snippet doc">{s.snippet}</div>
              ) : (
                <div className="sd-snippet">
                  <pre><code>{s.snippet}</code></pre>
                </div>
              )}
              <a className="sd-link" href={s.url} target="_blank" rel="noreferrer">
                <ExternalLink size={14} /> {s.urlLabel || "원문 열기"}
              </a>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
