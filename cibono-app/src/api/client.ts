import axios from "axios";

const baseURL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8080";

export const api = axios.create({
  baseURL,
  timeout: 8000,
});

export function explainNetworkHint(err: any) {
  const msg = String(err?.message || err);
  if (msg.includes("Network Error") || msg.includes("timeout")) {
    return `네트워크 오류 가능성:\n- 폰/PC 같은 Wi-Fi?\n- baseURL이 localhost가 아니라 PC IP?\n- Windows 방화벽 8080 허용?\n현재 baseURL: ${baseURL}`;
  }
  return msg;
}
