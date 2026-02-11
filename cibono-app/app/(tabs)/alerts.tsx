import React, { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { api, explainNetworkHint } from "../../src/api/client";

type AlertEvent = {
  id: number;
  userId: number;
  dealId: number;
  seen: boolean;
};

export default function AlertsScreen() {
  const [items, setItems] = useState<AlertEvent[]>([]);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError("");
    setRefreshing(true);
    try {
      const res = await api.get<AlertEvent[]>("/alerts");
      setItems(res.data);
    } catch (e: any) {
      setError(explainNetworkHint(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  const runScan = useCallback(async () => {
    setError("");
    try {
      await api.post("/admin/alerts/run-scan");
      await load();
    } catch (e: any) {
      setError(explainNetworkHint(e));
    }
  }, [load]);

  const markSeen = useCallback(
    async (id: number) => {
      setError("");
      try {
        await api.post(`/alerts/seen/${id}`);
        await load();
      } catch (e: any) {
        setError(explainNetworkHint(e));
      }
    },
    [load],
  );

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={{ flex: 1, padding: 12 }}>
      {error ? (
        <Text style={{ color: "crimson", marginBottom: 8 }}>{error}</Text>
      ) : null}

      <Pressable
        onPress={runScan}
        style={{
          padding: 12,
          borderRadius: 10,
          borderWidth: 1,
          marginBottom: 10,
          alignItems: "center",
        }}
      >
        <Text style={{ fontWeight: "700" }}>지금 스캔 실행(테스트)</Text>
      </Pressable>

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
              opacity: item.seen ? 0.5 : 1,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700" }}>
              알림 #{item.id} · dealId={item.dealId}
            </Text>
            <Text style={{ marginTop: 6 }}>
              상태: {item.seen ? "확인함" : "미확인"}
            </Text>

            {!item.seen ? (
              <Pressable
                onPress={() => markSeen(item.id)}
                style={{
                  marginTop: 8,
                  padding: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  alignItems: "center",
                }}
              >
                <Text>확인 처리</Text>
              </Pressable>
            ) : null}
          </View>
        )}
        ListEmptyComponent={
          <Text style={{ opacity: 0.7 }}>
            알림이 없습니다. 스캔 실행이 필요합니다.
          </Text>
        }
      />
    </View>
  );
}
