"use client";
import { useEffect, useState } from "react";
import { Pencil, Trash2, Sparkles, Settings, X } from "lucide-react";
import type { Session } from "@/types";
import { groupSessions } from "@/lib/utils";
import { API_ENDPOINTS } from "@/config/api";
import { STORAGE_KEYS } from "@/config/storage";
import { authFetch } from "@/lib/api-client";
import { readLocalList, readLocalObject } from "@/lib/storage";

interface Props {
  sessions: Session[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

function Group({ label, items, activeId, onSelect, onDelete }: {
  label: string; items: Session[]; activeId: string | null;
  onSelect: (id: string) => void; onDelete: (id: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div>
      <div className="sb-group-label">{label}</div>
      {items.map((s) => (
        <div
          key={s.id}
          className={"hist-item" + (s.id === activeId ? " active" : "")}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(s.id)}
          onKeyDown={(e) => { if (e.key === "Enter") onSelect(s.id); }}
        >
          <Sparkles size={15} style={{ opacity: s.id === activeId ? 1 : 0.45, flex: "none" }} />
          <span className="hi-title">{s.title}</span>
          <button
            className="hi-del"
            title="삭제"
            onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

function readStoredName(...keys: string[]) {
  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const name = parsed?.nm ?? parsed?.name ?? parsed?.tenantNm ?? parsed?.bplcNm;
      if (typeof name === "string" && name.trim()) return name;
    } catch {
      if (raw.trim()) return raw;
    }
  }

  return "";
}

function itemIdentity(item: Record<string, unknown> | null) {
  if (!item) return "";
  for (const key of ["id", "tenantId", "tenant_id", "bplcId", "bplc_id", "workspaceId", "value"]) {
    const value = item[key];
    if (value != null && value !== "") return String(value);
  }
  return JSON.stringify(item);
}

function optionLabel(item: Record<string, unknown>) {
  const name = item.nm ?? item.name ?? item.tenantNm ?? item.bplcNm;
  return typeof name === "string" && name.trim() ? name : "이름 없음";
}

function ProfileSettingsModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [tenants, setTenants] = useState<Record<string, unknown>[]>([]);
  const [workspaces, setWorkspaces] = useState<Record<string, unknown>[]>([]);
  const [activeTenantId, setActiveTenantId] = useState("");
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("");
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");

  useEffect(() => {
    if (!open) return;

    const nextTenants = readLocalList(STORAGE_KEYS.tenants);
    const nextWorkspaces = readLocalList(STORAGE_KEYS.workspaces);
    const activeTenant = readLocalObject(STORAGE_KEYS.activeTenant, STORAGE_KEYS.legacyActiveTenant);
    const activeWorkspace = readLocalObject(STORAGE_KEYS.activeWorkspace, STORAGE_KEYS.legacyActiveWorkspace);

    setTenants(nextTenants);
    setWorkspaces(nextWorkspaces);
    setActiveTenantId(itemIdentity(activeTenant));
    setActiveWorkspaceId(itemIdentity(activeWorkspace));
    setSettingsMessage("");
  }, [open]);

  if (!open) return null;

  const saveTenant = async (identity: string) => {
    const selected = tenants.find((item) => itemIdentity(item) === identity);
    if (!selected) return;
    localStorage.setItem(STORAGE_KEYS.activeTenant, JSON.stringify(selected));
    localStorage.setItem(STORAGE_KEYS.legacyActiveTenant, JSON.stringify(selected));
    setActiveTenantId(identity);
    setSettingsMessage("");
    onSaved();

    const tenantId = itemIdentity(selected);
    setLoadingWorkspaces(true);
    try {
      const response = await authFetch(API_ENDPOINTS.workplaces, {
        method: "GET",
        headers: {
          "x-tenant-id": tenantId,
        },
      });
      const responseText = await response.text();
      if (!response.ok) throw new Error(responseText || `HTTP ${response.status}`);

      const payload = responseText ? JSON.parse(responseText) as Record<string, unknown> : {};
      const nextWorkspaces = Array.isArray(payload.workplaces)
        ? payload.workplaces.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
        : [];

      setWorkspaces(nextWorkspaces);
      localStorage.setItem(STORAGE_KEYS.workspaces, JSON.stringify(nextWorkspaces));

      const firstWorkspace = nextWorkspaces[0] ?? null;
      if (firstWorkspace) {
        localStorage.setItem(STORAGE_KEYS.activeWorkspace, JSON.stringify(firstWorkspace));
        localStorage.setItem(STORAGE_KEYS.legacyActiveWorkspace, JSON.stringify(firstWorkspace));
        setActiveWorkspaceId(itemIdentity(firstWorkspace));
      } else {
        localStorage.removeItem(STORAGE_KEYS.activeWorkspace);
        localStorage.removeItem(STORAGE_KEYS.legacyActiveWorkspace);
        setActiveWorkspaceId("");
      }

      onSaved();
    } catch (error) {
      setSettingsMessage(`사업장 목록을 불러오지 못했습니다. ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setLoadingWorkspaces(false);
    }
  };

  const saveWorkspace = (identity: string) => {
    const selected = workspaces.find((item) => itemIdentity(item) === identity);
    if (!selected) return;
    localStorage.setItem(STORAGE_KEYS.activeWorkspace, JSON.stringify(selected));
    localStorage.setItem(STORAGE_KEYS.legacyActiveWorkspace, JSON.stringify(selected));
    setActiveWorkspaceId(identity);
    onSaved();
  };

  return (
    <div className="profile-scrim" onMouseDown={onClose}>
      <section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-settings-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="profile-modal-head">
          <div>
            <h2 id="profile-settings-title">환경 설정</h2>
            <p>사용할 테넌트와 사업장을 선택하세요.</p>
          </div>
          <button className="icon-btn" type="button" onClick={onClose} title="닫기">
            <X size={18} />
          </button>
        </div>

        <div className="profile-form">
          <label>
            <span>테넌트</span>
            <select value={activeTenantId} onChange={(event) => { void saveTenant(event.target.value); }}>
              <option value="" disabled>테넌트 선택</option>
              {tenants.map((tenant, index) => {
                const identity = itemIdentity(tenant);
                return <option key={`${identity}-${index}`} value={identity}>{optionLabel(tenant)}</option>;
              })}
            </select>
          </label>

          <label>
            <span>사업장</span>
            <select value={activeWorkspaceId} onChange={(event) => saveWorkspace(event.target.value)} disabled={loadingWorkspaces}>
              <option value="" disabled>{loadingWorkspaces ? "사업장 불러오는 중..." : "사업장 선택"}</option>
              {workspaces.map((workspace, index) => {
                const identity = itemIdentity(workspace);
                return <option key={`${identity}-${index}`} value={identity}>{optionLabel(workspace)}</option>;
              })}
            </select>
          </label>

          {tenants.length === 0 && workspaces.length === 0 && (
            <div className="profile-empty">로그인 후 테넌트와 사업장 목록을 확인할 수 있습니다.</div>
          )}
          {settingsMessage && <div className="profile-empty">{settingsMessage}</div>}

          <button className="profile-submit" type="button" onClick={onClose}>
            확인
          </button>
        </div>
      </section>
    </div>
  );
}

export default function Sidebar({ sessions, activeId, onSelect, onNew, onDelete }: Props) {
  const g = groupSessions(sessions);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profile, setProfile] = useState({
    tenantName: "테넌트를 선택하세요",
    workspaceName: "사업장을 선택하세요",
  });

  useEffect(() => {
    const loadProfile = () => {
      setProfile({
        tenantName: readStoredName(STORAGE_KEYS.legacyActiveTenant, STORAGE_KEYS.activeTenant) || "테넌트를 선택하세요",
        workspaceName: readStoredName(STORAGE_KEYS.activeWorkspace, STORAGE_KEYS.legacyActiveWorkspace) || "사업장을 선택하세요",
      });
    };

    loadProfile();
    window.addEventListener("storage", loadProfile);
    window.addEventListener("safeit-profile-change", loadProfile);

    return () => {
      window.removeEventListener("storage", loadProfile);
      window.removeEventListener("safeit-profile-change", loadProfile);
    };
  }, []);

  const refreshProfile = () => {
    setProfile({
      tenantName: readStoredName(STORAGE_KEYS.legacyActiveTenant, STORAGE_KEYS.activeTenant) || "테넌트를 선택하세요",
      workspaceName: readStoredName(STORAGE_KEYS.activeWorkspace, STORAGE_KEYS.legacyActiveWorkspace) || "사업장을 선택하세요",
    });
    window.dispatchEvent(new Event("safeit-profile-change"));
  };

  return (
    <aside className="sidebar">
      <div className="sb-inner">
        <div className="sb-top">
          <div className="brand">
            <div className="brand-mark" />
            <div>
              <div className="brand-name">Saferyn<b>Chat</b></div>
              <div className="brand-sub">AI Agent · 세이플린 지원 도우미</div>
            </div>
          </div>
          <button className="new-chat" onClick={onNew}>
            <Pencil size={17} />
            새 대화 시작
          </button>
        </div>

        <div className="sb-scroll">
          {sessions.length === 0 ? (
            <div style={{ padding: "16px 12px", color: "var(--text-faint)", fontSize: 13, lineHeight: 1.6 }}>
              아직 대화가 없어요.<br />새 대화를 시작해 보세요.
            </div>
          ) : (
            <>
              <Group label="오늘" items={g.today} activeId={activeId} onSelect={onSelect} onDelete={onDelete} />
              <Group label="지난 7일" items={g.week} activeId={activeId} onSelect={onSelect} onDelete={onDelete} />
              <Group label="이전" items={g.older} activeId={activeId} onSelect={onSelect} onDelete={onDelete} />
            </>
          )}
        </div>

        <div className="sb-foot">
          <div className="user-row">
            <div className="avatar">SE</div>
            <div className="user-meta">
              <div className="un">{profile.tenantName}</div>
              <div className="ue">{profile.workspaceName}</div>
            </div>
            <button className="icon-btn" style={{ width: 32, height: 32 }} title="설정" onClick={() => setSettingsOpen(true)}>
              <Settings size={17} />
            </button>
          </div>
        </div>
      </div>
      <ProfileSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} onSaved={refreshProfile} />
    </aside>
  );
}
