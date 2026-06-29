"use client";

import { useState } from "react";
import { useAuth } from "@/lib/supabase/AuthContext";
import { Loader2, Mail, Lock, Eye, EyeOff, X, CheckCircle2, Shield } from "lucide-react";

interface Props {
  onClose: () => void;
}

export default function LinkAccountModal({ onClose }: Props) {
  const { signUp, signInWithEmail } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isExistingUser, setIsExistingUser] = useState(false);

  const handleSubmit = async () => {
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

    if (isExistingUser) {
      // 已有账号 → 登录，Supabase 会自动绑定当前匿名会话
      const result = await signInWithEmail(email.trim(), password);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
      }
    } else {
      // 注册新账号
      const result = await signUp(email.trim(), password);
      if (result.error) {
        if (result.error.includes("already") || result.error.includes("registered")) {
          setError("该邮箱已注册，请使用「已有账号」登录");
          setIsExistingUser(true);
        } else {
          setError(result.error);
        }
      } else {
        setSuccess(true);
      }
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl text-center space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-sm font-medium text-gray-900">
            {isExistingUser ? "账号已绑定！" : "注册成功！"}
          </p>
          <p className="text-xs text-gray-500">
            {isExistingUser
              ? "已成功绑定邮箱，以后用邮箱登录即可同步数据。"
              : "请查看邮箱中的确认链接完成验证，之后即可用邮箱登录。"}
          </p>
          <button onClick={onClose} className="btn-primary w-full justify-center">
            完成
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary-600" />
            <h3 className="font-semibold text-gray-900">
              {isExistingUser ? "绑定已有账号" : "绑定邮箱账号"}
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          {isExistingUser
            ? "使用已有邮箱账号登录，当前匿名数据将自动合并到该账号。"
            : "注册后可在多设备间同步训练数据。"}
        </p>

        {error && (
          <div className="mb-3 px-3 py-2 bg-red-50 text-red-600 text-xs rounded-xl">
            {error}
          </div>
        )}

        {/* 邮箱 */}
        <label className="block text-xs font-medium text-gray-500 mb-1">邮箱</label>
        <div className="relative mb-3">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="input-field pl-10 text-sm"
            autoFocus
          />
        </div>

        {/* 密码 */}
        <label className="block text-xs font-medium text-gray-500 mb-1">密码</label>
        <div className="relative mb-4">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="至少 6 位密码"
            className="input-field pl-10 pr-10 text-sm"
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
          <button
            onClick={() => setShowPw(!showPw)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
          >
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="btn-primary w-full justify-center mb-3"
        >
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isExistingUser ? "登录并绑定" : "注册并绑定"}
        </button>

        {isExistingUser ? (
          <button onClick={() => { setIsExistingUser(false); setError(""); }}
            className="text-xs text-primary-600 hover:underline mx-auto block">
            注册新账号
          </button>
        ) : (
          <button onClick={() => { setIsExistingUser(true); setError(""); }}
            className="text-xs text-primary-600 hover:underline mx-auto block">
            已有账号？去绑定
          </button>
        )}
      </div>
    </div>
  );
}
