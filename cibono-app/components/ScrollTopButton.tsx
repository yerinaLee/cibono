import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { THEME } from "@/src/theme";

type Props = {
  visible: boolean;
  onPress: () => void;
  /** 화면별 위치 미세조정 (예: bottom 오프셋) */
  style?: StyleProp<ViewStyle>;
};

/** 리스트 우하단 "맨 위로" FAB. visible=false 면 렌더링하지 않는다. */
export function ScrollTopButton({ visible, onPress, style }: Props) {
  if (!visible) return null;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.btn, style, pressed && { opacity: 0.85 }]}
      accessibilityLabel="위로 이동"
    >
      <MaterialIcons name="arrow-upward" size={22} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: "absolute",
    right: 16,
    bottom: 110,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.brandInk,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
