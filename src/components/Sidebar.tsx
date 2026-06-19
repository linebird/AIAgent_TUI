"use client";
import { Pencil, Trash2, Sparkles, Settings } from "lucide-react";
import type { Session } from "@/types";
import { groupSessions } from "@/lib/utils";

interface Props {
  sessions: Session[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

function Group({ label, items, activeId, onSelect, onDelete }: {
  label: string; items: Session[]; activeId: string | null;
  onSelect: (id: string) => void; onDelete: (id: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div>
      <div className="sb-group-label">{label}</div>
      {items.map((s) => (
        <div
          key={s.id}
          className={"hist-item" + (s.id === activeId ? " active" : "")}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(s.id)}
          onKeyDown={(e) => { if (e.key === "Enter") onSelect(s.id); }}
        >
          <Sparkles size={15} style={{ opacity: s.id === activeId ? 1 : 0.45, flex: "none" }} />
          <span className="hi-title">{s.title}</span>
          <button
            className="hi-del"
            title="삭제"
            onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function Sidebar({ sessions, activeId, onSelect, onNew, onDelete }: Props) {
  const g = groupSessions(sessions);
  return (
    <aside className="sidebar">
      <div className="sb-inner">
        <div className="sb-top">
          <div className="brand">
            <div className="brand-mark" />
            <div>
              <div className="brand-name">Saferyn<b>Chat</b></div>
              <div className="brand-sub">AI Agent · 사내 운영 도우미</div>
            </div>
          </div>
          <button className="new-chat" onClick={onNew}>
            <Pencil size={17} />
            새 대화 시작
          </button>
        </div>

        <div className="sb-scroll">
          {sessions.length === 0 ? (
            <div style={{ padding: "16px 12px", color: "var(--text-faint)", fontSize: 13, lineHeight: 1.6 }}>
              아직 대화가 없어요.<br />새 대화를 시작해 보세요.
            </div>
          ) : (
            <>
              <Group label="오늘" items={g.today} activeId={activeId} onSelect={onSelect} onDelete={onDelete} />
              <Group label="지난 7일" items={g.week} activeId={activeId} onSelect={onSelect} onDelete={onDelete} />
              <Group label="이전" items={g.older} activeId={activeId} onSelect={onSelect} onDelete={onDelete} />
            </>
          )}
        </div>

        <div className="sb-foot">
          <div className="user-row">
            <div className="avatar">SE</div>
            <div className="user-meta">
              <div className="un">SRE 엔지니어</div>
              <div className="ue">platform@safetysaas.io</div>
            </div>
            <button className="icon-btn" style={{ width: 32, height: 32 }} title="설정">
              <Settings size={17} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
