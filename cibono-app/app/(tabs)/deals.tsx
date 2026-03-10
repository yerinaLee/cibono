import { router } from "expo-router";
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

type Deal = {
  id: number;
  storeId: number | null;
  itemName: string;
  dealPrice: number;
  startsAt: string;
  endsAt: string;
  source: string;
};

const THEME = {
  bg: "#F3F8F1",
  surface: "#FFFFFF",
  text: "#1F2937",
  muted: "#6B7280",
  border: "rgba(31,41,55,0.10)",
  brand: "#7FB77E",
  brandInk: "#0F1F16",
  greenBg: "rgba(127,183,126,0.18)",
  greenBd: "rgba(127,183,126,0.24)",
  danger: "#EB5757",
};

export default function DealsScreen() {
  const [items, setItems] = useState<Deal[]>([]);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // UI-only filters (MVP: 서버 파라미터 없이 프론트 필터만)
  const [search, setSearch] = useState("");
  const [store, setStore] = useState("전체");
  const [period, setPeriod] = useState("오늘");

  const load = useCallback(async () => {
    setError("");
    setRefreshing(true);
    try {
      const res = await api.get<Deal[]>("/deals");
      setItems(res.data ?? []);
    } catch (e: any) {
      setError(explainNetworkHint(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = items;

    if (q) {
      arr = arr.filter((d) => {
        const text = `${d.itemName} ${d.source ?? ""}`.toLowerCase();
        return text.includes(q);
      });
    }

    // store/period은 MVP UI 예시로만 (실제 연동 필요 시 서버에서 지원)
    if (store !== "전체") {
      arr = arr.filter((d) =>
        (d.source ?? "").toLowerCase().includes(store.toLowerCase()),
      );
    }
    return arr;
  }, [items, period, search, store]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
      {/* Topbar */}
      <View
        style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12 }}
      >
        <View style={styles.topbar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h2}>Deals</Text>
            <Text style={styles.sub}>오늘 유효한 특가 모아보기</Text>
          </View>

          <Pressable
            onPress={() => router.push("/(tabs)/alerts_rules")}
            style={({ pressed }) => [
              styles.btnPrimary,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.btnPrimaryText}>규칙 추가</Text>
          </Pressable>
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="품목/매장 검색 (UI 예시)"
            placeholderTextColor="rgba(31,41,55,0.45)"
            style={styles.searchInput}
          />
          {search.length > 0 ? (
            <Pressable onPress={() => setSearch("")} style={styles.clearBtn}>
              <Text style={{ color: THEME.muted, fontWeight: "900" }}>×</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Section head */}
        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.h3}>오늘 유효한 특가</Text>
            <Text style={styles.meta}>필터: 검색/매장/기간 (MVP UI)</Text>
          </View>
          <View
            style={[
              styles.badge,
              { backgroundColor: THEME.greenBg, borderColor: THEME.greenBd },
            ]}
          >
            <Text style={[styles.badgeText, { color: THEME.brandInk }]}>
              총 {filtered.length}건
            </Text>
          </View>
        </View>

        {/* Filters row (UI only) */}
        <View style={styles.filters}>
          <View style={styles.filterChip}>
            <Text style={styles.filterLabel}>매장</Text>
            <Pressable
              onPress={() => setStore(store === "전체" ? "쿠팡" : "전체")}
              style={styles.filterValueBtn}
            >
              <Text style={styles.filterValue}>{store}</Text>
            </Pressable>
          </View>
          <View style={styles.filterChip}>
            <Text style={styles.filterLabel}>기간</Text>
            <Pressable
              onPress={() => setPeriod(period === "오늘" ? "이번주" : "오늘")}
              style={styles.filterValueBtn}
            >
              <Text style={styles.filterValue}>{period}</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => {
              setSearch("");
              setStore("전체");
              setPeriod("오늘");
            }}
            style={({ pressed }) => [
              styles.btnGhost,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.btnGhostText}>필터 초기화</Text>
          </Pressable>
        </View>

        {/* Error banner */}
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(x) => String(x.id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} />
        }
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 20 }}
        renderItem={({ item }) => (
          <View style={styles.itemCard}>
            <View style={styles.itemIcon}>
              <Text style={{ fontWeight: "900", color: THEME.brandInk }}>
                %
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <View style={styles.rowBetween}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.itemName}
                </Text>
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: THEME.greenBg,
                      borderColor: THEME.greenBd,
                    },
                  ]}
                >
                  <Text style={[styles.badgeText, { color: THEME.brandInk }]}>
                    특가
                  </Text>
                </View>
              </View>

              <Text style={styles.itemSub}>
                <Text style={styles.mono}>
                  {item.dealPrice.toLocaleString()}원
                </Text>{" "}
                · {item.startsAt}~{item.endsAt} · 출처: {item.source}
              </Text>
            </View>

            <Pressable
              onPress={() => router.push("/(tabs)/alerts_rules")}
              style={({ pressed }) => [
                styles.iconBtn,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={{ fontWeight: "900", color: THEME.text }}>＋</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyBubble}>
              <Text style={{ fontSize: 16 }}>🏪</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.emptyTitle}>조건에 맞는 특가가 없어</Text>
              <Text style={styles.emptyText}>
                기간을 “이번주”로 바꾸거나 기준가를 조정해봐.
              </Text>
            </View>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles: any = {
  topbar: { flexDirection: "row", alignItems: "center", gap: 10 },
  h2: { fontSize: 22, fontWeight: "900", color: THEME.text },
  sub: { marginTop: 2, fontSize: 12, color: THEME.muted },
  h3: { fontSize: 16, fontWeight: "900", color: THEME.text },
  meta: { marginTop: 2, fontSize: 12, color: THEME.muted },

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

  sectionHead: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.65)",
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: { fontSize: 12, fontWeight: "900" },

  filters: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: "rgba(255,255,255,0.82)",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: "rgba(255,255,255,0.9)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  filterLabel: { fontSize: 12, fontWeight: "900", color: THEME.muted },
  filterValueBtn: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  filterValue: { fontSize: 12, fontWeight: "900", color: THEME.text },

  btnPrimary: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: THEME.brand,
    borderWidth: 1,
    borderColor: "rgba(15,31,22,0.10)",
  },
  btnPrimaryText: { color: THEME.brandInk, fontWeight: "900", fontSize: 13 },

  btnGhost: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderWidth: 1,
    borderColor: THEME.border,
  },
  btnGhostText: { color: THEME.text, fontWeight: "900", fontSize: 13 },

  errorBanner: {
    marginTop: 10,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(235,87,87,0.25)",
    backgroundColor: "rgba(235,87,87,0.08)",
  },
  errorText: { color: "#B42318", fontSize: 12, fontWeight: "700" },

  itemCard: {
    backgroundColor: "rgba(255,255,255,0.88)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  itemIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: THEME.greenBd,
    backgroundColor: THEME.greenBg,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  itemName: { fontSize: 15, fontWeight: "900", color: THEME.text, flex: 1 },
  itemSub: { marginTop: 6, fontSize: 12, color: THEME.muted, lineHeight: 16 },
  mono: { fontWeight: "900", color: THEME.text },

  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },

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
    backgroundColor: THEME.greenBg,
    borderWidth: 1,
    borderColor: THEME.greenBd,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 14, fontWeight: "900", color: THEME.text },
  emptyText: { marginTop: 2, fontSize: 12, color: THEME.muted, lineHeight: 16 },
};
