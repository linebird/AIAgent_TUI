"use client";
import { useState } from "react";
import { BrainCircuit, ChevronRight } from "lucide-react";
import type { CoTStep } from "@/types";

interface Props {
  steps: CoTStep[];
  revealed: number;
  reasoning: boolean;
}

export default function CoT({ steps, revealed, reasoning }: Props) {
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen !== null ? userOpen : reasoning;
  const shown = steps.slice(0, revealed);

  return (
    <div className={"cot" + (open ? " open" : "")}>
      <button className="cot-head" onClick={() => setUserOpen(!open)}>
        <span className="ct-ico"><BrainCircuit size={16} /></span>
        {reasoning ? "사고 과정 진행 중…" : `사고 과정 · ${steps.length}단계 추론`}
        <span className="chev"><ChevronRight size={16} /></span>
      </button>
      <div className="cot-body">
        <div>
          <div className="cot-steps">
            {shown.map((s, i) => {
              const pending = reasoning && i === revealed - 1;
              return (
                <div key={i} className={"cot-step" + (pending ? " pending" : "")}>
                  <div className="cs-title">{s.title}</div>
                  <div className="cs-detail">{s.detail}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
