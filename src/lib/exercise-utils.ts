// ============================================================
// 动作工具：模糊匹配、归一化、强度计算
// ============================================================
// 同义动作映射（不同中文描述 → 标准名）
const EXERCISE_SYNONYMS: Record<string, string> = {
  "臀桥": "臀推",
  "髋推": "臀推",
  "蚌式开合": "臀推",
  "俯身划船": "杠铃划船",
  "反手引体": "引体向上",
  "正手引体": "引体向上",
  "宽距卧推": "平板卧推",
  "窄距卧推": "平板卧推",
  "上斜飞鸟": "哑铃上斜飞鸟",
  "平凳飞鸟": "哑铃平板飞鸟",
  "坐姿推肩": "哑铃推举",
  "站姿推肩": "杠铃推举",
  "前平举": "哑铃前平举",
  "弯举": "哑铃弯举",
  "锤式": "锤式弯举",
  "下压": "三头绳索下压",
  "颈后臂屈伸": "三头绳索下压",
  "卷腹": "卷腹",
  "举腿": "悬垂举腿",
  "跑步机": "跑步",
  "动感单车": "骑行",
  "椭圆机": "椭圆机",
};
// 强度等级
export type IntensityLevel = "easy" | "normal" | "hard";
// 1RM 估算公式（Epley 公式，权威运动科学文献）
export function estimate1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  // Epley: 1RM = w × (1 + r/30)
  return Math.round(weight * (1 + reps / 30));
}
// 训练强度百分比（相对于 1RM）
export function intensityPercent(weight: number, reps: number, estimated1RM: number): number {
  if (estimated1RM <= 0 || weight <= 0) return 0;
  return Math.round((weight / estimated1RM) * 100);
}
// 基于 RPE 的强度等级（权威 RPE 量表改编）
export function calcIntensityLevel(
  targetSets: number,
  targetReps: string,
  targetWeightKg: number | null | undefined,
  rpeTarget: number | null | undefined,
): IntensityLevel {
  // 解析次数范围
  const repsNum = parseInt(targetReps.split("-")[0]) || parseInt(targetReps) || 10;
  // 没有重量数据 → 基于 RPE 判断
  if (!targetWeightKg || targetWeightKg <= 0) {
    if (!rpeTarget) return "normal";
    if (rpeTarget <= 6.5) return "easy";
    if (rpeTarget <= 8) return "normal";
    return "hard";
  }
  // 有重量 → 基于 1RM 百分比判断
  const eRM = estimate1RM(targetWeightKg, repsNum);
  const pct = intensityPercent(targetWeightKg, repsNum, eRM);
  // 公认的强度区间（NSCA 指南）:
  // < 50% 1RM: 轻松
  // 50-70% 1RM: 中等（肌耐力/肌肥大）
  // 70-85% 1RM: 困难（肌肥大/力量）
  // > 85% 1RM: 极限
  if (pct < 50) return "easy";
  if (pct <= 72) return "normal";
  return "hard";
}
// 计算单个动作的"强度得分"（用于颜色量化）
export function calcExerciseScore(
  targetSets: number,
  targetReps: string,
  targetWeightKg: number | null | undefined,
): number {
  const repsNum = parseInt(targetReps.split("-")[0]) || parseInt(targetReps) || 10;
  if (!targetWeightKg || targetWeightKg <= 0) return 3; // 默认中等
  const volume = targetSets * repsNum * targetWeightKg;
  // 得分归一化到 1-10
  return Math.min(Math.max(Math.round(volume / 500 + 1), 1), 10);
}
// 计算一天的强度水平（基于所有动作）
export function calcDayIntensity(exercises: { target_sets: number; target_reps: string; target_weight_kg?: number | null; rpe_target?: number | null }[]): IntensityLevel {
  if (!exercises || exercises.length === 0) return "normal";
  const scores = exercises.map(e => {
    if (e.rpe_target) {
      if (e.rpe_target <= 6.5) return 2;
      if (e.rpe_target <= 8) return 5;
      return 8;
    }
    return calcExerciseScore(e.target_sets, e.target_reps, e.target_weight_kg);
  });
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (avg < 3) return "easy";
  if (avg <= 6) return "normal";
  return "hard";
}
// 计算整周/周期容量
export function calcTotalVolume(exercises: { target_sets: number; target_reps: string; target_weight_kg?: number | null }[]): number {
  return exercises.reduce((sum, e) => {
    const repsNum = parseInt(e.target_reps.split("-")[0]) || parseInt(e.target_reps) || 10;
    return sum + e.target_sets * repsNum * (e.target_weight_kg || 0);
  }, 0);
}
// 强度颜色映射
export const INTENSITY_COLORS: Record<IntensityLevel, { bg: string; text: string; border: string; badge: string }> = {
  easy: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", badge: "bg-green-100 text-green-700" },
  normal: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", badge: "bg-blue-100 text-blue-700" },
  hard: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", badge: "bg-orange-100 text-orange-700" },
};
// 模糊匹配：归一化动作名
export function normalizeExerciseName(input: string): string {
  const trimmed = input.trim();
  // 直接匹配同义映射
  if (EXERCISE_SYNONYMS[trimmed]) return EXERCISE_SYNONYMS[trimmed];
  // 子串匹配
  for (const [alias, standard] of Object.entries(EXERCISE_SYNONYMS)) {
    if (trimmed.includes(alias) || alias.includes(trimmed)) return standard;
  }
  return trimmed;
}
// 搜索匹配（支持模糊）
export function fuzzyMatchExercises(query: string, exerciseList: { name: string }[]): { name: string; score: number }[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const results: { name: string; score: number }[] = [];
  for (const ex of exerciseList) {
    const name = ex.name.toLowerCase();
    // 精确子串
    if (name.includes(q)) {
      results.push({ name: ex.name, score: q.length / name.length });
      continue;
    }
    // 拼音首字母或部分匹配（简化：逐字匹配）
    let matchCount = 0;
    for (const char of q) {
      if (name.includes(char)) matchCount++;
    }
    if (matchCount >= q.length * 0.6) {
      results.push({ name: ex.name, score: matchCount / q.length });
    }
  }
  return results.sort((a, b) => b.score - a.score);
}
// 肌肉群关键字 → 标准映射
export const MUSCLE_KEYWORDS: Record<string, { label: string; muscleGroups: string[] }> = {
  chest: { label: "胸", muscleGroups: ["chest"] },
  back: { label: "背", muscleGroups: ["back"] },
  legs: { label: "腿", muscleGroups: ["legs"] },
  shoulders: { label: "肩", muscleGroups: ["shoulders"] },
  arms: { label: "手臂", muscleGroups: ["arms"] },
  core: { label: "核心", muscleGroups: ["core"] },
  cardio: { label: "有氧", muscleGroups: ["cardio"] },
  full_body: { label: "全身", muscleGroups: ["chest", "back", "legs"] },
  push: { label: "推", muscleGroups: ["chest", "shoulders"] },
  pull: { label: "拉", muscleGroups: ["back", "arms"] },
  upper: { label: "上肢", muscleGroups: ["chest", "back", "shoulders", "arms"] },
  lower: { label: "下肢", muscleGroups: ["legs"] },
};
// 周一到周日中文名
export const WEEKDAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
// 所有动作名称列表（用于搜索）— 注意需要在浏览器端动态导入 exercise-library
export const COMMON_DAY_KEYWORDS = [
  { key: "chest", label: "胸", desc: "胸部训练" },
  { key: "back", label: "背", desc: "背部训练" },
  { key: "legs", label: "腿", desc: "腿部训练" },
  { key: "shoulders", label: "肩", desc: "肩部训练" },
  { key: "arms", label: "手臂", desc: "手臂训练" },
  { key: "core", label: "核心", desc: "核心训练" },
  { key: "cardio", label: "有氧", desc: "有氧训练" },
  { key: "push", label: "推", desc: "推力日（胸+肩+三头）" },
  { key: "pull", label: "拉", desc: "拉力日（背+二头）" },
  { key: "upper", label: "上肢", desc: "上肢综合" },
  { key: "lower", label: "下肢", desc: "下肢综合" },
  { key: "full_body", label: "全身", desc: "全身综合训练" },
  { key: "rest", label: "休息", desc: "休息日" },
];