import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from "react-native";
import { api } from "../src/api/client";

type RecipeCard = {
  name: string;
  imageUrl: string;
  sourceUrl: string;
  ingredients: string[];
};

const THEME = {
  bg: "#F3F8F1",
  text: "#1F2937",
  muted: "#6B7280",
  border: "rgba(31,41,55,0.10)",
  brand: "#7FB77E",
  brandInk: "#0F1F16",
  danger: "#EB5757",
};

export default function IngredientRecipesScreen() {
  const { ingredient } = useLocalSearchParams<{ ingredient: string }>();
  const router = useRouter();

  const [cards, setCards] = useState<RecipeCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!ingredient) return;
    setLoading(true);
    setError(false);
    api
      .get<RecipeCard[]>("/recipes/search-by-ingredient", { params: { ingredient } })
      .then((res) => setCards(res.data ?? []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [ingredient]);

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
        <View style={{ flex: 1, marginHorizontal: 8 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            <Text style={{ color: THEME.brand }}>{ingredient}</Text> 레시피
          </Text>
          <Text style={styles.headerSub}>식품의약품안전처 레시피 DB</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={THEME.brand} />
          <Text style={styles.loadingText}>레시피 검색 중...</Text>
        </View>
      )}

      {!loading && error && (
        <View style={styles.center}>
          <Text style={styles.errorText}>레시피를 불러오지 못했어.</Text>
        </View>
      )}

      {!loading && !error && cards.length === 0 && (
        <View style={styles.center}>
          <Text style={{ fontSize: 32 }}>🍽️</Text>
          <Text style={styles.emptyTitle}>{ingredient} 관련 레시피가 없어</Text>
          <Text style={styles.emptyDesc}>식품안전처 DB에서 찾지 못했어.</Text>
        </View>
      )}

      {!loading && cards.length > 0 && (
        <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 40 }}>
          <Text style={styles.countText}>{cards.length}개의 레시피</Text>
          {cards.map((card, i) => (
            <Pressable
              key={i}
              onPress={() => router.push({ pathname: "/recipe-detail", params: { name: card.name } })}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.88 }]}
            >
              {!!card.imageUrl && (
                <Image
                  source={{ uri: card.imageUrl }}
                  style={styles.cardThumb}
                  resizeMode="cover"
                />
              )}
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>{card.name}</Text>
                {card.ingredients?.length > 0 && (
                  <Text style={styles.cardIngs} numberOfLines={2}>
                    {card.ingredients.slice(0, 5).join(" · ")}
                  </Text>
                )}
              </View>
            </Pressable>
          ))}
        </ScrollView>
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
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    backgroundColor: THEME.bg,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1, borderColor: THEME.border,
  },
  backIcon: { fontSize: 18, color: THEME.text },
  headerTitle: { fontSize: 17, fontWeight: "900", color: THEME.text },
  headerSub: { fontSize: 11, color: THEME.muted, marginTop: 1 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 32 },
  loadingText: { fontSize: 14, color: THEME.muted },
  errorText: { fontSize: 14, color: THEME.danger, fontWeight: "700" },
  emptyTitle: { fontSize: 16, fontWeight: "900", color: THEME.text },
  emptyDesc: { fontSize: 13, color: THEME.muted },

  countText: { fontSize: 12, color: THEME.muted, fontWeight: "700", marginBottom: 2 },

  card: {
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
  cardThumb: {
    width: "100%",
    height: 160,
    backgroundColor: "rgba(127,183,126,0.12)",
  },
  cardBody: { padding: 14, gap: 6 },
  cardTitle: { fontSize: 16, fontWeight: "900", color: THEME.text },
  cardIngs: { fontSize: 12, color: THEME.muted, lineHeight: 18 },
};
