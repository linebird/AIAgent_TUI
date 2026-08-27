const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
// const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://saferynchat.mydaas.kr";

export const API_ENDPOINTS = {
  chatStream: `${API_BASE_URL}/chat/stream`,
  a2uiAction: `${API_BASE_URL}/a2ui/action`,
  login: `${API_BASE_URL}/api/saferyn/login`,
  refreshToken: `${API_BASE_URL}/api/saferyn/refresh-token`,
  workplaces: `${API_BASE_URL}/api/saferyn/workplaces`,
};
