import React, { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { api, explainNetworkHint } from "../../src/api/client";

type Deal = {
  id: number;
  storeId: number | null;
  itemName: string;
  dealPrice: number;
  startsAt: string;
  endsAt: string;
  source: string;
};

export default function DealsScreen() {
  const [items, setItems] = useState<Deal[]>([]);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError("");
    setRefreshing(true);
    try {
      const res = await api.get<Deal[]>("/deals");
      setItems(res.data);
    } catch (e: any) {
      setError(explainNetworkHint(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={{ flex: 1, padding: 12 }}>
      {error ? (
        <Text style={{ color: "crimson", marginBottom: 8 }}>{error}</Text>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(x) => String(x.id)}
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
            <Text style={{ fontSize: 18, fontWeight: "700" }}>
              {item.itemName} · {item.dealPrice.toLocaleString()}원
            </Text>
            <Text style={{ opacity: 0.7 }}>
              {item.startsAt} ~ {item.endsAt} · {item.source}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={{ opacity: 0.7 }}>오늘 유효한 특가가 없어.</Text>
        }
      />
    </View>
  );
}
