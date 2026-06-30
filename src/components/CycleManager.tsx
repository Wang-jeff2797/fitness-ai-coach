"use client";
import { useState, useEffect, useRef } from "react";
import {
  Plus, Loader2, CheckCircle2, AlertCircle, Brain,
  ChevronLeft, Trash2, Edit3, Save, Target,
  CalendarDays, Dumbbell, Sparkles, RotateCcw,
} from "lucide-react";
import type {
  Cycle, CyclePlan, PlanDay, PlanExercise, UserGoal, CycleAdjustment,
} from "@/types";
import { COMMON_DAY_KEYWORDS, INTENSITY_COLORS, calcDayIntensity, calcTotalVolume, calcIntensityLevel, normalizeExerciseName } from "@/lib/exercise-utils";
import { MUSCLE_GROUPS } from "@/lib/exercise-library";
interface CycleManagerProps {
  onRefresh?: () => void;
}
const GOAL_OPTS: { value: UserGoal; label: string; color: string }[] = [
  { value: "muscle_gain", label: "增肌", color: "primary" },
  { value: "fat_loss", label: "减脂", color: "orange" },
  { value: "strength", label: "增力", color: "violet" },
  { value: "endurance", label: "耐力", color: "teal" },
];
const WEEKDAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
function useGoals() {
  const colorMap: Record<string, string> = {
    muscle_gain: "bg-primary-100 text-primary-700 border-primary-200",
    fat_loss: "bg-orange-100 text-orange-700 border-orange-200",
    strength: "bg-violet-100 text-violet-700 border-violet-200",
    endurance: "bg-teal-100 text-teal-700 border-teal-200",
  };
  return { colorMap };
}
export default function CycleManager({ onRefresh }: CycleManagerProps) {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [plans, setPlans] = useState<CyclePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "wizard" | "detail">("list");
  const [detailPlan, setDetailPlan] = useState<CyclePlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  // === 向导状态 ===
  const [wizStep, setWizStep] = useState(1);
  const [wizGoal, setWizGoal] = useState<UserGoal>("muscle_gain");
  const [wizWeeks, setWizWeeks] = useState(4);
  const [wizPerWeek, setWizPerWeek] = useState(3);
  const [wizName, setWizName] = useState("");
  const [wizGenerating, setWizGenerating] = useState(false);
  const [wizResultPlanId, setWizResultPlanId] = useState<string | null>(null);
  // 每日肌群关键字（wizPerWeek 长度的数组）
  const [wizDayKeywords, setWizDayKeywords] = useState<string[]>(["push", "pull", "legs"]);
  // 当 wizPerWeek 变化时同步 wizDayKeywords 长度
  useEffect(() => {
    setWizDayKeywords(prev => {
      if (prev.length === wizPerWeek) return prev;
      if (prev.length < wizPerWeek) {
        const defaults = ["push", "pull", "legs", "push", "upper", "full_body"];
        return [...prev, ...defaults.slice(prev.length, wizPerWeek)];
      }
      return prev.slice(0, wizPerWeek);
    });
  }, [wizPerWeek]);
  const { colorMap } = useGoals();
  const loadAll = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/cycles").then(r => r.json()),
      fetch("/api/cycle-plans").then(r => r.json()),
    ]).then(([cyc, pln]: any) => {
      setCycles(cyc.cycles || []);
      setPlans(pln.plans || []);
    }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { loadAll(); }, []);
  const resetWizard = () => {
    setWizStep(1); setWizGoal("muscle_gain"); setWizWeeks(4);
    setWizPerWeek(3); setWizName(""); setWizGenerating(false); setWizResultPlanId(null);
    setView("list");
  };
  const doGeneratePlan = async () => {
    setError(null);
    setWizGenerating(true);
    try {
      const res = await fetch("/api/cycle-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: wizGoal,
          duration_weeks: wizWeeks,
          workouts_per_week: wizPerWeek,
          name: wizName.trim() || undefined,
          day_keywords: wizDayKeywords,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "生成失败");
      setWizResultPlanId(d.plan_id);
      setWizStep(4);
      loadAll();
    } catch (e: any) {
      setError(e.message || "生成失败，请重试");
    } finally {
      setWizGenerating(false);
    }
  };
  const activatePlanAsCycle = async (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    setWizGenerating(true);
    try {
      const res = await fetch("/api/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: plan.name,
          goal: plan.goal,
          plan_id: planId,
          start_date: new Date().toISOString().slice(0, 10),
          notes: plan.notes,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "激活失败");
      onRefresh?.();
      resetWizard();
      loadAll();
    } catch (e: any) {
        setError(e.message || "激活失败");
      } finally {
        setWizGenerating(false);
      }
  };
  const openDetail = async (planId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cycle-plans?id=${planId}`);
      const d = await res.json();
      if (d.plan) { setDetailPlan(d.plan); setView("detail"); }
    } finally {
      setLoading(false);
    }
  };
  const cycleOfPlan = (planId: string) =>
    cycles.find(c => (c as any).plan_id === planId || plans.find(p => p.id === planId)?.cycle_id === c.id);
  if (loading && cycles.length === 0 && plans.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-xs">加载中...</div>
    );
  }
  // ============ 向导视图 ============
  if (view === "wizard") {
    return (
      <div className="space-y-4">
        <button onClick={resetWizard} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <ChevronLeft className="w-3 h-3" /> 返回列表
        </button>
        {/* 步骤条 */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            {[1, 2, 3, 4].map(s => (
            <div key={s} className="flex items-center flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                wizStep >= s ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-400"
              }`}>{s}</div>
              {s < 4 && <div className={`flex-1 h-0.5 mx-1 ${
                wizStep > s ? "bg-primary-500" : "bg-gray-100"}`} />}
            </div>
          ))}
          </div>
          <div className="flex items-center justify-between text-[10px] text-gray-500 px-1">
            <span>选目标</span><span>参数</span><span>生成</span><span>激活</span>
          </div>
        </div>
        {error && (
          <div className="text-xs text-red-600 bg-red-50 rounded-xl p-3 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />{error}
          </div>
        )}
        {/* Step 1: 目标 */}
        {wizStep === 1 && (
          <div className="card p-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">选择训练目标</h3>
          <p className="text-[11px] text-gray-500">不同目标的训练体系、次数范围、分化方式完全不同</p>
          <div className="grid grid-cols-2 gap-2">
            {GOAL_OPTS.map(o => (
              <button key={o.value} onClick={() => setWizGoal(o.value)}
                className={
                  "p-3 rounded-2xl text-left border transition-all " + (
                    wizGoal === o.value
                      ? "border-" + o.color + "-300 bg-" + o.color + "-50 ring-2 ring-" + o.color + "-200"
                      : "border-gray-100 bg-white hover:border-gray-200"
                  )
                }
              >
                <div className={`inline-block px-2 py-0.5 rounded-lg mb-1.5 text-[10px] font-bold ${colorMap[o.value]} border`}>
                  {o.label}
                </div>
                <div className="text-xs text-gray-700 font-medium">{
                  o.value === "muscle_gain" && "推/拉/腿分块，8-12次增肌"
                }{
                  o.value === "fat_loss" && "全身力量+HIIT代谢消耗"
                }{
                  o.value === "strength" && "大重量低次，3-6次"
                }{
                  o.value === "endurance" && "有氧+力量维持"
                }</div>
              </button>
            ))}
          </div>
          <button onClick={() => setWizStep(2)} className="btn-primary w-full">下一步</button>
        </div>
      )}
      {/* Step 2: 参数 */}
      {wizStep === 2 && (
        <div className="card p-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">设定周期参数</h3>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">周期名称（可选）</label>
            <input value={wizName} onChange={e => setWizName(e.target.value)}
              placeholder={`${wizWeeks}周${GOAL_OPTS.find(o=>o.value===wizGoal)?.label}周期`}
              className="input-field text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">
              周期时长：<span className="text-primary-600 font-bold">{wizWeeks} 周</span>
            </label>
            <input type="range" min={2} max={12} value={wizWeeks}
              onChange={e => setWizWeeks(Number(e.target.value))}
              className="w-full accent-primary-600" />
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>2周</span><span>12周</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">
              每周训练次数：<span className="text-primary-600 font-bold">{wizPerWeek} 天</span>
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[3, 4, 5, 6].map(n => (
                <button key={n} onClick={() => setWizPerWeek(n)}
                  className={`py-2 rounded-xl text-xs font-semibold transition-colors ${
                    wizPerWeek === n
                      ? "bg-primary-600 text-white"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  }`}
                >{n} 天</button>
              ))}
            </div>
          </div>
          {/* 每日肌群分配 */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">
              每个训练日主要肌群：
            </label>
            <div className="space-y-2">
              {Array.from({ length: wizPerWeek }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400 w-10 shrink-0">日{i + 1}</span>
                  <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                    {COMMON_DAY_KEYWORDS.map(kw => (
                      <button key={kw.key} onClick={() => {
                        const next = [...wizDayKeywords];
                        next[i] = kw.key;
                        setWizDayKeywords(next);
                      }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
                          wizDayKeywords[i] === kw.key
                            ? kw.key === "rest"
                              ? "bg-gray-200 text-gray-500"
                              : "bg-primary-100 text-primary-700"
                            : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                        }`}>
                        {kw.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setWizStep(1)} className="btn-secondary flex-1">上一步</button>
            <button onClick={() => setWizStep(3)} className="btn-primary flex-1">下一步</button>
          </div>
        </div>
      )}
      {/* Step 3: AI 生成 */}
      {wizStep === 3 && (
        <div className="card p-4 space-y-4 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-primary-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">由 AI 定制训练计划</h3>
            <p className="text-[11px] text-gray-500 mt-1">
              目标：{GOAL_OPTS.find(o => o.value === wizGoal)?.label} · {wizWeeks} 周 · 每周 {wizPerWeek} 练
            </p>
          </div>
          <div className="text-left bg-gray-50 rounded-xl p-3 space-y-1.5">
            <p className="text-[11px] text-gray-600">
              <span className="font-semibold text-gray-800">AI 将基于以下内容生成：</span>
            </p>
            <ul className="text-[10px] text-gray-500 space-y-1 ml-2">
              <li>• 用户目标（分化体系（{GOAL_OPTS.find(o=>o.value===wizGoal)?.label}）</li>
              <li>• 个人纪录（PR → 推算起始重量</li>
              <li>• 训练经验 → 调整量与强度</li>
              <li>• 科学训练原则（渐进超负荷、恢复平衡）</li>
            </ul>
          </div>
          <button onClick={doGeneratePlan} disabled={wizGenerating}
            className="btn-primary w-full">
            {wizGenerating ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />AI 定制中...</>
            ) : (
              <><Brain className="w-4 h-4 mr-2" />开始生成计划</>
            )}
          </button>
          <div className="flex gap-2">
            <button onClick={() => setWizStep(2)} className="btn-secondary flex-1">返回参数</button>
            <button onClick={resetWizard} className="btn-secondary flex-1">取消</button>
          </div>
        </div>
      )}
      {/* Step 4: 完成 */}
      {wizStep === 4 && wizResultPlanId && (
        <div className="space-y-3">
          <div className="card p-4 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-green-50 flex items-center justify-center mb-2">
              <CheckCircle2 className="w-7 h-7 text-green-600" />
            </div>
            <h3 className="text-base font-bold text-gray-900">计划已生成！</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">你可以激活为当前周期，或先进入详情微调动作</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => activatePlanAsCycle(wizResultPlanId!)} disabled={wizGenerating}
              className="btn-primary flex-1">
              {wizGenerating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              激活为当前周期
            </button>
            <button onClick={() => openDetail(wizResultPlanId!)}
              className="btn-secondary flex-1">
              <Edit3 className="w-3.5 h-3.5 mr-1" />查看/编辑
            </button>
          </div>
          <button onClick={resetWizard}
            className="w-full text-[11px] text-gray-400 hover:text-gray-600 py-2">
            完成
          </button>
        </div>
      )}
    </div>
  );
}
  // ============ 详情视图（编辑计划）============
  if (view === "detail" && detailPlan) {
    return (
      <PlanEditor
        plan={detailPlan}
        onBack={() => { setView("list"); setDetailPlan(null); loadAll(); }}
        onUpdated={() => {
          // 重新加载详情
          if (detailPlan.id) {
            fetch(`/api/cycle-plans?id=${detailPlan.id}`)
              .then(r => r.json())
            .then(d => d.plan && setDetailPlan(d.plan));
          }
        }}
        cycles={cycles}
        onRefreshAll={() => { onRefresh?.(); loadAll(); }}
      />
    );
  }
  // ============ 列表视图 ============
  return (
    <div className="space-y-4">
      <button
        onClick={() => setView("wizard")}
        className="btn-primary w-full"
      >
        <Plus className="w-4 h-4 mr-2" />
        新建训练计划（AI 生成）
      </button>
      {/* 活跃周期卡片 */}
      {cycles.filter(c => c.is_active).map(c => {
        const plan = plans.find(p => p.id === (c as any).plan_id) || plans.find(p => p.cycle_id === c.id);
        return (
          <div key={c.id} className="card overflow-hidden border-primary-200 ring-1 ring-primary-100">
            <div className="bg-gradient-to-r from-primary-50 to-white p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="px-2 py-0.5 text-[10px] font-semibold text-green-700 bg-green-50 rounded-full">
                  进行中
                </span>
                <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${colorMap[c.goal || "muscle_gain"]}`}>
                  {GOAL_OPTS.find(o=>o.value===c.goal)?.label || "通用"}
                </span>
              </div>
              <h3 className="text-sm font-bold text-gray-900 mt-1">{c.name}</h3>
              <p className="text-[10px] text-gray-500 mt-0.5">
                <CalendarDays className="w-2.5 h-2.5 inline mr-0.5" />
                {c.start_date} ~ {c.end_date || "进行中"}
              </p>
              {c.tdee_adjusted && (
                <p className="text-[10px] text-gray-600 mt-1">
                  <Target className="w-2.5 h-2.5 inline mr-0.5" />
                  代谢参考 <b>{c.tdee_adjusted} kcal/天</b>
                </p>
              )}
              {plan && (
                <button onClick={() => openDetail(plan.id!)}
                  className="mt-3 w-full py-2 text-[11px] font-medium text-primary-600 bg-white rounded-xl hover:bg-primary-50 transition-colors">
                  <Dumbbell className="w-3 h-3 inline mr-1" />查看训练计划（{plan.workouts_per_week}练/周 · {plan.duration_weeks}周）
                </button>
              )}
              {!plan && (
                <button onClick={() => setView("wizard")}
                  className="mt-3 w-full py-2 text-[11px] font-medium text-gray-600 bg-white rounded-xl hover:bg-gray-50 transition-colors">
                  该周期暂无计划 → 去创建
                </button>
              )}
            </div>
            {/* 调整方案 */}
            {c.adjustment_plan && (
              <div className="p-3 border-t border-gray-100">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Brain className="w-3.5 h-3.5 text-primary-600" />
                  <span className="text-[11px] font-semibold text-primary-700">AI 周期建议</span>
                </div>
                <p className="text-[10px] text-primary-600">
                  {(c.adjustment_plan as CycleAdjustment)?.next_cycle_plan?.overall_focus || ""}
                </p>
              </div>
            )}
          </div>
        );
      })}
      {/* 未激活的计划 */}
      {plans.filter(p => !cycleOfPlan(p.id!)?.is_active).map(p => {
        const cycle = cycleOfPlan(p.id!);
        return (
          <div key={p.id} className="card p-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${colorMap[p.goal]}`}>
                {GOAL_OPTS.find(o=>o.value===p.goal)?.label || "通用"}
              </span>
              <span className="text-[10px] text-gray-400">{p.duration_weeks}周 · {p.workouts_per_week}练/周</span>
            </div>
            <h3 className="text-sm font-semibold text-gray-900">{p.name}</h3>
            {cycle && <p className="text-[10px] text-gray-500 mt-0.5">关联周期：{cycle.name}</p>}
            {p.notes && <p className="text-[10px] text-gray-500 mt-1">{p.notes}</p>}
            <div className="flex gap-2 mt-3">
              <button onClick={() => openDetail(p.id!)} className="btn-secondary flex-1 text-[11px] py-2">
                <Edit3 className="w-3 h-3 mr-1" />编辑
              </button>
              {!cycleOfPlan(p.id!) && (
                <button onClick={() => { setWizResultPlanId(p.id!); setWizGoal(p.goal); setWizWeeks(p.duration_weeks); setWizPerWeek(p.workouts_per_week); activatePlanAsCycle(p.id!) }}
                  className="btn-primary flex-1 text-[11px] py-2">激活周期</button>
              )}
            </div>
          </div>
        );
      })}
      {/* 历史周期（已结束） */}
      {cycles.filter(c => !c.is_active).length > 0 && (
        <>
          <h4 className="text-xs font-semibold text-gray-500 mt-4">历史周期</h4>
          {cycles.filter(c => !c.is_active).map(c => (
            <div key={c.id} className="card p-3 opacity-80">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-gray-700">{c.name}</h3>
                  <p className="text-[10px] text-gray-400 mt-0.5">{c.start_date} ~ {c.end_date}</p>
                </div>
                <span className="text-[10px] text-gray-400">已结束</span>
              </div>
            </div>
          ))}
        </>
      )}
      {cycles.length === 0 && plans.length === 0 && (
        <div className="text-center py-12">
          <Sparkles className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">还没有训练计划</p>
          <p className="text-[11px] text-gray-400 mt-1">点击「新建训练计划」由 AI 为你定制</p>
        </div>
      )}
    </div>
  );
}
// =============================
// PlanEditor：计划详情 + 编辑
// =============================
function PlanEditor({
  plan, onBack, onUpdated, cycles, onRefreshAll,
}: {
  plan: CyclePlan;
  onBack: () => void;
  onUpdated: () => void;
  cycles: Cycle[];
  onRefreshAll: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [local, setLocal] = useState<CyclePlan>(plan);
  const [toast, setToast] = useState<{ success: boolean; msg: string } | null>(null);
  const { colorMap } = useGoals();
  useEffect(() => { setLocal(plan); }, [plan.id]);
  const upsertDays: PlanDay[] = [];
  const deleteDayIds: string[] = [];
  const upsertExercises: PlanExercise[] = [];
  const deleteExerciseIds: string[] = [];
  const showToast = (success: boolean, msg: string) => {
    setToast({ success, msg });
    setTimeout(() => setToast(null), 2000);
  };
  const saveAll = async () => {
    // 对比原始 plan 和 local，构建 diff
    const origDaysById = new Map((plan.days || []).map(d => [d.id!, d]));
    const origExById = new Map(
      (plan.days || []).flatMap(d => (d.exercises || []).map(e => [e.id!, e]))
    );
    const upsert_days: PlanDay[] = [];
    const delete_days: string[] = [];
    const upsert_exercises: PlanExercise[] = [];
    const delete_exercises: string[] = [];
    const newLocalDayIds = new Set<string>();
    for (const d of local.days || []) {
      if (d.id) newLocalDayIds.add(d.id);
      const origDay = d.id ? origDaysById.get(d.id) : undefined;
      // 天本身变了
      if (!origDay
        || origDay.day_of_week !== d.day_of_week
        || origDay.day_name !== d.day_name
        || origDay.focus !== d.focus
        || origDay.is_rest_day !== d.is_rest_day
        || (origDay.order_index ?? 0) !== (d.order_index ?? 0)) {
        upsert_days.push(d);
      }
      // 动作对比
      const origExs = new Map((origDay?.exercises || []).map(e => [e.id!, e]));
      const localExs = d.exercises || [];
      const keep = new Set<string>();
      for (const ex of localExs) {
        if (ex.id) keep.add(ex.id);
        const orig = ex.id ? origExs.get(ex.id) : undefined;
        if (!orig
          || orig.exercise_name !== ex.exercise_name
          || orig.target_sets !== ex.target_sets
          || orig.target_reps !== ex.target_reps
          || (orig.target_weight_kg ?? null) !== (ex.target_weight_kg ?? null)
          || (orig.rpe_target ?? null) !== (ex.rpe_target ?? null)
          || (orig.order_index ?? 0) !== (ex.order_index ?? 0)) {
          upsert_exercises.push({ ...ex, day_id: d.id || "__TMP_DAY__" });
        }
      }
      origExs.forEach((_v, origId) => {
        if (!keep.has(origId)) delete_exercises.push(origId);
      });
    }
    // 被删除的天
    for (const origDay of (plan.days || [])) {
      if (origDay.id && !newLocalDayIds.has(origDay.id)) delete_days.push(origDay.id);
    }
    setSaving(true);
    try {
      // 发送完整 diff 到 PUT API
      // 新天（无id）的 exercises 嵌入到 day 里；现有天的 exercises 走 upsert_exercises
      const localDayById = new Map((local.days || []).map(d => [d.id || d.order_index + "__", d]));
      const body: any = {
        id: local.id,
        name: local.name,
        goal: local.goal,
        duration_weeks: local.duration_weeks,
        workouts_per_week: local.workouts_per_week,
        start_date: local.start_date,
        notes: local.notes,
        upsert_days: upsert_days.map(d => ({
          ...d,
          exercises: !d.id ? (localDayById.get(d.order_index + "__")?.exercises || []) : undefined,
        })),
        delete_days,
        upsert_exercises: upsert_exercises.filter(ex => ex.day_id && ex.day_id !== "__TMP_DAY__"),
        delete_exercises,
      };
      const res = await fetch("/api/cycle-plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("保存失败");
      // 重载
      onUpdated();
      setEditing(false);
      showToast(true, "已保存");
    } catch {
      showToast(false, "保存失败");
    } finally {
      setSaving(false);
    }
  };
  const updateDay = (dayId: string | undefined, patch: Partial<PlanDay>) => {
    setLocal(prev => ({
      ...prev,
      days: (prev.days || []).map(d =>
        (!dayId && !d.id && d.order_index === patch.order_index) || d.id === dayId
          ? { ...d, ...patch }
          : d
      ),
    }));
  };
  const addExerciseToDay = (dayId: string | undefined, orderIndex: number) => {
    const newEx: PlanExercise = {
      exercise_name: "新动作",
      exercise_type: "other",
      target_sets: 3,
      target_reps: "8-12",
      target_weight_kg: null,
      order_index: 999,
    };
    setLocal(prev => ({
      ...prev,
      days: (prev.days || []).map((d, idx) => {
        const match = (dayId ? d.id === dayId : (!d.id && d.order_index === orderIndex));
        if (!match) return d;
        const exs = [...(d.exercises || [])];
        newEx.order_index = exs.length;
        return { ...d, exercises: [...exs, newEx] };
      }),
    }));
  };
  const updateExercise = (dayId: string | undefined, exIdx: number, patch: Partial<PlanExercise>) => {
    setLocal(prev => ({
      ...prev,
      days: (prev.days || []).map(d => {
        if (d.id !== dayId && (!dayId || d.id)) return d;
        // 没 id 的按 order_index 匹配（新天）
        const exs = [...(d.exercises || [])];
        if (exs[exIdx]) exs[exIdx] = { ...exs[exIdx], ...patch };
        return { ...d, exercises: exs };
      }),
    }));
  };
  const removeExercise = (dayId: string | undefined, exIdx: number) => {
    setLocal(prev => ({
      ...prev,
      days: (prev.days || []).map(d => {
        if (d.id !== dayId && (!dayId || d.id)) return d;
        const exs = [...(d.exercises || [])];
        const [removed] = exs.splice(exIdx, 1);
        if (removed?.id) deleteExerciseIds.push(removed.id);
        return { ...d, exercises: exs };
      }),
    }));
  };
  const toggleRestDay = (dayId: string | undefined, orderIndex: number) => {
    setLocal(prev => ({
      ...prev,
      days: (prev.days || []).map((d, idx) => {
        const match = (dayId ? d.id === dayId : (!d.id && d.order_index === orderIndex));
        if (!match) return d;
        const nowRest = !d.is_rest_day;
        return {
          ...d,
          is_rest_day: nowRest,
          day_name: nowRest ? "休息日" : d.day_name || "训练日",
          focus: nowRest ? "主动恢复" : d.focus || "综合训练",
          exercises: nowRest ? [] : (d.exercises?.length ? d.exercises : []),
        };
      }),
    }));
  };
  const activateThisPlan = async () => {
    if (!local.id) return;
    const res = await fetch("/api/cycles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: local.name,
        goal: local.goal,
        plan_id: local.id,
      }),
    });
    if (res.ok) {
      showToast(true, "已激活为当前周期");
      onRefreshAll();
      setTimeout(onBack, 800);
    } else {
      showToast(false, "激活失败");
    }
  };
  const cycle = cycles.find(c => (c as any).plan_id === local.id);
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <ChevronLeft className="w-3 h-3" /> 返回
        </button>
        <div className="flex items-center gap-1.5">
          {!cycle?.is_active && (
            <button onClick={activateThisPlan}
              className="px-3 py-1.5 text-[11px] font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
              激活为周期
            </button>
          )}
          {cycle?.is_active && (
            <span className="px-2 py-1 text-[10px] font-semibold text-green-700 bg-green-50 rounded-full">
              当前周期中
            </span>
          )}
          {editing ? (
            <button onClick={saveAll} disabled={saving}
              className="px-3 py-1.5 text-[11px] font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              保存
            </button>
          ) : (
            <button onClick={() => setEditing(true)}
              className="px-3 py-1.5 text-[11px] font-medium bg-gray-900 text-white rounded-lg hover:bg-black transition-colors flex items-center gap-1">
              <Edit3 className="w-3 h-3" />编辑
            </button>
          )}
        </div>
      </div>
      {/* 计划摘要卡 */}
      <div className="card p-4 bg-gradient-to-br from-gray-50 to-white">
        {editing ? (
          <input value={local.name} onChange={e => setLocal(p => ({ ...p, name: e.target.value }))}
            className="input-field text-base font-bold" />
        ) : (
          <h2 className="text-base font-bold text-gray-900">{local.name}</h2>
        )}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${colorMap[local.goal]}`}>
            {GOAL_OPTS.find(o=>o.value===local.goal)?.label || "通用"}
          </span>
          <span className="text-[10px] text-gray-500">
            <CalendarDays className="w-2.5 h-2.5 inline mr-0.5" />
            {local.duration_weeks}周 · 每周{local.workouts_per_week}练
          </span>
          {local.tdee_adjusted && (
            <span className="text-[10px] text-gray-500">
              <Target className="w-2.5 h-2.5 inline mr-0.5" />
              {local.tdee_adjusted} kcal
            </span>
          )}
          {(() => {
            const allExs = (local.days || []).flatMap(d => d.exercises || []);
            const totalVol = calcTotalVolume(allExs);
            const avgIntensity = calcDayIntensity(allExs);
            const avgLabel = avgIntensity === "easy" ? "轻松" : avgIntensity === "normal" ? "中等" : "高";
            return totalVol > 0 ? (
              <span className="text-[10px] text-gray-500">
                <Dumbbell className="w-2.5 h-2.5 inline mr-0.5" />
                总容量 {(totalVol / 1000).toFixed(1)}k · 强度 {avgLabel}
              </span>
            ) : null;
          })()}
        </div>
        {local.notes && !editing && (
          <p className="text-[11px] text-gray-500 mt-2">{local.notes}</p>
        )}
        {editing && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div>
              <label className="text-[10px] text-gray-500">周期(周)</label>
              <input type="number" min={1} max={24}
                value={local.duration_weeks}
                onChange={e => setLocal(p => ({ ...p, duration_weeks: Number(e.target.value) }))}
                className="input-field text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500">每周练</label>
              <input type="number" min={1} max={7}
                value={local.workouts_per_week}
                onChange={e => setLocal(p => ({ ...p, workouts_per_week: Number(e.target.value) }))}
                className="input-field text-xs" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-gray-500">备注 / 周期说明</label>
              <textarea
                value={local.notes || ""}
                onChange={e => setLocal(p => ({ ...p, notes: e.target.value }))}
                className="input-field text-xs min-h-[48px] resize-none" rows={2}
              />
            </div>
          </div>
        )}
      </div>
      {toast && (
        <div className={`text-xs rounded-xl p-2.5 flex items-center gap-1.5 ${
          toast.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
        }`}>
          {toast.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
          {toast.msg}
        </div>
      )}
      {/* 每日卡片 */}
      <div className="space-y-2">
        {(local.days || []).sort((a,b)=> (a.order_index??0)-(b.order_index??0)).map((day, idx) => (
          <DayCard
            key={day.id || `new-${idx}`}
            day={day}
            dayIdx={idx}
            editing={editing}
            onUpdate={(patch) => updateDay(day.id, patch)}
            onToggleRest={() => toggleRestDay(day.id, day.order_index ?? idx)}
            onAddExercise={() => addExerciseToDay(day.id, day.order_index ?? idx)}
            onUpdateExercise={(exIdx, patch) => updateExercise(day.id, exIdx, patch)}
            onRemoveExercise={(exIdx) => removeExercise(day.id, exIdx)}
          />
        ))}
      </div>
      {editing && (
        <button onClick={() => {
          setLocal(prev => ({
            ...prev,
            days: [...(prev.days || []), {
              day_of_week: (prev.days || []).length % 7,
              day_name: "额外训练日",
              focus: "自定义",
              is_rest_day: false,
              order_index: (prev.days || []).length,
              exercises: [],
            }],
          }));
        }} className="btn-secondary w-full text-xs">
          <Plus className="w-3 h-3 mr-1" /> 添加额外训练日
        </button>
      )}
    </div>
  );
}
// Day 卡片
function DayCard({
  day, dayIdx, editing,
  onUpdate, onToggleRest,
  onAddExercise, onUpdateExercise, onRemoveExercise,
}: {
  day: PlanDay; dayIdx: number;
  editing: boolean;
  onUpdate: (patch: Partial<PlanDay>) => void;
  onToggleRest: () => void;
  onAddExercise: () => void;
  onUpdateExercise: (exIdx: number, patch: Partial<PlanExercise>) => void;
  onRemoveExercise: (exIdx: number) => void;
}) {
  const exCount = (day.exercises || []).length;
  const totalSets = (day.exercises || []).reduce((s, e) => s + (e.target_sets || 0), 0);
  const intensityLevel = day.is_rest_day ? "easy" : calcDayIntensity(day.exercises || []);
  const icolors = INTENSITY_COLORS[intensityLevel];
  const dayVolume = calcTotalVolume(day.exercises || []);
  return (
    <div className={`card overflow-hidden border-l-4 ${icolors.border} ${day.is_rest_day ? "bg-gradient-to-br from-green-50/70 to-white" : icolors.bg}`}>
      {/* Day Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-gray-100 text-gray-600">
              {WEEKDAY_NAMES[day.day_of_week]}
            </span>
            {day.is_rest_day ? (
              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-green-100 text-green-700">
                休息日
              </span>
            ) : (
              <>
                <span className="text-[10px] text-gray-400">
                  {exCount}动作 · {totalSets}组
                </span>
                <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded-full ${icolors.badge}`}>
                  {intensityLevel === "easy" ? "轻松" : intensityLevel === "normal" ? "中等" : "困难"}
                </span>
                {dayVolume > 0 && (
                  <span className="text-[9px] text-gray-400">
                    {(dayVolume / 1000).toFixed(1)}k vol
                  </span>
                )}
              </>
            )}
          </div>
          {editing ? (
            <input
              value={day.day_name || ""}
              onChange={e => onUpdate({ day_name: e.target.value })}
              className="input-field text-sm mt-1 py-1"
              placeholder="Day A - 胸三头日"
            />
          ) : (
            <h4 className="text-sm font-semibold text-gray-900 mt-0.5">{day.day_name}</h4>
          )}
          {editing ? (
            <input
              value={day.focus || ""}
              onChange={e => onUpdate({ focus: e.target.value })}
              className="input-field text-[11px] mt-1 py-1"
              placeholder="训练重点：胸·肩·三头"
            />
          ) : day.focus && (
            <p className="text-[10px] text-gray-500 mt-0.5">{day.focus}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {editing && (
            <>
              <select
                value={day.day_of_week}
                onChange={e => onUpdate({ day_of_week: Number(e.target.value) })}
                className="text-[10px] bg-gray-50 rounded-lg px-1.5 py-1 text-gray-600 border-0 outline-none"
              >
                {WEEKDAY_NAMES.map((n, i) => <option key={i} value={i}>{n}</option>)}
              </select>
              <button
                onClick={onToggleRest}
                title={day.is_rest_day ? "改为训练日" : "设为休息日"}
                className={
                  day.is_rest_day
                    ? "p-1.5 rounded-lg transition-colors text-green-700 bg-green-100 hover:bg-green-200"
                    : "p-1.5 rounded-lg transition-colors text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                }
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
      {/* Exercises */}
      {!day.is_rest_day && (
        <div className="p-3 space-y-1.5">
          {(day.exercises || []).length === 0 && !editing && (
            <p className="text-[10px] text-gray-400 text-center py-3">暂无动作，点击编辑添加</p>
          )}
          {(day.exercises || []).map((ex, i) => (
            editing ? (
              <ExerciseRowEdit
                key={ex.id || ('new-' + i)}
                ex={ex}
                idx={i}
                onChange={(patch) => onUpdateExercise(i, patch)}
                onRemove={() => onRemoveExercise(i)}
              />
            ) : (
              <ExerciseRowView key={ex.id || i} ex={ex} idx={i} />
            )
          ))}
          {editing && (
            <button onClick={onAddExercise}
              className="w-full py-2 mt-1.5 text-[11px] font-medium text-primary-600 bg-primary-50 rounded-xl hover:bg-primary-100 transition-colors flex items-center justify-center gap-1">
              <Plus className="w-3 h-3" /> 添加动作
            </button>
          )}
        </div>
      )}
      {day.is_rest_day && !editing && (
        <div className="p-4 text-center">
          <p className="text-[11px] text-green-700">好好休息，明天加油 💪</p>
        </div>
      )}
    </div>
  );
}
function ExerciseRowView({ ex, idx }: { ex: PlanExercise; idx: number }) {
  const intensityLevel = calcIntensityLevel(ex.target_sets, ex.target_reps, ex.target_weight_kg, ex.rpe_target);
  const colors = INTENSITY_COLORS[intensityLevel];
  return (
    <div className={`flex items-center gap-2 p-2 rounded-xl bg-white border ${colors.border}`}>
      <div className={`w-6 h-6 rounded-lg ${colors.badge} flex items-center justify-center text-[10px] font-bold shrink-0`}>
        {idx + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900 truncate">{ex.exercise_name}</div>
        <div className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
          <Dumbbell className="w-2.5 h-2.5" />
          <span>{ex.target_sets}组 × {ex.target_reps}次</span>
          {ex.target_weight_kg != null && ex.target_weight_kg > 0 && (
            <span className="text-primary-600 font-semibold">· {ex.target_weight_kg}kg</span>
          )}
          {ex.rpe_target && (
            <span className="text-gray-400">· RPE {ex.rpe_target}</span>
          )}
        </div>
      </div>
    </div>
  );
}
function ExerciseRowEdit({
  ex, idx, onChange, onRemove,
}: {
  ex: PlanExercise; idx: number;
  onChange: (patch: Partial<PlanExercise>) => void;
  onRemove: () => void;
}) {
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  // 获取所有动作名
  const allNames = Object.values(MUSCLE_GROUPS).flatMap(g => g.exercises.map(e => e.name));
  const [search, setSearch] = useState(ex.exercise_name);
  useEffect(() => { setSearch(ex.exercise_name); }, [ex.exercise_name]);
  const matches = search.trim().length >= 1
    ? allNames.filter(n => n.includes(search.trim())).slice(0, 10)
    : [];
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSearch(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  return (
    <div className="p-2 rounded-xl bg-gray-50 border border-gray-200 space-y-1.5">
      <div className="flex items-center gap-1.5 relative" ref={searchRef}>
        <span className="text-[10px] font-bold text-gray-500 w-5">#{idx + 1}</span>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setShowSearch(true); onChange({ exercise_name: e.target.value }); }}
          onFocus={() => setShowSearch(true)}
          className="input-field text-xs flex-1 py-1.5"
          placeholder="输入搜索常用动作..."
        />
        {/* 搜索结果下拉 - 置于顶层 */}
        {showSearch && matches.length > 0 && (
          <div className="absolute left-7 top-0 z-50 mt-8 w-64 bg-white border border-gray-200 rounded-xl shadow-xl max-h-56 overflow-y-auto">
            {matches.map(n => (
              <button key={n} type="button"
                onClick={() => { setSearch(n); onChange({ exercise_name: n, exercise_type: "other" as const }); setShowSearch(false); }}
                className="w-full text-left px-3 py-2.5 text-[12px] text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors border-b border-gray-50 last:border-0">
                {n}
              </button>
            ))}
          </div>
        )}
        <button onClick={onRemove}
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        <div>
          <label className="text-[9px] text-gray-400 block">组数</label>
          <input type="number" min={1} max={10} value={ex.target_sets}
            onChange={e => onChange({ target_sets: Number(e.target.value) })}
            className="input-field text-[11px] py-1 text-center" />
        </div>
        <div>
          <label className="text-[9px] text-gray-400 block">次数</label>
          <input value={ex.target_reps}
            onChange={e => onChange({ target_reps: e.target.value })}
            className="input-field text-[11px] py-1" placeholder="8-12" />
        </div>
        <div>
          <label className="text-[9px] text-gray-400 block">重量kg</label>
          <input type="number" step="0.5" min={0} value={ex.target_weight_kg ?? ""}
            onChange={e => onChange({ target_weight_kg: e.target.value ? Number(e.target.value) : null })}
            className="input-field text-[11px] py-1" placeholder="-" />
        </div>
        <div>
          <label className="text-[9px] text-gray-400 block">RPE</label>
          <input type="number" min={1} max={10} step="0.5" value={ex.rpe_target ?? ""}
            onChange={e => onChange({ rpe_target: e.target.value ? Number(e.target.value) : null })}
            className="input-field text-[11px] py-1" placeholder="-" />
        </div>
      </div>
    </div>
  );
}