/**
 * A2UI v0.9 — Client-side logic (TypeScript port of a2ui.jsx helper functions)
 * Pure functions only — no React, no side effects
 */

import type { A2UISurfaceState, A2UIComponent } from "@/types";

export const A2UI_CATALOG_BASIC =
  "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function extractJsonItems(payload: Record<string, unknown>): {
  items: Record<string, unknown>[];
  summary: Record<string, unknown>;
  shape: "approval" | "accident" | "activityScore" | "generic";
} | null {
  const inferShape = (items: Record<string, unknown>[]) => {
    if (items.some((item) => "bplcNm" in item && "totScore" in item && "totGrade" in item)) return "activityScore";
    if (items.some((item) => "approvalId" in item)) return "approval";
    return "generic";
  };
  const data = payload.data;

  if (Array.isArray(data)) {
    const items = data.filter((item): item is Record<string, unknown> => isRecord(item));
    if (!items.length) return null;

    return {
      items,
      summary: {},
      shape: inferShape(items),
    };
  }

  if (!isRecord(data)) return null;

  if (Array.isArray(data.acdntInfoDtls)) {
    const items = data.acdntInfoDtls.filter((item): item is Record<string, unknown> => isRecord(item));
    if (!items.length) return null;

    return {
      items,
      summary: data,
      shape: "accident",
    };
  }

  const listEntry = Object.entries(data).find(([, value]) => Array.isArray(value));
  if (!listEntry) return null;

  const listValue = listEntry[1] as unknown[];
  const items = listValue.filter((item): item is Record<string, unknown> => isRecord(item));
  if (!items.length) return null;

  return {
    items,
    summary: data,
    shape: inferShape(items),
  };
}

function looksLikeTenantInfo(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value).map((key) => key.toLowerCase());
  const hasTenantId = keys.includes("tenantid") || keys.includes("tenant_id");
  const hasTenantName = keys.includes("tenantname") || keys.includes("tenant_name") || keys.includes("tenantnm") || keys.includes("tenant_nm");
  const hasSafetyTenantShape = keys.includes("id") && keys.includes("nm") && (
    keys.includes("prodtype") ||
    keys.includes("ramatrix") ||
    keys.includes("industryse")
  );

  if ((hasTenantId || hasTenantName) || hasSafetyTenantShape) return true;

  return keys.some((key) => (
    key === "tenantid" ||
    key === "tenant_id" ||
    key === "tenantname" ||
    key === "tenant_name" ||
    key === "tenantnm" ||
    key === "tenant_nm"
  ));
}

function pickTenantInfo(payload: Record<string, unknown>): Record<string, unknown> | null {
  const data = isRecord(payload.data) ? payload.data : null;
  const result = isRecord(payload.result) ? payload.result : null;
  const candidates = [
    data?.tenant,
    data?.tenantInfo,
    result?.tenant,
    result?.tenantInfo,
    payload.tenant,
    payload.tenantInfo,
    payload.result,
    payload.data,
    payload,
  ];

  for (const candidate of candidates) {
    if (!isRecord(candidate) || Array.isArray(candidate)) continue;
    if (looksLikeTenantInfo(candidate)) return candidate;
  }

  return null;
}

function pickTenantRoot(payload: Record<string, unknown>): Record<string, unknown> {
  if (isRecord(payload.data)) return payload.data;
  if (isRecord(payload.result)) return payload.result;
  return payload;
}

function humanizeTenantKey(key: string): string {
  const labels: Record<string, string> = {
    tenantId: "테넌트 ID",
    tenant_id: "테넌트 ID",
    tenantName: "테넌트명",
    tenant_name: "테넌트명",
    tenantNm: "테넌트명",
    tenant_nm: "테넌트명",
    companyName: "회사명",
    company_name: "회사명",
    bplcId: "사업장 ID",
    bplcNm: "사업장",
    status: "상태",
    statusNm: "상태",
    createdAt: "생성일시",
    created_at: "생성일시",
    updatedAt: "수정일시",
    updated_at: "수정일시",
  };
  if (labels[key]) return labels[key];
  return key
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function displayTenantValue(value: unknown): string {
  if (value == null || value === "") return "-";
  if (typeof value === "object") {
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value);
}

function pushTenantField(fields: Array<{ key: string; label: string; value: string }>, key: string, label: string, value: unknown) {
  const display = displayTenantValue(value);
  if (display === "-") return;
  fields.push({ key, label, value: display });
}

function buildTenantInfoEnvelope(payload: Record<string, unknown>): Array<Record<string, unknown>> | null {
  const tenant = pickTenantInfo(payload);
  if (!tenant) return null;

  const root = pickTenantRoot(payload);
  const service = isRecord(root.service) ? root.service : null;
  const emp = isRecord(root.emp) ? root.emp : null;
  const roles = isRecord(root.roles) ? root.roles : null;
  const authorities = Array.isArray(root.authorities) ? root.authorities : [];
  const activeBplcs = Array.isArray(root.activeBplcs)
    ? root.activeBplcs.filter((item): item is Record<string, unknown> => isRecord(item))
    : [];
  const activeBplcNames = activeBplcs.map((bplc) => displayTenantValue(bplc.nm)).filter((value) => value !== "-");
  const authorityNames = authorities
    .map((item) => isRecord(item) ? displayTenantValue(item.authority) : displayTenantValue(item))
    .filter((value) => value !== "-");
  const roleNames = roles ? Object.values(roles).map(displayTenantValue).filter((value) => value !== "-") : [];
  const tenantName = displayTenantValue(
    tenant.tenantName ?? tenant.tenant_name ?? tenant.tenantNm ?? tenant.tenant_nm ?? tenant.nm ?? tenant.companyName ?? tenant.company_name
  );
  const tenantId = displayTenantValue(tenant.tenantId ?? tenant.tenant_id ?? tenant.id);
  const message = typeof payload.message === "string" ? payload.message : "테넌트 정보 조회 결과";
  const fields: Array<{ key: string; label: string; value: string }> = [];

  pushTenantField(fields, "tenant-id", "테넌트 ID", tenantId);
  pushTenantField(fields, "tenant-name", "테넌트명", tenantName);
  pushTenantField(fields, "service-name", "서비스", service?.nm);
  pushTenantField(fields, "service-id", "서비스 ID", service?.id);
  pushTenantField(fields, "employee-name", "사용자", emp?.nm);
  pushTenantField(fields, "employee-email", "이메일", emp?.email ?? emp?.empId);
  pushTenantField(fields, "tenant-role", "테넌트 역할", emp?.tenantRole);
  pushTenantField(fields, "employee-status", "사용자 상태", emp?.status);
  pushTenantField(fields, "product-type", "상품 유형", tenant.prodType);
  pushTenantField(fields, "ra-matrix", "RA 매트릭스", tenant.raMatrix);
  pushTenantField(fields, "prior-ra-factor", "사전 RA 기준", tenant.priorRaFactor);
  pushTenantField(fields, "industry", "산업 구분", tenant.industrySe);
  pushTenantField(fields, "authorities", "권한", authorityNames.join(", "));
  pushTenantField(fields, "roles", "사업장 역할", Array.from(new Set(roleNames)).join(", "));
  pushTenantField(fields, "active-bplcs", "활성 사업장", activeBplcNames.length ? `${activeBplcNames.length}개 · ${activeBplcNames.join(", ")}` : "");

  if (!fields.length) {
    Object.entries(tenant)
      .filter(([, value]) => value !== undefined)
      .forEach(([key, value]) => {
        fields.push({
          key,
          label: humanizeTenantKey(key),
          value: displayTenantValue(value),
        });
      });
  }

  return [
    {
      createSurface: {
        surfaceId: "tenant-info-card",
        catalogId: A2UI_CATALOG_BASIC,
        theme: { primaryColor: "#0E7C66", agentDisplayName: "Tenant Bot" },
        sendDataModel: true,
      },
    },
    {
      updateComponents: {
        components: [
          { id: "root", component: "Card", child: "tenant-col" },
          { id: "tenant-col", component: "Column", children: ["tenant-head", "tenant-sub", "tenant-div", "tenant-fields"] },
          { id: "tenant-head", component: "Row", children: ["tenant-icon", "tenant-title"], align: "center" },
          { id: "tenant-icon", component: "Icon", name: "info", size: 19 },
          { id: "tenant-title", component: "Text", text: tenantName === "-" ? "테넌트 정보" : tenantName, variant: "h2" },
          { id: "tenant-sub", component: "Text", text: tenantId === "-" ? message : `${message} · ${tenantId}`, variant: "caption" },
          { id: "tenant-div", component: "Divider", axis: "horizontal" },
          { id: "tenant-fields", component: "List", children: { componentId: "tenant-field", path: "/fields" } },
          { id: "tenant-field", component: "Row", children: ["tenant-field-label", "tenant-field-value"], justify: "spaceBetween", gap: 16 },
          { id: "tenant-field-label", component: "Text", text: { path: "label" }, variant: "caption", weight: 1 },
          { id: "tenant-field-value", component: "Text", text: { path: "value" }, variant: "body", weight: 2 },
        ],
      },
    },
    {
      updateDataModel: {
        path: "/",
        value: {
          tenant,
          fields,
        },
      },
    },
  ];
}

export function a2JsonToEnvelope(payload: unknown): Array<Record<string, unknown>> | null {
  if (!isRecord(payload)) return null;

  const tenantInfoEnvelope = buildTenantInfoEnvelope(payload);
  if (tenantInfoEnvelope) return tenantInfoEnvelope;

  const extracted = extractJsonItems(payload);
  if (!extracted) return null;

  const { items, summary, shape } = extracted;
  const message = typeof payload.message === "string" ? payload.message : "조회 결과";
  const status = typeof payload.status === "number" ? payload.status : null;
  const title = shape === "accident"
    ? `사고 현황 · ${items.length}건`
    : shape === "activityScore"
      ? `사업장 활동 점수 · ${items.length}개 사업장`
    : `${message} · ${items.length}건`;
  const fallbackKeys = Array.from(new Set(items.flatMap((item) => Object.keys(item))))
    .filter((key) => items.some((item) => item[key] != null))
    .slice(0, 8);
  const approvalColumns = [
    { key: "gbNm", label: "구분", w: 180 },
    { key: "bplcNm", label: "사업장", w: 130 },
    { key: "statusNm", label: "상태", w: 90 },
    { key: "standbyApprovalRoleNm", label: "결재역할", w: 95 },
    { key: "draftEmpNm", label: "기안자", w: 90 },
    { key: "draftDt", label: "기안일시", w: 150 },
    { key: "approvalId", label: "결재 ID", w: 260 },
  ];
  const accidentColumns = [
    { key: "bplcNm", label: "사업장", w: 150 },
    { key: "disasterTypeNm", label: "재해유형", w: 100 },
    { key: "acdntDt", label: "사고일시", w: 160 },
    { key: "bplcId", label: "사업장 ID", w: 260 },
  ];
  const activityScoreColumns = [
    { key: "bplcNm", label: "사업장", w: 160 },
    { key: "totScore", label: "활동 점수", w: 90 },
    { key: "totGrade", label: "등급", w: 70 },
  ];
  const preferredColumns = shape === "approval"
    ? approvalColumns
    : shape === "accident"
      ? accidentColumns
      : shape === "activityScore"
        ? activityScoreColumns
      : null;
  const columns = (preferredColumns
    ? preferredColumns.filter((col) => items.some((item) => item[col.key] != null))
    : fallbackKeys.map((key) => ({ key, label: key, w: key.toLowerCase().includes("id") ? 240 : 140 }))
  ).map((col) => ({ ...col, kind: "text" }));

  const summaryText = shape === "accident" && isRecord(summary)
    ? `${summary.currentYear ?? "올해"}년 ${summary.currentYearCnt ?? items.length}건 · 전년 ${summary.prevYearCnt ?? 0}건`
    : shape === "activityScore"
      ? "사업장별 활동 점수 및 등급"
    : status == null ? "API JSON 응답" : `API JSON 응답 · HTTP ${status}`;

  const rootChildren = shape === "activityScore"
    ? ["json-title", "json-subtitle", "json-chart"]
    : ["json-title", "json-subtitle", "json-table"];

  const components: A2UIComponent[] = [
    { id: "root", component: "Column", children: rootChildren },
    { id: "json-title", component: "Text", text: title, variant: "title" },
    {
      id: "json-subtitle",
      component: "Text",
      text: summaryText,
      variant: "caption",
    },
    {
      id: "json-table",
      component: "DataTable",
      rows: { path: "/items" },
      columns,
    },
    {
      id: "json-chart",
      component: "BarChart",
      rows: { path: "/items" },
      labelKey: "bplcNm",
      valueKey: "totScore",
      gradeKey: "totGrade",
      max: 100,
    },
  ];

  return [
    {
      createSurface: {
        surfaceId: "json-data-surface",
        catalogId: A2UI_CATALOG_BASIC,
        theme: { primaryColor: "#2563EB", agentDisplayName: "JSON Result" },
        sendDataModel: true,
      },
    },
    {
      updateComponents: {
        components,
      },
    },
    {
      updateDataModel: {
        path: "/",
        value: {
          items,
          summary: {
            count: items.length,
            title: message,
            ...summary,
          },
        },
      },
    },
  ];
}

/* ---- JSON Pointer helpers (RFC 6901 + relative paths) ---- */
export function a2ParsePath(path: unknown, scopeBase?: string): string[] {
  if (path == null) return [];
  let full = String(path);
  if (full[0] !== "/") full = (scopeBase || "") + "/" + full;
  if (full === "/") return [];
  return full
    .split("/")
    .slice(1)
    .map((t) => t.replace(/~1/g, "/").replace(/~0/g, "~"));
}

export function a2AbsPath(path: unknown, scopeBase?: string): string {
  if (path == null) return "/";
  let full = String(path);
  if (full[0] !== "/") full = (scopeBase || "") + "/" + full;
  return full;
}

export function a2Get(
  model: Record<string, unknown> | unknown,
  path: unknown,
  scopeBase?: string
): unknown {
  const toks = a2ParsePath(path, scopeBase);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = model;
  for (const t of toks) {
    if (cur == null) return undefined;
    cur = cur[t];
  }
  return cur;
}

export function a2SetImmutable(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any,
  path: unknown,
  value: unknown,
  scopeBase?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const toks = a2ParsePath(path, scopeBase);
  if (toks.length === 0) return value;
  const root = Array.isArray(model) ? model.slice() : { ...(model || {}) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = root;
  for (let i = 0; i < toks.length - 1; i++) {
    const k = toks[i];
    const next = cur[k];
    cur[k] = Array.isArray(next) ? next.slice() : { ...(next || {}) };
    cur = cur[k];
  }
  const last = toks[toks.length - 1];
  if (value === undefined) {
    delete cur[last];
  } else {
    cur[last] = value;
  }
  return root;
}

/* ---- envelope application (pure) ----------------------------- */
export function a2ApplyEnvelope(
  surface: A2UISurfaceState | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  env: any
): A2UISurfaceState | null {
  if (!env || typeof env !== "object") return surface;

  if (env.createSurface) {
    const c = env.createSurface;
    return {
      surfaceId: c.surfaceId,
      catalogId: c.catalogId || A2UI_CATALOG_BASIC,
      theme: c.theme || null,
      sendDataModel: !!c.sendDataModel,
      version: env.version || "v0.9",
      components: {},
      dataModel: {},
      deleted: false,
    };
  }

  if (!surface) surface = { surfaceId: "", catalogId: A2UI_CATALOG_BASIC, sendDataModel: false, version: "v0.9", components: {}, dataModel: {}, deleted: false };

  if (env.updateComponents) {
    const u = env.updateComponents;
    const components = { ...surface.components };
    (u.components || []).forEach((comp: A2UIComponent) => {
      if (comp && comp.id) components[comp.id] = comp;
    });
    return { ...surface, components };
  }

  if (env.updateDataModel) {
    const u = env.updateDataModel;
    const dataModel = a2SetImmutable(surface.dataModel || {}, u.path || "/", u.value);
    return { ...surface, dataModel: dataModel == null ? {} : dataModel };
  }

  if (env.deleteSurface) {
    return { ...surface, deleted: true };
  }

  return surface;
}

/* ---- client-side function library ----------------------------- */
function a2ToStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") {
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return String(v);
}

function a2IsEmpty(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function a2FormatDate(value: unknown, fmt?: string): string {
  const d = value ? new Date(String(value)) : new Date();
  if (isNaN(d.getTime())) return a2ToStr(value);
  if (!fmt) return d.toLocaleString();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const mons = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const p2 = (n: number) => String(n).padStart(2, "0");
  const h12 = d.getHours() % 12 || 12;
  const map: Record<string, string | number> = {
    YYYY: d.getFullYear(), yyyy: d.getFullYear(),
    MMM: mons[d.getMonth()], MM: p2(d.getMonth() + 1),
    dd: p2(d.getDate()), d: d.getDate(),
    HH: p2(d.getHours()), mm: p2(d.getMinutes()), ss: p2(d.getSeconds()),
    h: h12, a: d.getHours() < 12 ? "AM" : "PM", E: days[d.getDay()],
  };
  return fmt.replace(/YYYY|yyyy|MMM|MM|dd|HH|mm|ss|\bE\b|\bd\b|\bh\b|\ba\b/g, (t) =>
    map[t] != null ? String(map[t]) : t
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const A2UI_FUNCTIONS: Record<string, (a: any) => unknown> = {
  required: (a) => !a2IsEmpty(a.value),
  regex: (a) => { try { return new RegExp(a.pattern).test(a2ToStr(a.value)); } catch { return false; } },
  length: (a) => { const n = a2ToStr(a.value).length; if (a.min != null && n < a.min) return false; if (a.max != null && n > a.max) return false; return true; },
  numeric: (a) => { const n = Number(a.value); if (isNaN(n)) return false; if (a.min != null && n < a.min) return false; if (a.max != null && n > a.max) return false; return true; },
  email: (a) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a2ToStr(a.value)),
  and: (a) => (a.values || []).every(Boolean),
  or: (a) => (a.values || []).some(Boolean),
  not: (a) => !a.value,
  concat: (a) => (a.values || []).map(a2ToStr).join(""),
  add: (a) => (a.values || []).reduce((s: number, n: unknown) => s + Number(n || 0), 0),
  formatNumber: (a) => { const n = Number(a.value); return isNaN(n) ? a2ToStr(a.value) : n.toLocaleString(undefined, { maximumFractionDigits: a.precision != null ? a.precision : 3 }); },
  formatCurrency: (a) => { const n = Number(a.value); return isNaN(n) ? a2ToStr(a.value) : n.toLocaleString(undefined, { style: "currency", currency: a.currency || "KRW" }); },
  formatDate: (a) => a2FormatDate(a.value, a.format),
  pluralize: (a) => { const n = Number(a.count); return n === 1 ? (a.one || "") : (a.other || ""); },
  now: () => new Date().toISOString(),
  upper: (a) => a2ToStr(a.value).toUpperCase(),
  lower: (a) => a2ToStr(a.value).toLowerCase(),
  openUrl: (a) => { try { window.open(a.url, "_blank", "noopener"); } catch {} return true; },
};

/* ---- dynamic value resolution --------------------------------- */
export function a2Resolve(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any,
  scopeBase?: string
): unknown {
  if (value == null) return value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => a2Resolve(v, model, scopeBase));
  if ("path" in value && Object.keys(value).length === 1) {
    return a2Get(model, value.path, scopeBase);
  }
  if ("call" in value) {
    return a2CallFn(value, model, scopeBase);
  }
  return value;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function a2CallFn(fc: any, model: any, scopeBase?: string): unknown {
  const name = fc.call;
  if (name === "formatString") {
    const raw = fc.args && fc.args.value != null ? fc.args.value : "";
    return a2Interpolate(a2ToStr(a2Resolve(raw, model, scopeBase)), model, scopeBase);
  }
  const fn = A2UI_FUNCTIONS[name];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const args: Record<string, any> = {};
  if (fc.args) for (const k of Object.keys(fc.args)) args[k] = a2Resolve(fc.args[k], model, scopeBase);
  if (!fn) return undefined;
  return fn(args);
}

/* formatString ${...} interpolation */
export function a2Interpolate(str: string, model: unknown, scopeBase?: string): string {
  let out = "", i = 0;
  while (i < str.length) {
    if (str[i] === "\\" && str[i + 1] === "$") { out += "$"; i += 2; continue; }
    if (str[i] === "$" && str[i + 1] === "{") {
      let depth = 0, j = i + 1;
      for (; j < str.length; j++) {
        if (str[j] === "{") depth++;
        else if (str[j] === "}") { depth--; if (depth === 0) break; }
      }
      out += a2ToStr(a2EvalExpr(str.slice(i + 2, j), model, scopeBase));
      i = j + 1;
    } else { out += str[i]; i++; }
  }
  return out;
}

function a2EvalExpr(expr: string, model: unknown, scopeBase?: string): unknown {
  expr = expr.trim();
  const fnMatch = expr.match(/^([a-zA-Z_]\w*)\s*\(([\s\S]*)\)$/);
  if (fnMatch) {
    const name = fnMatch[1];
    const args = a2ParseFnArgs(fnMatch[2], model, scopeBase);
    if (name === "formatString") return a2Interpolate(a2ToStr(args.value), model, scopeBase);
    const fn = A2UI_FUNCTIONS[name];
    return fn ? fn(args) : undefined;
  }
  if (/[/a-zA-Z]/.test(expr[0] || "")) return a2Get(model, expr, scopeBase);
  return expr;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function a2ParseFnArgs(s: string, model: unknown, scopeBase?: string): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const args: Record<string, any> = {};
  let depth = 0, cur = ""; const parts: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "{" || c === "(") depth++;
    if (c === "}" || c === ")") depth--;
    if (c === "," && depth === 0) { parts.push(cur); cur = ""; } else cur += c;
  }
  if (cur.trim()) parts.push(cur);
  parts.forEach((p) => {
    const idx = p.indexOf(":");
    if (idx < 0) return;
    const key = p.slice(0, idx).trim();
    const val = p.slice(idx + 1).trim();
    args[key] = a2EvalArgValue(val, model, scopeBase);
  });
  return args;
}

function a2EvalArgValue(val: string, model: unknown, scopeBase?: string): unknown {
  if (val.startsWith("${")) return a2Interpolate(val, model, scopeBase);
  if ((val[0] === "'" && val.endsWith("'")) || (val[0] === '"' && val.endsWith('"'))) return val.slice(1, -1);
  if (val === "true") return true;
  if (val === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(val)) return Number(val);
  if (val[0] === "/") return a2Get(model, val, scopeBase);
  return val;
}

/* ---- checks evaluation ---------------------------------------- */
export function a2RunChecks(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  checks: any[] | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any,
  scopeBase?: string
): { ok: boolean; message: string | null } {
  if (!checks || !checks.length) return { ok: true, message: null };
  for (const chk of checks) {
    const cond = chk.condition || { call: chk.call, args: chk.args };
    const pass = !!a2Resolve(cond, model, scopeBase);
    if (!pass) return { ok: false, message: chk.message || "유효하지 않은 값입니다." };
  }
  return { ok: true, message: null };
}

/* ---- icon name mapping ---------------------------------------- */
export const A2UI_ICON_MAP: Record<string, string> = {
  mail: "doc", alert: "alert", "alert-triangle": "alert", warning: "alert",
  rocket: "stream", deploy: "stream", server: "api", service: "api",
  activity: "chart", chart: "chart", calendar: "doc", clock: "refresh",
  check: "check", "check-circle": "check", search: "search", code: "code",
  log: "log", git: "git", settings: "settings", info: "doc", bell: "alert",
};

export { a2ToStr };
