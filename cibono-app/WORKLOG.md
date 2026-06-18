# Cibono App — Work Log

---

## 세션 1 (이전)

### 대시보드 리디자인
- 메인 화면 전체 UI 개편 (카드 기반 레이아웃)
- 임박 재료 카드, 냉장고 재료 카드, 추천 요리 카드 구성

### 헤더 고정
- 홈, 추천, 쇼핑리스트, 저장된레시피 탭 모두 스크롤 시 헤더 고정
- `SafeAreaView edges={["bottom","left","right"]}` + 헤더를 ScrollView/FlatList 바깥으로 분리

### 추천 탭 헤더
- 검색창 + 필터 패널까지 헤더에 포함하여 고정 처리

### 쇼핑리스트 개선
- 추가 버튼을 헤더 우측 `+` 원형 버튼으로 변경 (냉장고 탭 스타일)
- 검색 기능 추가 (검색창 헤더 하단 고정)

### 냉장고(Inventory) 개선
- 재료 추가 모달: 품목명 비어있거나 커서 올려놨을 때만 자주 쓰는 재료 표시
- 식재료 분류 칩: 가로 스크롤 → flexWrap으로 변경 (모달 내)
- 카테고리 필터 오른쪽 페이드 블러 제거

### 대시보드 냉장고 재료 카드
- 식재료 분류별 그룹핑, 분류당 3개 유통기한 임박순 정렬
- 임박 재료에 이미 포함된 항목 제외
- `+` 버튼 추가 → 재료 추가 모달 오픈
- 전체 보기 링크 우측 하단으로 이동

### 대시보드 추천 요리 카드
- 전체 추천 보기 링크 우측 하단으로 이동 (전체 보기와 동일 스타일)

### 공통 재료 추가 모달 컴포넌트
- `components/AddInventoryModal.tsx` 신규 생성
- 대시보드와 냉장고 탭이 동일한 재료 추가 화면 공유
- 자체적으로 카테고리/인벤토리 API 호출, 상태 관리 포함

---

## 세션 2 (현재)

### 대시보드 냉장고 재료 카테고리 이모티콘
- 카테고리명 앞에 이모티콘 추가
  - 채소/과일 🥬 / 육류/계란 🥩 / 해산물 🐟 / 우유/유제품 🥛 / 밀키트 🍱 / 기타 📦 / 미분류 🧺
- `categoryIcon()` 함수 dashboard.tsx에 추가

### 메인 헤더 로고 애니메이션
- `expo-video` 설치 (`npx expo install expo-video`)
- `AppHeader` 제거 → VideoView 기반 커스텀 헤더로 교체
- ffmpeg로 `.mov` (argb 알파채널) + `#F3F8F1` 배경색 합성 → `cibono_logo.mp4` 생성
- 헤더 좌측: 로고 영상 재생 (loop, muted)
- 헤더 우측: 저장된레시피 / 쇼핑리스트 / 설정 아이콘 버튼 유지

#### ffmpeg 합성 명령어 (참고)
```bash
ffmpeg \
  -f lavfi -i "color=c=#F3F8F1:size=1280x720:rate=24" \
  -i cibono_logo_transparent.mov \
  -filter_complex "[0:v][1:v]overlay=0:0:shortest=1" \
  -c:v libx264 -pix_fmt yuv420p \
  cibono_logo.mp4
```

#### 미완료 — 로고 텍스트 색상
- 영상 내 "Cibono" 텍스트가 흰색이라 잘 안 보임
- 원본 디자인 파일에서 텍스트 색을 짙은 녹색으로 변경 후 `.mov` 재export 필요
- 재export 후 위 ffmpeg 명령어로 재합성 예정
