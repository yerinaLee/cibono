// 마트별 로고 매핑 (store.name 문자열 기준)
// 실제 로고 이미지가 준비되면 assets/images/stores/ 아래 같은 파일명으로 덮어쓰면 자동 반영됨
const STORE_LOGOS: Record<string, ReturnType<typeof require>> = {
  "이마트": require("../../assets/images/stores/emart.png"),
  "이마트에브리데이": require("../../assets/images/stores/emart_everyday.png"),
  "GS더프레시": require("../../assets/images/stores/gs_fresh.png"),
  "롯데마트": require("../../assets/images/stores/lotte_mart.png"),
  "롯데슈퍼": require("../../assets/images/stores/lotte_super.png"),
  "코스트코": require("../../assets/images/stores/costco.png"),
};

export function getStoreLogo(storeName?: string | null) {
  if (!storeName) return null;
  return STORE_LOGOS[storeName] ?? null;
}
