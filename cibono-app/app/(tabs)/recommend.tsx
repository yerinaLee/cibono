import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, explainNetworkHint } from "../../src/api/client";

type Suggestion = {
  name: string;
  ingredients: string[];
  missingCount: number;
  score: number;
  cookingTime: number; // 분
};

type Inventory = {
  id: number;
  itemName: string;
  expiresAt?: string | null;
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

function norm(s: string) {
  return (s || "").replace(/\s+/g, "").trim().toLowerCase();
}

function badgeForMissing(missingCount: number) {
  if (missingCount <= 0)
    return { label: "부족 0", color: THEME.ok, bg: "rgba(39,174,96,0.12)" };
  if (missingCount <= 1)
    return { label: "부족 1", color: "#B7791F", bg: "rgba(242,201,76,0.16)" };
  return {
    label: `부족 ${missingCount}`,
    color: THEME.muted,
    bg: "rgba(107,114,128,0.12)",
  };
}

export default function RecommendScreen() {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // UI-only filters (MVP)
  const [q, setQ] = useState("");
  const [timePreset, setTimePreset] = useState<"15" | "30" | "45">("30");
  const [missingPreset, setMissingPreset] = useState<"min" | "1" | "2">("min");
  const [noSpicy, setNoSpicy] = useState(true);

  const load = useCallback(async () => {
    setError("");
    setRefreshing(true);
    try {
      const [recRes, invRes] = await Promise.all([
        api.get<Suggestion[]>("/recommendations/today"),
        api.get<Inventory[]>("/inventory"),
      ]);
      setItems(recRes.data ?? []);
      setInventory(invRes.data ?? []);
    } catch (e: any) {
      setError(explainNetworkHint(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  // ✅ 탭으로 들어올 때마다 자동 갱신 + 탭 나갈 때 검색어 초기화
  useFocusEffect(
    React.useCallback(() => {
      load();
      return () => {
        setQ("");
      };
    }, [load]),
  );

  const haveSet = useMemo(() => {
    const set = new Set<string>();
    for (const inv of inventory) set.add(norm(inv.itemName));
    return set;
  }, [inventory]);

  const urgentSet = useMemo(() => {
    const set = new Set<string>();
    for (const inv of inventory) {
      const d = daysUntil(inv.expiresAt);
      if (d !== null && d <= 2) set.add(norm(inv.itemName));
    }
    return set;
  }, [inventory]);

  const computed = useMemo(() => {
    return items.map((it) => {
      const missingList = (it.ingredients ?? []).filter(
        (ing) => !haveSet.has(norm(ing)),
      );
      const missingCountComputed = missingList.length;
      const hasUrgent = (it.ingredients ?? []).some((ing) =>
        urgentSet.has(norm(ing)),
      );
      return { ...it, missingList, missingCountComputed, hasUrgent };
    });
  }, [haveSet, items, urgentSet]);

  const filtered = useMemo(() => {
    let arr = computed;

    const keyword = q.trim().toLowerCase();
    if (keyword)
      arr = arr.filter((x) => x.name.toLowerCase().includes(keyword));

    // 조리 시간 필터: 선택한 시간 이하인 레시피만
    const maxMin = parseInt(timePreset, 10);
    arr = arr.filter((x) => (x.cookingTime ?? 0) <= maxMin);

    if (missingPreset === "1")
      arr = arr.filter((x) => x.missingCountComputed <= 1);
    if (missingPreset === "2")
      arr = arr.filter((x) => x.missingCountComputed <= 2);

    if (missingPreset === "min") {
      arr = [...arr].sort(
        (a, b) =>
          a.missingCountComputed - b.missingCountComputed ||
          Number(b.hasUrgent) - Number(a.hasUrgent) ||
          b.score - a.score,
      );
    } else {
      arr = [...arr].sort(
        (a, b) =>
          Number(b.hasUrgent) - Number(a.hasUrgent) || b.score - a.score,
      );
    }

    return arr;
  }, [computed, missingPreset, q, timePreset]);

  const Header = (
    <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12 }}>
      <View style={styles.topbar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h2}>Recommend</Text>
          <Text style={styles.sub}>임박 재료 우선 요리 추천</Text>
        </View>
        <View style={styles.badgeChip}>
          <Text style={styles.badgeChipText}>오늘</Text>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="요리 검색"
          placeholderTextColor="rgba(31,41,55,0.45)"
          style={styles.searchInput}
        />
        {q.length > 0 ? (
          <Pressable onPress={() => setQ("")} style={styles.clearBtn}>
            <Text style={{ color: THEME.muted, fontWeight: "700" }}>×</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filters}>
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>시간</Text>
          {(["15", "30", "45"] as const).map((v) => {
            const active = timePreset === v;
            return (
              <Pressable
                key={v}
                onPress={() => setTimePreset(v)}
                style={({ pressed }) => [
                  styles.filterChip,
                  active && styles.filterChipActive,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    active && styles.filterChipTextActive,
                  ]}
                >
                  {v}분
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>부족</Text>
          {(["min", "1", "2"] as const).map((v) => {
            const active = missingPreset === v;
            const label = v === "min" ? "최소" : `${v}개 이하`;
            return (
              <Pressable
                key={v}
                onPress={() => setMissingPreset(v)}
                style={({ pressed }) => [
                  styles.filterChip,
                  active && styles.filterChipActive,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    active && styles.filterChipTextActive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.switchRow}>
          <Pressable
            onPress={() => setNoSpicy((p) => !p)}
            style={({ pressed }) => [
              styles.toggle,
              noSpicy && styles.toggleOn,
              pressed && { opacity: 0.9 },
            ]}
          >
            <View style={[styles.toggleKnob, noSpicy && { marginLeft: 16 }]} />
          </Pressable>
          <Text style={styles.switchText}>매운맛 제외(UI)</Text>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.sectionHead}>
        <Text style={styles.h3}>오늘의 추천</Text>
        <Text style={styles.meta}>탭 이동 시 자동 갱신</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
      <FlatList
        data={filtered}
        keyExtractor={(x, idx) => `${x.name}-${idx}`}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} />
        }
        ListHeaderComponent={Header}
        contentContainerStyle={{ paddingBottom: 110 }}
        numColumns={2}
        columnWrapperStyle={{ paddingHorizontal: 14, gap: 12 }}
        renderItem={({ item }: any) => {
          const missingBadge = badgeForMissing(item.missingCountComputed);

          const headlineBadge = item.hasUrgent
            ? {
                label: "임박 포함",
                color: THEME.danger,
                bg: "rgba(235,87,87,0.12)",
              }
            : { label: "추천", color: "#B7791F", bg: "rgba(242,201,76,0.16)" };

          return (
            <View style={[styles.card, { flex: 1 }]}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.name}
                </Text>
                <View
                  style={[styles.badge, { backgroundColor: headlineBadge.bg }]}
                >
                  <Text
                    style={[styles.badgeText, { color: headlineBadge.color }]}
                  >
                    {headlineBadge.label}
                  </Text>
                </View>
              </View>

              <Text style={styles.desc} numberOfLines={6}>
                사용 재료: {item.ingredients.join(", ")}
                {"\n"}
                부족 재료({item.missingCountComputed}):{" "}
                {item.missingList.length ? item.missingList.join(", ") : "없음"}
              </Text>

              <View style={{ height: 10 }} />

              <View style={styles.footerRow}>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: "rgba(127,183,126,0.18)" },
                  ]}
                >
                  <Text style={[styles.badgeText, { color: THEME.brandInk }]}>
                    {item.cookingTime}분
                  </Text>
                </View>

                <View
                  style={[styles.badge, { backgroundColor: missingBadge.bg }]}
                >
                  <Text
                    style={[styles.badgeText, { color: missingBadge.color }]}
                  >
                    {missingBadge.label}
                  </Text>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.btn,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text style={styles.btnText}>보기</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={[styles.empty, { marginHorizontal: 14 }]}>
            <View style={styles.emptyBubble}>
              <Text style={{ fontSize: 16 }}>👩‍🍳</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.emptyTitle}>추천 결과가 없어</Text>
              <Text style={styles.emptyText}>
                재고를 먼저 등록하거나 필터를 완화해봐.
              </Text>
            </View>
            <Pressable
              onPress={load}
              style={({ pressed }) => [
                styles.btnGhost,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.btnGhostText}>새로고침</Text>
            </Pressable>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles: any = {
  topbar: { flexDirection: "row", alignItems: "center", gap: 10 },
  h2: { fontSize: 22, fontWeight: "800", color: THEME.text },
  sub: { marginTop: 2, fontSize: 12, color: THEME.muted },
  h3: { fontSize: 16, fontWeight: "800", color: THEME.text },
  meta: { marginTop: 2, fontSize: 12, color: THEME.muted },

  badgeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(127,183,126,0.18)",
    borderWidth: 1,
    borderColor: "rgba(127,183,126,0.24)",
  },
  badgeChipText: { fontSize: 12, fontWeight: "900", color: THEME.brandInk },

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

  filters: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: "rgba(255,255,255,0.82)",
    gap: 10,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: THEME.muted,
    marginRight: 4,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  filterChipActive: {
    borderColor: "rgba(127,183,126,0.35)",
    backgroundColor: "rgba(127,183,126,0.18)",
  },
  filterChipText: { fontSize: 12, fontWeight: "900", color: THEME.muted },
  filterChipTextActive: { color: THEME.text },

  switchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  switchText: { fontSize: 12, fontWeight: "900", color: THEME.muted },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: "rgba(107,114,128,0.18)",
    padding: 3,
  },
  toggleOn: {
    backgroundColor: "rgba(127,183,126,0.28)",
    borderColor: "rgba(127,183,126,0.35)",
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: THEME.border,
  },

  sectionHead: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.65)",
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 14,
  },

  errorBanner: {
    marginTop: 10,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(235,87,87,0.25)",
    backgroundColor: "rgba(235,87,87,0.08)",
  },
  errorText: { color: "#B42318", fontSize: 12, fontWeight: "700" },

  card: {
    backgroundColor: "rgba(255,255,255,0.88)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },

  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: "900" },

  cardTitle: { flex: 1, fontSize: 15, fontWeight: "900", color: THEME.text },
  desc: { marginTop: 8, fontSize: 12, color: THEME.muted, lineHeight: 16 },

  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  btn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  btnText: { fontSize: 12, fontWeight: "900", color: THEME.text },

  btnGhost: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderWidth: 1,
    borderColor: THEME.border,
  },
  btnGhostText: { color: THEME.text, fontWeight: "900", fontSize: 13 },

  empty: {
    marginTop: 8,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: "rgba(255,255,255,0.82)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  emptyBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(127,183,126,0.20)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(127,183,126,0.25)",
  },
  emptyTitle: { fontSize: 14, fontWeight: "900", color: THEME.text },
  emptyText: { marginTop: 2, fontSize: 12, color: THEME.muted, lineHeight: 16 },
};
