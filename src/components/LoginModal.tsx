"use client";
import { useCallback, useState } from "react";
import { X } from "lucide-react";
import { API_ENDPOINTS } from "@/config/api";
import { STORAGE_KEYS } from "@/config/storage";

interface Props {
  open: boolean;
  onClose: () => void;
}

function pickToken(payload: unknown): string {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return String(payload ?? "");

  const record = payload as Record<string, unknown>;
  for (const key of ["access_token", "accessToken", "token", "safeitAccessToken"]) {
    if (typeof record[key] === "string") return record[key] as string;
  }

  const data = record.data;
  if (data && typeof data === "object") {
    const dataRecord = data as Record<string, unknown>;
    for (const key of ["access_token", "accessToken", "token", "safeitAccessToken"]) {
      if (typeof dataRecord[key] === "string") return dataRecord[key] as string;
    }
  }

  return JSON.stringify(payload);
}

function payloadRecord(payload: unknown) {
  return payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
}

export default function LoginModal({ open, onClose }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const submit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(API_ENDPOINTS.login, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(responseText || `HTTP ${response.status}`);
      }

      let payload: unknown = responseText;
      try {
        payload = responseText ? JSON.parse(responseText) : "";
      } catch {
        payload = responseText;
      }

      const token = pickToken(payload);
      localStorage.setItem(STORAGE_KEYS.safeitAccessToken, token);

      const record = payloadRecord(payload);
      const tenants = record.tenants;
      if (Array.isArray(tenants)) {
        localStorage.setItem(STORAGE_KEYS.tenants, JSON.stringify(tenants));
        localStorage.setItem(STORAGE_KEYS.activeTenant, JSON.stringify(tenants[0]));
        localStorage.setItem(STORAGE_KEYS.legacyActiveTenant, JSON.stringify(tenants[0]));
      } else {
        localStorage.removeItem(STORAGE_KEYS.tenants);
      }

      const workplaces = record.workplaces;
      if (Array.isArray(workplaces)) {
        localStorage.setItem(STORAGE_KEYS.workspaces, JSON.stringify(workplaces));
        localStorage.setItem(STORAGE_KEYS.legacyActiveWorkspace, JSON.stringify(workplaces[0]));
        localStorage.setItem(STORAGE_KEYS.activeWorkspace, JSON.stringify(workplaces[0]));
      } else {
        localStorage.removeItem(STORAGE_KEYS.workspaces);
      }

      window.dispatchEvent(new Event("safeit-profile-change"));
      setPassword("");
      onClose();
    } catch (error) {
      setMessage(`로그인 요청에 실패했습니다. ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }, [email, password, loading, onClose]);

  if (!open) return null;

  return (
    <div className="login-scrim" onMouseDown={onClose}>
      <section className="login-modal" aria-modal="true" role="dialog" aria-labelledby="login-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="login-head">
          <div>
            <h2 id="login-title">로그인</h2>
            <p>Saferyn 계정 정보를 입력하세요.</p>
          </div>
          <button className="icon-btn" type="button" onClick={onClose} title="닫기">
            <X size={18} />
          </button>
        </div>

        <form className="login-form" onSubmit={submit}>
          <label>
            <span>이메일</span>
            <input
              type="email"
              value={email}
              autoComplete="email"
              placeholder="name@example.com"
              required
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label>
            <span>비밀번호</span>
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              placeholder="비밀번호"
              required
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {message && <div className="login-message">{message}</div>}

          <button className="login-submit" type="submit" disabled={loading}>
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </section>
    </div>
  );
}
