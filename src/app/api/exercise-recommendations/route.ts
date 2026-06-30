import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { MUSCLE_GROUPS, findExerciseType } from "@/lib/exercise-library";
import type { ExerciseRecommendation, MuscleGroup } from "@/types";
/** GET /api/exercise-recommendations?muscle_group=chest&q=卧推 */
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const muscleGroup = searchParams.get("muscle_group") as MuscleGroup | null;
  const query = searchParams.get("q")?.toLowerCase() || "";
  // 1. 从数据库获取用户偏好
  let prefQuery = supabase
    .from("user_exercise_preferences")
    .select("*")
    .eq("user_id", user.id)
    .order("weight", { ascending: false });
  if (muscleGroup) prefQuery = prefQuery.eq("muscle_group", muscleGroup);
  const { data: preferences } = await prefQuery;
  const prefMap = new Map<string, any>();
  (preferences || []).forEach(p => prefMap.set(p.exercise_name, p));
  // 2. 从用户训练历史中统计实际使用频率
  const { data: workouts } = await supabase
    .from("workouts")
    .select("session_data")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);
  const usageCount = new Map<string, number>();
  (workouts || []).forEach(w => {
    const exercises: any[] = (w as any).session_data?.exercises || [];
    exercises.forEach((ex: any) => {
      const name = ex.name || "";
      usageCount.set(name, (usageCount.get(name) || 0) + 1);
    });
  });
  // 3. 构建推荐列表
  const recommendations: ExerciseRecommendation[] = [];
  // 合并：偏好 + 动作库
  const processMuscleGroup = (mg: string) => {
    const lib = MUSCLE_GROUPS[mg];
    if (!lib) return;
    for (const ex of lib.exercises) {
      // 搜索过滤
      if (query && !ex.name.includes(query)) continue;
      const pref = prefMap.get(ex.name);
      const count = usageCount.get(ex.name) || 0;
      const prefWeight = pref?.weight ?? (count > 0 ? 0.4 : 0.05);
      // 权重 = 偏好权重 + 使用频率因子
      const finalWeight = Math.min(prefWeight + count * 0.02, 1.0);
      recommendations.push({
        exercise_name: ex.name,
        exercise_type: ex.type as any,
        muscle_group: mg as MuscleGroup,
        weight: Math.round(finalWeight * 100) / 100,
        usage_count: Math.max(pref?.usage_count || 0, count),
        is_favorite: pref?.is_favorite || false,
        reason: count > 0
          ? `使用过 ${count} 次`
          : pref ? "已收藏" : "常见动作",
      });
    }
  };
  if (muscleGroup) {
    processMuscleGroup(muscleGroup);
  } else {
    // 全部肌肉群
    for (const mg of Object.keys(MUSCLE_GROUPS)) {
      processMuscleGroup(mg);
    }
  }
  // 4. 按权重排序
  recommendations.sort((a, b) => b.weight - a.weight);
  // 5. 如果有搜索关键词，还尝试从历史中补充
  if (query) {
    usageCount.forEach((count, name) => {
      if (name.toLowerCase().includes(query) && !recommendations.some(r => r.exercise_name === name)) {
        recommendations.push({
          exercise_name: name,
          exercise_type: (findExerciseType(name) || "other") as any,
          muscle_group: (muscleGroup || "full_body") as MuscleGroup,
          weight: Math.min(count * 0.03, 0.5),
          usage_count: count,
          is_favorite: false,
          reason: `使用过 ${count} 次`,
        });
      }
    });
  }
  return NextResponse.json({ recommendations: recommendations.slice(0, 15) });
}