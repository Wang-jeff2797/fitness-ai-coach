import { createServerClient } from "@supabase/ssr";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
/**
 * 服务端 Supabase 客户端（使用 anon key + cookie auth）
 * RLS 自动按 auth.uid() 隔离数据
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: Record<string, string | boolean | number | Date>;
          }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component 中可能不可写
          }
        },
      },
    }
  );
}
/**
 * 服务端客户端（使用 service_role key，绕过 RLS）
 * 仅用于特殊操作（如创建初始用户记录），API 路由中不要使用
 */
export function createServiceSupabaseClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
/**
 * 获取当前登录用户（从请求 cookie 中解析）
 * API 路由中统一使用此函数鉴权
 */
export async function getServerUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}