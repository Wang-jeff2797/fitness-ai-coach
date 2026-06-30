// ============================================================
// 动作库：肌肉群 → 常用动作映射
// 用于偏好设置、AI 推荐、计划生成
// ============================================================

export interface MuscleGroupEntry {
  label: string;
  icon: string;
  exercises: { name: string; type: string; is_compound: boolean }[];
}

export const MUSCLE_GROUPS: Record<string, MuscleGroupEntry> = {
  chest: {
    label: "胸部",
    icon: "🏋️",
    exercises: [
      { name: "平板卧推", type: "bench_press", is_compound: true },
      { name: "上斜卧推", type: "bench_press", is_compound: true },
      { name: "下斜卧推", type: "bench_press", is_compound: true },
      { name: "哑铃平板飞鸟", type: "dumbbell_fly", is_compound: false },
      { name: "哑铃上斜飞鸟", type: "dumbbell_fly", is_compound: false },
      { name: "绳索夹胸", type: "cable_crossover", is_compound: false },
      { name: "俯卧撑", type: "push_up", is_compound: true },
      { name: "双杠臂屈伸", type: "dip", is_compound: true },
      { name: "哑铃平板卧推", type: "bench_press", is_compound: true },
      { name: "器械推胸", type: "other", is_compound: true },
    ],
  },
  back: {
    label: "背部",
    icon: "🎯",
    exercises: [
      { name: "杠铃划船", type: "barbell_row", is_compound: true },
      { name: "引体向上", type: "pull_up", is_compound: true },
      { name: "高位下拉", type: "pull_up", is_compound: true },
      { name: "坐姿划船", type: "barbell_row", is_compound: true },
      { name: "哑铃单臂划船", type: "barbell_row", is_compound: true },
      { name: "T杠划船", type: "barbell_row", is_compound: true },
      { name: "直臂下压", type: "tricep_pushdown", is_compound: false },
      { name: "面拉", type: "face_pull", is_compound: false },
      { name: "罗马尼亚硬拉", type: "deadlift", is_compound: true },
    ],
  },
  shoulders: {
    label: "肩部",
    icon: "💪",
    exercises: [
      { name: "杠铃推举", type: "overhead_press", is_compound: true },
      { name: "哑铃推举", type: "dumbbell_shoulder_press", is_compound: true },
      { name: "哑铃侧平举", type: "lateral_raise", is_compound: false },
      { name: "哑铃前平举", type: "lateral_raise", is_compound: false },
      { name: "面拉", type: "face_pull", is_compound: false },
      { name: "阿诺德推举", type: "dumbbell_shoulder_press", is_compound: true },
      { name: "器械推肩", type: "overhead_press", is_compound: true },
    ],
  },
  legs: {
    label: "腿部",
    icon: "🦵",
    exercises: [
      { name: "深蹲", type: "squat", is_compound: true },
      { name: "硬拉", type: "deadlift", is_compound: true },
      { name: "腿举", type: "leg_press", is_compound: true },
      { name: "腿弯举", type: "leg_curl", is_compound: false },
      { name: "腿屈伸", type: "leg_extension", is_compound: false },
      { name: "罗马尼亚硬拉", type: "deadlift", is_compound: true },
      { name: "保加利亚分腿蹲", type: "squat", is_compound: true },
      { name: "臀推", type: "hip_thrust", is_compound: true },
      { name: "提踵", type: "calf_raise", is_compound: false },
      { name: "箭步蹲", type: "squat", is_compound: true },
    ],
  },
  arms: {
    label: "手臂",
    icon: "💪",
    exercises: [
      { name: "杠铃弯举", type: "bicep_curl", is_compound: false },
      { name: "哑铃弯举", type: "bicep_curl", is_compound: false },
      { name: "锤式弯举", type: "bicep_curl", is_compound: false },
      { name: "绳索弯举", type: "bicep_curl", is_compound: false },
      { name: "三头绳索下压", type: "tricep_pushdown", is_compound: false },
      { name: "窄距卧推", type: "bench_press", is_compound: true },
      { name: "颈后臂屈伸", type: "tricep_pushdown", is_compound: false },
      { name: "双杠臂屈伸", type: "dip", is_compound: true },
    ],
  },
  core: {
    label: "核心",
    icon: "🔥",
    exercises: [
      { name: "平板支撑", type: "plank", is_compound: false },
      { name: "卷腹", type: "other", is_compound: false },
      { name: "悬垂举腿", type: "other", is_compound: false },
      { name: "俄罗斯转体", type: "other", is_compound: false },
      { name: "死虫式", type: "other", is_compound: false },
      { name: "反向卷腹", type: "other", is_compound: false },
    ],
  },
  cardio: {
    label: "有氧",
    icon: "🏃",
    exercises: [
      { name: "跑步", type: "running", is_compound: true },
      { name: "骑行", type: "cycling", is_compound: true },
      { name: "游泳", type: "swimming", is_compound: true },
      { name: "划船机", type: "rowing", is_compound: true },
      { name: "跳绳", type: "jumping_rope", is_compound: true },
      { name: "椭圆机", type: "other", is_compound: true },
    ],
  },
};

/** 获取某个肌肉群推荐的默认动作列表（前3个为高偏好） */
export function getDefaultExercises(muscleGroup: string): string[] {
  return (MUSCLE_GROUPS[muscleGroup]?.exercises || []).map(e => e.name);
}

/** 根据肌肉群找动作类型 */
export function findExerciseType(exerciseName: string): string {
  for (const g of Object.values(MUSCLE_GROUPS)) {
    for (const e of g.exercises) {
      if (e.name === exerciseName) return e.type;
    }
  }
  return "other";
}

/** 查找动作所属的肌肉群们（一个动作可能归属多个肌群） */
export function findMuscleGroups(exerciseName: string): string[] {
  const result: string[] = [];
  for (const [key, g] of Object.entries(MUSCLE_GROUPS)) {
    if (g.exercises.some(e => e.name === exerciseName)) result.push(key);
  }
  return result;
}
