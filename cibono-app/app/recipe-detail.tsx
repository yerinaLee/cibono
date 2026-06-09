import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from "react-native";
import { api } from "../src/api/client";


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

  const fetchDetail = () => {
    if (!name) return;
    setLoading(true);
    setError("");
    api
      .get<RecipeDetail>("/recipes/crawl", { params: { name } })
      .then((res) => setDetail(res.data))
      .catch(() => setError("레시피를 불러오지 못했어. 잠시 후 다시 시도해봐."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDetail();
  }, [name]);

  // 네이버 블로그 검색 (별도 비동기, 실패해도 화면에 영향 없음)
  useEffect(() => {
    if (!name) return;
    setBlogsLoading(true);
    api
      .get<BlogItem[]>("/recipes/naver-blog", { params: { query: name } })
      .then((res) => setBlogs(res.data ?? []))
      .catch(() => {})
      .finally(() => setBlogsLoading(false));
  }, [name]);

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
        <Text style={styles.headerTitle} numberOfLines={1}>
          {name ?? "레시피"}
        </Text>
        <View style={{ width: 36 }} />
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
            <View>
              <Text style={styles.title}>{detail.title}</Text>
              {!!detail.description && (
                <Text style={styles.desc}>{detail.description}</Text>
              )}
            </View>

            {/* 재료 — 탭하면 선택, 쇼핑리스트에 추가 가능 */}
            {detail.ingredients.length > 0 && (
              <View style={styles.section}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={styles.sectionTitle}>재료</Text>
                  <Text style={styles.sectionHint}>탭하면 쇼핑리스트에 담을 수 있어</Text>
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
                        {selected && <Text style={styles.checkMark}>✓ </Text>}
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
                  {blogsLoading && (
                    <ActivityIndicator size="small" color={THEME.brand} />
                  )}
                </View>
                {!blogsLoading && blogs.length === 0 && (
                  <Text style={styles.noBlogs}>검색 결과가 없어.</Text>
                )}
                {blogs.map((blog, i) => (
                  <Pressable
                    key={i}
                    onPress={() => Linking.openURL(blog.link)}
                    style={({ pressed }) => [styles.blogItem, pressed && { opacity: 0.82 }]}
                  >
                    <View style={styles.blogRow}>
                      {!!blog.imageUrl && (
                        <Image
                          source={{ uri: blog.imageUrl }}
                          style={styles.blogThumb}
                          resizeMode="cover"
                        />
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.blogTitle} numberOfLines={2}>
                          {blog.title}
                        </Text>
                        <Text style={styles.blogDesc} numberOfLines={2}>
                          {blog.description}
                        </Text>
                        <Text style={styles.blogMeta}>
                          {blog.bloggername}  ·  {formatDate(blog.postdate)}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
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
                ? "✓ 담겼어!"
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
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1,
    borderColor: THEME.border,
  },
  backIcon: { fontSize: 18, color: THEME.text },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "900",
    color: THEME.text,
    marginHorizontal: 8,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 14,
  },
  loadingText: { color: THEME.muted, fontSize: 14, marginTop: 8 },
  errorText: { color: THEME.danger, fontSize: 14, fontWeight: "700", textAlign: "center" },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  retryBtnText: { fontSize: 13, fontWeight: "900", color: THEME.text },

  thumb: {
    width: "100%",
    height: 240,
    backgroundColor: "rgba(127,183,126,0.12)",
  },

  title: { fontSize: 22, fontWeight: "900", color: THEME.text },
  desc: { marginTop: 6, fontSize: 14, color: THEME.muted, lineHeight: 20 },

  section: {
    backgroundColor: "rgba(255,255,255,0.88)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 14,
    gap: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: "900", color: THEME.text },

  ingredientGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sectionHint: { fontSize: 11, color: THEME.muted },
  ingredientChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(127,183,126,0.15)",
    borderWidth: 1,
    borderColor: "rgba(127,183,126,0.30)",
  },
  ingredientChipSelected: {
    backgroundColor: "rgba(127,183,126,0.40)",
    borderColor: "rgba(127,183,126,0.70)",
  },
  checkMark: { fontSize: 12, fontWeight: "900", color: THEME.brandInk },
  ingredientText: { fontSize: 13, fontWeight: "700", color: THEME.brandInk },
  ingredientTextSelected: { fontWeight: "900" },

  floatingBar: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
  },
  floatingBtn: {
    backgroundColor: THEME.brand,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(15,31,22,0.12)",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  floatingBtnText: { fontSize: 15, fontWeight: "900", color: THEME.brandInk },

  stepRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(127,183,126,0.20)",
    borderWidth: 1,
    borderColor: "rgba(127,183,126,0.35)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  stepNumText: { fontSize: 12, fontWeight: "900", color: THEME.brandInk },
  stepText: { flex: 1, fontSize: 14, color: THEME.text, lineHeight: 22 },

  // 네이버 블로그
  noBlogs: { fontSize: 13, color: THEME.muted },
  blogItem: {
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
  },
  blogRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  blogThumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: "rgba(127,183,126,0.12)",
    flexShrink: 0,
  },
  blogTitle: { fontSize: 14, fontWeight: "900", color: THEME.text, lineHeight: 20, marginBottom: 2 },
  blogDesc: { fontSize: 12, color: THEME.muted, lineHeight: 18 },
  blogMeta: { fontSize: 11, color: THEME.muted, marginTop: 4 },
};
