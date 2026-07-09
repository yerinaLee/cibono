# Cibono App (Frontend)

냉장고 재고 관리 · 유통기한 알림 · 마트 행사/레시피 추천을 제공하는 **Cibono** 서비스의 모바일 앱입니다.
[Expo](https://expo.dev) 기반 React Native + TypeScript, [Expo Router](https://docs.expo.dev/router/introduction/)로 화면을 구성합니다.

> 프로젝트 전체 소개(백엔드/ML 포함)는 저장소 루트의 [README](../README.md)를 참고하세요.

## 실행

```bash
npm install
npm start          # Expo 개발 서버 (a: Android, w: Web)
```

Android 실기기/에뮬레이터에서 푸시 알림 등 네이티브 기능까지 확인하려면 개발 빌드가 필요합니다:

```bash
npx expo run:android
```

## 환경 변수

`.env` 에 API 서버 주소를 지정합니다:

```
EXPO_PUBLIC_API_BASE_URL=https://your-api-host
```

## 구조

```
app/            화면 (Expo Router 파일 기반 라우팅)
  (tabs)/       하단 탭: 대시보드 · 재고 · 추천 · 행사 · 가격알림
  ...           상세/설정/장보기 등 스택 화면
components/     공용 UI 컴포넌트 (AppHeader 등)
src/
  api/client.ts     Firebase 토큰을 자동 첨부하는 axios 인스턴스
  auth/             Firebase 인증
  constants/        스토어 로고 등 상수
hooks/          color scheme 등 훅
```

## 주요 스택

- Expo SDK / React Native / TypeScript
- Expo Router (파일 기반 라우팅)
- Firebase Auth (백엔드 API 호출 시 Bearer 토큰 인증)
- Expo Notifications (점심/저녁 메뉴 추천 푸시)
