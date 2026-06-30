// ============================================================
// 自动 PR 计算：从训练记录中提取最佳 1RM
// ============================================================
import { estimate1RM } from "./1rm";

/**
 * 从一次训练的动作列表中，计算每个动作的最佳 1RM
 * 返回 Map<动作名, 最佳1RM>
 */
export function best1RMFromExercises(exercises: any[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const ex of exercises || []) {
    const name = ex.name;
    if (!name) continue;
    let best = 0;
    for (const set of ex.sets || []) {
      if (set.is_warmup) continue;
      const w = Number(set.weight_kg);
      const r = Number(set.reps);
      if (w <= 0 || r <= 0) continue;
      const est = estimate1RM(w, r);
      if (est > best) best = est;
    }
    if (best > 0) result.set(name, best);
  }
  return result;
}

/**
 * 隐藏权重 blend：将用户输入 PR 与系统计算 PR 混合
 * - estimated_1rm: 用户手动设置/确认的 PR（显示用）
 * - calculated_1rm: 系统从实际训练数据计算的 PR
 * - manualWeight: 用户输入 PR 的权重（默认 0.7）
 * 返回 blend 值（供内部决策使用，不直接显示）
 */
export function blendPR(
  estimated_1rm: number,
  calculated_1rm: number | null | undefined,
  manualWeight = 0.7
): number {
  const calc = calculated_1rm || 0;
  if (calc <= 0) return estimated_1rm;
  if (estimated_1rm <= 0) return calc;
  return Math.round(estimated_1rm * manualWeight + calc * (1 - manualWeight));
}

/**
 * 获取作用于显示百分比的 PR（始终用用户输入的 PR）
 */
export function displayPR(record: { estimated_1rm: number; calculated_1rm?: number | null }): number {
  return record.estimated_1rm > 0 ? record.estimated_1rm : (record.calculated_1rm || 0);
}
