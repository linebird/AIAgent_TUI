export function readLocalObject(...keys: string[]) {
  if (typeof window === "undefined") return null;

  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  return null;
}

export function readLocalList(key: string) {
  if (typeof window === "undefined") return [];

  const raw = localStorage.getItem(key);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      : [];
  } catch {
    return [];
  }
}

export function storedObjectId(...keys: string[]) {
  const item = readLocalObject(...keys);
  if (!item) return "";

  for (const key of ["id", "tenantId", "tenant_id", "bplcId", "bplc_id", "workspaceId", "value"]) {
    const value = item[key];
    if (value != null && value !== "") return String(value);
  }

  return "";
}
