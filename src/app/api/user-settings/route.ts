import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getServerUser } from "@/lib/supabase/server";
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id);
    return NextResponse.json({ settings: data || [] });
  } catch (err) {
    console.error("user-settings GET error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const body = await request.json();
    const { key, value } = body;
    if (!key || value === undefined) {
      return NextResponse.json({ error: "key 和 value 必填" }, { status: 400 });
    }
    const supabase = await createServerSupabaseClient();
    // Upsert: 存在则更新，不存在则插入
    const { data, error } = await supabase
      .from("user_settings")
      .upsert(
        { user_id: user.id, key, value: String(value) },
        { onConflict: "user_id, key", ignoreDuplicates: false }
      )
      .select()
      .single();
    if (error) {
      console.error("user-settings POST error:", error);
      return NextResponse.json({ error: "保存失败" }, { status: 500 });
    }
    return NextResponse.json({ setting: data });
  } catch (err) {
    console.error("user-settings POST error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
export async function DELETE(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");
    if (!key) {
      return NextResponse.json({ error: "key 参数必填" }, { status: 400 });
    }
    const supabase = await createServerSupabaseClient();
    await supabase
      .from("user_settings")
      .delete()
      .eq("user_id", user.id)
      .eq("key", key);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("user-settings DELETE error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}