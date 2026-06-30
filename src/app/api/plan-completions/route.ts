import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getServerUser } from "@/lib/supabase/server";
import type { PlanCompletionStats, PlanDay } from "@/types";
export const dynamic = 'force-dynamic';
// ========= GET: 查询完成记录 =========
// 支持参数：
//   plan_id     - 计划 ID
//   date        - 日期 (YYYY-MM-DD)，默认今天
//   day_id      - 某天的完成记录
//   stats=true  - 返回该计划的完成度统计
export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get("plan_id");
    const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);
    const dayId = searchParams.get("day_id");
    const needStats = searchParams.get("stats") === "true";
    if (needStats && planId) {
      return await getPlanStats(supabase, user.id, planId, date);
    }
    // 查询完成记录
    let query = supabase
      .from("exercise_completions")
      .select("*")
      .eq("user_id", user.id);
    if (planId) query = query.eq("plan_id", planId);
    if (date) query = query.eq("completed_date", date);
    if (dayId) query = query.eq("day_id", dayId);
    const { data: completions } = await query.order("created_at", { ascending: true });
    return NextResponse.json({ completions: completions || [] });
  } catch (err) {
    console.error("plan-completions GET error:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
// ========= POST: 创建/更新完成记录 =========
// body 支持：
//   单条: { plan_id, day_id, exercise_id, completed_date, completed_sets, completed_reps, completed_weight_kg }
//   批量: { batch: [...] }
//   完成整个训练日: { complete_day: true, plan_id, day_id, completed_date }
export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const supabase = await createServerSupabaseClient();
    const body = await request.json();
    // --- 批量: 完成整个训练日 ---
    if (body.complete_day && body.plan_id && body.day_id) {
      const date = body.completed_date || new Date().toISOString().slice(0, 10);
      // 获取该天的所有动作
      const { data: exercises } = await supabase
        .from("plan_exercises")
        .select("id")
        .eq("day_id", body.day_id)
        .eq("plan_id", body.plan_id)
        .eq("user_id", user.id);
      if (!exercises || exercises.length === 0) {
        return NextResponse.json({ error: "该训练日没有动作" }, { status: 400 });
      }
      // 批量插入（使用 upsert 避免重复）
      const records = exercises.map(ex => ({
        user_id: user.id,
        plan_id: body.plan_id,
        day_id: body.day_id,
        exercise_id: ex.id,
        completed_date: date,
        source: 'manual' as const,
      }));
      const { error } = await supabase
        .from("exercise_completions")
        .upsert(records, {
          onConflict: "user_id, exercise_id, completed_date",
          ignoreDuplicates: false,
        });
      if (error) throw error;
      return NextResponse.json({ success: true, count: records.length });
    }
    // --- 批量: 多条完成记录 ---
    if (body.batch && Array.isArray(body.batch)) {
      const records = body.batch.map((item: any) => ({
        user_id: user.id,
        plan_id: item.plan_id,
        day_id: item.day_id,
        exercise_id: item.exercise_id,
        completed_date: item.completed_date || new Date().toISOString().slice(0, 10),
        completed_sets: item.completed_sets || null,
        completed_reps: item.completed_reps || null,
        completed_weight_kg: item.completed_weight_kg || null,
        source: item.source || 'manual',
      }));
      const { error } = await supabase
        .from("exercise_completions")
        .upsert(records, {
          onConflict: "user_id, exercise_id, completed_date",
          ignoreDuplicates: false,
        });
      if (error) throw error;
      return NextResponse.json({ success: true, count: records.length });
    }
    // --- 单条 ---
    const { plan_id, day_id, exercise_id, completed_date, completed_sets, completed_reps, completed_weight_kg } = body;
    if (!plan_id || !day_id || !exercise_id) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }
    const date = completed_date || new Date().toISOString().slice(0, 10);
    // 检查是否已有记录（用于切换完成/未完成）
    const { data: existing } = await supabase
      .from("exercise_completions")
      .select("id")
      .eq("user_id", user.id)
      .eq("exercise_id", exercise_id)
      .eq("completed_date", date)
      .maybeSingle();
    if (existing) {
      // 已存在则删除（取消完成）
      const { error } = await supabase
        .from("exercise_completions")
        .delete()
        .eq("id", existing.id);
      if (error) throw error;
      return NextResponse.json({ success: true, action: "uncompleted" });
    } else {
      // 不存在则创建
      const { error } = await supabase
        .from("exercise_completions")
        .insert({
          user_id: user.id,
          plan_id,
          day_id,
          exercise_id,
          completed_date: date,
          completed_sets: completed_sets || null,
          completed_reps: completed_reps || null,
          completed_weight_kg: completed_weight_kg || null,
          source: 'manual',
        });
      if (error) throw error;
      return NextResponse.json({ success: true, action: "completed" });
    }
  } catch (err) {
    console.error("plan-completions POST error:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
// ========= DELETE: 删除完成记录 =========
export async function DELETE(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const planId = searchParams.get("plan_id");
    const date = searchParams.get("date");
    const dayId = searchParams.get("day_id");
    if (id) {
      await supabase.from("exercise_completions").delete().eq("id", id).eq("user_id", user.id);
      return NextResponse.json({ success: true });
    }
    if (planId && date) {
      let query = supabase
        .from("exercise_completions")
        .delete()
        .eq("user_id", user.id)
        .eq("plan_id", planId)
        .eq("completed_date", date);
      if (dayId) query = query.eq("day_id", dayId);
      await query;
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "缺少参数" }, { status: 400 });
  } catch (err) {
    console.error("plan-completions DELETE error:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
// ========= 计算计划完成度统计 =========
async function getPlanStats(
  supabase: any,
  userId: string,
  planId: string,
  date: string,
) {
  // 获取计划的 days（含 exercises）
  const { data: days } = await supabase
    .from("plan_days")
    .select("*")
    .eq("plan_id", planId)
    .eq("user_id", userId)
    .order("order_index", { ascending: true });
  const { data: exercises } = await supabase
    .from("plan_exercises")
    .select("*")
    .eq("plan_id", planId)
    .eq("user_id", userId)
    .order("order_index", { ascending: true });
  if (!days || !exercises) {
    return NextResponse.json({ stats: null });
  }
  // 构建 day -> exercises 映射
  const dayMap = new Map<string, any[]>();
  for (const d of days) dayMap.set(d.id, []);
  for (const ex of exercises) {
    const list = dayMap.get(ex.day_id);
    if (list) list.push(ex);
  }
  // 获取今天的完成记录
  const todayDow = new Date().getDay();
  const todayDay = days.find((d: any) => d.day_of_week === todayDow);
  // 获取所有完成记录
  const { data: allCompletions } = await supabase
    .from("exercise_completions")
    .select("*")
    .eq("user_id", userId)
    .eq("plan_id", planId);
  const completionMap = new Map<string, Set<string>>();
  const completionDetails = new Map<string, Map<string, any>>();
  for (const c of allCompletions || []) {
    if (!completionMap.has(c.completed_date)) {
      completionMap.set(c.completed_date, new Set());
      completionDetails.set(c.completed_date, new Map());
    }
    completionMap.get(c.completed_date)!.add(c.exercise_id);
    completionDetails.get(c.completed_date)!.set(c.exercise_id, c);
  }
  // 今日完成度
  let todayCompleted = 0;
  let todayTotal = 0;
  let todayPercentage = 0;
  let todayCompletions: { exercise_id: string; is_completed: boolean }[] = [];
  if (todayDay && !todayDay.is_rest_day) {
    const dayExercises = dayMap.get(todayDay.id) || [];
    todayTotal = dayExercises.length;
    const todayExSet = completionMap.get(date) || new Set();
    todayCompleted = dayExercises.filter((ex: any) => todayExSet.has(ex.id)).length;
    todayPercentage = todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0;
    todayCompletions = dayExercises.map((ex: any) => ({
      exercise_id: ex.id,
      is_completed: todayExSet.has(ex.id),
    }));
  }
  // 整体完成度：已完成的天数 / 总训练日数
  const trainingDays = days.filter((d: any) => !d.is_rest_day);
  const totalTrainingDays = trainingDays.length;
  // 计算有多少个不同的日期完成了训练（一个日期只要完成了该天的任意动作就算）
  const completedDateSet = new Set<string>();
  for (const [cDate, exIds] of Array.from(completionMap.entries())) {
    // 检查这个日期是否完成了对应天的动作
    for (const day of trainingDays) {
      const dayExIds = new Set((dayMap.get(day.id) || []).map((ex: any) => ex.id));
      // 如果该天的任意动作被完成，就算完成了一天
      let hasAny = false;
      for (const exId of Array.from(exIds)) {
        if (dayExIds.has(exId)) { hasAny = true; break; }
      }
      if (hasAny) {
        completedDateSet.add(cDate);
        break;
      }
    }
  }
  const totalCompletedDays = completedDateSet.size;
  const overallPercentage = totalTrainingDays > 0
    ? Math.min(Math.round((totalCompletedDays / totalTrainingDays) * 100), 100)
    : 0;
  // 获取计划模式信息
  const { data: plan } = await supabase
    .from("cycle_plans")
    .select("duration_type, duration_weeks, workouts_per_week, total_days, total_rounds")
    .eq("id", planId)
    .single();
  let totalExpectedWorkouts: number;
  if (plan?.duration_type === 'daily') {
    // 天轮模式：总训练日 = total_days * total_rounds
    totalExpectedWorkouts = (plan.total_days || totalTrainingDays) * (plan.total_rounds || 1);
  } else {
    // 周模式：总训练日 = duration_weeks * workouts_per_week
    totalExpectedWorkouts = plan
      ? (plan.duration_weeks * plan.workouts_per_week)
      : totalTrainingDays;
  }
  const overallPct = totalExpectedWorkouts > 0
    ? Math.min(Math.round((totalCompletedDays / totalExpectedWorkouts) * 100), 100)
    : 0;
  const stats: PlanCompletionStats = {
    today_completed: todayCompleted,
    today_total: todayTotal,
    today_percentage: todayPercentage,
    total_completed_days: totalCompletedDays,
    total_training_days: totalExpectedWorkouts,
    overall_percentage: overallPct,
  };
  return NextResponse.json({
    stats,
    today_completions: todayCompletions,
    today_day: todayDay,
  });
}