"use client";
import { useState, useEffect } from "react";
import {
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Brain,
} from "lucide-react";
import type { Cycle, CycleAdjustment } from "@/types";
interface CycleManagerProps {
  onRefresh?: () => void;
}
export default function CycleManager({ onRefresh }: CycleManagerProps) {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGoal, setNewGoal] = useState("muscle_gain");
  const [creating, setCreating] = useState(false);
  // 周期调整
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [adjustResult, setAdjustResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const loadCycles = () => {
    fetch("/api/cycles")
      .then((r) => r.json())
      .then((data) => {
        if (data.cycles) setCycles(data.cycles);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    loadCycles();
  }, []);
  const handleCreateCycle = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await fetch("/api/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), goal: newGoal }),
      });
      setNewName("");
      setShowNewForm(false);
      loadCycles();
      onRefresh?.();
    } catch {
    } finally {
      setCreating(false);
    }
  };
  const handleAdjustCycle = async (cycleId: string) => {
    setAdjusting(true);
    setAdjustResult(null);
    try {
      const res = await fetch("/api/adjust-cycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycle_id: cycleId, feedback }),
      });
      const data = await res.json();
      if (data.success) {
        setAdjustResult({ success: true, message: "调整方案已生成！" });
        setFeedback("");
        setAdjustingId(null);
        loadCycles();
        onRefresh?.();
      } else {
        setAdjustResult({ success: false, message: data.error || "调整失败" });
      }
    } catch {
      setAdjustResult({ success: false, message: "网络错误" });
    } finally {
      setAdjusting(false);
    }
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        加载中...
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {/* 创建新周期 */}
      {showNewForm ? (
        <div className="card p-4">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="周期名称（如：增力周期 Phase 3）"
            className="input-field mb-2"
            autoFocus
          />
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">训练目标</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "muscle_gain", label: "增肌" },
                { value: "fat_loss", label: "减脂" },
                { value: "strength", label: "增力" },
                { value: "endurance", label: "耐力" },
              ].map((opt) => (
                <button key={opt.value}
                  onClick={() => setNewGoal(opt.value)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                    newGoal === opt.value
                      ? "bg-primary-100 text-primary-700 border border-primary-200"
                      : "bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreateCycle}
              disabled={creating || !newName.trim()}
              className="btn-primary flex-1"
            >
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              创建
            </button>
            <button
              onClick={() => setShowNewForm(false)}
              className="btn-secondary flex-1"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowNewForm(true)}
          className="btn-primary w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          新建训练周期
        </button>
      )}
      {/* 周期列表 */}
      {cycles.map((cycle) => (
        <div key={cycle.id} className="card overflow-hidden">
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-semibold text-gray-900">{cycle.name}</h3>
                <p className="text-xs text-gray-400">
                  {cycle.start_date} ~ {cycle.end_date || "进行中"}
                </p>
              </div>
              {cycle.is_active && (
                <span className="px-2 py-0.5 text-[10px] font-medium text-green-700 bg-green-50 rounded-full">
                  活跃
                </span>
              )}
            </div>
            {/* 调整方案 */}
            {cycle.adjustment_plan && (
              <div className="mt-3 bg-primary-50 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Brain className="w-4 h-4 text-primary-600" />
                  <span className="text-xs font-semibold text-primary-700">
                    AI 调整方案
                  </span>
                </div>
                <p className="text-xs text-primary-600 mb-2">
                  {(cycle.adjustment_plan as CycleAdjustment).next_cycle_plan
                    ?.overall_focus || ""}
                </p>
                <div className="space-y-1">
                  {(
                    (cycle.adjustment_plan as CycleAdjustment).next_cycle_plan
                      ?.adjustments || []
                  ).map((adj, i) => (
                    <div
                      key={i}
                      className="text-xs bg-white/60 rounded-lg px-2 py-1.5"
                    >
                      <span className="font-medium text-gray-700">
                        {adj.exercise}
                      </span>
                      <span className="text-gray-500">
                        : {adj.target_sets}组×{adj.target_reps}次 ·{" "}
                        {adj.target_weight_adjustment}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* 调整操作 */}
            {cycle.is_active && (
              <div className="mt-3">
                {adjustingId === cycle.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="对这个周期的感受？哪里需要调整？..."
                      className="input-field min-h-[60px] text-xs resize-none"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAdjustCycle(cycle.id)}
                        disabled={adjusting}
                        className="btn-primary flex-1 text-xs"
                      >
                        {adjusting && (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        )}
                        生成调整方案
                      </button>
                      <button
                        onClick={() => {
                          setAdjustingId(null);
                          setFeedback("");
                          setAdjustResult(null);
                        }}
                        className="btn-secondary text-xs"
                      >
                        取消
                      </button>
                    </div>
                    {adjustResult && (
                      <div
                        className={`flex items-center gap-1.5 text-xs ${
                          adjustResult.success
                            ? "text-green-600"
                            : "text-red-500"
                        }`}
                      >
                        {adjustResult.success ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5" />
                        )}
                        {adjustResult.message}
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setAdjustingId(cycle.id)}
                    className="w-full py-2 text-xs font-medium text-primary-600 bg-primary-50 rounded-xl hover:bg-primary-100 transition-colors"
                  >
                    <Brain className="w-3.5 h-3.5 inline mr-1" />
                    AI 周期调整
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
      {cycles.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-400 text-sm">还没有训练周期</p>
        </div>
      )}
    </div>
  );
}