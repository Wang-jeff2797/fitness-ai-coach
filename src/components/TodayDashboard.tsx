"use client";
import { useState, useEffect } from "react";
import {
  Flame, Target, CalendarDays, Dumbbell, RefreshCw,
  TrendingUp, CheckCircle2, Sparkles, Activity,
  Circle, Zap, ChevronRight,
} from "lucide-react";
import type { TodayDashboard as TodayDashboardType, PlanExercise, CyclePlan } from "@/types";
const WEEKDAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const GOAL_LABEL: Record<string, string> = {
  muscle_gain: "增肌", fat_loss: "减脂", strength: "增力", endurance: "耐力",
};
function CalorieRing({ consumed, target }: { consumed: number; target: number }) {
  const size = 160;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = target > 0 ? Math.min(consumed / target, 1) : 0;
  const offset = circumference * (1 - pct);
  const isExceeded = consumed >= target && target > 0;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius}
          stroke="#f3f4f6" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={radius}
          stroke={isExceeded ? "#10b981" : "#f59e0b"}
          strokeWidth={stroke} fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 500ms ease-out" }} />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <div className="flex items-center gap-1 text-[10px] text-gray-500">
          <Flame className="w-3 h-3 text-orange-500" />
          <span>今日消耗</span>
        </div>
        <div className="text-2xl font-bold text-gray-900 mt-0.5">
          {consumed}<span className="text-xs text-gray-400 ml-1">/ {target} kcal</span>
        </div>
        <div className={`text-[10px] mt-0.5 font-medium ${isExceeded ? "text-green-600" : "text-orange-600"}`}>
          {Math.round(pct * 100)}% {isExceeded ? "已达标" : "加油"}
        </div>
      </div>
    </div>
  );
}
function PlanExerciseCard({
  ex, idx, isCompleted, onToggle, clickable,
}: {
  ex: PlanExercise; idx: number;
  isCompleted: boolean;
  onToggle?: () => void;
  clickable: boolean;
}) {
  return (
    <div
      onClick={clickable ? onToggle : undefined}
      className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all ${
        isCompleted
          ? 'bg-green-50 border-green-200'
          : 'bg-white border-gray-100 hover:border-gray-200'
      } ${clickable ? 'cursor-pointer' : ''}`}
    >
      {/* 完成勾选框 */}
      {clickable && (
        <div className="shrink-0">
          {isCompleted ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : (
            <Circle className="w-5 h-5 text-gray-300" />
          )}
        </div>
      )}
      {!clickable && (
        <div className="w-6 h-6 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center text-[10px] font-bold shrink-0">
          {idx + 1}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-semibold truncate ${isCompleted ? 'text-green-800' : 'text-gray-900'}`}>
          {ex.exercise_name}
        </div>
        <div className="text-[11px] text-gray-500 mt-0.5">
          <span className="inline-flex items-center gap-1 mr-2">
            <Dumbbell className="w-3 h-3" />
            {ex.target_sets}组 × {ex.target_reps}次
          </span>
          {ex.target_weight_kg != null && ex.target_weight_kg > 0 && (
            <span className="text-primary-600 font-medium">{ex.target_weight_kg}kg</span>
          )}
        </div>
        {ex.rpe_target && (
          <div className="text-[10px] text-gray-400 mt-0.5">
            目标 RPE {ex.rpe_target}
          </div>
        )}
      </div>
      {isCompleted && (
        <span className="text-[10px] font-medium text-green-600 shrink-0">已完成</span>
      )}
    </div>
  );
}
export default function TodayDashboard({ onRefresh }: { onRefresh?: () => void }) {
  const [data, setData] = useState<TodayDashboardType | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const load = () => {
    setLoading(true);
    fetch("/api/dashboard")
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  // 切换动作完成状态
  const toggleCompletion = async (planId: string, dayId: string, exerciseId: string) => {
    setTogglingId(exerciseId);
    try {
      const res = await fetch("/api/plan-completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: planId,
          day_id: dayId,
          exercise_id: exerciseId,
          completed_date: new Date().toISOString().slice(0, 10),
        }),
      });
      if (res.ok) load();
    } catch {
      // ignore
    } finally {
      setTogglingId(null);
    }
  };
  if (loading && !data) {
    return (
      <div className="card p-4 flex items-center justify-center h-48">
        <div className="text-gray-400 text-xs">加载今日看板...</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="card p-6 text-center">
        <Sparkles className="w-8 h-8 text-primary-500 mx-auto mb-2" />
        <p className="text-xs text-gray-500">暂无活跃周期，先去「计划」创建一个训练计划吧</p>
      </div>
    );
  }
  const activeCycle = data.active_cycle;
  const todayPlan = data.today_plan;
  const todayCompletion = data.today_completion;
  const weekPct = data.weekly_calorie_target > 0
    ? Math.min(Math.round((data.weekly_calorie_burned / data.weekly_calorie_target) * 100), 100)
    : 0;
  const workoutPct = data.workouts_planned_this_week > 0
    ? Math.round((data.workouts_completed_this_week / data.workouts_planned_this_week) * 100)
    : 0;
  // 完成度映射
  const completionMap = new Map<string, boolean>();
  if (todayCompletion) {
    for (const c of todayCompletion.completions) {
      completionMap.set(c.exercise_id, c.is_completed);
    }
  }
  return (
    <div className="space-y-3">
      {/* 顶部：活跃周期 + 目标 + 刷新 */}
      <div className="card p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0">
            {activeCycle ? (
              <>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 text-[10px] font-semibold text-primary-700 bg-primary-50 rounded-full">
                    活跃周期
                  </span>
                  {activeCycle.goal && (
                    <span className="px-2 py-0.5 text-[10px] font-semibold text-green-700 bg-green-50 rounded-full">
                      {GOAL_LABEL[activeCycle.goal] || activeCycle.goal}
                    </span>
                  )}
                </div>
                <h2 className="text-base font-bold text-gray-900 mt-1.5 truncate">{activeCycle.name}</h2>
                {activeCycle.tdee_adjusted && (
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    每日代谢参考 <span className="font-semibold text-gray-700">{activeCycle.tdee_adjusted} kcal</span>
                    · 目标摄入 {data.calorie_target} kcal
                  </p>
                )}
              </>
            ) : (
              <div>
                <span className="text-xs text-gray-400">暂无活跃周期</span>
                {data.available_plans.length > 0 && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    有 {data.available_plans.length} 个计划可用，去「计划」页面激活
                  </p>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => { load(); onRefresh?.(); }}
            className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors"
            title="刷新"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        {/* 卡路里环 + 周进度 */}
        <div className="grid grid-cols-5 gap-2">
          <div className="col-span-2 flex items-center justify-center">
            <CalorieRing consumed={data.calories_consumed_today} target={data.calorie_target} />
          </div>
          <div className="col-span-3 flex flex-col justify-center space-y-2.5 pl-1">
            <div>
              <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                <span className="flex items-center gap-1"><Activity className="w-3 h-3" />本周消耗</span>
                <span className="font-medium text-gray-700">{data.weekly_calorie_burned.toLocaleString()} / {data.weekly_calorie_target.toLocaleString()} kcal</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all"
                  style={{ width: `${weekPct}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />本周训练</span>
                <span className="font-medium text-gray-700">{data.workouts_completed_this_week} / {data.workouts_planned_this_week} 次</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all"
                  style={{ width: `${workoutPct}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-gray-500">
              <CalendarDays className="w-3 h-3" />
              <span>今天是 {WEEKDAY_NAMES[data.today_weekday]}</span>
              {todayPlan?.focus && !todayPlan.is_rest_day && (
                <span className="text-primary-600 font-medium ml-1">· {todayPlan.focus}</span>
              )}
              {todayPlan?.is_rest_day && (
                <span className="text-gray-500 ml-1 flex items-center gap-0.5">
                  <CheckCircle2 className="w-3 h-3" /> 主动恢复日
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* 今日完成度进度条 */}
      {todayCompletion && todayCompletion.total_exercises > 0 && (
        <div className="card p-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-primary-500" />
              <span className="text-xs font-semibold text-gray-700">今日完成度</span>
            </div>
            <span className="text-xs font-bold text-primary-600">
              {todayCompletion.completed_exercises}/{todayCompletion.total_exercises} · {todayCompletion.percentage}%
            </span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all"
              style={{ width: `${todayCompletion.percentage}%` }}
            />
          </div>
          <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-1.5">
            <span>{todayCompletion.plan_name}</span>
            {todayCompletion.percentage === 100 && (
              <span className="text-green-600 font-medium ml-1">🎉 今日全部完成！</span>
            )}
          </div>
        </div>
      )}
      {/* 今日训练计划（带完成勾选） */}
      {todayPlan && !todayPlan.is_rest_day && todayPlan.exercises && todayPlan.exercises.length > 0 && todayCompletion && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Target className="w-4 h-4 text-primary-600" />
              <h3 className="text-sm font-semibold text-gray-900">
                {todayPlan.day_name || "今日训练"}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400">
                {todayPlan.exercises.length} 动作 · {data.total_planned_sets_today} 组
              </span>
              {/* 全部完成按钮 */}
              {todayCompletion.completed_exercises < todayCompletion.total_exercises && (
                <button
                  onClick={async () => {
                    await fetch("/api/plan-completions", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        complete_day: true,
                        plan_id: todayCompletion.plan_id,
                        day_id: todayCompletion.day_id,
                      }),
                    });
                    load();
                  }}
                  className="px-2 py-1 text-[10px] font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-0.5"
                >
                  <Zap className="w-3 h-3" />全部完成
                </button>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            {todayPlan.exercises.map((ex, i) => (
              <PlanExerciseCard
                key={ex.id || i}
                ex={ex}
                idx={i}
                isCompleted={completionMap.get(ex.id!) ?? false}
                clickable={true}
                onToggle={() => toggleCompletion(todayCompletion!.plan_id, todayCompletion!.day_id, ex.id!)}
              />
            ))}
          </div>
          <p className="text-[10px] text-gray-400 text-center mt-3">
            点击动作标记完成，或在下面记录训练日志自动关联 ✍️
          </p>
        </div>
      )}
      {/* 旧版计划展示（无完成度数据时fallback） */}
      {todayPlan && !todayPlan.is_rest_day && todayPlan.exercises && todayPlan.exercises.length > 0 && !todayCompletion && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Target className="w-4 h-4 text-primary-600" />
              <h3 className="text-sm font-semibold text-gray-900">
                {todayPlan.day_name || "今日训练计划"}
              </h3>
            </div>
            <span className="text-[10px] text-gray-400">
              {todayPlan.exercises.length} 动作 · {data.total_planned_sets_today} 组
            </span>
          </div>
          <div className="space-y-1.5">
            {todayPlan.exercises.map((ex, i) => (
              <PlanExerciseCard key={ex.id || i} ex={ex} idx={i} isCompleted={false} clickable={false} />
            ))}
          </div>
          <p className="text-[10px] text-gray-400 text-center mt-3">
            按以上计划训练，结束后在下方记录日志 ✍️
          </p>
        </div>
      )}
      {/* 休息日提示 */}
      {todayPlan && todayPlan.is_rest_day && (
        <div className="card p-6 bg-gradient-to-br from-green-50 to-white border-green-100">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-green-100 flex items-center justify-center mb-2">
              <CheckCircle2 className="w-7 h-7 text-green-600" />
            </div>
            <h3 className="text-sm font-semibold text-green-800">今天是休息日</h3>
            <p className="text-[11px] text-green-600/80 mt-1">
              好好休息，肌肉是在睡眠中生长的。可以尝试轻度拉伸或散步。
            </p>
          </div>
        </div>
      )}
      {/* 有可用计划但无活跃周期的提示 */}
      {!activeCycle && data.available_plans.length > 0 && (
        <div className="card p-4 bg-gradient-to-br from-primary-50 to-white border-primary-100">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary-500" />
            <span className="text-xs font-semibold text-primary-700">有可用计划</span>
          </div>
          <p className="text-[11px] text-gray-600">
            你有 {data.available_plans.length} 个训练计划，去「计划」页面选择一个激活并开始训练
          </p>
        </div>
      )}
    </div>
  );
}