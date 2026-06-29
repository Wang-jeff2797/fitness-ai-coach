import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getServerUser } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const cycleId = searchParams.get("cycle_id");
    const supabase = await createServerSupabaseClient();
    let query = supabase
      .from("workouts")
      .select("*")
      .eq("user_id", user.id)
      .order("performed_at", { ascending: false });
    if (cycleId) {
      query = query.eq("cycle_id", cycleId);
    }
    const { data: workouts, error } = await query;
    if (error) {
      console.error("workouts GET error:", error);
      return NextResponse.json({ error: "获取训练记录失败" }, { status: 500 });
    }
    return NextResponse.json({ workouts });
  } catch (err) {
    console.error("workouts GET error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}