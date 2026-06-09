/**
 * A2UI v0.9 — Client-side logic (TypeScript port of a2ui.jsx helper functions)
 * Pure functions only — no React, no side effects
 */

import type { A2UISurfaceState, A2UIComponent } from "@/types";

export const A2UI_CATALOG_BASIC =
  "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json";

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
