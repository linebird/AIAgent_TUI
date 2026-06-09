export interface FileAttachment {
  name: string;
  size: string;
  icon: string;
}

export interface CoTStep {
  title: string;
  detail: string;
}

export interface Source {
  id: number;
  type: "code" | "doc" | "api" | "log" | "chart";
  icon: string;
  title: string;
  path: string;
  snippet: string;
  lang?: string;
  url: string;
  urlLabel: string;
}

// ---- A2UI types ------------------------------------------------
export interface A2UIComponent {
  id: string;
  component: string;
  [key: string]: unknown;
}

export interface A2UISurfaceState {
  surfaceId: string;
  catalogId: string;
  theme?: { primaryColor?: string; agentDisplayName?: string; iconUrl?: string };
  sendDataModel: boolean;
  version: string;
  components: Record<string, A2UIComponent>;
  dataModel: Record<string, unknown>;
  deleted: boolean;
}
// ----------------------------------------------------------------

export interface Message {
  id: string;
  role: "user" | "bot";
  text: string;
  files?: FileAttachment[];
  streaming?: boolean;
  phase?: "status" | "reasoning" | "answer" | "a2ui" | "done" | "stopped";
  statusText?: string;
  cot?: CoTStep[];
  cotRevealed?: number;
  sources?: Source[];
  feedback?: "up" | "down" | null;
  stopped?: boolean;
  a2uiState?: A2UISurfaceState | null;
}

export interface Session {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}

export interface Store {
  sessions: Session[];
  activeId: string | null;
}

export interface PanelState {
  open: boolean;
  sources: Source[] | null;
  focusId: number | null;
}
