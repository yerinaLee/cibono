import { useRouter } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";

const THEME = {
  bg: "#F3F8F1",
  text: "#1F2937",
  muted: "#6B7280",
  border: "rgba(31,41,55,0.10)",
  brand: "#7FB77E",
  brandInk: "#0F1F16",
};

type Props = {
  title: string;
  subtitle?: string;
  rightExtra?: React.ReactNode;
};

export default function AppHeader({ title, subtitle, rightExtra }: Props) {
  const router = useRouter();

  return (
    <View style={styles.topbar}>
      <View style={{ flex: 1 }}>
        <Text style={styles.h2}>{title}</Text>
        {!!subtitle && <Text style={styles.sub}>{subtitle}</Text>}
      </View>

      <View style={styles.rightRow}>
        {rightExtra}

        <Pressable
          onPress={() => router.push("/shopping-list")}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.8 }]}
          accessibilityLabel="쇼핑리스트"
        >
          <Text style={styles.iconText}>🛒</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/settings")}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.8 }]}
          accessibilityLabel="설정"
        >
          <Text style={styles.iconText}>⚙️</Text>
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
    paddingTop: 10,
    paddingBottom: 4,
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
  iconText: { fontSize: 16 },
};
