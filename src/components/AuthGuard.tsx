"use client";
import { useAuth } from "@/lib/supabase/AuthContext";
import LoginScreen from "./LoginScreen";
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">加载中...</p>
        </div>
      </div>
    );
  }
  if (!user) {
    return <LoginScreen />;
  }
  return <>{children}</>;
}