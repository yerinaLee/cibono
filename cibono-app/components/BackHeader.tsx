import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { THEME } from "@/src/theme";

type Props = {
  /** 문자열 또는 커스텀 노드(색상 강조 등) */
  title: React.ReactNode;
  /** 제목 아래 보조 설명 */
  subtitle?: string;
  /** 우측 액션 슬롯 */
  right?: React.ReactNode;
  /** 기본 동작은 router.back(). 필요 시 커스텀 핸들러 주입 */
  onBack?: () => void;
};

/** 상세/설정 등 비-탭 화면 공용 상단 헤더 (뒤로가기 + 제목/부제 + 우측 액션 슬롯) */
export default function BackHeader({ title, subtitle, right, onBack }: Props) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack ?? (() => router.back())}
        style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
        accessibilityLabel="뒤로"
      >
        <MaterialIcons name="arrow-back" size={22} color={THEME.text} />
      </Pressable>
      <View style={styles.titleWrap}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {right ?? null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: THEME.bg,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  titleWrap: { flex: 1 },
  title: { fontSize: 18, fontWeight: "800", color: THEME.text },
  subtitle: { marginTop: 2, fontSize: 12, color: THEME.muted },
});
