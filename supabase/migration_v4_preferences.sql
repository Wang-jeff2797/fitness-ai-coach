-- ============================================================
-- 迁移 v4: 用户动作偏好 + 动作库
-- 新增: user_exercise_preferences
-- ============================================================
CREATE TABLE IF NOT EXISTS user_exercise_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  muscle_group TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  exercise_type TEXT NOT NULL DEFAULT 'other',
  weight REAL NOT NULL DEFAULT 0.5,
  usage_count INT NOT NULL DEFAULT 0,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE user_exercise_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own preferences"
  ON user_exercise_preferences
  FOR ALL
  USING (auth.uid() = user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_pref_unique
  ON user_exercise_preferences(user_id, muscle_group, exercise_name);
CREATE INDEX IF NOT EXISTS idx_user_pref_muscle
  ON user_exercise_preferences(user_id, muscle_group);
