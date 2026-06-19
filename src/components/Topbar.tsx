"use client";
import { Menu, PanelLeft, Pencil, Moon, Sun } from "lucide-react";

interface Props {
  scrolled: boolean;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onNewChat: () => void;
  onToggleSidebar: () => void;
  onOpenMobileSidebar: () => void;
}

export default function Topbar({ scrolled, theme, onToggleTheme, onNewChat, onToggleSidebar, onOpenMobileSidebar }: Props) {
  return (
    <div className={"topbar" + (scrolled ? " scrolled" : "")}>
      <button className="icon-btn only-mobile" onClick={onOpenMobileSidebar} title="메뉴">
        <Menu size={20} />
      </button>
      <button
        className="icon-btn"
        onClick={onToggleSidebar}
        title="사이드바 접기"
        style={{ display: "grid" }}
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
      <button className="icon-btn" onClick={onToggleTheme} title="테마 전환">
        {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
      </button>
    </div>
  );
}
