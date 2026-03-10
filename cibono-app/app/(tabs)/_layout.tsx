import { Tabs } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  SafeAreaView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

const THEME = {
  bg: "#FDFCF9", // app.css --bg :contentReference[oaicite:3]{index=3}
  chrome: "rgba(253,252,249,.88)", // sidebar/topbar 느낌 :contentReference[oaicite:4]{index=4}
  surface: "rgba(255,255,255,.92)",
  text: "#1C1F1D",
  muted: "rgba(22,25,24,.52)",
  line: "rgba(28,31,29,.07)",
  sage: "#90B890",
  sageDeep: "#6A9A72",
  sageInk: "#1D3323",
  pillBg: "rgba(22,25,24,.05)",
};

type RouteName =
  | "dashboard"
  | "deals"
  | "alerts"
  | "alerts_rules"
  | "inventory"
  | "recommend";

const NAV: {
  name: RouteName;
  label: string;
  icon: string; // 이모지로 간단히 (원하면 나중에 svg/icon으로 교체)
}[] = [
  { name: "dashboard", label: "홈", icon: "🍃" },
  { name: "deals", label: "특가", icon: "🏷️" },
  { name: "alerts", label: "알림", icon: "🔔" },
  { name: "inventory", label: "냉장고", icon: "🧊" },
  { name: "recommend", label: "추천", icon: "👨‍🍳" },
  // Alert Rules는 사이드바에만 보이게(HTML도 그런 느낌)
  { name: "alerts_rules", label: "규칙", icon: "🧷" },
];

function Brand() {
  return (
    <View style={styles.brand}>
      <View style={styles.logoMark}>
        <Text style={{ fontSize: 18 }}>🍃</Text>
      </View>
      <View>
        <Text style={styles.brandTitle}>Cibono</Text>
        <Text style={styles.brandSub}>식재료 · 특가 · 추천</Text>
      </View>
    </View>
  );
}

/**
 * HTML의 사이드바/바텀바를 Expo Tabs의 custom tabBar로 구현
 * - width >= 900: Sidebar
 * - else: Bottom pill bar
 */
function ResponsiveTabBar({ state, descriptors, navigation }: any) {
  const { width } = useWindowDimensions();
  const isWide = width >= 900; // 웹/데스크탑 기준

  const currentRoute = state.routes[state.index]?.name as RouteName;

  // Alert Rules는 모바일 바텀바에서 숨김 (HTML도 모바일에선 보통 5개만)
  const visibleNav = isWide
    ? NAV
    : NAV.filter((x) => x.name !== "alerts_rules");

  // 뱃지는 일단 “옵션 기반”으로만 표시 가능:
  // ex) <Tabs.Screen name="deals" options={{ tabBarBadge: 8 }} />
  // 현재는 UI 통일이 목적이라 값 없으면 숨김
  const getBadge = (routeName: string) => {
    const route = state.routes.find((r: any) => r.name === routeName);
    if (!route) return undefined;
    const opt = descriptors[route.key]?.options;
    return opt?.tabBarBadge;
  };

  if (isWide) {
    // ===== Sidebar (HTML style) ===== :contentReference[oaicite:5]{index=5}
    return (
      <SafeAreaView style={styles.sidebarWrap}>
        <Brand />
        <View style={styles.nav}>
          {visibleNav.map((item) => {
            const focused = currentRoute === item.name;
            const badge = getBadge(item.name);

            return (
              <Pressable
                key={item.name}
                onPress={() => navigation.navigate(item.name)}
                style={({ pressed }) => [
                  styles.navItem,
                  focused && styles.navItemActive,
                  pressed && { opacity: 0.9 },
                ]}
              >
                {/* active bar */}
                {focused ? <View style={styles.activeBar} /> : null}

                <Text style={[styles.navIcon, focused && { opacity: 1 }]}>
                  {item.icon}
                </Text>
                <Text
                  style={[styles.navText, focused && { color: THEME.sageInk }]}
                >
                  {item.label}
                </Text>

                {/* HTML pill */}
                {typeof badge === "number" ? (
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>{badge}</Text>
                  </View>
                ) : item.name === "dashboard" ? (
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>Today</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    );
  }

  // ===== Bottom pill nav (HTML style) =====
  // 스샷처럼 둥근 바 + 아이콘 + 라벨 :contentReference[oaicite:6]{index=6}
  return (
    <SafeAreaView style={styles.bottomWrap}>
      <View style={styles.bottomBar}>
        {visibleNav.map((item) => {
          const focused = currentRoute === item.name;
          const badge = getBadge(item.name);

          return (
            <Pressable
              key={item.name}
              onPress={() => navigation.navigate(item.name)}
              style={({ pressed }) => [
                styles.bottomItem,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text
                style={[
                  styles.bottomIcon,
                  focused && { color: THEME.sageDeep },
                ]}
              >
                {item.icon}
              </Text>
              <Text
                style={[
                  styles.bottomLabel,
                  focused && { color: THEME.sageInk },
                ]}
              >
                {item.label}
              </Text>

              {typeof badge === "number" && badge > 0 ? (
                <View style={styles.bottomBadge}>
                  <Text style={styles.bottomBadgeText}>
                    {badge > 99 ? "99+" : badge}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="dashboard"
      tabBar={(props) => <ResponsiveTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ title: "홈", tabBarBadge: undefined }}
      />
      <Tabs.Screen
        name="deals"
        options={{ title: "특가", tabBarBadge: undefined }}
      />
      <Tabs.Screen
        name="alerts"
        options={{ title: "알림", tabBarBadge: undefined }}
      />
      <Tabs.Screen
        name="alerts_rules"
        options={{ title: "규칙", tabBarBadge: undefined }}
      />
      <Tabs.Screen
        name="inventory"
        options={{ title: "냉장고", tabBarBadge: undefined }}
      />
      <Tabs.Screen
        name="recommend"
        options={{ title: "추천", tabBarBadge: undefined }}
      />
    </Tabs>
  );
}

const styles: any = {
  // ===== Sidebar =====
  sidebarWrap: {
    width: 268,
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,.55)",
    backgroundColor: THEME.chrome,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 16,
    ...(Platform.OS === "web"
      ? { position: "fixed", left: 0, top: 0, bottom: 0 }
      : {}),
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 8,
    paddingBottom: 14,
  },
  logoMark: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "rgba(200,223,198,.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: { fontSize: 16.5, fontWeight: "900", color: "#161918" },
  brandSub: {
    marginTop: 2,
    fontSize: 11,
    color: THEME.muted,
    fontWeight: "600",
  },

  nav: { marginTop: 6, gap: 4 },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
    position: "relative",
  },
  navItemActive: {
    backgroundColor: "rgba(144,184,144,.13)",
    borderColor: "rgba(144,184,144,.22)",
  },
  activeBar: {
    position: "absolute",
    left: 0,
    top: "20%",
    bottom: "20%",
    width: 3,
    borderRadius: 999,
    backgroundColor: THEME.sageDeep,
  },
  navIcon: { width: 20, textAlign: "center", opacity: 0.7 },
  navText: { fontSize: 13.5, fontWeight: "800", color: "rgba(22,25,24,.65)" },
  pill: {
    marginLeft: "auto",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: THEME.pillBg,
    borderWidth: 1,
    borderColor: "rgba(22,25,24,.07)",
  },
  pillText: { fontSize: 11, fontWeight: "900", color: THEME.muted },

  // ===== Bottom pill bar =====
  bottomWrap: {
    backgroundColor: "transparent",
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 10,
    paddingHorizontal: 14,
  },
  bottomBar: {
    height: 64,
    borderRadius: 18,
    backgroundColor: "rgba(253,252,249,.92)",
    borderWidth: 1,
    borderColor: "rgba(28,31,29,.07)",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 10,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  bottomItem: {
    width: 64,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    position: "relative",
  },
  bottomIcon: { fontSize: 18, color: "rgba(22,25,24,.55)" },
  bottomLabel: { fontSize: 11, fontWeight: "800", color: "rgba(22,25,24,.55)" },
  bottomBadge: {
    position: "absolute",
    right: 6,
    top: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(201,96,96,.92)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  bottomBadgeText: { color: "#fff", fontSize: 10, fontWeight: "900" },
};
