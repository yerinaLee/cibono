import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { api } from "../src/api/client";

type FoodCategory = { id: number; name: string };

const THEME = {
  bg: "#F3F8F1",
  surface: "#FFFFFF",
  text: "#1F2937",
  muted: "#6B7280",
  border: "rgba(31,41,55,0.10)",
  brand: "#7FB77E",
  brandInk: "#0F1F16",
};

const DATE_PRESETS = [
  { label: "오늘", days: 0 },
  { label: "+7일", days: 7 },
  { label: "+14일", days: 14 },
  { label: "+30일", days: 30 },
  { label: "+60일", days: 60 },
  { label: "+1년", days: 365 },
];

const UNIT_PRESETS = ["개", "병", "묶음", "판"];

function categoryIcon(name?: string | null): string {
  switch (name) {
    case "채소/과일": return "🥬";
    case "육류/계란": return "🥩";
    case "해산물": return "🐟";
    case "우유/유제품": return "🥛";
    case "밀키트": return "🍱";
    case "기타": return "📦";
    default: return "🧺";
  }
}

function storageLabel(s: string) {
  return s === "FRIDGE" ? "냉장" : s === "FREEZER" ? "냉동" : "실온";
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

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function AddInventoryModal({ visible, onClose, onSuccess }: Props) {
  const [name, setName] = useState("");
  const [nameFocused, setNameFocused] = useState(false);
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("개");
  const [storage, setStorage] = useState<"FRIDGE" | "FREEZER" | "PANTRY">("FRIDGE");
  const [expiresAt, setExpiresAt] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [categories, setCategories] = useState<FoodCategory[]>([]);
  const [inventoryItems, setInventoryItems] = useState<{ itemName: string }[]>([]);

  const reset = useCallback(() => {
    setName("");
    setQty("1");
    setUnit("개");
    setStorage("FRIDGE");
    setExpiresAt("");
    setCategoryId(null);
    setError("");
    setNameFocused(false);
  }, []);

  useEffect(() => {
    if (!visible) return;
    Promise.all([
      api.get<FoodCategory[]>("/food-categories"),
      api.get<{ itemName: string }[]>("/inventory"),
    ]).then(([catRes, invRes]) => {
      setCategories(catRes.data ?? []);
      setInventoryItems(invRes.data ?? []);
    }).catch(() => {});
  }, [visible]);

  const frequent = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of inventoryItems) {
      const key = (it.itemName || "").trim();
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([n]) => n);
  }, [inventoryItems]);

  const handleAdd = async () => {
    setError("");
    const trimmedName = name.trim();
    if (!trimmedName) { setError("품목명을 입력해주세요."); return; }
    const parsedQty = Number(qty || "1");
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) { setError("수량은 0보다 큰 숫자여야 해요."); return; }
    setSaving(true);
    try {
      const body: any = {
        itemName: trimmedName,
        quantity: parsedQty,
        unit: unit.trim() || null,
        storage,
      };
      if (expiresAt.trim()) body.expiresAt = expiresAt.trim();
      if (categoryId != null) body.categoryId = categoryId;
      await api.post("/inventory", body);
      reset();
      onSuccess();
      onClose();
    } catch {
      setError("추가 중 오류가 발생했어요.");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => { reset(); onClose(); };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={handleClose}>
      <View style={s.overlay}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>재료 추가</Text>
            <Pressable onPress={handleClose} style={s.iconBtn}>
              <Text style={{ fontSize: 18, color: THEME.muted }}>×</Text>
            </Pressable>
          </View>

          <ScrollView style={s.modalScroll} keyboardShouldPersistTaps="handled">
            <View style={s.modalBody}>
              {/* 품목명 */}
              <View style={s.field}>
                <Text style={s.label}>품목명</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                  placeholder="예: 우유"
                  placeholderTextColor="rgba(31,41,55,0.45)"
                  style={s.input}
                  autoCapitalize="none"
                  autoFocus
                />
                {frequent.length > 0 && (!name.trim() || nameFocused) && (
                  <View style={s.dropdown}>
                    <Text style={s.dropdownLabel}>자주 쓰는 재료</Text>
                    <View style={s.chipsRow}>
                      {frequent.map((n) => (
                        <Pressable
                          key={n}
                          onPress={() => setName(n)}
                          style={({ pressed }) => [
                            s.chip,
                            name === n && s.chipActive,
                            pressed && { opacity: 0.8 },
                          ]}
                        >
                          <Text style={[s.chipText, name === n && s.chipTextActive]}>{n}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
              </View>

              {/* 수량 + 단위 */}
              <View style={s.grid2}>
                <View style={[s.field, { flex: 1 }]}>
                  <Text style={s.label}>수량</Text>
                  <TextInput
                    value={qty}
                    onChangeText={setQty}
                    placeholder="예: 1"
                    placeholderTextColor="rgba(31,41,55,0.45)"
                    style={s.input}
                    keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "numeric"}
                  />
                </View>
                <View style={[s.field, { flex: 1 }]}>
                  <Text style={s.label}>단위</Text>
                  <TextInput
                    value={unit}
                    onChangeText={setUnit}
                    placeholder="직접 입력"
                    placeholderTextColor="rgba(31,41,55,0.45)"
                    style={s.input}
                    autoCapitalize="none"
                  />
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                    {UNIT_PRESETS.map((u) => (
                      <Pressable
                        key={u}
                        onPress={() => setUnit(u)}
                        style={({ pressed }) => [
                          s.presetChip,
                          unit === u && s.presetChipActive,
                          pressed && { opacity: 0.8 },
                        ]}
                      >
                        <Text style={[s.presetChipText, unit === u && s.presetChipTextActive]}>{u}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              {/* 보관 */}
              <View style={s.field}>
                <Text style={s.label}>보관</Text>
                <View style={s.segment}>
                  {(["FRIDGE", "FREEZER", "PANTRY"] as const).map((v) => (
                    <Pressable
                      key={v}
                      onPress={() => setStorage(v)}
                      style={({ pressed }) => [
                        s.segmentBtn,
                        storage === v && s.segmentBtnActive,
                        pressed && { opacity: 0.9 },
                      ]}
                    >
                      <Text style={[s.segmentText, storage === v && s.segmentTextActive]}>
                        {storageLabel(v)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* 유통기한 */}
              <View style={s.field}>
                <Text style={s.label}>유통기한</Text>
                <TextInput
                  value={expiresAt}
                  onChangeText={(t) => setExpiresAt(formatDateInput(t))}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="rgba(31,41,55,0.45)"
                  style={s.input}
                  keyboardType="numeric"
                  maxLength={10}
                />
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  {DATE_PRESETS.map((p) => (
                    <Pressable
                      key={p.label}
                      onPress={() => setExpiresAt(addDays(p.days))}
                      style={({ pressed }) => [s.presetChip, pressed && { opacity: 0.8 }]}
                    >
                      <Text style={s.presetChipText}>{p.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* 식재료 분류 */}
              <View style={s.field}>
                <Text style={s.label}>식재료 분류</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                  <Pressable
                    onPress={() => setCategoryId(null)}
                    style={({ pressed }) => [
                      s.presetChip,
                      categoryId === null && s.presetChipActive,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Text style={[s.presetChipText, categoryId === null && s.presetChipTextActive]}>
                      🧺 미분류
                    </Text>
                  </Pressable>
                  {categories.map((cat) => (
                    <Pressable
                      key={cat.id}
                      onPress={() => setCategoryId(cat.id)}
                      style={({ pressed }) => [
                        s.presetChip,
                        categoryId === cat.id && s.presetChipActive,
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <Text style={[s.presetChipText, categoryId === cat.id && s.presetChipTextActive]}>
                        {categoryIcon(cat.name)} {cat.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {error ? <Text style={s.errorText}>{error}</Text> : null}
            </View>
          </ScrollView>

          <View style={s.modalFooter}>
            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [s.btnGhost, pressed && { opacity: 0.9 }]}
            >
              <Text style={s.btnGhostText}>취소</Text>
            </Pressable>
            <View style={{ width: 10 }} />
            <Pressable
              onPress={handleAdd}
              disabled={saving}
              style={({ pressed }) => [s.btnPrimary, pressed && { opacity: 0.9 }]}
            >
              <Text style={s.btnPrimaryText}>{saving ? "추가 중..." : "추가"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s: any = {
  overlay: {
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
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1, borderColor: THEME.border,
    alignItems: "center", justifyContent: "center",
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
    flex: 1, paddingVertical: 10, alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  segmentBtnActive: { backgroundColor: "rgba(127,183,126,0.20)" },
  segmentText: { fontSize: 13, fontWeight: "900", color: THEME.muted },
  segmentTextActive: { color: THEME.text },
  presetChip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: "rgba(127,183,126,0.35)",
    backgroundColor: "rgba(127,183,126,0.12)",
  },
  presetChipActive: { borderColor: THEME.brand, backgroundColor: "rgba(127,183,126,0.30)" },
  presetChipText: { fontSize: 12, fontWeight: "800", color: THEME.brandInk },
  presetChipTextActive: { color: THEME.brandInk, fontWeight: "900" },
  dropdown: {
    marginTop: 6, padding: 10, borderRadius: 12,
    borderWidth: 1, borderColor: THEME.border,
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  dropdownLabel: { fontSize: 11, fontWeight: "800", color: THEME.muted, marginBottom: 8 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999,
    borderWidth: 1, borderColor: "rgba(127,183,126,0.35)",
    backgroundColor: "rgba(127,183,126,0.12)",
  },
  chipActive: { borderColor: THEME.brand, backgroundColor: "rgba(127,183,126,0.30)" },
  chipText: { fontSize: 12, fontWeight: "900", color: THEME.brandInk },
  chipTextActive: { fontWeight: "900" },
  btnPrimary: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    backgroundColor: THEME.brand, borderWidth: 1, borderColor: "rgba(15,31,22,0.10)",
  },
  btnPrimaryText: { color: THEME.brandInk, fontWeight: "900", fontSize: 13 },
  btnGhost: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: THEME.border,
  },
  btnGhostText: { color: THEME.text, fontWeight: "900", fontSize: 13 },
  errorText: { fontSize: 13, color: "#EB5757", fontWeight: "700" },
};
