"use client";
import { useState } from "react";
import { Copy, Check, ThumbsUp, ThumbsDown, RefreshCw, Share2 } from "lucide-react";
import type { Message } from "@/types";

interface Props {
  msg: Message;
  onRegenerate: (id: string) => void;
  onFeedback: (id: string, kind: "up" | "down") => void;
}

export default function MsgActions({ msg, onRegenerate, onFeedback }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard?.writeText(msg.text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="msg-actions">
      <button className="act-btn" onClick={copy}>
        {copied ? <Check size={15} /> : <Copy size={15} />}
        {copied ? "복사됨" : "복사"}
      </button>
      <button
        className={"act-btn" + (msg.feedback === "up" ? " on" : "")}
        title="도움이 됐어요"
        onClick={() => onFeedback(msg.id, "up")}
      >
        <ThumbsUp size={15} />
      </button>
      <button
        className={"act-btn" + (msg.feedback === "down" ? " on" : "")}
        title="아쉬워요"
        onClick={() => onFeedback(msg.id, "down")}
      >
        <ThumbsDown size={15} />
      </button>
      <button className="act-btn" title="다시 생성" onClick={() => onRegenerate(msg.id)}>
        <RefreshCw size={15} /> 다시 생성
      </button>
      <button className="act-btn" title="공유">
        <Share2 size={15} />
      </button>
    </div>
  );
}
