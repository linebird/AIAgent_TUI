"use client";
import { useRef, useCallback, useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import EmptyState from "@/components/EmptyState";
import UserMessage from "@/components/UserMessage";
import BotMessage from "@/components/BotMessage";
import Composer from "@/components/Composer";
import SourcePanel from "@/components/SourcePanel";
import { useChat } from "@/hooks/useChat";
import { useTheme } from "@/hooks/useTheme";
import type { Source } from "@/types";
import type { A2UIActionPayload } from "@/lib/a2ui-data";

export default function Home() {
  const chat = useChat();
  const { theme, toggle: toggleTheme } = useTheme();

  const [sbOpen, setSbOpen] = useState(false);
  const [sbCollapsed, setSbCollapsed] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [panel, setPanel] = useState<{ open: boolean; sources: Source[] | null; focusId: number | null }>({
    open: false, sources: null, focusId: null,
  });
  const [activeCite, setActiveCite] = useState<number | null>(null);

  const threadRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight });
  }, []);

  // wire scrollCb so the streaming engine can scroll during token emission
  useEffect(() => {
    chat.scrollCb.current = () => {
      if (chat.autoStick.current) scrollToBottom();
    };
  }, [chat.scrollCb, chat.autoStick, scrollToBottom]);

  // auto-scroll when messages change
  useEffect(() => {
    if (chat.autoStick.current) scrollToBottom();
  }, [chat.messages, scrollToBottom, chat.autoStick]);

  const onThreadScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setScrolled(el.scrollTop > 8);
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    chat.autoStick.current = dist < 120;
  }, [chat.autoStick]);

  const openSources = useCallback((sources: Source[], focusId: number) => {
    setPanel({ open: true, sources, focusId });
    setActiveCite(focusId);
  }, []);

  const onCite = useCallback((n: number) => {
    const lastBot = [...chat.messages].reverse().find((m) => m.role === "bot" && m.sources);
    if (lastBot?.sources) openSources(lastBot.sources, n);
  }, [chat.messages, openSources]);

  const onOpenSources = useCallback((focusId: number) => {
    const lastBot = [...chat.messages].reverse().find((m) => m.role === "bot" && m.sources);
    if (lastBot?.sources) openSources(lastBot.sources, focusId);
  }, [chat.messages, openSources]);

  const closePanel = useCallback(() => {
    setPanel((p) => ({ ...p, open: false }));
    setActiveCite(null);
  }, []);

  const handleNewChat = () => {
    chat.newChat();
    setSbOpen(false);
    closePanel();
  };

  const handleSelect = (id: string) => {
    chat.selectSession(id);
    setSbOpen(false);
    closePanel();
  };

  const handleSend = (text: string, files: { name: string; size: string; icon: string }[]) => {
    chat.send(text, files);
    setSbOpen(false);
  };

  const appClass = [
    "app",
    sbOpen ? "sb-open" : "",
    sbCollapsed ? "sb-collapsed" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={appClass}>
      <div className="sb-scrim" onClick={() => setSbOpen(false)} />

      <Sidebar
        sessions={chat.sessions}
        activeId={chat.activeId}
        onSelect={handleSelect}
        onNew={handleNewChat}
        onDelete={chat.deleteSession}
      />

      <div className="main">
        <Topbar
          scrolled={scrolled}
          theme={theme}
          onToggleTheme={toggleTheme}
          onNewChat={handleNewChat}
          onToggleSidebar={() => setSbCollapsed((v) => !v)}
          onOpenMobileSidebar={() => setSbOpen(true)}
        />

        <div className="thread" ref={threadRef} onScroll={onThreadScroll}>
          {chat.messages.length === 0 ? (
            <EmptyState onPick={(t) => handleSend(t, [])} />
          ) : (
            <div className="thread-inner">
              {chat.messages.map((m) =>
                m.role === "user" ? (
                  <UserMessage key={m.id} msg={m} />
                ) : (
                  <BotMessage
                    key={m.id}
                    msg={m}
                    activeCite={activeCite}
                    onCite={onCite}
                    onOpenSources={onOpenSources}
                    onRegenerate={chat.regenerate}
                    onFeedback={chat.feedback}
                    onA2UIData={chat.onA2UIData}
                    onA2UIAction={(p) => chat.onA2UIAction(p as A2UIActionPayload)}
                  />
                )
              )}
            </div>
          )}
        </div>

        <Composer onSend={handleSend} busy={chat.busy} onStop={chat.stop} />
      </div>

      <SourcePanel
        open={panel.open}
        sources={panel.sources}
        focusId={panel.focusId}
        onClose={closePanel}
      />
    </div>
  );
}
