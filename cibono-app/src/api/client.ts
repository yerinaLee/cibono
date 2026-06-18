import axios from "axios";
import { getIdToken } from "../auth/firebaseAuth";

const baseURL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8080";

export const api = axios.create({
  baseURL,
  timeout: 8000,
  headers: {
    "ngrok-skip-browser-warning": "true",
  },
});

// 모든 요청에 Firebase ID Token 자동 첨부
api.interceptors.request.use(async (config) => {
  const token = await getIdToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function proxyImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return `${baseURL}/proxy-image?url=${encodeURIComponent(url)}`;
}

export function explainNetworkHint(err: any) {
  const msg = String(err?.message || err);
  if (msg.includes("Network Error") || msg.includes("timeout")) {
    return `네트워크 오류 가능성:\n- 폰/PC 같은 Wi-Fi?\n- baseURL이 localhost가 아니라 PC IP?\n- Windows 방화벽 포트 허용?\n현재 baseURL: ${baseURL}`;
  }
  return msg;
}
