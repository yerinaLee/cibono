import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollTopButton } from "@/components/ScrollTopButton";
import { useScrollTop } from "@/hooks/use-scroll-top";
import { THEME } from "@/src/theme";
import AppHeader from "../../components/AppHeader";
import { api, explainNetworkHint, proxyImageUrl } from "../../src/api/client";

type CuisineType = "ALL" | "KOREAN" | "WESTERN" | "CHINESE" | "GLOBAL";

type Suggestion = {
  name: string;
  imageUrl?: string;
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

type BlogSearchResult = {
  title: string;
  link: string;
  description: string;
  bloggername: string;
  postdate: string;
  imageUrl?: string | null;
};

const CUISINE_LABELS: Record<CuisineType, string> = {
  ALL: "전체",
  KOREAN: "한식",
  WESTERN: "양식",
  CHINESE: "중식",
  GLOBAL: "글로벌",
};

const CUISINE_COLORS: Record<string, { color: string; bg: string }> = {
  KOREAN: { color: "#7C3D12", bg: "rgba(251,191,36,0.18)" },
  WESTERN: { color: "#1E40AF", bg: "rgba(96,165,250,0.18)" },
  CHINESE: { color: "#991B1B", bg: "rgba(252,165,165,0.20)" },
  GLOBAL: { color: "#065F46", bg: "rgba(52,211,153,0.18)" },
};

type Inventory = {
  id: number;
  itemName: string;
  expiresAt?: string | null;
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

export default function RecommendScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [ingredientGroups, setIngredientGroups] = useState<IngredientGroup[]>(
    [],
  );
  const cancelRef = useRef(false);
  const { listRef, showScrollTop, handleScroll, scrollToTop } = useScrollTop();

  const [blogResults, setBlogResults] = useState<BlogSearchResult[]>([]);
  const [blogLoading, setBlogLoading] = useState(false);
  const [savedSearchBlogs, setSavedSearchBlogs] = useState<Set<string>>(
    new Set(),
  );
  const [savingSearchBlog, setSavingSearchBlog] = useState<string | null>(null);

  const [inputVal, setInputVal] = useState("");
  const [q, setQ] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [timePreset, setTimePreset] = useState<
    "ALL" | "15" | "30" | "45" | "60+"
  >("ALL");
  const [cuisineFilter, setCuisineFilter] = useState<CuisineType>("ALL");

  // 식약처 API가 동일 키 동시 접속을 차단하므로 순차 호출
  const loadIngredientGroups = useCallback(async (targets: string[]) => {
    cancelRef.current = false;
    const limited = targets.slice(0, 4);
    setIngredientGroups(
      limited.map((ing) => ({
        ingredient: ing,
        cards: [],
        loading: true,
        error: false,
      })),
    );

    for (let idx = 0; idx < limited.length; idx++) {
      if (cancelRef.current) break; // cleanup 이후 중단
      const ing = limited[idx];
      try {
        const res = await api.get<RecipeCard[]>(
          "/recipes/search-by-ingredient",
          { params: { ingredient: ing } },
        );
        if (cancelRef.current) break;
        const cards = res.data ?? [];
        setIngredientGroups((prev) => {
          if (idx >= prev.length) return prev;
          const next = [...prev];
          next[idx] = {
            ingredient: ing,
            cards,
            loading: false,
            error: cards.length === 0,
          };
          return next;
        });
      } catch {
        if (cancelRef.current) break;
        setIngredientGroups((prev) => {
          if (idx >= prev.length) return prev;
          const next = [...prev];
          next[idx] = {
            ingredient: ing,
            cards: [],
            loading: false,
            error: true,
          };
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
        .filter((inv) => {
          const d = daysUntil(inv.expiresAt);
          return d !== null && d <= 7;
        })
        .map((inv) => inv.itemName);

      const crawlTargets =
        urgentIngs.length > 0
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
        cancelRef.current = true;
        setInputVal("");
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

    if (timePreset !== "ALL") {
      if (timePreset === "60+") {
        arr = arr.filter((x) => (x.cookingTime ?? 0) >= 60);
      } else {
        const maxMin = parseInt(timePreset, 10);
        arr = arr.filter((x) => (x.cookingTime ?? 0) <= maxMin);
      }
    }

    if (cuisineFilter !== "ALL")
      arr = arr.filter((x) => x.cuisineType === cuisineFilter);

    return [...arr].sort(
      (a, b) => Number(b.hasUrgent) - Number(a.hasUrgent) || b.score - a.score,
    );
  }, [computed, cuisineFilter, q, timePreset]);

  const openBlogLink = useCallback(async (url: string) => {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      // 링크를 열 수 없는 경우 무시
    }
  }, []);

  const toggleSearchBlogSave = useCallback(
    async (blog: BlogSearchResult) => {
      const key = blog.link;
      setSavingSearchBlog(key);
      try {
        if (savedSearchBlogs.has(key)) {
          await api.delete("/saved-recipes/by-name", {
            params: { name: blog.title },
          });
          setSavedSearchBlogs((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        } else {
          await api.post("/saved-recipes", {
            recipeName: blog.title,
            imageUrl: blog.imageUrl ?? null,
            sourceType: "BLOG",
            sourceUrl: blog.link,
            ingredients: null,
          });
          setSavedSearchBlogs((prev) => new Set([...prev, key]));
        }
      } catch {
      } finally {
        setSavingSearchBlog(null);
      }
    },
    [savedSearchBlogs],
  );

  // 검색어 있을 때 블로그 검색
  useEffect(() => {
    const keyword = q.trim();
    if (!keyword) {
      setBlogResults([]);
      return;
    }
    let cancelled = false;
    setBlogLoading(true);
    api
      .get<BlogSearchResult[]>("/recipes/naver-blog", {
        params: { query: keyword },
      })
      .then((res) => {
        if (!cancelled) setBlogResults(res.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setBlogResults([]);
      })
      .finally(() => {
        if (!cancelled) setBlogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (timePreset !== "ALL") n++;
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
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Text style={styles.h3}>
                  임박재료{" "}
                  <Text style={{ color: THEME.brand }}>{group.ingredient}</Text>{" "}
                  가 들어가는 레시피
                </Text>
                {group.loading && (
                  <ActivityIndicator size="small" color={THEME.brand} />
                )}
              </View>
            </View>

            {/* 에러 */}
            {group.error && !group.loading && (
              <View style={[styles.errorBanner, { marginBottom: 4 }]}>
                <Text style={styles.errorText}>
                  {group.ingredient} 관련 레시피를 찾지 못했어요.
                </Text>
              </View>
            )}

            {/* 가로 스크롤 카드 */}
            {group.cards.length > 0 && (
              <ScrollView
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: 14,
                  gap: 12,
                  paddingVertical: 4,
                }}
              >
                {group.cards.map((card: RecipeCard, i: number) => (
                  <Pressable
                    key={i}
                    onPress={() =>
                      router.push({
                        pathname: "/recipe-detail",
                        params: { name: card.name },
                      })
                    }
                    style={({ pressed }) => [
                      styles.crawlCard,
                      pressed && { opacity: 0.88 },
                    ]}
                  >
                    {!!card.imageUrl ? (
                      <Image
                        source={{ uri: card.imageUrl }}
                        style={styles.crawlThumb}
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={[
                          styles.crawlThumb,
                          styles.crawlThumbPlaceholder,
                        ]}
                      >
                        <Text style={{ fontSize: 24 }}>🍽️</Text>
                      </View>
                    )}
                    <View style={styles.crawlCardBody}>
                      <Text style={styles.crawlCardTitle} numberOfLines={2}>
                        {card.name}
                      </Text>
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
      {/* 검색 중일 때는 임박재료·오늘의 추천 숨기고, 식약처 결과 헤딩만 표시 */}
      {q.trim() ? (
        filtered.length > 0 && (
          <View style={styles.sectionHead}>
            <Text style={styles.h3}>식약처 레시피</Text>
            <Text style={styles.meta}>&ldquo;{q}&rdquo; 검색 결과</Text>
          </View>
        )
      ) : (
        <>
          {CrawledSection}
          <View style={styles.sectionHead}>
            <Text style={styles.h3}>오늘의 추천</Text>
            <Text style={styles.meta}>탭 이동 시 자동 갱신</Text>
          </View>
        </>
      )}
    </View>
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: THEME.bg }}
      edges={["bottom", "left", "right"]}
    >
      <AppHeader title="추천" subtitle="임박 재료 우선 레시피 추천" />

      {/* 검색·필터 툴바 */}
      <View style={styles.toolbar}>
        <Pressable
          onPress={() => setShowSearch((p) => !p)}
          style={({ pressed }) => [
            styles.iconCircle,
            showSearch && styles.iconCircleActive,
            pressed && { opacity: 0.85 },
          ]}
        >
          <MaterialIcons
            name="search"
            size={20}
            color={showSearch ? THEME.brand : THEME.text}
          />
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
            <MaterialIcons
              name="tune"
              size={20}
              color={filterOpen ? THEME.brand : THEME.text}
            />
          </Pressable>
          {activeFilterCount > 0 && <View style={styles.badgeDot} />}
        </View>
        {activeFilterCount > 0 && (
          <Pressable
            onPress={() => {
              setTimePreset("ALL");
              setCuisineFilter("ALL");
            }}
            style={({ pressed }) => [
              styles.iconCircle,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={{ fontSize: 11, fontWeight: "900", color: "#B42318" }}>
              초기화
            </Text>
          </Pressable>
        )}
      </View>

      {/* 인라인 검색창 */}
      {showSearch && (
        <View style={styles.inlineSearch}>
          <Text style={styles.searchIconText}>⌕</Text>
          <TextInput
            value={inputVal}
            onChangeText={setInputVal}
            onSubmitEditing={() => setQ(inputVal.trim())}
            returnKeyType="search"
            placeholder="요리 검색 후 엔터"
            placeholderTextColor="rgba(31,41,55,0.45)"
            style={styles.searchInput}
            autoFocus
          />
          {inputVal.length > 0 && (
            <Pressable
              onPress={() => {
                setInputVal("");
                setQ("");
              }}
              style={styles.clearBtn}
            >
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
            {(["ALL", "15", "30", "45", "60+"] as const).map((v) => {
              const active = timePreset === v;
              const label =
                v === "ALL" ? "전체" : v === "60+" ? "1시간+" : `${v}분 이내`;
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

      <FlatList
        ref={listRef}
        data={filtered.slice(0, 8)}
        keyExtractor={(x, idx) => `${x.name}-${idx}`}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} />
        }
        ListHeaderComponent={Header}
        ListFooterComponent={
          q.trim() ? (
            <View style={{ paddingBottom: 8 }}>
              {blogResults.length > 0 && (
                <>
                  <View style={styles.sectionHead}>
                    <Text style={styles.h3}>블로그 레시피</Text>
                    <Text style={styles.meta}>&ldquo;{q}&rdquo; 검색 결과</Text>
                  </View>
                  {blogResults.map((blog, i) => (
                    <Pressable
                      key={i}
                      onPress={() => openBlogLink(blog.link)}
                      style={({ pressed }) => [
                        styles.blogRow,
                        pressed && { opacity: 0.9 },
                      ]}
                    >
                      {blog.imageUrl ? (
                        <Image
                          source={{ uri: proxyImageUrl(blog.imageUrl)! }}
                          style={styles.blogThumb}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={[
                            styles.blogThumb,
                            styles.blogThumbPlaceholder,
                          ]}
                        >
                          <MaterialIcons
                            name="article"
                            size={24}
                            color={THEME.muted}
                          />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.blogTitle} numberOfLines={2}>
                          {blog.title}
                        </Text>
                        <Text style={styles.blogMeta} numberOfLines={1}>
                          {blog.bloggername}
                        </Text>
                        <Text style={styles.blogDesc} numberOfLines={2}>
                          {blog.description}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => toggleSearchBlogSave(blog)}
                        disabled={savingSearchBlog === blog.link}
                        hitSlop={8}
                      >
                        <MaterialIcons
                          name={
                            savedSearchBlogs.has(blog.link)
                              ? "bookmark"
                              : "bookmark-border"
                          }
                          size={22}
                          color={
                            savedSearchBlogs.has(blog.link)
                              ? THEME.brand
                              : THEME.muted
                          }
                        />
                      </Pressable>
                    </Pressable>
                  ))}
                </>
              )}
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 110 }}
        numColumns={2}
        columnWrapperStyle={{ paddingHorizontal: 14, gap: 12 }}
        renderItem={({ item }: any) => {
          const headlineBadge = item.hasUrgent
            ? {
                label: "임박 포함",
                color: THEME.danger,
                bg: "rgba(235,87,87,0.12)",
              }
            : { label: "추천", color: "#B7791F", bg: "rgba(242,201,76,0.16)" };

          const cc = CUISINE_COLORS[item.cuisineType] ?? {
            color: THEME.muted,
            bg: "rgba(107,114,128,0.12)",
          };
          const cl =
            CUISINE_LABELS[item.cuisineType as CuisineType] ?? item.cuisineType;

          return (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/recipe-detail",
                  params: { name: item.name },
                })
              }
              style={({ pressed }) => [
                styles.card,
                { flex: 1 },
                pressed && { opacity: 0.88 },
              ]}
            >
              <View style={{ padding: 10, flex: 1 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: headlineBadge.bg },
                    ]}
                  >
                    <Text
                      style={[styles.badgeText, { color: headlineBadge.color }]}
                    >
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
                    <Text style={[styles.badgeText, { color: cc.color }]}>
                      {cl}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: "rgba(127,183,126,0.18)" },
                    ]}
                  >
                    <Text style={[styles.badgeText, { color: THEME.brandInk }]}>
                      {item.cookingTime}분
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          q.trim() ? (
            blogLoading ? (
              <ActivityIndicator
                style={{ marginVertical: 20 }}
                color={THEME.brand}
              />
            ) : null
          ) : (
            <View style={[styles.empty, { marginHorizontal: 14 }]}>
              <View style={styles.emptyBubble}>
                <Text style={{ fontSize: 16 }}>👩‍🍳</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.emptyTitle}>추천 결과가 없어요</Text>
                <Text style={styles.emptyText}>
                  재고를 먼저 등록하거나 필터를 완화해보세요.
                </Text>
              </View>
              <Pressable
                onPress={load}
                style={({ pressed }) => [
                  styles.btnGhost,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.btnGhostText}>새로고침</Text>
              </Pressable>
            </View>
          )
        }
      />

      <ScrollTopButton
        visible={showScrollTop}
        onPress={scrollToTop}
        style={{ bottom: 90 + insets.bottom }}
      />
    </SafeAreaView>
  );
}

const styles: any = {
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
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
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardThumb: {
    width: "100%",
    height: 100,
    backgroundColor: "rgba(127,183,126,0.12)",
  },
  cardThumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
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
  desc: {
    marginTop: 8,
    fontSize: 12,
    color: THEME.muted,
    lineHeight: 16,
    marginBottom: 10,
  },

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

  blogRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 14,
    marginBottom: 8,
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  blogThumb: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: "rgba(127,183,126,0.12)",
  },
  blogThumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  blogTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: THEME.text,
    lineHeight: 19,
  },
  blogMeta: {
    marginTop: 2,
    fontSize: 11,
    color: THEME.brand,
    fontWeight: "700",
  },
  blogDesc: { marginTop: 2, fontSize: 11, color: THEME.muted, lineHeight: 15 },

  // 만개의 레시피 가로 스크롤 카드
  crawlCard: {
    width: 150,
    backgroundColor: "#FFFFFF",
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
