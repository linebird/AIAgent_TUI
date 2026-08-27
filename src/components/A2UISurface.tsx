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

type A2UIActionPayloadWithFiles = A2UIActionPayload & { files?: File[] };

const A2UI_FILE_STORE = new Map<string, File[]>();

function fileStoreKey(surfaceId: string, path: string) {
  return `${surfaceId}:${path}`;
}

function surfaceFiles(surfaceId: string): File[] {
  const prefix = `${surfaceId}:`;
  return Array.from(A2UI_FILE_STORE.entries())
    .filter(([key]) => key.startsWith(prefix))
    .flatMap(([, files]) => files);
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
    case "FileUpload": return <A2UIFileUpload comp={comp} scopeBase={scopeBase} ctx={ctx} />;
    case "DataTable":  return <A2UIDataTable comp={comp} scopeBase={scopeBase} ctx={ctx} />;
    case "BarChart":   return <A2UIBarChart comp={comp} scopeBase={scopeBase} ctx={ctx} />;
    case "AccidentListCard": return <A2UIAccidentListCard comp={comp} scopeBase={scopeBase} ctx={ctx} />;
    case "PendingApprovalListCard": return <A2UIPendingApprovalListCard comp={comp} scopeBase={scopeBase} ctx={ctx} />;
    case "ActvScoreSummaryCard": return <A2UIActvScoreSummaryCard comp={comp} scopeBase={scopeBase} ctx={ctx} />;
    case "WeeklyScheduleCard": return <A2UIWeeklyScheduleCard comp={comp} scopeBase={scopeBase} ctx={ctx} />;
    case "CompletionGaugeCard": return <A2UICompletionGaugeCard comp={comp} scopeBase={scopeBase} ctx={ctx} />;
    case "OpertPlanStatusCard": return <A2UIOpertPlanStatusCard comp={comp} scopeBase={scopeBase} ctx={ctx} />;
    case "OpertStopStatusCard": return <A2UIOpertStopStatusCard comp={comp} scopeBase={scopeBase} ctx={ctx} />;
    case "Tabs":       return <A2UITabs comp={comp} scopeBase={scopeBase} ctx={ctx} />;
    case "Modal":      return <A2UIModal comp={comp} scopeBase={scopeBase} ctx={ctx} />;
    default:
      return <div className="a2ui-unknown">⚠ 미지원 컴포넌트: {comp.component}</div>;
  }
}

// ---- AccidentListCard ------------------------------------------
function A2UIAccidentListCard({ comp, scopeBase, ctx }: { comp: A2UIComponent; scopeBase: string; ctx: A2UICtx }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value = a2Resolve((comp as any).value, ctx.model, scopeBase) as Record<string, unknown> | null;
  const title = a2ToStr(value?.title ?? comp.title ?? "사고 현황");
  const subtitle = a2ToStr(value?.subtitle ?? "");
  const total = Number(value?.total ?? 0) || 0;
  const items = Array.isArray(value?.items) ? (value.items as Record<string, unknown>[]) : [];

  return (
    <div className="a2ui-accident-card">
      <div className="a2ui-accident-head">
        <strong>{title}</strong>
        {subtitle && <span>{subtitle}</span>}
      </div>
      <div className="a2ui-accident-table-wrap" aria-label={`${title} ${total}건`}>
        <table className="a2ui-accident-table">
          <thead>
            <tr>
              <th>사업장</th>
              <th>재해유형</th>
              <th>사고일시</th>
              <th>사업장 ID</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const siteName = a2ToStr(item.siteName ?? "-");
              const date = a2ToStr(item.date ?? "-");
              const type = a2ToStr(item.type ?? "-");
              const siteId = a2ToStr(item.siteId ?? item.id ?? "-");

              return (
                <tr key={a2ToStr(item.id ?? index)}>
                  <td title={siteName}>{siteName}</td>
                  <td title={type}>{type}</td>
                  <td title={date}>{date}</td>
                  <td title={siteId}>{siteId}</td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="a2ui-accident-empty">조회된 사고/재해 내역이 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- WeeklyScheduleCard ---------------------------------------
function A2UIWeeklyScheduleCard({ comp, scopeBase, ctx }: { comp: A2UIComponent; scopeBase: string; ctx: A2UICtx }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value = a2Resolve((comp as any).value, ctx.model, scopeBase) as Record<string, unknown> | null;
  const title = a2ToStr(value?.title ?? comp.title ?? "주간 일정");
  const monthLabel = a2ToStr(value?.monthLabel ?? "");
  const activeTab = a2ToStr(value?.activeTab ?? "사업장");
  const tabs = Array.isArray(value?.tabs) ? value.tabs.map((tab) => a2ToStr(tab)) : ["사업장", "개인"];
  const days = Array.isArray(value?.days) ? (value.days as Record<string, unknown>[]) : [];
  const now = new Date();
  const todayKey = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

  return (
    <div className="a2ui-week-card">
      <div className="a2ui-week-title">{title}</div>
      <div className="a2ui-week-head">
        <div className="a2ui-week-month">{monthLabel}</div>
        <div className="a2ui-week-tabs" role="tablist" aria-label="일정 범위">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={tab === activeTab ? "on" : ""}
              role="tab"
              aria-selected={tab === activeTab}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>
      <div className="a2ui-week-body">
        <button type="button" className="a2ui-week-nav" aria-label="이전 주">{ICONS.chevron}</button>
        <div className="a2ui-week-grid">
          {days.map((day, index) => {
            const dayText = a2ToStr(day.day ?? "");
            const dateText = a2ToStr(day.date ?? "");
            const items = Array.isArray(day.items) ? (day.items as Record<string, unknown>[]) : [];
            const isToday = dateText === todayKey;
            const cls = [
              "a2ui-week-day",
              day.isSaturday ? "sat" : "",
              day.isSunday ? "sun" : "",
              isToday ? "today" : "",
            ].filter(Boolean).join(" ");

            return (
              <div key={dateText || index} className={cls}>
                <div className="a2ui-week-day-num">
                  <span>{dayText}</span>
                </div>
                <div className="a2ui-week-items">
                  {items.map((item, itemIndex) => {
                    const name = a2ToStr(item.name ?? "일정");
                    const color = a2ToStr(item.color ?? "#FFE6C2");

                    return (
                      <div
                        key={a2ToStr(item.id ?? `${dateText}-${itemIndex}`)}
                        className="a2ui-week-event"
                        title={name}
                        style={{ "--a2ui-week-event-bg": color } as React.CSSProperties}
                      >
                        {name}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---- BarChart --------------------------------------------------
function A2UIBarChart({ comp, scopeBase, ctx }: { comp: A2UIComponent; scopeBase: string; ctx: A2UICtx }) {
  const model = ctx.model;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rowsRef = (comp.rows as any)?.path;
  const rows = (a2Get(model, rowsRef, scopeBase) || []) as Record<string, unknown>[];
  const labelKey = (comp.labelKey as string) || "label";
  const valueKey = (comp.valueKey as string) || "value";
  const gradeKey = comp.gradeKey as string | undefined;
  const values = rows.map((row) => Number(row[valueKey] ?? 0)).filter((value) => Number.isFinite(value));
  const max = Number(comp.max ?? Math.max(...values, 0)) || 1;

  return (
    <div className="a2ui-bar-chart">
      {rows.map((row, i) => {
        const label = a2ToStr(row[labelKey]);
        const value = Number(row[valueKey] ?? 0);
        const pct = Math.max(0, Math.min(100, (value / max) * 100));
        const grade = gradeKey ? a2ToStr(row[gradeKey]) : "";

        return (
          <div key={i} className="a2ui-bar-row">
            <div className="a2ui-bar-label" title={label}>{label}</div>
            <div className="a2ui-bar-track" aria-label={`${label} ${value}`}>
              <div className="a2ui-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="a2ui-bar-value">
              <strong>{Number.isFinite(value) ? value : 0}</strong>
              {grade && <span>{grade}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- ActvScoreSummaryCard -------------------------------------
function A2UIActvScoreSummaryCard({ comp, scopeBase, ctx }: { comp: A2UIComponent; scopeBase: string; ctx: A2UICtx }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value = a2Resolve((comp as any).value, ctx.model, scopeBase) as Record<string, unknown> | null;
  const title = a2ToStr(value?.title ?? comp.title ?? "종합 안전활동 점수");
  const score = Number(value?.score ?? 0) || 0;
  const maxScore = Number(value?.maxScore ?? 100) || 100;
  const gradeName = a2ToStr(value?.gradeName ?? "-");
  const gradeTone = a2ToStr(value?.gradeTone ?? "etc");
  const previousLabel = a2ToStr(value?.previousLabel ?? "상반기 대비 +0점");
  const siteName = a2ToStr(value?.siteName ?? "-");
  const tenantName = a2ToStr(value?.tenantName ?? "");
  const periodLabel = a2ToStr(value?.periodLabel ?? "");
  const collectedAt = a2ToStr(value?.collectedAt ?? "");
  const insight = a2ToStr(value?.insight ?? "");
  const averageScore = Number(value?.averageScore ?? 0) || 0;
  const averageDeltaText = a2ToStr(value?.averageDeltaText ?? "+0점");
  const gradeCounts = Array.isArray(value?.gradeCounts)
    ? (value.gradeCounts as Record<string, unknown>[])
    : [];
  const scoreItems = Array.isArray(value?.scoreItems)
    ? (value.scoreItems as Record<string, unknown>[])
    : [];
  const deltaTone = averageDeltaText.trim().startsWith("-") ? "bad" : "good";
  const averageLabel = tenantName ? `${tenantName} 테넌트 평균` : `<${siteName}> 전체 사업장 평균`;

  return (
    <div className="a2ui-actv-card">
      <section className="a2ui-actv-score">
        <div className="a2ui-actv-title">{title}</div>
        <div className="a2ui-actv-meta">
          <strong>{siteName}</strong>
          {(tenantName || periodLabel || collectedAt) && (
            <span>
              {[tenantName, periodLabel, collectedAt].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
        <div className="a2ui-actv-main">
          <strong className={gradeTone}>{score}</strong>
          <span>/ {maxScore}점</span>
          <em className={`a2ui-actv-badge ${gradeTone}`}>{gradeName}</em>
        </div>
        <div className="a2ui-actv-prev">
          <span aria-hidden="true">-</span>
          <b>{previousLabel}</b>
        </div>
        <div className="a2ui-actv-average">
          <span className="a2ui-actv-people">{ICONS.activity}</span>
          <span>{averageLabel}</span>
          <strong>{averageScore}점 대비</strong>
          <b className={deltaTone}>{averageDeltaText}</b>
        </div>
        {insight && <p className="a2ui-actv-insight">{insight}</p>}
      </section>
      <section className="a2ui-actv-counts">
        <div className="a2ui-actv-title">평가 별 개수</div>
        <div className="a2ui-actv-count-grid">
          {gradeCounts.map((item) => {
            const label = a2ToStr(item.label ?? "-");
            const tone = a2ToStr(item.tone ?? "etc");
            const count = Number(item.count ?? 0) || 0;

            return (
              <div key={label} className="a2ui-actv-count-box">
                <div className={`a2ui-actv-count-label ${tone}`}>{label}</div>
                <div className="a2ui-actv-count-value">
                  <strong>{count}</strong>
                  <span>개</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      {scoreItems.length > 0 && (
        <section className="a2ui-actv-items">
          <div className="a2ui-actv-title">안전활동 항목별 점수</div>
          <div className="a2ui-actv-item-list">
            {scoreItems.map((item, index) => {
              const name = a2ToStr(item.name ?? "-");
              const itemScore = Number(item.score ?? 0) || 0;
              const percent = Number(item.percent ?? 0) || 0;
              const caseCount = Number(item.caseCount ?? 0) || 0;
              const unitName = a2ToStr(item.unitName ?? "점");
              const unitDescription = a2ToStr(item.unitDescription ?? "");
              const itemGradeName = a2ToStr(item.gradeName ?? "-");
              const itemGradeTone = a2ToStr(item.gradeTone ?? "etc");
              const latestScoreDate = a2ToStr(item.latestScoreDate ?? "");
              const recommendedCycle = a2ToStr(item.recommendedCycle ?? "");
              const progress = Math.max(0, Math.min(100, itemScore || percent));

              return (
                <div key={`${name}-${index}`} className="a2ui-actv-item">
                  <div className="a2ui-actv-item-head">
                    <div>
                      <strong>{name}</strong>
                      <span>{[unitDescription, latestScoreDate && `최종 ${latestScoreDate}`, recommendedCycle && `권장 ${recommendedCycle}`].filter(Boolean).join(" · ")}</span>
                    </div>
                    <em className={`a2ui-actv-badge ${itemGradeTone}`}>{itemGradeName}</em>
                  </div>
                  <div className={`a2ui-actv-item-bar ${itemGradeTone}`} aria-hidden="true">
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  <div className="a2ui-actv-item-foot">
                    <b>{itemScore}{unitName}</b>
                    <span>이행률 {percent}% · 누적 {caseCount}건</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

// ---- PendingApprovalListCard -----------------------------------
function A2UIPendingApprovalListCard({ comp, scopeBase, ctx }: { comp: A2UIComponent; scopeBase: string; ctx: A2UICtx }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value = a2Resolve((comp as any).value, ctx.model, scopeBase) as Record<string, unknown> | null;
  const title = a2ToStr(value?.title ?? comp.title ?? "결재 대기 중 문서");
  const total = Number(value?.total ?? 0) || 0;
  const updatedAt = a2ToStr(value?.updatedAt ?? "");
  const description = a2ToStr(value?.description ?? "");
  const documents = Array.isArray(value?.documents)
    ? (value.documents as Record<string, unknown>[])
    : [];

  return (
    <div className="a2ui-approval-card">
      <div className="a2ui-approval-head">
        <div className="a2ui-approval-title">
          <span>{title}</span>
          <strong>{total}</strong>
        </div>
        {updatedAt && <div className="a2ui-approval-updated">업데이트 {updatedAt}</div>}
      </div>
      <div className="a2ui-approval-body">
        {description && <div className="a2ui-approval-desc">{description}</div>}
        <div className="a2ui-approval-list" role="list" aria-label={`${title} ${total}건`}>
          {documents.map((item, index) => {
            const siteName = a2ToStr(item.siteName ?? "-");
            const documentType = a2ToStr(item.documentType ?? "-");
            const draftedAt = a2ToStr(item.draftedAt ?? "-");
            const drafterName = a2ToStr(item.drafterName ?? "-");
            const drafterRole = a2ToStr(item.drafterRole ?? "-");
            const standbyRoleName = a2ToStr(item.standbyRoleName ?? "-");
            const roleTone = a2ToStr(item.roleTone ?? "approval");
            const detail = `${documentType} (${draftedAt}) / ${drafterName} | ${drafterRole}`;

            return (
              <div key={a2ToStr(item.id ?? index)} className="a2ui-approval-item" role="listitem">
                <div className="a2ui-approval-main">
                  <strong>{siteName}</strong>
                  <span title={detail}>
                    <b>{documentType}</b> ({draftedAt}) / {drafterName} | {drafterRole}
                  </span>
                </div>
                <span className={`a2ui-approval-pill ${roleTone}`}>
                  <i aria-hidden="true" />
                  {standbyRoleName}
                </span>
              </div>
            );
          })}
          {documents.length === 0 && (
            <div className="a2ui-approval-empty">결재 대기 중인 문서가 없습니다.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- CompletionGaugeCard ---------------------------------------
function A2UICompletionGaugeCard({ comp, scopeBase, ctx }: { comp: A2UIComponent; scopeBase: string; ctx: A2UICtx }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value = a2Resolve((comp as any).value, ctx.model, scopeBase) as Record<string, unknown> | null;
  const title = a2ToStr(value?.title ?? comp.title ?? "이행률");
  const percent = Math.max(0, Math.min(100, Number(value?.percent ?? 0) || 0));
  const completed = Number(value?.completed ?? 0) || 0;
  const inProgress = Number(value?.inProgress ?? 0) || 0;
  const total = Number(value?.total ?? completed + inProgress) || 0;
  const [activeTooltip, setActiveTooltip] = useState<"completed" | "progress" | null>(null);
  const progressPercent = Math.max(0, 100 - percent);
  const progressDisplayPercent = total > 0
    ? Math.max(0, Math.min(100, Math.round((inProgress / total) * 100)))
    : progressPercent;
  const pointOnGauge = (startPercent: number, sweepPercent: number) => {
    const midPercent = startPercent + sweepPercent / 2;
    const angle = (180 - midPercent * 1.8) * Math.PI / 180;
    const x = 99 + 83 * Math.cos(angle);
    const y = 99 - 83 * Math.sin(angle);
    return {
      x: Math.max(45, Math.min(153, x)),
      y: Math.max(2, Math.min(58, y - 24)),
    };
  };
  const completedPoint = pointOnGauge(0, percent || 1);
  const progressPoint = pointOnGauge(percent, progressPercent || 1);
  const tooltip = activeTooltip === "progress"
    ? {
        label: "진행중",
        detail: `${inProgress}건 (${progressDisplayPercent}%)`,
        x: progressPoint.x,
        y: progressPoint.y,
      }
    : {
        label: "완료",
        detail: `${completed}건 (${percent}%)`,
        x: completedPoint.x,
        y: completedPoint.y,
      };

  return (
    <div className="a2ui-completion-card">
      <div className="a2ui-completion-head">
        <div className="a2ui-completion-title">{title}</div>
        {/* <span className="a2ui-completion-chev">{ICONS.chevron}</span> */}
      </div>
      <div className="a2ui-completion-body">
        <div
          className="a2ui-completion-gauge"
          aria-label={`${title} ${percent}%`}
          onMouseLeave={() => setActiveTooltip(null)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setActiveTooltip(null);
            }
          }}
        >
          <svg className="a2ui-completion-svg" viewBox="0 0 198 104" aria-hidden="true">
            <path className="a2ui-completion-track" d="M 16 99 A 83 83 0 0 1 182 99" pathLength={100} />
            {percent > 0 && (
              <path
                className="a2ui-completion-arc done"
                d="M 16 99 A 83 83 0 0 1 182 99"
                pathLength={100}
                strokeDasharray={`${percent} ${100 - percent}`}
              />
            )}
            {progressPercent > 0 && (
              <path
                className="a2ui-completion-hit progress"
                d="M 16 99 A 83 83 0 0 1 182 99"
                pathLength={100}
                strokeDasharray={`${progressPercent} ${percent}`}
                strokeDashoffset={-percent}
                tabIndex={0}
                role="img"
                aria-label={`진행중 ${inProgress}건 ${progressDisplayPercent}%`}
                onMouseEnter={() => setActiveTooltip("progress")}
                onFocus={() => setActiveTooltip("progress")}
              />
            )}
            {percent > 0 && (
              <path
                className="a2ui-completion-hit done"
                d="M 16 99 A 83 83 0 0 1 182 99"
                pathLength={100}
                strokeDasharray={`${percent} ${100 - percent}`}
                tabIndex={0}
                role="img"
                aria-label={`완료 ${completed}건 ${percent}%`}
                onMouseEnter={() => setActiveTooltip("completed")}
                onFocus={() => setActiveTooltip("completed")}
              />
            )}
          </svg>
          <div
            className={"a2ui-completion-tooltip" + (activeTooltip ? " on" : "")}
            role="tooltip"
            style={{
              "--a2ui-tip-x": `${tooltip.x}px`,
              "--a2ui-tip-y": `${tooltip.y}px`,
            } as React.CSSProperties}
          >
            <span>{tooltip.label}</span>
            <span>{tooltip.detail}</span>
          </div>
          <div className="a2ui-completion-value">
            <strong>{percent}</strong>
            <span>%</span>
          </div>
        </div>
        <div className="a2ui-completion-stats">
          <div className="a2ui-completion-stat">
            <span className="a2ui-completion-dot primary" />
            <span className="a2ui-completion-label">완료</span>
            <strong>{completed}</strong>
            <span className="a2ui-completion-unit">건</span>
          </div>
          <div className="a2ui-completion-stat">
            <span className="a2ui-completion-dot muted" />
            <span className="a2ui-completion-label">진행중(미조치)</span>
            <strong className="muted">{inProgress}</strong>
            <span className="a2ui-completion-unit">건</span>
          </div>
          <div className="a2ui-completion-rule" />
          <div className="a2ui-completion-stat total">
            <span className="a2ui-completion-dot total" />
            <span className="a2ui-completion-label">전체</span>
            <strong>{total}</strong>
            <span className="a2ui-completion-unit">건</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- OpertPlanStatusCard ---------------------------------------
function A2UIOpertPlanStatusCard({ comp, scopeBase, ctx }: { comp: A2UIComponent; scopeBase: string; ctx: A2UICtx }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value = a2Resolve((comp as any).value, ctx.model, scopeBase) as Record<string, unknown> | null;
  const title = a2ToStr(value?.title ?? comp.title ?? "작업계획서 실시간 처리 상태");
  const waitCount = Number(value?.waitCount ?? 0) || 0;
  const completedCount = Number(value?.completedCount ?? 0) || 0;
  const statuses = [
    { label: "계획 작성 중", count: Number(value?.writingCount ?? 0) || 0, color: "#7AB6F0" },
    { label: "계획 결재 중", count: Number(value?.progressCount ?? 0) || 0, color: "#7C3AED" },
    { label: "작업 승인", count: Number(value?.approvalCount ?? 0) || 0, color: "#F5B400" },
    { label: "작업 완료", count: completedCount, color: "#08B86F" },
  ];
  const rawFormats = Array.isArray(value?.formats)
    ? (value.formats as Record<string, unknown>[]).map((item, index) => ({
        label: a2ToStr(item.label ?? item.typeNm ?? item.name ?? `구분 ${index + 1}`),
        count: Number(item.count ?? item.cnt ?? item.typeCnt ?? item.value ?? item.comptCnt ?? item.completedCnt ?? item.totCnt ?? 0) || 0,
        color: ["#7B74F2", "#7AB6F0", "#08B86F", "#F5B400", "#F97316"][index % 5],
      }))
    : [];
  const formats = completedCount > 0 && rawFormats.reduce((sum, item) => sum + item.count, 0) === 0
    ? [{ label: "작업 완료", count: completedCount, color: "#08B86F" }]
    : rawFormats;
  const formatTotal = formats.reduce((sum, item) => sum + item.count, 0);
  let running = 0;
  const segments = formats
    .filter((item) => item.count > 0 && formatTotal > 0)
    .map((item) => {
      const start = (running / formatTotal) * 360;
      running += item.count;
      const end = (running / formatTotal) * 360;
      return `${item.color} ${start}deg ${end}deg`;
    });
  const donutBackground = segments.length
    ? `conic-gradient(${segments.join(", ")})`
    : "var(--a2ui-opert-empty)";
  const statusTotal = waitCount + statuses.reduce((sum, item) => sum + item.count, 0);
  const statusDenom = Math.max(statusTotal, 1);
  const formatDenom = Math.max(formatTotal, 1);
  const percentText = (count: number, denom: number) => `${Math.round((count / denom) * 100)}%`;

  return (
    <div className="a2ui-opert-card">
      <div className="a2ui-opert-head">
        <div className="a2ui-opert-title">{title}</div>
        {/* <span className="a2ui-opert-chev">{ICONS.chevron}</span> */}
      </div>
      <div className="a2ui-opert-body">
        <section className="a2ui-opert-left">
          <div className="a2ui-opert-section-title">작업 상태별 실시간 건수</div>
          <div
            className="a2ui-opert-wait a2ui-opert-tip-host"
            tabIndex={0}
            aria-label={`작업 대기 ${waitCount}건 ${percentText(waitCount, statusDenom)}`}
          >
            <span>작업 대기</span>
            <strong>{waitCount}</strong>
            <em>건</em>
            <div className="a2ui-opert-tooltip" role="tooltip">
              <span>작업 대기</span>
              <span>{waitCount}건 ({percentText(waitCount, statusDenom)})</span>
            </div>
          </div>
          <div className="a2ui-opert-divider" />
          <div className="a2ui-opert-status-list">
            {statuses.map((item) => (
              <div
                key={item.label}
                className="a2ui-opert-status a2ui-opert-tip-host"
                tabIndex={0}
                aria-label={`${item.label} ${item.count}건 ${percentText(item.count, statusDenom)}`}
              >
                <span className="a2ui-opert-dot" style={{ background: item.color }} />
                <span className="a2ui-opert-label">{item.label}</span>
                <strong style={{ color: item.color }}>{item.count}</strong>
                <em>건</em>
                <div className="a2ui-opert-tooltip" role="tooltip">
                  <span>{item.label}</span>
                  <span>{item.count}건 ({percentText(item.count, statusDenom)})</span>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="a2ui-opert-right">
          <div className="a2ui-opert-section-title">완료 작업 구분별 누적 현황</div>
          <div
            className="a2ui-opert-donut"
            style={{ "--a2ui-opert-donut": donutBackground } as React.CSSProperties}
            aria-label={`완료 작업 ${formatTotal}건`}
            tabIndex={0}
          >
            <div className="a2ui-opert-donut-hole">
              <strong>{formatTotal}</strong>
              <span>건</span>
            </div>
            <div className="a2ui-opert-tooltip a2ui-opert-donut-tooltip" role="tooltip">
              <span>완료 작업</span>
              <span>{formatTotal}건 ({percentText(formatTotal, statusDenom)})</span>
            </div>
          </div>
          {formats.length > 0 && (
            <div className="a2ui-opert-format-list">
              {formats.map((item) => (
                <div
                  key={item.label}
                  className="a2ui-opert-format a2ui-opert-tip-host"
                  tabIndex={0}
                  aria-label={`${item.label} ${item.count}건 ${percentText(item.count, formatDenom)}`}
                >
                  <span className="a2ui-opert-dot" style={{ background: item.color }} />
                  <span>{item.label}</span>
                  <strong>{item.count}</strong>
                  <div className="a2ui-opert-tooltip" role="tooltip">
                    <span>{item.label}</span>
                    <span>{item.count}건 ({percentText(item.count, formatDenom)})</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="a2ui-opert-note">* 작업 완료 기준</div>
        </section>
      </div>
    </div>
  );
}

// ---- OpertStopStatusCard ---------------------------------------
function A2UIOpertStopStatusCard({ comp, scopeBase, ctx }: { comp: A2UIComponent; scopeBase: string; ctx: A2UICtx }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value = a2Resolve((comp as any).value, ctx.model, scopeBase) as Record<string, unknown> | null;
  const title = a2ToStr(value?.title ?? comp.title ?? "작업중지 요청 처리 현황");
  const total = Number(value?.total ?? 0) || 0;
  const waiting = Number(value?.waiting ?? 0) || 0;
  const approval = Number(value?.approval ?? 0) || 0;
  const reserved = Number(value?.reserved ?? 0) || 0;
  const [activeStopTooltip, setActiveStopTooltip] = useState<"waiting" | "approval" | "reserved" | null>(null);
  const denom = total > 0 ? total : Math.max(waiting + approval + reserved, 1);
  const waitingPct = Math.max(0, (waiting / denom) * 100);
  const approvalPct = Math.max(0, (approval / denom) * 100);
  const reservedPct = Math.max(0, 100 - waitingPct - approvalPct);
  const stopSegments = [
    { key: "waiting" as const, label: "대기", count: waiting, percent: waitingPct, start: 0 },
    { key: "approval" as const, label: "승인", count: approval, percent: approvalPct, start: waitingPct },
    { key: "reserved" as const, label: "보류", count: reserved, percent: reservedPct, start: waitingPct + approvalPct },
  ];
  const activeStopSegment = stopSegments.find((item) => item.key === activeStopTooltip);
  const stopTooltipX = activeStopSegment
    ? Math.max(8, Math.min(92, activeStopSegment.start + activeStopSegment.percent / 2))
    : 50;
  const stopTooltipPercent = activeStopSegment
    ? Math.round((activeStopSegment.count / denom) * 100)
    : 0;

  return (
    <div className="a2ui-stop-card">
      <div className="a2ui-stop-head">
        <div className="a2ui-stop-title">{title}</div>
        {/* <span className="a2ui-stop-chev">{ICONS.chevron}</span> */}
      </div>
      <div className="a2ui-stop-body">
        <div className="a2ui-stop-section-title">대기 중 상태의 요청 건</div>
        <div className="a2ui-stop-wait">
          <span className="a2ui-stop-siren" aria-hidden="true" />
          <div className="a2ui-stop-count">
            <strong>{waiting}</strong>
            <span>건</span>
          </div>
        </div>
        <div className="a2ui-stop-divider" />
        <div className="a2ui-stop-total-label">전체 누적</div>
        <div
          className="a2ui-stop-stack-wrap"
          onMouseLeave={() => setActiveStopTooltip(null)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setActiveStopTooltip(null);
            }
          }}
        >
          <div
            className={"a2ui-stop-tooltip" + (activeStopTooltip ? " on" : "")}
            role="tooltip"
            style={{ "--a2ui-stop-tip-x": `${stopTooltipX}%` } as React.CSSProperties}
          >
            <span>{activeStopSegment?.label ?? ""}</span>
            <span>{activeStopSegment ? `${activeStopSegment.count}건 (${stopTooltipPercent}%)` : ""}</span>
          </div>
          <div className="a2ui-stop-stack" aria-label={`전체 누적 ${total}건`}>
            {stopSegments.map((item) => item.percent > 0 && (
              <span
                key={item.key}
                className={item.key}
                style={{ width: `${item.percent}%` }}
                tabIndex={0}
                role="img"
                aria-label={`${item.label} ${item.count}건 ${Math.round((item.count / denom) * 100)}%`}
                onMouseEnter={() => setActiveStopTooltip(item.key)}
                onFocus={() => setActiveStopTooltip(item.key)}
              />
            ))}
          </div>
        </div>
        <div className="a2ui-stop-legend">
          <div className="a2ui-stop-legend-row">
            <span className="a2ui-stop-dot approval" />
            <span>승인</span>
            <strong>{approval}</strong>
            <em>건</em>
          </div>
          <div className="a2ui-stop-legend-row muted">
            <span className="a2ui-stop-dot reserved" />
            <span>보류</span>
            <strong>{reserved}</strong>
            <em>건</em>
          </div>
        </div>
      </div>
    </div>
  );
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
      } as A2UIActionPayloadWithFiles;
      const files = surfaceFiles(ctx.surface.surfaceId);
      if (files.length) payload.files = files;
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
  const inputType = comp.variant === "number"
    ? "number"
    : comp.variant === "datetime"
      ? "datetime-local"
      : "text";
  const set = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    ctx.onData(a2AbsPath(path, scopeBase), e.target.value);
  return (
    <label className="a2ui-field">
      {comp.label != null && <span className="a2ui-label">{comp.label as string}</span>}
      {long
        ? <textarea className={"a2ui-input a2ui-textarea" + (showErr ? " err" : "")} value={val}
            rows={3} maxLength={comp.maxLength as number | undefined} placeholder={(comp.placeholder as string) || ""} onChange={set} onBlur={() => setTouched(true)} />
        : <input className={"a2ui-input" + (showErr ? " err" : "")} value={val}
            type={inputType} readOnly={!!comp.readonly} placeholder={(comp.placeholder as string) || ""}
            onChange={set} onBlur={() => setTouched(true)} />}
      {showErr && <span className="a2ui-err">{check.message}</span>}
    </label>
  );
}

// ---- FileUpload -----------------------------------------------
function A2UIFileUpload({ comp, scopeBase, ctx }: { comp: A2UIComponent; scopeBase: string; ctx: A2UICtx }) {
  const model = ctx.model;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const path = (comp.value as any)?.path;
  const absPath = a2AbsPath(path, scopeBase);
  const storeKey = fileStoreKey(ctx.surface.surfaceId, absPath);
  const files = (a2Get(model, path, scopeBase) || []) as Array<{ name: string; size: number; type: string }>;
  const maxFiles = Number(comp.maxFiles ?? 5);
  const maxSizeMb = Number(comp.maxSizeMb ?? 50);
  const accept = Array.isArray(comp.accept) ? (comp.accept as string[]) : [String(comp.accept || "")].filter(Boolean);
  const acceptText = accept.join(", ");
  const totalBytes = files.reduce((sum, file) => sum + Number(file.size || 0), 0);
  const formatBytes = (bytes: number) => {
    if (!bytes) return "0 Bytes";
    if (bytes < 1024) return `${bytes} Bytes`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };
  const update = (nextFiles: File[]) => {
    const limited = nextFiles.slice(0, maxFiles);
    A2UI_FILE_STORE.set(storeKey, limited);
    ctx.onData(absPath, limited.map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
    })));
  };
  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const current = A2UI_FILE_STORE.get(storeKey) || [];
    update([...current, ...Array.from(list)]);
  };

  return (
    <label className="a2ui-field">
      {comp.label != null && <span className="a2ui-label">{comp.label as string}</span>}
      <div className="a2ui-file-meta">
        파일 갯수: <strong>{files.length} / {maxFiles}</strong> ({acceptText}) <span>|</span> 최대 용량: <strong>{formatBytes(totalBytes)} / {maxSizeMb} MB</strong>
      </div>
      <div
        className="a2ui-file-drop"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          addFiles(event.dataTransfer.files);
        }}
      >
        <input
          type="file"
          multiple
          accept={acceptText}
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <span className="a2ui-file-ico">{ICONS.copy}</span>
        <span>파일을 선택하거나 드래그하여 첨부하세요.</span>
      </div>
      {files.length > 0 && (
        <div className="a2ui-file-list">
          {files.map((file, index) => (
            <span key={`${file.name}-${index}`} className="a2ui-file-chip">
              {file.name}
              <button type="button" onClick={() => update((A2UI_FILE_STORE.get(storeKey) || []).filter((_, i) => i !== index))}>{ICONS.close}</button>
            </span>
          ))}
        </div>
      )}
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
