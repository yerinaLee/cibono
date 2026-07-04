import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../src/api/client";

const APP_VERSION = "0.1.0";

const THEME = {
  bg: "#F3F8F1",
  text: "#1F2937",
  muted: "#6B7280",
  border: "rgba(31,41,55,0.10)",
  brand: "#7FB77E",
  brandInk: "#0F1F16",
};

export default function SettingsScreen() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [lunchEnabled, setLunchEnabled] = useState(true);
  const [dinnerEnabled, setDinnerEnabled] = useState(true);
  const [dealEnabled, setDealEnabled] = useState(true);

  useEffect(() => {
    api.get<{ role: string }>("/me").then((res) => {
      setIsAdmin(res.data.role === "ADMIN");
    }).catch(() => {});

    api.get<{ lunchEnabled: boolean; dinnerEnabled: boolean; dealEnabled: boolean }>("/notifications/preferences")
      .then((res) => {
        setLunchEnabled(res.data.lunchEnabled);
        setDinnerEnabled(res.data.dinnerEnabled);
        setDealEnabled(res.data.dealEnabled);
      })
      .catch(() => {});
  }, []);

  const updatePreference = (lunch: boolean, dinner: boolean, deal: boolean) => {
    api.put("/notifications/preferences", { lunchEnabled: lunch, dinnerEnabled: dinner, dealEnabled: deal }).catch(() => {});
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>설정</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={{ padding: 14, gap: 12 }}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>앱 정보</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>앱 이름</Text>
            <Text style={styles.rowValue}>Cibono</Text>
          </View>
          <View style={[styles.row, { borderTopWidth: 1, borderTopColor: THEME.border }]}>
            <Text style={styles.rowLabel}>버전</Text>
            <Text style={styles.rowValue}>v{APP_VERSION}</Text>
          </View>
          <View style={[styles.row, { borderTopWidth: 1, borderTopColor: THEME.border }]}>
            <Text style={styles.rowLabel}>설명</Text>
            <Text style={[styles.rowValue, { flex: 1, textAlign: "right" }]}>
              식재료 관리 · 특가 알림 · 레시피 추천
            </Text>
          </View>
        </View>

        {isAdmin && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>관리자</Text>
            <Pressable
              onPress={() => router.push("/admin-notifications")}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <MaterialIcons name="notifications-active" size={16} color={THEME.brand} />
                <Text style={styles.rowLabel}>알림 관리</Text>
              </View>
              <MaterialIcons name="chevron-right" size={18} color={THEME.muted} />
            </Pressable>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>알림 설정</Text>
          <View style={styles.row}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <MaterialIcons name="wb-sunny" size={16} color={THEME.brand} />
              <Text style={styles.rowLabel}>점심 메뉴 추천</Text>
            </View>
            <Switch
              value={lunchEnabled}
              onValueChange={(v) => {
                setLunchEnabled(v);
                updatePreference(v, dinnerEnabled, dealEnabled);
              }}
              trackColor={{ false: THEME.border, true: THEME.brand }}
              thumbColor="#fff"
            />
          </View>
          <View style={[styles.row, { borderTopWidth: 1, borderTopColor: THEME.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <MaterialIcons name="nights-stay" size={16} color={THEME.brand} />
              <Text style={styles.rowLabel}>저녁 메뉴 추천</Text>
            </View>
            <Switch
              value={dinnerEnabled}
              onValueChange={(v) => {
                setDinnerEnabled(v);
                updatePreference(lunchEnabled, v, dealEnabled);
              }}
              trackColor={{ false: THEME.border, true: THEME.brand }}
              thumbColor="#fff"
            />
          </View>
          <View style={[styles.row, { borderTopWidth: 1, borderTopColor: THEME.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <MaterialIcons name="local-offer" size={16} color={THEME.brand} />
              <Text style={styles.rowLabel}>특가 알림</Text>
            </View>
            <Switch
              value={dealEnabled}
              onValueChange={(v) => {
                setDealEnabled(v);
                updatePreference(lunchEnabled, dinnerEnabled, v);
              }}
              trackColor={{ false: THEME.border, true: THEME.brand }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>기능</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>레시피 데이터</Text>
            <Text style={styles.rowValue}>식품의약품안전처 COOKRCP01</Text>
          </View>
          <View style={[styles.row, { borderTopWidth: 1, borderTopColor: THEME.border }]}>
            <Text style={styles.rowLabel}>블로그 검색</Text>
            <Text style={styles.rowValue}>네이버 블로그 API</Text>
          </View>
          <View style={[styles.row, { borderTopWidth: 1, borderTopColor: THEME.border }]}>
            <Text style={styles.rowLabel}>OCR</Text>
            <Text style={styles.rowValue}>Gemini API</Text>
          </View>
        </View>
      </View>
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
  headerTitle: {
    flex: 1, textAlign: "center",
    fontSize: 17, fontWeight: "900", color: THEME.text,
  },
  section: {
    backgroundColor: "rgba(255,255,255,0.88)",
    borderRadius: 16, borderWidth: 1, borderColor: THEME.border,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 12, fontWeight: "900", color: THEME.muted,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  rowLabel: { fontSize: 14, fontWeight: "700", color: THEME.text },
  rowValue: { fontSize: 13, color: THEME.muted },
};
