import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import AppHeader from "../../components/AppHeader";
import {
    Image,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, explainNetworkHint } from "../../src/api/client";

type Inventory = {
  id: number;
  itemName: string;
  quantity: number;
  unit?: string | null;
  storage: string;
  expiresAt?: string | null; // YYYY-MM-DD
};

type Deal = {
  id: number;
  itemName: string;
  dealPrice: number;
  startsAt: string;
  endsAt: string;
};

type Suggestion = {
  name: string;
  imageUrl?: string;
  ingredients: string[];
  missingCount: number;
  score: number;
};

const THEME = {
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
};

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map((v) => Number(v));
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
}

export default function DashboardScreen() {
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // fetched data
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [reco, setReco] = useState<Suggestion[]>([]);

  // UI-only search (example)
  const [q, setQ] = useState("");

  // Quick Add modal (same vibe as index.html)
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [storage, setStorage] = useState<"FRIDGE" | "FREEZER" | "PANTRY">(
    "FRIDGE",
  );
  const [expiresAt, setExpiresAt] = useState("");

  const load = useCallback(async () => {
    setError("");
    setRefreshing(true);
    try {
      const [invRes, dealRes, recoRes] = await Promise.all([
        api.get<Inventory[]>("/inventory"),
        api.get<Deal[]>("/deals"),
        api.get<Suggestion[]>("/recommendations/today"),
      ]);
      setInventory(invRes.data ?? []);
      setDeals(dealRes.data ?? []);
      setReco(recoRes.data ?? []);
    } catch (e: any) {
      setError(explainNetworkHint(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const urgent = useMemo(() => {
    const list = inventory
      .map((x) => ({ ...x, d: daysUntil(x.expiresAt) }))
      .filter((x) => x.d !== null && x.d <= 2)
      .sort((a, b) => (a.d ?? 999) - (b.d ?? 999));
    return list;
  }, [inventory]);

  const urgentPreview = urgent.slice(0, 3);
  const dealsCount = deals.length;

  const sortedReco = useMemo(() => {
    const urgentNames = new Set(urgent.map((x) => x.itemName.toLowerCase()));
    return [...reco].sort((a, b) => {
      const aMatches = a.ingredients.filter((ing) =>
        urgentNames.has(ing.toLowerCase())
      ).length;
      const bMatches = b.ingredients.filter((ing) =>
        urgentNames.has(ing.toLowerCase())
      ).length;
      return bMatches - aMatches;
    });
  }, [reco, urgent]);

  const todayLabel = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const weekday = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
    return `${yyyy}-${mm}-${dd} (${weekday})`;
  }, []);

  const addQuick = useCallback(async () => {
    setError("");
    const itemName = name.trim();
    const parsedQty = Number(qty || "1");
    if (!itemName) {
      setError("품목명을 입력해줘.");
      return;
    }
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      setError("수량은 0보다 큰 숫자여야 해.");
      return;
    }

    try {
      const body: any = { itemName, quantity: parsedQty, storage };
      if (expiresAt.trim()) body.expiresAt = expiresAt.trim();
      await api.post("/inventory", body);

      // close + reset + reload
      setIsAddOpen(false);
      setName("");
      setQty("1");
      setStorage("FRIDGE");
      setExpiresAt("");
      await load();
    } catch (e: any) {
      setError(explainNetworkHint(e));
    }
  }, [expiresAt, load, name, qty, storage]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }} edges={["bottom", "left", "right"]}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} />
        }
        contentContainerStyle={{ padding: 14, paddingBottom: 28 }}
      >
        <AppHeader
          title="Dashboard"
          subtitle="오늘의 재고/특가/추천 요약"
          rightExtra={
            <Pressable
              onPress={() => setIsAddOpen(true)}
              style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.btnPrimaryText}>빠른 추가</Text>
            </Pressable>
          }
        />

        {/* Search (UI example) */}
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="품목/요리 검색 (UI 예시)"
            placeholderTextColor="rgba(31,41,55,0.45)"
            style={styles.searchInput}
          />
          {q.length > 0 ? (
            <Pressable onPress={() => setQ("")} style={styles.clearBtn}>
              <Text style={{ color: THEME.muted, fontWeight: "900" }}>×</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Error banner (like html placeholder) */}
        {error ? (
          <View style={styles.banner}>
            <View style={styles.bannerIcon}>
              <Text style={{ fontWeight: "900", color: "#5a1a1d" }}>!</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>네트워크 오류</Text>
              <Text style={styles.bannerDesc}>{error}</Text>
            </View>
            <Pressable
              onPress={load}
              style={({ pressed }) => [
                styles.btnGhost,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.btnGhostText}>재시도</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Today summary */}
        <View style={styles.sectionHead}>
          <Text style={styles.h3}>오늘의 요약</Text>
          <Text style={styles.meta}>{todayLabel} · (지역은 추후)</Text>
        </View>

        <View style={styles.grid}>
          {/* 임박 재료 — 숫자 없이, 이름 크게, 클릭 시 레시피 */}
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>임박 재료</Text>
              <View style={[styles.badge, { backgroundColor: "rgba(242,201,76,0.16)" }]}>
                <Text style={[styles.badgeText, { color: "#B7791F" }]}>D-2 이내</Text>
              </View>
            </View>
            {urgentPreview.length > 0 ? (
              <View style={styles.chipRow}>
                {urgentPreview.map((x) => (
                  <Pressable
                    key={x.id}
                    onPress={() =>
                      router.push({ pathname: "/ingredient-recipes", params: { ingredient: x.itemName } })
                    }
                    style={({ pressed }) => [styles.urgentChip, pressed && { opacity: 0.75 }]}
                  >
                    <Text style={styles.urgentChipName}>{x.itemName}</Text>
                    <MaterialIcons name="chevron-right" size={14} color="#B7791F" />
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.desc}>임박 재료가 없어 👍</Text>
            )}
            <Pressable
              onPress={() => router.push("/(tabs)/inventory")}
              style={({ pressed }) => [styles.btn, { marginTop: 10 }, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.btnText}>냉장고 보기</Text>
            </Pressable>
          </View>

          {/* 추천 요리 — 4개 이미지+이름 그리드 */}
          <View style={styles.card}>
            <View style={[styles.rowBetween, { marginBottom: 10 }]}>
              <Text style={styles.cardTitle}>추천 요리</Text>
              <View style={[styles.badge, { backgroundColor: "rgba(39,174,96,0.12)" }]}>
                <Text style={[styles.badgeText, { color: THEME.ok }]}>Today</Text>
              </View>
            </View>
            {sortedReco.slice(0, 4).length > 0 ? (
              <View style={styles.recoGrid}>
                {sortedReco.slice(0, 4).map((item, i) => (
                  <Pressable
                    key={i}
                    onPress={() => router.push({ pathname: "/recipe-detail", params: { name: item.name } })}
                    style={({ pressed }) => [styles.recoCard, pressed && { opacity: 0.85 }]}
                  >
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={styles.recoThumb} resizeMode="cover" />
                    ) : (
                      <View style={[styles.recoThumb, styles.recoThumbPlaceholder]}>
                        <Text style={{ fontSize: 22 }}>🍽️</Text>
                      </View>
                    )}
                    <Text style={styles.recoName} numberOfLines={2}>{item.name}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.desc}>재고를 등록하면 추천이 나와</Text>
            )}
            <Pressable
              onPress={() => router.push("/(tabs)/recommend")}
              style={({ pressed }) => [styles.btn, { marginTop: 10 }, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.btnText}>전체 추천 보기</Text>
            </Pressable>
          </View>
        </View>

        {/* Quick actions */}
        <View style={[styles.sectionHead, { marginTop: 18 }]}>
          <Text style={styles.h3}>빠른 액션</Text>
          <Text style={styles.meta}>자주 쓰는 작업</Text>
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            onPress={() => setIsAddOpen(true)}
            style={({ pressed }) => [
              styles.btnPrimary,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.btnPrimaryText}>재료 추가</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/(tabs)/deals")}
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.btnText}>특가 보기</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/(tabs)/alerts")}
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.btnText}>알림 보기</Text>
          </Pressable>
        </View>

        {/* Loading skeleton (static UI) */}
        <View style={[styles.sectionHead, { marginTop: 18 }]}>
          <Text style={styles.h3}>로딩 스켈레톤 (UI 예시)</Text>
          <Text style={styles.meta}>데이터 불러오는 중</Text>
        </View>

        <View style={styles.skeletonRow}>
          <View style={styles.sk} />
          <View style={styles.sk} />
          <View style={styles.sk} />
        </View>

        <Text style={styles.small}>
          ※ 이 페이지는 dashboard 디자인을 RN으로 옮긴 버전이야. (검색/필터는 UI
          예시)
          {"\n"}현재 Deals: {dealsCount}개
        </Text>
      </ScrollView>

      {/* Quick Add Modal */}
      <Modal
        transparent
        visible={isAddOpen}
        animationType="fade"
        onRequestClose={() => setIsAddOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>재료 추가</Text>
              <Pressable
                onPress={() => setIsAddOpen(false)}
                style={({ pressed }) => [
                  styles.iconBtn,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Text style={{ fontSize: 18, color: THEME.muted }}>×</Text>
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.field}>
                <Text style={styles.label}>품목명</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="예: 우유 1L"
                  placeholderTextColor="rgba(31,41,55,0.45)"
                  style={styles.input}
                />
              </View>

              <View style={styles.grid2}>
                <View style={styles.field}>
                  <Text style={styles.label}>수량</Text>
                  <TextInput
                    value={qty}
                    onChangeText={setQty}
                    placeholder="예: 1"
                    placeholderTextColor="rgba(31,41,55,0.45)"
                    style={styles.input}
                    keyboardType={
                      Platform.OS === "ios"
                        ? "numbers-and-punctuation"
                        : "numeric"
                    }
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>보관</Text>
                  <View style={styles.segment}>
                    {(["FRIDGE", "FREEZER", "PANTRY"] as const).map((v) => {
                      const active = storage === v;
                      const label =
                        v === "FRIDGE"
                          ? "냉장"
                          : v === "FREEZER"
                            ? "냉동"
                            : "실온";
                      return (
                        <Pressable
                          key={v}
                          onPress={() => setStorage(v)}
                          style={({ pressed }) => [
                            styles.segmentBtn,
                            active && styles.segmentBtnActive,
                            pressed && { opacity: 0.9 },
                          ]}
                        >
                          <Text
                            style={[
                              styles.segmentText,
                              active && styles.segmentTextActive,
                            ]}
                          >
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>유통기한</Text>
                <TextInput
                  value={expiresAt}
                  onChangeText={setExpiresAt}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="rgba(31,41,55,0.45)"
                  style={styles.input}
                />
              </View>
            </View>

            <View style={styles.modalFooter}>
              <Pressable
                onPress={() => setIsAddOpen(false)}
                style={({ pressed }) => [
                  styles.btnGhost,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.btnGhostText}>취소</Text>
              </Pressable>
              <View style={{ width: 10 }} />
              <Pressable
                onPress={addQuick}
                style={({ pressed }) => [
                  styles.btnPrimary,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.btnPrimaryText}>추가</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles: any = {
  topbar: { flexDirection: "row", alignItems: "center", gap: 10 },
  h2: { fontSize: 22, fontWeight: "900", color: THEME.text },
  sub: { marginTop: 2, fontSize: 12, color: THEME.muted },
  h3: { fontSize: 16, fontWeight: "900", color: THEME.text },
  meta: { marginTop: 2, fontSize: 12, color: THEME.muted },
  small: { marginTop: 12, fontSize: 12, color: THEME.muted, lineHeight: 16 },

  searchBox: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchIcon: { color: THEME.muted, marginRight: 8, fontSize: 14 },
  searchInput: { flex: 1, color: THEME.text, fontSize: 14, paddingVertical: 0 },
  clearBtn: {
    marginLeft: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: THEME.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.8)",
  },

  banner: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(232,107,107,.20)",
    backgroundColor: "rgba(232,107,107,.10)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bannerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(232,107,107,.20)",
    backgroundColor: "rgba(232,107,107,.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerTitle: { fontSize: 13, fontWeight: "900", color: "#5a1a1d" },
  bannerDesc: { marginTop: 2, fontSize: 12, color: "#5a1a1d", opacity: 0.9 },

  sectionHead: {
    marginTop: 14,
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 14,
  },

  grid: { marginTop: 12, gap: 12 },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  cardTitle: { fontSize: 14, fontWeight: "900", color: THEME.text },
  kpi: { marginTop: 10, fontSize: 30, fontWeight: "900", color: THEME.text },
  desc: { marginTop: 6, fontSize: 12, color: THEME.muted, lineHeight: 16 },

  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: "900" },

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  urgentChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(242,201,76,0.14)",
    borderWidth: 1,
    borderColor: "rgba(242,201,76,0.35)",
  },
  urgentChipName: { fontSize: 15, fontWeight: "900", color: THEME.text },

  // 추천 요리 그리드
  recoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  recoCard: {
    width: "47%",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: "#FFFFFF",
  },
  recoThumb: {
    width: "100%",
    height: 80,
    backgroundColor: "rgba(127,183,126,0.12)",
  },
  recoThumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  recoName: {
    fontSize: 12,
    fontWeight: "800",
    color: THEME.text,
    padding: 8,
    lineHeight: 16,
  },

  actionsRow: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  btnPrimary: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: THEME.brand,
    borderWidth: 1,
    borderColor: "rgba(15,31,22,0.10)",
  },
  btnPrimaryText: { color: THEME.brandInk, fontWeight: "900", fontSize: 13 },

  btn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1,
    borderColor: THEME.border,
  },
  btnText: { color: THEME.text, fontWeight: "900", fontSize: 13 },

  btnGhost: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderWidth: 1,
    borderColor: THEME.border,
  },
  btnGhostText: { color: THEME.text, fontWeight: "900", fontSize: 13 },

  skeletonRow: { marginTop: 12, flexDirection: "row", gap: 12 },
  sk: {
    flex: 1,
    height: 84,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: "rgba(255,255,255,0.55)",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(17,24,39,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modal: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 18,
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.border,
    overflow: "hidden",
  },
  modalHeader: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: { fontSize: 16, fontWeight: "900", color: THEME.text },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: THEME.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  modalBody: { padding: 14, gap: 12 },
  modalFooter: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
    flexDirection: "row",
    justifyContent: "flex-end",
  },

  field: { gap: 6 },
  label: { fontSize: 12, color: THEME.muted, fontWeight: "900" },
  input: {
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: "rgba(243,248,241,0.55)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: THEME.text,
    fontSize: 14,
  },
  grid2: { flexDirection: "row", gap: 10 },
  segment: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 14,
    overflow: "hidden",
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  segmentBtnActive: { backgroundColor: "rgba(127,183,126,0.20)" },
  segmentText: { fontSize: 13, fontWeight: "900", color: THEME.muted },
  segmentTextActive: { color: THEME.text },
};
