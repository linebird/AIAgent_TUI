"use client";
import { LogIn, Menu, PanelLeft, Pencil, Moon, Sun, Volume2, VolumeX } from "lucide-react";

interface Props {
  scrolled: boolean;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onNewChat: () => void;
  onToggleSidebar: () => void;
  onOpenMobileSidebar: () => void;
  onOpenLogin: () => void;
  ttsEnabled: boolean;
  onToggleTts: () => void;
}

export default function Topbar({ scrolled, theme, onToggleTheme, onNewChat, onToggleSidebar, onOpenMobileSidebar, onOpenLogin, ttsEnabled, onToggleTts }: Props) {
  return (
    <div className={"topbar" + (scrolled ? " scrolled" : "")}>
      <button className="icon-btn only-mobile" onClick={onOpenMobileSidebar} title="메뉴">
        <Menu size={20} />
      </button>
      <button
        className="icon-btn only-desktop"
        onClick={onToggleSidebar}
        title="사이드바 접기"
      >
        <PanelLeft size={19} />
      </button>
      <div className="model-chip">
        <span className="dot" />
        Saferyn-LLM
        <span className="mc-sub">v2 · RAG</span>
      </div>
      <div className="spacer" />
      <button className="icon-btn" onClick={onNewChat} title="새 대화">
        <Pencil size={19} />
      </button>
      <button className="icon-btn" onClick={onOpenLogin} title="로그인">
        <LogIn size={19} />
      </button>
      <button className="icon-btn" onClick={onToggleTts} title={ttsEnabled ? "답변 음성 끄기" : "답변 음성 켜기"}>
        {ttsEnabled ? <Volume2 size={19} /> : <VolumeX size={19} />}
      </button>
      <button className="icon-btn" onClick={onToggleTheme} title="테마 전환">
        {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
      </button>
    </div>
  );
}
