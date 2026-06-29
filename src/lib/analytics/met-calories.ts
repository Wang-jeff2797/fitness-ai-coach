// ============================================================
// MET 热量消耗估算引擎
// 纯计算，零 AI 消耗
// ============================================================

import type { Exercise, SessionData } from "@/types";

/**
 * 使用 MET 值估算单次动作的热量消耗
 * 公式: 卡路里/分钟 = MET × 体重(kg) × 3.5 ÷ 200
 */
export function estimateCaloriesByMet(
  met: number,
  weightKg: number,
  durationMinutes: number
): number {
  return Math.round((met * weightKg * 3.5 / 200) * durationMinutes);
}

/**
 * 估算完整训练会话的热量消耗
 */
export function estimateSessionCalories(
  sessionData: SessionData,
  weightKg: number,
  metLookup: (actionName: string) => number | undefined
): number {
  const allExercises = [
    ...(sessionData.exercises ?? []),
    ...(sessionData.cardio_exercises ?? []),
  ];

  let totalCalories = 0;

  for (const ex of allExercises) {
    const met = getMetForExercise(ex.name, metLookup);
    let durationMin = ex.total_duration_minutes ?? 0;

    if (ex.is_cardio) {
      // 有氧运动直接用持续时间
      totalCalories += estimateCaloriesByMet(met, weightKg, durationMin);
    } else {
      // 力量训练按实际训练时间估算
      if (durationMin <= 0) {
        // 若无明确时间，每 SET 约 30-60 秒 + 组间休息
        const workSets = ex.sets.filter((s) => !s.is_warmup);
        const workTimeMin = workSets.length * 0.75; // 每组 45 秒
        const restTimeMin = workSets.length * 1.5; // 组间休息 90 秒
        durationMin = workTimeMin + restTimeMin;
      }
      totalCalories += estimateCaloriesByMet(met, weightKg, durationMin);
    }
  }

  return Math.round(totalCalories);
}

/**
 * 获取动作的 MET 值
 * 先在查找函数中搜索，若未找到则用通用值
 */
function getMetForExercise(
  name: string,
  metLookup: (actionName: string) => number | undefined
): number {
  const met = metLookup(name);
  if (met !== undefined) return met;

  // 通用默认值
  const defaultMets: Record<string, number> = {
    strength: 4.0,
    cardio: 6.0,
  };

  // 根据常见词推断
  const lowerName = name.toLowerCase();
  if (lowerName.includes('跑') || lowerName.includes('游') ||
      lowerName.includes('跳') || lowerName.includes('骑') ||
      lowerName.includes('划')) {
    return defaultMets.cardio;
  }
  return defaultMets.strength;
}

/**
 * 从数据库中查找可用的动作名称
 * 模糊匹配（精确匹配、包含匹配）
 */
export function findMetMatch(
  actionName: string,
  metEntries: { action_name: string; met_value: number }[]
): number | undefined {
  const lowerName = actionName.toLowerCase().trim();

  // 1. 精确匹配
  const exact = metEntries.find(
    (e) => e.action_name.toLowerCase() === lowerName
  );
  if (exact) return exact.met_value;

  // 2. 包含匹配
  const contains = metEntries.find(
    (e) => lowerName.includes(e.action_name.toLowerCase()) ||
            e.action_name.toLowerCase().includes(lowerName)
  );
  if (contains) return contains.met_value;

  // 3. 关键词匹配
  const keywords: Record<string, string> = {
    '卧推': '平板卧推',
    '深蹲': '深蹲',
    '硬拉': '硬拉',
    '划船': '杠铃划船',
    '引体': '引体向上',
    '弯举': '二头弯举',
    '下压': '三头下压',
    '飞鸟': '哑铃飞鸟',
    '推举': '推举',
    '侧平举': '哑铃侧平举',
    '支撑': '平板支撑',
    '俯卧撑': '俯卧撑',
    '臂屈伸': '双杠臂屈伸',
    '臀推': '臀推',
    '腿举': '腿举',
    '跑步': '跑步',
    '游泳': '自由泳',
    '骑行': '骑行',
    '跳绳': '跳绳',
  };

  for (const [kw, mapped] of Object.entries(keywords)) {
    if (lowerName.includes(kw)) {
      const match = metEntries.find(
        (e) => e.action_name.toLowerCase() === mapped
      );
      if (match) return match.met_value;
    }
  }

  return undefined;
}
