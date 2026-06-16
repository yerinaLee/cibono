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

type AlertEvent = {
  id: number;
  userId: number;
  dealId: number;
  seen: boolean;
};

type Deal = {
  id: number;
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
  redBg: "rgba(232,107,107,0.10)",
  redBd: "rgba(232,107,107,0.22)",
  redInk: "#5a1a1d",
  greenBg: "rgba(127,183,126,0.18)",
  greenBd: "rgba(127,183,126,0.24)",
};

export default function AlertsScreen() {
  const [items, setItems] = useState<AlertEvent[]>([]);
  const [dealMap, setDealMap] = useState<Record<number, Deal>>({});
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"unread" | "confirmed">("unread"); // UI tab

  const load = useCallback(async () => {
    setError("");
    setRefreshing(true);
    try {
      const [alertsRes, dealsRes] = await Promise.all([
        api.get<{ data: AlertEvent[] }>("/alerts"),
        api.get<Deal[]>("/deals"),
      ]);
      setItems(alertsRes.data?.data ?? []);
      const map: Record<number, Deal> = {};
      for (const d of dealsRes.data ?? []) map[d.id] = d;
      setDealMap(map);
    } catch (e: any) {
      setError(explainNetworkHint(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  const runScan = useCallback(async () => {
    setError("");
    try {
      await api.post("/admin/alerts/run-scan");
      await load();
    } catch (e: any) {
      setError(explainNetworkHint(e));
    }
  }, [load]);

  const markSeen = useCallback(
    async (id: number) => {
      setError("");
      try {
        await api.patch(`/alerts/${id}/read`);
        await load();
      } catch (e: any) {
        setError(explainNetworkHint(e));
      }
    },
    [load],
  );

  React.useEffect(() => {
    load();
  }, [load]);

  const unreadCount = useMemo(
    () => items.filter((x) => !x.seen).length,
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = items;

    arr =
      tab === "unread" ? arr.filter((x) => !x.seen) : arr.filter((x) => x.seen);

    if (!q) return arr;

    return arr.filter((ev) => {
      const d = dealMap[ev.dealId];
      const text =
        `${d?.itemName ?? ""} ${d?.source ?? ""} dealId:${ev.dealId}`.toLowerCase();
      return text.includes(q);
    });
  }, [dealMap, items, search, tab]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
      <View
        style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12 }}
      >
        {/* Topbar */}
        <View style={styles.topbar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h2}>Alerts</Text>
            <Text style={styles.sub}>특가 알림 이벤트(미확인/확인)</Text>
          </View>

          <Pressable
            onPress={() => router.push("/(tabs)/alerts_rules")}
            style={({ pressed }) => [
              styles.btnPrimary,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.btnPrimaryText}>규칙 관리</Text>
          </Pressable>
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="알림 검색 (UI 예시)"
            placeholderTextColor="rgba(31,41,55,0.45)"
            style={styles.searchInput}
          />
          {search.length > 0 ? (
            <Pressable onPress={() => setSearch("")} style={styles.clearBtn}>
              <Text style={{ color: THEME.muted, fontWeight: "900" }}>×</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Section Head */}
        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.h3}>알림 이벤트</Text>
            <Text style={styles.meta}>미확인은 강조 / 확인 처리 버튼</Text>
          </View>
          <View
            style={[
              styles.pill,
              { backgroundColor: THEME.redBg, borderColor: THEME.redBd },
            ]}
          >
            <Text style={[styles.pillText, { color: THEME.redInk }]}>
              미확인 {unreadCount}
            </Text>
          </View>
        </View>

        {/* Tabs row */}
        <View style={styles.tabsRow}>
          <View style={styles.tabs}>
            <Pressable
              onPress={() => setTab("unread")}
              style={({ pressed }) => [
                styles.tab,
                tab === "unread" && styles.tabActive,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  tab === "unread" && styles.tabTextActive,
                ]}
              >
                미확인 ({unreadCount})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setTab("confirmed")}
              style={({ pressed }) => [
                styles.tab,
                tab === "confirmed" && styles.tabActive,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  tab === "confirmed" && styles.tabTextActive,
                ]}
              >
                확인
              </Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => router.push("/(tabs)/alerts_rules")}
            style={({ pressed }) => [
              styles.btnGhost,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.btnGhostText}>규칙 추가/편집</Text>
          </Pressable>

          <Pressable
            onPress={runScan}
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.btnText}>스캔 실행</Text>
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
        renderItem={({ item }) => {
          const deal = dealMap[item.dealId];
          const isUnread = !item.seen;

          return (
            <View
              style={[
                styles.itemCard,
                isUnread && {
                  borderColor: THEME.redBd,
                  backgroundColor: "rgba(255,255,255,0.86)",
                },
              ]}
            >
              <View
                style={[
                  styles.itemIcon,
                  isUnread && {
                    backgroundColor: THEME.redBg,
                    borderColor: "rgba(232,107,107,0.20)",
                  },
                ]}
              >
                <Text
                  style={{
                    fontWeight: "900",
                    color: isUnread ? THEME.redInk : THEME.brandInk,
                  }}
                >
                  !
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {deal ? `${deal.itemName} 특가 알림` : `알림 #${item.id}`}
                  </Text>

                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor: isUnread ? THEME.redBg : THEME.greenBg,
                        borderColor: isUnread ? THEME.redBd : THEME.greenBd,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        { color: isUnread ? THEME.redInk : THEME.brandInk },
                      ]}
                    >
                      {isUnread ? "미확인" : "확인"}
                    </Text>
                  </View>
                </View>

                <Text style={styles.itemSub}>
                  {deal ? (
                    <>
                      특가{" "}
                      <Text style={styles.mono}>
                        {deal.dealPrice.toLocaleString()}원
                      </Text>{" "}
                      · 기간 {deal.startsAt}~{deal.endsAt} · 출처: {deal.source}
                    </>
                  ) : (
                    <>dealId={item.dealId}</>
                  )}
                </Text>

                <View style={{ height: 10 }} />

                <View
                  style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}
                >
                  {isUnread ? (
                    <Pressable
                      onPress={() => markSeen(item.id)}
                      style={({ pressed }) => [
                        styles.btn,
                        pressed && { opacity: 0.9 },
                      ]}
                    >
                      <Text style={styles.btnText}>확인 처리</Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    onPress={() => router.push("/(tabs)/alerts_rules")}
                    style={({ pressed }) => [
                      styles.iconBtn,
                      pressed && { opacity: 0.9 },
                    ]}
                  >
                    <Text style={{ fontWeight: "900", color: THEME.text }}>
                      ✎
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyBubble}>
              <Text style={{ fontSize: 16 }}>🔔</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.emptyTitle}>
                {tab === "unread" ? "미확인 알림이 없어" : "확인된 알림이 없어"}
              </Text>
              <Text style={styles.emptyText}>
                {tab === "unread"
                  ? "스캔을 실행하거나 규칙을 추가해봐."
                  : "최근 확인한 알림이 없거나 아직 기록이 없어."}
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

  tabsRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  tabs: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  tab: { paddingHorizontal: 12, paddingVertical: 9 },
  tabActive: { backgroundColor: "rgba(127,183,126,0.18)" },
  tabText: { fontSize: 12, fontWeight: "900", color: THEME.muted },
  tabTextActive: { color: THEME.text },

  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: { fontSize: 12, fontWeight: "900" },

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

  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
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

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: { fontSize: 12, fontWeight: "900" },

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
