import { STORAGE_KEYS } from "@/config/storage";
import { storedObjectId } from "@/lib/storage";

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
