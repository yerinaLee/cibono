import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, explainNetworkHint } from "../../src/api/client";

type CuisineType = "ALL" | "KOREAN" | "WESTERN" | "CHINESE" | "GLOBAL";

type Suggestion = {
  name: string;
  ingredients: string[];
  missingCount: number;
  score: number;
  cookingTime: number;
  cuisineType: string;
};

type RecipeCard = {
  name: string;
  imageUrl: string;
  sourceUrl: string;
  ingredients: string[];
};

type IngredientGroup = {
  ingredient: string;
  cards: RecipeCard[];
  loading: boolean;
  error: boolean;
};

const CUISINE_LABELS: Record<CuisineType, string> = {
  ALL: "전체",
  KOREAN: "한식",
  WESTERN: "양식",
  CHINESE: "중식",
  GLOBAL: "글로벌",
};

const CUISINE_COLORS: Record<string, { color: string; bg: string }> = {
  KOREAN:  { color: "#7C3D12", bg: "rgba(251,191,36,0.18)"  },
  WESTERN: { color: "#1E40AF", bg: "rgba(96,165,250,0.18)"  },
  CHINESE: { color: "#991B1B", bg: "rgba(252,165,165,0.20)" },
  GLOBAL:  { color: "#065F46", bg: "rgba(52,211,153,0.18)"  },
};

type Inventory = {
  id: number;
  itemName: string;
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

function norm(s: string) {
  return (s || "").replace(/\s+/g, "").trim().toLowerCase();
}

function snapToPreset(minutes: number): number {
  const buckets = [15, 30, 45, 60];
  return buckets.reduce((prev, curr) =>
    Math.abs(curr - minutes) < Math.abs(prev - minutes) ? curr : prev,
  );
}

export default function RecommendScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [ingredientGroups, setIngredientGroups] = useState<IngredientGroup[]>([]);
  const cancelRef = useRef(false);

  const [q, setQ] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [timePreset, setTimePreset] = useState<"15" | "30" | "45" | "60+">("30");
  const [cuisineFilter, setCuisineFilter] = useState<CuisineType>("ALL");
  // const [noSpicy, setNoSpicy] = useState(true); // noSpicy 미구현 — 주석 처리

  // 식약처 API가 동일 키 동시 접속을 차단하므로 순차 호출
  const loadIngredientGroups = useCallback(async (targets: string[]) => {
    cancelRef.current = false;
    const limited = targets.slice(0, 4);
    setIngredientGroups(limited.map((ing) => ({ ingredient: ing, cards: [], loading: true, error: false })));

    for (let idx = 0; idx < limited.length; idx++) {
      if (cancelRef.current) break; // cleanup 이후 중단
      const ing = limited[idx];
      try {
        const res = await api.get<RecipeCard[]>("/recipes/search-by-ingredient", { params: { ingredient: ing } });
        if (cancelRef.current) break;
        const cards = res.data ?? [];
        setIngredientGroups((prev) => {
          if (idx >= prev.length) return prev;
          const next = [...prev];
          next[idx] = { ingredient: ing, cards, loading: false, error: cards.length === 0 };
          return next;
        });
      } catch {
        if (cancelRef.current) break;
        setIngredientGroups((prev) => {
          if (idx >= prev.length) return prev;
          const next = [...prev];
          next[idx] = { ingredient: ing, cards: [], loading: false, error: true };
          return next;
        });
      }
    }
  }, []);

  const load = useCallback(async () => {
    setError("");
    setRefreshing(true);
    setIngredientGroups([]);
    try {
      const [recRes, invRes] = await Promise.all([
        api.get<Suggestion[]>("/recommendations/today"),
        api.get<Inventory[]>("/inventory"),
      ]);
      setItems(recRes.data ?? []);
      setInventory(invRes.data ?? []);

      const invList = invRes.data ?? [];

      // 임박 재료(D-7 이하) 우선, 없으면 만료일 있는 재료
      const urgentIngs = invList
        .filter((inv) => { const d = daysUntil(inv.expiresAt); return d !== null && d <= 7; })
        .map((inv) => inv.itemName);

      const crawlTargets = urgentIngs.length > 0
        ? urgentIngs
        : invList.slice(0, 4).map((inv) => inv.itemName);

      if (crawlTargets.length > 0) {
        loadIngredientGroups(crawlTargets);
      }
    } catch (e: any) {
      setError(explainNetworkHint(e));
    } finally {
      setRefreshing(false);
    }
  }, [loadIngredientGroups]);

  useFocusEffect(
    React.useCallback(() => {
      cancelRef.current = false;
      load();
      return () => {
        cancelRef.current = true; // 진행 중인 비동기 루프 중단
        setQ("");
        setIngredientGroups([]);
      };
    }, [load]),
  );

  const urgentSet = useMemo(() => {
    const set = new Set<string>();
    for (const inv of inventory) {
      const d = daysUntil(inv.expiresAt);
      if (d !== null && d <= 2) set.add(norm(inv.itemName));
    }
    return set;
  }, [inventory]);

  const computed = useMemo(() => {
    return items.map((it) => {
      const hasUrgent = (it.ingredients ?? []).some((ing) =>
        urgentSet.has(norm(ing)),
      );
      return { ...it, hasUrgent };
    });
  }, [items, urgentSet]);

  const filtered = useMemo(() => {
    let arr = computed;

    const keyword = q.trim().toLowerCase();
    if (keyword)
      arr = arr.filter((x) => x.name.toLowerCase().includes(keyword));

    const maxMin = timePreset === "60+" ? Infinity : parseInt(timePreset, 10);
    arr = arr.filter((x) => snapToPreset(x.cookingTime ?? 0) <= maxMin);

    if (cuisineFilter !== "ALL")
      arr = arr.filter((x) => x.cuisineType === cuisineFilter);

    return [...arr].sort(
      (a, b) =>
        Number(b.hasUrgent) - Number(a.hasUrgent) || b.score - a.score,
    );
  }, [computed, cuisineFilter, q, timePreset]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (timePreset !== "30") n++;
    if (cuisineFilter !== "ALL") n++;
    return n;
  }, [timePreset, cuisineFilter]);

  // 식품안전처 공공 API — 재료별 섹션
  const CrawledSection = useMemo(() => {
    if (ingredientGroups.length === 0) return null;
    return (
      <View style={{ marginTop: 4 }}>
        {ingredientGroups.filter(Boolean).map((group) => (
          <View key={group.ingredient} style={{ marginBottom: 4 }}>
            {/* 재료별 헤더 */}
            <View style={styles.sectionHead}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={styles.h3}>
                  임박재료 <Text style={{ color: THEME.brand }}>{group.ingredient}</Text> 가 들어가는 레시피
                </Text>
                {group.loading && <ActivityIndicator size="small" color={THEME.brand} />}
              </View>
              <Text style={styles.meta}>식품의약품안전처 레시피 DB</Text>
            </View>

            {/* 에러 */}
            {group.error && !group.loading && (
              <View style={[styles.errorBanner, { marginBottom: 4 }]}>
                <Text style={styles.errorText}>{group.ingredient} 관련 레시피를 찾지 못했어.</Text>
              </View>
            )}

            {/* 가로 스크롤 카드 */}
            {group.cards.length > 0 && (
              <ScrollView
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 14, gap: 12, paddingVertical: 4 }}
              >
                {group.cards.map((card: RecipeCard, i: number) => (
                  <Pressable
                    key={i}
                    onPress={() =>
                      router.push({ pathname: "/recipe-detail", params: { name: card.name } })
                    }
                    style={({ pressed }) => [styles.crawlCard, pressed && { opacity: 0.88 }]}
                  >
                    {!!card.imageUrl ? (
                      <Image
                        source={{ uri: card.imageUrl }}
                        style={styles.crawlThumb}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.crawlThumb, styles.crawlThumbPlaceholder]}>
                        <Text style={{ fontSize: 24 }}>🍽️</Text>
                      </View>
                    )}
                    <View style={styles.crawlCardBody}>
                      <Text style={styles.crawlCardTitle} numberOfLines={2}>
                        {card.name}
                      </Text>
                      {card.ingredients?.length > 0 && (
                        <Text style={styles.crawlCardIngredients} numberOfLines={2}>
                          {card.ingredients.slice(0, 4).join(" · ")}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        ))}
      </View>
    );
  }, [ingredientGroups, router]);

  const Header = (
    <View style={{ paddingBottom: 8 }}>
      {/* 타이틀 */}
      <View style={styles.topbar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h2}>Recommend</Text>
          <Text style={styles.sub}>임박 재료 우선 요리 추천</Text>
        </View>
        <View style={styles.badgeChip}>
          <Text style={styles.badgeChipText}>오늘</Text>
        </View>
      </View>

      {/* 툴바 */}
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
            placeholder="요리 검색"
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
            <Text style={styles.filterLabel}>시간</Text>
            {(["15", "30", "45", "60+"] as const).map((v) => {
              const active = timePreset === v;
              const label = v === "60+" ? "1시간+" : `${v}분`;
              return (
                <Pressable
                  key={v}
                  onPress={() => setTimePreset(v)}
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
            {(["ALL", "KOREAN", "WESTERN", "CHINESE", "GLOBAL"] as const).map(
              (v) => {
                const active = cuisineFilter === v;
                return (
                  <Pressable
                    key={v}
                    onPress={() => setCuisineFilter(v)}
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
                      {CUISINE_LABELS[v]}
                    </Text>
                  </Pressable>
                );
              },
            )}
          </View>
        </View>
      )}

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.sectionHead}>
        <Text style={styles.h3}>오늘의 추천</Text>
        <Text style={styles.meta}>탭 이동 시 자동 갱신</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
      <FlatList
        data={filtered}
        keyExtractor={(x, idx) => `${x.name}-${idx}`}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} />
        }
        ListHeaderComponent={Header}
        ListFooterComponent={CrawledSection}
        contentContainerStyle={{ paddingBottom: 110 }}
        numColumns={2}
        columnWrapperStyle={{ paddingHorizontal: 14, gap: 12 }}
        renderItem={({ item }: any) => {
          const headlineBadge = item.hasUrgent
            ? { label: "임박 포함", color: THEME.danger, bg: "rgba(235,87,87,0.12)" }
            : { label: "추천", color: "#B7791F", bg: "rgba(242,201,76,0.16)" };

          const cc = CUISINE_COLORS[item.cuisineType] ?? { color: THEME.muted, bg: "rgba(107,114,128,0.12)" };
          const cl = CUISINE_LABELS[item.cuisineType as CuisineType] ?? item.cuisineType;

          return (
            <View style={[styles.card, { flex: 1 }]}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.name}
                </Text>
                <View style={[styles.badge, { backgroundColor: headlineBadge.bg }]}>
                  <Text style={[styles.badgeText, { color: headlineBadge.color }]}>
                    {headlineBadge.label}
                  </Text>
                </View>
              </View>

              <Text style={styles.desc} numberOfLines={3}>
                {(item.ingredients ?? []).join(" · ")}
              </Text>

              <View style={{ flex: 1 }} />

              <View style={styles.footerRow}>
                <View style={[styles.badge, { backgroundColor: cc.bg }]}>
                  <Text style={[styles.badgeText, { color: cc.color }]}>{cl}</Text>
                </View>

                <View style={[styles.badge, { backgroundColor: "rgba(127,183,126,0.18)" }]}>
                  <Text style={[styles.badgeText, { color: THEME.brandInk }]}>
                    {item.cookingTime}분
                  </Text>
                </View>

                <Pressable
                  onPress={() => router.push({ pathname: "/recipe-detail", params: { name: item.name } })}
                  style={({ pressed }) => [styles.btn, pressed && { opacity: 0.9 }]}
                >
                  <Text style={styles.btnText}>보기</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={[styles.empty, { marginHorizontal: 14 }]}>
            <View style={styles.emptyBubble}>
              <Text style={{ fontSize: 16 }}>👩‍🍳</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.emptyTitle}>추천 결과가 없어</Text>
              <Text style={styles.emptyText}>
                재고를 먼저 등록하거나 필터를 완화해봐.
              </Text>
            </View>
            <Pressable
              onPress={load}
              style={({ pressed }) => [styles.btnGhost, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.btnGhostText}>새로고침</Text>
            </Pressable>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles: any = {
  topbar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingTop: 10 },
  h2: { fontSize: 22, fontWeight: "800", color: THEME.text },
  sub: { marginTop: 2, fontSize: 12, color: THEME.muted },
  h3: { fontSize: 16, fontWeight: "800", color: THEME.text },
  meta: { marginTop: 2, fontSize: 12, color: THEME.muted },

  badgeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(127,183,126,0.18)",
    borderWidth: 1,
    borderColor: "rgba(127,183,126,0.24)",
  },
  badgeChipText: { fontSize: 12, fontWeight: "900", color: THEME.brandInk },

  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 14,
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
    marginHorizontal: 14,
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
    marginHorizontal: 14,
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

  sectionHead: {
    marginTop: 12,
    marginHorizontal: 14,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.65)",
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 14,
    marginBottom: 4,
  },

  errorBanner: {
    marginTop: 10,
    marginHorizontal: 14,
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
    borderColor: THEME.border,
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
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },

  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: "900" },

  cardTitle: { flex: 1, fontSize: 15, fontWeight: "900", color: THEME.text },
  desc: { marginTop: 8, fontSize: 12, color: THEME.muted, lineHeight: 16, marginBottom: 10 },

  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  btn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  btnText: { fontSize: 12, fontWeight: "900", color: THEME.text },

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

  // 만개의 레시피 가로 스크롤 카드
  crawlCard: {
    width: 150,
    backgroundColor: "rgba(255,255,255,0.90)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  crawlThumb: {
    width: "100%",
    height: 100,
    backgroundColor: "rgba(127,183,126,0.12)",
  },
  crawlThumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  crawlCardBody: {
    padding: 10,
  },
  crawlCardTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: THEME.text,
    lineHeight: 18,
  },
  crawlCardIngredients: {
    marginTop: 4,
    fontSize: 11,
    color: THEME.muted,
    lineHeight: 15,
  },
};
