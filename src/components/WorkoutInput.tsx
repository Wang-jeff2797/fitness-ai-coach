"use client";
import { useState, useEffect } from "react";
import { Send, Loader2, Mic, Target } from "lucide-react";
import type { Cycle, CyclePlan } from "@/types";
import ExerciseSuggestions from "./ExerciseSuggestions";
interface WorkoutInputProps {
  onSuccess?: () => void;
}
export default function WorkoutInput({ onSuccess }: WorkoutInputProps) {
  const [text, setText] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [lastWord, setLastWord] = useState("");
  const [cycleId, setCycleId] = useState<string>("");
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [plans, setPlans] = useState<CyclePlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  // 检测用户当前输入的关键词（最后一个词）
  const updateLastWord = (val: string) => {
    const words = val.split(/[\s,，。、]+/);
    const last = words[words.length - 1] || "";
    setLastWord(last);
    setShowSuggestions(last.length >= 1 && !val.endsWith("kg") && !val.endsWith("组") && !val.endsWith("次"));
  };
  // 加载活跃周期和计划
  useEffect(() => {
    Promise.all([
      fetch("/api/cycles").then((r) => r.json()),
      fetch("/api/cycle-plans").then((r) => r.json()),
    ])
      .then(([cycData, planData]) => {
        if (cycData.cycles) {
          setCycles(cycData.cycles);
          const active = cycData.cycles.find((c: Cycle) => c.is_active);
          if (active) setCycleId(active.id);
        }
        if (planData.plans) {
          setPlans(planData.plans);
        }
      })
      .catch(() => {});
  }, []);
  const handleSubmit = async () => {
    if (!text.trim() || !cycleId) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/extract-workout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          cycle_id: cycleId,
          plan_id: selectedPlanId || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({ success: true, message: "训练记录已保存！" + (data.completed_count ? ` 已关联 ${data.completed_count} 个计划动作` : "") });
        setText("");
        setShowSuggestions(false);
        onSuccess?.();
      } else {
        setResult({ success: false, message: data.error || "保存失败" });
      }
    } catch {
      setResult({ success: false, message: "网络错误，请重试" });
    } finally {
      setLoading(false);
    }
  };
  const selectSuggestion = (name: string) => {
    // 替换最后一个词为选中的动作名
    const words = text.split(/[\s,，。、]+/);
    words[words.length - 1] = name;
    setText(words.join("") + " ");
    setShowSuggestions(false);
  };
  const examples = [
    "平板卧推70kg 4组8次，最后一组吃力",
    "深蹲100kg 5组5次 RPE8，引体向上8个3组",
    "游泳45分钟中高强度自由泳",
  ];
  return (
    <div className="space-y-4">
      {/* 周期选择 + 计划选择 */}
      <div className="card p-4 space-y-2.5">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            当前训练周期
          </label>
          <select
            value={cycleId}
            onChange={(e) => setCycleId(e.target.value)}
            className="input-field"
          >
            <option value="">选择周期...</option>
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.is_active ? "(活跃)" : ""}
              </option>
            ))}
          </select>
        </div>
        {/* 计划选择（可选） */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
            <Target className="w-3 h-3" />
            关联计划（可选，选后可自动匹配动作完成度）
          </label>
          <select
            value={selectedPlanId}
            onChange={(e) => setSelectedPlanId(e.target.value)}
            className="input-field"
          >
            <option value="">不关联计划（仅记录训练）</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id!}>
                {p.name} ({p.duration_weeks}周·每周{p.workouts_per_week}练)
              </option>
            ))}
          </select>
        </div>
      </div>
      {/* 输入区域 */}
      <div className="card p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          口语记录训练
        </label>
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); updateLastWord(e.target.value); }}
            placeholder="输入动作名查看 AI 推荐..."
            className="input-field min-h-[120px] resize-none"
            rows={4}
          />
          <ExerciseSuggestions
            searchText={lastWord}
            onSelect={selectSuggestion}
            visible={showSuggestions && lastWord.length >= 1}
            onClose={() => setShowSuggestions(false)}
          />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={handleSubmit}
            disabled={loading || !text.trim() || !cycleId}
            className="btn-primary flex-1"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            {loading ? "解析中..." : "提交训练"}
          </button>
          <button
            className="btn-secondary w-11 h-11 p-0 flex items-center justify-center"
            disabled
            title="语音输入（即将推出）"
          >
            <Mic className="w-5 h-5" />
          </button>
        </div>
        {/* 结果提示 */}
        {result && (
          <div
            className={`mt-3 px-3 py-2 rounded-xl text-sm ${
              result.success
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-600"
            }`}
          >
            {result.message}
          </div>
        )}
      </div>
      {/* 快速示例 */}
      <div className="card p-4">
        <p className="text-xs font-medium text-gray-500 mb-2">
          试试这样说：
        </p>
        <div className="space-y-1.5">
          {examples.map((ex, i) => (
            <button
              key={i}
              onClick={() => setText(ex)}
              className="w-full text-left px-3 py-2 text-sm text-gray-600 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
            >
              💪 {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}