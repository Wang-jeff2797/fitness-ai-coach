"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/supabase/AuthContext";
import WorkoutInput from "@/components/WorkoutInput";
import StatsDashboard from "@/components/StatsDashboard";
import CycleManager from "@/components/CycleManager";
import BottomNav from "@/components/BottomNav";
import WorkoutHistory from "@/components/WorkoutHistory";
import ProfilePage from "@/components/ProfilePage";
import {
  Dumbbell,
  BarChart3,
  History,
  Settings,
  UserCircle,
  LogOut,
} from "lucide-react";
import LinkAccountModal from "@/components/LinkAccountModal";
type Tab = "log" | "stats" | "history" | "cycles" | "profile";
export default function Home() {
  const { user, isAnonymous, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("log");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const triggerRefresh = () => setRefreshKey((k) => k + 1);
  const tabs: { id: Tab; label: string; icon: typeof Dumbbell }[] = [
    { id: "log", label: "记录", icon: Dumbbell },
    { id: "stats", label: "看板", icon: BarChart3 },
    { id: "history", label: "历史", icon: History },
    { id: "cycles", label: "周期", icon: Settings },
    { id: "profile", label: "个人", icon: UserCircle },
  ];
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <Dumbbell className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-bold text-gray-900">FitCoach AI</h1>
          </div>
          <div className="flex items-center gap-2">
            {isAnonymous && (
              <button
                onClick={() => setShowLinkModal(true)}
                className="text-[10px] font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 px-2 py-1 rounded-lg transition-colors"
              >
                绑定邮箱
              </button>
            )}
            <span className="text-[10px] text-gray-400 hidden sm:inline max-w-[80px] truncate">
              {user?.email ? user.email.replace('@anonymous', '') || '匿名' : ''}
            </span>
            <button
              onClick={signOut}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              title="退出登录"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>
      {/* Main Content */}
      <main className="flex-1 px-4 pt-4 pb-20">
        {activeTab === "log" && <WorkoutInput onSuccess={triggerRefresh} />}
        {activeTab === "stats" && (
          <StatsDashboard key={`stats-${refreshKey}`} />
        )}
        {activeTab === "history" && (
          <WorkoutHistory key={`history-${refreshKey}`} />
        )}
        {activeTab === "cycles" && (
          <CycleManager key={`cycles-${refreshKey}`} onRefresh={triggerRefresh} />
        )}
        {activeTab === "profile" && (
          <ProfilePage key={`profile-${refreshKey}`} />
        )}
      </main>
      {/* 绑定邮箱弹窗 */}
      {showLinkModal && (
        <LinkAccountModal onClose={() => setShowLinkModal(false)} />
      )}
      {/* Bottom Navigation */}
      <BottomNav
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as Tab)}
      />
    </div>
  );
}