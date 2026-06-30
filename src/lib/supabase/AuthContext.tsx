"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "./client";
import type { User } from "@supabase/supabase-js";
interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAnonymous: boolean;
  /** 邮箱注册 */
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  /** 邮箱登录 */
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  /** 匿名登录 */
  signInAnonymously: () => Promise<{ error?: string }>;
  /** 匿名用户绑定邮箱（转换为永久账号） */
  linkEmail: (email: string, password: string) => Promise<{ error?: string }>;
  /** 重置密码（发送邮件） */
  resetPassword: (email: string) => Promise<{ error?: string }>;
  /** 设置新密码（重置密码流程第二步） */
  updatePassword: (newPassword: string) => Promise<{ error?: string }>;
  /** 登出 */
  signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  isAnonymous: false,
  signUp: async () => ({}),
  signInWithEmail: async () => ({}),
  signInAnonymously: async () => ({}),
  linkEmail: async () => ({}),
  resetPassword: async () => ({}),
  updatePassword: async () => ({}),
  signOut: async () => {},
});
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  useEffect(() => {
    // 环境变量未就绪（如构建/预渲染阶段），跳过
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);
  const isAnonymous = user?.is_anonymous ?? false;
  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: "客户端未初始化" };
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) return { error: error.message };
    return {};
  }, [supabase]);
  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: "客户端未初始化" };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  }, [supabase]);
  const signInAnonymously = useCallback(async () => {
    if (!supabase) return { error: "客户端未初始化" };
    const { error } = await supabase.auth.signInAnonymously();
    if (error) return { error: error.message };
    return {};
  }, [supabase]);
  const linkEmail = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: "客户端未初始化" };
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) return { error: signUpError.message };
    if (!data.user) return { error: "注册失败" };
    const { error: linkError } = await supabase.auth.linkIdentity({ 
      provider: 'email',
      options: { email, password }
    } as any);
    if (linkError) return { error: linkError.message };
    return {};
  }, [supabase]);
  const resetPassword = useCallback(async (email: string) => {
    if (!supabase) return { error: "客户端未初始化" };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    if (error) return { error: error.message };
    return {};
  }, [supabase]);
  const updatePassword = useCallback(async (newPassword: string) => {
    if (!supabase) return { error: "客户端未初始化" };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error: error.message };
    return {};
  }, [supabase]);
  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  }, [supabase]);
  return (
    <AuthContext.Provider value={{
      user, loading, isAnonymous,
      signUp, signInWithEmail, signInAnonymously,
      linkEmail, resetPassword, updatePassword, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  return useContext(AuthContext);
}