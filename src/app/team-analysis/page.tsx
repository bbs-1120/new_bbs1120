"use client";

import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useMemo, useCallback } from "react";
import { 
  RefreshCw, TrendingUp, TrendingDown, DollarSign, Target, BarChart3, 
  Power, PowerOff, Users, ChevronDown, ChevronUp, Calendar, Zap,
  CheckCircle, AlertTriangle, Search, History, Settings, X
} from "lucide-react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell 
} from "recharts";
import { AnalysisPageSkeleton } from "@/components/ui/skeleton";
import { getRoasColorClass } from "@/lib/utils";
import { GoalProgress } from "@/components/ui/goal-progress";
import { ExportButton } from "@/components/ui/export-button";
import { SearchFilter, FilterOptions } from "@/components/ui/search-filter";
import { CpnMemo } from "@/components/ui/cpn-memo";
import { addChangeRecord, ChangeHistory } from "@/components/ui/change-history";
import { DashboardConfig, getWidgetConfig, DashboardWidget } from "@/components/ui/dashboard-config";

// 媒体ロゴコンポーネント
function MediaLogo({ media, size = 14 }: { media: string; size?: number }) {
  const logoMap: Record<string, string> = {
    "FB": "/icons/fb-logo.png",
    "Meta": "/icons/fb-logo.png",
    "TikTok": "/icons/tiktok-logo.png",
    "Pangle": "/icons/pangle-logo.png",
  };
  const src = logoMap[media];
  if (!src) return null;
  return <img src={src} alt={media} style={{ width: size, height: size }} className="object-contain shrink-0" />;
}

interface CpnData {
  cpnName: string;
  cpnKey: string;
  media: string;
  spend: number;
  profit: number;
  revenue: number;
  roas: number;
  cv: number;
  mcv: number;
  cpa: number;
  cvr: number;
  status: string;
  campaignId: string;
  accountName: string;
  consecutiveLoss: number;
  profit7Days: number;
  roas7Days: number;
  dailyBudget: string;
  // 追加指標
  impressions?: number;
  clicks?: number;
  cpm?: number;
  cpc?: number;
  ctr?: number;
  mcvr?: number;
  mcpa?: number;
}

interface MemberData {
  name: string;
  spend: number;
  revenue: number;
  profit: number;
  roas: number;
  cv: number;
  mcv: number;
  cpnCount: number;
  cpns: CpnData[];
}

interface TeamSummary {
  totalSpend: number;
  totalRevenue: number;
  totalProfit: number;
  totalCv: number;
  totalMcv: number;
  totalCpnCount: number;
  memberCount: number;
  roas: number;
  monthlyProfit: number;
  cpa: number;
  cvr: number;
}

interface ProjectData {
  name: string;
  spend: number;
  revenue: number;
  profit: number;
  roas: number;
  cv: number;
  mcv: number;
  cpa: number;
  cvr: number;
}

interface MediaData {
  media: string;
  spend: number;
  revenue: number;
  profit: number;
  roas: number;
  cv: number;
  mcv: number;
  cpa: number;
  cvr: number;
  cpm: number;
  cpc: number;
  ctr: number;
  impressions: number;
  clicks: number;
}

interface DailyTrendData {
  date: string;
  profit: number;
  cumulativeProfit: number;
}

const COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#8b5cf6", "#06b6d4"];

type TabType = "overview" | "cpn" | "project" | "media";

export default function TeamAnalysisPage() {
  const [teamSummary, setTeamSummary] = useState<TeamSummary | null>(null);
  const [memberList, setMemberList] = useState<MemberData[]>([]);
  const [projectList, setProjectList] = useState<ProjectData[]>([]);
  const [mediaList, setMediaList] = useState<MediaData[]>([]);
  const [dailyTrend, setDailyTrend] = useState<DailyTrendData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [selectedCpns, setSelectedCpns] = useState<Set<string>>(new Set());
  const [lastClickedCpnIndex, setLastClickedCpnIndex] = useState<number | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [cpnSortKey, setCpnSortKey] = useState<string>("profit");
  const [cpnSortDir, setCpnSortDir] = useState<"asc" | "desc">("desc");
  const [selectedMember, setSelectedMember] = useState<string>("all");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>({});
  const [budgetInputs, setBudgetInputs] = useState<Record<string, string>>({});
  const [budgetUpdating, setBudgetUpdating] = useState<Record<string, boolean>>({});
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [expandedMedia, setExpandedMedia] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showDashboardConfig, setShowDashboardConfig] = useState(false);
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    searchQuery: "",
    mediaFilter: "all",
    statusFilter: "all",
    profitFilter: "all",
  });
  
  // 予算スケジュールモーダル用
  const [showBudgetScheduleModal, setShowBudgetScheduleModal] = useState(false);
  const [budgetScheduleCpn, setBudgetScheduleCpn] = useState<CpnDataWithMember | null>(null);
  const [budgetScheduleForm, setBudgetScheduleForm] = useState({
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    budgetAmount: "",
  });
  const [budgetScheduleSubmitting, setBudgetScheduleSubmitting] = useState(false);
  const [budgetScheduleMessage, setBudgetScheduleMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  // 設定済みスケジュール表示用
  interface ScheduleInfo {
    id: string;
    time_start: number;
    time_stop: number;
    budget_value: string;
  }
  const [scheduleCache, setScheduleCache] = useState<Record<string, ScheduleInfo[]>>({});
  
  // ウィジェット設定を読み込み
  useEffect(() => {
    setWidgets(getWidgetConfig());
  }, []);

  const currentMonth = useMemo(() => {
    const now = new Date();
    return now.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric" }).replace("月", "");
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/team-analysis");
      const data = await res.json();
      if (data.success) {
        setTeamSummary(data.teamSummary);
        setMemberList(data.memberList);
        setProjectList(data.projectList || []);
        setMediaList(data.mediaList || []);
        setDailyTrend(data.dailyTrend || []);
        setLastUpdated(new Date());
      } else {
        setError("データの取得に失敗しました");
      }
    } catch (err) {
      console.error("Failed to fetch team data:", err);
      setError("ネットワークエラーが発生しました");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
  };

  // 予算スケジュールモーダルを開く
  const openBudgetScheduleModal = (cpn: CpnDataWithMember) => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const nextSlotMinutes = Math.ceil((currentHour * 60 + currentMinute) / 15) * 15 + 15;
    const defaultStartHour = Math.floor(nextSlotMinutes / 60) % 24;
    const defaultStartMinute = nextSlotMinutes % 60;
    const defaultStartTime = `${String(defaultStartHour).padStart(2, "0")}:${String(defaultStartMinute).padStart(2, "0")}`;
    const startDate = nextSlotMinutes >= 24 * 60 ? tomorrow : now;
    
    setBudgetScheduleCpn(cpn);
    setBudgetScheduleForm({
      startDate: startDate.toISOString().split("T")[0],
      startTime: defaultStartTime,
      endDate: tomorrow.toISOString().split("T")[0],
      endTime: "23:45",
      budgetAmount: "",
    });
    setBudgetScheduleMessage(null);
    setShowBudgetScheduleModal(true);
  };

  // 予算スケジュールを送信
  const submitBudgetSchedule = async () => {
    if (!budgetScheduleCpn) return;

    const { startDate, startTime, endDate, endTime, budgetAmount } = budgetScheduleForm;
    
    if (!startDate || !startTime || !endDate || !endTime || !budgetAmount) {
      setBudgetScheduleMessage({ type: "error", text: "すべての項目を入力してください" });
      return;
    }

    const amount = parseInt(budgetAmount.replace(/[¥,]/g, ""), 10);
    if (isNaN(amount) || amount <= 0) {
      setBudgetScheduleMessage({ type: "error", text: "予算は正の数値で入力してください" });
      return;
    }

    setBudgetScheduleSubmitting(true);
    setBudgetScheduleMessage(null);

    try {
      const startDateTime = `${startDate}T${startTime}:00`;
      const endDateTime = `${endDate}T${endTime}:00`;

      const response = await fetch("/api/budget-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: budgetScheduleCpn.campaignId,
          accountId: budgetScheduleCpn.accountName,
          budgetAmount: amount,
          startTime: startDateTime,
          endTime: endDateTime,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setBudgetScheduleMessage({ type: "success", text: "予算スケジュールを設定しました" });
        // キャッシュをクリアして再取得
        if (budgetScheduleCpn?.campaignId) {
          setScheduleCache(prev => {
            const newCache = { ...prev };
            delete newCache[budgetScheduleCpn.campaignId!];
            return newCache;
          });
        }
        // 成功したら2秒後にモーダルを閉じる
        setTimeout(() => {
          setShowBudgetScheduleModal(false);
          setBudgetScheduleCpn(null);
        }, 2000);
      } else {
        setBudgetScheduleMessage({ type: "error", text: result.error || "設定に失敗しました" });
      }
    } catch {
      setBudgetScheduleMessage({ type: "error", text: "通信エラーが発生しました" });
    } finally {
      setBudgetScheduleSubmitting(false);
    }
  };

  // スケジュール情報をフォーマット
  const formatScheduleInfo = (schedules: ScheduleInfo[]) => {
    if (!schedules || schedules.length === 0) return null;
    
    const now = Date.now() / 1000;
    const activeSchedules = schedules.filter(s => s.time_stop > now);
    
    if (activeSchedules.length === 0) return null;
    
    const nextSchedule = activeSchedules.sort((a, b) => a.time_start - b.time_start)[0];
    const startDate = new Date(nextSchedule.time_start * 1000);
    const endDate = new Date(nextSchedule.time_stop * 1000);
    
    const formatDateTime = (date: Date) => {
      return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    };
    
    return {
      budget: `¥${parseInt(nextSchedule.budget_value).toLocaleString()}`,
      period: `${formatDateTime(startDate)} - ${formatDateTime(endDate)}`,
      isActive: nextSchedule.time_start <= now && nextSchedule.time_stop > now,
    };
  };

  const formatCurrency = (value: number) => {
    const sign = value < 0 ? "-" : value > 0 ? "+" : "";
    return `${sign}¥${Math.abs(Math.round(value)).toLocaleString("ja-JP")}`;
  };

  const formatNumber = (value: number) => {
    return Math.floor(value).toLocaleString();
  };

  // 全CPNを取得
  const allCpns = useMemo(() => {
    let cpns: (CpnData & { memberName: string })[] = [];
    memberList.forEach(member => {
      member.cpns.forEach(cpn => {
        cpns.push({ ...cpn, memberName: member.name });
      });
    });
    return cpns;
  }, [memberList]);

  // フィルタリングされたCPN
  const filteredCpns = useMemo(() => {
    let cpns = allCpns;
    
    // メンバーフィルター
    if (selectedMember && selectedMember !== "all") {
      cpns = cpns.filter(cpn => cpn.memberName === selectedMember);
    }
    
    // 検索フィルター
    if (filterOptions.searchQuery) {
      const query = filterOptions.searchQuery.toLowerCase();
      cpns = cpns.filter(cpn => cpn.cpnName.toLowerCase().includes(query));
    }
    
    // 媒体フィルター
    if (filterOptions.mediaFilter !== "all") {
      cpns = cpns.filter(cpn => cpn.media === filterOptions.mediaFilter);
    }
    
    // ステータスフィルター
    if (filterOptions.statusFilter !== "all") {
      cpns = cpns.filter(cpn => cpn.status === filterOptions.statusFilter);
    }
    
    // 利益フィルター
    if (filterOptions.profitFilter === "positive") {
      cpns = cpns.filter(cpn => cpn.profit >= 0);
    } else if (filterOptions.profitFilter === "negative") {
      cpns = cpns.filter(cpn => cpn.profit < 0);
    }
    
    return cpns;
  }, [allCpns, selectedMember, filterOptions]);

  // ソート済みCPN
  const sortedCpns = useMemo(() => {
    return [...filteredCpns].sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;
      switch (cpnSortKey) {
        case "cpnName": aVal = a.cpnName; bVal = b.cpnName; break;
        case "profit": aVal = a.profit; bVal = b.profit; break;
        case "roas": aVal = a.roas; bVal = b.roas; break;
        case "spend": aVal = a.spend; bVal = b.spend; break;
        case "cv": aVal = a.cv; bVal = b.cv; break;
        case "profit7Days": aVal = a.profit7Days; bVal = b.profit7Days; break;
        case "memberName": aVal = a.memberName; bVal = b.memberName; break;
        default: aVal = a.profit; bVal = b.profit;
      }
      if (typeof aVal === "string") {
        return cpnSortDir === "asc" ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      }
      return cpnSortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [filteredCpns, cpnSortKey, cpnSortDir]);

  const toggleSort = (key: string) => {
    if (cpnSortKey === key) {
      setCpnSortDir(cpnSortDir === "asc" ? "desc" : "asc");
    } else {
      setCpnSortKey(key);
      setCpnSortDir("desc");
    }
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (cpnSortKey !== columnKey) return <span className="text-slate-300 ml-1">↕</span>;
    return <span className="text-indigo-600 ml-1">{cpnSortDir === "asc" ? "↑" : "↓"}</span>;
  };

  // ON/OFF切り替え
  const handleStatusToggle = async (cpn: CpnData & { memberName: string }) => {
    const newStatus = cpn.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setStatusUpdating(prev => ({ ...prev, [cpn.cpnKey]: true }));

    try {
      const response = await fetch("/api/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: cpn.campaignId,
          status: newStatus,
          media: cpn.media,
          accountName: cpn.accountName,
        }),
      });

      const data = await response.json();
      if (data.success) {
        // ローカルで状態を更新
        setMemberList(prev => prev.map(member => ({
          ...member,
          cpns: member.cpns.map(c => 
            c.cpnKey === cpn.cpnKey ? { ...c, status: newStatus } : c
          ),
        })));
        // 変更履歴を記録
        addChangeRecord({
          type: "status",
          cpnName: cpn.cpnName,
          cpnKey: cpn.cpnKey,
          media: cpn.media,
          oldValue: cpn.status,
          newValue: newStatus,
          success: true,
        });
      } else {
        alert(`エラー: ${data.error}`);
        addChangeRecord({
          type: "status",
          cpnName: cpn.cpnName,
          cpnKey: cpn.cpnKey,
          media: cpn.media,
          oldValue: cpn.status,
          newValue: newStatus,
          success: false,
        });
      }
    } catch (error) {
      console.error("Status update failed:", error);
      alert("ステータス更新に失敗しました");
    } finally {
      setStatusUpdating(prev => ({ ...prev, [cpn.cpnKey]: false }));
    }
  };

  // 予算変更
  const handleBudgetChange = async (cpn: CpnData & { memberName: string }) => {
    const newBudget = budgetInputs[cpn.cpnKey];
    if (!newBudget) return;

    setBudgetUpdating(prev => ({ ...prev, [cpn.cpnKey]: true }));

    try {
      const response = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: cpn.campaignId,
          budget: parseInt(newBudget),
          media: cpn.media,
          accountName: cpn.accountName,
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert("予算を更新しました");
        // 変更履歴を記録
        addChangeRecord({
          type: "budget",
          cpnName: cpn.cpnName,
          cpnKey: cpn.cpnKey,
          media: cpn.media,
          oldValue: cpn.dailyBudget,
          newValue: parseInt(newBudget),
          success: true,
        });
        setBudgetInputs(prev => ({ ...prev, [cpn.cpnKey]: "" }));
      } else {
        alert(`エラー: ${data.error}`);
        addChangeRecord({
          type: "budget",
          cpnName: cpn.cpnName,
          cpnKey: cpn.cpnKey,
          media: cpn.media,
          oldValue: cpn.dailyBudget,
          newValue: parseInt(newBudget),
          success: false,
        });
      }
    } catch (error) {
      console.error("Budget update failed:", error);
      alert("予算更新に失敗しました");
    } finally {
      setBudgetUpdating(prev => ({ ...prev, [cpn.cpnKey]: false }));
    }
  };

  // Shift+クリックで範囲選択対応
  const handleCpnCheckboxClick = (index: number, cpnKey: string, event: React.MouseEvent, cpnList: { cpnKey: string }[]) => {
    if (event.shiftKey && lastClickedCpnIndex !== null) {
      // Shift+クリック: 範囲選択
      const start = Math.min(lastClickedCpnIndex, index);
      const end = Math.max(lastClickedCpnIndex, index);
      const rangeKeys = cpnList.slice(start, end + 1).map(c => c.cpnKey);
      
      const newSelected = new Set(selectedCpns);
      rangeKeys.forEach(k => newSelected.add(k));
      setSelectedCpns(newSelected);
    } else {
      // 通常クリック: トグル
      const newSelected = new Set(selectedCpns);
      if (newSelected.has(cpnKey)) {
        newSelected.delete(cpnKey);
      } else {
        newSelected.add(cpnKey);
      }
      setSelectedCpns(newSelected);
    }
    setLastClickedCpnIndex(index);
  };

  const handleBulkStatusChange = async (status: "ACTIVE" | "PAUSED") => {
    if (selectedCpns.size === 0) return;
    
    setIsUpdating(true);
    try {
      const cpnsToUpdate = allCpns.filter(cpn => selectedCpns.has(cpn.cpnKey));

      const results = await Promise.allSettled(
        cpnsToUpdate.map(cpn =>
          fetch("/api/status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              campaignId: cpn.campaignId,
              status,
              media: cpn.media,
              accountName: cpn.accountName,
            }),
          })
        )
      );

      const successCount = results.filter(r => r.status === "fulfilled").length;
      alert(`${successCount}/${cpnsToUpdate.length}件の更新が完了しました`);
      
      await fetchData();
      setSelectedCpns(new Set());
    } catch (error) {
      console.error("Bulk status update failed:", error);
      alert("更新に失敗しました");
    } finally {
      setIsUpdating(false);
    }
  };

  const getMediaBgColor = (media: string) => {
    switch (media) {
      case "Meta": return "bg-blue-500";
      case "TikTok": return "bg-slate-800";
      case "Pangle": return "bg-cyan-500";
      default: return "bg-gray-500";
    }
  };

  const getConsecutiveLossDisplay = (cpn: CpnData) => {
    if (cpn.profit >= 0) {
      return <span className="text-emerald-600 text-xs">当日プラス</span>;
    }
    if (cpn.consecutiveLoss === 1) {
      return <span className="text-red-500 text-xs">当日マイナス</span>;
    }
    return <span className="text-red-600 text-xs font-bold">マイナス{cpn.consecutiveLoss}日</span>;
  };

  // Top 10 CPN
  const top10Cpns = useMemo(() => {
    return [...allCpns].sort((a, b) => b.profit - a.profit).slice(0, 10);
  }, [allCpns]);

  // 媒体別グラフデータ
  const mediaChartData = mediaList.map(m => ({
    name: m.media,
    利益: m.profit,
    消化: m.spend,
  }));

  if (isLoading) {
    return (
      <>
        <Header title="チーム分析" description="チーム全体のパフォーマンス" />
        <AnalysisPageSkeleton />
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header title="チーム分析" description="チーム全体のパフォーマンス" />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={() => fetchData()}>再試行</Button>
          </div>
        </div>
      </>
    );
  }

  const summary = teamSummary || {
    totalSpend: 0, totalRevenue: 0, totalProfit: 0, totalCv: 0, totalMcv: 0,
    totalCpnCount: 0, memberCount: 0, roas: 0, monthlyProfit: 0, cpa: 0, cvr: 0,
  };

  return (
    <>
      <Header title="チーム分析" description="チーム全体のパフォーマンス" />

      {/* 自動更新バー */}
      <div className="mb-4 p-2 lg:p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 lg:gap-4 text-xs lg:text-sm">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-slate-600">チームデータ</span>
            </div>
            {lastUpdated && (
              <span className="text-slate-400">
                更新: {lastUpdated.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <span className="text-slate-500">
              {summary.memberCount}人 / {summary.totalCpnCount} CPN
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowDashboardConfig(true)}
              className="h-8"
            >
              <Settings className="h-3 w-3 mr-1" />
              表示設定
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowHistory(true)}
              className="h-8"
            >
              <History className="h-3 w-3 mr-1" />
              変更履歴
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-8"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
              更新
            </Button>
          </div>
        </div>
      </div>

      {/* 目標進捗 */}
      <div className="mb-6">
        <GoalProgress currentProfit={summary.monthlyProfit || summary.totalProfit} />
      </div>

      {/* 検索フィルター */}
      <div className="mb-6">
        <SearchFilter
          options={filterOptions}
          onChange={setFilterOptions}
          mediaOptions={mediaList.map(m => m.media)}
        />
      </div>

      {/* サマリーカード（マイ分析と同じスタイル） */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-lg">
          <div className="text-xs opacity-80 mb-1">利益</div>
          <div className="text-2xl lg:text-3xl font-bold">
            ¥{formatNumber(summary.totalProfit)}
          </div>
        </div>
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-4 text-white shadow-lg">
          <div className="text-xs opacity-80 mb-1">{currentMonth}月利益</div>
          <div className="text-2xl lg:text-3xl font-bold">
            ¥{formatNumber(summary.monthlyProfit || summary.totalProfit)}
          </div>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white shadow-lg">
          <div className="text-xs opacity-80 mb-1">ROAS</div>
          <div className="text-2xl lg:text-3xl font-bold">
            {summary.roas.toFixed(1)}%
          </div>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white shadow-lg">
          <div className="text-xs opacity-80 mb-1">消化金額</div>
          <div className="text-2xl lg:text-3xl font-bold">
            ¥{formatNumber(summary.totalSpend)}
          </div>
        </div>
        <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl p-4 text-white shadow-lg">
          <div className="text-xs opacity-80 mb-1">CV</div>
          <div className="text-2xl lg:text-3xl font-bold">
            {summary.totalCv}
          </div>
        </div>
      </div>

      {/* タブナビゲーション */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-2">
        {[
          { key: "overview", label: "📊 概要", icon: BarChart3 },
          { key: "cpn", label: "📋 CPN", icon: Target },
          { key: "project", label: "📁 案件", icon: Calendar },
          { key: "media", label: "📺 媒体", icon: Zap },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as TabType)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? "bg-indigo-600 text-white shadow-md"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 一括操作バー */}
      {selectedCpns.size > 0 && (
        <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg flex flex-wrap items-center justify-between gap-4">
          <span className="text-indigo-700 font-medium">
            {selectedCpns.size}件選択中
          </span>
          <div className="flex gap-2">
            <Button
              onClick={() => handleBulkStatusChange("ACTIVE")}
              disabled={isUpdating}
              className="bg-emerald-500 hover:bg-emerald-600"
              size="sm"
            >
              <Power className="h-4 w-4 mr-1" />
              一括ON
            </Button>
            <Button
              onClick={() => handleBulkStatusChange("PAUSED")}
              disabled={isUpdating}
              variant="danger"
              size="sm"
            >
              <PowerOff className="h-4 w-4 mr-1" />
              一括OFF
            </Button>
            <Button
              onClick={() => setSelectedCpns(new Set())}
              variant="secondary"
              size="sm"
            >
              選択解除
            </Button>
          </div>
        </div>
      )}

      {/* 概要タブ */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* グラフエリア */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 日別利益推移 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">📈 {currentMonth}月 日別利益推移</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `¥${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value) => [`¥${Number(value).toLocaleString()}`, ""]} />
                      <Legend />
                      <Line type="monotone" dataKey="profit" name="利益" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="cumulativeProfit" name="累計利益" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* 媒体別利益 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">📊 媒体別利益</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mediaChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `¥${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value) => [`¥${Number(value).toLocaleString()}`, ""]} />
                      <Bar dataKey="利益" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top 10 CPN */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">🔥 本日の利益TOP10 CPN</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-slate-500 text-xs">
                      <th className="py-2 px-2 w-8">#</th>
                      <th className="py-2 px-2">CPN名</th>
                      <th className="py-2 px-2">消化金額</th>
                      <th className="py-2 px-2">MCV</th>
                      <th className="py-2 px-2">CV</th>
                      <th className="py-2 px-2">売上</th>
                      <th className="py-2 px-2 text-right">利益</th>
                      <th className="py-2 px-2 text-right">ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top10Cpns.map((cpn, idx) => (
                      <tr key={cpn.cpnKey} className="border-b hover:bg-slate-50">
                        <td className="py-2 px-2 font-bold text-amber-500">{idx + 1}</td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-xs text-white ${getMediaBgColor(cpn.media)}`}>
                              {cpn.media}
                            </span>
                            <span className="text-slate-800 break-all max-w-xs">{cpn.cpnName}</span>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-slate-600">¥{formatNumber(cpn.spend)}</td>
                        <td className="py-2 px-2 text-slate-600">{cpn.mcv}</td>
                        <td className="py-2 px-2 text-slate-600">{cpn.cv}</td>
                        <td className="py-2 px-2 text-slate-600">¥{formatNumber(cpn.revenue)}</td>
                        <td className="py-2 px-2 text-right">
                          <span className={`font-bold ${cpn.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            ¥{formatNumber(cpn.profit)}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right">
                          <span className={`font-bold ${getRoasColorClass(cpn.roas)}`}>
                            {cpn.roas.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* メンバーランキング */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">🏅 メンバー利益ランキング</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {memberList.map((member, idx) => (
                  <div key={member.name} className="flex items-center gap-4 p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                      idx === 0 ? "bg-amber-500" : idx === 1 ? "bg-slate-400" : idx === 2 ? "bg-amber-700" : "bg-slate-300"
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 truncate">{member.name}</p>
                      <p className="text-xs text-slate-500">{member.cpnCount} CPNs</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold text-lg ${member.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        ¥{formatNumber(member.profit)}
                      </p>
                      <p className={`text-xs ${getRoasColorClass(member.roas)}`}>
                        ROAS {member.roas.toFixed(1)}%
                      </p>
                    </div>
                    <div className="text-right hidden lg:block w-24">
                      <p className="text-slate-600">¥{formatNumber(member.spend)}</p>
                      <p className="text-xs text-slate-500">消化</p>
                    </div>
                    <div className="text-right hidden lg:block w-16">
                      <p className="text-slate-600">{member.cv}</p>
                      <p className="text-xs text-slate-500">CV</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* CPNタブ */}
      {activeTab === "cpn" && (
        <div className="space-y-4">
          {/* 当日CPN合計数値 */}
          <div className="text-lg font-bold text-slate-800 mb-4">
            当日のCPN合計数値（{filteredCpns.length}件）
          </div>

          {/* サマリーカード */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-slate-500 mb-1">消化金額</div>
                <div className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  ¥{formatNumber(filteredCpns.reduce((sum, c) => sum + c.spend, 0))}
                  <DollarSign className="h-5 w-5 text-slate-400" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-slate-500 mb-1">利益</div>
                <div className={`text-2xl font-bold flex items-center gap-2 ${
                  filteredCpns.reduce((sum, c) => sum + c.profit, 0) >= 0 ? "text-emerald-600" : "text-red-600"
                }`}>
                  ¥{formatNumber(filteredCpns.reduce((sum, c) => sum + c.profit, 0))}
                  <TrendingUp className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-slate-500 mb-1">ROAS</div>
                <div className={`text-2xl font-bold flex items-center gap-2 ${
                  summary.roas >= 100 ? "text-emerald-600" : "text-red-600"
                }`}>
                  {summary.roas.toFixed(1)}%
                  <BarChart3 className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 詳細指標カード */}
          <div className="grid grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-xs text-blue-600 flex items-center gap-1">
                <Target className="h-3 w-3" /> MCV
              </div>
              <div className="text-xl font-bold text-blue-800">
                {filteredCpns.reduce((sum, c) => sum + c.mcv, 0)}
              </div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> CV
              </div>
              <div className="text-xl font-bold text-green-800">
                {filteredCpns.reduce((sum, c) => sum + c.cv, 0)}
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="text-xs text-amber-600 flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> 売上
              </div>
              <div className="text-xl font-bold text-amber-800">
                ¥{formatNumber(filteredCpns.reduce((sum, c) => sum + c.revenue, 0))}
              </div>
            </div>
            <div className="bg-pink-50 border border-pink-200 rounded-lg p-3">
              <div className="text-xs text-pink-600 flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> CPA
              </div>
              <div className="text-xl font-bold text-pink-800">
                ¥{formatNumber(summary.cpa)}
              </div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <div className="text-xs text-purple-600 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> {currentMonth}月利益
              </div>
              <div className="text-xl font-bold text-purple-800">
                ¥{formatNumber(summary.monthlyProfit || summary.totalProfit)}
              </div>
            </div>
          </div>

          {/* フィルター */}
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">メンバー:</span>
              <select
                value={selectedMember}
                onChange={(e) => setSelectedMember(e.target.value)}
                className="px-3 py-1.5 border rounded-lg text-sm bg-white"
              >
                <option value="all">全員</option>
                {memberList.map(m => (
                  <option key={m.name} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>
            {/* エクスポートは後で追加 */}
          </div>

          {/* CPNテーブル */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                CPN単位のデータ（{sortedCpns.length}件 / {allCpns.length}件中）
              </CardTitle>
              <p className="text-xs text-slate-500">※予算変更は Meta / TikTok / Pangle のみ対応</p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr className="text-xs text-slate-500 border-b">
                      <th className="p-2 text-left w-8">
                        <input
                          type="checkbox"
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCpns(new Set(sortedCpns.map(c => c.cpnKey)));
                            } else {
                              setSelectedCpns(new Set());
                            }
                          }}
                          checked={selectedCpns.size === sortedCpns.length && sortedCpns.length > 0}
                          className="rounded"
                        />
                      </th>
                      <th className="p-2 text-left cursor-pointer hover:bg-slate-100" onClick={() => toggleSort("cpnName")}>
                        CPN名 <SortIcon columnKey="cpnName" />
                      </th>
                      <th className="p-2 text-left w-16">媒体</th>
                      <th className="p-2 text-center w-20">ON/OFF</th>
                      <th className="p-2 text-right w-24">現在予算</th>
                      <th className="p-2 text-center w-32">予算変更</th>
                      <th className="p-2 text-center w-28">スケジュール</th>
                      <th className="p-2 text-right cursor-pointer hover:bg-slate-100" onClick={() => toggleSort("profit")}>
                        利益 <SortIcon columnKey="profit" />
                      </th>
                      <th className="p-2 text-right cursor-pointer hover:bg-slate-100" onClick={() => toggleSort("roas")}>
                        ROAS <SortIcon columnKey="roas" />
                      </th>
                      <th className="p-2 text-right cursor-pointer hover:bg-slate-100" onClick={() => toggleSort("spend")}>
                        消化 <SortIcon columnKey="spend" />
                      </th>
                      <th className="p-2 text-right">MCV</th>
                      <th className="p-2 text-right cursor-pointer hover:bg-slate-100" onClick={() => toggleSort("cv")}>
                        CV <SortIcon columnKey="cv" />
                      </th>
                      <th className="p-2 text-center">赤字</th>
                      <th className="p-2 text-right cursor-pointer hover:bg-slate-100" onClick={() => toggleSort("profit7Days")}>
                        7日利益 <SortIcon columnKey="profit7Days" />
                      </th>
                      <th className="p-2 text-right">7日ROAS</th>
                      <th className="p-2 text-right">CPM</th>
                      <th className="p-2 text-right">CPC</th>
                      <th className="p-2 text-right">CTR</th>
                      <th className="p-2 text-right">CVR</th>
                      <th className="p-2 text-right">MCVR</th>
                      <th className="p-2 text-right">MCPA</th>
                      <th className="p-2 text-center">メモ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCpns.slice(0, 100).map((cpn, index) => (
                      <tr 
                        key={cpn.cpnKey} 
                        className={`border-b hover:bg-slate-50 ${selectedCpns.has(cpn.cpnKey) ? "bg-indigo-50" : ""}`}
                      >
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={selectedCpns.has(cpn.cpnKey)}
                            onClick={(e) => handleCpnCheckboxClick(index, cpn.cpnKey, e, sortedCpns.slice(0, 100))}
                            onChange={() => {}} // React controlled input
                            className="rounded cursor-pointer"
                          />
                        </td>
                        <td className="p-2 text-slate-800 break-all max-w-xs">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-violet-600 bg-violet-50 px-1 rounded">{cpn.memberName}</span>
                          </div>
                          <div className="mt-0.5">{cpn.cpnName}</div>
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <MediaLogo media={cpn.media} size={14} />
                            <span className={`px-1.5 py-0.5 rounded text-xs text-white ${getMediaBgColor(cpn.media)}`}>
                              {cpn.media}
                            </span>
                          </div>
                        </td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => handleStatusToggle(cpn)}
                            disabled={statusUpdating[cpn.cpnKey]}
                            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                              cpn.status === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                            } ${statusUpdating[cpn.cpnKey] ? "opacity-50" : ""}`}
                          >
                            {statusUpdating[cpn.cpnKey] ? "..." : cpn.status === "ACTIVE" ? (
                              <span className="flex items-center gap-1"><Power className="h-3 w-3" /> ON</span>
                            ) : (
                              <span className="flex items-center gap-1"><PowerOff className="h-3 w-3" /> OFF</span>
                            )}
                          </button>
                        </td>
                        <td className="p-2 text-right text-slate-600">
                          {cpn.dailyBudget ? `¥${parseInt(cpn.dailyBudget).toLocaleString()}` : "-"}
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              placeholder="新予算"
                              value={budgetInputs[cpn.cpnKey] || ""}
                              onChange={(e) => setBudgetInputs(prev => ({ ...prev, [cpn.cpnKey]: e.target.value }))}
                              className="w-20 px-2 py-1 text-xs border rounded"
                            />
                            <button
                              onClick={() => handleBudgetChange(cpn)}
                              disabled={budgetUpdating[cpn.cpnKey] || !budgetInputs[cpn.cpnKey]}
                              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                            >
                              {budgetUpdating[cpn.cpnKey] ? "..." : "変更"}
                            </button>
                          </div>
                        </td>
                        {/* 予算スケジュール */}
                        <td className="p-2 text-center">
                          {cpn.media === "Meta" ? (
                            (() => {
                              const formattedSchedule = scheduleCache[cpn.campaignId] 
                                ? formatScheduleInfo(scheduleCache[cpn.campaignId])
                                : null;
                              
                              if (formattedSchedule) {
                                return (
                                  <div className={`text-xs p-1 rounded ${formattedSchedule.isActive ? "bg-green-100" : "bg-purple-50"}`}>
                                    <div className="font-bold text-purple-700">{formattedSchedule.budget}</div>
                                    <div className="text-[8px] text-purple-600">{formattedSchedule.period}</div>
                                    <button
                                      onClick={() => openBudgetScheduleModal(cpn)}
                                      className="text-[9px] text-purple-600 hover:underline"
                                    >
                                      編集
                                    </button>
                                  </div>
                                );
                              }
                              return (
                                <button
                                  onClick={() => openBudgetScheduleModal(cpn)}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-md transition-colors"
                                >
                                  <Calendar className="h-3 w-3" />
                                  追加
                                </button>
                              );
                            })()
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-2 text-right">
                          <span className={`font-bold ${cpn.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            ¥{formatNumber(cpn.profit)}
                          </span>
                        </td>
                        <td className="p-2 text-right">
                          <span className={`font-bold ${getRoasColorClass(cpn.roas)}`}>
                            {cpn.roas.toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-2 text-right text-slate-600">¥{formatNumber(cpn.spend)}</td>
                        <td className="p-2 text-right text-slate-600">{cpn.mcv}</td>
                        <td className="p-2 text-right text-slate-600">{cpn.cv}</td>
                        <td className="p-2 text-center">{getConsecutiveLossDisplay(cpn)}</td>
                        <td className="p-2 text-right">
                          <span className={cpn.profit7Days >= 0 ? "text-emerald-600" : "text-red-600"}>
                            ¥{formatNumber(cpn.profit7Days)}
                          </span>
                        </td>
                        <td className="p-2 text-right">
                          <span className={cpn.roas7Days >= 100 ? "text-emerald-600" : "text-red-600"}>
                            {cpn.roas7Days.toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-2 text-right text-sm">
                          {cpn.cpm ? `¥${Math.round(cpn.cpm).toLocaleString()}` : "-"}
                        </td>
                        <td className="p-2 text-right text-sm">
                          {cpn.cpc ? `¥${Math.round(cpn.cpc).toLocaleString()}` : "-"}
                        </td>
                        <td className="p-2 text-right text-sm">
                          {cpn.ctr ? `${cpn.ctr.toFixed(2)}%` : "-"}
                        </td>
                        <td className="p-2 text-right text-sm">
                          {cpn.cvr ? `${cpn.cvr.toFixed(2)}%` : "-"}
                        </td>
                        <td className="p-2 text-right text-sm">
                          {cpn.mcvr ? `${cpn.mcvr.toFixed(2)}%` : "-"}
                        </td>
                        <td className="p-2 text-right text-sm">
                          {cpn.mcpa ? `¥${Math.round(cpn.mcpa).toLocaleString()}` : "-"}
                        </td>
                        <td className="p-2 text-center">
                          <CpnMemo cpnKey={cpn.cpnKey} cpnName={cpn.cpnName} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sortedCpns.length > 100 && (
                  <div className="p-4 text-center text-sm text-slate-500">
                    100件まで表示中（全{sortedCpns.length}件）
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 案件タブ */}
      {activeTab === "project" && (
        <div className="space-y-6">
          {/* 案件別利益グラフ */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">📊 案件別利益比較</CardTitle>
              {/* エクスポートは後で追加 */}
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={projectList.slice(0, 10)} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `¥${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value) => [`¥${Number(value).toLocaleString()}`, ""]} />
                    <Legend />
                    <Bar dataKey="profit" name="利益" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="spend" name="消化" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* 案件別テーブル */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">案件名別の利益（{projectList.length}件）</CardTitle>
              <p className="text-xs text-slate-500">案件名をクリックすると詳細を表示</p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-xs text-slate-500 border-b">
                      <th className="p-3 text-left">案件名</th>
                      <th className="p-3 text-right">消化</th>
                      <th className="p-3 text-right">MCV</th>
                      <th className="p-3 text-right">CV</th>
                      <th className="p-3 text-right">売上</th>
                      <th className="p-3 text-right">利益</th>
                      <th className="p-3 text-right">ROAS</th>
                      <th className="p-3 text-right">CPA</th>
                      <th className="p-3 text-right">CVR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectList.sort((a, b) => b.profit - a.profit).map((project) => (
                      <tr 
                        key={project.name} 
                        className="border-b hover:bg-slate-50 cursor-pointer"
                        onClick={() => setExpandedProject(expandedProject === project.name ? null : project.name)}
                      >
                        <td className="p-3 font-medium text-slate-800">
                          <span className="flex items-center gap-1">
                            {expandedProject === project.name ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            {project.name}
                          </span>
                        </td>
                        <td className="p-3 text-right text-slate-600">¥{formatNumber(project.spend)}</td>
                        <td className="p-3 text-right text-slate-600">{project.mcv}</td>
                        <td className="p-3 text-right text-slate-600">{project.cv}</td>
                        <td className="p-3 text-right text-slate-600">¥{formatNumber(project.revenue)}</td>
                        <td className="p-3 text-right">
                          <span className={`font-bold ${project.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            ¥{formatNumber(project.profit)}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <span className={`font-bold ${getRoasColorClass(project.roas)}`}>
                            {project.roas.toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-3 text-right text-slate-600">¥{formatNumber(project.cpa)}</td>
                        <td className="p-3 text-right text-slate-600">{project.cvr?.toFixed(1) || 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 変更履歴モーダル */}
      {showHistory && (
        <ChangeHistory onClose={() => setShowHistory(false)} />
      )}

      {/* ダッシュボード設定モーダル */}
      {showDashboardConfig && (
        <DashboardConfig
          onClose={() => setShowDashboardConfig(false)}
          onSave={(newWidgets) => setWidgets(newWidgets)}
        />
      )}

      {/* 予算スケジュールモーダル */}
      {showBudgetScheduleModal && budgetScheduleCpn && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-lg">予算スケジュール設定</h3>
              </div>
              <button
                onClick={() => setShowBudgetScheduleModal(false)}
                className="p-1 hover:bg-slate-100 rounded-full"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-sm font-medium text-slate-700">{budgetScheduleCpn.cpnName}</p>
                <p className="text-xs text-slate-500">{budgetScheduleCpn.memberName}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">開始日</label>
                  <input
                    type="date"
                    value={budgetScheduleForm.startDate}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setBudgetScheduleForm(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">開始時刻</label>
                  <select
                    value={budgetScheduleForm.startTime}
                    onChange={(e) => setBudgetScheduleForm(prev => ({ ...prev, startTime: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {Array.from({ length: 24 * 4 }, (_, i) => {
                      const hour = Math.floor(i / 4);
                      const minute = (i % 4) * 15;
                      const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
                      return <option key={time} value={time}>{time}</option>;
                    })}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">終了日</label>
                  <input
                    type="date"
                    value={budgetScheduleForm.endDate}
                    min={budgetScheduleForm.startDate || new Date().toISOString().split("T")[0]}
                    onChange={(e) => setBudgetScheduleForm(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">終了時刻</label>
                  <select
                    value={budgetScheduleForm.endTime}
                    onChange={(e) => setBudgetScheduleForm(prev => ({ ...prev, endTime: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {Array.from({ length: 24 * 4 }, (_, i) => {
                      const hour = Math.floor(i / 4);
                      const minute = (i % 4) * 15;
                      const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
                      return <option key={time} value={time}>{time}</option>;
                    })}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">予算額 (円)</label>
                <input
                  type="text"
                  placeholder="例: 10000"
                  value={budgetScheduleForm.budgetAmount}
                  onChange={(e) => setBudgetScheduleForm(prev => ({ ...prev, budgetAmount: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">指定期間中の追加予算額を入力</p>
              </div>

              {budgetScheduleMessage && (
                <div className={`p-3 rounded-lg text-sm ${
                  budgetScheduleMessage.type === "success" 
                    ? "bg-green-50 text-green-700" 
                    : "bg-red-50 text-red-700"
                }`}>
                  {budgetScheduleMessage.text}
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-slate-50 rounded-b-xl flex justify-end gap-2">
              <button
                onClick={() => setShowBudgetScheduleModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                キャンセル
              </button>
              <button
                onClick={submitBudgetSchedule}
                disabled={budgetScheduleSubmitting}
                className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {budgetScheduleSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    設定中...
                  </>
                ) : (
                  "スケジュールを設定"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 媒体タブ */}
      {activeTab === "media" && (
        <div className="space-y-6">
          {/* 媒体別グラフ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">📊 媒体別利益比較</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mediaChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `¥${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value) => [`¥${Number(value).toLocaleString()}`, ""]} />
                      <Bar dataKey="利益" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">🥧 消化金額シェア</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={mediaList.map(m => ({ name: m.media, value: m.spend }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                      >
                        {mediaList.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`¥${Number(value).toLocaleString()}`, "消化"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 媒体別詳細テーブル */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">媒体別の利益（{mediaList.length}件）</CardTitle>
                <p className="text-xs text-slate-500">媒体名をクリックすると詳細を表示</p>
              </div>
              {/* エクスポートは後で追加 */}
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-xs text-slate-500 border-b">
                      <th className="p-3 text-left">媒体</th>
                      <th className="p-3 text-right">消化金額</th>
                      <th className="p-3 text-right">MCV</th>
                      <th className="p-3 text-right">CV</th>
                      <th className="p-3 text-right">利益</th>
                      <th className="p-3 text-right">ROAS</th>
                      <th className="p-3 text-right">CPA</th>
                      <th className="p-3 text-right">CPM</th>
                      <th className="p-3 text-right">CPC</th>
                      <th className="p-3 text-right">MCVR</th>
                      <th className="p-3 text-right">MCPA</th>
                      <th className="p-3 text-right">CVR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mediaList.sort((a, b) => b.profit - a.profit).map((media) => (
                      <tr 
                        key={media.media} 
                        className="border-b hover:bg-slate-50 cursor-pointer"
                        onClick={() => setExpandedMedia(expandedMedia === media.media ? null : media.media)}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {expandedMedia === media.media ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            <MediaLogo media={media.media} size={20} />
                            <span className={`px-2 py-0.5 rounded text-white font-medium ${getMediaBgColor(media.media)}`}>
                              {media.media}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-right text-slate-600">¥{formatNumber(media.spend)}</td>
                        <td className="p-3 text-right text-slate-600">{media.mcv}</td>
                        <td className="p-3 text-right text-slate-600">{media.cv}</td>
                        <td className="p-3 text-right">
                          <span className={`font-bold ${media.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            ¥{formatNumber(media.profit)}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <span className={`font-bold ${getRoasColorClass(media.roas)}`}>
                            {media.roas.toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-3 text-right text-slate-600">¥{formatNumber(media.cpa)}</td>
                        <td className="p-3 text-right text-slate-600">¥{formatNumber(media.cpm || 0)}</td>
                        <td className="p-3 text-right text-slate-600">¥{formatNumber(media.cpc || 0)}</td>
                        <td className="p-3 text-right text-slate-600">{(media.cvr || 0).toFixed(2)}%</td>
                        <td className="p-3 text-right text-slate-600">¥{formatNumber(media.cpa || 0)}</td>
                        <td className="p-3 text-right text-slate-600">{(media.cvr || 0).toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
