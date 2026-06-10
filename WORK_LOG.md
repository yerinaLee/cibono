# Cibono 프로젝트 작업 로그

> AI 대화 간 컨텍스트 공유용. 굵직한 작업 흐름만 기록.
> 업데이트: 2026-06-10 (6차)

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

### UI/UX 개편 + 쇼핑리스트 + 공통 헤더 (2026-06-09)

#### 버그 수정
- **Recommend 시간 필터 오작동** — `snapToPreset()` 이 cookingTime을 버킷으로 스냅해 비교하던 로직 제거 → `cookingTime <= maxMin` 직접 비교로 수정
- **Recommend 카드 클릭 에러** — 비동기 그룹 로드 중 상태 초기화 시 sparse array `undefined` 발생 → stale 업데이트 `idx >= prev.length` 가드 추가

#### Recommend 개선
- **카드 블럭 전체 클릭** — `View` → `Pressable` 로 변경, '보기' 버튼 제거
- **레시피 미리보기 이미지** — `recipe` 테이블에 `image_url VARCHAR(500)` 컬럼 추가
  - `Recipe.java` — `imageUrl` 필드 + `getImageUrl()` 추가
  - `RecipeService.RecipeSuggestion` record에 `imageUrl` 추가
  - 카드 상단에 100px 썸네일 표시 (없으면 빈 영역)
- **검색·필터 툴바** — AppHeader 내부 `rightExtra` → 헤더 아래 독립 라인으로 분리, 필터 활성 시 "초기화" 버튼 표시

#### 쇼핑리스트 신규 기능
- **DB** — `shopping_list` 테이블 (`id, user_id, item_name, quantity, unit, checked, created_at`)
- **백엔드** — `ShoppingListItem.java`, `ShoppingListRepository.java`, `ShoppingListController.java`
  - `GET /shopping-list` — 목록 조회
  - `POST /shopping-list` — 단일 추가
  - `POST /shopping-list/bulk` — 복수 추가 (레시피 재료 일괄)
  - `PATCH /shopping-list/{id}` — 수량·단위 수정
  - `DELETE /shopping-list/{id}` — 삭제
- **`app/shopping-list.tsx`** 신규 화면
  - 목록 조회 / 직접 추가 모달 / 수량·단위 수정 모달 / 삭제
  - 항목에서 수량 영역 탭 → 수정 모달 오픈
- **`recipe-detail.tsx`** — 재료 선택 → 쇼핑리스트 추가
  - 재료 칩 탭으로 선택/해제 (✓ 표시)
  - 1개 이상 선택 시 하단 플로팅 버튼 "🛒 N개 쇼핑리스트에 담기" 표시
  - `POST /shopping-list/bulk` 로 일괄 추가, 성공 시 "✓ 담겼어!" 2초 표시

#### 공통 헤더 (AppHeader)
- **`components/AppHeader.tsx`** 신규 컴포넌트
  - 항상 우측에 🛒(쇼핑리스트) + ⚙️(설정) 버튼 포함
  - `rightExtra` prop으로 화면별 버튼 주입
- **`app/settings.tsx`** 신규 화면 — 앱 버전 v0.1.0, 기술 스택 표시
- dashboard / recommend / inventory 탭에 AppHeader 적용

#### 대시보드 임박 재료 개선
- **임박 재료 아이콘 칩** — 텍스트 나열 → 재료별 🥬 칩 (이름 + D-day 표시)
- **칩 클릭 → 재료 레시피 화면** — `app/ingredient-recipes.tsx` 신규 화면
  - `GET /recipes/search-by-ingredient?ingredient={name}` 호출
  - 레시피 카드 목록 (이미지 + 이름 + 재료) 표시, 탭 시 `recipe-detail`로 이동

#### Inventory 개선
- **검색·필터·스캔 툴바** — AppHeader 내부 → 헤더 아래 독립 라인으로 분리
- AppHeader `rightExtra`에는 "재료 추가" 버튼만 유지

---

### 모바일 APK 테스트 + 버그 수정 + 레시피 저장 기능 (2026-06-10)

#### APK 빌드 환경 세팅
- **ngrok** — 로컬 WiFi 없이 외부에서 백엔드 접속용 터널 구성 (`ngrok http 8080`)
- **EAS Build** — `eas.json` `preview` 프로파일에 `"android": { "buildType": "apk" }` 추가해 AAB → APK로 변경
- **`expo-build-properties`** 플러그인 추가 + `app.json`에 `usesCleartextTraffic: true` 설정
  - Android API 28+ 기본 차단되는 `http://` 이미지 URL(식약처) 허용

#### 모바일(Galaxy S24) 테스트 후 버그 수정

**[헤더 Safe Area]**
- `AppHeader.tsx` — `useSafeAreaInsets` 적용, `paddingTop: insets.top + 6` 동적 계산
- `SafeAreaView` import를 `react-native` → `react-native-safe-area-context`로 전체 교체
  - 대상: `dashboard.tsx`, `recommend.tsx`, `inventory.tsx`, `settings.tsx`, `ingredient-recipes.tsx`
  - 탭 화면: `edges={["bottom", "left", "right"]}` (AppHeader가 top 처리)
  - 비탭 화면: edges 지정 없음 (SafeAreaView가 top 포함 전체 처리)

**[색상 통일]**
- 카드/섹션 배경 `rgba(255,255,255,0.88)` → `#FFFFFF` solid 컬러 전체 교체
  - Android `elevation` 있을 때 반투명 배경이 PC와 다르게 렌더링되는 문제 해결
  - 대상: `dashboard.tsx`, `recommend.tsx`, `ingredient-recipes.tsx`

**[D-Day 버그]**
- `dashboard.tsx` — 만료된 재료가 `D--5` 로 표시되던 버그 수정
  - `d < 0 ? \`D+${Math.abs(d)}\` : \`D-${d}\`` 로 변경

**[쇼핑리스트 수정]**
- `shopping-list.tsx` — 항목 전체 클릭 → 수정 모달 오픈 (기존: 수량 영역만 클릭)
- 수정 모달에 재료명(`editName`) 필드 추가 — 재료명 + 수량 + 단위 모두 수정 가능
- `ShoppingListController.java` `PATCH` — `itemName` 업데이트 지원 추가

**[Recommend]**
- "오늘의 추천" 섹션 최대 8개로 제한 (`filtered.slice(0, 8)`)

#### 레시피 저장(북마크) 기능 신규 추가

**[백엔드]**
- `SavedRecipe.java` 신규 엔티티 — `id, user_id, recipe_name, image_url, source_type, source_url, ingredients, created_at`
  - `UNIQUE (user_id, recipe_name)` 제약으로 중복 저장 방지
- `SavedRecipeRepository.java` 신규 — 키워드 검색 쿼리 포함
- `SavedRecipeController.java` 신규
  - `GET /saved-recipes?q=...` — 목록 조회 (레시피명 + 재료 키워드 검색)
  - `GET /saved-recipes/exists?name=...` — 저장 여부 확인 (`{"saved": true/false}`)
  - `POST /saved-recipes` — 저장 (이미 있으면 기존 반환, idempotent)
  - `DELETE /saved-recipes/by-name?name=...` — 이름으로 삭제
  - `DELETE /saved-recipes/{id}` — ID로 삭제
- `sql/schema.sql` — `saved_recipe` 테이블 정의 추가 (14번)
  - JPA `ddl-auto=update`로 런타임에도 자동 생성됨

**[프론트]**
- `recipe-detail.tsx` — 상단 우측에 📌 저장 토글 버튼 추가
  - 진입 시 `GET /saved-recipes/exists` 로 저장 여부 확인
  - 🔖(미저장) / 📌(저장됨) 상태 표시 및 토글
- `AppHeader.tsx` — 우측 버튼에 📌 버튼 추가 → `/saved-recipes` 이동
  - 버튼 순서: `rightExtra` → 📌 → 🛒 → ⚙️
- `app/saved-recipes.tsx` 신규 화면
  - 저장된 레시피 목록 + 검색 (레시피명/재료 키워드)
  - 식약처/블로그 태그 표시, 삭제 버튼, 항목 탭 시 `recipe-detail`로 이동

---

### UI 고도화 + 버그 수정 (2026-06-10, 6차)

#### recipe-detail.tsx — 조리 순서 복원 + 블로그 저장 개선
- **조리 순서(steps) 섹션 복원** — 이전 편집에서 JSX `)}` 누락으로 삭제된 "조리 순서" 섹션 재추가
  - `detail.steps.length > 0` 조건부 렌더링
  - 번호 원형 뱃지(`stepNum`) + 본문 텍스트(`stepText`) 레이아웃
  - 스타일 추가: `stepRow`, `stepNum`, `stepNumText`, `stepText`
- **블로그 저장 후 클릭 → 직접 연동** — 이 작업은 `saved-recipes.tsx`에서 처리 (아래 참조)

#### saved-recipes.tsx — 전면 개편
- `SavedRecipe` 타입에 `sourceUrl?: string | null` 추가
- **Swipeable 스와이프 삭제** — `react-native-gesture-handler` `Swipeable` 적용
  - 왼쪽으로 스와이프 → 빨간 삭제 액션(`MaterialIcons delete` 아이콘 + "삭제" 텍스트) 표시
  - `openSwipeRef`로 동시에 열린 swipe row 방지
- **인라인 삭제 버튼 제거** — 기존 행 우측 "삭제" 버튼 삭제
- **클릭 분기 처리**
  - `BLOG` 타입 → `Linking.openURL(item.sourceUrl)` 로 저장된 특정 블로그 글 직접 열기
  - `FOOD_SAFETY` 타입 → `router.push("/recipe-detail", { name })` 로 레시피 상세 이동
- **BLOG 태그 옆 "바로 열기" 태그** 추가 (외부 링크 표시)
- 아이콘 전체 MaterialIcons 교체 (← 뒤로가기 → `arrow-back`, ⌕ 검색 → `search`, × → `close`)

#### dashboard.tsx — 추천 요리 임박재료 우선순위 정렬
- `sortedReco` useMemo 추가
  - `urgent` 목록의 `itemName` Set과 각 Suggestion의 `ingredients` 배열을 교차 비교
  - 임박 재료가 많이 포함된 레시피 순으로 내림차순 정렬
- 추천 요리 그리드를 `reco.slice(0,4)` → `sortedReco.slice(0,4)` 로 변경

#### _layout.tsx (탭 바) — 아이콘 MaterialIcons 교체
- `@expo/vector-icons` `MaterialIcons` 임포트 추가
- NAV 배열 타입: `icon: string` (이모지) → `icon: IconName` (MaterialIcons)
- 아이콘 매핑:
  - `dashboard` 🍃 → `home`
  - `deals` 🏷️ → `local-offer`
  - `alerts` 🔔 → `notifications`
  - `inventory` 🧊 → `kitchen`
  - `recommend` 👨‍🍳 → `restaurant`
  - `alerts_rules` 🧷 → `rule`
- 사이드바 / 바텀바 렌더링에서 `<Text>{item.icon}</Text>` → `<MaterialIcons name={item.icon} size={...} color={...} />` 로 교체
- 포커스 상태에 따라 색상 동적 적용 (`sageDeep` vs 기본 muted)

#### AppHeader.tsx — 저장 아이콘 통일
- 저장된 레시피 버튼 아이콘: `push-pin` → `bookmark-border` (recipe-detail.tsx 저장 아이콘과 동일)

---

## 현재 진행 중

- [ ] 새 APK 빌드 후 핸드폰에 설치 (`npx eas-cli build -p android --profile preview`)
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
