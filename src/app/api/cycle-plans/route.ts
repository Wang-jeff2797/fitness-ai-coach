import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getServerUser } from "@/lib/supabase/server";
import { callDeepSeek } from "@/lib/ai/deepseek";
import { buildGeneratePlanPrompt } from "@/lib/ai/prompts";
import { calculateTDEE, getCalorieTarget } from "@/lib/analytics/tdee";
import { estimateCaloriesByMet } from "@/lib/analytics/met-calories";
import type {
  CyclePlan, PlanDay, PlanExercise, GeneratePlanRequest,
} from "@/types";
export const dynamic = 'force-dynamic';
function validatePlanLocally(plan: CyclePlan): CyclePlan {
  if (!plan.days || plan.days.length === 0) plan.days = [];
  const isDaily = plan.duration_type === 'daily';
  if (isDaily) {
    // 天轮模式：保持天数不变，只去重+排序
    const usedDays = new Set<number>();
    const orderedDays: PlanDay[] = [];
    for (const d of plan.days) {
      if (usedDays.has(d.day_of_week)) continue;
      usedDays.add(d.day_of_week);
      orderedDays.push({ ...d, order_index: d.order_index ?? orderedDays.length });
    }
    orderedDays.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    for (const day of orderedDays) {
      if (!day.exercises) day.exercises = [];
      day.exercises.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    }
    plan.days = orderedDays;
  } else {
    // 周模式：补齐 7 天（原有逻辑）
    const usedDays = new Set<number>();
    const orderedDays: PlanDay[] = [];
    for (const d of plan.days) {
      if (usedDays.has(d.day_of_week)) continue;
      usedDays.add(d.day_of_week);
      orderedDays.push({ ...d, order_index: d.order_index ?? orderedDays.length });
    }
    for (let dow = 0; dow <= 6; dow++) {
      if (!usedDays.has(dow)) {
        orderedDays.push({
          day_of_week: dow,
          day_name: "休息日",
          focus: "主动恢复",
          is_rest_day: true,
          order_index: orderedDays.length,
          exercises: [],
        });
      }
    }
    orderedDays.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    for (const day of orderedDays) {
      if (!day.exercises) day.exercises = [];
      day.exercises.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    }
    plan.days = orderedDays;
  }
  return plan;
}
// ========= GET: 列出计划 或 单个计划详情（含 days + exercises）=========
export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get("id");
    if (planId) {
      const { data, error } = await supabase
        .from("cycle_plans").select("*").eq("id", planId).eq("user_id", user.id).single();
      if (error || !data) return NextResponse.json({ error: "计划不存在" }, { status: 404 });
      const { data: days } = await supabase
        .from("plan_days").select("*").eq("plan_id", planId).order("order_index", { ascending: true });
      const { data: exercises } = await supabase
        .from("plan_exercises").select("*").eq("plan_id", planId).order("order_index", { ascending: true });
      console.log("=== GET plan detail ===", { dayCount: days?.length || 0, exCount: exercises?.length || 0 });
      console.log("exercises sample:", JSON.stringify(exercises?.slice(0, 2) || []).slice(0, 200));
      const dayMap = new Map<string, PlanDay>();
      for (const d of days || []) dayMap.set(d.id, { ...d, exercises: [] });
      for (const ex of exercises || []) {
        const day = dayMap.get(ex.day_id);
        if (day && day.exercises) day.exercises.push(ex as unknown as PlanExercise);
      }
      return NextResponse.json({
        plan: { ...data, days: Array.from(dayMap.values()) },
      });
    }
    const { data: plans } = await supabase
      .from("cycle_plans").select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false });
    return NextResponse.json({ plans: plans || [] });
  } catch (err) {
    console.error("cycle-plans GET error:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
// ========= POST: 1) 生成计划 AI  或 2) 直接保存 =========
export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const supabase = await createServerSupabaseClient();
    const body = await request.json() as GeneratePlanRequest | (CyclePlan & { save_directly?: boolean });
    // --- 直接保存（用户编辑后的计划）---
    if ((body as any).save_directly) {
      const planData = body as CyclePlan & { save_directly?: boolean };
      delete (planData as any).save_directly;
      const validated = validatePlanLocally(planData);
      const isDaily = validated.duration_type === 'daily';
      const { data: plan, error: pErr } = await supabase
        .from("cycle_plans").insert({
          user_id: user.id,
          name: validated.name,
          goal: validated.goal,
          duration_type: isDaily ? 'daily' : 'weekly',
          duration_weeks: isDaily ? null : (validated.duration_weeks || 4),
          workouts_per_week: isDaily ? null : (validated.workouts_per_week || 3),
          total_days: isDaily ? validated.total_days : null,
          total_rounds: isDaily ? validated.total_rounds : null,
          start_date: validated.start_date || new Date().toISOString().slice(0, 10),
          cycle_id: validated.cycle_id || null,
          notes: validated.notes || null,
        }).select().single();
      if (pErr || !plan) return NextResponse.json({ error: "创建计划失败" }, { status: 500 });
      // 保存 days
      for (const day of validated.days || []) {
        const { data: savedDay, error: dErr } = await supabase
          .from("plan_days").insert({
            plan_id: plan.id,
            user_id: user.id,
            day_of_week: day.day_of_week,
            day_name: day.day_name,
            focus: day.focus,
            is_rest_day: day.is_rest_day,
            order_index: day.order_index,
          }).select().single();
        if (dErr || !savedDay) continue;
        if (day.exercises && day.exercises.length > 0) {
          const inserts = day.exercises.map((ex, idx) => ({
            plan_id: plan.id,
            day_id: savedDay.id,
            user_id: user.id,
            exercise_name: ex.exercise_name,
            exercise_type: ex.exercise_type,
            target_sets: ex.target_sets,
            target_reps: ex.target_reps,
            target_weight_kg: ex.target_weight_kg || null,
            rpe_target: ex.rpe_target ? Math.round(ex.rpe_target) : null,
            notes: ex.notes || null,
            order_index: ex.order_index ?? idx,
          }));
          await supabase.from("plan_exercises").insert(inserts);
        }
      }
      return NextResponse.json({ plan_id: plan.id }, { status: 201 });
    }
    // --- AI 生成计划（默认模式）---
    const req = body as GeneratePlanRequest;
    // 获取上下文
    const { data: profile } = await supabase.from("users").select("*").eq("id", user.id).maybeSingle();
    const { data: prs } = await supabase.from("personal_records").select("*").eq("user_id", user.id);
    const { data: prefs } = await supabase
      .from("user_exercise_preferences")
      .select("*")
      .eq("user_id", user.id)
      .gte("weight", 0.3)
      .order("weight", { ascending: false });
    // 按肌肉分组偏好动作
    const prefMap = new Map<string, string[]>();
    for (const p of prefs || []) {
      const mg = p.muscle_group;
      if (!prefMap.has(mg)) prefMap.set(mg, []);
      const list = prefMap.get(mg)!;
      if (list.length < 8) list.push(p.exercise_name);
    }
    const preferences_context = Array.from(prefMap.entries()).map(([k, v]) => ({
      muscle_group: k,
      exercises: v,
    }));
    const fullReq = {
      ...req,
      pr_context: prs || [],
      profile_context: {
        age: profile?.age || 25,
        weight_kg: profile?.weight_kg || 70,
        height_cm: profile?.height_cm || 175,
        gender: profile?.gender || 'male',
        activity_level: profile?.activity_level || 'moderate',
        training_experience: (profile?.age && profile.age < 25) ? 'beginner' : (prs && prs.length > 8 ? 'advanced' : 'intermediate'),
      },
      preferences_context,
      day_keywords: (req as any).day_keywords || undefined,
    };
    let planResult: CyclePlan;
    try {
      // 用纯文本模式（不用 json_object），DeepSeek 的 json_object 模式会省略嵌套数组
      const raw = await callDeepSeek(
        buildGeneratePlanPrompt(fullReq),
        "请生成训练计划，严格按以上 JSON Schema 输出，每个训练日必须包含具体动作。",
        { temperature: 0.2, maxTokens: 6000 },
      );
      // 尝试提取 JSON（可能被 markdown 代码块包裹）
      let jsonStr = raw.trim();
      console.log("=== RAW AI RESPONSE (start) ===");
      console.log(raw);
      console.log("=== RAW AI RESPONSE (end) ===");
      const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) jsonStr = match[1].trim();
      planResult = JSON.parse(jsonStr) as CyclePlan;
      // 确保每个训练日有 exercises（AI 偶尔会遗漏）
      if (planResult.days) {
        for (const day of planResult.days) {
          if (!day.is_rest_day && (!day.exercises || day.exercises.length === 0)) {
            day.exercises = buildDefaultExercises(planResult.goal || req.goal, day.order_index ?? 0);
          }
        }
      }
    } catch {
      // AI 失败 fallback：本地生成默认模板
      planResult = buildFallbackPlan(req);
    }
    planResult.goal = req.goal;
    planResult.duration_type = req.duration_type || 'weekly';
    if (req.duration_type === 'daily') {
      planResult.duration_weeks = undefined;
      planResult.workouts_per_week = undefined;
      planResult.total_days = req.total_days;
      planResult.total_rounds = req.total_rounds;
    } else {
      planResult.duration_weeks = req.duration_weeks;
      planResult.workouts_per_week = req.workouts_per_week;
    }
    planResult.name = req.name || planResult.name || (
      req.duration_type === 'daily'
        ? defaultPlanName(req.goal, req.total_days || 5, true)
        : defaultPlanName(req.goal, req.duration_weeks || 4)
    );
    const validated = validatePlanLocally(planResult);
    // === 保存到 DB ===
    const isDaily = validated.duration_type === 'daily';
    const { data: savedPlan, error: planErr } = await supabase
      .from("cycle_plans").insert({
        user_id: user.id,
        name: validated.name,
        goal: validated.goal,
        duration_type: isDaily ? 'daily' : 'weekly',
        duration_weeks: isDaily ? null : (validated.duration_weeks || 4),
        workouts_per_week: isDaily ? null : (validated.workouts_per_week || 3),
        total_days: isDaily ? validated.total_days : null,
        total_rounds: isDaily ? validated.total_rounds : null,
        start_date: validated.start_date || new Date().toISOString().slice(0, 10),
        notes: validated.notes || null,
      }).select().single();
    if (planErr || !savedPlan) return NextResponse.json({ error: "保存计划失败" }, { status: 500 });
    for (const day of validated.days || []) {
      const { data: savedDay, error: dErr } = await supabase
        .from("plan_days").insert({
          plan_id: savedPlan.id,
          user_id: user.id,
          day_of_week: day.day_of_week,
          day_name: day.day_name,
          focus: day.focus,
          is_rest_day: day.is_rest_day,
          order_index: day.order_index,
        }).select().single();
      if (dErr || !savedDay) continue;
      if (!day.is_rest_day && day.exercises && day.exercises.length > 0) {
        const inserts = day.exercises.map((ex, idx) => ({
          plan_id: savedPlan.id,
          day_id: savedDay.id,
          user_id: user.id,
          exercise_name: ex.exercise_name,
          exercise_type: ex.exercise_type,
          target_sets: ex.target_sets,
          target_reps: ex.target_reps,
          target_weight_kg: ex.target_weight_kg || null,
          rpe_target: ex.rpe_target ? Math.round(ex.rpe_target) : null,
          notes: ex.notes || null,
          order_index: ex.order_index ?? idx,
        }));
        const { error: exErr } = await supabase.from("plan_exercises").insert(inserts);
        if (exErr) console.error("INSERT exercises ERROR:", exErr.message, "for day", day.day_name);
      }
    }
    return NextResponse.json({ plan_id: savedPlan.id, plan: { ...validated, id: savedPlan.id } }, { status: 201 });
  } catch (err) {
    console.error("cycle-plans POST error:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
// ========= PUT: 更新计划（增删改 days / exercises）=========
export async function PUT(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const supabase = await createServerSupabaseClient();
    const body = await request.json() as { id: string } & Partial<CyclePlan> & {
      upsert_days?: PlanDay[];
      delete_days?: string[];
      upsert_exercises?: PlanExercise[];
      delete_exercises?: string[];
    };
    if (!body.id) return NextResponse.json({ error: "id 缺失" }, { status: 400 });
    const { data: existingPlan } = await supabase
      .from("cycle_plans").select("*").eq("id", body.id).eq("user_id", user.id).maybeSingle();
    if (!existingPlan) return NextResponse.json({ error: "计划不存在" }, { status: 404 });
    // 更新 plan 基本字段
    const patch: any = {};
    for (const f of ["name", "goal", "duration_weeks", "workouts_per_week", "start_date", "notes", "cycle_id", "duration_type", "total_days", "total_rounds"] as const) {
      if (body[f] !== undefined) patch[f] = body[f];
    }
    // 如果切换了模式，清理另一模式的字段
    if (patch.duration_type === 'daily') {
      patch.duration_weeks = null;
      patch.workouts_per_week = null;
    } else if (patch.duration_type === 'weekly') {
      patch.total_days = null;
      patch.total_rounds = null;
    }
    if (Object.keys(patch).length > 0) {
      patch.updated_at = new Date().toISOString();
      await supabase.from("cycle_plans").update(patch).eq("id", body.id);
    }
    // 删除 day / exercise
    if (body.delete_exercises?.length) {
      await supabase.from("plan_exercises").delete()
        .eq("user_id", user.id).in("id", body.delete_exercises);
    }
    if (body.delete_days?.length) {
      await supabase.from("plan_days").delete()
        .eq("user_id", user.id).in("id", body.delete_days);
    }
    // upsert days
    if (body.upsert_days?.length) {
      for (const d of body.upsert_days) {
        const payload: any = {
          plan_id: body.id,
          user_id: user.id,
          day_of_week: d.day_of_week,
          day_name: d.day_name,
          focus: d.focus,
          is_rest_day: d.is_rest_day,
          order_index: d.order_index,
        };
        if (d.id) {
          await supabase.from("plan_days").update(payload).eq("id", d.id);
        } else {
          const { data: newDay } = await supabase.from("plan_days").insert(payload).select().single();
          if (newDay && d.exercises?.length) {
            const inserts = d.exercises.map((ex, idx) => ({
              plan_id: body.id,
              day_id: newDay.id,
              user_id: user.id,
              exercise_name: ex.exercise_name,
              exercise_type: ex.exercise_type,
              target_sets: ex.target_sets,
              target_reps: ex.target_reps,
              target_weight_kg: ex.target_weight_kg ?? null,
              rpe_target: ex.rpe_target ? Math.round(ex.rpe_target) : null,
              notes: ex.notes ?? null,
              order_index: ex.order_index ?? idx,
            }));
            await supabase.from("plan_exercises").insert(inserts);
          }
        }
      }
    }
    // upsert exercises（带 day_id 的编辑）
    if (body.upsert_exercises?.length) {
      for (const ex of body.upsert_exercises) {
        const payload: any = {
          plan_id: body.id,
          day_id: ex.day_id,
          user_id: user.id,
          exercise_name: ex.exercise_name,
          exercise_type: ex.exercise_type,
          target_sets: ex.target_sets,
          target_reps: ex.target_reps,
          target_weight_kg: ex.target_weight_kg ?? null,
          rpe_target: ex.rpe_target ? Math.round(ex.rpe_target) : null,
          notes: ex.notes ?? null,
          order_index: ex.order_index,
        };
        if (ex.id) {
          await supabase.from("plan_exercises").update(payload).eq("id", ex.id);
        } else {
          await supabase.from("plan_exercises").insert(payload);
        }
      }
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("cycle-plans PUT error:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
// ========= DELETE =========
export async function DELETE(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id 缺失" }, { status: 400 });
    const supabase = await createServerSupabaseClient();
    await supabase.from("cycle_plans").delete().eq("id", id).eq("user_id", user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("cycle-plans DELETE error:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
// ===================== 工具函数 =====================
function defaultPlanName(goal: string, weeksOrDays: number, isDaily?: boolean): string {
  if (isDaily) {
    const n: Record<string, string> = {
      muscle_gain: `${weeksOrDays}天增肌计划`,
      fat_loss: `${weeksOrDays}天减脂计划`,
      strength: `${weeksOrDays}天增力计划`,
      endurance: `${weeksOrDays}天耐力计划`,
    };
    return n[goal] || `${weeksOrDays}天训练计划`;
  }
  const n: Record<string, string> = {
    muscle_gain: `${weeksOrDays}周增肌周期`,
    fat_loss: `${weeksOrDays}周减脂周期`,
    strength: `${weeksOrDays}周增力周期`,
    endurance: `${weeksOrDays}周耐力周期`,
  };
  return n[goal] || `${weeksOrDays}周训练周期`;
}
function buildFallbackPlan(req: GeneratePlanRequest): CyclePlan {
  const isDaily = req.duration_type === 'daily';
  if (isDaily) {
    const totalDays = req.total_days || 5;
    const defaultSplits: Record<string, string[]> = {
      muscle_gain: ["上肢推力日（胸·肩·三头）", "下肢日（腿·臀）", "上肢拉力日（背·二头）", "全身+核心", "有氧+轻力量", "循环代谢训练"],
      fat_loss: ["全身力量A", "HIIT + 核心", "全身力量B", "稳态有氧LISS", "循环力量+有氧", "周末活动"],
      strength: ["全身力量A（主项：卧推/深蹲）", "辅助动作+技术", "全身力量B（主项：硬拉/推举）", "轻量恢复训练", "有氧恢复", "技术训练"],
      endurance: ["稳态有氧LSD", "力量维持A", "间歇训练HIIT", "力量维持B", "节奏跑/节奏骑", "长距离有氧"],
    };
    const splits = defaultSplits[req.goal] || defaultSplits.muscle_gain;
    const days: PlanDay[] = Array.from({ length: totalDays }, (_, idx) => ({
      day_of_week: idx,
      day_name: `Day ${idx + 1} - ${splits[idx % splits.length] || "综合训练日"}`,
      focus: splits[idx % splits.length] || "综合训练",
      is_rest_day: false,
      order_index: idx,
      exercises: buildDefaultExercises(req.goal, idx % 6),
    }));
    return {
      name: defaultPlanName(req.goal, totalDays, true),
      goal: req.goal,
      duration_type: 'daily',
      total_days: totalDays,
      total_rounds: req.total_rounds || 3,
      duration_weeks: undefined,
      workouts_per_week: undefined,
      start_date: new Date().toISOString().slice(0, 10),
      notes: "AI 暂不可用，使用本地默认模板。建议根据实际情况调整。",
      days,
    };
  }
  // 周模式（原有逻辑）
  const dowDays = [1, 3, 5].slice(0, Math.min(req.workouts_per_week || 3, 6));
  while (dowDays.length < Math.min(req.workouts_per_week || 3, 6)) {
    for (let d = 2; d <= 6; d++) if (!dowDays.includes(d)) { dowDays.push(d); break; }
  }
  const defaultSplits: Record<string, string[]> = {
    muscle_gain: ["上肢推力日（胸·肩·三头）", "下肢日（腿·臀）", "上肢拉力日（背·二头）", "全身+核心", "有氧+轻力量", "循环代谢训练"],
    fat_loss: ["全身力量A", "HIIT + 核心", "全身力量B", "稳态有氧LISS", "循环力量+有氧", "周末活动"],
    strength: ["全身力量A（主项：卧推/深蹲）", "辅助动作+技术", "全身力量B（主项：硬拉/推举）", "轻量恢复训练", "有氧恢复", "技术训练"],
    endurance: ["稳态有氧LSD", "力量维持A", "间歇训练HIIT", "力量维持B", "节奏跑/节奏骑", "长距离有氧"],
  };
  const splits = defaultSplits[req.goal] || defaultSplits.muscle_gain;
  const days: PlanDay[] = dowDays.map((dow, idx) => ({
    day_of_week: dow,
    day_name: `Day ${String.fromCharCode(65 + idx)} - ${splits[idx] || "综合训练日"}`,
    focus: splits[idx] || "综合训练",
    is_rest_day: false,
    order_index: idx,
    exercises: buildDefaultExercises(req.goal, idx),
  }));
  return {
    name: defaultPlanName(req.goal, req.duration_weeks || 4),
    goal: req.goal,
    duration_type: 'weekly',
    duration_weeks: req.duration_weeks || 4,
    workouts_per_week: req.workouts_per_week || 3,
    start_date: new Date().toISOString().slice(0, 10),
    notes: "AI 暂不可用，使用本地默认模板。建议根据实际情况调整动作和重量。",
    days,
  };
}
function buildDefaultExercises(goal: string, splitIdx: number): PlanExercise[] {
  const presets: Record<string, PlanExercise[][]> = {
    muscle_gain: [
      [
        { exercise_name: "平板卧推", exercise_type: "bench_press", target_sets: 4, target_reps: "8-10", target_weight_kg: 60, rpe_target: 7.5, order_index: 0 },
        { exercise_name: "哑铃肩推", exercise_type: "dumbbell_shoulder_press", target_sets: 3, target_reps: "10-12", order_index: 1 },
        { exercise_name: "绳索下压", exercise_type: "tricep_pushdown", target_sets: 3, target_reps: "12", order_index: 2 },
        { exercise_name: "侧平举", exercise_type: "lateral_raise", target_sets: 3, target_reps: "15", order_index: 3 },
      ],
      [
        { exercise_name: "深蹲", exercise_type: "squat", target_sets: 4, target_reps: "8-10", target_weight_kg: 80, rpe_target: 7.5, order_index: 0 },
        { exercise_name: "腿举", exercise_type: "leg_press", target_sets: 3, target_reps: "12-15", order_index: 1 },
        { exercise_name: "臀推", exercise_type: "hip_thrust", target_sets: 3, target_reps: "12", order_index: 2 },
        { exercise_name: "腿弯举", exercise_type: "leg_curl", target_sets: 3, target_reps: "12", order_index: 3 },
        { exercise_name: "站姿提踵", exercise_type: "calf_raise", target_sets: 3, target_reps: "20", order_index: 4 },
      ],
      [
        { exercise_name: "引体向上", exercise_type: "pull_up", target_sets: 4, target_reps: "6-10", rpe_target: 8, order_index: 0 },
        { exercise_name: "杠铃划船", exercise_type: "barbell_row", target_sets: 4, target_reps: "8-10", target_weight_kg: 60, order_index: 1 },
        { exercise_name: "哑铃弯举", exercise_type: "bicep_curl", target_sets: 3, target_reps: "12", order_index: 2 },
        { exercise_name: "面拉", exercise_type: "face_pull", target_sets: 3, target_reps: "15", order_index: 3 },
      ],
      [
        { exercise_name: "平板卧推", exercise_type: "bench_press", target_sets: 3, target_reps: "10", order_index: 0 },
        { exercise_name: "深蹲", exercise_type: "squat", target_sets: 3, target_reps: "10", order_index: 1 },
        { exercise_name: "硬拉", exercise_type: "deadlift", target_sets: 3, target_reps: "6-8", order_index: 2 },
        { exercise_name: "平板支撑", exercise_type: "plank", target_sets: 3, target_reps: "60秒", order_index: 3 },
      ],
      [
        { exercise_name: "跑步机慢跑", exercise_type: "running", target_sets: 1, target_reps: "40分钟", order_index: 0 },
        { exercise_name: "平板支撑", exercise_type: "plank", target_sets: 3, target_reps: "45秒", order_index: 1 },
      ],
      [
        { exercise_name: "循环训练", exercise_type: "other", target_sets: 4, target_reps: "每动作12次不休息", order_index: 0 },
      ],
    ],
    fat_loss: [
      [
        { exercise_name: "深蹲", exercise_type: "squat", target_sets: 4, target_reps: "12-15", rpe_target: 7.5, order_index: 0 },
        { exercise_name: "平板卧推", exercise_type: "bench_press", target_sets: 4, target_reps: "12", order_index: 1 },
        { exercise_name: "杠铃划船", exercise_type: "barbell_row", target_sets: 4, target_reps: "12", order_index: 2 },
        { exercise_name: "臀推", exercise_type: "hip_thrust", target_sets: 3, target_reps: "15", order_index: 3 },
        { exercise_name: "平板支撑", exercise_type: "plank", target_sets: 3, target_reps: "60秒", order_index: 4 },
      ],
      [
        { exercise_name: "间歇跑步 HIIT", exercise_type: "running", target_sets: 1, target_reps: "30秒冲刺+1分钟走×10组", order_index: 0 },
        { exercise_name: "平板支撑", exercise_type: "plank", target_sets: 3, target_reps: "60秒", order_index: 1 },
        { exercise_name: "开合跳", exercise_type: "other", target_sets: 3, target_reps: "30次", order_index: 2 },
      ],
      [
        { exercise_name: "硬拉", exercise_type: "deadlift", target_sets: 4, target_reps: "10", rpe_target: 8, order_index: 0 },
        { exercise_name: "哑铃肩推", exercise_type: "dumbbell_shoulder_press", target_sets: 3, target_reps: "12", order_index: 1 },
        { exercise_name: "引体向上", exercise_type: "pull_up", target_sets: 3, target_reps: "至力竭", order_index: 2 },
        { exercise_name: "腿举", exercise_type: "leg_press", target_sets: 3, target_reps: "15", order_index: 3 },
      ],
      [
        { exercise_name: "稳态有氧（椭圆机/跑步）", exercise_type: "running", target_sets: 1, target_reps: "45分钟", order_index: 0 },
      ],
      [
        { exercise_name: "循环力量（超级组）", exercise_type: "other", target_sets: 5, target_reps: "每动作15次×3轮", order_index: 0 },
      ],
      [
        { exercise_name: "长距离徒步或骑行", exercise_type: "cycling", target_sets: 1, target_reps: "60-90分钟", order_index: 0 },
      ],
    ],
    strength: [
      [
        { exercise_name: "平板卧推", exercise_type: "bench_press", target_sets: 5, target_reps: "5", target_weight_kg: 70, rpe_target: 8.5, order_index: 0 },
        { exercise_name: "深蹲", exercise_type: "squat", target_sets: 5, target_reps: "5", target_weight_kg: 100, rpe_target: 8.5, order_index: 1 },
        { exercise_name: "杠铃划船", exercise_type: "barbell_row", target_sets: 4, target_reps: "6-8", order_index: 2 },
        { exercise_name: "面拉", exercise_type: "face_pull", target_sets: 3, target_reps: "15", order_index: 3 },
      ],
      [
        { exercise_name: "过顶推举", exercise_type: "overhead_press", target_sets: 4, target_reps: "6-8", order_index: 0 },
        { exercise_name: "保加利亚分腿蹲", exercise_type: "other", target_sets: 3, target_reps: "每侧10次", order_index: 1 },
        { exercise_name: "引体向上", exercise_type: "pull_up", target_sets: 4, target_reps: "6", order_index: 2 },
      ],
      [
        { exercise_name: "硬拉", exercise_type: "deadlift", target_sets: 5, target_reps: "3-5", target_weight_kg: 120, rpe_target: 8.5, order_index: 0 },
        { exercise_name: "卧推窄握", exercise_type: "bench_press", target_sets: 4, target_reps: "6", order_index: 1 },
        { exercise_name: "臀推", exercise_type: "hip_thrust", target_sets: 4, target_reps: "8", order_index: 2 },
        { exercise_name: "站姿提踵", exercise_type: "calf_raise", target_sets: 4, target_reps: "15", order_index: 3 },
      ],
      [
        { exercise_name: "轻重量技术训练", exercise_type: "other", target_sets: 3, target_reps: "8次，动作质量优先", order_index: 0 },
      ],
      [
        { exercise_name: "快走或轻松骑行", exercise_type: "cycling", target_sets: 1, target_reps: "30-45分钟，低强度", order_index: 0 },
      ],
      [
        { exercise_name: "空杆技术打磨", exercise_type: "other", target_sets: 3, target_reps: "慢动作 每组10次", order_index: 0 },
      ],
    ],
    endurance: [
      [
        { exercise_name: "长距离慢跑/骑行/游泳任选", exercise_type: "running", target_sets: 1, target_reps: "60-90分钟，心率60-70%", order_index: 0 },
      ],
      [
        { exercise_name: "深蹲", exercise_type: "squat", target_sets: 3, target_reps: "15", order_index: 0 },
        { exercise_name: "平板卧推", exercise_type: "bench_press", target_sets: 3, target_reps: "15", order_index: 1 },
        { exercise_name: "硬拉", exercise_type: "deadlift", target_sets: 3, target_reps: "12", order_index: 2 },
        { exercise_name: "平板支撑", exercise_type: "plank", target_sets: 3, target_reps: "60秒", order_index: 3 },
      ],
      [
        { exercise_name: "间歇训练", exercise_type: "running", target_sets: 6, target_reps: "400m快跑 × 6，间休90秒", order_index: 0 },
      ],
      [
        { exercise_name: "引体向上", exercise_type: "pull_up", target_sets: 3, target_reps: "至力竭", order_index: 0 },
        { exercise_name: "杠铃划船", exercise_type: "barbell_row", target_sets: 3, target_reps: "15", order_index: 1 },
        { exercise_name: "站姿提踵", exercise_type: "calf_raise", target_sets: 4, target_reps: "20", order_index: 2 },
      ],
      [
        { exercise_name: "节奏跑/节奏骑", exercise_type: "cycling", target_sets: 1, target_reps: "20分钟Tempo + 热身放松共40分钟", order_index: 0 },
      ],
      [
        { exercise_name: "长时间低强度有氧", exercise_type: "swimming", target_sets: 1, target_reps: "60+分钟，轻松配速", order_index: 0 },
      ],
    ],
  };
  return presets[goal]?.[splitIdx] || presets.muscle_gain[0] || [];
}