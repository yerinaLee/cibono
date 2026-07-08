import { useCallback, useRef, useState } from "react";
import type { FlatList, NativeScrollEvent, NativeSyntheticEvent } from "react-native";

const SCROLL_TOP_THRESHOLD = 300;

/**
 * 리스트 스크롤 위치에 따라 "맨 위로" FAB 표시 여부를 관리하고,
 * 맨 위로 스크롤하는 동작을 제공하는 공용 훅.
 *
 * 사용:
 *   const { listRef, showScrollTop, handleScroll, scrollToTop } = useScrollTop();
 *   <FlatList ref={listRef} onScroll={handleScroll} scrollEventThrottle={16} ... />
 *   <ScrollTopButton visible={showScrollTop} onPress={scrollToTop} />
 */
export function useScrollTop() {
  const listRef = useRef<FlatList<any>>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setShowScrollTop(e.nativeEvent.contentOffset.y > SCROLL_TOP_THRESHOLD);
  }, []);

  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  return { listRef, showScrollTop, handleScroll, scrollToTop };
}
