-- ============================================================
-- schema.sql
-- Cibono 전체 DB 스키마 정의
-- 실행 순서:
--   app_user → store
--   → purchase / inventory / deal
--   → price_alert → alert_event
--   → recipe → recipe_ingredient
--   → item_shelf_life
-- ============================================================

-- 1) 사용자 계정
CREATE TABLE IF NOT EXISTS app_user (
    id           BIGSERIAL    PRIMARY KEY,
    email        VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 2) 마트/스토어
CREATE TABLE IF NOT EXISTS store (
    id     BIGSERIAL    PRIMARY KEY,
    name   VARCHAR(100) NOT NULL,
    region VARCHAR(100)
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
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
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
    cuisine_type VARCHAR(20)  NOT NULL DEFAULT 'KOREAN'  -- KOREAN / WESTERN / CHINESE / GLOBAL
);

-- 9) 레시피 재료 (recipe 의 ingredients 컬렉션)
CREATE TABLE IF NOT EXISTS recipe_ingredient (
    recipe_id       BIGINT       NOT NULL REFERENCES recipe(id) ON DELETE CASCADE,
    ingredient_name VARCHAR(200) NOT NULL,
    UNIQUE (recipe_id, ingredient_name)
);

-- 10) 품목별 기본 유통기한 규칙
CREATE TABLE IF NOT EXISTS item_shelf_life (
    id              BIGSERIAL    PRIMARY KEY,
    item_name       VARCHAR(200) NOT NULL UNIQUE,
    shelf_life_days INTEGER      NOT NULL  -- 단위: 일
);
