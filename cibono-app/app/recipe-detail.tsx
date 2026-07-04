import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, proxyImageUrl } from "../src/api/client";

type RecipeDetail = {
  title: string;
  description: string;
  imageUrl: string;
  sourceUrl: string;
  ingredients: string[];
  steps: string[];
};

type BlogItem = {
  title: string;
  link: string;
  description: string;
  bloggername: string;
  postdate: string;
  imageUrl: string;
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

function formatDate(d: string) {
  if (d.length === 8) return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`;
  return d;
}

export default function RecipeDetailScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const router = useRouter();

  const [detail, setDetail] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [blogs, setBlogs] = useState<BlogItem[]>([]);
  const [blogsLoading, setBlogsLoading] = useState(false);

  // 쇼핑리스트 재료 선택
  const [selectedIngs, setSelectedIngs] = useState<Set<string>>(new Set());
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartSuccess, setCartSuccess] = useState(false);

  // 식약처 레시피 저장
  const [saved, setSaved] = useState(false);
  const [savingRecipe, setSavingRecipe] = useState(false);

  // 블로그 저장 상태 (link → saved)
  const [savedBlogs, setSavedBlogs] = useState<Set<string>>(new Set());
  const [savingBlog, setSavingBlog] = useState<string | null>(null);

  // 블로그 이미지 로드 실패 추적
  const [blogImgErrors, setBlogImgErrors] = useState<Set<string>>(new Set());

  function toggleIng(ing: string) {
    setSelectedIngs((prev) => {
      const next = new Set(prev);
      if (next.has(ing)) next.delete(ing);
      else next.add(ing);
      return next;
    });
  }

  async function addToShoppingList() {
    if (selectedIngs.size === 0) return;
    setAddingToCart(true);
    try {
      await api.post("/shopping-list/bulk",
        Array.from(selectedIngs).map((itemName) => ({ itemName }))
      );
      setSelectedIngs(new Set());
      setCartSuccess(true);
      setTimeout(() => setCartSuccess(false), 2000);
    } catch {}
    finally { setAddingToCart(false); }
  }

  async function toggleSave() {
    if (!name) return;
    setSavingRecipe(true);
    try {
      if (saved) {
        await api.delete("/saved-recipes/by-name", { params: { name } });
        setSaved(false);
      } else {
        await api.post("/saved-recipes", {
          recipeName: name,
          imageUrl: detail?.imageUrl ?? null,
          sourceType: "FOOD_SAFETY",
          ingredients: detail?.ingredients?.join(", ") ?? null,
        });
        setSaved(true);
      }
    } catch {}
    finally { setSavingRecipe(false); }
  }

  async function toggleBlogSave(blog: BlogItem) {
    const key = blog.link;
    setSavingBlog(key);
    try {
      if (savedBlogs.has(key)) {
        await api.delete("/saved-recipes/by-name", { params: { name: blog.title } });
        setSavedBlogs((prev) => { const next = new Set(prev); next.delete(key); return next; });
      } else {
        await api.post("/saved-recipes", {
          recipeName: blog.title,
          imageUrl: blog.imageUrl ?? null,
          sourceType: "BLOG",
          sourceUrl: blog.link,
          ingredients: null,
        });
        setSavedBlogs((prev) => new Set([...prev, key]));
      }
    } catch {}
    finally { setSavingBlog(null); }
  }

  const fetchDetail = () => {
    if (!name) return;
    setLoading(true);
    setError("");
    api
      .get<RecipeDetail>("/recipes/crawl", { params: { name } })
      .then((res) => setDetail(res.data))
      .catch(() => setError("레시피를 불러오지 못했어요. 잠시 후 다시 시도해보세요."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchDetail(); }, [name]);

  useEffect(() => {
    if (!name) return;
    api.get<{ saved: boolean }>("/saved-recipes/exists", { params: { name } })
      .then((res) => setSaved(res.data.saved))
      .catch(() => {});
  }, [name]);

  useEffect(() => {
    if (!name) return;
    setBlogsLoading(true);
    api
      .get<BlogItem[]>("/recipes/naver-blog", { params: { query: name } })
      .then((res) => {
        const data = res.data ?? [];
        console.log("[Blog] 받은 목록:", data.map((b) => ({ title: b.title, imageUrl: b.imageUrl })));
        setBlogs(data);
      })
      .catch(() => {})
      .finally(() => setBlogsLoading(false));
  }, [name]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
        >
          <MaterialIcons name="arrow-back" size={22} color={THEME.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{name ?? "레시피"}</Text>
        <Pressable
          onPress={toggleSave}
          disabled={savingRecipe}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
        >
          <MaterialIcons
            name={saved ? "bookmark" : "bookmark-border"}
            size={22}
            color={saved ? THEME.brand : THEME.text}
          />
        </Pressable>
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={THEME.brand} />
          <Text style={styles.loadingText}>식품안전처에서 레시피 가져오는 중...</Text>
        </View>
      )}

      {!loading && error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            onPress={fetchDetail}
            style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.retryBtnText}>다시 시도</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && detail && (
        <ScrollView contentContainerStyle={{ paddingBottom: selectedIngs.size > 0 ? 100 : 60 }}>
          {/* 썸네일 */}
          {!!detail.imageUrl && (
            <Image
              source={{ uri: detail.imageUrl }}
              style={styles.thumb}
              resizeMode="cover"
            />
          )}

          <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 14 }}>
            {/* 타이틀 */}
            <Text style={styles.title}>{detail.title}</Text>

            {/* 재료 */}
            {detail.ingredients.length > 0 && (
              <View style={styles.section}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={styles.sectionTitle}>재료</Text>
                  <Text style={styles.sectionHint}>탭하면 쇼핑리스트에 담을 수 있어요</Text>
                </View>
                <View style={styles.ingredientGrid}>
                  {detail.ingredients.map((ing, i) => {
                    const selected = selectedIngs.has(ing);
                    return (
                      <Pressable
                        key={i}
                        onPress={() => toggleIng(ing)}
                        style={({ pressed }) => [
                          styles.ingredientChip,
                          selected && styles.ingredientChipSelected,
                          pressed && { opacity: 0.8 },
                        ]}
                      >
                        {selected && <MaterialIcons name="check" size={12} color={THEME.brandInk} style={{ marginRight: 2 }} />}
                        <Text style={[styles.ingredientText, selected && styles.ingredientTextSelected]}>
                          {ing}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

            )}

            {/* 조리 순서 */}
            {detail.steps.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>조리 순서</Text>
                {detail.steps.map((step, i) => (
                  <View key={i} style={styles.stepRow}>
                    <View style={styles.stepNum}>
                      <Text style={styles.stepNumText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* 네이버 블로그 레시피 */}
            {(blogsLoading || blogs.length > 0) && (
              <View style={styles.section}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={styles.sectionTitle}>블로그 레시피</Text>
                  {blogsLoading && <ActivityIndicator size="small" color={THEME.brand} />}
                </View>
                {!blogsLoading && blogs.length === 0 && (
                  <Text style={styles.noBlogs}>검색 결과가 없어요.</Text>
                )}
                {blogs.map((blog, i) => (
                  <View key={i} style={styles.blogItem}>
                    <Pressable
                      onPress={() => Linking.openURL(blog.link)}
                      style={({ pressed }) => [styles.blogRow, pressed && { opacity: 0.82 }]}
                    >
                      {blog.imageUrl && !blogImgErrors.has(blog.link) ? (
                        <Image
                          source={{ uri: proxyImageUrl(blog.imageUrl)! }}
                          style={styles.blogThumb}
                          resizeMode="cover"
                          onError={() =>
                            setBlogImgErrors((prev) => new Set([...prev, blog.link]))
                          }
                        />
                      ) : (
                        <View style={[styles.blogThumb, styles.blogThumbPlaceholder]}>
                          <MaterialIcons name="article" size={28} color={THEME.muted} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.blogTitle} numberOfLines={2}>{blog.title}</Text>
                        <Text style={styles.blogDesc} numberOfLines={2}>{blog.description}</Text>
                        <Text style={styles.blogMeta}>{blog.bloggername}  ·  {formatDate(blog.postdate)}</Text>
                      </View>
                    </Pressable>
                    {/* 블로그 저장 버튼 */}
                    <Pressable
                      onPress={() => toggleBlogSave(blog)}
                      disabled={savingBlog === blog.link}
                      style={({ pressed }) => [styles.blogSaveBtn, pressed && { opacity: 0.7 }]}
                    >
                      <MaterialIcons
                        name={savedBlogs.has(blog.link) ? "bookmark" : "bookmark-border"}
                        size={20}
                        color={savedBlogs.has(blog.link) ? THEME.brand : THEME.muted}
                      />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* 쇼핑리스트 담기 플로팅 버튼 */}
      {selectedIngs.size > 0 && (
        <View style={styles.floatingBar}>
          <Pressable
            onPress={addToShoppingList}
            disabled={addingToCart}
            style={({ pressed }) => [styles.floatingBtn, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.floatingBtnText}>
              {cartSuccess
                ? "✓ 담겼어요!"
                : addingToCart
                ? "추가 중..."
                : `🛒 ${selectedIngs.size}개 쇼핑리스트에 담기`}
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles: any = {
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: THEME.bg,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1, borderColor: THEME.border,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16, fontWeight: "900", color: THEME.text,
    marginHorizontal: 8,
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 14 },
  loadingText: { color: THEME.muted, fontSize: 14, marginTop: 8 },
  errorText: { color: THEME.danger, fontSize: 14, fontWeight: "700", textAlign: "center" },
  retryBtn: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1, borderColor: THEME.border, backgroundColor: "#FFFFFF",
  },
  retryBtnText: { fontSize: 13, fontWeight: "900", color: THEME.text },

  thumb: { width: "100%", height: 240, backgroundColor: "rgba(127,183,126,0.12)" },

  title: { fontSize: 22, fontWeight: "900", color: THEME.text },

  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16, borderWidth: 1, borderColor: THEME.border,
    padding: 14, gap: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: "900", color: THEME.text },
  sectionHint: { fontSize: 11, color: THEME.muted },

  ingredientGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  ingredientChip: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    backgroundColor: "rgba(127,183,126,0.15)",
    borderWidth: 1, borderColor: "rgba(127,183,126,0.30)",
  },
  ingredientChipSelected: {
    backgroundColor: "rgba(127,183,126,0.40)",
    borderColor: "rgba(127,183,126,0.70)",
  },
  ingredientText: { fontSize: 13, fontWeight: "700", color: THEME.brandInk },
  ingredientTextSelected: { fontWeight: "900" },

  stepRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  stepNum: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "rgba(127,183,126,0.20)",
    borderWidth: 1, borderColor: "rgba(127,183,126,0.35)",
    alignItems: "center", justifyContent: "center",
    flexShrink: 0, marginTop: 1,
  },
  stepNumText: { fontSize: 12, fontWeight: "900", color: THEME.brandInk },
  stepText: { flex: 1, fontSize: 14, color: THEME.text, lineHeight: 22 },

  floatingBar: { position: "absolute", bottom: 20, left: 16, right: 16 },
  floatingBtn: {
    backgroundColor: THEME.brand, borderRadius: 16, paddingVertical: 14,
    alignItems: "center", borderWidth: 1, borderColor: "rgba(15,31,22,0.12)",
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  floatingBtnText: { fontSize: 15, fontWeight: "900", color: THEME.brandInk },

  noBlogs: { fontSize: 13, color: THEME.muted },
  blogItem: {
    flexDirection: "row", alignItems: "center",
    paddingTop: 10, borderTopWidth: 1, borderTopColor: THEME.border,
    gap: 8,
  },
  blogRow: { flex: 1, flexDirection: "row", gap: 10, alignItems: "flex-start" },
  blogThumb: {
    width: 72, height: 72, borderRadius: 10,
    backgroundColor: "rgba(127,183,126,0.12)", flexShrink: 0,
  },
  blogThumbPlaceholder: {
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: THEME.border,
  },
  blogTitle: { fontSize: 14, fontWeight: "900", color: THEME.text, lineHeight: 20, marginBottom: 2 },
  blogDesc: { fontSize: 12, color: THEME.muted, lineHeight: 18 },
  blogMeta: { fontSize: 11, color: THEME.muted, marginTop: 4 },
  blogSaveBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1, borderColor: THEME.border,
    flexShrink: 0,
  },
};
