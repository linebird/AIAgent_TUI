import { API_ENDPOINTS } from "@/config/api";
import { STORAGE_KEYS } from "@/config/storage";
import { storedObjectId } from "@/lib/storage";

let refreshPromise: Promise<string> | null = null;

export function safeitAccessToken() {
  if (typeof window === "undefined") return "";

  return localStorage.getItem(STORAGE_KEYS.safeitAccessToken)
    || localStorage.getItem(STORAGE_KEYS.legacySafeitAccessToken)
    || "";
}

export function authHeaders() {
  const token = safeitAccessToken();
  const tenantId = storedObjectId(STORAGE_KEYS.activeTenant, STORAGE_KEYS.legacyActiveTenant);
  const workspaceId = storedObjectId(STORAGE_KEYS.activeWorkspace, STORAGE_KEYS.legacyActiveWorkspace);

  return {
    ...(token ? {
      safeit_access_token: token,
      "safeit-access-token": token,
    } : {}),
    ...(tenantId ? {
      "x-tanant-id": tenantId,
      "x-tenant-id": tenantId,
    } : {}),
    ...(workspaceId ? { "x-bplc-id": workspaceId } : {}),
  };
}

function refreshTokenValue() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEYS.refreshToken) || "";
}

function pickToken(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";

  const record = payload as Record<string, unknown>;
  for (const key of ["token", "access_token", "accessToken", "safeitAccessToken"]) {
    if (typeof record[key] === "string" && record[key]) return record[key] as string;
  }

  const data = record.data;
  if (data && typeof data === "object") {
    const dataRecord = data as Record<string, unknown>;
    for (const key of ["token", "access_token", "accessToken", "safeitAccessToken"]) {
      if (typeof dataRecord[key] === "string" && dataRecord[key]) return dataRecord[key] as string;
    }
  }

  return "";
}

function pickRefreshToken(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";

  const record = payload as Record<string, unknown>;
  if (typeof record.refresh_token === "string") return record.refresh_token;
  if (typeof record.refreshToken === "string") return record.refreshToken;

  const data = record.data;
  if (data && typeof data === "object") {
    const dataRecord = data as Record<string, unknown>;
    if (typeof dataRecord.refresh_token === "string") return dataRecord.refresh_token;
    if (typeof dataRecord.refreshToken === "string") return dataRecord.refreshToken;
  }

  return "";
}

async function requestRefreshToken(): Promise<string> {
  const refreshToken = refreshTokenValue();
  if (!refreshToken) throw new Error("Refresh token is missing.");

  const response = await fetch(API_ENDPOINTS.refreshToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(responseText || `HTTP ${response.status}`);
  }

  let payload: unknown = {};
  try {
    payload = responseText ? JSON.parse(responseText) : {};
  } catch {
    payload = {};
  }

  const token = pickToken(payload);
  if (!token) throw new Error("Refresh response token is missing.");

  localStorage.setItem(STORAGE_KEYS.safeitAccessToken, token);
  localStorage.setItem(STORAGE_KEYS.legacySafeitAccessToken, token);

  const nextRefreshToken = pickRefreshToken(payload);
  if (nextRefreshToken) {
    localStorage.setItem(STORAGE_KEYS.refreshToken, nextRefreshToken);
  }

  window.dispatchEvent(new Event("safeit-profile-change"));
  return token;
}

export async function refreshSafeitAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = requestRefreshToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function withAuthHeaders(init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers);
  Object.entries(authHeaders()).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return {
    ...init,
    headers,
  };
}

export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let response = await fetch(input, withAuthHeaders(init));
  if (response.status !== 401 && response.status !== 403) return response;

  await refreshSafeitAccessToken();
  response = await fetch(input, withAuthHeaders(init));
  return response;
}
