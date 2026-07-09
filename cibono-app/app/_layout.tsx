import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { api } from '../src/api/client';
import { initFirebaseAuth } from '../src/auth/firebaseAuth';

import { useColorScheme } from '@/hooks/use-color-scheme';

// expo-notifications는 네이티브 빌드에서만 동작 — 동적 import로 번들 에러 방지
let Notifications: typeof import('expo-notifications') | null = null;
let Device: typeof import('expo-device') | null = null;
try {
  Notifications = require('expo-notifications');
  Device = require('expo-device');
  Notifications?.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch {
  console.log('[Push] expo-notifications 로드 실패 (개발 환경에서는 정상)');
}

async function registerForPushNotifications(): Promise<string | null> {
  if (!Notifications || !Device) return null;
  if (!Device.isDevice) return null;
  if (Platform.OS !== 'android') return null;

  await Notifications.setNotificationChannelAsync('lunch', {
    name: '점심 메뉴 추천',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#7FB77E',
  });
  await Notifications.setNotificationChannelAsync('dinner', {
    name: '저녁 메뉴 추천',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#7FB77E',
  });

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: '48edf5aa-9e69-4da6-80f2-7c6a387db8d9',
  });
  return tokenData.data;
}

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const handledNotificationIds = useRef(new Set<string>());

  // Firebase 익명 로그인
  useEffect(() => {
    initFirebaseAuth().catch((e) => console.warn('[Auth] Firebase 초기화 실패:', e));
  }, []);

  // 푸시 토큰 등록
  useEffect(() => {
    registerForPushNotifications().then((token) => {
      if (!token) return;
      console.log('[Push] Expo 토큰:', token);
      api.post('/admin/notifications/register-token', { token }).catch((e) =>
        console.warn('[Push] 토큰 등록 실패:', e.message)
      );
    });
  }, []);

  // 알림 탭 → 레시피 화면 / 가격 알림 목록 이동
  useEffect(() => {
    if (!Notifications) return;

    const handleResponse = (response: any) => {
      const id = response.notification.request.identifier;
      if (handledNotificationIds.current.has(id)) return;
      handledNotificationIds.current.add(id);

      const data = response.notification.request.content.data;
      const recipeName = data?.recipeName;
      const dealId = data?.dealId;
      if (recipeName) {
        setTimeout(() => {
          router.push({ pathname: '/recipe-detail', params: { name: String(recipeName) } });
        }, 300);
      } else if (dealId) {
        setTimeout(() => {
          router.push('/(tabs)/alerts');
        }, 300);
      }
    };

    // 앱이 완전히 종료된 상태에서 알림을 탭해 실행된 경우(콜드 스타트) 처리
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleResponse(response);
    });

    const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);

    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="recipe-detail" options={{ headerShown: false }} />
          <Stack.Screen name="admin-notifications" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
          <Stack.Screen name="license" options={{ headerShown: false }} />
          <Stack.Screen name="shopping-list" options={{ headerShown: false }} />
          <Stack.Screen name="saved-recipes" options={{ headerShown: false }} />
          <Stack.Screen name="ingredient-recipes" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
