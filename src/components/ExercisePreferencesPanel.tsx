"use client";
import { useState, useEffect } from "react";
import { Loader2, Save, CheckCircle2, Plus, Trash2, Star, Search, X } from "lucide-react";
import { MUSCLE_GROUPS } from "@/lib/exercise-library";
import type { UserExercisePreference, MuscleGroup } from "@/types";
export default function ExercisePreferencesPanel() {
  const [preferences, setPreferences] = useState<UserExercisePreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeGroup, setActiveGroup] = useState<MuscleGroup>("chest");
  const [showMoreModal, setShowMoreModal] = useState(false);
  const [moreSearch, setMoreSearch] = useState("");
  const [moreGroupFilter, setMoreGroupFilter] = useState<MuscleGroup | "">("");
  // 更多动作弹窗：收集全部动作（分组 + 搜索过滤）
  const allExercisesWithGroup = Object.entries(MUSCLE_GROUPS)
    .filter(([k]) => k !== "full_body")
    .flatMap(([key, group]) =>
      group.exercises.map(ex => ({ ...ex, groupKey: key }))
    );
  const filteredExercises = allExercisesWithGroup.filter(ex => {
    const matchSearch = !moreSearch || ex.name.includes(moreSearch);
    const matchGroup = !moreGroupFilter || ex.groupKey === moreGroupFilter;
    return matchSearch && matchGroup;
  });
  // 加载偏好
  const loadPrefs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/exercise-preferences");
      const d = await res.json();
      setPreferences(d.preferences || []);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { loadPrefs(); }, []);
  // 对某个肌肉群获取当前偏好列表
  const getPrefsForGroup = (mg: string) =>
    preferences.filter(p => p.muscle_group === mg);
  // 添加一个动作到偏好
  const addExercise = (mg: MuscleGroup, exerciseName: string) => {
    if (preferences.some(p => p.muscle_group === mg && p.exercise_name === exerciseName)) return;
    setPreferences(prev => [...prev, {
      muscle_group: mg,
      exercise_name: exerciseName,
      exercise_type: "other",
      weight: 0.5,
      usage_count: 0,
      is_favorite: false,
    }]);
  };
  // 删除偏好
  const removeExercise = (mg: MuscleGroup, exerciseName: string) => {
    setPreferences(prev => prev.filter(p =>
      !(p.muscle_group === mg && p.exercise_name === exerciseName)
    ));
  };
  // 切换收藏
  const toggleFavorite = (mg: MuscleGroup, exerciseName: string) => {
    setPreferences(prev => prev.map(p =>
      p.muscle_group === mg && p.exercise_name === exerciseName
        ? { ...p, is_favorite: !p.is_favorite, weight: p.is_favorite ? 0.5 : 1.0 }
        : p
    ));
  };
  // 保存
  const save = async () => {
    setSaving(true);
    try {
      await fetch("/api/exercise-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  };
  if (loading) return (
    <div className="flex items-center justify-center h-32 text-gray-400 text-xs">加载偏好中...</div>
  );
  const groups = Object.keys(MUSCLE_GROUPS) as MuscleGroup[];
  const currentPrefs = getPrefsForGroup(activeGroup);
  const allExercises = MUSCLE_GROUPS[activeGroup]?.exercises || [];
  const remainingExercises = allExercises.filter(
    ex => !currentPrefs.some(p => p.exercise_name === ex.name)
  );
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">常用动作偏好</h3>
        <button onClick={save} disabled={saving}
          className="btn-primary text-[11px] py-1.5 px-3">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          保存偏好
        </button>
      </div>
      {saved && (
        <div className="text-[11px] text-green-600 bg-green-50 rounded-xl p-2 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />已保存
        </div>
      )}
      {/* 肌肉群标签 */}
      <div className="flex overflow-x-auto gap-1 pb-1 scrollbar-hide">
        {groups.map(mg => (
          <button key={mg} onClick={() => setActiveGroup(mg)}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-medium whitespace-nowrap transition-colors ${
              activeGroup === mg
                ? "bg-primary-100 text-primary-700"
                : "bg-gray-50 text-gray-500 hover:bg-gray-100"
            }`}>
            {MUSCLE_GROUPS[mg].icon} {MUSCLE_GROUPS[mg].label}
          </button>
        ))}
      </div>
      {/* 当前已选动作 */}
      <div className="space-y-1">
        {currentPrefs.length === 0 && (
          <p className="text-[11px] text-gray-400 text-center py-4">
            还没有添加偏好动作，从下方添加
          </p>
        )}
        {currentPrefs.map(p => (
          <div key={p.exercise_name}
            className="flex items-center justify-between px-3 py-2 bg-white rounded-xl border border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-800">{p.exercise_name}</span>
              {p.is_favorite && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => toggleFavorite(activeGroup, p.exercise_name)}
                className={`p-1 rounded-lg transition-colors ${
                  p.is_favorite ? "text-yellow-500" : "text-gray-300 hover:text-yellow-500"
                }`}>
                <Star className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => removeExercise(activeGroup, p.exercise_name)}
                className="p-1 rounded-lg text-gray-300 hover:text-red-500 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
      {/* 可添加的动作 */}
      <div>
        <p className="text-[10px] text-gray-400 mb-1.5">点击添加常用动作:</p>
        <div className="flex flex-wrap gap-1.5">
          {remainingExercises.slice(0, 10).map(ex => (
            <button key={ex.name} onClick={() => addExercise(activeGroup, ex.name)}
              className="px-2.5 py-1 rounded-lg text-[11px] bg-gray-50 text-gray-600 hover:bg-primary-50 hover:text-primary-700 transition-colors flex items-center gap-1">
              <Plus className="w-3 h-3" />{ex.name}
            </button>
          ))}
          {/* 更多动作按钮 */}
          <button onClick={() => setShowMoreModal(true)}
            className="px-2.5 py-1 rounded-lg text-[11px] bg-primary-50 text-primary-600 hover:bg-primary-100 transition-colors flex items-center gap-1">
            <Plus className="w-3 h-3" />更多动作
          </button>
        </div>
        {remainingExercises.length > 10 && (
          <p className="text-[10px] text-gray-400 mt-1">还有 {remainingExercises.length - 10} 个动作未显示</p>
        )}
      </div>
      {/* 更多动作浏览弹窗 */}
      {showMoreModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowMoreModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-xl"
            onClick={e => e.stopPropagation()}>
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
              <h4 className="text-sm font-semibold text-gray-900">浏览全部动作</h4>
              <button onClick={() => setShowMoreModal(false)}
                className="p-1 rounded-lg text-gray-300 hover:text-gray-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* 搜索框 */}
            <div className="px-4 py-2 border-b border-gray-50 shrink-0">
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <input type="text" placeholder="搜索动作名称..."
                  value={moreSearch}
                  onChange={e => setMoreSearch(e.target.value)}
                  className="bg-transparent text-xs outline-none flex-1 placeholder:text-gray-400" />
              </div>
            </div>
            {/* 肌肉群快速切换 */}
            <div className="flex overflow-x-auto gap-1 px-4 py-2 border-b border-gray-50 shrink-0 scrollbar-hide">
              <button onClick={() => setMoreSearch("")}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-colors ${
                  !moreSearch && !moreGroupFilter ? "bg-primary-100 text-primary-700" : "bg-gray-50 text-gray-500"
                }`}>全部</button>
              {Object.entries(MUSCLE_GROUPS).filter(([k]) => k !== "full_body").map(([key, group]) => (
                <button key={key} onClick={() => { setMoreGroupFilter(key as MuscleGroup); setMoreSearch(""); }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-colors ${
                    moreGroupFilter === key ? "bg-primary-100 text-primary-700" : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                  }`}>
                  {group.icon} {group.label}
                </button>
              ))}
            </div>
            {/* 动作列表 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {filteredExercises.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8">没有匹配的动作</p>
              ) : (
                filteredExercises.map((ex, i) => {
                  const alreadyAdded = preferences.some(p =>
                    p.muscle_group === (moreGroupFilter || activeGroup) && p.exercise_name === ex.name
                  );
                  return (
                    <div key={`${ex.name}-${i}`}
                      className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-700">{ex.name}</span>
                        <span className="text-[10px] text-gray-400">{MUSCLE_GROUPS[ex.groupKey]?.label}</span>
                      </div>
                      {alreadyAdded ? (
                        <span className="text-[10px] text-green-500 font-medium">已添加</span>
                      ) : (
                        <button onClick={() => {
                          addExercise(moreGroupFilter || activeGroup, ex.name);
                        }}
                          className="text-[10px] text-primary-600 hover:text-primary-800 font-medium">
                          + 添加
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}