import * as SecureStore from "expo-secure-store";

const FIREBASE_API_KEY = "AIzaSyCRmNGn7dCxrf_vJLc-wceroYkzZznrtnU";
const SIGN_IN_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`;
const REFRESH_URL = `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`;

const STORE_KEY_REFRESH = "firebase_refresh_token";
const STORE_KEY_EXPIRES = "firebase_expires_at";

// 메모리 캐시 (앱 세션 내)
let cachedIdToken: string | null = null;
let cachedExpiresAt: number = 0;

async function signInAnonymously(): Promise<{ idToken: string; refreshToken: string; expiresIn: string }> {
  const res = await fetch(SIGN_IN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  if (!res.ok) throw new Error(`Firebase 익명 로그인 실패: ${res.status}`);
  return res.json();
}

async function refreshIdToken(refreshToken: string): Promise<{ id_token: string; refresh_token: string; expires_in: string }> {
  const res = await fetch(REFRESH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  if (!res.ok) throw new Error(`Firebase 토큰 갱신 실패: ${res.status}`);
  return res.json();
}

function expiresAt(expiresInSeconds: string): number {
  return Date.now() + (parseInt(expiresInSeconds) - 60) * 1000; // 1분 여유
}

// 앱 시작 시 1회 호출 — 이후 getIdToken()으로 사용
export async function initFirebaseAuth(): Promise<string> {
  const storedRefresh = await SecureStore.getItemAsync(STORE_KEY_REFRESH);
  const storedExpires = await SecureStore.getItemAsync(STORE_KEY_EXPIRES);

  if (storedRefresh) {
    const expires = storedExpires ? parseInt(storedExpires) : 0;
    if (Date.now() < expires && cachedIdToken) {
      return cachedIdToken;
    }
    try {
      const data = await refreshIdToken(storedRefresh);
      cachedIdToken = data.id_token;
      cachedExpiresAt = expiresAt(data.expires_in);
      await SecureStore.setItemAsync(STORE_KEY_REFRESH, data.refresh_token);
      await SecureStore.setItemAsync(STORE_KEY_EXPIRES, String(cachedExpiresAt));
      console.log("[Auth] 토큰 갱신 완료");
      return cachedIdToken;
    } catch (e) {
      console.warn("[Auth] 갱신 실패, 재로그인:", e);
    }
  }

  // 신규 익명 로그인
  const data = await signInAnonymously();
  cachedIdToken = data.idToken;
  cachedExpiresAt = expiresAt(data.expiresIn);
  await SecureStore.setItemAsync(STORE_KEY_REFRESH, data.refreshToken);
  await SecureStore.setItemAsync(STORE_KEY_EXPIRES, String(cachedExpiresAt));
  console.log("[Auth] 익명 로그인 완료");
  return cachedIdToken;
}

// API 요청마다 호출 — 만료 시 자동 갱신
export async function getIdToken(): Promise<string | null> {
  if (cachedIdToken && Date.now() < cachedExpiresAt) {
    return cachedIdToken;
  }
  const storedRefresh = await SecureStore.getItemAsync(STORE_KEY_REFRESH);
  if (!storedRefresh) return null;
  try {
    const data = await refreshIdToken(storedRefresh);
    cachedIdToken = data.id_token;
    cachedExpiresAt = expiresAt(data.expires_in);
    await SecureStore.setItemAsync(STORE_KEY_REFRESH, data.refresh_token);
    await SecureStore.setItemAsync(STORE_KEY_EXPIRES, String(cachedExpiresAt));
    return cachedIdToken;
  } catch {
    return null;
  }
}
