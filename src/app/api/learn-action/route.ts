import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getServerUser } from "@/lib/supabase/server";
import { callDeepSeekJSON } from "@/lib/ai/deepseek";
export const dynamic = 'force-dynamic';
const LEARN_ACTION_PROMPT = `你是一个运动科学专家，参考《2011体力活动概要》(Compendium of Physical Activities)。
对于用户提供的一个健身动作名称，你需要：
1. 判断它是力量训练还是有氧运动
2. 给出该动作合理的 MET 值（代谢当量）
3. 对 MET 值做简要说明
输出 JSON:
{
  "action_name": "动作名称",
  "category": "strength | cardio | other",
  "suggested_met": 5.0,
  "explanation": "该动作的 MET 值依据..."
}
只输出 JSON，不要任何其他文字。`;
export async function GET() {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from("unknown_actions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    return NextResponse.json({ actions: data || [] });
  } catch (err) {
    console.error("learn-action GET error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const body = await request.json();
    const { action_name } = body;
    if (!action_name) return NextResponse.json({ error: "action_name 必填" }, { status: 400 });
    const supabase = await createServerSupabaseClient();
    const { data: existing } = await supabase
      .from("met_constants").select("*").eq("action_name", action_name).maybeSingle();
    if (existing) return NextResponse.json({ action: existing, already_exists: true });
    const result = await callDeepSeekJSON<{
      action_name: string; category: string; suggested_met: number; explanation: string;
    }>(LEARN_ACTION_PROMPT, `请分析动作: ${action_name}`, { temperature: 0.1, maxTokens: 500 });
    const { data: newMet, error } = await supabase
      .from("met_constants").insert({
        action_name: result.action_name || action_name,
        met_value: result.suggested_met, category: result.category || 'other',
        source: 'ai_learned', is_user_added: true, user_id: user.id,
      }).select().single();
    if (error) {
      return NextResponse.json({ error: "保存失败", ai_result: result }, { status: 500 });
    }
    await supabase.from("unknown_actions").update({
      is_learned: true, suggested_met: result.suggested_met,
    }).eq("user_id", user.id).eq("action_name", action_name);
    return NextResponse.json({ action: newMet, explanation: result.explanation });
  } catch (err) {
    console.error("learn-action error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}