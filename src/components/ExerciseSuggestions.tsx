"use client";
import { useState, useEffect, useRef } from "react";
import { Loader2, Star, TrendingUp, Flame } from "lucide-react";
import type { ExerciseRecommendation, MuscleGroup } from "@/types";

interface Props {
  searchText: string;
  muscleGroup?: MuscleGroup;
  onSelect: (name: string) => void;
  visible: boolean;
  onClose: () => void;
}

export default function ExerciseSuggestions({ searchText, muscleGroup, onSelect, visible, onClose }: Props) {
  const [recs, setRecs] = useState<ExerciseRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || !searchText.trim() || searchText.trim().length < 1) {
      setRecs([]);
      return;
    }
    const q = searchText.trim();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (muscleGroup) params.set("muscle_group", muscleGroup);
        params.set("q", q);
        const res = await fetch(`/api/exercise-recommendations?${params}`);
        const d = await res.json();
        setRecs((d.recommendations || []).slice(0, 8));
      } catch {} finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [searchText, muscleGroup, visible]);

  // 点击外部关闭
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    if (visible) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [visible, onClose]);

  if (!visible || recs.length === 0) return null;

  return (
    <div ref={ref} className="mt-2 bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden">
      <div className="px-3 py-2 text-[10px] text-gray-400 font-medium flex items-center gap-1.5 border-b border-gray-50">
        <TrendingUp className="w-2.5 h-2.5" />
        AI 推荐动作
        {loading && <Loader2 className="w-2.5 h-2.5 animate-spin ml-auto" />}
      </div>
      <div className="max-h-[240px] overflow-y-auto">
        {recs.map((r) => (
          <button key={r.exercise_name} onClick={() => { onSelect(r.exercise_name); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-gray-800">{r.exercise_name}</span>
                {r.is_favorite && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-gray-400 capitalize">{r.muscle_group}</span>
                {r.usage_count > 0 && (
                  <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                    <Flame className="w-2 h-2" />{r.usage_count}次
                  </span>
                )}
                {r.weight > 0.7 && (
                  <span className="text-[10px] font-medium text-primary-600">常用</span>
                )}
              </div>
            </div>
            <span className="text-[10px] text-gray-400 shrink-0">{r.reason}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
