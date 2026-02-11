import React, { useCallback, useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { api, explainNetworkHint } from "../../src/api/client";

type Suggestion = {
  name: string;
  ingredients: string[];
  missingCount: number;
  score: number;
};

export default function RecommendScreen() {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError("");
    setRefreshing(true);
    try {
      const res = await api.get<Suggestion[]>("/recommendations/today");
      setItems(res.data);
    } catch (e: any) {
      setError(explainNetworkHint(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={{ flex: 1, padding: 12 }}>
      {error ? (
        <Text style={{ color: "crimson", marginBottom: 8 }}>{error}</Text>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(x, idx) => `${x.name}-${idx}`}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} />
        }
        renderItem={({ item }) => (
          <View
            style={{
              padding: 12,
              borderWidth: 1,
              borderRadius: 10,
              marginBottom: 10,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "700" }}>{item.name}</Text>
            <Text style={{ marginTop: 6 }}>
              재료: {item.ingredients.join(", ")}
            </Text>
            <Text style={{ opacity: 0.7, marginTop: 4 }}>
              부족 재료: {item.missingCount} · 점수: {item.score}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={{ opacity: 0.7 }}>추천 결과가 없습니다.</Text>
        }
      />
    </View>
  );
}
