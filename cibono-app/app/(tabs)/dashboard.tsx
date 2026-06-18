import { MaterialIcons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { router } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AddInventoryModal from "../../components/AddInventoryModal";
import { api, explainNetworkHint } from "../../src/api/client";

type Inventory = {
  id: number;
  itemName: string;
  quantity: number;
  unit?: string | null;
  storage: string;
  expiresAt?: string | null;
  categoryName?: string | null;
};

type Suggestion = {
  name: string;
  imageUrl?: string;
  ingredients: string[];
  missingCount: number;
  score: number;
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

const STORAGE_LABEL: Record<string, string> = {
  FRIDGE: "냉장",
  FREEZER: "냉동",
  PANTRY: "실온",
};

const STORAGE_COLOR: Record<string, string> = {
  FRIDGE: "rgba(59,130,246,0.12)",
  FREEZER: "rgba(99,102,241,0.12)",
  PANTRY: "rgba(251,146,60,0.12)",
};

const STORAGE_TEXT: Record<string, string> = {
  FRIDGE: "#1D4ED8",
  FREEZER: "#4338CA",
  PANTRY: "#C2410C",
};

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

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map((v) => Number(v));
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
}

function expiryLabel(days: number | null): string | null {
  if (days === null) return null;
  if (days < 0) return "기한 초과";
  if (days === 0) return "오늘 마감";
  return `D-${days}`;
}

function expiryColor(days: number | null): string {
  if (days === null) return THEME.muted;
  if (days < 0) return THEME.danger;
  if (days <= 2) return "#B7791F";
  if (days <= 7) return "#D97706";
  return THEME.ok;
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const player = useVideoPlayer(require("../../assets/cibono_logo.mp4"), (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [reco, setReco] = useState<Suggestion[]>([]);

  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    setError("");
    setRefreshing(true);
    try {
      const [invRes, recoRes] = await Promise.all([
        api.get<Inventory[]>("/inventory"),
        api.get<Suggestion[]>("/recommendations/today"),
      ]);
      setInventory(invRes.data ?? []);
      setReco(recoRes.data ?? []);
    } catch (e: any) {
      setError(explainNetworkHint(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const urgent = useMemo(() => {
    return inventory
      .map((x) => ({ ...x, d: daysUntil(x.expiresAt) }))
      .filter((x) => x.d !== null && x.d <= 2)
      .sort((a, b) => (a.d ?? 999) - (b.d ?? 999));
  }, [inventory]);

  const groupedInventory = useMemo(() => {
    const urgentIds = new Set(urgent.map((x) => x.id));
    const remaining = inventory.filter((x) => !urgentIds.has(x.id));
    const map = new Map<string, Inventory[]>();
    for (const item of remaining) {
      const key = item.categoryName ?? "기타";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    const result: { category: string; items: Inventory[] }[] = [];
    map.forEach((items, category) => {
      const sorted = [...items].sort((a, b) => {
        if (!a.expiresAt && !b.expiresAt) return 0;
        if (!a.expiresAt) return 1;
        if (!b.expiresAt) return -1;
        return a.expiresAt.localeCompare(b.expiresAt);
      });
      result.push({ category, items: sorted.slice(0, 3) });
    });
    return result;
  }, [inventory, urgent]);

  const sortedReco = useMemo(() => {
    const urgentNames = new Set(urgent.map((x) => x.itemName.toLowerCase()));
    return [...reco].sort((a, b) => {
      const aMatches = a.ingredients.filter((ing) =>
        urgentNames.has(ing.toLowerCase()),
      ).length;
      const bMatches = b.ingredients.filter((ing) =>
        urgentNames.has(ing.toLowerCase()),
      ).length;
      return bMatches - aMatches;
    });
  }, [reco, urgent]);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: THEME.bg }}
      edges={["bottom", "left", "right"]}
    >
      <View style={[styles.logoHeader, { paddingTop: insets.top + 6 }]}>
        <VideoView
          player={player}
          style={styles.logoVideo}
          contentFit="contain"
          nativeControls={false}
        />
        <View style={styles.logoHeaderRight}>
          <Pressable
            onPress={() => router.push("/saved-recipes")}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.8 }]}
          >
            <MaterialIcons name="bookmark-border" size={20} color={THEME.text} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/shopping-list")}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.8 }]}
          >
            <MaterialIcons name="shopping-cart" size={20} color={THEME.text} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/settings")}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.8 }]}
          >
            <MaterialIcons name="settings" size={20} color={THEME.text} />
          </Pressable>
        </View>
      </View>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} />
        }
        contentContainerStyle={{ padding: 14, paddingBottom: 80 }}
      >
        {error ? (
          <View style={styles.banner}>
            <View style={styles.bannerIcon}>
              <Text style={{ fontWeight: "900", color: "#5a1a1d" }}>!</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>네트워크 오류</Text>
              <Text style={styles.bannerDesc}>{error}</Text>
            </View>
            <Pressable
              onPress={load}
              style={({ pressed }) => [
                styles.btnGhost,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.btnGhostText}>재시도</Text>
            </Pressable>
          </View>
        ) : null}

        {/* 임박 재료 */}
        <View style={[styles.card, { marginTop: 14 }]}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>임박 재료</Text>
            <View
              style={[
                styles.badge,
                { backgroundColor: "rgba(242,201,76,0.16)" },
              ]}
            >
              <Text style={[styles.badgeText, { color: "#B7791F" }]}>
                D-2 이내
              </Text>
            </View>
          </View>
          {urgent.length > 0 ? (
            <View style={styles.chipRow}>
              {urgent.map((x) => (
                <Pressable
                  key={x.id}
                  onPress={() =>
                    router.push({
                      pathname: "/ingredient-recipes",
                      params: { ingredient: x.itemName },
                    })
                  }
                  style={({ pressed }) => [
                    styles.urgentChip,
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Text style={styles.urgentChipName}>{x.itemName}</Text>
                  {x.d !== null && (
                    <Text
                      style={[
                        styles.urgentChipDay,
                        { color: expiryColor(x.d) },
                      ]}
                    >
                      {expiryLabel(x.d)}
                    </Text>
                  )}
                  <MaterialIcons
                    name="chevron-right"
                    size={14}
                    color="#B7791F"
                  />
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.desc}>임박 재료가 없어요 👍</Text>
          )}
        </View>

        {/* 냉장고 재료 */}
        <View style={[styles.card, { marginTop: 12 }]}>
          <View style={[styles.rowBetween, { marginBottom: 10 }]}>
            <Text style={styles.cardTitle}>냉장고 재료</Text>
            <Pressable
              onPress={() => setAddOpen(true)}
              style={({ pressed }) => [
                styles.addCircleBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <MaterialIcons name="add" size={18} color={THEME.brandInk} />
            </Pressable>
          </View>
          {groupedInventory.length > 0 ? (
            <View style={{ gap: 14 }}>
              {groupedInventory.map(({ category, items: catItems }) => (
                <View key={category}>
                  <Text style={styles.categoryLabel}>{categoryIcon(category)} {category}</Text>
                  <View style={styles.inventoryList}>
                    {catItems.map((item, idx) => {
                      const days = daysUntil(item.expiresAt);
                      const label = expiryLabel(days);
                      const color = expiryColor(days);
                      const isLast = idx === catItems.length - 1;
                      return (
                        <View
                          key={item.id}
                          style={[
                            styles.inventoryRow,
                            !isLast && {
                              borderBottomWidth: 1,
                              borderBottomColor: THEME.border,
                            },
                          ]}
                        >
                          <View
                            style={{
                              flex: 1,
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <View
                              style={[
                                styles.storageBadge,
                                {
                                  backgroundColor:
                                    STORAGE_COLOR[item.storage] ??
                                    "rgba(107,114,128,0.1)",
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.storageBadgeText,
                                  {
                                    color:
                                      STORAGE_TEXT[item.storage] ?? THEME.muted,
                                  },
                                ]}
                              >
                                {STORAGE_LABEL[item.storage] ?? item.storage}
                              </Text>
                            </View>
                            <Text style={styles.inventoryName}>
                              {item.itemName}
                            </Text>
                          </View>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <Text style={styles.inventoryQty}>
                              {item.quantity}
                              {item.unit ? ` ${item.unit}` : ""}
                            </Text>
                            {label && (
                              <View
                                style={[
                                  styles.expiryBadge,
                                  { borderColor: color },
                                ]}
                              >
                                <Text
                                  style={[styles.expiryBadgeText, { color }]}
                                >
                                  {label}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.desc}>등록된 재료가 없어요</Text>
          )}
          <Pressable
            onPress={() => router.push("/(tabs)/inventory")}
            style={({ pressed }) => [
              styles.bottomLink,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.bottomLinkText}>전체 보기</Text>
            <MaterialIcons name="chevron-right" size={14} color={THEME.brand} />
          </Pressable>
        </View>

        {/* 추천 요리 */}
        <View style={[styles.card, { marginTop: 12 }]}>
          <View style={[styles.rowBetween, { marginBottom: 10 }]}>
            <Text style={styles.cardTitle}>추천 요리</Text>
            <View
              style={[
                styles.badge,
                { backgroundColor: "rgba(39,174,96,0.12)" },
              ]}
            >
              <Text style={[styles.badgeText, { color: THEME.ok }]}>Today</Text>
            </View>
          </View>
          {sortedReco.length > 0 ? (
            <View style={styles.recoGrid}>
              {sortedReco.slice(0, 4).map((item, i) => (
                <Pressable
                  key={i}
                  onPress={() =>
                    router.push({
                      pathname: "/recipe-detail",
                      params: { name: item.name },
                    })
                  }
                  style={({ pressed }) => [
                    styles.recoCard,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  {item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={styles.recoThumb}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={[styles.recoThumb, styles.recoThumbPlaceholder]}
                    >
                      <Text style={{ fontSize: 22 }}>🍽️</Text>
                    </View>
                  )}
                  <Text style={styles.recoName} numberOfLines={2}>
                    {item.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.desc}>재고를 등록하면 추천이 나와요</Text>
          )}
          <Pressable
            onPress={() => router.push("/(tabs)/recommend")}
            style={({ pressed }) => [
              styles.bottomLink,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.bottomLinkText}>전체 보기</Text>
            <MaterialIcons name="chevron-right" size={14} color={THEME.brand} />
          </Pressable>
        </View>
      </ScrollView>

      <AddInventoryModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={load}
      />
    </SafeAreaView>
  );
}

const styles: any = {
  logoHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 10,
    backgroundColor: THEME.bg,
    gap: 10,
  },
  logoVideo: {
    flex: 1,
    height: 52,
    backgroundColor: THEME.bg,
  },
  logoHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1,
    borderColor: THEME.border,
  },
  banner: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(232,107,107,.20)",
    backgroundColor: "rgba(232,107,107,.10)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bannerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(232,107,107,.20)",
    backgroundColor: "rgba(232,107,107,.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerTitle: { fontSize: 13, fontWeight: "900", color: "#5a1a1d" },
  bannerDesc: { marginTop: 2, fontSize: 12, color: "#5a1a1d", opacity: 0.9 },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 14,
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
  cardTitle: { fontSize: 15, fontWeight: "900", color: THEME.text },
  desc: { marginTop: 6, fontSize: 13, color: THEME.muted, lineHeight: 18 },

  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: "900" },

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  urgentChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "rgba(242,201,76,0.14)",
    borderWidth: 1,
    borderColor: "rgba(242,201,76,0.35)",
  },
  urgentChipName: { fontSize: 14, fontWeight: "900", color: THEME.text },
  urgentChipDay: { fontSize: 11, fontWeight: "800" },

  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  linkBtnText: { fontSize: 13, fontWeight: "700", color: THEME.brand },
  addCircleBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: THEME.brand,
    borderWidth: 1,
    borderColor: "rgba(15,31,22,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },

  categoryLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: THEME.muted,
    marginBottom: 4,
  },
  inventoryList: { gap: 0 },
  inventoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    gap: 8,
  },
  storageBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  storageBadgeText: { fontSize: 11, fontWeight: "800" },
  inventoryName: { fontSize: 14, fontWeight: "700", color: THEME.text },
  inventoryQty: { fontSize: 13, color: THEME.muted },
  expiryBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  expiryBadgeText: { fontSize: 11, fontWeight: "800" },

  recoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  recoCard: {
    width: "47%",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: "#FFFFFF",
  },
  recoThumb: {
    width: "100%",
    height: 90,
    backgroundColor: "rgba(127,183,126,0.12)",
  },
  recoThumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  recoName: {
    fontSize: 12,
    fontWeight: "800",
    color: THEME.text,
    padding: 8,
    lineHeight: 16,
  },

  bottomLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 2,
    marginTop: 10,
  },
  bottomLinkText: { fontSize: 13, fontWeight: "700", color: THEME.brand },

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
