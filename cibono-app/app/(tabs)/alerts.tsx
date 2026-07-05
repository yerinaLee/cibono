import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppHeader from "../../components/AppHeader";
import { api, explainNetworkHint } from "../../src/api/client";
import { getStoreLogo } from "../../src/constants/storeLogos";

type AlertEvent = {
  id: number;
  isRead: boolean;
  triggeredAt: string;
  readAt: string | null;
  deal: {
    id: number;
    itemName: string;
    dealPrice: number;
    originalPrice: number | null;
    saving: number | null;
    effectivePrice: number;
    promotionLabel: string | null;
    endDate: string;
    storeId: number | null;
  } | null;
  rule: { id: number; thresholdPrice: number } | null;
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
};

type Store = { id: number; name: string; flyerUrl: string | null };

type ConfirmTarget = { type: "single"; id: number; name: string } | { type: "all" };

const SCROLL_TOP_THRESHOLD = 300;

export default function AlertsScreen() {
  const [items, setItems] = useState<AlertEvent[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const [showScrollTop, setShowScrollTop] = useState(false);
  const listRef = useRef<FlatList>(null);

  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);

  const load = useCallback(async () => {
    setError("");
    setRefreshing(true);
    try {
      const [alertsRes, storesRes] = await Promise.all([
        api.get<{ data: AlertEvent[] }>("/alerts"),
        api.get<{ data: Store[] }>("/stores"),
      ]);
      setItems(alertsRes.data?.data ?? []);
      setStores(storesRes.data?.data ?? []);
    } catch (e: any) {
      setError(explainNetworkHint(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  const storeNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const s of stores) map.set(s.id, s.name);
    return map;
  }, [stores]);

  const storeById = useMemo(() => {
    const map = new Map<number, Store>();
    for (const s of stores) map.set(s.id, s);
    return map;
  }, [stores]);

  const runScan = useCallback(async () => {
    setError("");
    try {
      await api.post("/admin/alerts/run-scan");
      await load();
    } catch (e: any) {
      setError(explainNetworkHint(e));
    }
  }, [load]);

  const handleIconPress = useCallback(
    (storeId: number | null | undefined) => {
      const flyerUrl = storeId ? storeById.get(storeId)?.flyerUrl : null;
      if (flyerUrl) {
        Linking.openURL(flyerUrl);
      }
    },
    [storeById],
  );

  const requestDeleteEvent = useCallback((id: number, name: string) => {
    setConfirmTarget({ type: "single", id, name });
  }, []);

  const requestDeleteAll = useCallback(() => {
    if (items.length === 0) return;
    setConfirmTarget({ type: "all" });
  }, [items.length]);

  const confirmDelete = useCallback(async () => {
    if (!confirmTarget) return;
    try {
      if (confirmTarget.type === "single") {
        await api.delete(`/alerts/${confirmTarget.id}`);
      } else {
        await api.delete("/alerts");
      }
      await load();
    } catch (e: any) {
      setError(explainNetworkHint(e));
    } finally {
      setConfirmTarget(null);
    }
  }, [confirmTarget, load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;

    return items.filter((ev) => {
      const storeName = ev.deal?.storeId
        ? storeNameById.get(ev.deal.storeId)
        : "";
      const text =
        `${ev.deal?.itemName ?? ""} ${storeName ?? ""}`.toLowerCase();
      return text.includes(q);
    });
  }, [items, search, storeNameById]);

  const handleScroll = useCallback((e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    setShowScrollTop(y > SCROLL_TOP_THRESHOLD);
  }, []);

  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: THEME.bg }}
      edges={["bottom", "left", "right"]}
    >
      {/* 고정 헤더 (공유 AppHeader) */}
      <AppHeader title="알림" subtitle="내가 정하는 식재료 특가 알림" />

      {/* 고정 영역 (툴바·검색·필터) */}
      <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12 }}>
        {/* 검색·추가 툴바 (냉장고와 동일) */}
        <View style={styles.toolbar}>
          <Pressable
            onPress={() => setShowSearch((p) => !p)}
            style={({ pressed }) => [
              styles.iconCircle,
              showSearch && styles.iconCircleActive,
              pressed && { opacity: 0.85 },
            ]}
            accessibilityLabel="검색"
          >
            <MaterialIcons
              name="search"
              size={20}
              color={showSearch ? THEME.brand : THEME.text}
            />
          </Pressable>
          <Pressable
            onPress={runScan}
            style={({ pressed }) => [
              styles.iconCircle,
              pressed && { opacity: 0.85 },
            ]}
            accessibilityLabel="스캔 실행"
          >
            <MaterialIcons name="radar" size={20} color={THEME.text} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={requestDeleteAll}
            style={({ pressed }) => [
              styles.iconCircle,
              pressed && { opacity: 0.85 },
            ]}
            accessibilityLabel="전체 삭제"
          >
            <MaterialIcons name="delete-sweep" size={20} color={THEME.text} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/(tabs)/alerts_rules")}
            style={({ pressed }) => [
              styles.iconCircleAdd,
              pressed && { opacity: 0.85 },
            ]}
            accessibilityLabel="규칙 관리"
          >
            <MaterialIcons name="add" size={22} color={THEME.brandInk} />
          </Pressable>
        </View>

        {/* 인라인 검색창 */}
        {showSearch && (
          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="알림 검색"
              placeholderTextColor="rgba(31,41,55,0.45)"
              style={styles.searchInput}
              autoFocus
            />
            {search.length > 0 ? (
              <Pressable onPress={() => setSearch("")} style={styles.clearBtn}>
                <Text style={{ color: THEME.muted, fontWeight: "900" }}>×</Text>
              </Pressable>
            ) : null}
          </View>
        )}


        {/* Error banner */}
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>

      <View style={{ flex: 1 }}>
        <FlatList
          ref={listRef}
          data={filtered}
          keyExtractor={(x) => String(x.id)}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={load} />
          }
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 20 }}
          renderItem={({ item }) => {
            const deal = item.deal;
            const storeName = deal?.storeId
              ? storeNameById.get(deal.storeId)
              : undefined;
            const logo = getStoreLogo(storeName);
            const label = deal ? `${deal.itemName} 특가 알림` : `알림 #${item.id}`;

            return (
              <View style={styles.itemCard}>
                <Pressable
                  onPress={() => handleIconPress(deal?.storeId)}
                  hitSlop={6}
                >
                  {logo ? (
                    <Image source={logo} style={styles.itemLogo} />
                  ) : (
                    <View style={styles.itemIcon}>
                      <Text style={{ fontWeight: "900", color: THEME.brandInk }}>
                        !
                      </Text>
                    </View>
                  )}
                </Pressable>

                <View style={{ flex: 1 }}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {label}
                    </Text>

                    <Pressable
                      onPress={() => requestDeleteEvent(item.id, label)}
                      style={({ pressed }) => [
                        styles.deleteBtn,
                        pressed && { opacity: 0.85 },
                      ]}
                      accessibilityLabel="알림 삭제"
                      hitSlop={6}
                    >
                      <MaterialIcons
                        name="close"
                        size={16}
                        color={THEME.muted}
                      />
                    </Pressable>
                  </View>

                  <Text style={styles.itemSub}>
                    {deal ? (
                      <>
                        {deal.promotionLabel ? `${deal.promotionLabel} · ` : ""}
                        <Text style={styles.mono}>
                          {deal.effectivePrice.toLocaleString()}원
                        </Text>{" "}
                        · {storeName ?? "매장 정보 없음"} · {deal.endDate}까지
                      </>
                    ) : (
                      <>알림 정보를 찾을 수 없어요</>
                    )}
                  </Text>
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
                <Text style={styles.emptyTitle}>알림이 없어요</Text>
                <Text style={styles.emptyText}>
                  스캔을 실행하거나 규칙을 추가해보세요.
                </Text>
              </View>
            </View>
          }
        />

        {showScrollTop ? (
          <Pressable
            onPress={scrollToTop}
            style={({ pressed }) => [
              styles.scrollTopBtn,
              pressed && { opacity: 0.85 },
            ]}
            accessibilityLabel="위로 이동"
          >
            <MaterialIcons name="arrow-upward" size={22} color="#fff" />
          </Pressable>
        ) : null}
      </View>

      {/* ── 삭제 확인 모달 (냉장고 탭과 동일한 스타일) ── */}
      <Modal
        transparent
        visible={!!confirmTarget}
        animationType="fade"
        onRequestClose={() => setConfirmTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { maxHeight: undefined }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {confirmTarget?.type === "all" ? "전체 삭제" : "알림 삭제"}
              </Text>
              <Pressable
                onPress={() => setConfirmTarget(null)}
                style={styles.modalCloseBtn}
              >
                <MaterialIcons name="close" size={18} color={THEME.muted} />
              </Pressable>
            </View>
            <View style={[styles.modalBody, { paddingVertical: 20 }]}>
              <Text
                style={{ fontSize: 15, color: THEME.text, textAlign: "center" }}
              >
                {confirmTarget?.type === "all" ? (
                  "모든 알림 내역을 삭제할까요?"
                ) : (
                  <>
                    <Text style={{ fontWeight: "900" }}>
                      {confirmTarget?.name}
                    </Text>
                    을(를) 삭제할까요?
                  </>
                )}
              </Text>
            </View>
            <View style={styles.modalFooter}>
              <Pressable
                onPress={() => setConfirmTarget(null)}
                style={({ pressed }) => [
                  styles.btnGhost,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.btnGhostText}>취소</Text>
              </Pressable>
              <View style={{ width: 10 }} />
              <Pressable
                onPress={confirmDelete}
                style={({ pressed }) => [
                  styles.btnDanger,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.btnDangerText}>삭제</Text>
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

  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: { fontSize: 12, fontWeight: "900" },

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
  itemLogo: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(107,114,128,0.08)",
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

  deleteBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(31,41,55,0.05)",
  },

  scrollTopBtn: {
    position: "absolute",
    right: 16,
    bottom: 50,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.brandInk,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
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

  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleActive: {
    backgroundColor: "rgba(127,183,126,0.20)",
    borderColor: "rgba(127,183,126,0.4)",
  },
  iconCircleAdd: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(15,31,22,0.15)",
    backgroundColor: THEME.brand,
    alignItems: "center",
    justifyContent: "center",
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
    maxHeight: "85%",
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
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: THEME.border,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: { padding: 14, gap: 12 },
  modalFooter: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  btnGhost: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderWidth: 1,
    borderColor: THEME.border,
  },
  btnGhostText: { color: THEME.text, fontWeight: "900", fontSize: 13 },
  btnDanger: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(235,87,87,0.10)",
    borderWidth: 1,
    borderColor: "rgba(235,87,87,0.30)",
  },
  btnDangerText: { color: "#B42318", fontWeight: "900", fontSize: 13 },
};
