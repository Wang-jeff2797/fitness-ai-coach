// ============================================================
// 1RM 估算工具
// 使用 Brzycki 公式: 1RM = 重量 × (36 / (37 - 次数))
// 纯计算，零 AI 消耗
// ============================================================

/**
 * Brzycki 公式估算 1RM
 * 仅在 reps <= 10 时准确，reps > 10 时精度下降
 */
export function estimate1RM(weightKg: number, reps: number): number {
  if (reps === 1) return weightKg;
  if (reps <= 0 || weightKg <= 0) return 0;
  
  // Brzycki: 1RM = W × (36 / (37 - R))
  const oneRM = weightKg * (36 / (37 - Math.min(reps, 36)));
  return Math.round(oneRM * 100) / 100;
}

/**
 * 从最佳组（最高重量×次数）估算 1RM
 */
export function estimate1RMFromBestSet(
  sets: { weight_kg: number; reps: number }[]
): number {
  let best1RM = 0;
  for (const set of sets) {
    if (set.reps <= 0 || set.weight_kg <= 0) continue;
    const est = estimate1RM(set.weight_kg, set.reps);
    if (est > best1RM) best1RM = est;
  }
  return best1RM;
}

/**
 * 根据目标重复次数和 1RM 计算训练重量
 */
export function calculateTrainingWeight(
  oneRM: number,
  targetReps: number
): number {
  // 反向 Brzycki: W = 1RM × (37 - R) / 36
  const weight = oneRM * (37 - Math.min(targetReps, 36)) / 36;
  return Math.round(weight * 100) / 100;
}
