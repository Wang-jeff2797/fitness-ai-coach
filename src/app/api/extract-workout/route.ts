import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getServerUser } from "@/lib/supabase/server";
import { callDeepSeekJSON } from "@/lib/ai/deepseek";
import { EXTRACT_WORKOUT_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { findMetMatch, estimateSessionCalories } from "@/lib/analytics/met-calories";
import { best1RMFromExercises } from "@/lib/analytics/auto-pr";
import type { SessionData, ExtractWorkoutRequest, ExtractWorkoutResponse } from "@/types";
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json<ExtractWorkoutResponse>(
        { success: false, error: "未登录" },
        { status: 401 }
      );
    }
    const body: ExtractWorkoutRequest = await request.json();
    if (!body.text || !body.text.trim()) {
      return NextResponse.json<ExtractWorkoutResponse>(
        { success: false, error: "训练文本不能为空" },
        { status: 400 }
      );
    }
    if (!body.cycle_id) {
      return NextResponse.json<ExtractWorkoutResponse>(
        { success: false, error: "周期 ID 不能为空" },
        { status: 400 }
      );
    }
    const supabase = await createServerSupabaseClient();
    // 验证周期
    const { data: cycle } = await supabase
      .from("cycles")
      .select("id")
      .eq("id", body.cycle_id)
      .eq("user_id", user.id)
      .single();
    if (!cycle) {
      return NextResponse.json<ExtractWorkoutResponse>(
        { success: false, error: "周期不存在" },
        { status: 404 }
      );
    }
    // === 获取用户设置作为 AI 上下文 ===
    const { data: userSettings } = await supabase
      .from("user_settings")
      .select("key, value")
      .eq("user_id", user.id);
    const settingsContext: string = (userSettings || [])
      .map((s: { key: string; value: string }) => `${s.key}: ${s.value}`)
      .join("\n");
    // === 获取用户体重用于热量估算 ===
    const { data: profile } = await supabase
      .from("users")
      .select("weight_kg")
      .eq("id", user.id)
      .single();
    const userWeightKg = Number(profile?.weight_kg) || 70;
    // === 获取 MET 常量库 ===
    const { data: metEntries } = await supabase
      .from("met_constants")
      .select("action_name, met_value");
    const metLookup = (actionName: string): number | undefined => {
      return findMetMatch(actionName, metEntries || []);
    };
    // === 构建增强提示 ===
    const contextPrompt = settingsContext
      ? `${EXTRACT_WORKOUT_SYSTEM_PROMPT}\n\n## 用户常用设置\n${settingsContext}`
      : EXTRACT_WORKOUT_SYSTEM_PROMPT;
    // === 调用 DeepSeek 提取 ===
    const sessionData = await callDeepSeekJSON<SessionData>(
      contextPrompt,
      body.text,
      { temperature: 0.1, maxTokens: 2000 }
    );
    // === 记录未知动作（MET 库中未找到的）===
    const allExercises = [
      ...(sessionData.exercises ?? []),
      ...(sessionData.cardio_exercises ?? []),
    ];
    for (const ex of allExercises) {
      const found = findMetMatch(ex.name, metEntries || []);
      if (found === undefined) {
        // 存入 unknown_actions
        await supabase
          .from("unknown_actions")
          .upsert(
            {
              user_id: user.id,
              action_name: ex.name,
              context: JSON.stringify({ exercise_type: ex.exercise_type, is_cardio: ex.is_cardio }),
              is_learned: false,
            },
            { onConflict: "user_id, action_name", ignoreDuplicates: true }
          );
      }
    }
    // === 估算热量消耗 ===
    const estimatedCalories = estimateSessionCalories(sessionData, userWeightKg, metLookup);
    // 将热量信息附加到 notes
    const existingNotes = sessionData.notes || "";
    sessionData.notes = existingNotes
      ? `${existingNotes} | 预估消耗: ${estimatedCalories} kcal`
      : `预估消耗: ${estimatedCalories} kcal`;
    // === 存储 ===
    const { data: workout, error } = await supabase
      .from("workouts")
      .insert({
        user_id: user.id,
        cycle_id: body.cycle_id,
        session_data: sessionData,
        raw_input: null,
        performed_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) {
      console.error("存储训练数据失败:", error);
      return NextResponse.json<ExtractWorkoutResponse>(
        { success: false, error: "存储失败" },
        { status: 500 }
      );
    }
    // === 自动更新个人纪录（计算 1RM）===
    const prMap = best1RMFromExercises(sessionData.exercises || []);
    if (prMap.size > 0) {
      const prEntries = Array.from(prMap);
      for (let i = 0; i < prEntries.length; i++) {
        const [exercise, calc1rm] = prEntries[i];
        // 检查是否已有该动作的纪录
        const { data: existing } = await supabase
          .from("personal_records")
          .select("id, estimated_1rm, calculated_1rm")
          .eq("user_id", user.id)
          .eq("exercise", exercise)
          .maybeSingle();
        if (existing) {
          // 已有纪录：只更新 calculated_1rm（如果新值更大），不碰 estimated_1rm
          if (calc1rm > (existing.calculated_1rm || 0)) {
            await supabase
              .from("personal_records")
              .update({ calculated_1rm: calc1rm })
              .eq("id", existing.id);
          }
        } else {
          // 无纪录：自动创建，estimated_1rm = calculated_1rm（用户可后期修改）
          await supabase
            .from("personal_records")
            .insert({
              user_id: user.id,
              exercise,
              weight_kg: 0,
              reps: 0,
              estimated_1rm: calc1rm,
              calculated_1rm: calc1rm,
              record_date: new Date().toISOString().slice(0, 10),
            });
        }
      }
    }
    // === 如果关联了计划，自动匹配动作完成度 ===
    let completedCount = 0;
    if (body.plan_id && sessionData.exercises && sessionData.exercises.length > 0) {
      try {
        const todayStr = new Date().toISOString().slice(0, 10);
        const todayDow = new Date().getDay();
        // 获取计划中今天的训练日的所有动作
        const { data: planDays } = await supabase
          .from("plan_days")
          .select("id, day_of_week")
          .eq("plan_id", body.plan_id)
          .eq("user_id", user.id)
          .eq("day_of_week", todayDow);
        if (planDays && planDays.length > 0) {
          const todayDayId = planDays[0].id;
          const { data: planExs } = await supabase
            .from("plan_exercises")
            .select("id, exercise_name")
            .eq("day_id", todayDayId)
            .eq("plan_id", body.plan_id)
            .eq("user_id", user.id);
          if (planExs && planExs.length > 0) {
            // 模糊匹配：将用户输入的动作名与计划动作名进行匹配
            const userExerciseNames = Array.from(
              new Set(sessionData.exercises.map(e => e.name.trim().toLowerCase()))
            );
            const completionRecords: any[] = [];
            for (const planEx of planExs) {
              const planName = planEx.exercise_name.trim().toLowerCase();
              // 检查用户是否做了这个动作
              let matched = false;
              for (const userName of userExerciseNames) {
                // 完全匹配或包含关系
                if (userName === planName || userName.includes(planName) || planName.includes(userName)) {
                  matched = true;
                  break;
                }
              }
              if (matched) {
                completionRecords.push({
                  user_id: user.id,
                  plan_id: body.plan_id,
                  day_id: todayDayId,
                  exercise_id: planEx.id,
                  completed_date: todayStr,
                  source: 'auto',
                });
              }
            }
            if (completionRecords.length > 0) {
              const { error: compErr } = await supabase
                .from("exercise_completions")
                .upsert(completionRecords, {
                  onConflict: "user_id, exercise_id, completed_date",
                  ignoreDuplicates: false,
                });
              if (!compErr) completedCount = completionRecords.length;
            }
          }
        }
      } catch (e) {
        console.error("Auto-complete matching error:", e);
      }
    }
    return NextResponse.json(
      { success: true, workout, completed_count: completedCount },
      { status: 200 }
    );
  } catch (err) {
    console.error("extract-workout error:", err);
    const message = err instanceof Error ? err.message : "服务器内部错误";
    return NextResponse.json<ExtractWorkoutResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}