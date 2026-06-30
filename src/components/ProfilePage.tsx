"use client";
import { useState, useEffect } from "react";
import {
  User,
  Activity,
  Settings2,
  Trophy,
  HelpCircle,
  Star,
  Loader2,
  Save,
  Plus,
  Trash2,
  Brain,
  CheckCircle2,
} from "lucide-react";
import ExercisePreferencesPanel from "./ExercisePreferencesPanel";
type ProfileTab = "info" | "lifestyle" | "settings" | "pr" | "unknown" | "preferences";
export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<ProfileTab>("info");
  const [cycles, setCycles] = useState<any[]>([]);
  const tabs: { id: ProfileTab; label: string; icon: any }[] = [
    { id: "info", label: "个人信息", icon: User },
    { id: "preferences", label: "常用动作", icon: Star },
    { id: "lifestyle", label: "生活反馈", icon: Activity },
    { id: "settings", label: "训练设置", icon: Settings2 },
    { id: "pr", label: "个人纪录", icon: Trophy },
    { id: "unknown", label: "未知动作", icon: HelpCircle },
  ];
  useEffect(() => {
    fetch("/api/cycles").then(r => r.json()).then(d => {
      if (d.cycles) setCycles(d.cycles);
    }).catch(() => {});
  }, []);
  const activeCycle = cycles.find((c: any) => c.is_active);
  return (
    <div className="space-y-4">
      {/* 子标签导航 */}
      <div className="flex overflow-x-auto gap-1 pb-1 scrollbar-hide">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-primary-100 text-primary-700"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>
      {activeTab === "info" && <ProfileInfoForm />}
      {activeTab === "lifestyle" && <LifestyleFeedbackForm activeCycle={activeCycle} />}
      {activeTab === "settings" && <UserSettingsForm />}
      {activeTab === "pr" && <PersonalRecordsForm />}
      {activeTab === "unknown" && <UnknownActionsForm />}
      {activeTab === "preferences" && (
        <div className="card p-4">
          <ExercisePreferencesPanel />
        </div>
      )}
    </div>
  );
}
// ============================================================
// 1. 个人信息表单
// ============================================================
function ProfileInfoForm() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: "", gender: "male", age: 25,
    weight_kg: 70, height_cm: 175,
    activity_level: "moderate", goal: "muscle_gain",
  });
  useEffect(() => {
    fetch("/api/profile").then(r => r.json()).then(d => {
      if (d.profile) {
        setProfile(d.profile);
        setForm({
          name: d.profile.name || "",
          gender: d.profile.gender || "male",
          age: d.profile.age || 25,
          weight_kg: Number(d.profile.weight_kg) || 70,
          height_cm: Number(d.profile.height_cm) || 175,
          activity_level: d.profile.activity_level || "moderate",
          goal: d.profile.goal || "muscle_gain",
        });
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);
  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {} finally {
      setSaving(false);
    }
  };
  if (loading) return <div className="text-center py-8 text-gray-400 text-sm">加载中...</div>;
  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <User className="w-5 h-5 text-primary-600" />
        <h3 className="font-semibold text-gray-900">个人资料</h3>
      </div>
      <p className="text-xs text-gray-400 -mt-2">用于 TDEE 计算和个性化训练建议</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">姓名</label>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            className="input-field" placeholder="可选" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">性别</label>
          <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}
            className="input-field">
            <option value="male">男</option><option value="female">女</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">年龄</label>
          <input type="number" value={form.age} onChange={e => setForm({ ...form, age: Number(e.target.value) })}
            className="input-field" min={10} max={120} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">体重 (kg)</label>
          <input type="number" value={form.weight_kg} onChange={e => setForm({ ...form, weight_kg: Number(e.target.value) })}
            className="input-field" min={30} max={300} step={0.1} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">身高 (cm)</label>
          <input type="number" value={form.height_cm} onChange={e => setForm({ ...form, height_cm: Number(e.target.value) })}
            className="input-field" min={100} max={250} step={0.1} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">日常活动水平</label>
          <select value={form.activity_level} onChange={e => setForm({ ...form, activity_level: e.target.value })}
            className="input-field">
            <option value="sedentary">久坐 (几乎不运动)</option>
            <option value="light">轻度 (1-3天/周)</option>
            <option value="moderate">中度 (3-5天/周)</option>
            <option value="active">积极 (6-7天/周)</option>
            <option value="very_active">高强度 (每天/体力劳动)</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">训练目标</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: "muscle_gain", label: "增肌" },
            { value: "fat_loss", label: "减脂" },
            { value: "strength", label: "增力" },
            { value: "endurance", label: "耐力" },
          ].map((opt) => (
            <button key={opt.value}
              onClick={() => setForm({ ...form, goal: opt.value })}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                form.goal === opt.value
                  ? "bg-primary-100 text-primary-700 border border-primary-200"
                  : "bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <button onClick={handleSave} disabled={saving} className="btn-primary w-full justify-center">
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        {saving ? "保存中..." : "保存"}
      </button>
      {saved && <p className="text-xs text-green-600 text-center flex items-center justify-center gap-1"><CheckCircle2 className="w-3 h-3" />已保存</p>}
    </div>
  );
}
// ============================================================
// 2. 生活反馈表单
// ============================================================
function LifestyleFeedbackForm({ activeCycle }: { activeCycle: any }) {
  const [form, setForm] = useState({
    sleep_quality: 3, stress_level: 2,
    activity_change: "same" as string, special_condition: "none" as string,
    notes: "", goal: "muscle_gain",
  });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [feedbackExists, setFeedbackExists] = useState(false);
  useEffect(() => {
    if (activeCycle) {
      fetch(`/api/lifestyle-feedback?cycle_id=${activeCycle.id}`).then(r => r.json()).then(d => {
        if (d.feedback) setFeedbackExists(true);
      }).catch(() => {});
    }
  }, [activeCycle]);
  const handleSubmit = async () => {
    if (!activeCycle) return;
    setSaving(true);
    try {
      const res = await fetch("/api/lifestyle-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, cycle_id: activeCycle.id }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.tdee || { message: "已保存" });
        setFeedbackExists(true);
      }
    } catch {} finally {
      setSaving(false);
    }
  };
  if (!activeCycle) {
    return <div className="card p-4 text-center text-gray-400 text-sm">请先创建一个活跃周期</div>;
  }
  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="w-5 h-5 text-primary-600" />
        <h3 className="font-semibold text-gray-900">生活反馈</h3>
      </div>
      <p className="text-xs text-gray-400 -mt-2">周期开始时的身体状态，用于修正 TDEE</p>
      {feedbackExists && !result && (
        <div className="bg-green-50 text-green-700 text-xs px-3 py-2 rounded-xl flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          本周期已填写反馈
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">睡眠质量</label>
        <div className="flex gap-2">
          {[1,2,3,4,5].map(n => (
            <button key={n} onClick={() => setForm({...form, sleep_quality: n})}
              className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
                form.sleep_quality === n
                  ? "bg-primary-100 text-primary-700 border border-primary-200"
                  : "bg-gray-50 text-gray-500 border border-gray-100"
              }`}>{n}</button>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-1">1=极差, 5=极好</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">压力水平</label>
        <div className="flex gap-2">
          {[1,2,3,4,5].map(n => (
            <button key={n} onClick={() => setForm({...form, stress_level: n})}
              className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
                form.stress_level === n
                  ? "bg-primary-100 text-primary-700 border border-primary-200"
                  : "bg-gray-50 text-gray-500 border border-gray-100"
              }`}>{n}</button>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-1">1=无压力, 5=极大压力</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">日常活动变化</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: "less", label: "比平时少" },
            { value: "same", label: "和平时一样" },
            { value: "more", label: "比平时多" },
          ].map(opt => (
            <button key={opt.value} onClick={() => setForm({...form, activity_change: opt.value})}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                form.activity_change === opt.value
                  ? "bg-primary-100 text-primary-700 border border-primary-200"
                  : "bg-gray-50 text-gray-600 border border-gray-100"
              }`}>{opt.label}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">特殊情况</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: "none", label: "无" },
            { value: "sick", label: "生病" },
            { value: "travel", label: "旅行" },
          ].map(opt => (
            <button key={opt.value} onClick={() => setForm({...form, special_condition: opt.value})}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                form.special_condition === opt.value
                  ? "bg-primary-100 text-primary-700 border border-primary-200"
                  : "bg-gray-50 text-gray-600 border border-gray-100"
              }`}>{opt.label}</button>
          ))}
        </div>
      </div>
      <button onClick={handleSubmit} disabled={saving} className="btn-primary w-full justify-center">
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        {saving ? "计算中..." : "提交反馈"}
      </button>
      {result && result.bmr && (
        <div className="bg-primary-50 rounded-xl p-3 space-y-1">
          <p className="text-xs font-semibold text-primary-700">TDEE 计算结果</p>
          <div className="text-xs text-primary-600 space-y-0.5">
            <p>基础代谢 BMR: <strong>{result.bmr}</strong> kcal</p>
            <p>修正后 PAL: <strong>{result.pal}</strong></p>
            <p>每日 TDEE: <strong>{result.tdee_adjusted}</strong> kcal</p>
            {(result.adjustments.sleep_adjustment < 0 || result.adjustments.stress_adjustment < 0) && (
              <p className="text-amber-600">? PAL 因生活反馈下调</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
// ============================================================
// 3. 用户设置 (key-value)
// ============================================================
function UserSettingsForm() {
  const [settings, setSettings] = useState<any[]>([]);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [loading, setLoading] = useState(true);
  const loadSettings = () => {
    fetch("/api/user-settings").then(r => r.json()).then(d => {
      if (d.settings) setSettings(d.settings);
    }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { loadSettings(); }, []);
  const addSetting = async () => {
    if (!newKey.trim() || !newValue.trim()) return;
    const res = await fetch("/api/user-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: newKey.trim(), value: newValue.trim() }),
    });
    if (res.ok) {
      setNewKey(""); setNewValue("");
      loadSettings();
    }
  };
  const deleteSetting = async (key: string) => {
    await fetch(`/api/user-settings?key=${encodeURIComponent(key)}`, { method: "DELETE" });
    loadSettings();
  };
  if (loading) return <div className="text-center py-8 text-gray-400 text-sm">加载中...</div>;
  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Settings2 className="w-5 h-5 text-primary-600" />
        <h3 className="font-semibold text-gray-900">训练设置</h3>
      </div>
      <p className="text-xs text-gray-400 -mt-2">
        自定义常用变量，作为 AI 提取时的上下文。例如：组间休息时间、常用器械重量
      </p>
      {/* 预设建议 */}
      <div className="flex flex-wrap gap-1.5">
        {["组间休息:90秒", "常用配速:5:00/km", "热身组:空杆", "游泳配速:2:00/100m"].map(preset => (
          <button key={preset} onClick={() => {
            const [k, v] = preset.split(":");
            setNewKey(k); setNewValue(v);
          }} className="px-2 py-1 text-[10px] bg-gray-50 text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">
            {preset}
          </button>
        ))}
      </div>
      {/* 添加新设置 */}
      <div className="flex gap-2">
        <input value={newKey} onChange={e => setNewKey(e.target.value)}
          placeholder="键名" className="input-field flex-[3] text-xs" />
        <input value={newValue} onChange={e => setNewValue(e.target.value)}
          placeholder="值" className="input-field flex-[2] text-xs" />
        <button onClick={addSetting} className="btn-primary px-3">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {/* 设置列表 */}
      {settings.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">还没有自定义设置</p>
      ) : (
        <div className="space-y-1.5">
          {settings.map((s) => (
            <div key={s.key} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
              <div>
                <span className="text-xs font-medium text-gray-700">{s.key}</span>
                <span className="text-xs text-gray-400 ml-2">{s.value}</span>
              </div>
              <button onClick={() => deleteSetting(s.key)} className="text-gray-300 hover:text-red-400 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
// ============================================================
// 4. 个人纪录 (PR)
// ============================================================
function PersonalRecordsForm() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ exercise: "", weight_kg: 0, reps: 0, notes: "" });
  const loadRecords = () => {
    fetch("/api/personal-record").then(r => r.json()).then(d => {
      if (d.records) setRecords(d.records);
    }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { loadRecords(); }, []);
  const addRecord = async () => {
    if (!form.exercise || !form.weight_kg || !form.reps) return;
    const res = await fetch("/api/personal-record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ exercise: "", weight_kg: 0, reps: 0, notes: "" });
      loadRecords();
    }
  };
  const deleteRecord = async (id: string) => {
    await fetch(`/api/personal-record?id=${id}`, { method: "DELETE" });
    loadRecords();
  };
  if (loading) return <div className="text-center py-8 text-gray-400 text-sm">加载中...</div>;
  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary-600" />
          <h3 className="font-semibold text-gray-900">个人纪录</h3>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary text-xs px-3 py-1.5">
          <Plus className="w-3.5 h-3.5 mr-1" />
          添加
        </button>
      </div>
      {showForm && (
        <div className="bg-gray-50 rounded-xl p-3 space-y-2">
          <input value={form.exercise} onChange={e => setForm({...form, exercise: e.target.value})}
            placeholder="动作名称" className="input-field text-xs" />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" value={form.weight_kg || ""} onChange={e => setForm({...form, weight_kg: Number(e.target.value)})}
              placeholder="重量 (kg)" className="input-field text-xs" />
            <input type="number" value={form.reps || ""} onChange={e => setForm({...form, reps: Number(e.target.value)})}
              placeholder="次数" className="input-field text-xs" />
          </div>
          <div className="flex gap-2">
            <button onClick={addRecord} className="btn-primary flex-1 text-xs">保存</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary text-xs">取消</button>
          </div>
        </div>
      )}
      {records.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">暂无纪录</p>
      ) : (
        <div className="space-y-2">
          {records.map((r) => (
            <div key={r.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-gray-900">{r.exercise}</p>
                <p className="text-xs text-gray-400">
                  {r.weight_kg}kg × {r.reps} 次
                  <span className="ml-2 text-primary-600 font-medium">1RM: {r.estimated_1rm}kg</span>
                </p>
              </div>
              <button onClick={() => deleteRecord(r.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
// ============================================================
// 5. 未知动作
// ============================================================
function UnknownActionsForm() {
  const [actions, setActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [learning, setLearning] = useState<string | null>(null);
  const [learnResult, setLearnResult] = useState<string | null>(null);
  const loadActions = () => {
    fetch("/api/learn-action").then(r => r.json()).then(d => {
      if (d.actions) setActions(d.actions.filter((a: any) => !a.is_learned));
    }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { loadActions(); }, []);
  const learnAction = async (name: string) => {
    setLearning(name);
    setLearnResult(null);
    try {
      const res = await fetch("/api/learn-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action_name: name }),
      });
      const data = await res.json();
      if (data.action) {
        setLearnResult(`${name} → MET: ${data.action.met_value} (${data.explanation || "已学习"})`);
        loadActions();
      }
    } catch {} finally {
      setLearning(null);
    }
  };
  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Brain className="w-5 h-5 text-primary-600" />
        <h3 className="font-semibold text-gray-900">未知动作学习</h3>
      </div>
      <p className="text-xs text-gray-400 -mt-2">
        AI 提取时未在 MET 库中找到的动作，可以逐个学习
      </p>
      {learnResult && (
        <div className="bg-green-50 text-green-700 text-xs px-3 py-2 rounded-xl flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />{learnResult}
        </div>
      )}
      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">加载中...</div>
      ) : actions.length === 0 ? (
        <div className="text-center py-8">
          <HelpCircle className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-xs text-gray-400">暂无未知动作</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {actions.map((a) => (
            <div key={a.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-gray-900">{a.action_name}</p>
                {a.context && <p className="text-[10px] text-gray-400">上下文: {a.context}</p>}
              </div>
              <button onClick={() => learnAction(a.action_name)} disabled={learning === a.action_name}
                className="btn-primary text-xs px-3 py-1.5">
                {learning === a.action_name ? <Loader2 className="w-3 h-3 animate-spin" /> : "学习"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}