import React, { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, explainNetworkHint } from "../../src/api/client";

type Inventory = {
  id: number;
  userId: number;
  itemName: string;
  quantity: number; // 서버는 BigDecimal이지만 JSON은 number로 내려와서 number로 받으면 됨
  unit?: string | null;
  storage: string;
  purchasedAt?: string | null;
  expiresAt?: string | null;
};

export default function InventoryScreen() {
  const [items, setItems] = useState<Inventory[]>([]);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // 아주 간단 입력 폼(MVP)
  const [name, setName] = useState("계란");
  const [qty, setQty] = useState("1");
  const [storage, setStorage] = useState("FRIDGE");
  const [expiresAt, setExpiresAt] = useState(""); // 비우면 서버 자동(네가 만든 룰 있을 때)

  const load = useCallback(async () => {
    setError("");
    setRefreshing(true);
    try {
      const res = await api.get<Inventory[]>("/inventory");
      setItems(res.data);
    } catch (e: any) {
      setError(explainNetworkHint(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  const add = useCallback(async () => {
    setError("");
    try {
      const body: any = {
        itemName: name,
        quantity: Number(qty || "1"),
        storage,
      };
      if (expiresAt.trim()) body.expiresAt = expiresAt.trim();
      await api.post("/inventory", body);
      setExpiresAt("");
      await load();
    } catch (e: any) {
      setError(explainNetworkHint(e));
    }
  }, [name, qty, storage, expiresAt, load]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={{ flex: 1, padding: 12 }}>
      {error ? (
        <Text style={{ color: "crimson", marginBottom: 8 }}>{error}</Text>
      ) : null}

      <View
        style={{
          padding: 12,
          borderWidth: 1,
          borderRadius: 10,
          marginBottom: 12,
        }}
      >
        <Text style={{ fontWeight: "700", marginBottom: 8 }}>
          재료 추가(MVP)
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="품목명"
          style={{
            borderWidth: 1,
            borderRadius: 8,
            padding: 10,
            marginBottom: 8,
          }}
        />
        <TextInput
          value={qty}
          onChangeText={setQty}
          placeholder="수량"
          keyboardType="numeric"
          style={{
            borderWidth: 1,
            borderRadius: 8,
            padding: 10,
            marginBottom: 8,
          }}
        />
        <TextInput
          value={storage}
          onChangeText={setStorage}
          placeholder="FRIDGE/FREEZER/PANTRY"
          style={{
            borderWidth: 1,
            borderRadius: 8,
            padding: 10,
            marginBottom: 8,
          }}
        />
        <TextInput
          value={expiresAt}
          onChangeText={setExpiresAt}
          placeholder="유통기한(YYYY-MM-DD) 비우면 자동(가능 시)"
          style={{
            borderWidth: 1,
            borderRadius: 8,
            padding: 10,
            marginBottom: 8,
          }}
        />

        <Pressable
          onPress={add}
          style={{
            padding: 12,
            borderRadius: 10,
            borderWidth: 1,
            alignItems: "center",
          }}
        >
          <Text style={{ fontWeight: "700" }}>추가</Text>
        </Pressable>
      </View>

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
              {item.itemName} · {item.quantity}
              {item.unit ?? ""}
            </Text>
            <Text style={{ opacity: 0.7 }}>
              {item.storage} · exp: {item.expiresAt ?? "-"}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={{ opacity: 0.7 }}>재고가 없습니다. 추가하세요.</Text>
        }
      />
    </View>
  );
}
