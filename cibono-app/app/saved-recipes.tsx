import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../src/api/client";

type SavedRecipe = {
  id: number;
  recipeName: string;
  imageUrl?: string | null;
  sourceType?: string | null;
  sourceUrl?: string | null;
  ingredients?: string | null;
  createdAt: string;
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

export default function SavedRecipesScreen() {
  const router = useRouter();
  const [items, setItems] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const openSwipeRef = useRef<Swipeable | null>(null);

  const load = useCallback(async (query?: string) => {
    setLoading(true);
    try {
      const res = await api.get<SavedRecipe[]>("/saved-recipes", {
        params: query ? { q: query } : undefined,
      });
      setItems(res.data ?? []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (text: string) => {
    setQ(text);
    load(text);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/saved-recipes/${id}`);
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch {}
  };

  const handlePress = (item: SavedRecipe) => {
    if (item.sourceType === "BLOG" && item.sourceUrl) {
      Linking.openURL(item.sourceUrl);
    } else {
      router.push({ pathname: "/recipe-detail", params: { name: item.recipeName } });
    }
  };

  const renderRightActions = (item: SavedRecipe) => (
    <Pressable
      onPress={() => handleDelete(item.id)}
      style={styles.swipeDelete}
    >
      <MaterialIcons name="delete" size={22} color="#FFFFFF" />
      <Text style={styles.swipeDeleteText}>삭제</Text>
    </Pressable>
  );

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
        <Text style={styles.headerTitle}>저장된 레시피</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* 검색 */}
      <View style={styles.searchBox}>
        <MaterialIcons name="search" size={18} color={THEME.muted} style={{ marginRight: 8 }} />
        <TextInput
          value={q}
          onChangeText={handleSearch}
          placeholder="레시피명 또는 재료 검색"
          placeholderTextColor="rgba(31,41,55,0.40)"
          style={styles.searchInput}
        />
        {q.length > 0 && (
          <Pressable onPress={() => handleSearch("")} style={styles.clearBtn}>
            <MaterialIcons name="close" size={14} color={THEME.muted} />
          </Pressable>
        )}
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
              <MaterialIcons name="push-pin" size={40} color={THEME.muted} />
              <Text style={styles.emptyTitle}>저장된 레시피가 없어</Text>
              <Text style={styles.emptyDesc}>레시피 상세 화면에서 북마크를 눌러 저장해봐.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Swipeable
              ref={(ref) => {
                if (ref && openSwipeRef.current && openSwipeRef.current !== ref) {
                  openSwipeRef.current.close();
                }
              }}
              onSwipeableOpen={() => {
                openSwipeRef.current?.close();
              }}
              renderRightActions={() => renderRightActions(item)}
              overshootRight={false}
            >
              <Pressable
                onPress={() => handlePress(item)}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.recipeName}</Text>
                  {!!item.ingredients && (
                    <Text style={styles.itemMeta} numberOfLines={1}>{item.ingredients}</Text>
                  )}
                  <View style={styles.tagRow}>
                    {!!item.sourceType && (
                      <View style={styles.tag}>
                        <Text style={styles.tagText}>
                          {item.sourceType === "FOOD_SAFETY" ? "식약처" : "블로그"}
                        </Text>
                      </View>
                    )}
                    {item.sourceType === "BLOG" && (
                      <View style={[styles.tag, styles.tagBlog]}>
                        <MaterialIcons name="open-in-new" size={10} color={THEME.brandInk} />
                        <Text style={styles.tagText}>바로 열기</Text>
                      </View>
                    )}
                  </View>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={THEME.muted} />
              </Pressable>
            </Swipeable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles: any = {
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: THEME.border, backgroundColor: THEME.bg,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.85)", borderWidth: 1, borderColor: THEME.border,
  },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "900", color: THEME.text },

  searchBox: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 14, marginTop: 12, marginBottom: 4,
    backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: THEME.border,
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, color: THEME.text, fontSize: 14, paddingVertical: 0 },
  clearBtn: {
    marginLeft: 8, width: 26, height: 26, borderRadius: 13,
    borderWidth: 1, borderColor: THEME.border,
    alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.8)",
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 14, borderWidth: 1, borderColor: THEME.border, padding: 14,
  },
  itemName: { fontSize: 15, fontWeight: "800", color: THEME.text },
  itemMeta: { fontSize: 12, color: THEME.muted, marginTop: 3 },
  tagRow: { flexDirection: "row", gap: 6, marginTop: 6 },
  tag: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    backgroundColor: "rgba(127,183,126,0.15)", borderWidth: 1, borderColor: "rgba(127,183,126,0.30)",
  },
  tagBlog: {
    backgroundColor: "rgba(127,183,126,0.08)",
  },
  tagText: { fontSize: 11, fontWeight: "800", color: THEME.brandInk },

  swipeDelete: {
    backgroundColor: THEME.danger,
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    borderRadius: 14,
    gap: 4,
  },
  swipeDeleteText: { fontSize: 12, fontWeight: "900", color: "#FFFFFF" },

  empty: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "900", color: THEME.text },
  emptyDesc: { fontSize: 13, color: THEME.muted, textAlign: "center" },
};
