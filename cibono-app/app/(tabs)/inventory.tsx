import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { api, explainNetworkHint } from "../../src/api/client";

type Inventory = {
  id: number;
  userId: number;
  itemName: string;
  quantity: number;
  unit?: string | null;
  storage: string;
  purchasedAt?: string | null;
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

const UNIT_PRESETS = ["개", "병", "묶음", "판"];

const DATE_PRESETS = [
  { label: "오늘", days: 0 },
  { label: "+7일", days: 7 },
  { label: "+14일", days: 14 },
  { label: "+30일", days: 30 },
  { label: "+60일", days: 60 },
  { label: "+1년", days: 365 },
];

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
}

function storageLabel(s: string) {
  return s === "FRIDGE"
    ? "냉장"
    : s === "FREEZER"
      ? "냉동"
      : s === "PANTRY"
        ? "실온"
        : s;
}

function urgencyInfo(d: number | null) {
  if (d === null)
    return { icon: "·", color: THEME.muted, cardBg: "rgba(243,248,241,0.6)" };
  if (d < 0)
    return { icon: "🚨", color: THEME.danger, cardBg: "rgba(235,87,87,0.13)" };
  if (d === 0)
    return { icon: "🔴", color: THEME.danger, cardBg: "rgba(235,87,87,0.10)" };
  if (d <= 2)
    return { icon: "🟡", color: "#B7791F", cardBg: "rgba(242,201,76,0.16)" };
  return { icon: "🟢", color: THEME.ok, cardBg: "rgba(127,183,126,0.10)" };
}

function ddayLabel(d: number | null): string {
  if (d === null) return "기한 미설정";
  if (d < 0) return `D+${Math.abs(d)}`;
  if (d === 0) return "D-0";
  return `D-${d}`;
}

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
  const map: Record<FoodCategory, string> = {
    ALL: "전체",
    VEG: "채소",
    MEAT: "육류",
    DAIRY: "유제품",
    EGG: "계란",
    SEAFOOD: "해산물",
    OTHER: "기타",
  };
  return map[cat];
}

function sortLabel(k: SortKey) {
  const map: Record<SortKey, string> = {
    PURCHASED_DESC: "구매일자순",
    EXP_ASC: "유통기한↑",
    EXP_DESC: "유통기한↓",
    QTY_DESC: "수량순",
  };
  return map[k];
}

function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

function addDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function DateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>유통기한</Text>
      <TextInput
        value={value}
        onChangeText={(t) => onChange(formatDateInput(t))}
        placeholder="YYYY-MM-DD"
        placeholderTextColor="rgba(31,41,55,0.45)"
        style={styles.input}
        keyboardType="numeric"
        maxLength={10}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: 6 }}
      >
        <View style={{ flexDirection: "row", gap: 6 }}>
          {DATE_PRESETS.map((p) => (
            <Pressable
              key={p.label}
              onPress={() => onChange(addDays(p.days))}
              style={({ pressed }) => [
                styles.presetChip,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.presetChipText}>{p.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function UnitField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={[styles.field, { flex: 1 }]}>
      <Text style={styles.label}>단위</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="직접 입력"
        placeholderTextColor="rgba(31,41,55,0.45)"
        style={styles.input}
        autoCapitalize="none"
      />
      <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
        {UNIT_PRESETS.map((u) => (
          <Pressable
            key={u}
            onPress={() => onChange(u)}
            style={({ pressed }) => [
              styles.presetChip,
              value === u && styles.presetChipActive,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text
              style={[
                styles.presetChipText,
                value === u && styles.presetChipTextActive,
              ]}
            >
              {u}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function InventoryScreen() {
  const [items, setItems] = useState<Inventory[]>([]);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [q, setQ] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Inventory | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("EXP_ASC");
  const [storageFilter, setStorageFilter] = useState<StorageFilter>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<FoodCategory>("ALL");

  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("개");
  const [storage, setStorage] = useState<"FRIDGE" | "FREEZER" | "PANTRY">(
    "FRIDGE",
  );
  const [expiresAt, setExpiresAt] = useState("");

  const [editName, setEditName] = useState("");
  const [editQty, setEditQty] = useState("1");
  const [editUnit, setEditUnit] = useState("");
  const [editStorage, setEditStorage] = useState<
    "FRIDGE" | "FREEZER" | "PANTRY"
  >("FRIDGE");
  const [editExpiresAt, setEditExpiresAt] = useState("");

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

  const frequent = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) {
      const key = (it.itemName || "").trim();
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([n]) => n);
  }, [items]);

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    let arr = items;
    if (keyword)
      arr = arr.filter((x) =>
        (x.itemName || "").toLowerCase().includes(keyword),
      );
    if (storageFilter !== "ALL")
      arr = arr.filter((x) => x.storage === storageFilter);
    if (categoryFilter !== "ALL")
      arr = arr.filter((x) => inferCategory(x.itemName) === categoryFilter);
    return [...arr].sort((a, b) => {
      const expA = a.expiresAt ?? "9999-12-31",
        expB = b.expiresAt ?? "9999-12-31";
      const purA = a.purchasedAt ?? "0000-00-00",
        purB = b.purchasedAt ?? "0000-00-00";
      switch (sortKey) {
        case "PURCHASED_DESC":
          return purB.localeCompare(purA);
        case "EXP_DESC":
          return expB.localeCompare(expA);
        case "QTY_DESC":
          return (b.quantity ?? 0) - (a.quantity ?? 0);
        default:
          return expA.localeCompare(expB);
      }
    });
  }, [items, q, storageFilter, categoryFilter, sortKey]);

  // 3열 그리드 — 남는 칸을 null로 채워 마지막 행도 정사각형 유지
  const displayData = useMemo((): (Inventory | null)[] => {
    const rem = filtered.length % 3;
    if (rem === 0) return filtered;
    return [...filtered, ...Array(3 - rem).fill(null)];
  }, [filtered]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (sortKey !== "EXP_ASC") n++;
    if (storageFilter !== "ALL") n++;
    if (categoryFilter !== "ALL") n++;
    return n;
  }, [sortKey, storageFilter, categoryFilter]);

  const { width: windowWidth } = useWindowDimensions();
  // 3열 고정 너비: 패딩(10*2) + 갭(8*2) 제외 후 1/3
  const cardWidth = Math.floor((windowWidth - 20 - 16) / 3);

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
        unit: unit.trim() || null,
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

  const bumpQty = useCallback(
    async (inv: Inventory, delta: number) => {
      const next = Number(inv.quantity ?? 0) + delta;
      setItems((prev) =>
        prev.map((x) =>
          x.id === inv.id ? { ...x, quantity: Math.max(0, next) } : x,
        ),
      );
      try {
        if (next <= 0) await api.delete(`/inventory/${inv.id}`);
        else await api.patch(`/inventory/${inv.id}`, { quantity: next });
        await load();
      } catch (e: any) {
        setError(explainNetworkHint(e));
        await load();
      }
    },
    [load],
  );

  const openEdit = useCallback((inv: Inventory) => {
    setEditTarget(inv);
    setEditName(inv.itemName);
    setEditQty(String(inv.quantity));
    setEditUnit(inv.unit ?? "");
    setEditStorage((inv.storage as any) ?? "FRIDGE");
    setEditExpiresAt(inv.expiresAt ?? "");
    setIsEditOpen(true);
  }, []);

  const closeEdit = useCallback(() => {
    setIsEditOpen(false);
    setEditTarget(null);
  }, []);

  const deleteFromEdit = useCallback(async () => {
    if (!editTarget) return;
    Alert.alert("삭제할까?", editTarget.itemName, [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/inventory/${editTarget.id}`);
            closeEdit();
            await load();
          } catch (e: any) {
            setError(explainNetworkHint(e));
          }
        },
      },
    ]);
  }, [editTarget, closeEdit, load]);

  const saveEdit = useCallback(async () => {
    if (!editTarget) return;
    setError("");
    const parsedQty = Number(editQty || "1");
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      setError("수량은 0보다 큰 숫자여야 해.");
      return;
    }
    try {
      await api.patch(`/inventory/${editTarget.id}`, {
        itemName: editName.trim() || editTarget.itemName,
        quantity: parsedQty,
        unit: editUnit.trim() || null,
        storage: editStorage,
        expiresAt: editExpiresAt.trim() || null,
      });
      closeEdit();
      await load();
    } catch (e: any) {
      setError(explainNetworkHint(e));
    }
  }, [
    closeEdit,
    editExpiresAt,
    editName,
    editQty,
    editStorage,
    editTarget,
    editUnit,
    load,
  ]);

  const Header = (
    <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8 }}>
      {/* 타이틀 + 재료 추가 */}
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

      {/* 툴바: 🔍 검색 아이콘 + ⊟ 필터 아이콘 */}
      <View style={styles.toolbar}>
        <Pressable
          onPress={() => setShowSearch((p) => !p)}
          style={({ pressed }) => [
            styles.iconCircle,
            showSearch && styles.iconCircleActive,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.toolbarIconText}>🔍</Text>
        </Pressable>
        <View>
          <Pressable
            onPress={() => setFilterOpen((p) => !p)}
            style={({ pressed }) => [
              styles.iconCircle,
              filterOpen && styles.iconCircleActive,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.toolbarIconText}>🧪</Text>
          </Pressable>
          {activeFilterCount > 0 && <View style={styles.badgeDot} />}
        </View>
      </View>

      {/* 인라인 검색창 */}
      {showSearch && (
        <View style={styles.inlineSearch}>
          <Text style={styles.searchIconText}>⌕</Text>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="재고 검색 (예: 우유, 대파)"
            placeholderTextColor="rgba(31,41,55,0.45)"
            style={styles.searchInput}
            autoFocus
          />
          {q.length > 0 && (
            <Pressable onPress={() => setQ("")} style={styles.clearBtn}>
              <Text style={{ color: THEME.muted, fontWeight: "700" }}>×</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* 필터 패널 */}
      {filterOpen && (
        <View style={styles.filterPanel}>
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>정렬</Text>
            {(
              ["PURCHASED_DESC", "EXP_ASC", "EXP_DESC", "QTY_DESC"] as const
            ).map((k) => (
              <Pressable
                key={k}
                onPress={() => setSortKey(k)}
                style={({ pressed }) => [
                  styles.filterChip,
                  sortKey === k && styles.filterChipActive,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    sortKey === k && styles.filterChipTextActive,
                  ]}
                >
                  {sortLabel(k)}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>보관</Text>
            {(["ALL", "FRIDGE", "FREEZER", "PANTRY"] as const).map((k) => (
              <Pressable
                key={k}
                onPress={() => setStorageFilter(k)}
                style={({ pressed }) => [
                  styles.filterChip,
                  storageFilter === k && styles.filterChipActive,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    storageFilter === k && styles.filterChipTextActive,
                  ]}
                >
                  {k === "ALL" ? "전체" : storageLabel(k)}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>분류</Text>
            {(
              [
                "ALL",
                "VEG",
                "MEAT",
                "DAIRY",
                "EGG",
                "SEAFOOD",
                "OTHER",
              ] as const
            ).map((k) => (
              <Pressable
                key={k}
                onPress={() => setCategoryFilter(k)}
                style={({ pressed }) => [
                  styles.filterChip,
                  categoryFilter === k && styles.filterChipActive,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    categoryFilter === k && styles.filterChipTextActive,
                  ]}
                >
                  {categoryLabel(k)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

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
        data={displayData}
        keyExtractor={(x, i) => (x ? String(x.id) : `pad-${i}`)}
        numColumns={3}
        columnWrapperStyle={{ paddingHorizontal: 10, gap: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} />
        }
        ListHeaderComponent={Header}
        contentContainerStyle={{ paddingBottom: 110 }}
        renderItem={({ item }) => {
          if (!item)
            return <View style={{ width: cardWidth, minHeight: 140 }} />;

          const d = daysUntil(item.expiresAt);
          const u = urgencyInfo(d);
          const label = ddayLabel(d);

          return (
            <Pressable
              onPress={() => openEdit(item)}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: u.cardBg,
                  width: cardWidth,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={styles.cardTop}>
                <Text style={styles.itemName} numberOfLines={2}>
                  {item.itemName}
                </Text>
                <Text style={styles.urgencyIcon}>{u.icon}</Text>
              </View>
              <Text style={styles.itemMeta} numberOfLines={1}>
                {storageLabel(item.storage)}
                {"  "}
                {item.expiresAt ?? "—"}
              </Text>
              <Text style={[styles.dday, { color: u.color }]}>{label}</Text>
              <View style={{ flex: 1 }} />
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => bumpQty(item, -1)}
                  style={styles.stepBtn}
                >
                  <Text style={styles.stepBtnText}>−</Text>
                </Pressable>
                <Text style={styles.qtyText}>
                  {item.quantity}
                  {item.unit ?? ""}
                </Text>
                <Pressable
                  onPress={() => bumpQty(item, +1)}
                  style={styles.stepBtn}
                >
                  <Text style={styles.stepBtnText}>＋</Text>
                </Pressable>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={[styles.empty, { marginHorizontal: 10 }]}>
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
                onPress={() => {
                  setIsAddOpen(false);
                  resetForm();
                }}
                style={styles.iconBtn}
              >
                <Text style={{ fontSize: 18, color: THEME.muted }}>×</Text>
              </Pressable>
            </View>
            <ScrollView
              style={styles.modalScroll}
              keyboardShouldPersistTaps="handled"
            >
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
                  {frequent.length > 0 && (
                    <View style={styles.dropdown}>
                      <Text style={styles.dropdownLabel}>자주 쓰는 재료</Text>
                      <View style={styles.chipsRow}>
                        {frequent.map((n) => (
                          <Pressable
                            key={n}
                            onPress={() => setName(n)}
                            style={({ pressed }) => [
                              styles.chip,
                              name === n && styles.chipActive,
                              pressed && { opacity: 0.8 },
                            ]}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                name === n && styles.chipTextActive,
                              ]}
                            >
                              {n}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
                <View style={styles.grid2}>
                  <View style={[styles.field, { flex: 1 }]}>
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
                  <UnitField value={unit} onChange={setUnit} />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>보관</Text>
                  <View style={styles.segment}>
                    {(["FRIDGE", "FREEZER", "PANTRY"] as const).map((v) => (
                      <Pressable
                        key={v}
                        onPress={() => setStorage(v)}
                        style={({ pressed }) => [
                          styles.segmentBtn,
                          storage === v && styles.segmentBtnActive,
                          pressed && { opacity: 0.9 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.segmentText,
                            storage === v && styles.segmentTextActive,
                          ]}
                        >
                          {storageLabel(v)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <DateField value={expiresAt} onChange={setExpiresAt} />
              </View>
            </ScrollView>
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

      <Modal
        transparent
        visible={isEditOpen}
        animationType="fade"
        onRequestClose={closeEdit}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>재료 수정</Text>
              <Pressable onPress={closeEdit} style={styles.iconBtn}>
                <Text style={{ fontSize: 18, color: THEME.muted }}>×</Text>
              </Pressable>
            </View>
            <ScrollView
              style={styles.modalScroll}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalBody}>
                <View style={styles.field}>
                  <Text style={styles.label}>품목명</Text>
                  <TextInput
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="품목명"
                    placeholderTextColor="rgba(31,41,55,0.45)"
                    style={styles.input}
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.grid2}>
                  <View style={[styles.field, { flex: 1 }]}>
                    <Text style={styles.label}>수량</Text>
                    <TextInput
                      value={editQty}
                      onChangeText={setEditQty}
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
                  <UnitField value={editUnit} onChange={setEditUnit} />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>보관</Text>
                  <View style={styles.segment}>
                    {(["FRIDGE", "FREEZER", "PANTRY"] as const).map((v) => (
                      <Pressable
                        key={v}
                        onPress={() => setEditStorage(v)}
                        style={({ pressed }) => [
                          styles.segmentBtn,
                          editStorage === v && styles.segmentBtnActive,
                          pressed && { opacity: 0.9 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.segmentText,
                            editStorage === v && styles.segmentTextActive,
                          ]}
                        >
                          {storageLabel(v)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <DateField value={editExpiresAt} onChange={setEditExpiresAt} />
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <Pressable
                onPress={deleteFromEdit}
                style={({ pressed }) => [
                  styles.btnDanger,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.btnDangerText}>삭제</Text>
              </Pressable>
              <View style={{ flex: 1 }} />
              <Pressable
                onPress={closeEdit}
                style={({ pressed }) => [
                  styles.btnGhost,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.btnGhostText}>취소</Text>
              </Pressable>
              <View style={{ width: 10 }} />
              <Pressable
                onPress={saveEdit}
                style={({ pressed }) => [
                  styles.btnPrimary,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.btnPrimaryText}>저장</Text>
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

  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
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
  toolbarIconText: { fontSize: 16 },
  badgeDot: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.brand,
    borderWidth: 1,
    borderColor: THEME.bg,
  },

  inlineSearch: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  searchIconText: { color: THEME.muted, marginRight: 8, fontSize: 14 },
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

  filterPanel: {
    marginTop: 8,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.65)",
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 14,
    gap: 10,
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
    marginRight: 4,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  filterChipActive: {
    borderColor: "rgba(127,183,126,0.4)",
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 8,
    marginBottom: 8,
    minHeight: 140,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 3,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "900",
    color: THEME.text,
    flex: 1,
    marginRight: 2,
  },
  urgencyIcon: { fontSize: 13 },
  itemMeta: { fontSize: 10, color: THEME.muted, marginBottom: 2 },
  dday: { fontSize: 11, fontWeight: "900", marginBottom: 4 },

  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.7)",
    marginBottom: 4,
  },
  stepBtn: {
    width: 26,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: { fontSize: 13, fontWeight: "900", color: THEME.text },
  qtyText: { fontSize: 11, fontWeight: "900", color: THEME.text },

  btnDanger: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(235,87,87,0.10)",
    borderWidth: 1,
    borderColor: "rgba(235,87,87,0.30)",
  },
  btnDangerText: { color: "#B42318", fontWeight: "900", fontSize: 13 },

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
    maxHeight: "85%",
    borderRadius: 18,
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.border,
    overflow: "hidden",
  },
  modalScroll: { flexGrow: 0 },
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
  inputReadonly: {
    backgroundColor: "rgba(107,114,128,0.07)",
    justifyContent: "center",
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

  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(127,183,126,0.35)",
    backgroundColor: "rgba(127,183,126,0.12)",
  },
  presetChipActive: {
    borderColor: THEME.brand,
    backgroundColor: "rgba(127,183,126,0.30)",
  },
  presetChipText: { fontSize: 12, fontWeight: "800", color: THEME.brandInk },
  presetChipTextActive: { color: THEME.brandInk, fontWeight: "900" },

  dropdown: {
    marginTop: 6,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  dropdownLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: THEME.muted,
    marginBottom: 8,
  },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(127,183,126,0.35)",
    backgroundColor: "rgba(127,183,126,0.12)",
  },
  chipActive: {
    borderColor: THEME.brand,
    backgroundColor: "rgba(127,183,126,0.30)",
  },
  chipText: { fontSize: 12, fontWeight: "900", color: THEME.brandInk },
  chipTextActive: { fontWeight: "900" },
};
