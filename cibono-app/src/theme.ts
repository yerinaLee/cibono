// 앱 전역 색상 팔레트 — 모든 화면과 공용 컴포넌트가 공유한다.
// (하단 탭 바 app/(tabs)/_layout.tsx 는 탭 전용 별도 팔레트를 사용)
export const THEME = {
  bg: "#F3F8F1",
  surface: "#FFFFFF",
  text: "#1F2937",
  muted: "#6B7280",
  border: "rgba(31,41,55,0.10)",
  brand: "#7FB77E",
  brandInk: "#0F1F16",
  warn: "#F2C94C",
  danger: "#EB5757",
  ok: "#27AE60",
  greenBg: "rgba(127,183,126,0.18)",
  greenBd: "rgba(127,183,126,0.24)",
  redBg: "rgba(232,107,107,0.10)",
  redBd: "rgba(232,107,107,0.22)",
  redInk: "#5a1a1d",
  promoBg: "rgba(235,87,87,0.12)",
  promoBd: "rgba(235,87,87,0.28)",
  promoInk: "#C13F3F",
} as const;

export type Theme = typeof THEME;
