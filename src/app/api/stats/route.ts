import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getServerUser } from "@/lib/supabase/server";
import { computeCycleSummary } from "@/lib/analytics/cycle-summary";
import type { StatsResponse, CycleSummary } from "@/types";
export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const supabase = await createServerSupabaseClient();
    // 1. 获取所有周期
    const { data: cycles } = await supabase
      .from("cycles")
      .select("id, name, start_date, end_date, is_active")
      .eq("user_id", user.id)
      .order("start_date", { ascending: false });
    // 2. 获取所有训练数据
    const { data: workouts } = await supabase
      .from("workouts")
      .select("*")
      .eq("user_id", user.id)
      .order("performed_at", { ascending: true });
    if (!cycles || !workouts) {
      return NextResponse.json<StatsResponse>({
        cycles: [],
        volume_trend: [],
        current_cycle_summary: null,
      });
    }
    // 3. 计算每个周期的总容量
    const cycleVolumeMap = new Map<string, number>();
    const cycleWorkoutCountMap = new Map<string, number>();
    for (const w of workouts) {
      const vol = w.session_data?.total_volume_kg ?? 0;
      cycleVolumeMap.set(w.cycle_id, (cycleVolumeMap.get(w.cycle_id) ?? 0) + vol);
      cycleWorkoutCountMap.set(w.cycle_id, (cycleWorkoutCountMap.get(w.cycle_id) ?? 0) + 1);
    }
    // 4. 计算容量趋势
    const volumeTrend = workouts.map((w) => ({
      date: w.performed_at.slice(0, 10),
      volume: w.session_data?.total_volume_kg ?? 0,
      session_rpe: w.session_data?.session_rpe ?? 5,
    }));
    // 5. 当前活跃周期的摘要
    const activeCycle = cycles.find((c) => c.is_active);
    let currentCycleSummary: CycleSummary | null = null;
    if (activeCycle) {
      const cycleWorkouts = workouts.filter((w) => w.cycle_id === activeCycle.id);
      if (cycleWorkouts.length > 0) {
        currentCycleSummary = computeCycleSummary(cycleWorkouts);
      }
    }
    const cyclesData = cycles.map((c) => ({
      id: c.id,
      name: c.name,
      start_date: c.start_date,
      end_date: c.end_date,
      total_volume: cycleVolumeMap.get(c.id) ?? 0,
      workout_count: cycleWorkoutCountMap.get(c.id) ?? 0,
    }));
    return NextResponse.json<StatsResponse>({
      cycles: cyclesData,
      volume_trend: volumeTrend,
      current_cycle_summary: currentCycleSummary,
    });
  } catch (err) {
    console.error("stats error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}