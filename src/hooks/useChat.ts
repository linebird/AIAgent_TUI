"use client";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { Store, Message, Session, A2UISurfaceState } from "@/types";
import { uid, genTitle, sleep } from "@/lib/utils";
import { pickAnswer } from "@/lib/data";
import { a2ApplyEnvelope, a2SetImmutable } from "@/lib/a2ui";
import { a2uiActionReply, type A2UIActionPayload } from "@/lib/a2ui-data";

const LS_KEY = "safetysaas_agent_v1";

function loadState(): Store {
  if (typeof window === "undefined") return { sessions: [], activeId: null };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { sessions: [], activeId: null };
}

let RUN = 0;

export function useChat() {
  const [store, setStore] = useState<Store>(() => ({ sessions: [], activeId: null }));
  const autoStick = useRef(true);
  const scrollCb = useRef<(() => void) | null>(null);

  // hydrate from localStorage
  useEffect(() => {
    const s = loadState();
    // recover interrupted streams
    const sessions = s.sessions.map((sess) => ({
      ...sess,
      messages: sess.messages.map((m) =>
        m.role === "bot" && m.streaming
          ? m.text
            ? { ...m, streaming: false, phase: "done" as const }
            : { ...m, streaming: false, phase: "stopped" as const, text: "_이전 응답이 중단되었습니다. '다시 생성'을 눌러 주세요._" }
          : m
      ),
    }));
    setStore({ ...s, sessions });
  }, []);

  // persist
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(LS_KEY, JSON.stringify(store)); } catch {}
  }, [store]);

  const sessions = store.sessions;
  const activeId = store.activeId;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const active = useMemo(() => sessions.find((s) => s.id === activeId) ?? null, [sessions, activeId]);
  const messages = useMemo(() => active?.messages ?? [], [active]);

  const setMessages = useCallback((updater: (msgs: Message[]) => Message[]) => {
    setStore((st) => ({
      ...st,
      sessions: st.sessions.map((s) =>
        s.id !== st.activeId ? s : { ...s, messages: updater(s.messages), updatedAt: Date.now() }
      ),
    }));
  }, []);

  const patchMsg = useCallback((id: string, patch: Partial<Message> | ((m: Message) => Partial<Message>)) => {
    setMessages((msgs) =>
      msgs.map((m) => (m.id === id ? { ...m, ...(typeof patch === "function" ? patch(m) : patch) } : m))
    );
  }, [setMessages]);

  // ---- Core agent runner (supports both text-only and A2UI answers) ----
  const runAgent = useCallback(async (botId: string, userText: string) => {
    const myRun = ++RUN;
    const ans = pickAnswer(userText);
    const cancelled = () => myRun !== RUN;

    // Status phase
    for (let i = 0; i < ans.status.length; i++) {
      if (cancelled()) return;
      patchMsg(botId, { phase: "status", statusText: ans.status[i] });
      await sleep(620 + Math.random() * 280);
    }
    if (cancelled()) return;

    // CoT phase
    patchMsg(botId, { phase: "reasoning", cot: ans.cot, cotRevealed: 0 });
    for (let i = 0; i < ans.cot.length; i++) {
      if (cancelled()) return;
      patchMsg(botId, { cotRevealed: i + 1 });
      await sleep(560 + Math.random() * 320);
    }
    if (cancelled()) return;
    await sleep(280);

    // Answer text streaming
    patchMsg(botId, { phase: "answer", text: "" });
    const tokens = ans.md.match(/(\s+|[^\s]+)/g) ?? [ans.md];
    let acc = "";
    for (let i = 0; i < tokens.length; i++) {
      if (cancelled()) { patchMsg(botId, { streaming: false, stopped: true }); return; }
      acc += tokens[i];
      patchMsg(botId, { text: acc });
      scrollCb.current?.();
      const tk = tokens[i];
      let d = 14 + Math.random() * 22;
      if (/[.!?。]\s*$/.test(tk)) d += 120;
      if (/\n/.test(tk)) d += 40;
      await sleep(d);
    }
    if (cancelled()) return;

    // A2UI envelope streaming (if this is an A2UI answer)
    if (ans.a2ui && ans.a2ui.length > 0) {
      patchMsg(botId, { phase: "a2ui" });
      let surface: A2UISurfaceState | null = null;
      for (const env of ans.a2ui) {
        if (cancelled()) return;
        surface = a2ApplyEnvelope(surface, env);
        patchMsg(botId, { a2uiState: surface });
        await sleep(300 + Math.random() * 200);
      }
      if (cancelled()) return;
    }

    patchMsg(botId, { phase: "done", streaming: false, sources: ans.sources ?? [] });
    setStore((st) => ({ ...st })); // trigger persist
  }, [patchMsg]);

  // ---- Action runner (for A2UI button events) ----
  const runActionReply = useCallback(async (botId: string, action: A2UIActionPayload) => {
    const myRun = ++RUN;
    const cancelled = () => myRun !== RUN;
    const reply = a2uiActionReply(action);

    patchMsg(botId, { phase: "status", statusText: "요청을 처리하고 있어요…" });
    await sleep(500 + Math.random() * 300);
    if (cancelled()) return;

    // Stream answer text
    patchMsg(botId, { phase: "answer", text: "" });
    const tokens = reply.md.match(/(\s+|[^\s]+)/g) ?? [reply.md];
    let acc = "";
    for (const tk of tokens) {
      if (cancelled()) { patchMsg(botId, { streaming: false, stopped: true }); return; }
      acc += tk;
      patchMsg(botId, { text: acc });
      scrollCb.current?.();
      let d = 14 + Math.random() * 20;
      if (/[.!?]\s*$/.test(tk)) d += 100;
      await sleep(d);
    }
    if (cancelled()) return;

    // A2UI envelopes for action reply (e.g. generate_risk result)
    if (reply.a2ui && reply.a2ui.length > 0) {
      patchMsg(botId, { phase: "a2ui" });
      let surface: A2UISurfaceState | null = null;
      for (const env of reply.a2ui) {
        if (cancelled()) return;
        surface = a2ApplyEnvelope(surface, env);
        patchMsg(botId, { a2uiState: surface });
        await sleep(350 + Math.random() * 200);
      }
      if (cancelled()) return;
    }

    patchMsg(botId, { phase: "done", streaming: false });
    setStore((st) => ({ ...st }));
  }, [patchMsg]);

  const send = useCallback((text: string, files: { name: string; size: string; icon: string }[]) => {
    autoStick.current = true;
    const userMsg: Message = { id: uid(), role: "user", text, files };
    const botId = uid();
    const botMsg: Message = {
      id: botId, role: "bot", text: "", streaming: true,
      phase: "status", statusText: "요청을 받았어요", cot: [], cotRevealed: 0,
    };

    setStore((st) => {
      let { sessions, activeId } = st;
      if (!activeId || !sessions.find((s) => s.id === activeId)) {
        const ns: Session = { id: uid(), title: genTitle(text), createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
        sessions = [ns, ...sessions];
        activeId = ns.id;
      }
      sessions = sessions.map((s) => {
        if (s.id !== activeId) return s;
        const msgs = [...s.messages, userMsg, botMsg];
        const title = s.messages.length === 0 ? genTitle(text) : s.title;
        return { ...s, title, messages: msgs, updatedAt: Date.now() };
      });
      return { sessions, activeId };
    });

    setTimeout(() => runAgent(botId, text), 0);
  }, [runAgent]);

  // ---- A2UI callbacks ----

  // Update surface dataModel via user interaction (two-way binding)
  const onA2UIData = useCallback((msgId: string, path: string, value: unknown) => {
    setMessages((msgs) =>
      msgs.map((m) => {
        if (m.id !== msgId || !m.a2uiState) return m;
        const newModel = a2SetImmutable(m.a2uiState.dataModel, path, value);
        return { ...m, a2uiState: { ...m.a2uiState, dataModel: newModel } };
      })
    );
  }, [setMessages]);

  // Handle A2UI button action events → create a new bot reply message
  const onA2UIAction = useCallback((action: A2UIActionPayload) => {
    autoStick.current = true;
    const botId = uid();
    const botMsg: Message = {
      id: botId, role: "bot", text: "", streaming: true,
      phase: "status", statusText: "요청을 처리하고 있어요…", cot: [], cotRevealed: 0,
    };

    setStore((st) => {
      const sessions = st.sessions.map((s) => {
        if (s.id !== st.activeId) return s;
        return { ...s, messages: [...s.messages, botMsg], updatedAt: Date.now() };
      });
      return { ...st, sessions };
    });

    setTimeout(() => runActionReply(botId, action), 0);
  }, [runActionReply]);

  const stop = useCallback(() => {
    RUN++;
    setMessages((msgs) =>
      msgs.map((m) =>
        m.streaming
          ? { ...m, streaming: false, phase: m.text ? "done" : "stopped", text: m.text || "_응답이 중단되었습니다._", stopped: true }
          : m
      )
    );
  }, [setMessages]);

  const regenerate = useCallback((botMsgId: string) => {
    const idx = messages.findIndex((m) => m.id === botMsgId);
    if (idx < 1) return;
    const userText = messages[idx - 1].text;
    patchMsg(botMsgId, { text: "", streaming: true, phase: "status", statusText: "다시 생각하고 있어요", cot: [], cotRevealed: 0, sources: undefined, feedback: null, a2uiState: null });
    setTimeout(() => runAgent(botMsgId, userText), 0);
  }, [messages, patchMsg, runAgent]);

  const feedback = useCallback((id: string, kind: "up" | "down") => {
    patchMsg(id, (m) => ({ feedback: m.feedback === kind ? null : kind }));
  }, [patchMsg]);

  const newChat = useCallback(() => {
    RUN++;
    setStore((st) => ({ ...st, activeId: null }));
  }, []);

  const selectSession = useCallback((id: string) => {
    RUN++;
    setStore((st) => ({ ...st, activeId: id }));
  }, []);

  const deleteSession = useCallback((id: string) => {
    setStore((st) => ({
      sessions: st.sessions.filter((s) => s.id !== id),
      activeId: st.activeId === id ? null : st.activeId,
    }));
  }, []);

  const busy = messages.some((m) => m.streaming);

  return {
    sessions, activeId: store.activeId, messages, busy,
    send, stop, regenerate, feedback,
    newChat, selectSession, deleteSession,
    onA2UIData, onA2UIAction,
    autoStick, scrollCb,
  };
}
