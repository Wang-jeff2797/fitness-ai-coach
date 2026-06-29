"use client";

import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Minus, Dumbbell, Activity, Target } from "lucide-react";
import VolumeChart from "./VolumeChart";
import type { StatsResponse } from "@/types";

export default function StatsDashboard() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((data) => {
        if (data.cycles) {
          setStats(data as StatsResponse);
        }
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

  if (!stats) {
    return (
      <div className="text-center py-12 text-gray-400">
        无法加载数据
      </div>
    );
  }

  const summary = stats.current_cycle_summary;
  const trendIcon = {
    increasing: <TrendingUp className="w-5 h-5 text-green-500" />,
    stable: <Minus className="w-5 h-5 text-yellow-500" />,
    decreasing: <TrendingDown className="w-5 h-5 text-red-500" />,
  };

  return (
    <div className="space-y-4">
      {/* 当前周期摘要 */}
      {summary && (
        <>
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary-500" />
              当前周期概览
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500">训练次数</p>
                <p className="text-xl font-bold text-gray-900 mt-1">
                  {summary.total_workouts}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500">总容量</p>
                <p className="text-xl font-bold text-gray-900 mt-1">
                  {(summary.total_volume_kg / 1000).toFixed(1)}t
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500">平均 RPE</p>
                <p className="text-xl font-bold text-gray-900 mt-1">
                  {summary.average_session_rpe}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500">趋势</p>
                <div className="flex items-center gap-1 mt-1">
                  {trendIcon[summary.volume_trend]}
                  <span className="text-sm font-medium text-gray-700">
                    {summary.volume_trend === "increasing"
                      ? "上升"
                      : summary.volume_trend === "decreasing"
                      ? "下降"
                      : "稳定"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* PR 统计 */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-accent-500" />
              突破记录
            </h3>
            <p className="text-2xl font-bold text-accent-600">
              {summary.pr_sets}
              <span className="text-sm font-normal text-gray-500 ml-1">
                个新 PR
              </span>
            </p>
          </div>
        </>
      )}

      {/* 容量趋势图 - 零 AI 消耗 */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Dumbbell className="w-4 h-4 text-primary-500" />
          容量趋势
        </h3>
        <VolumeChart data={stats.volume_trend || []} />
      </div>

      {/* 周期列表 */}
      <div className="card">
        <div className="p-4 border-b border-gray-50">
          <h3 className="text-sm font-semibold text-gray-900">训练周期</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {stats.cycles.map((c) => (
            <div key={c.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{c.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {c.start_date} ~ {c.end_date || "进行中"} · {c.workout_count} 次训练
                </p>
              </div>
              <p className="text-sm font-semibold text-gray-700">
                {(c.total_volume / 1000).toFixed(1)}t
              </p>
            </div>
          ))}
        </div>
        {stats.cycles.length === 0 && (
          <div className="p-8 text-center text-gray-400 text-sm">
            还没有训练周期，开始记录吧！
          </div>
        )}
      </div>
    </div>
  );
}
