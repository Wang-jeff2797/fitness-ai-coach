"use client";
import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft, Dumbbell, CheckCircle2, Circle, Target,
  CalendarDays, TrendingUp, Trash2, AlertCircle,
  Loader2, Edit3, Zap, Flame,
} from "lucide-react";
import type { CyclePlan, PlanDay, PlanExercise, PlanCompletionStats } from "@/types";
const WEEKDAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const GOAL_LABEL: Record<string, string> = {
  muscle_gain: "增肌", fat_loss: "减脂", strength: "增力", endurance: "耐力",
};
interface PlanDetailPageProps {
  planId: string;
  onBack: () => void;
  onRefresh?: () => void;
}
export default function PlanDetailPage({ planId, onBack, onRefresh }: PlanDetailPageProps) {
  const [plan, setPlan] = useState<CyclePlan | null>(null);
  const [stats, setStats] = useState<PlanCompletionStats | null>(null);
  const [todayCompletions, setTodayCompletions] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDayIdx, setActiveDayIdx] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const todayDow = new Date().getDay();
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [planRes, statsRes] = await Promise.all([
        fetch(`/api/cycle-plans?id=${planId}`),
        fetch(`/api/plan-completions?plan_id=${planId}&stats=true`),
      ]);
      const planData = await planRes.json();
      const statsData = await statsRes.json();
      if (planData.plan) setPlan(planData.plan);
      else setError("计划不存在");
      if (statsData.stats) {
        setStats(statsData.stats);
        // 构建今日完成映射
        const comps = statsData.today_completions || [];
        const map = new Map<string, boolean>();
        for (const c of comps) map.set(c.exercise_id, c.is_completed);
        setTodayCompletions(map);
      }
    } catch {
      setError("加载失败");
    } finally {
      setLoading(false);
    }
  }, [planId]);
  useEffect(() => { loadData(); }, [loadData]);
  // 获取今天对应的训练日索引
  const todayDayIdx = plan?.days?.findIndex(d => d.day_of_week === todayDow) ?? -1;
  const displayDayIdx = activeDayIdx ?? (todayDayIdx >= 0 ? todayDayIdx : 0);
  // 切换动作完成状态
  const toggleExercise = async (day: PlanDay, exercise: PlanExercise) => {
    setCompleting(true);
    try {
      const res = await fetch("/api/plan-completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: planId,
          day_id: day.id!,
          exercise_id: exercise.id!,
          completed_date: today,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTodayCompletions(prev => {
          const next = new Map(prev);
          if (data.action === "completed") next.set(exercise.id!, true);
          else next.set(exercise.id!, false);
          return next;
        });
        // 刷新统计
        const statsRes = await fetch(`/api/plan-completions?plan_id=${planId}&stats=true`);
        const statsData = await statsRes.json();
        if (statsData.stats) setStats(statsData.stats);
      }
    } catch {
      // ignore
    } finally {
      setCompleting(false);
    }
  };
  // 完成整个训练日
  const completeAllToday = async (day: PlanDay) => {
    if (!day.exercises || day.exercises.length === 0) return;
    setCompleting(true);
    try {
      const res = await fetch("/api/plan-completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          complete_day: true,
          plan_id: planId,
          day_id: day.id!,
          completed_date: today,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // 更新本地完成映射
        const map = new Map<string, boolean>();
        for (const ex of day.exercises) map.set(ex.id!, true);
        setTodayCompletions(map);
        // 刷新统计
        const statsRes = await fetch(`/api/plan-completions?plan_id=${planId}&stats=true`);
        const statsData = await statsRes.json();
        if (statsData.stats) setStats(statsData.stats);
      }
    } catch {
      // ignore
    } finally {
      setCompleting(false);
    }
  };
  // 删除计划
  const deletePlan = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/cycle-plans?id=${planId}`, { method: "DELETE" });
      if (res.ok) {
        onRefresh?.();
        onBack();
      } else {
        setError("删除失败");
      }
    } catch {
      setError("删除失败");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };
  if (loading && !plan) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-xs">
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />加载中...
      </div>
    );
  }
  if (error && !plan) {
    return (
      <div className="card p-6 text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-red-500">{error}</p>
        <button onClick={onBack} className="btn-secondary mt-4 text-xs">返回</button>
      </div>
    );
  }
  if (!plan) return null;
  const days = (plan.days || []).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  const activeDay = days[displayDayIdx];
  const isToday = activeDay?.day_of_week === todayDow;
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <ChevronLeft className="w-3 h-3" /> 返回
        </button>
        <div className="flex items-center gap-2">
          {showDeleteConfirm ? (
            <div className="flex items-center gap-1.5">
              <button onClick={deletePlan} disabled={deleting}
                className="px-2.5 py-1.5 text-[11px] font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1">
                {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                确认删除
              </button>
              <button onClick={() => setShowDeleteConfirm(false)}
                className="px-2.5 py-1.5 text-[11px] font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors">
                取消
              </button>
            </div>
          ) : (
            <>
              <button onClick={() => setShowDeleteConfirm(true)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="删除计划">
                <Trash2 className="w-4 h-4" />
              </button>
              <span className="text-[10px] text-gray-300">|</span>
            </>
          )}
        </div>
      </div>
      {/* 计划概览 */}
      <div className="card p-4 bg-gradient-to-br from-gray-50 to-white">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-gray-900 truncate">{plan.name}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${
                plan.goal === 'muscle_gain' ? 'bg-primary-100 text-primary-700 border-primary-200' :
                plan.goal === 'fat_loss' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                plan.goal === 'strength' ? 'bg-violet-100 text-violet-700 border-violet-200' :
                'bg-teal-100 text-teal-700 border-teal-200'
              }`}>
                {GOAL_LABEL[plan.goal] || plan.goal}
              </span>
              <span className="text-[10px] text-gray-500">
                <CalendarDays className="w-2.5 h-2.5 inline mr-0.5" />
                {plan.duration_type === 'daily'
                  ? `${plan.total_days || ''}天 · ${plan.total_rounds || ''}轮`
                  : `${plan.duration_weeks}周 · 每周${plan.workouts_per_week}练`}
              </span>
            </div>
            {plan.notes && (
              <p className="text-[11px] text-gray-500 mt-2">{plan.notes}</p>
            )}
          </div>
        </div>
      </div>
      {/* 完成度总览 */}
      {stats && (
        <div className="grid grid-cols-2 gap-2">
          <div className="card p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-[10px] text-gray-500 mb-1">
              <Zap className="w-3 h-3 text-primary-500" />
              <span>今日完成度</span>
            </div>
            <div className="text-2xl font-bold text-primary-600">
              {stats.today_percentage}%
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              {stats.today_completed} / {stats.today_total} 动作
            </div>
          </div>
          <div className="card p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-[10px] text-gray-500 mb-1">
              <TrendingUp className="w-3 h-3 text-green-500" />
              <span>计划总完成度</span>
            </div>
            <div className="text-2xl font-bold text-green-600">
              {stats.overall_percentage}%
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              {stats.total_completed_days} / {stats.total_training_days} 次
            </div>
          </div>
        </div>
      )}
      {/* 日期导航 */}
      <div className="card p-3">
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {days.map((day, idx) => {
            const isActive = idx === displayDayIdx;
            const isTodayDay = day.day_of_week === todayDow;
            return (
              <button
                key={day.id || idx}
                onClick={() => setActiveDayIdx(idx)}
                className={`flex-shrink-0 px-2.5 py-2 rounded-xl text-center transition-all min-w-[52px] ${
                  isActive
                    ? 'bg-primary-600 text-white shadow-sm'
                    : day.is_rest_day
                      ? 'bg-green-50 text-green-600 hover:bg-green-100'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <div className="text-[9px] font-medium">{WEEKDAY_NAMES[day.day_of_week]}</div>
                <div className="text-[10px] font-bold mt-0.5">
                  {day.is_rest_day ? '休' : `D${idx + 1}`}
                </div>
                {isTodayDay && (
                  <div className="text-[8px] mt-0.5 opacity-70">今天</div>
                )}
              </button>
            );
          })}
        </div>
      </div>
      {/* 当前选中日的内容 */}
      {activeDay && (
        <div className={`card overflow-hidden border-l-4 ${
          activeDay.is_rest_day ? 'border-green-400' : 'border-primary-400'
        }`}>
          {/* Day Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-gray-100 text-gray-600">
                  {WEEKDAY_NAMES[activeDay.day_of_week]}
                </span>
                {activeDay.is_rest_day ? (
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-green-100 text-green-700">
                    休息日
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-400">
                    {activeDay.exercises?.length || 0} 个动作
                  </span>
                )}
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mt-0.5">
                {activeDay.day_name || `训练日 #${displayDayIdx + 1}`}
              </h3>
              {activeDay.focus && !activeDay.is_rest_day && (
                <p className="text-[10px] text-gray-500 mt-0.5">{activeDay.focus}</p>
              )}
            </div>
            {isToday && !activeDay.is_rest_day && activeDay.exercises && activeDay.exercises.length > 0 && (
              <button
                onClick={() => completeAllToday(activeDay)}
                disabled={completing}
                className="px-3 py-1.5 text-[11px] font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-1 shrink-0"
              >
                {completing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Zap className="w-3 h-3" />
                )}
                全部完成
              </button>
            )}
          </div>
          {/* Exercises */}
          {!activeDay.is_rest_day && activeDay.exercises && activeDay.exercises.length > 0 && (
            <div className="p-3 space-y-1.5">
              {activeDay.exercises.map((ex, i) => {
                const isCompleted = todayCompletions.get(ex.id!) ?? false;
                const isClickable = isToday;
                return (
                  <div
                    key={ex.id || i}
                    onClick={() => isClickable && toggleExercise(activeDay, ex)}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      isCompleted
                        ? 'bg-green-50 border-green-200'
                        : 'bg-white border-gray-100 hover:border-gray-200'
                    } ${isClickable ? 'cursor-pointer' : ''}`}
                  >
                    {/* 完成勾选框 */}
                    {isClickable && (
                      <div className="shrink-0">
                        {isCompleted ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-300 hover:text-gray-400" />
                        )}
                      </div>
                    )}
                    {!isClickable && (
                      <div className="w-5 h-5 rounded-lg bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 shrink-0">
                        {i + 1}
                      </div>
                    )}
                    {/* 动作详情 */}
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold truncate ${
                        isCompleted ? 'text-green-800' : 'text-gray-900'
                      }`}>
                        {ex.exercise_name}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <Dumbbell className="w-2.5 h-2.5" />
                        <span>{ex.target_sets}组 × {ex.target_reps}次</span>
                        {ex.target_weight_kg != null && ex.target_weight_kg > 0 && (
                          <span className="text-primary-600 font-medium">· {ex.target_weight_kg}kg</span>
                        )}
                        {ex.rpe_target && (
                          <span className="text-gray-400">· RPE {ex.rpe_target}</span>
                        )}
                      </div>
                    </div>
                    {/* 完成标记 */}
                    {isCompleted && (
                      <span className="text-[10px] font-medium text-green-600 shrink-0">已完成</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {/* 休息日展示 */}
          {activeDay.is_rest_day && (
            <div className="p-6 text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-green-100 flex items-center justify-center mb-2">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-sm font-semibold text-green-800">休息日</h3>
              <p className="text-[11px] text-green-600/80 mt-1">好好恢复，肌肉在休息时生长</p>
            </div>
          )}
          {/* 空动作提示 */}
          {!activeDay.is_rest_day && (!activeDay.exercises || activeDay.exercises.length === 0) && (
            <div className="p-6 text-center">
              <Dumbbell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">该天暂无训练动作</p>
            </div>
          )}
        </div>
      )}
      {/* 今天不是训练日的提示 */}
      {todayDayIdx < 0 && (
        <div className="card p-4 bg-gradient-to-br from-green-50 to-white border-green-100 text-center">
          <CheckCircle2 className="w-6 h-6 text-green-500 mx-auto mb-1" />
          <p className="text-xs text-green-700 font-medium">今天没有安排训练</p>
          <p className="text-[10px] text-green-600/70 mt-0.5">
            计划中今天没有匹配的训练日，好好休息吧
          </p>
        </div>
      )}
      {/* 删除成功/失败提示 - 不需要额外操作，因为删除后会自动返回 */}
    </div>
  );
}