-- ============================================================
-- 数据库迁移 v2: 生活反馈 + 用户设置 + 动作学习 + PR + 注册
-- 在 migration.sql 之后执行
-- ============================================================
-- ============================================================
-- 1. 用户资料扩展（TDEE 计算所需）
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'male';
ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER DEFAULT 25;
ALTER TABLE users ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(5,1) DEFAULT 70.0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS height_cm NUMERIC(5,1) DEFAULT 175.0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS activity_level TEXT DEFAULT 'moderate';
ALTER TABLE users ADD COLUMN IF NOT EXISTS goal TEXT DEFAULT 'muscle_gain'; -- 'muscle_gain' | 'fat_loss' | 'strength' | 'endurance'
-- ============================================================
-- 2. cycles 表扩展（目标 + 修正后 TDEE）
-- ============================================================
ALTER TABLE cycles ADD COLUMN IF NOT EXISTS goal TEXT;
ALTER TABLE cycles ADD COLUMN IF NOT EXISTS tdee_adjusted NUMERIC(6,1); -- 修正后 TDEE
-- ============================================================
-- 3. lifestyle_feedback 表
-- ============================================================
CREATE TABLE IF NOT EXISTS lifestyle_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cycle_id UUID NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  sleep_quality INTEGER NOT NULL CHECK (sleep_quality >= 1 AND sleep_quality <= 5),
  stress_level INTEGER NOT NULL CHECK (stress_level >= 1 AND stress_level <= 5),
  activity_change TEXT NOT NULL CHECK (activity_change IN ('more', 'less', 'same')),
  special_condition TEXT NOT NULL CHECK (special_condition IN ('sick', 'travel', 'none')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lifestyle_feedback_user ON lifestyle_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_lifestyle_feedback_cycle ON lifestyle_feedback(cycle_id);
ALTER TABLE lifestyle_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own lifestyle_feedback" ON lifestyle_feedback
  FOR ALL USING (auth.uid() = user_id);
-- ============================================================
-- 4. user_settings 表（key-value）
-- ============================================================
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, key)
);
CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);
CREATE TRIGGER set_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own user_settings" ON user_settings
  FOR ALL USING (auth.uid() = user_id);
-- ============================================================
-- 5. met_constants 表（动态扩展的 MET 库）
-- ============================================================
CREATE TABLE IF NOT EXISTS met_constants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_name TEXT NOT NULL UNIQUE,
  met_value NUMERIC(4,1) NOT NULL,
  category TEXT NOT NULL DEFAULT 'strength', -- 'strength' | 'cardio' | 'other'
  source TEXT DEFAULT 'manual', -- 'manual' | 'ai_learned' | 'compendium'
  is_user_added BOOLEAN DEFAULT FALSE, -- 用户自定义
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- 初始 MET 常量库（基于2011体力活动概要）
INSERT INTO met_constants (action_name, met_value, category, source) VALUES
  ('平板卧推', 5.0, 'strength', 'compendium'),
  ('上斜卧推', 5.0, 'strength', 'compendium'),
  ('下斜卧推', 5.0, 'strength', 'compendium'),
  ('深蹲', 6.0, 'strength', 'compendium'),
  ('前蹲', 6.0, 'strength', 'compendium'),
  ('硬拉', 6.0, 'strength', 'compendium'),
  ('罗马尼亚硬拉', 5.0, 'strength', 'compendium'),
  ('杠铃划船', 5.0, 'strength', 'compendium'),
  ('引体向上', 5.0, 'strength', 'compendium'),
  ('高位下拉', 5.0, 'strength', 'compendium'),
  ('坐姿划船', 5.0, 'strength', 'compendium'),
  ('哑铃飞鸟', 4.0, 'strength', 'compendium'),
  ('推举', 4.5, 'strength', 'compendium'),
  ('哑铃侧平举', 3.5, 'strength', 'compendium'),
  ('二头弯举', 3.5, 'strength', 'compendium'),
  ('三头下压', 3.5, 'strength', 'compendium'),
  ('绳索飞鸟', 4.0, 'strength', 'compendium'),
  ('臀推', 4.5, 'strength', 'compendium'),
  ('提踵', 3.5, 'strength', 'compendium'),
  ('平板支撑', 2.5, 'strength', 'compendium'),
  ('俯卧撑', 3.5, 'strength', 'compendium'),
  ('双杠臂屈伸', 5.0, 'strength', 'compendium'),
  ('腿举', 5.0, 'strength', 'compendium'),
  ('腿弯举', 3.5, 'strength', 'compendium'),
  ('腿屈伸', 3.5, 'strength', 'compendium'),
  ('面拉', 3.5, 'strength', 'compendium'),
  -- 有氧
  ('跑步', 8.0, 'cardio', 'compendium'),
  ('慢跑', 6.0, 'cardio', 'compendium'),
  ('快走', 3.5, 'cardio', 'compendium'),
  ('自由泳', 8.0, 'cardio', 'compendium'),
  ('蛙泳', 7.0, 'cardio', 'compendium'),
  ('蝶泳', 11.0, 'cardio', 'compendium'),
  ('骑行', 7.0, 'cardio', 'compendium'),
  ('划船机', 7.0, 'cardio', 'compendium'),
  ('跳绳', 10.0, 'cardio', 'compendium'),
  ('椭圆机', 5.0, 'cardio', 'compendium'),
  ('爬楼梯', 8.0, 'cardio', 'compendium')
ON CONFLICT (action_name) DO NOTHING;
-- 无需对 met_constants 开启 RLS，它是全局共享的
-- 但用户自定义条目（is_user_added=true）应只对创建者可见
ALTER TABLE met_constants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view shared met" ON met_constants
  FOR SELECT USING (is_user_added = FALSE OR user_id = auth.uid());
CREATE POLICY "Users can add met" ON met_constants
  FOR INSERT WITH CHECK (auth.uid() = user_id OR is_user_added = FALSE);
-- ============================================================
-- 6. unknown_actions 表
-- ============================================================
CREATE TABLE IF NOT EXISTS unknown_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_name TEXT NOT NULL,
  context TEXT, -- 动作的使用上下文
  is_learned BOOLEAN DEFAULT FALSE, -- 是否已学习
  suggested_met NUMERIC(4,1), -- AI 建议的 MET 值
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, action_name)
);
CREATE INDEX IF NOT EXISTS idx_unknown_actions_user ON unknown_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_unknown_actions_unlearned ON unknown_actions(is_learned);
ALTER TABLE unknown_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own unknown_actions" ON unknown_actions
  FOR ALL USING (auth.uid() = user_id);
-- ============================================================
-- 7. personal_records 表
-- ============================================================
CREATE TABLE IF NOT EXISTS personal_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise TEXT NOT NULL,
  weight_kg NUMERIC(6,2) NOT NULL,
  reps INTEGER NOT NULL,
  estimated_1rm NUMERIC(6,2), -- 使用 Brzycki 公式估算
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, exercise, weight_kg, reps)
);
CREATE INDEX IF NOT EXISTS idx_personal_records_user ON personal_records(user_id);
CREATE TRIGGER set_personal_records_updated_at
  BEFORE UPDATE ON personal_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own personal_records" ON personal_records
  FOR ALL USING (auth.uid() = user_id);
-- ============================================================
-- 8. RLS：确保新表触发器也在 users 中创建记录
-- ============================================================
-- ensure_user_on_insert 已存在于 migration.sql，无需重复创建
