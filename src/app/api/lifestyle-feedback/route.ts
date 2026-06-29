import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getServerUser } from "@/lib/supabase/server";
import { calculateTDEE } from "@/lib/analytics/tdee";
export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const cycleId = searchParams.get("cycle_id");
    const supabase = await createServerSupabaseClient();
    let query = supabase
      .from("lifestyle_feedback")
      .select("*")
      .eq("user_id", user.id);
    if (cycleId) query = query.eq("cycle_id", cycleId);
    const { data } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
    return NextResponse.json({ feedback: data || null });
  } catch (err) {
    console.error("lifestyle-feedback GET error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const body = await request.json();
    const { cycle_id, sleep_quality, stress_level, activity_change, special_condition, notes } = body;
    if (!cycle_id || !sleep_quality || !stress_level || !activity_change || !special_condition) {
      return NextResponse.json({ error: "缺少必填字段" }, { status: 400 });
    }
    const supabase = await createServerSupabaseClient();
    const { data: cycle } = await supabase.from("cycles").select("id").eq("id", cycle_id).eq("user_id", user.id).single();
    if (!cycle) return NextResponse.json({ error: "周期不存在" }, { status: 404 });
    const { data: feedback, error } = await supabase.from("lifestyle_feedback").insert({
      user_id: user.id, cycle_id, sleep_quality, stress_level, activity_change, special_condition, notes: notes || null,
    }).select().single();
    if (error) {
      console.error("保存生活反馈失败:", error);
      return NextResponse.json({ error: "保存失败" }, { status: 500 });
    }
    const { data: profile } = await supabase.from("users")
      .select("gender, age, weight_kg, height_cm, activity_level, goal")
      .eq("id", user.id).single();
    if (profile) {
      const tdeeResult = calculateTDEE(
        profile.gender || 'male', Number(profile.weight_kg) || 70, Number(profile.height_cm) || 175,
        profile.age || 25, profile.activity_level || 'moderate', feedback
      );
      await supabase.from("cycles").update({
        tdee_adjusted: tdeeResult.tdee_adjusted,
        goal: body.goal || profile.goal || null,
      }).eq("id", cycle_id);
      return NextResponse.json({ success: true, feedback, tdee: tdeeResult });
    }
    return NextResponse.json({ success: true, feedback });
  } catch (err) {
    console.error("lifestyle-feedback error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}