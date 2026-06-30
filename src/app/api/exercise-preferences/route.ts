import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
/** GET /api/exercise-preferences?muscle_group=chest */
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const muscleGroup = searchParams.get("muscle_group");
  let query = supabase
    .from("user_exercise_preferences")
    .select("*")
    .eq("user_id", user.id)
    .order("weight", { ascending: false });
  if (muscleGroup) query = query.eq("muscle_group", muscleGroup);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ preferences: data || [] });
}
/** POST /api/exercise-preferences — 批量保存偏好 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const body = await req.json();
  const { preferences } = body;
  if (!Array.isArray(preferences) || preferences.length === 0) {
    return NextResponse.json({ error: "preferences 数组必填" }, { status: 400 });
  }
  const rows = preferences.map((p: any) => ({
    user_id: user.id,
    muscle_group: p.muscle_group,
    exercise_name: p.exercise_name,
    exercise_type: p.exercise_type || "other",
    weight: p.weight ?? 0.5,
    is_favorite: p.is_favorite ?? false,
    usage_count: p.usage_count ?? 0,
  }));
  const { error } = await supabase
    .from("user_exercise_preferences")
    .upsert(rows, {
      onConflict: "user_id,muscle_group,exercise_name",
      ignoreDuplicates: false,
    });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
/** DELETE /api/exercise-preferences — 删除偏好 */
export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 必填" }, { status: 400 });
  const { error } = await supabase
    .from("user_exercise_preferences")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}