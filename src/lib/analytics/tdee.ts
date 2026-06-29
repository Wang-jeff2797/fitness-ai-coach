// ============================================================
// TDEE 计算引擎 + 生活反馈修正 + MET 热量估算
// 纯计算，零 AI 消耗
// ============================================================

import type { ActivityLevel, TdeeResult, LifestyleFeedback } from "@/types";

// --- 基础 PAL 值 ---
const BASE_PAL: Record<ActivityLevel, number> = {
  sedentary: 1.2,   // 久坐
  light: 1.375,     // 轻度活动 1-3天/周
  moderate: 1.55,   // 中度活动 3-5天/周
  active: 1.725,    // 积极活动 6-7天/周
  very_active: 1.9, // 高强度活动
};

/**
 * Mifflin-St Jeor BMR 计算
 */
export function calculateBMR(
  gender: string,
  weightKg: number,
  heightCm: number,
  age: number
): number {
  if (gender === 'female') {
    return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age - 161);
  }
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + 5);
}

/**
 * 根据生活反馈修正 PAL
 * - 睡眠≤2 或 压力≥4 → PAL -0.1
 * - 生病 → PAL -0.15
 * - 活动增加 → PAL +0.1
 */
export function adjustPAL(
  basePal: number,
  feedback?: LifestyleFeedback
): number {
  if (!feedback) return basePal;

  let adjusted = basePal;

  if (feedback.sleep_quality <= 2) adjusted -= 0.1;
  if (feedback.stress_level >= 4) adjusted -= 0.1;
  if (feedback.special_condition === 'sick') adjusted -= 0.15;
  if (feedback.activity_change === 'more') adjusted += 0.1;

  // 限制 PAL 在合理范围
  return Math.max(1.1, Math.min(2.5, Math.round(adjusted * 100) / 100));
}

/**
 * 完整 TDEE 计算
 */
export function calculateTDEE(
  gender: string,
  weightKg: number,
  heightCm: number,
  age: number,
  activityLevel: ActivityLevel,
  feedback?: LifestyleFeedback
): TdeeResult {
  const bmr = calculateBMR(gender, weightKg, heightCm, age);
  const basePal = BASE_PAL[activityLevel] ?? 1.55;
  const pal = adjustPAL(basePal, feedback);
  const tdeeBaseline = Math.round(bmr * basePal);
  const tdeeAdjusted = Math.round(bmr * pal);

  return {
    bmr,
    tdee_baseline: tdeeBaseline,
    pal,
    tdee_adjusted: tdeeAdjusted,
    adjustments: {
      sleep_adjustment: (feedback?.sleep_quality ?? 3) <= 2 ? -0.1 : 0,
      stress_adjustment: (feedback?.stress_level ?? 2) >= 4 ? -0.1 : 0,
      activity_change_adjustment: feedback?.activity_change === 'more' ? 0.1 : 0,
      sick_adjustment: feedback?.special_condition === 'sick' ? -0.15 : 0,
    },
  };
}

/**
 * 根据目标计算推荐热量缺口/盈余
 */
export function getCalorieTarget(tdee: number, goal?: string): number {
  switch (goal) {
    case 'fat_loss':
      return tdee - 300; // 温和减脂
    case 'muscle_gain':
      return tdee + 300; // 增肌盈余
    case 'strength':
      return tdee + 100; // 力量小幅盈余
    case 'endurance':
      return tdee + 200;
    default:
      return tdee; // 维持
  }
}
