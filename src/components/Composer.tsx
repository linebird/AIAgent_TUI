"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { Paperclip, Mic, Send, Square, X, File, FileText, Code } from "lucide-react";
import { guessFileIcon, fmtSize } from "@/lib/utils";

interface FileItem { name: string; size: string; icon: string; }

type SpeechRecognitionConstructor = new () => SpeechRecognition;

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const FILE_ICON: Record<string, React.ReactNode> = {
  FileText: <FileText size={15} />,
  Code: <Code size={15} />,
  File: <File size={15} />,
};

const VOICE_AUTO_SEND_DELAY_MS = 1800;

function normalizeSpeechText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function compactSpeechText(value: string) {
  return normalizeSpeechText(value).replace(/\s/g, "");
}

function sliceByCompactOffset(value: string, compactOffset: number) {
  let seen = 0;
  for (let i = 0; i < value.length; i += 1) {
    if (/\s/.test(value[i])) continue;
    if (seen >= compactOffset) return value.slice(i);
    seen += 1;
  }
  return "";
}

function cleanupSpeechText(value: string) {
  return normalizeSpeechText(value)
    .replace(/아\s*차\s*사고/g, "아차 사고")
    .replace(/아\s*차/g, "아차")
    .replace(/등록해\s*줘/g, "등록해줘");
}

function mergeSpeechSegment(current: string, next: string) {
  const a = normalizeSpeechText(current);
  const b = normalizeSpeechText(next);
  const compactA = compactSpeechText(a);
  const compactB = compactSpeechText(b);
  if (!a) return b;
  if (!b || compactA === compactB || compactA.endsWith(compactB) || compactA.includes(compactB)) return a;
  if (compactB.startsWith(compactA) || compactB.includes(compactA)) return b;

  const max = Math.min(compactA.length, compactB.length);
  for (let size = max; size > 0; size -= 1) {
    if (compactA.slice(-size) === compactB.slice(0, size)) {
      return normalizeSpeechText(a + sliceByCompactOffset(b, size));
    }
  }

  return normalizeSpeechText(`${a} ${b}`);
}

function mergeSpeechSegments(segments: string[]) {
  return cleanupSpeechText(segments.reduce((merged, segment) => mergeSpeechSegment(merged, segment), ""));
}

interface Props {
  onSend: (text: string, files: FileItem[]) => void;
  busy: boolean;
  onStop: () => void;
}

export default function Composer({ onSend, busy, onStop }: Props) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [focus, setFocus] = useState(false);
  const [drag, setDrag] = useState(false);
  const [recording, setRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [speechError, setSpeechError] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const speechBaseTextRef = useRef("");
  const speechFinalRef = useRef("");
  const speechLatestTextRef = useRef("");
  const speechSilenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const autoSize = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const next = ta.value ? Math.min(ta.scrollHeight, 220) : 0;
    ta.style.height = next ? next + "px" : "auto";
  }, []);

  useEffect(() => {
    autoSize();
    const t = setTimeout(autoSize, 60);
    return () => clearTimeout(t);
  }, [text, autoSize]);

  useEffect(() => {
    setSpeechSupported(
      typeof window !== "undefined" &&
        !!(window.SpeechRecognition || window.webkitSpeechRecognition)
    );

    return () => {
      if (speechSilenceTimerRef.current) clearTimeout(speechSilenceTimerRef.current);
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const addFiles = useCallback((list: FileList) => {
    const arr = Array.from(list).slice(0, 5).map((f) => ({
      name: f.name, size: fmtSize(f.size), icon: guessFileIcon(f.name),
    }));
    setFiles((prev) => [...prev, ...arr].slice(0, 5));
  }, []);

  const sendDraft = useCallback((draftText = text) => {
    if (busy) return;
    const t = draftText.trim();
    if (!t && files.length === 0) return;
    onSend(t || "(첨부 파일 분석 요청)", files);
    setText("");
    setFiles([]);
    requestAnimationFrame(autoSize);
  }, [text, files, busy, onSend, autoSize]);

  const submit = useCallback(() => {
    sendDraft();
  }, [sendDraft]);

  const clearSpeechSilenceTimer = useCallback(() => {
    if (speechSilenceTimerRef.current) {
      clearTimeout(speechSilenceTimerRef.current);
      speechSilenceTimerRef.current = null;
    }
  }, []);

  const scheduleSpeechAutoSend = useCallback(() => {
    clearSpeechSilenceTimer();
    speechSilenceTimerRef.current = setTimeout(() => {
      const draft = speechLatestTextRef.current.trim();
      if (!draft || busy) return;

      recognitionRef.current?.stop();
      setRecording(false);
      sendDraft(draft);
      speechLatestTextRef.current = "";
      speechFinalRef.current = "";
      speechSilenceTimerRef.current = null;
    }, VOICE_AUTO_SEND_DELAY_MS);
  }, [busy, clearSpeechSilenceTimer, sendDraft]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const toggleMic = useCallback(() => {
    if (recording) {
      clearSpeechSilenceTimer();
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechSupported(false);
      setSpeechError("이 브라우저는 음성 입력을 지원하지 않습니다.");
      return;
    }

    const recognition = new Recognition();
    recognitionRef.current = recognition;
    speechBaseTextRef.current = text.trimEnd();
    speechFinalRef.current = "";
    speechLatestTextRef.current = speechBaseTextRef.current;
    setSpeechError("");

    recognition.lang = "ko-KR";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => setRecording(true);
    recognition.onend = () => setRecording(false);
    recognition.onerror = (event) => {
      setRecording(false);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setSpeechError("마이크 권한이 필요합니다.");
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        setSpeechError("음성 입력을 시작하지 못했습니다.");
      }
    };
    recognition.onresult = (event) => {
      const interimSegments: string[] = [];
      const finalSegments: string[] = [];

      for (let i = 0; i < event.results.length; i += 1) {
        const transcript = normalizeSpeechText(event.results[i][0]?.transcript ?? "");
        if (!transcript) continue;
        if (event.results[i].isFinal) {
          finalSegments.push(transcript);
        } else {
          interimSegments.push(transcript);
        }
      }

      const finalText = mergeSpeechSegments(finalSegments);
      const interim = mergeSpeechSegments(interimSegments);
      speechFinalRef.current = finalText;
      const spokenText = mergeSpeechSegments([finalText, interim]);
      const latestText = mergeSpeechSegments([speechBaseTextRef.current, spokenText]);
      speechLatestTextRef.current = latestText;
      setText(latestText);
      requestAnimationFrame(autoSize);
      if ((finalText || interim).trim()) scheduleSpeechAutoSend();
    };

    recognition.start();
  }, [recording, text, autoSize, clearSpeechSilenceTimer, scheduleSpeechAutoSend]);

  const canSend = text.trim().length > 0 || files.length > 0;

  return (
    <div className="composer-wrap">
      <div className="composer">
        {files.length > 0 && (
          <div className="attach-row">
            {files.map((f, i) => (
              <div key={i} className="attach-chip">
                <span className="ac-ico">{FILE_ICON[f.icon] ?? <File size={15} />}</span>
                <span>
                  <span className="ac-name">{f.name}</span>
                  <span className="ac-meta">{f.size}</span>
                </span>
                <button className="ac-x" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}>
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          className={"input-box" + (focus ? " focus" : "") + (drag ? " dragover" : "")}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
        >
          <textarea
            ref={taRef}
            rows={1}
            value={text}
            placeholder={recording ? "음성을 듣고 있어요…" : "세이플린 운영·개발에 대해 무엇이든 물어보세요. (Shift+Enter 줄바꿈)"}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => setFocus(true)}
            onBlur={() => setFocus(false)}
          />
          <div className="input-row">
            <input
              ref={fileRef}
              type="file"
              multiple
              style={{ display: "none" }}
              onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
            />
            <button className="in-btn" title="파일 첨부" onClick={() => fileRef.current?.click()}>
              <Paperclip size={19} />
            </button>
            <button
              className={"in-btn" + (recording ? " recording" : "")}
              title={speechSupported ? "음성 입력" : "음성 입력 미지원"}
              onClick={toggleMic}
              disabled={!speechSupported}
            >
              <Mic size={19} />
            </button>
            <div className="in-spacer" />
            {busy ? (
              <button className="send-btn stop" title="응답 중단" onClick={onStop}>
                <Square size={17} />
              </button>
            ) : (
              <button className="send-btn send" title="보내기" disabled={!canSend} onClick={submit}>
                <Send size={19} />
              </button>
            )}
          </div>
        </div>

        {recording ? (
          <div className="rec-hint">
            <span className="spinner" style={{ borderColor: "oklch(0.6 0.2 25 / 0.3)", borderTopColor: "oklch(0.55 0.22 25)" }} />
            음성을 텍스트로 변환 중… 다시 누르면 멈춰요
          </div>
        ) : speechError ? (
          <div className="rec-hint error">{speechError}</div>
        ) : (
          <div className="composer-foot">
            Saferyn AI Agent는 사내 문서·코드를 근거로 답변합니다. 중요한 결정은 원문을 확인하세요.
          </div>
        )}
      </div>
    </div>
  );
}
