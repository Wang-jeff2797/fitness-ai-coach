import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getServerUser } from "@/lib/supabase/server";
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const supabase = await createServerSupabaseClient();
    const { data: profile } = await supabase
      .from("users")
      .select("id, name, gender, age, weight_kg, height_cm, activity_level, goal")
      .eq("id", user.id)
      .single();
    return NextResponse.json({ profile });
  } catch (err) {
    console.error("profile GET error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
export async function PUT(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const body = await request.json();
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("users")
      .update({
        name: body.name ?? undefined,
        gender: body.gender ?? undefined,
        age: body.age ?? undefined,
        weight_kg: body.weight_kg ?? undefined,
        height_cm: body.height_cm ?? undefined,
        activity_level: body.activity_level ?? undefined,
        goal: body.goal ?? undefined,
      })
      .eq("id", user.id)
      .select()
      .single();
    if (error) {
      console.error("profile PUT error:", error);
      return NextResponse.json({ error: "保存失败" }, { status: 500 });
    }
    return NextResponse.json({ profile: data });
  } catch (err) {
    console.error("profile PUT error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}