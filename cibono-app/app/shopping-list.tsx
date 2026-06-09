import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  View,
} from "react-native";
import { api } from "../src/api/client";

type ShoppingItem = {
  id: number;
  itemName: string;
  quantity?: number | null;
  unit?: string | null;
  checked: boolean;
};

const THEME = {
  bg: "#F3F8F1",
  surface: "#FFFFFF",
  text: "#1F2937",
  muted: "#6B7280",
  border: "rgba(31,41,55,0.10)",
  brand: "#7FB77E",
  brandInk: "#0F1F16",
  danger: "#EB5757",
};

export default function ShoppingListScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 추가 모달
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addQty, setAddQty] = useState("");
  const [addUnit, setAddUnit] = useState("");
  const [saving, setSaving] = useState(false);

  // 수정 모달
  const [editItem, setEditItem] = useState<ShoppingItem | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ShoppingItem[]>("/shopping-list");
      setItems(res.data ?? []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (item: ShoppingItem) => {
    setEditItem(item);
    setEditQty(item.quantity != null ? String(item.quantity) : "");
    setEditUnit(item.unit ?? "");
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
      setAddName(""); setAddQty(""); setAddUnit("");
      setAddOpen(false);
      await load();
    } catch {}
    finally { setSaving(false); }
  };

  const handleUpdate = async () => {
    if (!editItem) return;
    setUpdating(true);
    try {
      await api.patch(`/shopping-list/${editItem.id}`, {
        quantity: editQty.trim() ? Number(editQty.trim()) : null,
        unit: editUnit.trim() || null,
      });
      setEditItem(null);
      await load();
    } catch {}
    finally { setUpdating(false); }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/shopping-list/${id}`);
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch {}
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>쇼핑리스트</Text>
        <Pressable
          onPress={() => setAddOpen(true)}
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.addBtnText}>+ 추가</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={THEME.brand} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => String(x.id)}
          contentContainerStyle={{ padding: 14, paddingBottom: 60, gap: 10 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🛒</Text>
              <Text style={styles.emptyTitle}>쇼핑리스트가 비어있어</Text>
              <Text style={styles.emptyDesc}>레시피 상세에서 재료를 추가하거나 직접 입력해봐.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              {/* 재료명 + 수량 */}
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.itemName}</Text>
                <Pressable onPress={() => openEdit(item)} style={styles.qtyRow}>
                  <Text style={styles.itemMeta}>
                    {item.quantity != null || item.unit
                      ? [item.quantity != null ? String(item.quantity) : null, item.unit]
                          .filter(Boolean).join(" ")
                      : "수량 미입력"}
                  </Text>
                  <Text style={styles.editHint}>수정 ✎</Text>
                </Pressable>
              </View>
              <Pressable
                onPress={() => handleDelete(item.id)}
                style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.deleteBtnText}>삭제</Text>
              </Pressable>
            </View>
          )}
        />
      )}

      {/* 추가 모달 */}
      <Modal transparent visible={addOpen} animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>재료 추가</Text>
              <Pressable onPress={() => setAddOpen(false)} style={styles.closeBtn}>
                <Text style={{ fontSize: 18, color: THEME.muted }}>×</Text>
              </Pressable>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.field}>
                <Text style={styles.label}>재료명</Text>
                <TextInput
                  value={addName} onChangeText={setAddName}
                  placeholder="예: 두부" placeholderTextColor="rgba(31,41,55,0.40)"
                  style={styles.input} autoFocus
                />
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>수량</Text>
                  <TextInput
                    value={addQty} onChangeText={setAddQty}
                    placeholder="예: 1" placeholderTextColor="rgba(31,41,55,0.40)"
                    style={styles.input} keyboardType="numeric"
                  />
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>단위</Text>
                  <TextInput
                    value={addUnit} onChangeText={setAddUnit}
                    placeholder="예: 개, g" placeholderTextColor="rgba(31,41,55,0.40)"
                    style={styles.input}
                  />
                </View>
              </View>
            </View>
            <View style={styles.modalFooter}>
              <Pressable onPress={() => setAddOpen(false)} style={({ pressed }) => [styles.btnGhost, pressed && { opacity: 0.9 }]}>
                <Text style={styles.btnGhostText}>취소</Text>
              </Pressable>
              <Pressable onPress={handleAdd} disabled={saving} style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.9 }]}>
                <Text style={styles.btnPrimaryText}>{saving ? "추가 중..." : "추가"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 수정 모달 */}
      <Modal transparent visible={!!editItem} animationType="fade" onRequestClose={() => setEditItem(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>수량 수정</Text>
                <Text style={styles.modalSub}>{editItem?.itemName}</Text>
              </View>
              <Pressable onPress={() => setEditItem(null)} style={styles.closeBtn}>
                <Text style={{ fontSize: 18, color: THEME.muted }}>×</Text>
              </Pressable>
            </View>
            <View style={styles.modalBody}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>수량</Text>
                  <TextInput
                    value={editQty} onChangeText={setEditQty}
                    placeholder="예: 2" placeholderTextColor="rgba(31,41,55,0.40)"
                    style={styles.input} keyboardType="numeric" autoFocus
                  />
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>단위</Text>
                  <TextInput
                    value={editUnit} onChangeText={setEditUnit}
                    placeholder="예: 개, g" placeholderTextColor="rgba(31,41,55,0.40)"
                    style={styles.input}
                  />
                </View>
              </View>
            </View>
            <View style={styles.modalFooter}>
              <Pressable onPress={() => setEditItem(null)} style={({ pressed }) => [styles.btnGhost, pressed && { opacity: 0.9 }]}>
                <Text style={styles.btnGhostText}>취소</Text>
              </Pressable>
              <Pressable onPress={handleUpdate} disabled={updating} style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.9 }]}>
                <Text style={styles.btnPrimaryText}>{updating ? "저장 중..." : "저장"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles: any = {
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: THEME.border, backgroundColor: THEME.bg,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.85)", borderWidth: 1, borderColor: THEME.border,
  },
  backIcon: { fontSize: 18, color: THEME.text },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "900", color: THEME.text },
  addBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12,
    backgroundColor: THEME.brand, borderWidth: 1, borderColor: "rgba(15,31,22,0.10)",
  },
  addBtnText: { fontSize: 13, fontWeight: "900", color: THEME.brandInk },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderRadius: 14, borderWidth: 1, borderColor: THEME.border, padding: 14,
  },
  itemName: { fontSize: 15, fontWeight: "800", color: THEME.text },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  itemMeta: { fontSize: 12, color: THEME.muted },
  editHint: { fontSize: 11, color: THEME.brand, fontWeight: "700" },
  deleteBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
    borderWidth: 1, borderColor: "rgba(235,87,87,0.25)", backgroundColor: "rgba(235,87,87,0.08)",
  },
  deleteBtnText: { fontSize: 12, fontWeight: "900", color: THEME.danger },

  empty: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: "900", color: THEME.text },
  emptyDesc: { fontSize: 13, color: THEME.muted, textAlign: "center" },

  overlay: { flex: 1, backgroundColor: "rgba(17,24,39,0.45)", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { width: "100%", maxWidth: 480, borderRadius: 18, backgroundColor: THEME.surface, borderWidth: 1, borderColor: THEME.border, overflow: "hidden" },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: THEME.border,
  },
  modalTitle: { fontSize: 16, fontWeight: "900", color: THEME.text },
  modalSub: { fontSize: 12, color: THEME.muted, marginTop: 2 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.9)", borderWidth: 1, borderColor: THEME.border,
  },
  modalBody: { padding: 14, gap: 12 },
  modalFooter: { flexDirection: "row", justifyContent: "flex-end", gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: THEME.border },
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: "900", color: THEME.muted },
  input: {
    borderWidth: 1, borderColor: THEME.border,
    backgroundColor: "rgba(243,248,241,0.55)",
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    color: THEME.text, fontSize: 14,
  },
  btnPrimary: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    backgroundColor: THEME.brand, borderWidth: 1, borderColor: "rgba(15,31,22,0.10)",
  },
  btnPrimaryText: { color: THEME.brandInk, fontWeight: "900", fontSize: 13 },
  btnGhost: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.8)", borderWidth: 1, borderColor: THEME.border,
  },
  btnGhostText: { color: THEME.text, fontWeight: "900", fontSize: 13 },
};
