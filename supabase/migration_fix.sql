-- ============================================================
-- 迁移修复：支持匿名用户（无邮箱）
-- 在 migration.sql 之后执行
-- ============================================================

-- 1. 让 email 字段可空（匿名用户无邮箱）
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE users ALTER COLUMN email SET DEFAULT NULL;

-- 2. 允许 cycles 和 workouts 插入时跨越 users 表的外键约束
--    改为：如果用户不存在则自动创建用户记录
CREATE OR REPLACE FUNCTION ensure_user_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (id, email, name)
  VALUES (NEW.user_id, 'anonymous', '')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_user_before_cycle_insert
  BEFORE INSERT ON cycles
  FOR EACH ROW
  EXECUTE FUNCTION ensure_user_on_insert();

CREATE TRIGGER ensure_user_before_workout_insert
  BEFORE INSERT ON workouts
  FOR EACH ROW
  EXECUTE FUNCTION ensure_user_on_insert();
