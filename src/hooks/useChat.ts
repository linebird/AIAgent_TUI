"use client";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { Store, Message, Session, A2UISurfaceState } from "@/types";
import { uid, genTitle, sleep } from "@/lib/utils";
// import { pickAnswer } from "@/lib/data";
import { a2ApplyEnvelope, a2JsonToEnvelope, a2SetImmutable } from "@/lib/a2ui";
import { a2uiActionReply, type A2UIActionPayload } from "@/lib/a2ui-data";
import { API_ENDPOINTS } from "@/config/api";
import { STORAGE_KEYS } from "@/config/storage";
import { authFetch } from "@/lib/api-client";

const LS_KEY = STORAGE_KEYS.chatStore;

type A2UIActionPayloadWithFiles = A2UIActionPayload & { files?: File[] };

function parseSseFrames(buffer: string): { frames: Array<{ event: string; data: unknown }>; remainder: string } {
  const parts = buffer.split("\n\n");
  const remainder = parts.pop() ?? "";
  const frames: Array<{ event: string; data: unknown }> = [];

  for (const block of parts) {
    const lines = block.split("\n");
    let event = "message";
    const dataLines: string[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith(":")) continue;
      if (line.startsWith("event:")) {
        event = line.slice(6).trim() || "message";
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      }
    }

    if (!dataLines.length) continue;

    const raw = dataLines.join("\n").trim();
    let data: unknown = raw;
    if (raw) {
      try { data = JSON.parse(raw); } catch {}
    }

    frames.push({ event, data });
  }

  return { frames, remainder };
}

function parseJsonText(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const jsonText = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

function extractTextPayload(payload: unknown): string | null {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return null;

  const obj = payload as Record<string, unknown>;
  for (const key of ["text", "content", "delta", "answer"]) {
    if (typeof obj[key] === "string") return obj[key] as string;
  }

  for (const key of ["data", "message"]) {
    const nested = extractTextPayload(obj[key]);
    if (nested !== null) return nested;
  }

  return null;
}

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
  const runAgent = useCallback(async (sessionId: string, botId: string, userText: string) => {
    const myRun = ++RUN;
    const cancelled = () => myRun !== RUN;

    try {
      patchMsg(botId, { phase: "status", statusText: "요청을 처리하고 있어요…" });

      const res = await authFetch(API_ENDPOINTS.chatStream, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: sessionId,
          message: userText,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      if (!res.body) {
        throw new Error("ReadableStream is not supported.");
      }

      if (cancelled()) return;

      patchMsg(botId, { phase: "answer", text: "" });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      let sseBuffer = "";

      const applyIncomingPayload = (payload: unknown) => {
        if (!payload || typeof payload !== "object") return false;

        const obj = payload as Record<string, unknown>;
        const isEnvelope = !!(obj.createSurface || obj.updateComponents || obj.updateDataModel || obj.deleteSurface);

        if (isEnvelope) {
          patchMsg(botId, (m) => {
            const current = m.a2uiState ?? null;
            const next = a2ApplyEnvelope(current, payload as Record<string, unknown>);
            return { ...m, phase: "a2ui", a2uiState: next };
          });
          return true;
        }

        const jsonEnvelope = a2JsonToEnvelope(payload);
        if (jsonEnvelope) {
          patchMsg(botId, (m) => {
            let current = m.a2uiState ?? null;
            for (const env of jsonEnvelope) {
              current = a2ApplyEnvelope(current, env);
            }
            return { ...m, phase: "a2ui", a2uiState: current };
          });
          return true;
        }

        if (obj.event === "a2ui" && obj.data && typeof obj.data === "object") {
          return applyIncomingPayload(obj.data);
        }

        if (obj.type === "a2ui" && obj.data && typeof obj.data === "object") {
          return applyIncomingPayload(obj.data);
        }

        if (obj.data && typeof obj.data === "object") {
          return applyIncomingPayload(obj.data);
        }

        return false;
      };

      const applyJsonTextAsA2UI = (raw: string) => {
        const parsed = parseJsonText(raw);
        if (!parsed) return false;
        if (!applyIncomingPayload(parsed)) return false;
        acc = "";
        patchMsg(botId, { text: "" });
        return true;
      };

      while (true) {
        if (cancelled()) {
          await reader.cancel();
          patchMsg(botId, { streaming: false, stopped: true });
          return;
        }

        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        sseBuffer += chunk;
        const { frames, remainder } = parseSseFrames(sseBuffer);
        sseBuffer = remainder;

        let textDelta = "";
        for (const frame of frames) {
          const { event, data } = frame;
          const lowered = event.toLowerCase();

          if (lowered === "a2ui" || lowered === "ui") {
            applyIncomingPayload(data);
            continue;
          }

          if (lowered === "done" || lowered === "end") {
            continue;
          }

          const extractedText = extractTextPayload(data);
          if (extractedText !== null) {
            textDelta += extractedText;
          } else if (data && typeof data === "object") {
            if (applyIncomingPayload(data)) {
              continue;
            }
            textDelta += JSON.stringify(data);
          }
        }

        if (textDelta) {
          acc += textDelta;
          patchMsg(botId, { text: acc });
          scrollCb.current?.();
        }
      }

      const tail = decoder.decode();
      if (tail) {
        sseBuffer += tail;
      }

      if (sseBuffer.trim()) {
        const { frames } = parseSseFrames(sseBuffer + "\n\n");
        let textDelta = "";
        for (const frame of frames) {
          const { event, data } = frame;
          const lowered = event.toLowerCase();
          if (lowered === "a2ui" || lowered === "ui") {
            applyIncomingPayload(data);
            continue;
          }
          if (lowered === "done" || lowered === "end") continue;
          const extractedText = extractTextPayload(data);
          if (extractedText !== null) {
            textDelta += extractedText;
          } else if (data && typeof data === "object") {
            if (applyIncomingPayload(data)) continue;
            textDelta += JSON.stringify(data);
          }
        }
        if (textDelta) {
          acc += textDelta;
          patchMsg(botId, { text: acc });
        }

        if (!frames.length) {
          const parsed = parseJsonText(sseBuffer);
          const parsedText = extractTextPayload(parsed);

          if (parsed && applyIncomingPayload(parsed)) {
            acc = "";
            patchMsg(botId, { text: "" });
          } else if (parsedText !== null) {
            acc += parsedText;
            patchMsg(botId, { text: acc });
          } else {
            acc += sseBuffer;
            patchMsg(botId, { text: acc });
          }
        }
      }

      if (cancelled()) return;

      if (acc.trim()) {
        applyJsonTextAsA2UI(acc);
      }

      patchMsg(botId, {
        phase: "done",
        streaming: false,
        sources: [],
      });

      setStore((st) => ({ ...st })); // trigger persist
    } catch (err) {
      if (cancelled()) return;

      patchMsg(botId, {
        phase: "done",
        streaming: false,
        text: `API 호출 중 오류가 발생했습니다. (${err instanceof Error ? err.message : "Unknown error"})`,
      });

      setStore((st) => ({ ...st })); // trigger persist
    }
  }, [patchMsg]);

  // ---- Action runner (for A2UI button events) ----
  const runActionReply = useCallback(async (botId: string, action: A2UIActionPayload) => {
    const myRun = ++RUN;
    const cancelled = () => myRun !== RUN;

    patchMsg(botId, { phase: "status", statusText: "요청을 처리하고 있어요…" });
    let reply = a2uiActionReply(action);

    if (action.name === "register_safety_report") {
      try {
        const actionWithFiles = action as A2UIActionPayloadWithFiles;
        const files = actionWithFiles.files || [];
        const formData = new FormData();
        const serializableAction = { ...actionWithFiles };
        delete serializableAction.files;
        formData.append("action", JSON.stringify(serializableAction));
        files.forEach((file) => formData.append("files", file, file.name));

        const res = await authFetch(API_ENDPOINTS.a2uiAction, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        reply = {
          md: typeof data.md === "string"
            ? data.md
            : "✅ 등록 요청이 처리되었습니다.",
        };
      } catch (err) {
        reply = {
          md: `등록 API 호출 중 오류가 발생했습니다. (${err instanceof Error ? err.message : "Unknown error"})`,
        };
      }
    } else {
      await sleep(500 + Math.random() * 300);
    }

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

    let sessionId = activeId;
    if (!sessionId) {
        sessionId = uid();
    }

    setStore((st) => {
      let { sessions, activeId } = st;
      if (!activeId || !sessions.find((s) => s.id === activeId)) {
        // const ns: Session = { id: uid(), title: genTitle(text), createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
        const ns: Session = { id: sessionId, title: genTitle(text), createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
        sessions = [ns, ...sessions];
        activeId = ns.id;
      }
      sessions = sessions.map((s) => {
        if (s.id !== activeId) return s;
        const msgs = [...s.messages, userMsg, botMsg];
        const title = s.messages.length === 0 ? genTitle(text) : s.title;
        return { ...s, title, messages: msgs, updatedAt: Date.now() };
      });

      return { sessions, activeId: sessionId };
    });

    setTimeout(() => runAgent(sessionId, botId, text), 0);
  }, [activeId, runAgent]);

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
    if (idx < 1 || !activeId) return;
    const userText = messages[idx - 1].text;
    patchMsg(botMsgId, { text: "", streaming: true, phase: "status", statusText: "다시 생각하고 있어요", cot: [], cotRevealed: 0, sources: undefined, feedback: null, a2uiState: null });
    setTimeout(() => runAgent(activeId, botMsgId, userText), 0);
  }, [activeId, messages, patchMsg, runAgent]);

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
