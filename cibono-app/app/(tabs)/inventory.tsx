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
  purchasedAt?: string | null; // YYYY-MM-DD
  expiresAt?: string | null; // YYYY-MM-DD
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

type SortKey = "PURCHASED_DESC" | "EXP_ASC" | "EXP_DESC" | "QTY_DESC";
type StorageFilter = "ALL" | "FRIDGE" | "FREEZER" | "PANTRY";
type FoodCategory =
  | "ALL"
  | "VEG"
  | "MEAT"
  | "DAIRY"
  | "EGG"
  | "SEAFOOD"
  | "OTHER";

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
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

  // ✅ 유통기한 지난 경우
  if (d < 0)
    return {
      label: "긴급 소진",
      color: THEME.danger,
      bg: "rgba(235,87,87,0.14)",
    };

  if (d === 0)
    return {
      label: "D-0 임박",
      color: THEME.danger,
      bg: "rgba(235,87,87,0.12)",
    };

  if (d <= 2)
    return { label: `D-${d}`, color: "#B7791F", bg: "rgba(242,201,76,0.16)" };

  return { label: "여유", color: THEME.ok, bg: "rgba(39,174,96,0.12)" };
}

// MVP: 프론트 추론 카테고리
function inferCategory(itemName: string): FoodCategory {
  const s = (itemName || "").replace(/\s+/g, "");
  if (/(우유|치즈|요거트|버터)/.test(s)) return "DAIRY";
  if (/(계란|달걀)/.test(s)) return "EGG";
  if (/(돼지|삼겹|목살|소고기|닭|닭가슴살|한우)/.test(s)) return "MEAT";
  if (/(오징어|새우|연어|참치|고등어|문어|조개|게)/.test(s)) return "SEAFOOD";
  if (/(대파|양파|마늘|감자|당근|상추|버섯|오이|토마토|고추|배추|무)/.test(s))
    return "VEG";
  return "OTHER";
}

function categoryLabel(cat: FoodCategory) {
  switch (cat) {
    case "ALL":
      return "전체";
    case "VEG":
      return "채소";
    case "MEAT":
      return "육류";
    case "DAIRY":
      return "유제품";
    case "EGG":
      return "계란";
    case "SEAFOOD":
      return "해산물";
    default:
      return "기타";
  }
}

function sortLabel(k: SortKey) {
  switch (k) {
    case "PURCHASED_DESC":
      return "구매일자순";
    case "EXP_ASC":
      return "유통기한↑";
    case "EXP_DESC":
      return "유통기한↓";
    case "QTY_DESC":
      return "수량순";
    default:
      return "유통기한↑";
  }
}

export default function InventoryScreen() {
  const [items, setItems] = useState<Inventory[]>([]);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // UI states
  const [q, setQ] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>("EXP_ASC");
  const [storageFilter, setStorageFilter] = useState<StorageFilter>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<FoodCategory>("ALL");

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

  React.useEffect(() => {
    load();
  }, [load]);

  // 자주 사는 재료(현 inventory 기준 빈도)
  const frequent = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) {
      const key = (it.itemName || "").trim();
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => name);
  }, [items]);

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    let arr = items;

    if (keyword) {
      arr = arr.filter((x) =>
        (x.itemName || "").toLowerCase().includes(keyword),
      );
    }

    if (storageFilter !== "ALL") {
      arr = arr.filter((x) => x.storage === storageFilter);
    }

    if (categoryFilter !== "ALL") {
      arr = arr.filter((x) => inferCategory(x.itemName) === categoryFilter);
    }

    // sort
    arr = [...arr].sort((a, b) => {
      const expA = a.expiresAt ?? "9999-12-31";
      const expB = b.expiresAt ?? "9999-12-31";
      const purA = a.purchasedAt ?? "0000-00-00";
      const purB = b.purchasedAt ?? "0000-00-00";

      switch (sortKey) {
        case "PURCHASED_DESC":
          return purB.localeCompare(purA);
        case "EXP_DESC":
          return expB.localeCompare(expA);
        case "QTY_DESC":
          return (b.quantity ?? 0) - (a.quantity ?? 0);
        case "EXP_ASC":
        default:
          return expA.localeCompare(expB);
      }
    });

    return arr;
  }, [items, q, storageFilter, categoryFilter, sortKey]);

  const resetForm = useCallback(() => {
    setName("");
    setQty("1");
    setUnit("개");
    setStorage("FRIDGE");
    setExpiresAt("");
  }, []);

  const openAddPrefill = useCallback((itemName: string) => {
    setName(itemName);
    setIsAddOpen(true);
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
      if (expiresAt.trim()) body.expiresAt = expiresAt.trim();

      await api.post("/inventory", body);
      setIsAddOpen(false);
      resetForm();
      await load();
    } catch (e: any) {
      setError(explainNetworkHint(e));
    }
  }, [expiresAt, load, name, qty, resetForm, storage, unit]);

  // ✅ 수량 스텝퍼: -/+ 로 바로 조절. 0이면 자동 삭제 시도
  const bumpQty = useCallback(
    async (inv: Inventory, delta: number) => {
      setError("");

      const next = Number(inv.quantity ?? 0) + delta;

      // optimistic update
      setItems((prev) =>
        prev.map((x) =>
          x.id === inv.id ? { ...x, quantity: Math.max(0, next) } : x,
        ),
      );

      try {
        if (next <= 0) {
          // 자동 삭제
          await api.delete(`/inventory/${inv.id}`);
        } else {
          await api.patch(`/inventory/${inv.id}`, { quantity: next });
        }
        await load();
      } catch (e: any) {
        // rollback
        setError(explainNetworkHint(e));
        await load();
      }
    },
    [load],
  );

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

  const Header = (
    <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12 }}>
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

      {/* 자주 사는 식재료 */}
      {frequent.length ? (
        <View style={styles.frequentBox}>
          <Text style={styles.frequentTitle}>자주 쓰는 재료</Text>
          <View style={styles.chipsRow}>
            {frequent.map((n) => (
              <Pressable
                key={n}
                onPress={() => openAddPrefill(n)}
                style={({ pressed }) => [
                  styles.chip,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.chipText}>{n}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

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

      {/* Filters */}
      <View style={styles.sectionHead}>
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>정렬</Text>
          {(["PURCHASED_DESC", "EXP_ASC", "EXP_DESC", "QTY_DESC"] as const).map(
            (k) => {
              const active = sortKey === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => setSortKey(k)}
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
                    {sortLabel(k)}
                  </Text>
                </Pressable>
              );
            },
          )}
        </View>

        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>보관</Text>
          {(["ALL", "FRIDGE", "FREEZER", "PANTRY"] as const).map((k) => {
            const active = storageFilter === k;
            const label = k === "ALL" ? "전체" : storageLabel(k);
            return (
              <Pressable
                key={k}
                onPress={() => setStorageFilter(k)}
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

        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>분류</Text>
          {(
            ["ALL", "VEG", "MEAT", "DAIRY", "EGG", "SEAFOOD", "OTHER"] as const
          ).map((k) => {
            const active = categoryFilter === k;
            return (
              <Pressable
                key={k}
                onPress={() => setCategoryFilter(k)}
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
                  {categoryLabel(k)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

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
        contentContainerStyle={{ paddingBottom: 110 }}
        renderItem={({ item }) => {
          const d = daysUntil(item.expiresAt);
          const badge = urgencyBadge(d);

          const borderColor =
            d !== null && d <= 2 ? "rgba(242,201,76,0.35)" : THEME.border;

          return (
            <View style={[styles.card, { marginHorizontal: 14, borderColor }]}>
              <View style={styles.rowBetween}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.itemName}
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
                보관: {storageLabel(item.storage)} · 유통기한:{" "}
                {item.expiresAt ?? "-"}
                {d !== null
                  ? ` (D${d >= 0 ? `-${d}` : `+${Math.abs(d)}`})`
                  : ""}
              </Text>

              <View style={{ height: 10 }} />

              {/* ✅ 수량 스텝퍼 (수정이 더 쉬움) */}
              <View style={styles.qtyRow}>
                <Text style={styles.qtyLabel}>수량</Text>

                <View style={styles.stepper}>
                  <Pressable
                    onPress={() => bumpQty(item, -1)}
                    style={({ pressed }) => [
                      styles.stepBtn,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={styles.stepBtnText}>−</Text>
                  </Pressable>

                  <View style={styles.qtyBox}>
                    <Text style={styles.qtyText}>
                      {item.quantity}
                      {item.unit ?? ""}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => bumpQty(item, +1)}
                    style={({ pressed }) => [
                      styles.stepBtn,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={styles.stepBtnText}>＋</Text>
                  </Pressable>
                </View>

                {/* 삭제는 뒤로/작게 */}
                <Pressable
                  onPress={() =>
                    Alert.alert("삭제할까?", item.itemName, [
                      { text: "취소", style: "cancel" },
                      {
                        text: "삭제",
                        style: "destructive",
                        onPress: () => remove(item.id),
                      },
                    ])
                  }
                  style={({ pressed }) => [
                    styles.smallDanger,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.smallDangerText}>삭제</Text>
                </Pressable>
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
                재료를 추가하면 D-day 기준으로 임박 강조/추천이 동작해.
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
  topbar: { flexDirection: "row", alignItems: "center", gap: 10 },
  h2: { fontSize: 22, fontWeight: "800", color: THEME.text },
  sub: { marginTop: 2, fontSize: 12, color: THEME.muted },
  meta: { marginTop: 10, fontSize: 12, color: THEME.muted },

  // frequent
  frequentBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: "rgba(255,255,255,0.82)",
  },
  frequentTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: THEME.muted,
    marginBottom: 8,
  },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(127,183,126,0.35)",
    backgroundColor: "rgba(127,183,126,0.18)",
  },
  chipText: { fontSize: 12, fontWeight: "900", color: THEME.brandInk },

  sectionHead: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.65)",
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 14,
    gap: 10,
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

  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: THEME.muted,
    marginRight: 6,
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
  itemName: { fontSize: 16, fontWeight: "900", color: THEME.text, flex: 1 },
  itemSub: { marginTop: 6, fontSize: 12, color: THEME.muted, lineHeight: 16 },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: { fontSize: 12, fontWeight: "900" },

  qtyRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  qtyLabel: { fontSize: 12, fontWeight: "900", color: THEME.muted, width: 34 },

  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  stepBtn: {
    width: 38,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: { fontSize: 18, fontWeight: "900", color: THEME.text },
  qtyBox: {
    paddingHorizontal: 12,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: { fontSize: 13, fontWeight: "900", color: THEME.text },

  smallDanger: {
    marginLeft: "auto",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(235,87,87,0.10)",
    borderWidth: 1,
    borderColor: "rgba(235,87,87,0.25)",
  },
  smallDangerText: { color: "#B42318", fontWeight: "900", fontSize: 12 },

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
