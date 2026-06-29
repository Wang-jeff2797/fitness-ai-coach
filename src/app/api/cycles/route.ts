import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getServerUser } from "@/lib/supabase/server";
export async function GET() {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const supabase = await createServerSupabaseClient();
    const { data: cycles } = await supabase
      .from("cycles")
      .select("*")
      .eq("user_id", user.id)
      .order("start_date", { ascending: false });
    return NextResponse.json({ cycles });
  } catch (err) {
    console.error("cycles GET error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const body = await request.json();
    const supabase = await createServerSupabaseClient();
    // 如果创建新周期，先将旧的活跃周期关闭
    if (body.is_active !== false) {
      await supabase
        .from("cycles")
        .update({ is_active: false, end_date: new Date().toISOString().slice(0, 10) })
        .eq("user_id", user.id)
        .eq("is_active", true);
    }
    const { data, error } = await supabase
      .from("cycles")
      .insert({
        user_id: user.id,
        name: body.name,
        start_date: body.start_date || new Date().toISOString().slice(0, 10),
        notes: body.notes || null,
        goal: body.goal || null,
        is_active: body.is_active !== false,
      })
      .select()
      .single();
    if (error) {
      console.error("cycles POST error:", error);
      return NextResponse.json({ error: "创建周期失败" }, { status: 500 });
    }
    return NextResponse.json({ cycle: data }, { status: 201 });
  } catch (err) {
    console.error("cycles POST error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}