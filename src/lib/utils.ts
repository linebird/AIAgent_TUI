export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function genTitle(text: string): string {
  return text.trim().slice(0, 38) || "새 대화";
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function groupSessions<T extends { updatedAt?: number; createdAt?: number }>(sessions: T[]) {
  const now = Date.now();
  const DAY = 86400000;
  const g: { today: T[]; week: T[]; older: T[] } = { today: [], week: [], older: [] };
  for (const s of sessions) {
    const age = now - (s.updatedAt ?? s.createdAt ?? now);
    if (age < DAY) g.today.push(s);
    else if (age < DAY * 7) g.week.push(s);
    else g.older.push(s);
  }
  return g;
}

export function guessFileIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith(".log") || n.endsWith(".txt")) return "FileText";
  if (n.endsWith(".yaml") || n.endsWith(".yml") || n.endsWith(".json") || n.endsWith(".java")) return "Code";
  if (n.endsWith(".pdf") || n.endsWith(".md")) return "FileText";
  return "File";
}

export function fmtSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}
