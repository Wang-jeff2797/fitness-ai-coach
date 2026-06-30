-- ============================================================
-- 迁移 v6: 训练动作完成度追踪系统
-- 新增 1 张表: exercise_completions
-- 实现每日完成度和计划完成度的记录与查询
-- ============================================================

-- --- 训练动作完成记录表 ---
-- 每条记录表示用户在某天完成了某个计划中的某个动作
-- 通过此表可计算：每日完成度、每计划完成度
CREATE TABLE IF NOT EXISTS exercise_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES cycle_plans(id) ON DELETE CASCADE,
  day_id UUID NOT NULL REFERENCES plan_days(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES plan_exercises(id) ON DELETE CASCADE,
  completed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  -- 实际完成的组数（用户可能没做完计划的所有组）
  completed_sets INT DEFAULT NULL,
  -- 实际完成的次数
  completed_reps TEXT DEFAULT NULL,
  -- 实际使用的重量
  completed_weight_kg DECIMAL(8,2) DEFAULT NULL,
  -- 来源：manual(手动勾选) / auto(用户输入后自动匹配)
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'auto')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 同一天同一动作只能有一条完成记录
  UNIQUE(user_id, exercise_id, completed_date)
);

ALTER TABLE exercise_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY exercise_completions_own ON exercise_completions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX exercise_completions_user_id_idx ON exercise_completions(user_id);
CREATE INDEX exercise_completions_plan_id_idx ON exercise_completions(plan_id);
CREATE INDEX exercise_completions_day_id_idx ON exercise_completions(day_id);
CREATE INDEX exercise_completions_date_idx ON exercise_completions(completed_date);
CREATE INDEX exercise_completions_user_date_idx ON exercise_completions(user_id, completed_date);

-- --- 添加自动更新 updated_at 的触发器 ---
CREATE OR REPLACE FUNCTION update_exercise_completions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER exercise_completions_updated_at
  BEFORE UPDATE ON exercise_completions
  FOR EACH ROW EXECUTE FUNCTION update_exercise_completions_updated_at();
