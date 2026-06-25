-- ============================================================
-- schema.sql
-- Cibono 전체 DB 스키마 정의
-- 실행 순서:
--   app_user → food_category → store
--   → purchase / inventory / deal
--   → price_alert → alert_event
--   → recipe → recipe_ingredient
--   → item_shelf_life
-- ============================================================

-- 1) 사용자 계정
CREATE TABLE IF NOT EXISTS app_user (
    id           BIGSERIAL    PRIMARY KEY,
    email        VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    firebase_uid VARCHAR(255) UNIQUE, -- app user 식별은 firebase로 함
    role VARCHAR(20) DEFAULT 'USER', -- USER / ADMIN
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 2) 식재료 카테고리 (inventory FK 때문에 inventory 앞에 정의)
CREATE TABLE IF NOT EXISTS food_category (
    id   SERIAL      PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE  -- 채소/과일, 육류/계란, 해산물, 우유/유제품, 밀키트, 기타
);

-- 3) 마트/스토어
CREATE TABLE IF NOT EXISTS store (
    id        BIGSERIAL    PRIMARY KEY,
    name      VARCHAR(100) NOT NULL,
    region    VARCHAR(100),
    source    VARCHAR(30),
    store_no  VARCHAR(20),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 3) 구매 기록 (언제, 얼마에 샀는지)
CREATE TABLE IF NOT EXISTS purchase (
    id           BIGSERIAL      PRIMARY KEY,
    user_id      BIGINT         NOT NULL REFERENCES app_user(id),
    item_name    VARCHAR(200)   NOT NULL,
    price        INTEGER        NOT NULL,
    quantity     NUMERIC(10, 2) NOT NULL DEFAULT 1,
    unit         VARCHAR(20),
    store_id     BIGINT         REFERENCES store(id),
    purchased_at DATE           NOT NULL DEFAULT CURRENT_DATE,
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- 4) 냉장고 재고 (현재 집에 있는 것)
CREATE TABLE IF NOT EXISTS inventory (
    id           BIGSERIAL      PRIMARY KEY,
    user_id      BIGINT         NOT NULL REFERENCES app_user(id),
    item_name    VARCHAR(200)   NOT NULL,
    quantity     NUMERIC(10, 2) NOT NULL DEFAULT 1,
    unit         VARCHAR(20),
    storage      VARCHAR(20)    NOT NULL,  -- FRIDGE / FREEZER / PANTRY
    purchased_at DATE,
    expires_at   DATE,
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    category_id  INTEGER        REFERENCES food_category(id),
    is_favorite  BOOLEAN        NOT NULL DEFAULT FALSE,
    UNIQUE (user_id, item_name)
);

-- 5) 특가/세일 정보
CREATE TABLE IF NOT EXISTS deal (
    id         BIGSERIAL    PRIMARY KEY,
    store_id   BIGINT       REFERENCES store(id),
    item_name  VARCHAR(200) NOT NULL,
    deal_price     INTEGER      NOT NULL,
    original_price INTEGER,
    starts_at      DATE         NOT NULL,
    ends_at    DATE         NOT NULL,
    source     VARCHAR(30)  NOT NULL DEFAULT 'MANUAL',  -- MANUAL / CSV / ONLINE
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 6) 가격 알림 규칙 (내 기준가/조건)
CREATE TABLE IF NOT EXISTS price_alert (
    id              BIGSERIAL      PRIMARY KEY,
    user_id         BIGINT         NOT NULL REFERENCES app_user(id),
    item_name       VARCHAR(200)   NOT NULL,
    anchor_price    INTEGER        NOT NULL,
    threshold_type  VARCHAR(10)    NOT NULL DEFAULT 'LTE',  -- LTE / UNDER_PCT
    threshold_value NUMERIC(10, 2),
    is_enabled      BOOLEAN        NOT NULL DEFAULT TRUE,
    store_id        BIGINT         REFERENCES store(id),
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- 7) 알림 발생 기록
CREATE TABLE IF NOT EXISTS alert_event (
    id           BIGSERIAL   PRIMARY KEY,
    user_id      BIGINT      NOT NULL REFERENCES app_user(id),
    deal_id      BIGINT      NOT NULL REFERENCES deal(id),
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    seen         BOOLEAN     NOT NULL DEFAULT FALSE,
    read_at      TIMESTAMPTZ
);

-- 8) 레시피
CREATE TABLE IF NOT EXISTS recipe (
    id           BIGSERIAL    PRIMARY KEY,
    name         VARCHAR(200) NOT NULL UNIQUE,
    cooking_time INTEGER      NOT NULL DEFAULT 30,  -- 단위: 분
    cuisine_type VARCHAR(20)  NOT NULL DEFAULT 'KOREAN',  -- KOREAN / WESTERN / CHINESE / GLOBAL
    image_url    VARCHAR(500)
);

-- 9) 재료 마스터
CREATE TABLE IF NOT EXISTS ingredient (
    id   BIGSERIAL    PRIMARY KEY,
    name VARCHAR(200) NOT NULL UNIQUE
);

-- 10) 레시피-재료 조인 (recipe ↔ ingredient M:N)
CREATE TABLE IF NOT EXISTS recipe_ingredient (
    recipe_id     BIGINT NOT NULL REFERENCES recipe(id)     ON DELETE CASCADE,
    ingredient_id BIGINT NOT NULL REFERENCES ingredient(id) ON DELETE CASCADE,
    PRIMARY KEY (recipe_id, ingredient_id)
);

-- 11) 품목별 기본 유통기한 규칙
CREATE TABLE IF NOT EXISTS item_shelf_life (
    id              BIGSERIAL    PRIMARY KEY,
    item_name       VARCHAR(200) NOT NULL UNIQUE,
    shelf_life_days INTEGER      NOT NULL  -- 단위: 일
);

-- 12) 쇼핑리스트 (레시피 재료 메모)
CREATE TABLE IF NOT EXISTS shopping_list (
    id         BIGSERIAL      PRIMARY KEY,
    user_id    BIGINT         NOT NULL REFERENCES app_user(id),
    item_name  VARCHAR(200)   NOT NULL,
    quantity   NUMERIC(10, 2),
    unit       VARCHAR(20),
    checked    BOOLEAN        NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- 13) 네이버 블로그 검색 결과 영구 저장 (query = PK, 만료 없음)
CREATE TABLE IF NOT EXISTS blog_search_cache (
    query       VARCHAR(200) NOT NULL,
    result_json TEXT         NOT NULL,
    cached_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT blog_search_cache_pkey PRIMARY KEY (query)
);

-- 14) 저장된 레시피 (북마크)
CREATE TABLE IF NOT EXISTS saved_recipe (
    id          BIGSERIAL    PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES app_user(id),
    recipe_name VARCHAR(200) NOT NULL,
    image_url   VARCHAR(500),
    source_type VARCHAR(20)  NOT NULL DEFAULT 'FOOD_SAFETY',  -- FOOD_SAFETY / BLOG
    source_url  VARCHAR(500),
    ingredients TEXT,        -- 쉼표 구분 재료 목록
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, recipe_name)
);
