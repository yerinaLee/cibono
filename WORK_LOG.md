# Cibono 프로젝트 작업 로그

> AI 대화 간 컨텍스트 공유용. 굵직한 작업 흐름만 기록.
> 업데이트: 2026-06-08 (3차)

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

### 레시피 추천 — 공공 API 전환 (2026-06-08)

#### 백엔드
- **만개의레시피 크롤러 제거** (`RecipeCrawlerService.java` 삭제)
- **식품의약품안전처 COOKRCP01 API 연결** (`FoodSafetyApiService.java` 신규)
  - 재료명 키워드 검색 (`RCP_PARTS_DTLS`), 레시피명 상세 조회 (`RCP_NM`)
  - 동시 접속 차단 문제 해결 → `CompletableFuture` 병렬 → `for` 순차 호출로 변경
  - HTML/XML 응답(API 한도 초과 시) 감지 후 빈 결과 반환
  - 상세 로그: 검색 재료, 건수, 레시피명 출력
- **네이버 블로그 검색 API 연결** (`NaverBlogService.java` 신규)
  - 검색 결과 DB 영구 저장 (TTL 없음, 공유 캐시)
  - 역직렬화 실패(구버전 포맷) 시 자동 재수집
  - Jsoup으로 블로그 OG 이미지 추출 (`og:image` → `twitter:image` 순)
- **RecipeController** — 엔드포인트 추가
  - `GET /recipes/crawl` → 식약처 상세 조회
  - `GET /recipes/crawl-bulk` → 재료 복수 검색 (병합)
  - `GET /recipes/search-by-ingredient` → 재료 단일 검색
  - `GET /recipes/naver-blog` → 블로그 검색 (DB 캐시)
- **RecipeDto** — `RecipeCard`에 `ingredients` 추가, `BlogItem`에 `imageUrl` 추가
- **BlogSearchCache** 도메인/리포지토리/DB 테이블 추가

#### 프론트
- **recommend.tsx** — 공공 레시피 섹션 UI 전면 개편
  - 재료별 개별 섹션: `임박재료 {재료명} 가 들어가는 레시피`
  - 식약처 API 동시 접속 문제 해결 → 병렬 `forEach` → 순차 `for await`
  - 가로 스크롤 `nestedScrollEnabled` 추가 (Android 제스처 충돌 해결)
  - 레시피 카드에 기본 재료 최대 4개 표시
- **recipe-detail.tsx** — 블로그 레시피 섹션 추가
  - 블로그 OG 이미지 72×72 썸네일 표시
  - `Linking.openURL(blog.link)` 으로 외부 브라우저 열기

### DB 스키마 개편 — ingredient 테이블 분리 (2026-06-08)

- **ingredient 테이블 신규 생성**: `id BIGSERIAL PK`, `name VARCHAR(200) UNIQUE (ingredient_name_uk)`
- **recipe_ingredient 재구성**: `ingredient_name VARCHAR` 컬럼 → `ingredient_id BIGINT FK` 로 변경 (M:N 조인 테이블)
- `sql/migrate_ingredient.sql` — 기존 DB 1회 수동 적용용 마이그레이션 스크립트
- **Recipe.java** — `@ElementCollection(ingredient_name)` → `@ManyToMany via ingredient_id`
  - `getIngredients()` 는 여전히 `List<String>` 반환 (내부 매핑) → RecipeService 수정 없음
- **Ingredient.java** 신규 엔티티
- **Flyway 비활성화** — `spring.flyway.enabled=false`, `spring.jpa.hibernate.ddl-auto=update`
- **data.sql 전면 정리** — 3개 분산된 INSERT 문을 각각 1개로 통합, 재료명 중복 제거

---

## 현재 진행 중

- [ ] 식약처 API 배치 수집 or 레시피 데이터셋 대량 추가
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
| DB | PostgreSQL, schema.sql / data.sql 수동 적용 |
| OCR | Gemini API |
| 외부 API | 식품의약품안전처 COOKRCP01, 네이버 블로그 검색 |
| API 통신 | REST, Axios (`src/api/client.ts`) |
