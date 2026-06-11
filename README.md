# 🥦 Cibono

> **냉장고 속 재료로 오늘 뭐 먹을지 고민 끝.**  
> 식재료 관리 · 레시피 추천 · 특가 알림을 하나의 앱으로.

<br>

## 📱 주요 기능

| 기능 | 설명 |
|------|------|
| **냉장고 관리** | 식재료 등록·수정·삭제, 유통기한 추적, 냉장/냉동/실온 구분 |
| **영수증 스캔** | 카메라로 영수증 촬영 → OCR + AI 파싱으로 재료 자동 등록 |
| **레시피 추천** | 보유 재료 기반 맞춤 레시피 추천 (식약처 DB + 네이버 블로그) |
| **특가 알림** | 원하는 식재료의 가격 기준 설정 → 조건 충족 시 알림 |
| **쇼핑 리스트** | 필요한 재료 목록 관리 |
| **레시피 즐겨찾기** | 마음에 드는 레시피 저장 및 검색 |

<br>

## 🛠 기술 스택

### Frontend
- **React Native** 0.81 + **Expo** 54 (Android · iOS · Web)
- **TypeScript** 5.9
- **Expo Router** (파일 기반 라우팅)
- **Axios** (API 통신)
- **Tesseract.js** (영수증 OCR)
- **React Native Reanimated** (애니메이션)

### Backend
- **Spring Boot** 3.5 + **Java** 17
- **Spring Data JPA** + **PostgreSQL** 16
- **Spring Security**
- **Google Gemini API** (AI 영수증 파싱 · 레시피 추천)
- **Tesseract OCR** (서버 사이드 이미지 처리)
- **JSoup** (식약처 · 네이버 블로그 스크래핑)
- **Gradle**

<br>

## 🗂 프로젝트 구조

```
cibono/
├── cibono-app/              # React Native (Expo) 앱
│   ├── app/
│   │   ├── (tabs)/          # 메인 탭 화면 (대시보드, 냉장고, 추천, 알림, 특가)
│   │   └── _layout.tsx
│   ├── src/api/             # Axios 클라이언트
│   ├── components/          # 공통 UI 컴포넌트
│   ├── assets/images/       # 아이콘, 이미지
│   └── app.json
│
└── cibono-api/              # Spring Boot API 서버
    └── src/main/java/com/cibono/cibono_api/
        ├── web/             # REST 컨트롤러
        ├── service/         # 비즈니스 로직
        ├── domain/          # JPA 엔티티
        ├── repository/      # 데이터 접근
        └── common/          # 설정, 유틸
```

<br>

## ⚙️ 시작하기

### 사전 준비
- Node.js 18+
- Java 17+
- PostgreSQL 16+
- Tesseract OCR 설치
- Google Gemini API 키

---

### 백엔드 실행

**1. 데이터베이스 생성**
```sql
CREATE DATABASE fridge;
CREATE USER fridge WITH PASSWORD 'fridge';
GRANT ALL PRIVILEGES ON DATABASE fridge TO fridge;
```

**2. 환경 설정**  
`cibono-api/src/main/resources/application-secret.properties` 파일 생성:
```properties
gemini.api.key=YOUR_GEMINI_API_KEY
```

**3. 서버 실행**
```bash
cd cibono-api
./gradlew bootRun
```
> 기본 포트: `http://localhost:8080`

---

### 프론트엔드 실행

**1. 패키지 설치**
```bash
cd cibono-app
npm install
```

**2. 환경 설정**  
`.env` 파일 생성:
```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:8080
```

**3. 앱 실행**
```bash
npx expo start
```
> Android: `a` / iOS: `i` / Web: `w`

<br>

## 🔌 주요 API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/inventory` | 식재료 목록 조회 |
| `POST` | `/inventory/scan` | 영수증 이미지 OCR 스캔 |
| `POST` | `/inventory/bulk` | 재료 일괄 등록 |
| `GET` | `/recommendations/today` | 오늘의 레시피 추천 |
| `GET` | `/recipes/search-by-ingredient` | 재료로 레시피 검색 |
| `GET` | `/deals` | 특가 목록 조회 |
| `GET` | `/alert-rules` | 가격 알림 규칙 목록 |
| `GET` | `/alerts` | 알림 이벤트 목록 |
| `GET` | `/shopping-list` | 쇼핑 리스트 조회 |
| `GET` | `/saved-recipes` | 즐겨찾기 레시피 목록 |

<br>

## 📸 스크린샷

> 추가 예정

<br>

## 📄 라이선스

This project is for personal/educational use.
