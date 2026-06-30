// ============================================================
// 类型定义 - 个人健身 AI 助手
// ============================================================
// --- RPE 量表 (1-10) ---
export type RPE = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
// --- 用户目标 ---
export type UserGoal = 'muscle_gain' | 'fat_loss' | 'strength' | 'endurance';
// --- 活动水平 (PAL) ---
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
// --- 训练动作类型 ---
export type ExerciseType =
  | "bench_press"
  | "squat"
  | "deadlift"
  | "overhead_press"
  | "barbell_row"
  | "pull_up"
  | "dumbbell_fly"
  | "leg_press"
  | "leg_curl"
  | "leg_extension"
  | "lateral_raise"
  | "bicep_curl"
  | "tricep_pushdown"
  | "cable_crossover"
  | "dumbbell_shoulder_press"
  | "face_pull"
  | "hip_thrust"
  | "calf_raise"
  | "plank"
  | "push_up"
  | "dip"
  | "running"
  | "swimming"
  | "cycling"
  | "rowing"
  | "jumping_rope"
  | "other";
// --- 有氧运动类型 ---
export interface CardioDetail {
  type: "steady" | "hiit" | "fartlek" | "intervals";
  intensity?: "low" | "moderate" | "high";
  distance_meters?: number;
  average_heart_rate?: number;
}
// --- 单个动作组 ---
export interface ExerciseSet {
  set_number: number;
  reps: number;
  weight_kg: number;
  rpe: RPE;
  is_warmup: boolean;
  notes?: string;
}
// --- 单个动作 ---
export interface Exercise {
  name: string;
  exercise_type: ExerciseType;
  is_cardio: boolean;
  sets: ExerciseSet[];
  cardio_detail?: CardioDetail;
  total_duration_minutes?: number;
}
// --- 训练会话 ---
export interface SessionData {
  exercises: Exercise[];
  cardio_exercises?: Exercise[];
  total_volume_kg: number;
  session_rpe: RPE;
  duration_minutes: number;
  notes?: string;
  felt?: string;
}
// --- 生活反馈 ---
export interface LifestyleFeedback {
  id: string;
  user_id: string;
  cycle_id: string;
  sleep_quality: 1 | 2 | 3 | 4 | 5;
  stress_level: 1 | 2 | 3 | 4 | 5;
  activity_change: 'more' | 'less' | 'same';
  special_condition: 'sick' | 'travel' | 'none';
  notes?: string;
  created_at: string;
}
// --- 用户设置 (key-value) ---
export interface UserSetting {
  id: string;
  user_id: string;
  key: string;
  value: string;
  updated_at: string;
}
// --- MET 常量 ---
export interface MetConstant {
  id: string;
  action_name: string;
  met_value: number;
  category: 'strength' | 'cardio' | 'other';
  source: 'manual' | 'ai_learned' | 'compendium';
  is_user_added: boolean;
}
// --- 未知动作 ---
export interface UnknownAction {
  id: string;
  user_id: string;
  action_name: string;
  context?: string;
  is_learned: boolean;
  suggested_met?: number;
  created_at: string;
}
// --- 个人纪录 ---
export interface PersonalRecord {
  id: string;
  user_id: string;
  exercise: string;
  weight_kg: number;
  reps: number;
  estimated_1rm: number;
  record_date: string;
  notes?: string;
  /** 系统自动从训练数据计算出的 1RM（隐藏权重） */
  calculated_1rm?: number | null;
}
// --- 数据库行类型 ---
export interface User {
  id: string;
  email: string;
  name: string;
  gender: string;
  age: number;
  weight_kg: number;
  height_cm: number;
  activity_level: ActivityLevel;
  goal: UserGoal;
  created_at: string;
  updated_at: string;
}
export interface Cycle {
  id: string;
  user_id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  notes: string | null;
  goal: UserGoal | null;
  tdee_adjusted: number | null;
  adjustment_plan: CycleAdjustment | null;
  created_at: string;
  updated_at: string;
}
export interface Workout {
  id: string;
  user_id: string;
  cycle_id: string;
  session_data: SessionData;
  raw_input: string | null;
  performed_at: string;
  created_at: string;
}
// --- 周期调整方案 ---
export interface ExerciseAdjustment {
  exercise: string;
  exercise_type: ExerciseType;
  current_sets: number;
  target_sets: number;
  target_reps: string;
  target_weight_adjustment: string;
  rationale: string;
}
export interface CycleAdjustment {
  summary: CycleSummary;
  next_cycle_plan: {
    name?: string;
    duration_weeks: number;
    adjustments: ExerciseAdjustment[];
    overall_focus: string;
    deload_week: boolean;
  };
}
// --- 周期摘要 ---
export interface CycleSummary {
  total_workouts: number;
  total_volume_kg: number;
  average_volume_per_session: number;
  average_session_rpe: RPE;
  volume_trend: "increasing" | "stable" | "decreasing";
  pr_sets: number;
  exercises_summary: ExerciseSummary[];
}
export interface ExerciseSummary {
  exercise: string;
  exercise_type: ExerciseType;
  total_sets: number;
  total_reps: number;
  total_volume_kg: number;
  best_set: {
    weight_kg: number;
    reps: number;
    rpe: RPE;
    date: string;
  } | null;
  average_rpe: number;
}
// --- 扩展周期摘要（含代谢数据）---
export interface EnhancedCycleSummary extends CycleSummary {
  tdee_adjusted: number;
  maintenance_calories: number;
  total_calories_burned: number;
  estimated_calories_per_session: number;
  pr_updates: {
    exercise: string;
    old_1rm: number;
    new_1rm: number;
  }[];
}
// --- API 请求/响应类型 ---
export interface ExtractWorkoutRequest {
  text: string;
  cycle_id: string;
  plan_id?: string;
}
export interface ExtractWorkoutResponse {
  success: boolean;
  workout?: Workout;
  error?: string;
}
export interface AdjustCycleRequest {
  cycle_id: string;
  feedback: string;
}
export interface AdjustCycleResponse {
  success: boolean;
  adjustment?: CycleAdjustment;
  error?: string;
}
export interface StatsResponse {
  cycles: {
    id: string;
    name: string;
    start_date: string;
    end_date: string | null;
    total_volume: number;
    workout_count: number;
  }[];
  volume_trend: {
    date: string;
    volume: number;
    session_rpe: number;
  }[];
  current_cycle_summary: CycleSummary | null;
}
// --- TDEE 计算相关 ---
export interface TdeeResult {
  bmr: number;
  tdee_baseline: number;
  pal: number;
  tdee_adjusted: number;
  adjustments: {
    sleep_adjustment: number;
    stress_adjustment: number;
    activity_change_adjustment: number;
    sick_adjustment: number;
  };
}
// --- 训练计划系统 ---
export interface PlanExercise {
  id?: string;
  plan_id?: string;
  day_id?: string;
  user_id?: string;
  exercise_name: string;
  exercise_type: ExerciseType;
  target_sets: number;
  target_reps: string;
  target_weight_kg?: number | null;
  rpe_target?: number | null;
  notes?: string | null;
  order_index?: number;
  created_at?: string;
}
export interface PlanDay {
  id?: string;
  plan_id?: string;
  user_id?: string;
  day_of_week: number;
  day_name?: string | null;
  focus?: string | null;
  is_rest_day: boolean;
  order_index?: number;
  exercises?: PlanExercise[];
  created_at?: string;
}
export interface CyclePlan {
  id?: string;
  user_id?: string;
  cycle_id?: string | null;
  name: string;
  goal: UserGoal;
  /** 'weekly' = 按周重复（默认）, 'daily' = 按天轮重复 */
  duration_type?: 'weekly' | 'daily';
  /** 周模式：持续周数 */
  duration_weeks?: number;
  /** 周模式：每周训练次数 */
  workouts_per_week?: number;
  /** 天轮模式：一轮包含的总训练天数 */
  total_days?: number;
  /** 天轮模式：重复轮数 */
  total_rounds?: number;
  start_date: string;
  notes?: string | null;
  days?: PlanDay[];
  tdee_adjusted?: number | null;
  created_at?: string;
  updated_at?: string;
}
export interface GeneratePlanRequest {
  goal: UserGoal;
  /** 'weekly'（默认）或 'daily' */
  duration_type?: 'weekly' | 'daily';
  /** 周模式专用 */
  duration_weeks?: number;
  workouts_per_week?: number;
  /** 天轮模式专用 */
  total_days?: number;
  total_rounds?: number;
  name?: string;
  day_keywords?: string[];
  preferences_context?: { muscle_group: string; exercises: string[] }[];
  pr_context?: PersonalRecord[];
  profile_context?: {
    age: number;
    weight_kg: number;
    height_cm: number;
    gender: string;
    activity_level: ActivityLevel;
    training_experience?: 'beginner' | 'intermediate' | 'advanced';
  };
}
// --- 今日看板 ---
export interface TodayDashboard {
  today_weekday: number;
  calorie_target: number;
  calories_consumed_today: number;
  weekly_calorie_burned: number;
  weekly_calorie_target: number;
  today_plan: PlanDay | null;
  total_planned_sets_today: number;
  workouts_completed_this_week: number;
  workouts_planned_this_week: number;
  active_cycle: {
    id: string;
    name: string;
    goal: UserGoal | null;
    tdee_adjusted: number | null;
    plan: CyclePlan | null;
  } | null;
  /** 今日完成度数据 */
  today_completion: {
    plan_id: string;
    plan_name: string;
    day_id: string;
    completions: { exercise_id: string; is_completed: boolean }[];
    total_exercises: number;
    completed_exercises: number;
    percentage: number;
  } | null;
  /** 所有可用的计划列表（用于计划选择器） */
  available_plans: CyclePlan[];
}
// --- 肌肉群常量 ---
export type MuscleGroup =
  | "chest" | "back" | "shoulders" | "legs" | "arms" | "core" | "cardio" | "full_body";
// --- 动作偏好 ---
export interface UserExercisePreference {
  id?: string;
  user_id?: string;
  muscle_group: MuscleGroup;
  exercise_name: string;
  exercise_type: ExerciseType;
  weight: number;
  usage_count: number;
  is_favorite: boolean;
  created_at?: string;
  updated_at?: string;
}
// --- 推荐动作（含上下文）---
export interface ExerciseRecommendation {
  exercise_name: string;
  exercise_type: ExerciseType;
  muscle_group: MuscleGroup;
  weight: number;
  usage_count: number;
  is_favorite: boolean;
  reason?: string;
}
// --- 动作完成度追踪 ---
export interface ExerciseCompletion {
  id?: string;
  user_id?: string;
  plan_id: string;
  day_id: string;
  exercise_id: string;
  completed_date: string;
  is_completed?: boolean;
  completed_sets?: number | null;
  completed_reps?: string | null;
  completed_weight_kg?: number | null;
  source?: 'manual' | 'auto';
  created_at?: string;
  updated_at?: string;
}
export interface CreateCompletionRequest {
  plan_id: string;
  day_id: string;
  exercise_id: string;
  completed_date?: string;
  completed_sets?: number | null;
  completed_reps?: string | null;
  completed_weight_kg?: number | null;
}
export interface PlanCompletionStats {
  /** 今日完成动作数 */
  today_completed: number;
  /** 今日计划总动作数 */
  today_total: number;
  /** 今日完成度百分比 (0-100) */
  today_percentage: number;
  /** 计划总完成天数（非休息日被完成的次数） */
  total_completed_days: number;
  /** 计划总训练天数（非休息日总数） */
  total_training_days: number;
  /** 计划整体完成度百分比 (0-100) */
  overall_percentage: number;
}