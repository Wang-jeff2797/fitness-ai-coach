"use client";
import { useState, useEffect } from "react";
import { Clock, ChevronDown, ChevronUp } from "lucide-react";
import type { Workout } from "@/types";
export default function WorkoutHistory() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/workouts")
      .then((r) => r.json())
      .then((data) => {
        if (data.workouts) setWorkouts(data.workouts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        加载中...
      </div>
    );
  }
  if (workouts.length === 0) {
    return (
      <div className="text-center py-16">
        <Clock className="w-12 h-12 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">还没有训练记录</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {workouts.map((w) => {
        const data = w.session_data;
        const isExpanded = expandedId === w.id;
        const allExercises = [
          ...(data.exercises || []),
          ...(data.cardio_exercises || []),
        ];
        return (
          <div key={w.id} className="card overflow-hidden">
            <button
              onClick={() => setExpandedId(isExpanded ? null : w.id)}
              className="w-full p-4 flex items-center justify-between text-left"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(w.performed_at).toLocaleDateString("zh-CN", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {allExercises.length} 个动作 ·{" "}
                  {data.total_volume_kg?.toLocaleString()} kg · RPE {data.session_rpe}
                </p>
              </div>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>
            {isExpanded && (
              <div className="px-4 pb-4 space-y-2 border-t border-gray-50 pt-3">
                {allExercises.map((ex, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-900">
                        {ex.name}
                      </span>
                      {ex.is_cardio && ex.total_duration_minutes && (
                        <span className="text-xs text-gray-500">
                          {ex.total_duration_minutes}分钟
                        </span>
                      )}
                    </div>
                    {!ex.is_cardio && ex.sets && (
                      <div className="text-xs text-gray-500">
                        <div className="grid grid-cols-4 gap-1 mb-1 font-medium">
                          <span>组</span>
                          <span>次数</span>
                          <span>重量</span>
                          <span>RPE</span>
                        </div>
                        {ex.sets
                          .filter((s) => !s.is_warmup)
                          .map((set, si) => (
                            <div key={si} className="grid grid-cols-4 gap-1">
                              <span className="font-medium text-gray-700">{set.set_number}</span>
                              <span className="font-medium text-gray-700">{set.reps}</span>
                              <span className="font-medium text-gray-700">{set.weight_kg}kg</span>
                              <span className="font-medium text-gray-700">{set.rpe}</span>
                            </div>
                          ))}
                      </div>
                    )}
                    {ex.is_cardio && ex.cardio_detail && (
                      <div className="flex gap-3 text-xs text-gray-500">
                        <span>
                          强度:{" "}
                          {ex.cardio_detail.intensity === "high"
                            ? "高"
                            : ex.cardio_detail.intensity === "moderate"
                            ? "中"
                            : "低"}
                        </span>
                        {ex.cardio_detail.distance_meters && (
                          <span>
                            距离: {(ex.cardio_detail.distance_meters / 1000).toFixed(1)}km
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {data.notes && (
                  <p className="text-xs text-gray-400 italic">{data.notes}</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}