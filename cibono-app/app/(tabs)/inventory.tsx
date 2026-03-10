import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, explainNetworkHint } from "../../src/api/client";

type Inventory = {
  id: number;
  userId: number;
  itemName: string;
  quantity: number;
  unit?: string | null;
  storage: string; // FRIDGE/FREEZER/PANTRY
  purchasedAt?: string | null;
  expiresAt?: string | null; // YYYY-MM-DD
};

const THEME = {
  bg: "#F3F8F1",
  surface: "#FFFFFF",
  text: "#1F2937",
  muted: "#6B7280",
  border: "rgba(31,41,55,0.10)",
  brand: "#7FB77E", // 편안한 연두/세이지
  brandInk: "#0F1F16",
  warn: "#F2C94C",
  danger: "#EB5757",
  ok: "#27AE60",
};

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  // dateStr: YYYY-MM-DD
  const [y, m, d] = dateStr.split("-").map((v) => Number(v));
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = target.getTime() - today.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function storageLabel(storage: string) {
  switch (storage) {
    case "FRIDGE":
      return "냉장";
    case "FREEZER":
      return "냉동";
    case "PANTRY":
      return "실온";
    default:
      return storage;
  }
}

function urgencyBadge(d: number | null) {
  if (d === null)
    return {
      label: "미설정",
      color: THEME.muted,
      bg: "rgba(107,114,128,0.12)",
    };
  if (d <= 0)
    return {
      label: "D-0 임박",
      color: THEME.danger,
      bg: "rgba(235,87,87,0.12)",
    };
  if (d <= 2)
    return { label: `D-${d}`, color: "#B7791F", bg: "rgba(242,201,76,0.16)" };
  return { label: "여유", color: THEME.ok, bg: "rgba(39,174,96,0.12)" };
}

export default function InventoryScreen() {
  const [items, setItems] = useState<Inventory[]>([]);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // UI states
  const [q, setQ] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Add form
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("개");
  const [storage, setStorage] = useState<"FRIDGE" | "FREEZER" | "PANTRY">(
    "FRIDGE",
  );
  const [expiresAt, setExpiresAt] = useState(""); // YYYY-MM-DD

  const load = useCallback(async () => {
    setError("");
    setRefreshing(true);
    try {
      const res = await api.get<Inventory[]>("/inventory");
      setItems(res.data ?? []);
    } catch (e: any) {
      setError(explainNetworkHint(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((x) =>
      (x.itemName || "").toLowerCase().includes(keyword),
    );
  }, [items, q]);

  const resetForm = useCallback(() => {
    setName("");
    setQty("1");
    setUnit("개");
    setStorage("FRIDGE");
    setExpiresAt("");
  }, []);

  const add = useCallback(async () => {
    setError("");
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("품목명을 입력해줘.");
      return;
    }

    const parsedQty = Number(qty || "1");
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      setError("수량은 0보다 큰 숫자여야 해.");
      return;
    }

    try {
      const body: any = {
        itemName: trimmedName,
        quantity: parsedQty,
        unit: unit.trim() ? unit.trim() : null,
        storage,
      };
      if (expiresAt.trim()) body.expiresAt = expiresAt.trim(); // YYYY-MM-DD

      await api.post("/inventory", body);
      setIsAddOpen(false);
      resetForm();
      await load();
    } catch (e: any) {
      setError(explainNetworkHint(e));
    }
  }, [expiresAt, load, name, qty, resetForm, storage, unit]);

  const remove = useCallback(
    async (id: number) => {
      setError("");
      try {
        await api.delete(`/inventory/${id}`);
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

  const Header = (
    <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12 }}>
      {/* Topbar */}
      <View style={styles.topbar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h2}>Inventory</Text>
          <Text style={styles.sub}>냉장고 재고(유통기한) 관리</Text>
        </View>

        <Pressable
          onPress={() => setIsAddOpen(true)}
          style={({ pressed }) => [
            styles.btnPrimary,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.btnPrimaryText}>재료 추가</Text>
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="재고 검색 (예: 우유, 대파)"
          placeholderTextColor="rgba(31,41,55,0.45)"
          style={styles.searchInput}
        />
        {q.length > 0 ? (
          <Pressable onPress={() => setQ("")} style={styles.clearBtn}>
            <Text style={{ color: THEME.muted, fontWeight: "700" }}>×</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Section head */}
      <View style={styles.sectionHead}>
        <View>
          <Text style={styles.h3}>재고 리스트</Text>
          <Text style={styles.meta}>임박(D-2 이내) 강조</Text>
        </View>
      </View>

      {/* Error banner */}
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
      <FlatList
        data={filtered}
        keyExtractor={(x) => String(x.id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} />
        }
        ListHeaderComponent={Header}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }) => {
          const d = daysUntil(item.expiresAt);
          const badge = urgencyBadge(d);

          // 임박일수에 따라 살짝 경고 느낌 border
          const borderColor =
            d !== null && d <= 2 ? "rgba(242,201,76,0.35)" : THEME.border;

          return (
            <View style={[styles.card, { marginHorizontal: 14, borderColor }]}>
              <View style={{ flex: 1 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.itemName}>
                    {item.itemName}{" "}
                    <Text style={styles.itemQty}>
                      · {item.quantity}
                      {item.unit ?? ""}
                    </Text>
                  </Text>

                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: badge.bg, borderColor: "transparent" },
                    ]}
                  >
                    <Text style={[styles.badgeText, { color: badge.color }]}>
                      {badge.label}
                    </Text>
                  </View>
                </View>

                <Text style={styles.itemSub}>
                  수량: {item.quantity}
                  {item.unit ?? ""} · 보관: {storageLabel(item.storage)} ·
                  유통기한: {item.expiresAt ?? "-"}
                  {d !== null
                    ? ` (D${d >= 0 ? `-${d}` : `+${Math.abs(d)}`})`
                    : ""}
                </Text>

                <View style={{ height: 10 }} />

                <View style={styles.row}>
                  <Pressable
                    onPress={() => {
                      Alert.alert("삭제할까?", item.itemName, [
                        { text: "취소", style: "cancel" },
                        {
                          text: "삭제",
                          style: "destructive",
                          onPress: () => remove(item.id),
                        },
                      ]);
                    }}
                    style={({ pressed }) => [
                      styles.btnDanger,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={styles.btnDangerText}>삭제</Text>
                  </Pressable>

                  <View style={{ width: 10 }} />

                  <Pressable
                    onPress={() => {
                      Alert.alert(
                        "수정",
                        "MVP에서는 수정 UI만 있고, 실제 PATCH/PUT은 필요 시 추가하면 돼.",
                      );
                    }}
                    style={({ pressed }) => [
                      styles.btn,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={styles.btnText}>수정(예시)</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={[styles.empty, { marginHorizontal: 14 }]}>
            <View style={styles.emptyBubble}>
              <Text style={{ fontSize: 16 }}>🥬</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.emptyTitle}>재고가 비어있어</Text>
              <Text style={styles.emptyText}>
                재료를 추가하면 D-day 기준으로 임박 강조/추천이 동작하게
                설계했어.
              </Text>
            </View>
            <Pressable
              onPress={() => setIsAddOpen(true)}
              style={({ pressed }) => [
                styles.btnGhost,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.btnGhostText}>재료 추가</Text>
            </Pressable>
          </View>
        }
      />

      {/* Add Modal */}
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
                  autoCapitalize="none"
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
                  <Text style={styles.label}>단위</Text>
                  <TextInput
                    value={unit}
                    onChangeText={setUnit}
                    placeholder="예: 개, g, ml"
                    placeholderTextColor="rgba(31,41,55,0.45)"
                    style={styles.input}
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>보관</Text>
                <View style={styles.segment}>
                  {(["FRIDGE", "FREEZER", "PANTRY"] as const).map((v) => {
                    const active = storage === v;
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
                          {storageLabel(v)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>유통기한</Text>
                <TextInput
                  value={expiresAt}
                  onChangeText={setExpiresAt}
                  placeholder="YYYY-MM-DD (비우면 자동 가능)"
                  placeholderTextColor="rgba(31,41,55,0.45)"
                  style={styles.input}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.modalFooter}>
              <Pressable
                onPress={() => {
                  setIsAddOpen(false);
                  resetForm();
                }}
                style={({ pressed }) => [
                  styles.btnGhost,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.btnGhostText}>취소</Text>
              </Pressable>

              <View style={{ width: 10 }} />

              <Pressable
                onPress={add}
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
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  h2: { fontSize: 22, fontWeight: "800", color: THEME.text },
  sub: { marginTop: 2, fontSize: 12, color: THEME.muted },
  h3: { fontSize: 16, fontWeight: "800", color: THEME.text },
  meta: { marginTop: 2, fontSize: 12, color: THEME.muted },

  sectionHead: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.65)",
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 14,
  },

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
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  row: { flexDirection: "row", alignItems: "center" },

  itemName: { fontSize: 16, fontWeight: "900", color: THEME.text },
  itemQty: { fontWeight: "700", color: THEME.muted },
  itemSub: { marginTop: 6, fontSize: 12, color: THEME.muted, lineHeight: 16 },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: { fontSize: 12, fontWeight: "900" },

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
  btnText: { color: THEME.text, fontWeight: "800", fontSize: 13 },

  btnDanger: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(235,87,87,0.10)",
    borderWidth: 1,
    borderColor: "rgba(235,87,87,0.25)",
  },
  btnDangerText: { color: "#B42318", fontWeight: "900", fontSize: 13 },

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
  label: { fontSize: 12, color: THEME.muted, fontWeight: "800" },
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
