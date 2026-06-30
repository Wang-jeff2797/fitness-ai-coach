import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getServerUser } from "@/lib/supabase/server";
import { calculateTDEE, getCalorieTarget } from "@/lib/analytics/tdee";
import type { TodayDashboard, CyclePlan, PlanDay } from "@/types";
export const dynamic = 'force-dynamic';
function getWeekRange(ref: Date): { start: Date; end: Date } {
  const d = new Date(ref);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}
export async function GET(_: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const supabase = await createServerSupabaseClient();
    // --- 用户资料 ---
    const { data: profile } = await supabase
      .from("users").select("*").eq("id", user.id).maybeSingle();
    // --- 活跃周期 ---
    const { data: activeCycle } = await supabase
      .from("cycles").select("*").eq("user_id", user.id).eq("is_active", true).maybeSingle();
    // --- 今日生活反馈（用于 TDEE 修正）---
    let tdeeAdjusted = 0;
    let calorieTarget = 0;
    if (activeCycle) {
      const { data: fb } = await supabase
        .from("lifestyle_feedback")
        .select("*").eq("cycle_id", activeCycle.id).eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1).maybeSingle();
      const t = calculateTDEE(
        profile?.gender || 'male',
        Number(profile?.weight_kg) || 70,
        Number(profile?.height_cm) || 175,
        profile?.age || 25,
        profile?.activity_level || 'moderate',
        fb || undefined,
      );
      tdeeAdjusted = activeCycle.tdee_adjusted || t.tdee_adjusted;
      calorieTarget = getCalorieTarget(tdeeAdjusted, activeCycle.goal || profile?.goal);
    } else {
      const t = calculateTDEE(
        profile?.gender || 'male',
        Number(profile?.weight_kg) || 70,
        Number(profile?.height_cm) || 175,
        profile?.age || 25,
        profile?.activity_level || 'moderate',
      );
      tdeeAdjusted = t.tdee_adjusted;
      calorieTarget = getCalorieTarget(tdeeAdjusted, profile?.goal);
    }
    // --- 周期关联的计划 ---
    let activePlan: CyclePlan | null = null;
    if (activeCycle?.plan_id) {
      const { data: plan } = await supabase
        .from("cycle_plans").select("*").eq("id", activeCycle.plan_id).maybeSingle();
      if (plan) {
        const { data: days } = await supabase
          .from("plan_days").select("*").eq("plan_id", plan.id).order("order_index");
        const { data: exs } = await supabase
          .from("plan_exercises").select("*").eq("plan_id", plan.id).order("order_index");
        const dayMap = new Map<string, PlanDay>();
        for (const d of days || []) dayMap.set(d.id, { ...(d as any), exercises: [] });
        for (const e of exs || []) {
          const day = dayMap.get(e.day_id);
          if (day) day.exercises?.push(e as any);
        }
        activePlan = { ...(plan as any), days: Array.from(dayMap.values()) };
      }
    }
    // --- 今日 day_of_week（0=周日）---
    const today = new Date();
    const todayDow = today.getDay();
    const todayStr = today.toISOString().slice(0, 10);
    // --- 今日计划（匹配 day_of_week）---
    let todayPlan: PlanDay | null = null;
    let totalSetsToday = 0;
    if (activePlan?.days) {
      for (const d of activePlan.days) {
        if (d.day_of_week === todayDow) {
          todayPlan = d;
          totalSetsToday = (d.exercises || []).reduce((s, e) => s + (e.target_sets || 0), 0);
          break;
        }
      }
    }
    // --- 今日已消耗（今日 workouts 中记录的 kcal）---
    const start = new Date(todayStr + "T00:00:00");
    const end = new Date(todayStr + "T23:59:59");
    const { data: todayWorkouts } = await supabase
      .from("workouts")
      .select("session_data, performed_at")
      .eq("user_id", user.id)
      .gte("performed_at", start.toISOString())
      .lte("performed_at", end.toISOString());
    let caloriesToday = 0;
    for (const w of todayWorkouts || []) {
      const note = (w.session_data as any)?.notes || "";
      const m = note.match(/预估消耗:\s*(\d+)\s*kcal/);
      if (m) caloriesToday += Number(m[1]);
    }
    // --- 本周已完成训练数 + 本周总消耗 ---
    const week = getWeekRange(today);
    const { data: weekWorkouts } = await supabase
      .from("workouts")
      .select("session_data, performed_at")
      .eq("user_id", user.id)
      .gte("performed_at", week.start.toISOString())
      .lte("performed_at", week.end.toISOString());
    let weekCalories = 0;
    for (const w of weekWorkouts || []) {
      const note = (w.session_data as any)?.notes || "";
      const m = note.match(/预估消耗:\s*(\d+)\s*kcal/);
      if (m) weekCalories += Number(m[1]);
    }
    const weeklyCalorieTarget = tdeeAdjusted * 7;
    const workoutsCompletedThisWeek = weekWorkouts?.length || 0;
    const workoutsPlannedThisWeek = activePlan ? (activePlan.days?.filter(d => !d.is_rest_day).length || 0) : 0;
    // --- 今日完成度数据 ---
    let todayCompletionData = null;
    if (activePlan && todayPlan && !todayPlan.is_rest_day && todayPlan.exercises && todayPlan.exercises.length > 0) {
      const { data: todayCompletions } = await supabase
        .from("exercise_completions")
        .select("exercise_id")
        .eq("user_id", user.id)
        .eq("plan_id", activePlan.id)
        .eq("completed_date", todayStr);
      const completedIds = new Set((todayCompletions || []).map((c: any) => c.exercise_id));
      const completions = (todayPlan.exercises || []).map(ex => ({
        exercise_id: ex.id!,
        is_completed: completedIds.has(ex.id!),
      }));
      const totalExs = todayPlan.exercises.length;
      const completedExs = completions.filter(c => c.is_completed).length;
      todayCompletionData = {
        plan_id: activePlan.id!,
        plan_name: activePlan.name!,
        day_id: todayPlan.id!,
        completions,
        total_exercises: totalExs,
        completed_exercises: completedExs,
        percentage: totalExs > 0 ? Math.round((completedExs / totalExs) * 100) : 0,
      };
    }
    // --- 所有可用的计划（用于计划选择器）---
    const { data: allPlans } = await supabase
      .from("cycle_plans")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    const dashboard: TodayDashboard = {
      today_weekday: todayDow,
      calorie_target: calorieTarget,
      calories_consumed_today: caloriesToday,
      weekly_calorie_burned: weekCalories,
      weekly_calorie_target: weeklyCalorieTarget,
      today_plan: todayPlan,
      total_planned_sets_today: totalSetsToday,
      workouts_completed_this_week: workoutsCompletedThisWeek,
      workouts_planned_this_week: workoutsPlannedThisWeek,
      active_cycle: activeCycle ? {
        id: activeCycle.id,
        name: activeCycle.name,
        goal: activeCycle.goal,
        tdee_adjusted: tdeeAdjusted,
        plan: activePlan,
      } : null,
      // 新增完成度数据
      today_completion: todayCompletionData,
      available_plans: allPlans || [],
    };
    return NextResponse.json(dashboard);
  } catch (err) {
    console.error("dashboard GET error:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}