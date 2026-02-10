-- ============================================================
-- V1__init.sql (설명용 주석 포함)
-- 목적:
-- 1) 유저(계정)
-- 2) 어디서 샀는지(마트/스토어)
-- 3) 내가 산 기록(구매/기준가)
-- 4) 냉장고에 들어있는 재고(유통기한 포함)
-- 5) 마트 특가/세일 정보(딜)
-- 6) 내 기준가 대비 특가 알림 설정(알림 규칙)
-- 7) 실제로 알림이 발생한 기록(알림 이벤트)
-- ============================================================


-- ---------------------------
-- 1) 사용자 계정 테이블
-- ---------------------------
create table app_user (
                          id bigserial primary key,                -- 사용자 PK
                          email varchar(255) not null unique,       -- 로그인 ID(이메일). 중복 불가
                          password_hash varchar(255) not null,      -- 비밀번호 해시(평문 저장 금지)
                          created_at timestamptz not null default now()  -- 가입 시각
);

-- 사용처:
-- - 로그인/회원가입
-- - 모든 데이터(구매, 재고, 알림)는 user_id로 누구 데이터인지 구분


-- ---------------------------
-- 2) 마트/스토어 테이블
-- ---------------------------
create table store (
                       id bigserial primary key,                -- 스토어 PK
                       name varchar(100) not null,              -- 마트 이름 (예: 이마트, 홈플러스, 동네마트A)
                       region varchar(100)                      -- 지역/지점 정보 (예: "서울 강남", "성수점")
);

-- 사용처:
-- - "내 주변 마트 선택" 기능을 위해 필요
-- - deal(특가)가 어느 마트에서 나온 건지 연결


-- ---------------------------
-- 3) 구매 기록 테이블 (내가 언제, 얼마에 샀는지)
-- ---------------------------
create table purchase (
                          id bigserial primary key,                -- 구매 기록 PK
                          user_id bigint not null references app_user(id),  -- 누가 샀는지(필수)
                          item_name varchar(200) not null,          -- 품목명 (예: "우유", "대파", "삼겹살")
                          price integer not null,                   -- 그때 산 가격(원) (기준가로 활용 가능)
                          quantity numeric(10,2) not null default 1,-- 수량(예: 1, 2.5 등)
                          unit varchar(20),                         -- 단위(예: "개", "g", "ml" 등)
                          store_id bigint references store(id),     -- 어디서 샀는지(선택)
                          purchased_at date not null default current_date, -- 구매일
                          created_at timestamptz not null default now()     -- 기록 생성 시각
);

-- 사용처:
-- - “내가 샀던 가격(기준가)”의 원본 데이터가 여기서 나옴
-- - 나중에 "가격 추이" 같은 기능도 purchase로 만들 수 있음

-- 참고:
-- - 지금은 item_name을 문자열로 두었는데, 추후에 품목 마스터(item) 테이블을 추가해서
--   표준화(동의어/브랜드/바코드)할 수도 있음. MVP는 문자열이 가장 빨라.


-- ---------------------------
-- 4) 냉장고 재고 테이블 (현재 집에 있는 것)
-- ---------------------------
create table inventory (
                           id bigserial primary key,                -- 재고 PK
                           user_id bigint not null references app_user(id), -- 누구 냉장고인지
                           item_name varchar(200) not null,          -- 품목명
                           quantity numeric(10,2) not null default 1,-- 현재 남은 수량
                           unit varchar(20),                         -- 단위
                           storage varchar(20) not null,             -- 보관 위치: FRIDGE/FREEZER/PANTRY
                           purchased_at date,                        -- (선택) 언제 넣었는지. 구매 기록과 연결 안 해도 됨
                           expires_at date,                          -- 유통기한(사용자가 직접 입력하거나 자동 기본값)
                           created_at timestamptz not null default now()
);

-- 사용처:
-- - “냉장고에 뭐가 남아있지?” = inventory 조회
-- - “유통기한 임박 알림” = expires_at 기반
-- - “남은 재료로 요리 추천” = inventory 목록 기반

-- 왜 purchase랑 분리했나?
-- - purchase는 "과거 기록(샀던 내역)"이고,
-- - inventory는 "현재 상태(지금 남은 것)"라서 역할이 다름.
-- - purchase 하나로 inventory까지 하려면 수량 차감/분할이 복잡해져서 MVP 속도가 느려짐.
--   (나중에 고도화할 때 purchase_id로 연결해도 됨)


-- ---------------------------
-- 5) 특가/세일 정보 테이블 (오늘/이번주 딜)
-- ---------------------------
create table deal (
                      id bigserial primary key,                -- 특가 PK
                      store_id bigint references store(id),     -- 어느 마트 딜인지 (오프라인/특정몰)
                      item_name varchar(200) not null,          -- 특가 품목명
                      deal_price integer not null,              -- 특가 가격
                      starts_at date not null,                  -- 딜 시작일
                      ends_at date not null,                    -- 딜 종료일
                      source varchar(30) not null default 'MANUAL', -- 딜 데이터 출처: MANUAL/CSV/ONLINE
                      created_at timestamptz not null default now()
);

-- - “내 주변 마트 특가” 목록이 deal에서 나옴
-- - 초기 MVP에서는 MANUAL(관리자 입력) 또는 CSV 업로드로 넣으면 됨
-- - 나중에 온라인 연동/수집을 하면 ONLINE으로 넣을 수 있음


-- ---------------------------
-- 6) 가격 알림 규칙 테이블 (내 기준가/조건)
-- ---------------------------
create table price_alert (
                             id bigserial primary key,                -- 알림 규칙 PK
                             user_id bigint not null references app_user(id), -- 누구 규칙인지
                             item_name varchar(200) not null,          -- 어떤 품목에 대한 규칙인지
                             anchor_price integer not null,            -- 기준가(내가 샀던 가격) 또는 내가 정한 기준
                             threshold_type varchar(10) not null default 'LTE',
    -- threshold_type 설명:
    -- - LTE: deal_price <= anchor_price 이면 알림
    -- - UNDER_PCT: deal_price <= anchor_price * (1 - threshold_value) 이면 알림 (예: 0.10이면 10% 더 쌀 때)
                             threshold_value numeric(10,2),            -- UNDER_PCT일 때 사용 (예: 0.10)
                             created_at timestamptz not null default now()
);

-- 사용처:
-- - 사용자가 “우유는 4,980원 이하 뜨면 알려줘” 같은 조건을 저장
-- - purchase(구매 기록)에서 자동으로 anchor_price를 만들어도 되고,
--   사용자가 직접 anchor_price를 수정할 수도 있음


-- ---------------------------
-- 7) 알림 발생 기록 테이블 (실제로 알림이 울린 이벤트)
-- ---------------------------
create table alert_event (
                             id bigserial primary key,                -- 알림 이벤트 PK
                             user_id bigint not null references app_user(id), -- 누구에게 발생한 알림인지
                             deal_id bigint not null references deal(id),      -- 어떤 특가(deal)가 원인이었는지
                             triggered_at timestamptz not null default now(),  -- 알림 발생 시각
                             seen boolean not null default false               -- 사용자가 앱에서 확인했는지
);

-- 사용처:
-- - 스케줄러가 매일(또는 주기적으로) deal을 훑으면서
--   price_alert 조건을 만족하면 alert_event를 생성
-- - 앱은 alert_event를 보여주고, 사용자가 확인하면 seen=true로 업데이트
-- - "푸시 알림"은 나중에 붙여도 되고, MVP에선 alert_event 화면으로 대체 가능
