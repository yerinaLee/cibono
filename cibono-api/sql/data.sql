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
-- 기존 테이블에 컬럼/제약 추가 (이미 적용된 DB 대응)
-- -----------------------------------------------
ALTER TABLE recipe ADD COLUMN IF NOT EXISTS cuisine_type VARCHAR(20) NOT NULL DEFAULT 'KOREAN';

-- inventory: 중복 행 수량 합산 후 제거 (UNIQUE 추가 전 전처리)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_user_item_unique'
  ) THEN
    -- 첫 번째 행에 수량 합산
    UPDATE inventory i
    SET quantity = sub.total_qty
    FROM (
      SELECT MIN(id) AS keep_id, user_id, item_name, SUM(quantity) AS total_qty
      FROM inventory
      GROUP BY user_id, item_name
    ) sub
    WHERE i.user_id = sub.user_id
      AND i.item_name = sub.item_name
      AND i.id = sub.keep_id;

    -- 중복 행 삭제
    DELETE FROM inventory
    WHERE id NOT IN (
      SELECT MIN(id) FROM inventory GROUP BY user_id, item_name
    );

    ALTER TABLE inventory ADD CONSTRAINT inventory_user_item_unique UNIQUE (user_id, item_name);
  END IF;
END $$;
ALTER TABLE recipe ADD CONSTRAINT IF NOT EXISTS recipe_name_unique UNIQUE (name);

-- -----------------------------------------------
-- 레시피 시드 (기존 5개)
-- -----------------------------------------------
INSERT INTO recipe (id, name, cooking_time, cuisine_type) VALUES
    (1, '계란말이',          10, 'KOREAN'),
    (2, '두부부침',          20, 'KOREAN'),
    (3, '김치볶음밥',        30, 'KOREAN'),
    (4, '우유 프렌치토스트', 15, 'WESTERN'),
    (5, '감자볶음',          35, 'KOREAN')
ON CONFLICT (id) DO UPDATE SET cuisine_type = EXCLUDED.cuisine_type;

SELECT setval('recipe_id_seq', (SELECT MAX(id) FROM recipe));

-- -----------------------------------------------
-- 레시피 시드 (신규 30개)
-- -----------------------------------------------
INSERT INTO recipe (name, cooking_time, cuisine_type) VALUES
    -- 한식
    ('갈치조림',           40, 'KOREAN'),
    ('시금치무침',         15, 'KOREAN'),
    ('무국',               30, 'KOREAN'),
    ('달걀국',             20, 'KOREAN'),
    ('느타리버섯볶음',     15, 'KOREAN'),
    ('팽이버섯된장찌개',   25, 'KOREAN'),
    ('계란찜',             20, 'KOREAN'),
    ('양배추볶음',         20, 'KOREAN'),
    ('새우볶음밥',         20, 'KOREAN'),
    ('참치마요덮밥',       15, 'KOREAN'),
    ('애호박새우전',       25, 'KOREAN'),
    ('감자채볶음',         20, 'KOREAN'),
    -- 양식
    ('라구 파스타',        45, 'WESTERN'),
    ('알리오올리오',       20, 'WESTERN'),
    ('양배추 스테이크',    25, 'WESTERN'),
    ('야채볶음',           15, 'WESTERN'),
    ('토마토 스크램블에그',15, 'WESTERN'),
    ('새우 아히요',        25, 'WESTERN'),
    ('양상추 샐러드',      10, 'WESTERN'),
    ('버섯크림파스타',     30, 'WESTERN'),
    -- 중식
    ('마파두부',           25, 'CHINESE'),
    ('새우마요',           20, 'CHINESE'),
    ('팽이버섯무침',       10, 'CHINESE'),
    ('청경채볶음',         15, 'CHINESE'),
    -- 글로벌
    ('마녀스프',           30, 'GLOBAL'),
    ('소바',               15, 'GLOBAL'),
    ('샤브샤브',           30, 'GLOBAL'),
    ('토마토수프',         35, 'GLOBAL'),
    ('오야코동',           25, 'GLOBAL'),
    ('나베',               35, 'GLOBAL')
ON CONFLICT (name) DO NOTHING;

-- -----------------------------------------------
-- 레시피 재료 시드 (기존 5개)
-- -----------------------------------------------
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

-- 신규 레시피 재료 (recipe_id를 name 으로 조회하여 삽입)
INSERT INTO recipe_ingredient (recipe_id, ingredient_name)
SELECT r.id, v.ing FROM recipe r
JOIN (VALUES
    -- 한식
    ('갈치조림',           '갈치'),
    ('갈치조림',           '무'),
    ('갈치조림',           '대파'),
    ('시금치무침',         '시금치'),
    ('시금치무침',         '마늘'),
    ('무국',               '무'),
    ('무국',               '대파'),
    ('무국',               '된장'),
    ('달걀국',             '계란'),
    ('달걀국',             '대파'),
    ('달걀국',             '양파'),
    ('느타리버섯볶음',     '느타리버섯'),
    ('느타리버섯볶음',     '마늘'),
    ('느타리버섯볶음',     '대파'),
    ('팽이버섯된장찌개',   '팽이버섯'),
    ('팽이버섯된장찌개',   '두부'),
    ('팽이버섯된장찌개',   '된장'),
    ('계란찜',             '계란'),
    ('계란찜',             '대파'),
    ('양배추볶음',         '양배추'),
    ('양배추볶음',         '마늘'),
    ('새우볶음밥',         '새우'),
    ('새우볶음밥',         '계란'),
    ('새우볶음밥',         '대파'),
    ('참치마요덮밥',       '참치'),
    ('참치마요덮밥',       '마요네즈'),
    ('애호박새우전',       '애호박'),
    ('애호박새우전',       '새우'),
    ('감자채볶음',         '감자'),
    ('감자채볶음',         '대파'),
    -- 양식
    ('라구 파스타',        '토마토'),
    ('라구 파스타',        '다진고기'),
    ('라구 파스타',        '마늘'),
    ('라구 파스타',        '양파'),
    ('라구 파스타',        '파스타'),
    ('알리오올리오',       '파스타'),
    ('알리오올리오',       '마늘'),
    ('알리오올리오',       '버터'),
    ('알리오올리오',       '파슬리'),
    ('양배추 스테이크',    '양배추'),
    ('양배추 스테이크',    '버터'),
    ('야채볶음',           '냉동야채'),
    ('야채볶음',           '버터'),
    ('토마토 스크램블에그','토마토'),
    ('토마토 스크램블에그','계란'),
    ('토마토 스크램블에그','버터'),
    ('새우 아히요',        '새우'),
    ('새우 아히요',        '마늘'),
    ('새우 아히요',        '올리브오일'),
    ('양상추 샐러드',      '양상추'),
    ('양상추 샐러드',      '토마토'),
    ('버섯크림파스타',     '느타리버섯'),
    ('버섯크림파스타',     '생크림'),
    ('버섯크림파스타',     '파스타'),
    ('버섯크림파스타',     '마늘'),
    -- 중식
    ('마파두부',           '두부'),
    ('마파두부',           '다진고기'),
    ('마파두부',           '두반장'),
    ('새우마요',           '새우'),
    ('새우마요',           '마요네즈'),
    ('팽이버섯무침',       '팽이버섯'),
    ('팽이버섯무침',       '간장'),
    ('팽이버섯무침',       '마늘'),
    ('청경채볶음',         '청경채'),
    ('청경채볶음',         '마늘'),
    ('청경채볶음',         '굴소스'),
    -- 글로벌
    ('마녀스프',           '토마토'),
    ('마녀스프',           '양배추'),
    ('마녀스프',           '양파'),
    ('소바',               '메밀면'),
    ('소바',               '쯔유'),
    ('샤브샤브',           '쯔유'),
    ('샤브샤브',           '청경채'),
    ('샤브샤브',           '팽이버섯'),
    ('샤브샤브',           '알배추'),
    ('토마토수프',         '토마토'),
    ('토마토수프',         '양파'),
    ('토마토수프',         '마늘'),
    ('오야코동',           '닭'),
    ('오야코동',           '계란'),
    ('오야코동',           '양파'),
    ('나베',               '팽이버섯'),
    ('나베',               '배추'),
    ('나베',               '두부'),
    ('나베',               '쯔유')
) AS v(name, ing) ON r.name = v.name
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
    ('우유',   14),
    ('무',     21),
    ('느타리버섯', 7),
    ('팽이버섯',   7),
    ('시금치',    7),
    ('애호박',   14),
    ('새우',     7),
    ('청경채',   7),
    ('두부',     7),
    ('토마토',  14),
    ('양상추',   7)
ON CONFLICT (item_name) DO NOTHING;
