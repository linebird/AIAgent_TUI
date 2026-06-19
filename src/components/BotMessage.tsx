"use client";
import type { Message, Source } from "@/types";
import type { A2UIActionPayload } from "@/lib/a2ui-data";
import StatusLine from "./StatusLine";
import CoT from "./CoT";
import Prose from "./Prose";
import MsgActions from "./MsgActions";
import A2UISurface from "./A2UISurface";
import { GitBranch, FileText, Braces, BarChart2 } from "lucide-react";

const SRC_ICON: Record<string, React.ReactNode> = {
  GitBranch: <GitBranch size={14} />,
  FileText: <FileText size={14} />,
  Braces: <Braces size={14} />,
  BarChart2: <BarChart2 size={14} />,
};

function SourceSummary({ sources, onOpen }: { sources: Source[]; onOpen: (id: number) => void }) {
  if (!sources.length) return null;
  return (
    <div className="src-summary">
      <span className="ss-label">참고한 자료 {sources.length}건</span>
      {sources.map((s) => (
        <button key={s.id} className="src-pill" onClick={() => onOpen(s.id)}>
          <span className="sp-num">{s.id}</span>
          <span className="sp-ico">{SRC_ICON[s.icon] ?? <FileText size={14} />}</span>
          <span className="sp-title">{s.title}</span>
        </button>
      ))}
    </div>
  );
}

interface Props {
  msg: Message;
  activeCite: number | null;
  onCite: (n: number) => void;
  onOpenSources: (focusId: number) => void;
  onRegenerate: (id: string) => void;
  onFeedback: (id: string, kind: "up" | "down") => void;
  onA2UIData: (msgId: string, path: string, value: unknown) => void;
  onA2UIAction: (payload: A2UIActionPayload) => void;
}

export default function BotMessage({ msg, activeCite, onCite, onOpenSources, onRegenerate, onFeedback, onA2UIData, onA2UIAction }: Props) {
  const reasoning = msg.phase === "reasoning";
  const hasText = !!msg.text;

  return (
    <div className="msg msg-bot">
      <div className={"bot-ava" + (msg.streaming ? " thinking" : "")} />
      <div className="bot-body">
        <div className="bot-name">Saferyn AI Agent</div>

        {msg.phase === "status" && <StatusLine text={msg.statusText ?? "처리 중…"} />}

        {msg.cot && msg.cot.length > 0 && (msg.phase === "reasoning" || hasText) && (
          <CoT
            steps={msg.cot}
            revealed={msg.cotRevealed ?? msg.cot.length}
            reasoning={reasoning}
          />
        )}

        {hasText && (
          <Prose
            md={msg.text}
            activeCite={activeCite}
            onCite={onCite}
            streaming={msg.streaming && msg.phase === "answer"}
          />
        )}

        {msg.a2uiState && (
          <A2UISurface
            surface={msg.a2uiState}
            msgId={msg.id}
            onData={onA2UIData}
            onAction={onA2UIAction}
          />
        )}

        {!msg.streaming && msg.sources && msg.sources.length > 0 && (
          <SourceSummary sources={msg.sources} onOpen={onOpenSources} />
        )}

        {!msg.streaming && hasText && (
          <MsgActions msg={msg} onRegenerate={onRegenerate} onFeedback={onFeedback} />
        )}
      </div>
    </div>
  );
}
