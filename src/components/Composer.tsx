"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { Paperclip, Mic, Send, Square, X, File, FileText, Code } from "lucide-react";
import { guessFileIcon, fmtSize } from "@/lib/utils";

interface FileItem { name: string; size: string; icon: string; }

const FILE_ICON: Record<string, React.ReactNode> = {
  FileText: <FileText size={15} />,
  Code: <Code size={15} />,
  File: <File size={15} />,
};

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
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const addFiles = useCallback((list: FileList) => {
    const arr = Array.from(list).slice(0, 5).map((f) => ({
      name: f.name, size: fmtSize(f.size), icon: guessFileIcon(f.name),
    }));
    setFiles((prev) => [...prev, ...arr].slice(0, 5));
  }, []);

  const submit = useCallback(() => {
    if (busy) return;
    const t = text.trim();
    if (!t && files.length === 0) return;
    onSend(t || "(첨부 파일 분석 요청)", files);
    setText("");
    setFiles([]);
    requestAnimationFrame(autoSize);
  }, [text, files, busy, onSend, autoSize]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const toggleMic = useCallback(() => {
    if (recording) {
      if (recTimer.current) clearTimeout(recTimer.current);
      setRecording(false);
      setText((t) => (t ? t + " " : "") + "order-service 결제 호출 타임아웃 원인 알려줘");
      requestAnimationFrame(autoSize);
    } else {
      setRecording(true);
      recTimer.current = setTimeout(() => {
        setRecording(false);
        setText((t) => (t ? t + " " : "") + "order-service 결제 호출 타임아웃 원인 알려줘");
        requestAnimationFrame(autoSize);
      }, 2600);
    }
  }, [recording, autoSize]);

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
            <button className={"in-btn" + (recording ? " recording" : "")} title="음성 입력" onClick={toggleMic}>
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
        ) : (
          <div className="composer-foot">
            Saferyn AI Agent는 사내 문서·코드를 근거로 답변합니다. 중요한 결정은 원문을 확인하세요.
          </div>
        )}
      </div>
    </div>
  );
}
