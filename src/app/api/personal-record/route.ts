import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getServerUser } from "@/lib/supabase/server";
import { estimate1RM } from "@/lib/analytics/1rm";
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from("personal_records")
      .select("*")
      .eq("user_id", user.id)
      .order("record_date", { ascending: false });
    return NextResponse.json({ records: data || [] });
  } catch (err) {
    console.error("personal-record GET error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const body = await request.json();
    const { exercise, weight_kg, reps, record_date, notes } = body;
    if (!exercise || !weight_kg || !reps) {
      return NextResponse.json({ error: "exercise, weight_kg, reps 必填" }, { status: 400 });
    }
    const estimated_1rm = estimate1RM(Number(weight_kg), Number(reps));
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("personal_records")
      .insert({
        user_id: user.id,
        exercise,
        weight_kg: Number(weight_kg),
        reps: Number(reps),
        estimated_1rm,
        record_date: record_date || new Date().toISOString().slice(0, 10),
        notes: notes || null,
      })
      .select()
      .single();
    if (error) {
      console.error("personal-record POST error:", error);
      if (error.code === '23505') {
        return NextResponse.json({ error: "该纪录已存在" }, { status: 409 });
      }
      return NextResponse.json({ error: "保存失败" }, { status: 500 });
    }
    return NextResponse.json({ record: data }, { status: 201 });
  } catch (err) {
    console.error("personal-record POST error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
export async function DELETE(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id 参数必填" }, { status: 400 });
    const supabase = await createServerSupabaseClient();
    await supabase
      .from("personal_records")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("personal-record DELETE error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}