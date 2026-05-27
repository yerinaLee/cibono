-- ============================================================
-- data.sql
-- Cibono MVP 초기 시드 데이터
-- 실행 전제: schema.sql 이 먼저 실행되어 있어야 함
-- ============================================================

-- MVP 기본 유저 (userId = 1, 인증 없는 단일 유저)
INSERT INTO app_user (id, email, password_hash)
VALUES (1, 'mvp@local', 'noop')
ON CONFLICT (email) DO NOTHING;

-- -----------------------------------------------
-- 레시피 시드
-- -----------------------------------------------
INSERT INTO recipe (id, name, cooking_time) VALUES
    (1, '계란말이',          10),
    (2, '두부부침',          20),
    (3, '김치볶음밥',        30),
    (4, '우유 프렌치토스트', 15),
    (5, '감자볶음',          35)
ON CONFLICT (id) DO NOTHING;

-- id 시퀀스를 삽입한 최대값 이후로 맞춤 (직접 id를 지정했으므로)
SELECT setval('recipe_id_seq', (SELECT MAX(id) FROM recipe));

INSERT INTO recipe_ingredient (recipe_id, ingredient_name) VALUES
    (1, '계란'),
    (1, '대파'),
    (2, '두부'),
    (2, '대파'),
    (3, '김치'),
    (3, '계란'),
    (4, '우유'),
    (4, '계란'),
    (5, '감자'),
    (5, '양파')
ON CONFLICT (recipe_id, ingredient_name) DO NOTHING;

-- -----------------------------------------------
-- 품목별 기본 유통기한 시드
-- -----------------------------------------------
INSERT INTO item_shelf_life (item_name, shelf_life_days) VALUES
    ('대파',   14),
    ('양파',   14),
    ('감자',   30),
    ('당근',   21),
    ('계란',   30),
    ('마늘',   14),
    ('양배추', 21),
    ('알배추', 14),
    ('우유',   14)
ON CONFLICT (item_name) DO NOTHING;
