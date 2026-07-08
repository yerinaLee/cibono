import BackHeader from "@/components/BackHeader";
import { ScrollTopButton } from "@/components/ScrollTopButton";
import { useScrollTop } from "@/hooks/use-scroll-top";
import { THEME } from "@/src/theme";
import { MaterialIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../src/api/client";

type ShoppingItem = {
  id: number;
  itemName: string;
  quantity?: number | null;
  unit?: string | null;
  checked: boolean;
};

const UNIT_PRESETS = ["개", "병", "묶음", "g"];

export default function ShoppingListScreen() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const filtered = items.filter((x) =>
    x.itemName.toLowerCase().includes(search.toLowerCase()),
  );

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addQty, setAddQty] = useState("1");
  const [addUnit, setAddUnit] = useState("개");
  const [saving, setSaving] = useState(false);

  const [editItem, setEditItem] = useState<ShoppingItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editQty, setEditQty] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [updating, setUpdating] = useState(false);

  const openSwipeRef = useRef<Swipeable | null>(null);
  const { listRef, showScrollTop, handleScroll, scrollToTop } = useScrollTop();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ShoppingItem[]>("/shopping-list");
      setItems(res.data ?? []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = (item: ShoppingItem) => {
    openSwipeRef.current?.close();
    setEditItem(item);
    setEditName(item.itemName);
    setEditQty(item.quantity != null ? String(item.quantity) : "1");
    setEditUnit(item.unit ?? "개");
  };

  const handleAdd = async () => {
    if (!addName.trim()) return;
    setSaving(true);
    try {
      await api.post("/shopping-list", {
        itemName: addName.trim(),
        quantity: addQty.trim() ? Number(addQty.trim()) : null,
        unit: addUnit.trim() || null,
      });
      setAddName("");
      setAddQty("1");
      setAddUnit("개");
      setAddOpen(false);
      await load();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editItem) return;
    setUpdating(true);
    try {
      await api.patch(`/shopping-list/${editItem.id}`, {
        itemName: editName.trim() || editItem.itemName,
        quantity: editQty.trim() ? Number(editQty.trim()) : null,
        unit: editUnit.trim() || null,
      });
      setEditItem(null);
      await load();
    } catch {
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/shopping-list/${id}`);
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch {}
  };

  const bumpQty = async (item: ShoppingItem, delta: number) => {
    const current = item.quantity ?? 1;
    const next = Math.max(1, current + delta);
    setItems((prev) =>
      prev.map((x) => (x.id === item.id ? { ...x, quantity: next } : x)),
    );
    try {
      await api.patch(`/shopping-list/${item.id}`, {
        itemName: item.itemName,
        quantity: next,
        unit: item.unit,
      });
    } catch {
      await load();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
      {/* 헤더 */}
      <BackHeader
        title="쇼핑리스트"
        right={
          <Pressable
            onPress={() => setAddOpen(true)}
            style={({ pressed }) => [styles.iconCircleAdd, pressed && { opacity: 0.85 }]}
          >
            <MaterialIcons name="add" size={22} color={THEME.brandInk} />
          </Pressable>
        }
      />
      {/* 검색 */}
      <View style={styles.searchBar}>
        <MaterialIcons name="search" size={18} color={THEME.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="검색..."
          placeholderTextColor="rgba(31,41,55,0.40)"
          style={styles.searchInput}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <MaterialIcons name="close" size={16} color={THEME.muted} />
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={THEME.brand} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={filtered}
          keyExtractor={(x) => String(x.id)}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ padding: 14, paddingBottom: 24, gap: 10 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons
                name="shopping-cart"
                size={40}
                color={THEME.muted}
              />
              <Text style={styles.emptyTitle}>쇼핑리스트가 비어있어요</Text>
              <Text style={styles.emptyDesc}>
                레시피 상세에서 재료를 추가하거나 직접 입력해보세요.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Swipeable
              ref={(ref) => {
                if (ref) openSwipeRef.current = ref;
              }}
              renderRightActions={() => (
                <Pressable
                  onPress={() => handleDelete(item.id)}
                  style={styles.deleteAction}
                >
                  <MaterialIcons name="delete" size={22} color="#fff" />
                  <Text style={styles.deleteActionText}>삭제</Text>
                </Pressable>
              )}
              rightThreshold={40}
              friction={2}
            >
              <Pressable
                onPress={() => openEdit(item)}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <View style={styles.rowMain}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.itemName}
                  </Text>
                  <View style={styles.qtyControls}>
                    <Pressable
                      onPress={() => bumpQty(item, -1)}
                      style={({ pressed }) => [
                        styles.qtyBtn,
                        pressed && { opacity: 0.7 },
                      ]}
                      hitSlop={8}
                    >
                      <MaterialIcons
                        name="remove"
                        size={16}
                        color={THEME.text}
                      />
                    </Pressable>
                    <Text style={styles.qtyText}>
                      {item.quantity ?? 1}
                      {item.unit ?? ""}
                    </Text>
                    <Pressable
                      onPress={() => bumpQty(item, +1)}
                      style={({ pressed }) => [
                        styles.qtyBtn,
                        pressed && { opacity: 0.7 },
                      ]}
                      hitSlop={8}
                    >
                      <MaterialIcons name="add" size={16} color={THEME.text} />
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            </Swipeable>
          )}
        />
      )}

      <ScrollTopButton visible={showScrollTop} onPress={scrollToTop} />

      {/* 추가 모달 */}
      <Modal
        transparent
        visible={addOpen}
        animationType="fade"
        onRequestClose={() => setAddOpen(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>재료 추가</Text>
              <Pressable
                onPress={() => setAddOpen(false)}
                style={styles.closeBtn}
              >
                <MaterialIcons name="close" size={20} color={THEME.muted} />
              </Pressable>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.field}>
                <Text style={styles.label}>재료명</Text>
                <TextInput
                  value={addName}
                  onChangeText={setAddName}
                  placeholder="예: 두부"
                  placeholderTextColor="rgba(31,41,55,0.40)"
                  style={styles.input}
                  autoFocus
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>수량</Text>
                <TextInput
                  value={addQty}
                  onChangeText={setAddQty}
                  placeholder="1"
                  placeholderTextColor="rgba(31,41,55,0.40)"
                  style={styles.input}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>단위</Text>
                <View style={styles.unitRow}>
                  {UNIT_PRESETS.map((u) => (
                    <Pressable
                      key={u}
                      onPress={() => setAddUnit(u)}
                      style={({ pressed }) => [
                        styles.unitBtn,
                        addUnit === u && styles.unitBtnActive,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.unitBtnText,
                          addUnit === u && styles.unitBtnTextActive,
                        ]}
                      >
                        {u}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
            <View style={styles.modalFooter}>
              <Pressable
                onPress={() => setAddOpen(false)}
                style={({ pressed }) => [
                  styles.btnGhost,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.btnGhostText}>취소</Text>
              </Pressable>
              <Pressable
                onPress={handleAdd}
                disabled={saving}
                style={({ pressed }) => [
                  styles.btnPrimary,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.btnPrimaryText}>
                  {saving ? "추가 중..." : "추가"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 수정 모달 */}
      <Modal
        transparent
        visible={!!editItem}
        animationType="fade"
        onRequestClose={() => setEditItem(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>재료 수정</Text>
              <Pressable
                onPress={() => setEditItem(null)}
                style={styles.closeBtn}
              >
                <MaterialIcons name="close" size={20} color={THEME.muted} />
              </Pressable>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.field}>
                <Text style={styles.label}>재료명</Text>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="재료명"
                  placeholderTextColor="rgba(31,41,55,0.40)"
                  style={styles.input}
                  autoFocus
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>수량</Text>
                <TextInput
                  value={editQty}
                  onChangeText={setEditQty}
                  placeholder="1"
                  placeholderTextColor="rgba(31,41,55,0.40)"
                  style={styles.input}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>단위</Text>
                <View style={styles.unitRow}>
                  {UNIT_PRESETS.map((u) => (
                    <Pressable
                      key={u}
                      onPress={() => setEditUnit(u)}
                      style={({ pressed }) => [
                        styles.unitBtn,
                        editUnit === u && styles.unitBtnActive,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.unitBtnText,
                          editUnit === u && styles.unitBtnTextActive,
                        ]}
                      >
                        {u}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
            <View style={styles.modalFooter}>
              <Pressable
                onPress={() => setEditItem(null)}
                style={({ pressed }) => [
                  styles.btnGhost,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.btnGhostText}>취소</Text>
              </Pressable>
              <Pressable
                onPress={handleUpdate}
                disabled={updating}
                style={({ pressed }) => [
                  styles.btnPrimary,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.btnPrimaryText}>
                  {updating ? "저장 중..." : "저장"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles: any = {
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: THEME.brand,
    borderWidth: 1,
    borderColor: "rgba(15,31,22,0.10)",
  },
  addBtnText: { fontSize: 13, fontWeight: "900", color: THEME.brandInk },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 14,
    marginVertical: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: THEME.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: THEME.text,
    padding: 0,
  },

  iconCircleAdd: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.brand,
    borderWidth: 1,
    borderColor: "rgba(15,31,22,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },

  row: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 14,
  },
  rowMain: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  itemName: { fontSize: 15, fontWeight: "800", color: THEME.text, flex: 1 },
  qtyControls: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(243,248,241,0.8)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.border,
    paddingHorizontal: 2,
  },
  qtyBtn: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: {
    fontSize: 14,
    fontWeight: "900",
    color: THEME.text,
    minWidth: 42,
    textAlign: "center",
  },
  editHint: { fontSize: 11, color: THEME.muted, marginTop: 5 },

  deleteAction: {
    backgroundColor: THEME.danger,
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    borderRadius: 14,
    gap: 2,
    marginLeft: 8,
  },
  deleteActionText: { color: "#fff", fontSize: 12, fontWeight: "900" },

  empty: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "900", color: THEME.text },
  emptyDesc: { fontSize: 13, color: THEME.muted, textAlign: "center" },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(17,24,39,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modal: {
    width: "100%",
    maxWidth: 480,
    borderRadius: 18,
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.border,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  modalTitle: { fontSize: 16, fontWeight: "900", color: THEME.text },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: THEME.border,
  },
  modalBody: { padding: 14, gap: 16 },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
  },

  field: { gap: 8 },
  label: { fontSize: 12, fontWeight: "900", color: THEME.muted },
  input: {
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: "rgba(243,248,241,0.55)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: THEME.text,
    fontSize: 14,
  },

  unitRow: { flexDirection: "row", gap: 8 },
  unitBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: THEME.border,
  },
  unitBtnActive: {
    borderColor: THEME.brand,
    backgroundColor: "rgba(127,183,126,0.18)",
  },
  unitBtnText: { fontSize: 15, fontWeight: "900", color: THEME.muted },
  unitBtnTextActive: { color: THEME.brandInk },

  btnPrimary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: THEME.brand,
    borderWidth: 1,
    borderColor: "rgba(15,31,22,0.10)",
  },
  btnPrimaryText: { color: THEME.brandInk, fontWeight: "900", fontSize: 13 },
  btnGhost: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: THEME.border,
  },
  btnGhostText: { color: THEME.text, fontWeight: "900", fontSize: 13 },
};
