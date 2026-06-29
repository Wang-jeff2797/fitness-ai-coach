import type {
  Workout,
  SessionData,
  Exercise,
  ExerciseSet,
  CycleSummary,
  ExerciseSummary,
  RPE,
} from "@/types";
/**
 * 计算单个周期的训练摘要
 * 纯计算，无 AI 调用
 */
export function computeCycleSummary(workouts: Workout[]): CycleSummary {
  if (workouts.length === 0) {
    return {
      total_workouts: 0,
      total_volume_kg: 0,
      average_volume_per_session: 0,
      average_session_rpe: 5 as RPE,
      volume_trend: "stable",
      pr_sets: 0,
      exercises_summary: [],
    };
  }
  // 按执行时间排序
  const sorted = [...workouts].sort(
    (a, b) =>
      new Date(a.performed_at).getTime() - new Date(b.performed_at).getTime()
  );
  const totalWorkouts = sorted.length;
  let totalVolume = 0;
  let totalRpe = 0;
  let prSets = 0;
  // 按动作名聚合
  const exerciseMap = new Map<string, ExerciseSummary & { rpeSum: number; rpeCount: number }>();
  for (const w of sorted) {
    const data = w.session_data;
    totalVolume += data.total_volume_kg ?? 0;
    totalRpe += data.session_rpe;
    const allExercises = [
      ...(data.exercises ?? []),
      ...(data.cardio_exercises ?? []),
    ];
    for (const ex of allExercises) {
      const existing = exerciseMap.get(ex.name) ?? createEmptySummary(ex);
      // 力量动作统计
      if (!ex.is_cardio && ex.sets) {
        for (const set of ex.sets) {
          if (!set.is_warmup) {
            existing.total_sets += 1;
            existing.total_reps += set.reps;
            existing.total_volume_kg += set.weight_kg * set.reps;
            existing.rpeSum += set.rpe;
            existing.rpeCount += 1;
            // PR 检测: 最佳重量×次数组合
            if (
              !existing.best_set ||
              set.weight_kg * set.reps >
                existing.best_set.weight_kg * existing.best_set.reps
            ) {
              existing.best_set = {
                weight_kg: set.weight_kg,
                reps: set.reps,
                rpe: set.rpe,
                date: w.performed_at.slice(0, 10),
              };
            }
          }
        }
      }
      exerciseMap.set(ex.name, existing);
    }
  }
  // 计算 PR 组：当前周期内出现的新 PR
  for (const summary of Array.from(exerciseMap.values())) {
    if (summary.best_set) {
      prSets += 1;
    }
  }
  const avgRpe =
    totalWorkouts > 0
      ? Math.round((totalRpe / totalWorkouts) * 10) / 10
      : 5;
  // 容量趋势判断: 将训练按时间分成两半比较
  const volumeTrend = computeVolumeTrend(sorted);
  return {
    total_workouts: totalWorkouts,
    total_volume_kg: totalVolume,
    average_volume_per_session:
      totalWorkouts > 0 ? Math.round(totalVolume / totalWorkouts) : 0,
    average_session_rpe: Math.min(10, Math.max(1, Math.round(avgRpe))) as RPE,
    volume_trend: volumeTrend,
    pr_sets: prSets,
    exercises_summary: Array.from(exerciseMap.values()).map((e) => ({
      exercise: e.exercise,
      exercise_type: e.exercise_type,
      total_sets: e.total_sets,
      total_reps: e.total_reps,
      total_volume_kg: e.total_volume_kg,
      best_set: e.best_set,
      average_rpe:
        e.rpeCount > 0
          ? Math.round((e.rpeSum / e.rpeCount) * 10) / 10
          : 0,
    })),
  };
}
function createEmptySummary(ex: Exercise): ExerciseSummary & {
  rpeSum: number;
  rpeCount: number;
} {
  return {
    exercise: ex.name,
    exercise_type: ex.exercise_type,
    total_sets: 0,
    total_reps: 0,
    total_volume_kg: 0,
    best_set: null,
    average_rpe: 0,
    rpeSum: 0,
    rpeCount: 0,
  };
}
function computeVolumeTrend(workouts: Workout[]): "increasing" | "stable" | "decreasing" {
  if (workouts.length < 3) return "stable";
  const mid = Math.floor(workouts.length / 2);
  const firstHalf = workouts.slice(0, mid);
  const secondHalf = workouts.slice(mid);
  const firstAvg =
    firstHalf.reduce((s, w) => s + (w.session_data.total_volume_kg ?? 0), 0) /
    firstHalf.length;
  const secondAvg =
    secondHalf.reduce((s, w) => s + (w.session_data.total_volume_kg ?? 0), 0) /
    secondHalf.length;
  const ratio = secondAvg / firstAvg;
  if (ratio > 1.05) return "increasing";
  if (ratio < 0.95) return "decreasing";
  return "stable";
}