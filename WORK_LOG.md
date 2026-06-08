# Cibono 프로젝트 작업 로그

> AI 대화 간 컨텍스트 공유용. 굵직한 작업 흐름만 기록.
> 업데이트: 2026-06-08 (2차)

---

## 프로젝트 개요

- **앱 이름**: Cibono
- **구성**: React Native (Expo) 프론트 + Spring Boot 백엔드
- **주요 기능**: 식재료 인벤토리 관리, 레시피 추천, 영수증 OCR

---

## 완료된 작업

### 초기 세팅
- Spring Boot 프로젝트 초기화, port 8080 설정
- Spring Security 임시 해제, CORS 설정
- Expo 기반 React Native 앱 뼈대 구성

### 인벤토리 (Inventory)
- 식재료 CRUD 구현 (백엔드 API + 프론트 연동)
- 유통기한 필드 추가
- 재료 수정 모달 추가 (수량/단위/보관위치/유통기한, `PATCH /inventory/{id}`)
- 정렬(Sort) 기능 추가
- **식재료 카테고리(food_category) 테이블 신규 생성** — 채소/과일, 육류/계란, 해산물, 우유/유제품, 밀키트, 기타
  - inventory에 `category_id` FK, `is_favorite` 컬럼 추가
  - `GET /food-categories` 엔드포인트 추가
  - `GET /inventory` 응답에 `categoryId`, `categoryName`, `favorite` 포함
- **인벤토리 리스트 디자인 변경** — 3열 그리드 → 1열 리스트, 카테고리 아이콘(`@expo/vector-icons` Ionicons) 표시
- **즐겨찾기(★) 기능** — 카드 D-Day 옆 별 아이콘, 즐겨찾기 항목 정렬 기준 무관하게 맨 위 고정
- **유통기한 임박 배너** — D-3 이하 재료 감지 시 상단 노란 배너, ✕ 닫기 (새로고침 시 리셋)

### 레시피 추천 (Recommend)
- 하드코딩 버전 레시피 추천 구현 후 → DB 기반으로 전환
- 조리 시간 필터 구현 (백엔드 `cookingTime` 필드 추가 + 프론트 필터 로직 연동)
- recipe 관련 SQL 스키마/시드 데이터 추가

### 영수증 OCR (Inventory)
- Tesseract.js로 시작 → **Gemini API**로 교체 (정확도 향상)
- 백엔드/프론트 모두 적용, 현재 정확도 개선 진행 중

### 디자인
- HTML 프로토타입 디자인 (V1 → 최종)
- 프론트 앱에 디자인 적용

### DB / SQL
- 공통 SQL 파일 (`schema.sql`, `data.sql`) 추가 및 정리

---

## 현재 진행 중

- [ ] 영수증 OCR 정확도 높이기 (Gemini API 프롬프트 튜닝)

---

## 브랜치 구조 (참고)

- `main`: 메인
- `branch/yeri`: 현재 작업 브랜치

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트 | React Native (Expo), TypeScript |
| 백엔드 | Spring Boot, Java |
| DB | SQL (schema.sql / data.sql) |
| OCR | Gemini API |
| API 통신 | REST, Axios (`src/api/client.ts`) |
