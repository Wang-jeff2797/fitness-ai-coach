import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getServerUser } from "@/lib/supabase/server";
import { callDeepSeekJSON } from "@/lib/ai/deepseek";
import { buildAdjustCyclePrompt } from "@/lib/ai/prompts";
import { computeCycleSummary } from "@/lib/analytics/cycle-summary";
import { calculateTDEE, getCalorieTarget } from "@/lib/analytics/tdee";
import { estimate1RM } from "@/lib/analytics/1rm";
import type { AdjustCycleRequest, AdjustCycleResponse, CycleAdjustment, EnhancedCycleSummary, PersonalRecord } from "@/types";
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json<AdjustCycleResponse>({ success: false, error: "未登录" }, { status: 401 });
    }
    const body: AdjustCycleRequest = await request.json();
    if (!body.cycle_id) {
      return NextResponse.json<AdjustCycleResponse>({ success: false, error: "周期 ID 不能为空" }, { status: 400 });
    }
    const supabase = await createServerSupabaseClient();
    // 获取周期
    const { data: cycle } = await supabase
      .from("cycles").select("*").eq("id", body.cycle_id).eq("user_id", user.id).single();
    if (!cycle) {
      return NextResponse.json<AdjustCycleResponse>({ success: false, error: "周期不存在" }, { status: 404 });
    }
    // 获取训练数据
    const { data: workouts } = await supabase
      .from("workouts").select("*").eq("cycle_id", body.cycle_id).eq("user_id", user.id).order("performed_at", { ascending: true });
    if (!workouts || workouts.length === 0) {
      return NextResponse.json<AdjustCycleResponse>({ success: false, error: "该周期还没有训练记录" }, { status: 400 });
    }
    // === 核心计算（零 AI）===
    const summary = computeCycleSummary(workouts);
    // 获取用户资料
    const { data: profile } = await supabase
      .from("users").select("*").eq("id", user.id).single();
    // 获取生活反馈
    const { data: feedback } = await supabase
      .from("lifestyle_feedback").select("*").eq("cycle_id", body.cycle_id).eq("user_id", user.id).maybeSingle();
    // 获取 PR 数据
    const { data: existingPRs } = await supabase
      .from("personal_records").select("*").eq("user_id", user.id);
    // === 计算 TDEE ===
    const tdeeResult = calculateTDEE(
      profile?.gender || 'male',
      Number(profile?.weight_kg) || 70,
      Number(profile?.height_cm) || 175,
      profile?.age || 25,
      profile?.activity_level || 'moderate',
      feedback || undefined
    );
    const calorieTarget = getCalorieTarget(tdeeResult.tdee_adjusted, cycle.goal || profile?.goal);
    // === 计算周期内总热量消耗 ===
    let totalCalories = 0;
    for (const w of workouts) {
      const note = w.session_data?.notes || "";
      const match = note.match(/预估消耗:\s*(\d+)\s*kcal/);
      if (match) totalCalories += parseInt(match[1]);
    }
    // === 计算 PR 变化 ===
    const prUpdates: { exercise: string; old_1rm: number; new_1rm: number }[] = [];
    const prMap = new Map<string, PersonalRecord>();
    for (const pr of existingPRs || []) {
      prMap.set(pr.exercise, pr);
    }
    for (const exSummary of summary.exercises_summary) {
      const existingPR = prMap.get(exSummary.exercise);
      if (exSummary.best_set) {
        const new1RM = estimate1RM(exSummary.best_set.weight_kg, exSummary.best_set.reps);
        if (existingPR) {
          if (new1RM > existingPR.estimated_1rm) {
            prUpdates.push({ exercise: exSummary.exercise, old_1rm: existingPR.estimated_1rm, new_1rm: new1RM });
          }
        } else {
          prUpdates.push({ exercise: exSummary.exercise, old_1rm: 0, new_1rm: new1RM });
        }
      }
    }
    // === 构建增强摘要 ===
    const enhancedSummary: EnhancedCycleSummary = {
      ...summary,
      tdee_adjusted: tdeeResult.tdee_adjusted,
      maintenance_calories: calorieTarget,
      total_calories_burned: totalCalories,
      estimated_calories_per_session: totalCalories > 0 ? Math.round(totalCalories / workouts.length) : 0,
      pr_updates: prUpdates,
    };
    // === 构建上下文给 AI ===
    const contextParts: string[] = [];
    contextParts.push(`## 周期摘要\n${JSON.stringify(summary, null, 2)}`);
    contextParts.push(`## 代谢数据\n- 基础代谢 BMR: ${tdeeResult.bmr} kcal\n- 修正后每日 TDEE: ${tdeeResult.tdee_adjusted} kcal\n- 周期目标热量参考: ${calorieTarget} kcal/天\n- 周期内估算总消耗: ${totalCalories} kcal`);
    contextParts.push(`## PR 更新\n${prUpdates.map(p => `- ${p.exercise}: ${p.old_1rm}kg → ${p.new_1rm}kg (1RM 估算)`).join('\n') || '本次周期无新 PR'}`);
    contextParts.push(`## 用户目标\n用户目标: ${cycle.goal || profile?.goal || 'muscle_gain'}`);
    if (feedback) {
      contextParts.push(`## 生活反馈\n- 睡眠质量: ${feedback.sleep_quality}/5\n- 压力水平: ${feedback.stress_level}/5\n- 活动变化: ${feedback.activity_change}\n- 特殊情况: ${feedback.special_condition}`);
    }
    const prompt = buildAdjustCyclePrompt(contextParts.join('\n\n'), body.feedback || "无特殊反馈");
    const adjustment = await callDeepSeekJSON<CycleAdjustment>(prompt, "请根据以上数据生成调整方案。", {
      temperature: 0.2, maxTokens: 3000,
    });
    // === 保存调整方案 ===
    const { error: updateError } = await supabase
      .from("cycles").update({
        adjustment_plan: adjustment,
        end_date: new Date().toISOString().slice(0, 10),
        is_active: false,
      }).eq("id", body.cycle_id);
    if (updateError) {
      return NextResponse.json<AdjustCycleResponse>({ success: false, error: "保存调整方案失败" }, { status: 500 });
    }
    return NextResponse.json<AdjustCycleResponse>({ success: true, adjustment }, { status: 200 });
  } catch (err) {
    console.error("adjust-cycle error:", err);
    return NextResponse.json<AdjustCycleResponse>({ success: false, error: err instanceof Error ? err.message : "服务器内部错误" }, { status: 500 });
  }
}