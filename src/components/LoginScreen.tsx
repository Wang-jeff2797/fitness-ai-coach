"use client";

import { useState } from "react";
import { useAuth } from "@/lib/supabase/AuthContext";
import { Dumbbell, Loader2, Mail, Lock, Eye, EyeOff, UserPlus } from "lucide-react";

type AuthMode = "choose" | "anonymous" | "email_login" | "email_signup" | "reset_password";

export default function LoginScreen() {
  const { signInAnonymously, signUp, signInWithEmail, resetPassword } = useAuth();

  const [mode, setMode] = useState<AuthMode>("choose");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // 邮箱表单
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const handleAnonymous = async () => {
    setLoading(true);
    setError("");
    const result = await signInAnonymously();
    if (result.error) {
      setError(result.error + " — 请在 Supabase → Authentication → Providers 中开启匿名登录");
    }
    setLoading(false);
  };

  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("请输入邮箱和密码");
      return;
    }
    setLoading(true);
    setError("");
    const result = await signInWithEmail(email.trim(), password);
    if (result.error) setError(result.error);
    setLoading(false);
  };

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim()) {
      setError("请输入邮箱和密码");
      return;
    }
    if (password.length < 6) {
      setError("密码至少 6 位");
      return;
    }
    setLoading(true);
    setError("");
    setSuccessMsg("");
    const result = await signUp(email.trim(), password);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMsg("注册成功！请查看邮箱确认链接，然后登录。");
    }
    setLoading(false);
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setError("请输入邮箱");
      return;
    }
    setLoading(true);
    setError("");
    setSuccessMsg("");
    const result = await resetPassword(email.trim());
    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMsg("密码重置链接已发送到您的邮箱");
    }
    setLoading(false);
  };

  // ---- 渲染 ----
  const renderHeader = () => (
    <>
      <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-primary-200">
        <Dumbbell className="w-9 h-9 text-white" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">FitCoach AI</h1>
      <p className="text-sm text-gray-500 mb-8 text-center">你的 AI 个人健身助手</p>
    </>
  );

  const renderError = () =>
    error && (
      <div className="w-full max-w-sm px-4 py-3 mb-4 bg-red-50 text-red-600 text-sm rounded-xl">
        {error}
      </div>
    );

  const renderSuccess = () =>
    successMsg && (
      <div className="w-full max-w-sm px-4 py-3 mb-4 bg-green-50 text-green-700 text-sm rounded-xl">
        {successMsg}
      </div>
    );

  // 选择模式
  if (mode === "choose") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-primary-50 to-white">
        {renderHeader()}
        {renderError()}
        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={() => setMode("email_login")}
            className="btn-primary w-full justify-center"
          >
            <Mail className="w-4 h-4 mr-2" />
            邮箱登录
          </button>
          <button
            onClick={() => setMode("email_signup")}
            className="btn-secondary w-full justify-center"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            注册新账号
          </button>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-gradient-to-b from-primary-50 to-white px-3 text-xs text-gray-400">
                或者
              </span>
            </div>
          </div>
          <button
            onClick={handleAnonymous}
            disabled={loading}
            className="btn-secondary w-full justify-center"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Dumbbell className="w-4 h-4 mr-2" />
            )}
            {loading ? "登录中..." : "匿名体验"}
          </button>
          <p className="text-xs text-gray-400 text-center leading-relaxed">
            匿名数据仅保存在当前设备 Cookie 中
            <br />
            登录账号后可在多设备间同步
          </p>
        </div>
      </div>
    );
  }

  // 邮箱登录
  if (mode === "email_login") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-primary-50 to-white">
        {renderHeader()}
        {renderError()}
        <div className="w-full max-w-sm space-y-3">
          <label className="block text-sm font-medium text-gray-700">邮箱</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="input-field pl-10"
              autoFocus
            />
          </div>

          <label className="block text-sm font-medium text-gray-700">密码</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码"
              className="input-field pl-10 pr-10"
              onKeyDown={(e) => e.key === "Enter" && handleEmailLogin()}
            />
            <button
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <button
            onClick={handleEmailLogin}
            disabled={loading}
            className="btn-primary w-full justify-center"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            登录
          </button>

          <div className="flex justify-between">
            <button onClick={() => { setMode("email_signup"); setError(""); setSuccessMsg(""); }}
              className="text-xs text-primary-600 hover:underline">
              没有账号？去注册
            </button>
            <button onClick={() => { setMode("reset_password"); setError(""); setSuccessMsg(""); }}
              className="text-xs text-gray-400 hover:underline">
              忘记密码？
            </button>
          </div>

          <button onClick={() => { setMode("choose"); setError(""); }}
            className="text-xs text-gray-400 hover:text-gray-600 mx-auto block mt-2">
            返回
          </button>
        </div>
      </div>
    );
  }

  // 注册
  if (mode === "email_signup") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-primary-50 to-white">
        {renderHeader()}
        {renderError()}
        {renderSuccess()}
        <div className="w-full max-w-sm space-y-3">
          <label className="block text-sm font-medium text-gray-700">邮箱</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="input-field pl-10"
              autoFocus
            />
          </div>

          <label className="block text-sm font-medium text-gray-700">密码</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 位密码"
              className="input-field pl-10 pr-10"
              onKeyDown={(e) => e.key === "Enter" && handleSignUp()}
            />
            <button
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <button
            onClick={handleSignUp}
            disabled={loading}
            className="btn-primary w-full justify-center"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            注册
          </button>

          <button onClick={() => { setMode("email_login"); setError(""); setSuccessMsg(""); }}
            className="text-xs text-primary-600 hover:underline mx-auto block">
            已有账号？去登录
          </button>

          <button onClick={() => { setMode("choose"); setError(""); }}
            className="text-xs text-gray-400 hover:text-gray-600 mx-auto block mt-2">
            返回
          </button>
        </div>
      </div>
    );
  }

  // 重置密码
  if (mode === "reset_password") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-primary-50 to-white">
        {renderHeader()}
        {renderError()}
        {renderSuccess()}
        <div className="w-full max-w-sm space-y-3">
          <p className="text-sm text-gray-500 text-center">输入注册邮箱，我们将发送重置链接</p>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="input-field pl-10"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
            />
          </div>
          <button
            onClick={handleResetPassword}
            disabled={loading}
            className="btn-primary w-full justify-center"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            发送重置链接
          </button>
          <button onClick={() => { setMode("email_login"); setError(""); setSuccessMsg(""); }}
            className="text-xs text-gray-400 hover:text-gray-600 mx-auto block">
            返回登录
          </button>
        </div>
      </div>
    );
  }

  return null;
}
