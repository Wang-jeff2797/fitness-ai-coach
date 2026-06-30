-- ============================================================
-- 迁移 v3: 训练计划系统（从记录驱动升级为计划驱动）
-- 新增 3 张表: cycle_plans, plan_days, plan_exercises
-- ============================================================

-- --- 1. 周期计划表（总体设置）---
CREATE TABLE IF NOT EXISTS cycle_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cycle_id UUID REFERENCES cycles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  goal TEXT NOT NULL DEFAULT 'muscle_gain',
  duration_weeks INT NOT NULL DEFAULT 4,
  workouts_per_week INT NOT NULL DEFAULT 3,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE cycle_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY cycle_plans_own ON cycle_plans FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX cycle_plans_user_id_idx ON cycle_plans(user_id);
CREATE INDEX cycle_plans_cycle_id_idx ON cycle_plans(cycle_id);

-- --- 2. 每日计划表（每周第几天练什么）---
CREATE TABLE IF NOT EXISTS plan_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES cycle_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  day_name TEXT,
  focus TEXT,
  is_rest_day BOOLEAN NOT NULL DEFAULT FALSE,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE plan_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY plan_days_own ON plan_days FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX plan_days_plan_id_idx ON plan_days(plan_id);
CREATE INDEX plan_days_user_id_idx ON plan_days(user_id);

-- --- 3. 每日动作条目（某天练哪些动作，目标多少组×多少次×多少kg）---
CREATE TABLE IF NOT EXISTS plan_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES cycle_plans(id) ON DELETE CASCADE,
  day_id UUID NOT NULL REFERENCES plan_days(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  exercise_type TEXT NOT NULL DEFAULT 'other',
  target_sets INT NOT NULL DEFAULT 3,
  target_reps TEXT NOT NULL DEFAULT '8-12',
  target_weight_kg DECIMAL(8,2),
  rpe_target INT CHECK (rpe_target BETWEEN 1 AND 10),
  notes TEXT,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE plan_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY plan_exercises_own ON plan_exercises FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX plan_exercises_plan_id_idx ON plan_exercises(plan_id);
CREATE INDEX plan_exercises_day_id_idx ON plan_exercises(day_id);
CREATE INDEX plan_exercises_user_id_idx ON plan_exercises(user_id);

-- --- 4. 扩展 cycles 表：关联计划 ID ---
ALTER TABLE cycles ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES cycle_plans(id) ON DELETE SET NULL;
