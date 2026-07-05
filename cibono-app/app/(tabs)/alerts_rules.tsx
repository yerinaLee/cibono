import { MaterialIcons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  FlatList,
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
import AppHeader from "../../components/AppHeader";
import { api, explainNetworkHint } from "../../src/api/client";

type Store = {
  id: number;
  name: string;
  region: string | null;
};

type Rule = {
  id: number;
  itemName: string;
  anchorPrice: number;
  active: boolean; // MVP: 로컬 토글(UI)
  storeId?: number | null;
  storeName?: string;
  unit?: string | null;
  quantity?: number | null;
};

const UNIT_OPTIONS = ["전체", "개", "kg", "g", "ml", "L"] as const;

const SCROLL_TOP_THRESHOLD = 300;

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
  redBg: "rgba(232,107,107,0.10)",
  redBd: "rgba(232,107,107,0.22)",
  redInk: "#5a1a1d",
};

type RuleDto = {
  id: number;
  item: { name: string };
  thresholdPrice: number;
  isEnabled: boolean;
  storeId: number | null;
  unit: string | null;
  quantity: number | null;
  createdAt: string;
};

export default function AlertRulesScreen() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [stores, setStores] = useState<Store[]>([]);

  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Bottom Sheet (Modal)
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [itemName, setItemName] = useState("");
  const [anchorPrice, setAnchorPrice] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [storePickerOpen, setStorePickerOpen] = useState(false);
  const [unit, setUnit] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [showScrollTop, setShowScrollTop] = useState(false);
  const listRef = useRef<FlatList>(null);

  const handleScroll = useCallback((e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    setShowScrollTop(y > SCROLL_TOP_THRESHOLD);
  }, []);

  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rules;
    return rules.filter((r) =>
      `${r.itemName} ${r.anchorPrice}`.toLowerCase().includes(q),
    );
  }, [rules, search]);

  const activeCount = useMemo(
    () => rules.filter((r) => r.active).length,
    [rules],
  );

  const selectedStoreName = useMemo(
    () => stores.find((s) => s.id === selectedStoreId)?.name ?? null,
    [selectedStoreId, stores],
  );

  const load = useCallback(async () => {
    setError("");
    setRefreshing(true);
    try {
      const [rulesRes, storesRes] = await Promise.all([
        api.get<{ data: RuleDto[] }>("/alert-rules"),
        api.get<{ data: Store[] }>("/stores"),
      ]);
      const storeList = storesRes.data.data;
      setStores(storeList);
      const sorted = [...rulesRes.data.data].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setRules(
        sorted.map((r) => ({
          id: r.id,
          itemName: r.item.name,
          anchorPrice: r.thresholdPrice,
          active: r.isEnabled,
          storeId: r.storeId ?? undefined,
          storeName: r.storeId
            ? storeList.find((s) => s.id === r.storeId)?.name
            : undefined,
          unit: r.unit,
          quantity: r.quantity,
        })),
      );
    } catch (e: any) {
      setError(explainNetworkHint(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const toggleActive = useCallback(async (id: number) => {
    setError("");
    try {
      await api.patch(`/alert-rules/${id}/toggle`);
      setRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r)),
      );
    } catch (e: any) {
      setError(explainNetworkHint(e));
    }
  }, []);

  const removeLocal = useCallback(async (id: number) => {
    setError("");
    try {
      await api.delete(`/alert-rules/${id}`);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (e: any) {
      setError(explainNetworkHint(e));
    }
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setEditingId(null);
    setItemName("");
    setAnchorPrice("");
    setSelectedStoreId(null);
    setUnit(null);
    setQuantity("");
    setConfirmDelete(false);
  }, []);

  const openAddModal = useCallback(() => {
    setEditingId(null);
    setItemName("");
    setAnchorPrice("");
    setSelectedStoreId(null);
    setUnit(null);
    setQuantity("");
    setConfirmDelete(false);
    setIsOpen(true);
  }, []);

  const openEditModal = useCallback((rule: Rule) => {
    setEditingId(rule.id);
    setItemName(rule.itemName);
    setAnchorPrice(String(rule.anchorPrice));
    setSelectedStoreId(rule.storeId ?? null);
    setUnit(rule.unit ?? null);
    setQuantity(rule.quantity != null ? String(rule.quantity) : "");
    setConfirmDelete(false);
    setIsOpen(true);
  }, []);

  const saveRule = useCallback(async () => {
    setError("");
    const name = itemName.trim();
    const price = Number(anchorPrice || "0");

    if (!name) {
      setError("품목명을 입력해줘.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setError("기준가는 0보다 큰 숫자여야 해.");
      return;
    }
    const trimmedQuantity = quantity.trim();
    const qty = trimmedQuantity ? Number(trimmedQuantity) : null;
    if (trimmedQuantity && (!Number.isFinite(qty) || (qty as number) <= 0)) {
      setError("수량은 0보다 큰 숫자여야 해.");
      return;
    }
    const nameTaken = rules.some(
      (r) => r.id !== editingId && r.itemName.trim().toLowerCase() === name.toLowerCase(),
    );
    if (nameTaken) {
      setError("이미 등록된 품목이야. 규칙은 품목당 1개만 만들 수 있어.");
      return;
    }

    const storeName = selectedStoreId
      ? stores.find((s) => s.id === selectedStoreId)?.name
      : undefined;

    try {
      if (editingId != null) {
        // 규칙 수정
        await api.put(`/alert-rules/${editingId}`, {
          itemName: name,
          thresholdPrice: price,
          storeId: selectedStoreId,
          unit,
          quantity: qty,
        });
        setRules((prev) =>
          prev.map((r) =>
            r.id === editingId
              ? { ...r, itemName: name, anchorPrice: price, storeId: selectedStoreId, storeName, unit, quantity: qty }
              : r,
          ),
        );
      } else {
        // 규칙 생성
        const res = await api.post("/alert-rules", {
          itemName: name,
          thresholdPrice: price,
          storeId: selectedStoreId,
          unit,
          quantity: qty,
        });

        // 서버가 반환한 id가 있으면 사용, 없으면 임시 id
        const newId = res?.data?.id ?? Date.now();
        setRules((prev) => [
          { id: newId, itemName: name, anchorPrice: price, active: true, storeId: selectedStoreId, storeName, unit, quantity: qty },
          ...prev,
        ]);
      }

      closeModal();
    } catch (e: any) {
      setError(explainNetworkHint(e));
    }
  }, [anchorPrice, closeModal, editingId, itemName, quantity, rules, selectedStoreId, stores, unit]);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: THEME.bg }}
      edges={["bottom", "left", "right"]}
    >
      {/* 고정 헤더 (공유 AppHeader) */}
      <AppHeader title="알림 관리" subtitle="기준가 대비 특가 감지 알림 규칙 관리" />

      {/* 고정 영역 (툴바·검색·섹션) */}
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
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={openAddModal}
            style={({ pressed }) => [
              styles.iconCircleAdd,
              pressed && { opacity: 0.85 },
            ]}
            accessibilityLabel="새 규칙"
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
              placeholder="규칙 검색"
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
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 110 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openEditModal(item)}
            style={({ pressed }) => [
              styles.itemCard,
              !item.active && { opacity: 0.55 },
              pressed && { opacity: 0.85 },
            ]}
          >

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
                    ≤ {item.anchorPrice.toLocaleString()}원
                    {item.unit ? ` / ${item.quantity ?? ""}${item.unit}` : ""}
                  </Text>
                </View>
              </View>
              <Text style={styles.itemSub}>
                {item.storeName ? `🏪 ${item.storeName}` : "전체 마트"} · 단위:{" "}
                {item.unit ? `${item.quantity ?? ""}${item.unit}` : "전체"} · 상태: {item.active ? "활성" : "비활성"}
              </Text>

              <View style={{ height: 10 }} />

              <View
                style={{ flexDirection: "row", gap: 10, alignItems: "center" }}
              >
                <Pressable
                  onPress={() => toggleActive(item.id)}
                  style={({ pressed }) => [
                    styles.toggle,
                    item.active && styles.toggleOn,
                    { marginLeft: "auto" },
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <View
                    style={[
                      styles.toggleKnob,
                      item.active && { marginLeft: 16 },
                    ]}
                  />
                </Pressable>
              </View>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyBubble}>
              <Text style={{ fontSize: 16 }}>🏷</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.emptyTitle}>규칙이 없어</Text>
              <Text style={styles.emptyText}>
                자주 사는 품목부터 5개만 등록해도 알림이 유용해져.
              </Text>
            </View>
            <Pressable
              onPress={openAddModal}
              style={({ pressed }) => [
                styles.btnGhost,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.btnGhostText}>새 규칙</Text>
            </Pressable>
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

      {/* Bottom Sheet (Modal) */}
      <Modal
        transparent
        visible={isOpen}
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  {editingId != null ? "규칙 수정" : "새 규칙 추가"}
                </Text>
                <Text style={styles.sheetDesc}>
                  품목명 · 기준가 · 조건을 설정해요
                </Text>
              </View>
              <Pressable
                onPress={closeModal}
                style={({ pressed }) => [
                  styles.iconBtn,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={{ fontWeight: "900" }}>×</Text>
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
                  value={itemName}
                  onChangeText={setItemName}
                  placeholder="예: 두부"
                  placeholderTextColor="rgba(31,41,55,0.45)"
                  style={styles.input}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>기준가(원)</Text>
                <TextInput
                  value={anchorPrice}
                  onChangeText={setAnchorPrice}
                  placeholder="예: 1400"
                  placeholderTextColor="rgba(31,41,55,0.45)"
                  style={styles.input}
                  keyboardType={
                    Platform.OS === "ios"
                      ? "numbers-and-punctuation"
                      : "numeric"
                  }
                />
              </View>

              {/* 수량 입력 */}
              <View style={styles.field}>
                <Text style={styles.label}>수량 (선택 안 하면 수량 무관하게 비교)</Text>
                <TextInput
                  value={quantity}
                  onChangeText={setQuantity}
                  placeholder="예: 2"
                  placeholderTextColor="rgba(31,41,55,0.45)"
                  style={styles.input}
                  keyboardType={
                    Platform.OS === "ios"
                      ? "numbers-and-punctuation"
                      : "numeric"
                  }
                />
              </View>

              {/* 단위 선택 */}
              <View style={styles.field}>
                <Text style={styles.label}>단위 (선택 안 하면 단위 무관하게 비교)</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {UNIT_OPTIONS.map((u) => {
                    const value = u === "전체" ? null : u;
                    const selected = unit === value;
                    return (
                      <Pressable
                        key={u}
                        onPress={() => setUnit(value)}
                        style={({ pressed }) => [
                          styles.filterChip,
                          selected && styles.filterChipActive,
                          pressed && { opacity: 0.9 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            selected && styles.filterChipTextActive,
                          ]}
                        >
                          {u}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* 마트 선택 */}
              <View style={styles.field}>
                <Text style={styles.label}>마트 선택 (선택 안 하면 전체 마트)</Text>
                <Pressable
                  onPress={() => setStorePickerOpen(true)}
                  style={[styles.input, { justifyContent: "center" }]}
                >
                  <Text style={{ color: selectedStoreId ? THEME.text : "rgba(31,41,55,0.45)", fontSize: 14 }}>
                    {selectedStoreName ?? "전체 마트"}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.tip}>
                <View style={styles.tipBubble}>
                  <Text style={{ fontSize: 14 }}>💡</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tipTitle}>팁</Text>
                  <Text style={styles.tipText}>
                    규칙 10개만 등록해도 알림 정확도가 확 올라가.
                  </Text>
                </View>
              </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              {confirmDelete ? (
                <>
                  <Text
                    style={{
                      fontSize: 13,
                      color: THEME.redInk,
                      fontWeight: "800",
                      flex: 1,
                    }}
                  >
                    정말 삭제할까요?
                  </Text>
                  <Pressable
                    onPress={() => setConfirmDelete(false)}
                    style={({ pressed }) => [
                      styles.btnGhost,
                      pressed && { opacity: 0.9 },
                    ]}
                  >
                    <Text style={styles.btnGhostText}>아니오</Text>
                  </Pressable>
                  <View style={{ width: 8 }} />
                  <Pressable
                    onPress={async () => {
                      if (editingId != null) {
                        await removeLocal(editingId);
                      }
                      closeModal();
                    }}
                    style={({ pressed }) => [
                      styles.btnDanger,
                      pressed && { opacity: 0.9 },
                    ]}
                  >
                    <Text style={styles.btnDangerText}>예, 삭제</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  {editingId != null ? (
                    <Pressable
                      onPress={() => setConfirmDelete(true)}
                      style={({ pressed }) => [
                        styles.btnDanger,
                        pressed && { opacity: 0.9 },
                      ]}
                    >
                      <Text style={styles.btnDangerText}>삭제</Text>
                    </Pressable>
                  ) : (
                    <View />
                  )}
                  <View style={{ flexDirection: "row" }}>
                    <Pressable
                      onPress={closeModal}
                      style={({ pressed }) => [
                        styles.btnGhost,
                        pressed && { opacity: 0.9 },
                      ]}
                    >
                      <Text style={styles.btnGhostText}>취소</Text>
                    </Pressable>
                    <View style={{ width: 10 }} />
                    <Pressable
                      onPress={saveRule}
                      style={({ pressed }) => [
                        styles.btnPrimary,
                        pressed && { opacity: 0.9 },
                      ]}
                    >
                      <Text style={styles.btnPrimaryText}>
                        {editingId != null ? "저장" : "규칙 추가"}
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* 마트 선택 모달 */}
      <Modal
        transparent
        visible={storePickerOpen}
        animationType="fade"
        onRequestClose={() => setStorePickerOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setStorePickerOpen(false)}>
          <View style={[styles.sheet, { maxHeight: "60%" }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>마트 선택</Text>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 20 }}>
              <Pressable
                onPress={() => { setSelectedStoreId(null); setStorePickerOpen(false); }}
                style={[styles.storeOption, !selectedStoreId && styles.storeOptionSelected]}
              >
                <Text style={[styles.storeOptionText, !selectedStoreId && { color: THEME.brandInk, fontWeight: "900" }]}>
                  전체 마트
                </Text>
                {!selectedStoreId && <Text style={{ color: THEME.brand }}>✓</Text>}
              </Pressable>
              {stores.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => { setSelectedStoreId(s.id); setStorePickerOpen(false); }}
                  style={[styles.storeOption, selectedStoreId === s.id && styles.storeOptionSelected]}
                >
                  <Text style={[styles.storeOptionText, selectedStoreId === s.id && { color: THEME.brandInk, fontWeight: "900" }]}>
                    {s.name}
                  </Text>
                  {selectedStoreId === s.id && <Text style={{ color: THEME.brand }}>✓</Text>}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
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
    backgroundColor: "#FFFFFF",
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

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(17,24,39,0.45)",
    justifyContent: "flex-end",
  },
  modalOverlayCenter: {
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
    gap: 10,
  },
  modalTitle: { fontSize: 16, fontWeight: "900", color: THEME.text },
  modalBody: { padding: 14, gap: 12 },
  modalFooter: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  btnDanger: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(235,87,87,0.10)",
    borderWidth: 1,
    borderColor: "rgba(235,87,87,0.25)",
  },
  btnDangerText: { color: "#e11d48", fontWeight: "900", fontSize: 13 },
  sheet: {
    backgroundColor: THEME.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: THEME.border,
    paddingBottom: 14,
  },
  sheetHandle: {
    alignSelf: "center",
    marginTop: 10,
    width: 50,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(107,114,128,0.30)",
  },
  sheetHeader: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sheetTitle: { fontSize: 16, fontWeight: "900", color: THEME.text },
  sheetDesc: { marginTop: 2, fontSize: 12, color: THEME.muted },

  sheetBody: { paddingHorizontal: 14, gap: 12 },
  sheetFooter: {
    paddingHorizontal: 14,
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "flex-end",
  },

  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: "900", color: THEME.muted },
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

  tip: {
    marginTop: 6,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: "rgba(255,255,255,0.82)",
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  tipBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.greenBg,
    borderWidth: 1,
    borderColor: THEME.greenBd,
    alignItems: "center",
    justifyContent: "center",
  },
  tipTitle: { fontSize: 13, fontWeight: "900", color: THEME.text },
  tipText: { marginTop: 2, fontSize: 12, color: THEME.muted, lineHeight: 16 },

  storeOption: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  storeOptionSelected: { backgroundColor: THEME.greenBg },
  storeOptionText: { fontSize: 14, color: THEME.text },
};
