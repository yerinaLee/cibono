import BackHeader from "@/components/BackHeader";
import { THEME } from "@/src/theme";
import React from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LicenseScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
      <BackHeader title="라이선스" />

      <ScrollView contentContainerStyle={{ padding: 14, gap: 12 }}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>기능</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>레시피 데이터</Text>
            <Text style={styles.rowValue}>식품의약품안전처 COOKRCP01</Text>
          </View>
          <View
            style={[
              styles.row,
              { borderTopWidth: 1, borderTopColor: THEME.border },
            ]}
          >
            <Text style={styles.rowLabel}>블로그 검색</Text>
            <Text style={styles.rowValue}>네이버 블로그 API</Text>
          </View>
          <View
            style={[
              styles.row,
              { borderTopWidth: 1, borderTopColor: THEME.border },
            ]}
          >
            <Text style={styles.rowLabel}>OCR</Text>
            <Text style={styles.rowValue}>Gemini API</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>오픈소스 라이선스</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>React / React Native</Text>
            <Text style={styles.rowValue}>MIT</Text>
          </View>
          <View
            style={[
              styles.row,
              { borderTopWidth: 1, borderTopColor: THEME.border },
            ]}
          >
            <Text style={styles.rowLabel}>Expo</Text>
            <Text style={styles.rowValue}>MIT</Text>
          </View>
          <View
            style={[
              styles.row,
              { borderTopWidth: 1, borderTopColor: THEME.border },
            ]}
          >
            <Text style={styles.rowLabel}>React Navigation</Text>
            <Text style={styles.rowValue}>MIT</Text>
          </View>
          <View
            style={[
              styles.row,
              { borderTopWidth: 1, borderTopColor: THEME.border },
            ]}
          >
            <Text style={styles.rowLabel}>Axios</Text>
            <Text style={styles.rowValue}>MIT</Text>
          </View>
          <View
            style={[
              styles.row,
              { borderTopWidth: 1, borderTopColor: THEME.border },
            ]}
          >
            <Text style={styles.rowLabel}>TypeScript</Text>
            <Text style={styles.rowValue}>Apache-2.0</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>오픈소스 라이선스 · AI 모델</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Ultralytics YOLO</Text>
            <Text style={styles.rowValue}>AGPL-3.0</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>학습 데이터 출처</Text>
          <Pressable
            onPress={() =>
              Linking.openURL("https://github.com/MahmoudSalah/KORIE#korie")
            }
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
          >
            <Text style={styles.rowLabel}>KORIE (영수증 OCR 데이터셋)</Text>
            <Text style={styles.rowValue}>CC BY 4.0</Text>
          </Pressable>
          <View style={{ paddingHorizontal: 14, paddingBottom: 10 }}>
            <Text style={{ fontSize: 11, color: THEME.muted, lineHeight: 16 }}>
              GitHub: github.com/MahmoudSalah/KORIE{"\n"}
              논문: researchgate.net/publication/399461872
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles: any = {
  section: {
    backgroundColor: "rgba(255,255,255,0.88)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: THEME.muted,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
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
