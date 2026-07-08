import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { THEME } from "@/src/theme";

type Props = {
  title: string;
  subtitle?: string;
  rightExtra?: React.ReactNode;
};

export default function AppHeader({ title, subtitle, rightExtra }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.topbar, { paddingTop: insets.top + 16 }]}>
      <View style={{ flex: 1 , paddingLeft: 6}}>
        <Text style={styles.h2}>{title}</Text>
        {!!subtitle && <Text style={styles.sub}>{subtitle}</Text>}
      </View>

      <View style={styles.rightRow}>
        {rightExtra}

        <Pressable
          onPress={() => router.push("/saved-recipes")}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.8 }]}
          accessibilityLabel="저장된 레시피"
        >
          <MaterialIcons name="bookmark-border" size={20} color={THEME.text} />
        </Pressable>

        <Pressable
          onPress={() => router.push("/shopping-list")}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.8 }]}
          accessibilityLabel="쇼핑리스트"
        >
          <MaterialIcons name="shopping-cart" size={20} color={THEME.text} />
        </Pressable>

        <Pressable
          onPress={() => router.push("/(tabs)/alerts")}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.8 }]}
          accessibilityLabel="알림"
        >
          <MaterialIcons name="notifications-none" size={20} color={THEME.text} />
        </Pressable>

        <Pressable
          onPress={() => router.push("/settings")}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.8 }]}
          accessibilityLabel="설정"
        >
          <MaterialIcons name="settings" size={20} color={THEME.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles: any = {
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 10,
    backgroundColor: "#F3F8F1",
  },
  h2: { fontSize: 22, fontWeight: "800", color: THEME.text },
  sub: { marginTop: 2, fontSize: 12, color: THEME.muted },
  rightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1, borderColor: THEME.border,
  },
};
