"use client";
import {
  Shield, AlertTriangle, Braces, Code2, FileText, Layers,
  Zap, BookOpen, BrainCircuit, File,
} from "lucide-react";
import { SUGGESTIONS, CAPABILITIES } from "@/lib/data";

const ICON_MAP: Record<string, React.ReactNode> = {
  Shield: <Shield size={17} />,
  AlertTriangle: <AlertTriangle size={17} />,
  Braces: <Braces size={17} />,
  Code2: <Code2 size={17} />,
  FileText: <FileText size={17} />,
  Layers: <Layers size={17} />,
  Zap: <Zap size={13} />,
  BookOpen: <BookOpen size={13} />,
  BrainCircuit: <BrainCircuit size={13} />,
  File: <File size={13} />,
};

export default function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="empty">
      <div className="empty-hi">
        안녕하세요, <span className="grad">엔지니어님</span>
      </div>
      <div className="empty-sub">오늘은 어떤 서비스를 살펴볼까요? 세이플린 운영·개발에 대해 무엇이든 물어보세요.</div>

      <div className="suggest-grid">
        {SUGGESTIONS.map((s, i) => (
          <button key={i} className="suggest-card" onClick={() => onPick(s.text)}>
            <div className="sc-text">{s.text}</div>
            <div className="sc-ico">{ICON_MAP[s.icon]}</div>
          </button>
        ))}
      </div>

      <div className="empty-caps">
        {CAPABILITIES.map((c, i) => (
          <span key={i} className="cap-chip">
            {ICON_MAP[c.icon]} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}
