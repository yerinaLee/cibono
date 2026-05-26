-- ============================================================
-- data.sql
-- Cibono MVP 초기 시드 데이터
-- 실행 전제: schema.sql 이 먼저 실행되어 있어야 함
-- ============================================================

-- MVP 기본 유저 (userId = 1, 인증 없는 단일 유저)
INSERT INTO app_user (id, email, password_hash)
VALUES (1, 'mvp@local', 'noop')
ON CONFLICT (email) DO NOTHING;
