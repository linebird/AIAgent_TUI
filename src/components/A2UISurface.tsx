"use client";
/**
 * A2UI v0.9 — React renderer
 * Ported from design_handoff_safetysaas/app/a2ui.jsx
 */
import { useState, type ReactNode } from "react";
import type { A2UISurfaceState, A2UIComponent } from "@/types";
import {
  a2Get, a2AbsPath, a2Resolve, a2RunChecks, a2ToStr, a2Interpolate,
  A2UI_ICON_MAP,
} from "@/lib/a2ui";
import type { A2UIActionPayload } from "@/lib/a2ui-data";
import { marked } from "marked";

// ---- Inline icon set (lucide-style SVGs) -----------------------
const ICONS: Record<string, ReactNode> = {
  alert:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>,
  activity: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  check:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
  close:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>,
  chevron:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>,
  copy:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>,
  ban:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>,
  trash:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>,
  doc:      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5Z"/><polyline points="14 2 14 8 20 8"/></svg>,
  stream:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>,
};

function AppIcon({ name, size = 18 }: { name?: string; size?: number }) {
  const key = A2UI_ICON_MAP[name || ""] || name || "doc";
  const icon = ICONS[key] || ICONS.doc;
  const scaled = size !== 18
    ? <span style={{ fontSize: size, width: size, height: size, display: "inline-grid", placeItems: "center" }}>{icon}</span>
    : icon;
  return <>{scaled}</>;
}

// ---- Context type -----------------------------------------------
interface A2UICtx {
  surface: A2UISurfaceState;
  model: Record<string, unknown>;
  components: Record<string, A2UIComponent>;
  onData: (path: string, value: unknown) => void;
  onAction: (payload: A2UIActionPayload) => void;
}

// ---- Text with markdown inline rendering -----------------------
function renderMd(text: string): string {
  try { return marked(text, { gfm: true, breaks: false }) as string; } catch { return text; }
}

// ---- Child ID resolution ---------------------------------------
function childIds(comp: A2UIComponent, ctx: A2UICtx, scopeBase: string): { id: string; scopeBase: string }[] {
  const ch = comp.children as string[] | { componentId: string; path: string } | undefined;
  if (Array.isArray(ch)) return ch.map((id) => ({ id, scopeBase }));
  if (ch && typeof ch === "object" && "componentId" in ch) {
    const arr = a2Get(ctx.model, ch.path, scopeBase);
    if (!Array.isArray(arr)) return [];
    const base = String(ch.path)[0] === "/" ? String(ch.path) : (scopeBase + "/" + String(ch.path));
    return arr.map((_, i) => ({ id: ch.componentId, scopeBase: base + "/" + i }));
  }
  if (comp.child) return [{ id: comp.child as string, scopeBase }];
  return [];
}

// ---- A2UINode --------------------------------------------------
function A2UINode({ id, scopeBase, ctx }: { id: string; scopeBase: string; ctx: A2UICtx }) {
  const comp = ctx.components[id];
  if (!comp) return null;
  const model = ctx.model;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const R = (v: any) => a2Resolve(v, model, scopeBase);

  switch (comp.component) {
    case "Column":
    case "Row": {
      const kids = childIds(comp, ctx, scopeBase);
      const isRow = comp.component === "Row";
      const cls = isRow ? "a2ui-row" : "a2ui-col";
      const justifyMap: Record<string, string> = {
        start: "flex-start", end: "flex-end", center: "center",
        spaceBetween: "space-between", spaceAround: "space-around", spaceEvenly: "space-evenly",
      };
      const alignMap: Record<string, string> = {
        start: "flex-start", end: "flex-end", center: "center", stretch: "stretch",
      };
      const style: React.CSSProperties = {
        justifyContent: justifyMap[comp.justify as string] || undefined,
        alignItems: alignMap[comp.align as string] || (isRow ? "center" : "stretch"),
        gap: comp.gap != null ? `${comp.gap}px` : undefined,
      };
      return (
        <div className={cls} style={style}>
          {kids.map((k, i) => {
            const kc = ctx.components[k.id];
            const weight = kc?.weight as number | undefined;
            return (
              <div key={i} className="a2ui-slot" style={weight ? { flex: weight, minWidth: 0 } : undefined}>
                <A2UINode id={k.id} scopeBase={k.scopeBase} ctx={ctx} />
              </div>
            );
          })}
        </div>
      );
    }
    case "List": {
      const kids = childIds(comp, ctx, scopeBase);
      return (
        <div className="a2ui-list">
          {kids.map((k, i) => <A2UINode key={i} id={k.id} scopeBase={k.scopeBase} ctx={ctx} />)}
        </div>
      );
    }
    case "Card": {
      const kids = childIds(comp, ctx, scopeBase);
      const cls = "a2ui-card" + (comp.variant ? " a2ui-card-" + comp.variant : "");
      return (
        <div className={cls}>
          {kids.map((k, i) => <A2UINode key={i} id={k.id} scopeBase={k.scopeBase} ctx={ctx} />)}
        </div>
      );
    }
    case "Divider":
      return <div className={"a2ui-divider " + (comp.axis === "vertical" ? "vert" : "horiz")} />;
    case "Text": {
      const raw = a2ToStr(R(comp.text));
      const variant = (comp.variant as string) || "body";
      // Resolve formatString
      let txt = raw;
      if (typeof comp.text === "object" && comp.text && "call" in (comp.text as object)) {
        txt = a2ToStr(R(comp.text));
      } else if (raw.includes("${")) {
        txt = a2Interpolate(raw, model, scopeBase);
      }
      const html = renderMd(txt);
      return <div className={"a2ui-text a2ui-text-" + variant} dangerouslySetInnerHTML={{ __html: html }} />;
    }
    case "Image":
      // eslint-disable-next-line @next/next/no-img-element
      return <img className="a2ui-image" src={a2ToStr(R(comp.url))} alt={a2ToStr(R(comp.alt)) || ""} />;
    case "Icon": {
      const name = a2ToStr(R(comp.name));
      return <span className="a2ui-icon"><AppIcon name={name} size={(comp.size as number) || 18} /></span>;
    }
    case "Button":     return <A2UIButton comp={comp} scopeBase={scopeBase} ctx={ctx} />;
    case "TextField":  return <A2UITextField comp={comp} scopeBase={scopeBase} ctx={ctx} />;
    case "CheckBox":   return <A2UICheckBox comp={comp} scopeBase={scopeBase} ctx={ctx} />;
    case "ChoicePicker": return <A2UIChoicePicker comp={comp} scopeBase={scopeBase} ctx={ctx} />;
    case "Slider":     return <A2UISlider comp={comp} scopeBase={scopeBase} ctx={ctx} />;
    case "Switch":     return <A2UISwitch comp={comp} scopeBase={scopeBase} ctx={ctx} />;
    case "Select":     return <A2UISelect comp={comp} scopeBase={scopeBase} ctx={ctx} />;
    case "TagInput":   return <A2UITagInput comp={comp} scopeBase={scopeBase} ctx={ctx} />;
    case "DataTable":  return <A2UIDataTable comp={comp} scopeBase={scopeBase} ctx={ctx} />;
    case "Tabs":       return <A2UITabs comp={comp} scopeBase={scopeBase} ctx={ctx} />;
    case "Modal":      return <A2UIModal comp={comp} scopeBase={scopeBase} ctx={ctx} />;
    default:
      return <div className="a2ui-unknown">⚠ 미지원 컴포넌트: {comp.component}</div>;
  }
}

// ---- Button ----------------------------------------------------
function A2UIButton({ comp, scopeBase, ctx }: { comp: A2UIComponent; scopeBase: string; ctx: A2UICtx }) {
  const model = ctx.model;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const checks = comp.checks as any[] | undefined;
  const check = a2RunChecks(checks, model, scopeBase);
  const disabled = !check.ok;
  const variant = (comp.variant as string) || "primary";
  const label = comp.child ? null : a2ToStr(a2Resolve(comp.text, model, scopeBase));

  const handleClick = () => {
    if (disabled) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const action = comp.action as any;
    if (!action) return;
    if (action.event) {
      const raw = action.event.context || {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctxObj: Record<string, any> = {};
      Object.keys(raw).forEach((k) => { ctxObj[k] = a2Resolve(raw[k], model, scopeBase); });
      const payload = {
        name: action.event.name,
        surfaceId: ctx.surface.surfaceId,
        sourceComponentId: comp.id,
        timestamp: new Date().toISOString(),
        context: ctxObj,
        ...(ctx.surface.sendDataModel ? { dataModel: model } : {}),
      };
      ctx.onAction(payload);
    }
  };

  return (
    <button
      className={"a2ui-btn a2ui-btn-" + variant}
      disabled={disabled}
      onClick={handleClick}
      title={disabled ? (check.message || "") : undefined}
    >
      {comp.child ? <A2UINode id={comp.child as string} scopeBase={scopeBase} ctx={ctx} /> : label}
    </button>
  );
}

// ---- TextField -------------------------------------------------
function A2UITextField({ comp, scopeBase, ctx }: { comp: A2UIComponent; scopeBase: string; ctx: A2UICtx }) {
  const [touched, setTouched] = useState(false);
  const model = ctx.model;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const path = (comp.value as any)?.path;
  const val = a2ToStr(a2Get(model, path, scopeBase) ?? "");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const check = a2RunChecks(comp.checks as any[], model, scopeBase);
  const showErr = touched && !check.ok;
  const long = comp.variant === "longText";
  const set = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    ctx.onData(a2AbsPath(path, scopeBase), e.target.value);
  return (
    <label className="a2ui-field">
      {comp.label != null && <span className="a2ui-label">{comp.label as string}</span>}
      {long
        ? <textarea className={"a2ui-input a2ui-textarea" + (showErr ? " err" : "")} value={val}
            rows={3} placeholder={(comp.placeholder as string) || ""} onChange={set} onBlur={() => setTouched(true)} />
        : <input className={"a2ui-input" + (showErr ? " err" : "")} value={val}
            type={comp.variant === "number" ? "number" : "text"} placeholder={(comp.placeholder as string) || ""}
            onChange={set} onBlur={() => setTouched(true)} />}
      {showErr && <span className="a2ui-err">{check.message}</span>}
    </label>
  );
}

// ---- CheckBox --------------------------------------------------
function A2UICheckBox({ comp, scopeBase, ctx }: { comp: A2UIComponent; scopeBase: string; ctx: A2UICtx }) {
  const model = ctx.model;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const path = (comp.value as any)?.path;
  const checked = !!a2Get(model, path, scopeBase);
  const toggle = () => ctx.onData(a2AbsPath(path, scopeBase), !checked);
  return (
    <button type="button" className={"a2ui-check" + (checked ? " on" : "")} onClick={toggle} role="checkbox" aria-checked={checked}>
      <span className="a2ui-check-box">{checked && <>{ICONS.check}</>}</span>
      <span className="a2ui-check-label">{comp.label as string}</span>
    </button>
  );
}

// ---- ChoicePicker ----------------------------------------------
function A2UIChoicePicker({ comp, scopeBase, ctx }: { comp: A2UIComponent; scopeBase: string; ctx: A2UICtx }) {
  const model = ctx.model;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const path = (comp.value as any)?.path;
  const raw = a2Get(model, path, scopeBase);
  const multi = comp.variant === "multiple" || comp.variant === "multiSelect";
  const selected = Array.isArray(raw) ? raw : (raw != null ? [raw] : []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options = ((comp.options as any[]) || []).map((o: any) =>
    typeof o === "object" ? o : { label: String(o), value: o }
  );
  const pick = (v: unknown) => {
    let next;
    if (multi) next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
    else next = v;
    ctx.onData(a2AbsPath(path, scopeBase), next);
  };
  return (
    <div className={"a2ui-choices" + (multi ? " multi" : "")} role="group">
      {options.map((o, i) => (
        <button key={i} type="button" className={"a2ui-choice" + (selected.includes(o.value) ? " on" : "")} onClick={() => pick(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---- Slider ----------------------------------------------------
function A2UISlider({ comp, scopeBase, ctx }: { comp: A2UIComponent; scopeBase: string; ctx: A2UICtx }) {
  const model = ctx.model;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const path = (comp.value as any)?.path;
  const min = (comp.min as number) ?? 0;
  const max = (comp.max as number) ?? 100;
  const step = (comp.step as number) ?? 1;
  const val = Number(a2Get(model, path, scopeBase) ?? min);
  const set = (e: React.ChangeEvent<HTMLInputElement>) => ctx.onData(a2AbsPath(path, scopeBase), Number(e.target.value));
  const pct = ((val - min) / (max - min)) * 100;
  return (
    <div className="a2ui-slider">
      {comp.label != null && <span className="a2ui-label">{comp.label as string}</span>}
      <div className="a2ui-slider-row">
        <input type="range" min={min} max={max} step={step} value={val} onChange={set}
          style={{ "--a2ui-fill": pct + "%" } as React.CSSProperties} />
        <span className="a2ui-slider-val">{val}</span>
      </div>
    </div>
  );
}

// ---- Switch ----------------------------------------------------
function A2UISwitch({ comp, scopeBase, ctx }: { comp: A2UIComponent; scopeBase: string; ctx: A2UICtx }) {
  const model = ctx.model;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const path = (comp.value as any)?.path;
  const on = !!a2Get(model, path, scopeBase);
  const toggle = () => ctx.onData(a2AbsPath(path, scopeBase), !on);
  return (
    <div className="a2ui-switch-row">
      <button type="button" className={"a2ui-switch" + (on ? " on" : "")} role="switch" aria-checked={on} onClick={toggle}>
        <span className="a2ui-switch-knob" />
      </button>
      {comp.label != null && <span className="a2ui-switch-label">{a2ToStr(a2Resolve(comp.label, model, scopeBase))}</span>}
    </div>
  );
}

// ---- Select ----------------------------------------------------
function A2UISelect({ comp, scopeBase, ctx }: { comp: A2UIComponent; scopeBase: string; ctx: A2UICtx }) {
  const [touched, setTouched] = useState(false);
  const model = ctx.model;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const path = (comp.value as any)?.path;
  const val = a2Get(model, path, scopeBase);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options = ((comp.options as any[]) || []).map((o: any) =>
    typeof o === "object" ? o : { label: String(o), value: o }
  );
  const set = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const raw = e.target.value;
    const opt = options.find((o) => String(o.value) === raw);
    ctx.onData(a2AbsPath(path, scopeBase), opt ? opt.value : raw);
    setTouched(true);
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const check = a2RunChecks(comp.checks as any[], model, scopeBase);
  const showErr = touched && !check.ok;
  return (
    <label className="a2ui-field">
      {comp.label != null && <span className="a2ui-label">{comp.label as string}</span>}
      <div className="a2ui-select-wrap">
        <select className={"a2ui-input a2ui-select" + (showErr ? " err" : "")}
          value={val == null ? "" : String(val)} onChange={set}>
          <option value="" disabled>{(comp.placeholder as string) || "선택"}</option>
          {options.map((o, i) => <option key={i} value={String(o.value)}>{o.label}</option>)}
        </select>
        <span className="a2ui-select-chev">{ICONS.chevron}</span>
      </div>
      {showErr && <span className="a2ui-err">{check.message}</span>}
    </label>
  );
}

// ---- TagInput --------------------------------------------------
function A2UITagInput({ comp, scopeBase, ctx }: { comp: A2UIComponent; scopeBase: string; ctx: A2UICtx }) {
  const [draft, setDraft] = useState("");
  const model = ctx.model;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const path = (comp.value as any)?.path;
  const raw = a2Get(model, path, scopeBase);
  const tags = Array.isArray(raw) ? (raw as string[]) : [];
  const commit = (text: string) => {
    const parts = String(text).split(",").map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = tags.slice();
    parts.forEach((p) => { if (!next.includes(p)) next.push(p); });
    ctx.onData(a2AbsPath(path, scopeBase), next);
    setDraft("");
  };
  const remove = (t: string) => ctx.onData(a2AbsPath(path, scopeBase), tags.filter((x) => x !== t));
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(draft); }
    else if (e.key === "Backspace" && !draft && tags.length) { remove(tags[tags.length - 1]); }
  };
  const suggestions = ((comp.suggestions as string[]) || []).filter((s) => !tags.includes(s));
  return (
    <label className="a2ui-field">
      {comp.label != null && <span className="a2ui-label">{comp.label as string}</span>}
      <div className="a2ui-taginput">
        <div className="a2ui-tagrow">
          {tags.map((t, i) => (
            <span key={i} className="a2ui-tag">{t}
              <button type="button" className="a2ui-tag-x" onClick={() => remove(t)}>{ICONS.close}</button>
            </span>
          ))}
          <input className="a2ui-tag-field" value={draft}
            placeholder={tags.length ? "" : ((comp.placeholder as string) || "")}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey} onBlur={() => commit(draft)} />
        </div>
        <button type="button" className="a2ui-tag-add" onClick={() => commit(draft)}>
          {(comp.addLabel as string) || "추가"}
        </button>
      </div>
      {suggestions.length > 0 && (
        <div className="a2ui-tag-sugg">
          {suggestions.map((s, i) => (
            <button key={i} type="button" className="a2ui-tag-chip" onClick={() => commit(s)}>+ {s}</button>
          ))}
        </div>
      )}
    </label>
  );
}

// ---- Tabs ------------------------------------------------------
function A2UITabs({ comp, scopeBase, ctx }: { comp: A2UIComponent; scopeBase: string; ctx: A2UICtx }) {
  const [activeIdx, setActiveIdx] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tabs = (comp.tabs as any[]) || [];
  return (
    <div className="a2ui-tabs">
      <div className="a2ui-tabbar">
        {tabs.map((t, i) => (
          <button key={i} className={"a2ui-tab" + (i === activeIdx ? " on" : "")} onClick={() => setActiveIdx(i)}>
            {t.title}
          </button>
        ))}
      </div>
      <div className="a2ui-tabpanel">
        {tabs[activeIdx]?.child && (
          <A2UINode id={tabs[activeIdx].child} scopeBase={scopeBase} ctx={ctx} />
        )}
      </div>
    </div>
  );
}

// ---- Modal -----------------------------------------------------
function A2UIModal({ comp, scopeBase, ctx }: { comp: A2UIComponent; scopeBase: string; ctx: A2UICtx }) {
  const [open, setOpen] = useState(false);
  const label = (comp.triggerLabel as string) || a2ToStr(a2Resolve(comp.text, ctx.model, scopeBase)) || "열기";
  return (
    <div className="a2ui-modal-wrap">
      <button className="a2ui-btn a2ui-btn-secondary" onClick={() => setOpen(true)}>{label}</button>
      {open && (
        <div className="a2ui-modal-scrim" onClick={() => setOpen(false)}>
          <div className="a2ui-modal" onClick={(e) => e.stopPropagation()}>
            <button className="a2ui-modal-close" onClick={() => setOpen(false)}>{ICONS.close}</button>
            {comp.child != null && <A2UINode id={comp.child as string} scopeBase={scopeBase} ctx={ctx} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- DataTable -------------------------------------------------
function A2UIDataTable({ comp, scopeBase, ctx }: { comp: A2UIComponent; scopeBase: string; ctx: A2UICtx }) {
  const model = ctx.model;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rowsRef = (comp.rows as any)?.path;
  const absPath = a2AbsPath(rowsRef, scopeBase);
  const rows = (a2Get(model, rowsRef, scopeBase) || []) as Record<string, unknown>[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cols = (comp.columns as any[]) || [];

  const setRows = (next: Record<string, unknown>[]) => ctx.onData(absPath, next);
  const update = (i: number, key: string, val: unknown) =>
    setRows(rows.map((r, j) => j === i ? { ...r, [key]: val } : r));
  const removeRow = (i: number) => setRows(rows.filter((_, j) => j !== i));
  const dupRow = (i: number) => { const next = rows.slice(); next.splice(i + 1, 0, { ...rows[i] }); setRows(next); };
  const toggleExclude = (i: number) => update(i, "excluded", !rows[i].excluded);
  const riskClass = (v: unknown) => v === "상" ? "hi" : v === "중" ? "mid" : "lo";
  const statusCycle = (v: unknown) => { const o = ["초안", "검토", "승인"]; return o[(o.indexOf(String(v)) + 1) % o.length]; };

  return (
    <div className="a2ui-table-wrap">
      <table className="a2ui-table">
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th key={i} className={"thx col-" + (c.kind || "text")} style={{ minWidth: c.w, width: c.w }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={row.excluded ? "row-excluded" : ""}>
              {cols.map((c, ci) => {
                const v = row[c.key];
                switch (c.kind) {
                  case "index":
                    return <td key={ci} className="cell-index">{ri + 1}</td>;
                  case "risk":
                    return <td key={ci} className="cell-risk"><span className={"risk-badge " + riskClass(v)}>{String(v)}</span></td>;
                  case "arrowrisk":
                    return <td key={ci} className="cell-risk arrowcol"><span className={"risk-badge " + riskClass(v)}>{String(v)}</span></td>;
                  case "status":
                    return (
                      <td key={ci} className="cell-status">
                        <button className={"status-pill st-" + (v === "승인" ? "ok" : v === "검토" ? "rev" : "draft")}
                          onClick={() => update(ri, c.key, statusCycle(v))} title="클릭하여 상태 변경">
                          {String(v) || "초안"}
                        </button>
                      </td>
                    );
                  case "tags":
                    return (
                      <td key={ci} className="cell-tags">
                        <div className="ppe-wrap">
                          {(Array.isArray(v) ? v : []).map((t, k) => <span key={k} className="ppe-tag">{String(t)}</span>)}
                        </div>
                      </td>
                    );
                  case "select":
                    return (
                      <td key={ci} className="cell-select">
                        <div className="a2ui-select-wrap mini">
                          <select className="mini-select" value={String(v || "")}
                            onChange={(e) => update(ri, c.key, e.target.value)}>
                            <option value="">(미지정)</option>
                            {(c.options || []).map((o: string, k: number) => <option key={k} value={o}>{o}</option>)}
                          </select>
                          <span className="a2ui-select-chev">{ICONS.chevron}</span>
                        </div>
                      </td>
                    );
                  case "para":
                    return <td key={ci} className="cell-para">{String(v ?? "")}</td>;
                  case "actions":
                    return (
                      <td key={ci} className="cell-actions">
                        <button title="복제" onClick={() => dupRow(ri)}>{ICONS.copy}</button>
                        <button title={row.excluded ? "포함" : "제외"} className={row.excluded ? "on" : ""} onClick={() => toggleExclude(ri)}>{ICONS.ban}</button>
                        <button title="삭제" className="del" onClick={() => removeRow(ri)}>{ICONS.trash}</button>
                      </td>
                    );
                  default:
                    return <td key={ci} className="cell-text">{String(v ?? "")}</td>;
                }
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ================================================================
// Main A2UISurface component
// ================================================================
interface Props {
  surface: A2UISurfaceState;
  msgId: string;
  onData: (msgId: string, path: string, value: unknown) => void;
  onAction: (payload: A2UIActionPayload) => void;
}

export default function A2UISurface({ surface, msgId, onData, onAction }: Props) {
  if (!surface || surface.deleted) return null;

  const model = surface.dataModel as Record<string, unknown>;
  const hasRoot = surface.components && surface.components.root;
  const primary = surface.theme?.primaryColor;
  const styleVars = primary ? ({ "--a2ui-primary": primary } as React.CSSProperties) : undefined;

  const ctx: A2UICtx = {
    surface,
    model,
    components: surface.components || {},
    onData: (path, value) => onData(msgId, path, value),
    onAction,
  };

  return (
    <div className="a2ui-surface" style={styleVars} data-surface={surface.surfaceId}>
      {(surface.theme?.agentDisplayName || surface.theme?.iconUrl) && (
        <div className="a2ui-attrib">
          {surface.theme.iconUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={surface.theme.iconUrl} alt="" className="a2ui-attrib-ico" />
            : <span className="a2ui-attrib-ico a2ui-attrib-dot" />}
          <span>{surface.theme.agentDisplayName || "A2UI"}</span>
          <span className="a2ui-badge">A2UI · 생성형 UI</span>
        </div>
      )}
      {hasRoot
        ? <A2UINode id="root" scopeBase="" ctx={ctx} />
        : <div className="a2ui-skeleton"><span /><span /><span /></div>}
    </div>
  );
}
