-- ============================================================
-- 迁移 v7: 计划支持双模式（周模式 / 天轮模式）
-- cycle_plans 增加 duration_type, total_days, total_rounds
-- plan_days 放宽 day_of_week 约束以支持 >6 的序号
-- ============================================================
-- 1. cycle_plans 新增字段
ALTER TABLE cycle_plans
ADD COLUMN IF NOT EXISTS duration_type TEXT NOT NULL DEFAULT 'weekly',
ADD COLUMN IF NOT EXISTS total_days INT,
ADD COLUMN IF NOT EXISTS total_rounds INT;
-- 添加 check 约束
ALTER TABLE cycle_plans
DROP CONSTRAINT IF EXISTS cycle_plans_duration_type_check;
ALTER TABLE cycle_plans
ADD CONSTRAINT cycle_plans_duration_type_check
  CHECK (duration_type IN ('weekly', 'daily'));
-- 2. plan_days 放宽 day_of_week 约束（0-30 以支持天数模式）
ALTER TABLE plan_days
DROP CONSTRAINT IF EXISTS plan_days_day_of_week_check;
ALTER TABLE plan_days
ADD CONSTRAINT plan_days_day_of_week_check
  CHECK (day_of_week BETWEEN 0 AND 30);
-- 3. workouts 表允许 cycle_id 为空（无周期时也可记录训练）
ALTER TABLE workouts
DROP CONSTRAINT IF EXISTS workouts_cycle_id_fkey;
ALTER TABLE workouts
ALTER COLUMN cycle_id DROP NOT NULL;
ALTER TABLE workouts
ADD CONSTRAINT workouts_cycle_id_fkey
  FOREIGN KEY (cycle_id) REFERENCES cycles(id) ON DELETE SET NULL;