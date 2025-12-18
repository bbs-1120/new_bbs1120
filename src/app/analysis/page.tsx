"use client";

import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { RefreshCw, TrendingUp, TrendingDown, DollarSign, Target, BarChart3, Power, Lightbulb, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from "recharts";
import { GoalProgress } from "@/components/ui/goal-progress";
import { ComparisonCard, ComparisonBadge } from "@/components/ui/comparison-card";
import { ExportButton } from "@/components/ui/export-button";
import { AlertBanner, AlertSettingsModal, AutoStopPanel } from "@/components/ui/alert-banner";
import { SearchFilter, FilterOptions } from "@/components/ui/search-filter";
import { CpnMemo } from "@/components/ui/cpn-memo";
import { DashboardConfigModal, DashboardConfigButton, getWidgetConfig, DashboardWidget } from "@/components/ui/dashboard-config";

interface SummaryData {
  spend: number;
  mcv: number;
  cv: number;
  revenue: number;
  profit: number;
  roas: number;
  cpa: number;
  cvr: number;
  monthlyProfit: number;
}

interface CpnData {
  cpnKey: string;
  cpnName: string;
  accountName: string;
  dailyBudget: string;
  budgetSchedule: string;
  profit7Days: number;
  roas7Days: number;
  consecutiveZeroMcv: number;
  consecutiveLoss: number;
  spend: number;
  mcv: number;
  cv: number;
  revenue: number;
  profit: number;
  roas: number;
  cpa: number;
  media: string;
  status: string;
  campaignId?: string;
}

interface ProjectData {
  projectName: string;
  spend: number;
  mcv: number;
  cv: number;
  revenue: number;
  profit: number;
  roas: number;
  cpa: number;
  cvr: number;
}

interface MediaData {
  media: string;
  spend: number;
  mcv: number;
  cv: number;
  revenue: number;
  profit: number;
  roas: number;
  cpa: number;
}

interface DailyTrendData {
  date: string;
  spend: number;
  revenue: number;
  profit: number;
  cv: number;
  mcv: number;
  roas: number;
  cumulativeProfit: number;
}

interface ProjectMonthlyData {
  name: string;
  spend: number;
  revenue: number;
  profit: number;
  cv: number;
  mcv: number;
  cpnCount: number;
  roas: number;
}

interface AIAdvice {
  type: "success" | "warning" | "info" | "danger";
  title: string;
  message: string;
  priority: number;
}

// グラフの色
const COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#8b5cf6", "#06b6d4"];

export default function AnalysisPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [cpnList, setCpnList] = useState<CpnData[]>([]);
  const [projectList, setProjectList] = useState<ProjectData[]>([]);
  const [mediaList, setMediaList] = useState<MediaData[]>([]);
  const [dailyTrend, setDailyTrend] = useState<DailyTrendData[]>([]);
  const [projectMonthly, setProjectMonthly] = useState<ProjectMonthlyData[]>([]);
  const [aiAdvice, setAiAdvice] = useState<AIAdvice[]>([]);
  const [gptAdvice, setGptAdvice] = useState<string | null>(null);
  const [gptAdviceLoading, setGptAdviceLoading] = useState(false);
  const [gptConfigured, setGptConfigured] = useState<boolean | null>(null);
  const [gptGeneratedAt, setGptGeneratedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "cpn" | "project" | "media">("overview");
  const [cpnSortKey, setCpnSortKey] = useState<string>("profit");
  const [cpnSortDir, setCpnSortDir] = useState<"asc" | "desc">("desc");
  const [budgetInputs, setBudgetInputs] = useState<Record<string, string>>({});
  const [budgetUpdating, setBudgetUpdating] = useState<Record<string, boolean>>({});
  const [budgetMessages, setBudgetMessages] = useState<Record<string, { type: "success" | "error"; text: string }>>({});
  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>({});
  const [statusMessages, setStatusMessages] = useState<Record<string, { type: "success" | "error"; text: string }>>({});
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [showAlertSettings, setShowAlertSettings] = useState(false);
  const [showDashboardConfig, setShowDashboardConfig] = useState(false);
  const [dashboardWidgets, setDashboardWidgets] = useState<DashboardWidget[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterOptions>({ media: [], profitRange: {}, roasRange: {}, status: [] });
  const [comparisonData, setComparisonData] = useState<{
    today: { spend: number; revenue: number; profit: number; cv: number; mcv: number; roas: number };
    yesterday: { spend: number; revenue: number; profit: number; cv: number; mcv: number; roas: number };
    lastWeek: { spend: number; revenue: number; profit: number; cv: number; mcv: number; roas: number };
    dayOverDay: { spend: number; revenue: number; profit: number; cv: number; mcv: number };
    weekOverWeek: { spend: number; revenue: number; profit: number; cv: number; mcv: number };
  } | null>(null);

  // 比較データを取得
  const fetchComparisonData = async () => {
    try {
      const response = await fetch("/api/comparison");
      const data = await response.json();
      if (data.success) {
        setComparisonData(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch comparison data:", err);
    }
  };

  // GPTアドバイスを取得
  const fetchGptAdvice = async (regenerate = false) => {
    setGptAdviceLoading(true);
    try {
      const response = await fetch("/api/ai-advice", {
        method: regenerate ? "POST" : "GET",
      });
      const data = await response.json();
      
      if (data.success) {
        setGptAdvice(data.advice);
        setGptGeneratedAt(data.generatedAt);
        setGptConfigured(true);
      } else {
        setGptConfigured(data.configured);
        if (data.configured === false) {
          setGptAdvice(null);
        }
      }
    } catch (err) {
      console.error("Failed to fetch GPT advice:", err);
    } finally {
      setGptAdviceLoading(false);
    }
  };

  const handleBudgetChange = (cpnKey: string, value: string) => {
    setBudgetInputs(prev => ({ ...prev, [cpnKey]: value }));
  };

  const handleBudgetSubmit = async (cpn: CpnData) => {
    const newBudget = budgetInputs[cpn.cpnKey];
    if (!newBudget) return;

    const budgetValue = parseInt(newBudget.replace(/[,¥]/g, ""), 10);
    if (isNaN(budgetValue) || budgetValue < 0) {
      setBudgetMessages(prev => ({ 
        ...prev, 
        [cpn.cpnKey]: { type: "error", text: "有効な金額を入力してください" } 
      }));
      return;
    }

    setBudgetUpdating(prev => ({ ...prev, [cpn.cpnKey]: true }));
    setBudgetMessages(prev => ({ ...prev, [cpn.cpnKey]: undefined as unknown as { type: "success" | "error"; text: string } }));

    try {
      const response = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cpnKey: cpn.cpnKey,
          cpnName: cpn.cpnName,
          media: cpn.media,
          campaignId: cpn.campaignId,
          accountName: cpn.accountName, // 広告アカウント名を追加
          newBudget: budgetValue,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setBudgetMessages(prev => ({ 
          ...prev, 
          [cpn.cpnKey]: { type: "success", text: `¥${budgetValue.toLocaleString()}に変更しました` } 
        }));
        setBudgetInputs(prev => ({ ...prev, [cpn.cpnKey]: "" }));
      } else {
        setBudgetMessages(prev => ({ 
          ...prev, 
          [cpn.cpnKey]: { type: "error", text: result.error || "変更に失敗しました" } 
        }));
      }
    } catch {
      setBudgetMessages(prev => ({ 
        ...prev, 
        [cpn.cpnKey]: { type: "error", text: "通信エラーが発生しました" } 
      }));
    } finally {
      setBudgetUpdating(prev => ({ ...prev, [cpn.cpnKey]: false }));
    }
  };

  const handleStatusToggle = async (cpn: CpnData) => {
    // 現在のステータスを判定（ON -> OFF、OFF -> ON）
    const currentStatus = cpn.status?.toLowerCase();
    const isCurrentlyActive = currentStatus === "active" || currentStatus === "enable" || currentStatus === "enabled" || currentStatus === "on";
    const newStatus = isCurrentlyActive ? "paused" : "active";

    setStatusUpdating(prev => ({ ...prev, [cpn.cpnKey]: true }));
    setStatusMessages(prev => ({ ...prev, [cpn.cpnKey]: undefined as unknown as { type: "success" | "error"; text: string } }));

    try {
      const response = await fetch("/api/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cpnKey: cpn.cpnKey,
          cpnName: cpn.cpnName,
          media: cpn.media,
          campaignId: cpn.campaignId,
          accountName: cpn.accountName, // 広告アカウント名を追加
          status: newStatus,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setStatusMessages(prev => ({ 
          ...prev, 
          [cpn.cpnKey]: { type: "success", text: newStatus === "active" ? "ONにしました" : "OFFにしました" } 
        }));
        // ステータスを更新
        setCpnList(prev => prev.map(c => 
          c.cpnKey === cpn.cpnKey 
            ? { ...c, status: newStatus === "active" ? "ACTIVE" : "PAUSED" }
            : c
        ));
      } else {
        setStatusMessages(prev => ({ 
          ...prev, 
          [cpn.cpnKey]: { type: "error", text: result.error || "変更に失敗しました" } 
        }));
      }
    } catch {
      setStatusMessages(prev => ({ 
        ...prev, 
        [cpn.cpnKey]: { type: "error", text: "通信エラーが発生しました" } 
      }));
    } finally {
      setStatusUpdating(prev => ({ ...prev, [cpn.cpnKey]: false }));
    }
  };

  const handleCpnSort = (key: string) => {
    if (cpnSortKey === key) {
      setCpnSortDir(cpnSortDir === "asc" ? "desc" : "asc");
    } else {
      setCpnSortKey(key);
      setCpnSortDir("desc");
    }
  };

  const getSortedCpnList = () => {
    return [...filteredCpnList].sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (cpnSortKey) {
        case "cpnName": aVal = a.cpnName; bVal = b.cpnName; break;
        case "dailyBudget": aVal = a.dailyBudget; bVal = b.dailyBudget; break;
        case "profit7Days": aVal = a.profit7Days; bVal = b.profit7Days; break;
        case "roas7Days": aVal = a.roas7Days; bVal = b.roas7Days; break;
        case "consecutiveLoss": aVal = a.consecutiveLoss; bVal = b.consecutiveLoss; break;
        case "spend": aVal = a.spend; bVal = b.spend; break;
        case "mcv": aVal = a.mcv; bVal = b.mcv; break;
        case "cv": aVal = a.cv; bVal = b.cv; break;
        case "profit": aVal = a.profit; bVal = b.profit; break;
        case "roas": aVal = a.roas; bVal = b.roas; break;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return cpnSortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return cpnSortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (cpnSortKey !== columnKey) return <span className="text-slate-300 ml-1">↕</span>;
    return <span className="text-indigo-600 ml-1">{cpnSortDir === "asc" ? "↑" : "↓"}</span>;
  };

  const STORAGE_KEY = "analysis_page_cache";
  const CACHE_DURATION = 30 * 60 * 1000; // 30分

  // ローカルキャッシュから即座にデータを読み込み
  const loadFromLocalCache = () => {
    if (typeof window === "undefined") return false;
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          setSummary(data.summary);
          setCpnList(data.cpnList || []);
          setProjectList(data.projectList || []);
          setMediaList(data.mediaList || []);
          setDailyTrend(data.dailyTrend || []);
          setProjectMonthly(data.projectMonthly || []);
          setAiAdvice(data.aiAdvice || []);
          setIsLoading(false);
          return true;
        }
      }
    } catch {}
    return false;
  };

  // ローカルキャッシュに保存
  const saveToLocalCache = (data: {
    summary: SummaryData;
    cpnList: CpnData[];
    projectList: ProjectData[];
    mediaList: MediaData[];
    dailyTrend: DailyTrendData[];
    projectMonthly: ProjectMonthlyData[];
    aiAdvice: AIAdvice[];
  }) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
    } catch {}
  };

  const fetchData = async (refresh: boolean = false) => {
    try {
      setError(null);
      // refresh=trueでキャッシュをスキップして最新データを取得
      const url = refresh ? "/api/analysis?refresh=true" : "/api/analysis";
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setSummary(data.summary);
        setCpnList(data.cpnList || []);
        setProjectList(data.projectList || []);
        setMediaList(data.mediaList || []);
        setDailyTrend(data.dailyTrend || []);
        setProjectMonthly(data.projectMonthly || []);
        setAiAdvice(data.aiAdvice || []);
        
        // ローカルキャッシュに保存
        saveToLocalCache({
          summary: data.summary,
          cpnList: data.cpnList || [],
          projectList: data.projectList || [],
          mediaList: data.mediaList || [],
          dailyTrend: data.dailyTrend || [],
          projectMonthly: data.projectMonthly || [],
          aiAdvice: data.aiAdvice || [],
        });
      } else {
        setError(data.error || "データの取得に失敗しました");
      }
    } catch (err) {
      console.error("Failed to fetch analysis data:", err);
      setError("ネットワークエラーが発生しました");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // まずローカルキャッシュから読み込み（即座に表示）
    const hasCachedData = loadFromLocalCache();
    
    // バックグラウンドで最新データを取得
    if (hasCachedData) {
      // キャッシュがある場合は静かに更新
      fetchData().catch(() => {});
    } else {
      // キャッシュがない場合はローディング表示
      fetchData();
    }
    
    fetchGptAdvice(); // GPTアドバイスも取得
    fetchComparisonData(); // 比較データも取得
    setDashboardWidgets(getWidgetConfig()); // ダッシュボード設定を読み込み
  }, []);

  // ウィジェット表示判定
  const isWidgetVisible = (widgetId: string) => {
    const widget = dashboardWidgets.find(w => w.id === widgetId);
    return widget?.visible ?? true;
  };

  // CPNリストをフィルタリング
  const filteredCpnList = cpnList.filter(cpn => {
    // 検索クエリ
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!cpn.cpnName.toLowerCase().includes(query) && 
          !cpn.accountName?.toLowerCase().includes(query)) {
        return false;
      }
    }
    // 媒体フィルター
    if (filters.media.length > 0 && !filters.media.includes(cpn.media)) {
      return false;
    }
    // 利益フィルター
    if (filters.profitRange.min !== undefined && cpn.profit < filters.profitRange.min) {
      return false;
    }
    if (filters.profitRange.max !== undefined && cpn.profit > filters.profitRange.max) {
      return false;
    }
    // ROASフィルター
    if (filters.roasRange.min !== undefined && cpn.roas < filters.roasRange.min) {
      return false;
    }
    if (filters.roasRange.max !== undefined && cpn.roas > filters.roasRange.max) {
      return false;
    }
    return true;
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData(true); // キャッシュをスキップして最新データを取得
  };

  const formatCurrency = (value: number) => {
    const sign = value < 0 ? "-" : "";
    return `${sign}¥${Math.abs(Math.round(value)).toLocaleString("ja-JP")}`;
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (isLoading) {
    return (
      <>
        <Header title="デイリーレポート" description="本日の広告パフォーマンス" />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-2" />
            <p className="text-slate-500">データを読み込み中...</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header title="デイリーレポート" description="本日の広告パフォーマンス" />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={() => fetchData()}>再試行</Button>
          </div>
        </div>
      </>
    );
  }

  // summaryがnullの場合のデフォルト値
  const displaySummary = summary || {
    spend: 0,
    mcv: 0,
    cv: 0,
    revenue: 0,
    profit: 0,
    roas: 0,
    cpa: 0,
    cvr: 0,
    monthlyProfit: 0,
  };

  return (
    <>
      <Header title="デイリーレポート" description="本日の広告パフォーマンス" />

      {/* Meta利益アラート */}
      {mediaList.length > 0 && (
        <AlertBanner 
          metaProfit={mediaList.find(m => m.media === "Meta")?.profit || 0}
          onSettingsClick={() => setShowAlertSettings(true)}
        />
      )}

      {/* アラート設定モーダル */}
      <AlertSettingsModal
        isOpen={showAlertSettings}
        onClose={() => setShowAlertSettings(false)}
        metaProfit={mediaList.find(m => m.media === "Meta")?.profit}
      />

      {/* ダッシュボード設定モーダル */}
      <DashboardConfigModal
        isOpen={showDashboardConfig}
        onClose={() => setShowDashboardConfig(false)}
        onSave={(widgets) => setDashboardWidgets(widgets)}
      />

      {/* 更新ボタン */}
      <div className="mb-4 lg:mb-6 flex items-center gap-2">
        <Button onClick={handleRefresh} loading={isRefreshing} className="flex-1 sm:flex-none">
          <RefreshCw className="mr-2 h-4 w-4" />
          データを更新
        </Button>
        <DashboardConfigButton onOpen={() => setShowDashboardConfig(true)} />
      </div>

      {/* タブナビゲーション */}
      <div className="flex gap-1 lg:gap-2 mb-4 lg:mb-6 border-b border-slate-200 overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0 scrollbar-hide">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-3 lg:px-4 py-2 text-xs lg:text-sm font-medium border-b-2 transition-colors whitespace-nowrap min-w-fit ${
            activeTab === "overview"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          📊 概要
        </button>
        <button
          onClick={() => setActiveTab("cpn")}
          className={`px-3 lg:px-4 py-2 text-xs lg:text-sm font-medium border-b-2 transition-colors whitespace-nowrap min-w-fit ${
            activeTab === "cpn"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          📋 CPN
        </button>
        <button
          onClick={() => setActiveTab("project")}
          className={`px-3 lg:px-4 py-2 text-xs lg:text-sm font-medium border-b-2 transition-colors whitespace-nowrap min-w-fit ${
            activeTab === "project"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          📁 案件
        </button>
        <button
          onClick={() => setActiveTab("media")}
          className={`px-3 lg:px-4 py-2 text-xs lg:text-sm font-medium border-b-2 transition-colors whitespace-nowrap min-w-fit ${
            activeTab === "media"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          📱 媒体
        </button>
      </div>

      {/* オーバービュー */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* 月間目標と進捗バー */}
          <GoalProgress 
            currentValue={displaySummary.monthlyProfit} 
            label="12月目標" 
          />

          {/* 前日比・前週比 比較カード */}
          {comparisonData && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4">
              <ComparisonCard
                title="本日利益"
                value={comparisonData.today.profit}
                previousValue={comparisonData.yesterday.profit}
                change={comparisonData.dayOverDay.profit}
                weekChange={comparisonData.weekOverWeek.profit}
                format="currency"
                colorClass={comparisonData.today.profit >= 0 ? "from-green-600 to-emerald-700" : "from-red-600 to-rose-700"}
              />
              <ComparisonCard
                title="消化金額"
                value={comparisonData.today.spend}
                previousValue={comparisonData.yesterday.spend}
                change={comparisonData.dayOverDay.spend}
                weekChange={comparisonData.weekOverWeek.spend}
                format="currency"
                colorClass="from-blue-600 to-indigo-700"
              />
              <ComparisonCard
                title="MCV"
                value={comparisonData.today.mcv}
                previousValue={comparisonData.yesterday.mcv}
                change={comparisonData.dayOverDay.mcv}
                weekChange={comparisonData.weekOverWeek.mcv}
                format="number"
                colorClass="from-purple-600 to-violet-700"
              />
              <ComparisonCard
                title="CV"
                value={comparisonData.today.cv}
                previousValue={comparisonData.yesterday.cv}
                change={comparisonData.dayOverDay.cv}
                weekChange={comparisonData.weekOverWeek.cv}
                format="number"
                colorClass="from-amber-600 to-orange-700"
              />
            </div>
          )}

          {/* 当日サマリーカード */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <CardContent className="pt-4 pb-4 lg:pt-6 lg:pb-6">
                <p className="text-xs lg:text-sm text-blue-100">消化金額</p>
                <p className="text-lg lg:text-2xl font-bold">{formatCurrency(displaySummary.spend)}</p>
              </CardContent>
            </Card>
            <Card className={`bg-gradient-to-br ${displaySummary.profit >= 0 ? "from-green-500 to-green-600" : "from-red-500 to-red-600"} text-white`}>
              <CardContent className="pt-4 pb-4 lg:pt-6 lg:pb-6">
                <p className={`text-xs lg:text-sm ${displaySummary.profit >= 0 ? "text-green-100" : "text-red-100"}`}>本日利益</p>
                <p className="text-lg lg:text-2xl font-bold">{formatCurrency(displaySummary.profit)}</p>
              </CardContent>
            </Card>
            <Card className={`bg-gradient-to-br ${displaySummary.monthlyProfit >= 0 ? "from-indigo-500 to-indigo-600" : "from-orange-500 to-orange-600"} text-white`}>
              <CardContent className="pt-4 pb-4 lg:pt-6 lg:pb-6">
                <p className={`text-xs lg:text-sm ${displaySummary.monthlyProfit >= 0 ? "text-indigo-100" : "text-orange-100"}`}>12月累計</p>
                <p className="text-lg lg:text-2xl font-bold">{formatCurrency(displaySummary.monthlyProfit)}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              <CardContent className="pt-4 pb-4 lg:pt-6 lg:pb-6">
                <p className="text-xs lg:text-sm text-purple-100">ROAS</p>
                <p className="text-lg lg:text-2xl font-bold">{displaySummary.roas.toFixed(1)}%</p>
              </CardContent>
            </Card>
          </div>

          {/* グラフセクション */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            {/* 日別利益推移 */}
            <Card>
              <CardHeader className="pb-2 lg:pb-4">
                <CardTitle className="text-base lg:text-lg">📈 12月 日別利益推移</CardTitle>
              </CardHeader>
              <CardContent className="px-2 lg:px-6">
                {dailyTrend.length > 0 ? (
                  <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value) => value.split("-")[2] + "日"}
                      />
                      <YAxis 
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value) => `¥${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip 
                        formatter={(value) => [`¥${(value as number)?.toLocaleString() || 0}`, ""]}
                        labelFormatter={(label) => `${label}`}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="profit" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        name="利益"
                        dot={{ fill: "#10b981", strokeWidth: 2 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="cumulativeProfit" 
                        stroke="#6366f1" 
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        name="累計利益"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[200px] lg:h-[300px] flex items-center justify-center text-slate-400">
                    データがありません
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 媒体別利益（円グラフ） */}
            <Card>
              <CardHeader className="pb-2 lg:pb-4">
                <CardTitle className="text-base lg:text-lg">📊 媒体別利益構成</CardTitle>
              </CardHeader>
              <CardContent className="px-2 lg:px-6">
                {mediaList.length > 0 ? (
                  <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={mediaList.filter(m => m.profit > 0) as unknown as Array<Record<string, unknown>>}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="profit"
                        nameKey="media"
                      >
                        {mediaList.filter(m => m.profit > 0).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`¥${(value as number)?.toLocaleString() || 0}`, "利益"]} />
                    </PieChart>
                  </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[200px] lg:h-[300px] flex items-center justify-center text-slate-400">
                    データがありません
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 案件別ランキング */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">🏆 当月案件別利益ランキング</CardTitle>
            </CardHeader>
            <CardContent>
              {projectMonthly.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(300, projectMonthly.slice(0, 10).length * 40)}>
                  <BarChart
                    layout="vertical"
                    data={projectMonthly.slice(0, 10)}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis 
                      type="number"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => `¥${(value / 1000).toFixed(0)}k`}
                    />
                    <YAxis 
                      dataKey="name" 
                      type="category"
                      tick={{ fontSize: 11 }}
                      width={150}
                    />
                    <Tooltip formatter={(value) => [`¥${(value as number)?.toLocaleString() || 0}`, "利益"]} />
                    <Bar 
                      dataKey="profit" 
                      fill="#6366f1"
                      radius={[0, 4, 4, 0]}
                    >
                      {projectMonthly.slice(0, 10).map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.profit >= 0 ? "#10b981" : "#ef4444"} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-slate-400">
                  データがありません
                </div>
              )}
            </CardContent>
          </Card>

          {/* GPT-4 運用傾向分析 */}
          <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-emerald-900">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.8956zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>
                  </svg>
                  🧠 悠太さんの運用傾向分析
                </CardTitle>
                <div className="flex items-center gap-2">
                  {gptGeneratedAt && (
                    <span className="text-xs text-emerald-600">
                      {new Date(gptGeneratedAt).toLocaleTimeString("ja-JP")} 生成
                    </span>
                  )}
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => fetchGptAdvice(true)}
                    disabled={gptAdviceLoading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${gptAdviceLoading ? "animate-spin" : ""}`} />
                    再生成
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {gptAdviceLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-emerald-600 mr-2" />
                  <span className="text-emerald-700">GPT-4が分析中...</span>
                </div>
              ) : gptConfigured === false ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                      <div className="font-semibold text-amber-900">OpenAI API キーが設定されていません</div>
                      <div className="text-sm text-amber-700 mt-1">
                        GPTアドバイス機能を使用するには、<code className="bg-amber-100 px-1 rounded">.env</code> ファイルに以下を追加してください：
                        <pre className="mt-2 p-2 bg-amber-100 rounded text-xs">OPENAI_API_KEY=sk-your-api-key</pre>
                      </div>
                    </div>
                  </div>
                </div>
              ) : gptAdvice ? (
                <div className="prose prose-emerald max-w-none">
                  <div className="whitespace-pre-wrap text-emerald-900 text-sm leading-relaxed">
                    {gptAdvice}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-emerald-600">
                  アドバイスを取得できませんでした
                </div>
              )}
            </CardContent>
          </Card>

          {/* AIアドバイス */}
          {aiAdvice.length > 0 && (
            <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-indigo-900">
                  <Lightbulb className="h-5 w-5" />
                  AIアドバイス
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {aiAdvice.slice(0, 5).map((advice, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border ${
                      advice.type === "success" ? "bg-green-50 border-green-200" :
                      advice.type === "warning" ? "bg-amber-50 border-amber-200" :
                      advice.type === "danger" ? "bg-red-50 border-red-200" :
                      "bg-blue-50 border-blue-200"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {advice.type === "success" && <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />}
                      {advice.type === "warning" && <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />}
                      {advice.type === "danger" && <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />}
                      {advice.type === "info" && <Info className="h-5 w-5 text-blue-600 mt-0.5" />}
                      <div>
                        <div className={`font-semibold ${
                          advice.type === "success" ? "text-green-900" :
                          advice.type === "warning" ? "text-amber-900" :
                          advice.type === "danger" ? "text-red-900" :
                          "text-blue-900"
                        }`}>
                          {advice.title}
                        </div>
                        <div className={`text-sm mt-1 ${
                          advice.type === "success" ? "text-green-700" :
                          advice.type === "warning" ? "text-amber-700" :
                          advice.type === "danger" ? "text-red-700" :
                          "text-blue-700"
                        }`}>
                          {advice.message}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* CPN別（旧 当日合計の一部） */}
      {activeTab === "cpn" && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-slate-900">当日のCPN合計数値（{cpnList.length}件）</h2>
          
          {/* メイン指標 */}
          <div className="grid grid-cols-3 gap-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">消化金額</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {formatCurrency(displaySummary.spend)}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">利益</p>
                    <p className={`text-2xl font-bold ${displaySummary.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(displaySummary.profit)}
                    </p>
                  </div>
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                    displaySummary.profit >= 0 ? "bg-green-100" : "bg-red-100"
                  }`}>
                    {displaySummary.profit >= 0 ? (
                      <TrendingUp className="h-6 w-6 text-green-600" />
                    ) : (
                      <TrendingDown className="h-6 w-6 text-red-600" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">ROAS</p>
                    <p className={`text-2xl font-bold ${displaySummary.roas >= 100 ? "text-green-600" : "text-red-600"}`}>
                      {formatPercent(displaySummary.roas)}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                    <BarChart3 className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 詳細指標 */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-xl p-4 border border-cyan-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-cyan-500 flex items-center justify-center">
                  <Target className="h-4 w-4 text-white" />
                </div>
                <p className="text-xs font-medium text-cyan-700">MCV</p>
              </div>
              <p className="text-2xl font-bold text-cyan-900">{displaySummary.mcv.toLocaleString()}</p>
            </div>

            <div className="bg-gradient-to-br from-violet-50 to-violet-100 rounded-xl p-4 border border-violet-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-violet-500 flex items-center justify-center">
                  <Target className="h-4 w-4 text-white" />
                </div>
                <p className="text-xs font-medium text-violet-700">CV</p>
              </div>
              <p className="text-2xl font-bold text-violet-900">{displaySummary.cv.toLocaleString()}</p>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 border border-amber-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-amber-500 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-white" />
                </div>
                <p className="text-xs font-medium text-amber-700">売上</p>
              </div>
              <p className="text-2xl font-bold text-amber-900">{formatCurrency(displaySummary.revenue)}</p>
            </div>

            <div className="bg-gradient-to-br from-rose-50 to-rose-100 rounded-xl p-4 border border-rose-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-rose-500 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-white" />
                </div>
                <p className="text-xs font-medium text-rose-700">CPA</p>
              </div>
              <p className="text-2xl font-bold text-rose-900">{formatCurrency(displaySummary.cpa)}</p>
            </div>

            <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl p-4 border border-teal-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-teal-500 flex items-center justify-center">
                  <BarChart3 className="h-4 w-4 text-white" />
                </div>
                <p className="text-xs font-medium text-teal-700">CVR</p>
              </div>
              <p className="text-2xl font-bold text-teal-900">{formatPercent(displaySummary.cvr)}</p>
            </div>

            <div className={`bg-gradient-to-br rounded-xl p-4 border ${
              displaySummary.monthlyProfit >= 0 
                ? "from-emerald-50 to-emerald-100 border-emerald-200" 
                : "from-red-50 to-red-100 border-red-200"
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                  displaySummary.monthlyProfit >= 0 ? "bg-emerald-500" : "bg-red-500"
                }`}>
                  {displaySummary.monthlyProfit >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-white" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-white" />
                  )}
                </div>
                <p className={`text-xs font-medium ${
                  displaySummary.monthlyProfit >= 0 ? "text-emerald-700" : "text-red-700"
                }`}>12月利益</p>
              </div>
              <p className={`text-2xl font-bold ${
                displaySummary.monthlyProfit >= 0 ? "text-emerald-900" : "text-red-900"
              }`}>{formatCurrency(displaySummary.monthlyProfit)}</p>
            </div>
          </div>
        </div>
      )}

      {/* ② CPN別 */}
      {activeTab === "cpn" && (
        <div className="space-y-4">
          {/* 検索・フィルター */}
          <SearchFilter
            onSearch={setSearchQuery}
            onFilter={setFilters}
            mediaOptions={["Meta", "TikTok", "Pangle", "YouTube", "LINE"]}
          />
          
          {/* 自動停止パネル */}
          <AutoStopPanel onExecute={() => handleRefresh()} />

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>CPN単位のデータ（{filteredCpnList.length}件 / {cpnList.length}件中）</CardTitle>
                <p className="text-xs text-slate-500 mt-1">※予算変更は Meta / TikTok / Pangle のみ対応</p>
              </div>
              <ExportButton
                data={cpnList.map(cpn => ({
                  CPN名: cpn.cpnName,
                  媒体: cpn.media,
                  現在予算: cpn.dailyBudget,
                  利益: cpn.profit,
                  ROAS: cpn.roas?.toFixed(1) + "%",
                  消化: cpn.spend,
                  MCV: cpn.mcv,
                  CV: cpn.cv,
                  連続赤字: cpn.consecutiveLoss,
                  "7日間利益": cpn.profit7Days,
                  "7日間ROAS": cpn.roas7Days?.toFixed(1) + "%",
                }))}
                filename="CPN_データ"
                title="CPN単位のデータ"
              />
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th 
                    className="px-3 py-2 text-left text-xs font-medium text-slate-500 cursor-pointer hover:bg-slate-100"
                    onClick={() => handleCpnSort("cpnName")}
                  >
                    CPN名<SortIcon columnKey="cpnName" />
                  </th>
                  <th className="px-2 py-2 text-center text-xs font-medium text-slate-500">媒体</th>
                  <th className="px-2 py-2 text-center text-xs font-medium text-slate-500">ON/OFF</th>
                  <th 
                    className="px-3 py-2 text-right text-xs font-medium text-slate-500 cursor-pointer hover:bg-slate-100"
                    onClick={() => handleCpnSort("dailyBudget")}
                  >
                    現在予算<SortIcon columnKey="dailyBudget" />
                  </th>
                  <th className="px-2 py-2 text-center text-xs font-medium text-slate-500">変更後予算</th>
                  <th 
                    className="px-3 py-2 text-right text-xs font-medium text-slate-500 cursor-pointer hover:bg-slate-100"
                    onClick={() => handleCpnSort("profit")}
                  >
                    利益<SortIcon columnKey="profit" />
                  </th>
                  <th 
                    className="px-3 py-2 text-right text-xs font-medium text-slate-500 cursor-pointer hover:bg-slate-100"
                    onClick={() => handleCpnSort("roas")}
                  >
                    ROAS<SortIcon columnKey="roas" />
                  </th>
                  <th 
                    className="px-3 py-2 text-right text-xs font-medium text-slate-500 cursor-pointer hover:bg-slate-100"
                    onClick={() => handleCpnSort("spend")}
                  >
                    消化<SortIcon columnKey="spend" />
                  </th>
                  <th 
                    className="px-3 py-2 text-right text-xs font-medium text-slate-500 cursor-pointer hover:bg-slate-100"
                    onClick={() => handleCpnSort("mcv")}
                  >
                    MCV<SortIcon columnKey="mcv" />
                  </th>
                  <th 
                    className="px-3 py-2 text-right text-xs font-medium text-slate-500 cursor-pointer hover:bg-slate-100"
                    onClick={() => handleCpnSort("cv")}
                  >
                    CV<SortIcon columnKey="cv" />
                  </th>
                  <th 
                    className="px-3 py-2 text-center text-xs font-medium text-slate-500 cursor-pointer hover:bg-slate-100"
                    onClick={() => handleCpnSort("consecutiveLoss")}
                  >
                    赤字日数<SortIcon columnKey="consecutiveLoss" />
                  </th>
                  <th 
                    className="px-3 py-2 text-right text-xs font-medium text-slate-500 cursor-pointer hover:bg-slate-100"
                    onClick={() => handleCpnSort("profit7Days")}
                  >
                    7日利益<SortIcon columnKey="profit7Days" />
                  </th>
                  <th 
                    className="px-3 py-2 text-right text-xs font-medium text-slate-500 cursor-pointer hover:bg-slate-100"
                    onClick={() => handleCpnSort("roas7Days")}
                  >
                    7日ROAS<SortIcon columnKey="roas7Days" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {getSortedCpnList().map((cpn, index) => {
                  const isTargetMedia = ["Meta", "TikTok", "Pangle"].includes(cpn.media);
                  const message = budgetMessages[cpn.cpnKey];
                  
                  return (
                  <tr key={index} className="hover:bg-slate-50">
                    {/* CPN名 */}
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-900 text-xs leading-relaxed">{cpn.cpnName}</p>
                    </td>
                    {/* 媒体 */}
                    <td className="px-2 py-2 text-center whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        cpn.media === "Meta" ? "bg-blue-100 text-blue-700" :
                        cpn.media === "TikTok" ? "bg-pink-100 text-pink-700" :
                        cpn.media === "Pangle" ? "bg-orange-100 text-orange-700" :
                        cpn.media === "YouTube" ? "bg-red-100 text-red-700" :
                        cpn.media === "LINE" ? "bg-green-100 text-green-700" :
                        "bg-slate-100 text-slate-700"
                      }`}>
                        {cpn.media || "-"}
                      </span>
                    </td>
                    {/* ON/OFF */}
                    <td className="px-2 py-2 text-center whitespace-nowrap">
                      {isTargetMedia ? (() => {
                        const currentStatus = cpn.status?.toLowerCase() || "";
                        const isActive = currentStatus === "active" || currentStatus === "enable" || currentStatus === "enabled" || currentStatus === "on";
                        const statusMessage = statusMessages[cpn.cpnKey];
                        
                        return (
                          <div className="flex flex-col items-center gap-1">
                            <button
                              onClick={() => handleStatusToggle(cpn)}
                              disabled={statusUpdating[cpn.cpnKey]}
                              className={`relative inline-flex items-center justify-center w-16 h-7 rounded-full transition-colors ${
                                statusUpdating[cpn.cpnKey] 
                                  ? "bg-slate-200 cursor-wait" 
                                  : isActive 
                                    ? "bg-green-500 hover:bg-green-600" 
                                    : "bg-slate-300 hover:bg-slate-400"
                              }`}
                              title={isActive ? "クリックでOFF" : "クリックでON"}
                            >
                              {statusUpdating[cpn.cpnKey] ? (
                                <RefreshCw className="h-3 w-3 text-slate-500 animate-spin" />
                              ) : (
                                <>
                                  <span className={`absolute left-1 transition-opacity ${isActive ? "opacity-100" : "opacity-0"}`}>
                                    <Power className="h-4 w-4 text-white" />
                                  </span>
                                  <span className={`text-xs font-bold ${isActive ? "text-white ml-4" : "text-slate-600 mr-2"}`}>
                                    {isActive ? "ON" : "OFF"}
                                  </span>
                                  <span className={`absolute right-1 transition-opacity ${isActive ? "opacity-0" : "opacity-100"}`}>
                                    <Power className="h-4 w-4 text-slate-500" />
                                  </span>
                                </>
                              )}
                            </button>
                            {statusMessage && (
                              <span className={`text-xs ${statusMessage.type === "success" ? "text-green-600" : "text-red-600"}`}>
                                {statusMessage.text}
                              </span>
                            )}
                          </div>
                        );
                      })() : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    {/* 現在予算 */}
                    <td className="px-3 py-2 text-right text-slate-600 whitespace-nowrap">{cpn.dailyBudget}</td>
                    {/* 変更後予算 */}
                    <td className="px-2 py-2">
                      {isTargetMedia ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            placeholder="¥"
                            value={budgetInputs[cpn.cpnKey] || ""}
                            onChange={(e) => handleBudgetChange(cpn.cpnKey, e.target.value)}
                            className="w-24 px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <button
                            onClick={() => handleBudgetSubmit(cpn)}
                            disabled={budgetUpdating[cpn.cpnKey] || !budgetInputs[cpn.cpnKey]}
                            className="px-2 py-1 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed whitespace-nowrap"
                          >
                            {budgetUpdating[cpn.cpnKey] ? "..." : "変更"}
                          </button>
                          {message && (
                            <span className={`text-xs ${message.type === "success" ? "text-green-600" : "text-red-600"}`}>
                              {message.text}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    {/* 利益 */}
                    <td className={`px-3 py-2 text-right font-medium whitespace-nowrap ${cpn.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(cpn.profit)}
                    </td>
                    {/* ROAS */}
                    <td className="px-3 py-2 text-right text-slate-600 whitespace-nowrap">{formatPercent(cpn.roas)}</td>
                    {/* 消化 */}
                    <td className="px-3 py-2 text-right text-slate-600 whitespace-nowrap">{formatCurrency(cpn.spend)}</td>
                    {/* MCV */}
                    <td className="px-3 py-2 text-right text-slate-600 whitespace-nowrap">{cpn.mcv.toLocaleString()}</td>
                    {/* CV */}
                    <td className="px-3 py-2 text-right text-slate-600 whitespace-nowrap">{cpn.cv}</td>
                    {/* 赤字日数 */}
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      {cpn.profit >= 0 ? (
                        <span className="text-green-600 font-medium text-xs">当日プラス</span>
                      ) : cpn.consecutiveLoss === 1 ? (
                        <span className="text-red-600 font-medium text-xs">当日マイナス</span>
                      ) : cpn.consecutiveLoss >= 2 ? (
                        <span className="text-red-600 font-medium text-xs">マイナス{cpn.consecutiveLoss}日</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    {/* 7日利益 */}
                    <td className={`px-3 py-2 text-right font-medium whitespace-nowrap ${cpn.profit7Days >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(cpn.profit7Days)}
                    </td>
                    {/* 7日ROAS */}
                    <td className="px-3 py-2 text-right text-slate-600 whitespace-nowrap">{formatPercent(cpn.roas7Days)}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        </div>
      )}

      {/* ③ 案件別 */}
      {activeTab === "project" && (
        <div className="space-y-6">
          {/* 案件別利益グラフ */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>📊 案件別利益比較</CardTitle>
                <ExportButton
                  data={projectList.map(p => ({
                    案件名: p.projectName,
                    消化: p.spend,
                    MCV: p.mcv,
                    CV: p.cv,
                    売上: p.revenue,
                    利益: p.profit,
                    "ROAS%": p.roas?.toFixed(1),
                    "CPA": p.cpa,
                    "CVR%": p.cvr?.toFixed(1),
                  }))}
                  filename="案件別データ"
                  title="案件別パフォーマンス"
                />
              </div>
            </CardHeader>
            <CardContent>
              {projectList.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={projectList.slice(0, 10)}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="projectName" 
                      tick={{ fontSize: 10 }}
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis 
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => `¥${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      formatter={(value, name) => [
                        `¥${(value as number)?.toLocaleString() || 0}`,
                        name === "profit" ? "利益" : name === "spend" ? "消化" : String(name)
                      ]}
                    />
                    <Legend />
                    <Bar dataKey="spend" fill="#94a3b8" name="消化" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="profit" name="利益" radius={[4, 4, 0, 0]}>
                      {projectList.slice(0, 10).map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.profit >= 0 ? "#10b981" : "#ef4444"} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-slate-400">
                  データがありません
                </div>
              )}
            </CardContent>
          </Card>

          {/* 案件一覧（クリックで詳細） */}
          <Card>
            <CardHeader>
              <CardTitle>案件名別の利益（{projectList.length}件）</CardTitle>
              <p className="text-sm text-slate-500 mt-1">案件名をクリックすると詳細を表示</p>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">案件名</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">消化金額</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">MCV</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">CV</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">売上</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">利益</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">ROAS</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">CPA</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">CVR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {projectList.map((project, index) => (
                    <>
                      <tr 
                        key={index} 
                        className={`hover:bg-slate-50 cursor-pointer transition-colors ${selectedProject === project.projectName ? "bg-indigo-50" : ""}`}
                        onClick={() => setSelectedProject(selectedProject === project.projectName ? null : project.projectName)}
                      >
                        <td className="px-4 py-2 font-medium text-slate-900">
                          <div className="flex items-center gap-2">
                            <span className={`transition-transform ${selectedProject === project.projectName ? "rotate-90" : ""}`}>▶</span>
                            {project.projectName}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right text-slate-600">{formatCurrency(project.spend)}</td>
                        <td className="px-4 py-2 text-right text-slate-600">{project.mcv}</td>
                        <td className="px-4 py-2 text-right text-slate-600">{project.cv}</td>
                        <td className="px-4 py-2 text-right text-slate-600">{formatCurrency(project.revenue)}</td>
                        <td className={`px-4 py-2 text-right font-medium ${project.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {formatCurrency(project.profit)}
                        </td>
                        <td className="px-4 py-2 text-right text-slate-600">{formatPercent(project.roas)}</td>
                        <td className="px-4 py-2 text-right text-slate-600">{formatCurrency(project.cpa)}</td>
                        <td className="px-4 py-2 text-right text-slate-600">{formatPercent(project.cvr)}</td>
                      </tr>
                      {/* 詳細パネル */}
                      {selectedProject === project.projectName && (
                        <tr key={`${index}-detail`}>
                          <td colSpan={9} className="px-4 py-4 bg-slate-50">
                            <div className="space-y-4">
                              {/* 案件の当月推移グラフ */}
                              <div className="bg-white rounded-lg p-4 border border-slate-200">
                                <h4 className="text-sm font-semibold text-slate-700 mb-3">
                                  📈 「{project.projectName}」の当月利益推移
                                </h4>
                                {projectMonthly.find(p => p.name === project.projectName) ? (
                                  <div className="grid grid-cols-4 gap-4 mb-4">
                                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                                      <div className="text-lg font-bold text-blue-700">{formatCurrency(project.spend)}</div>
                                      <div className="text-xs text-blue-600">消化金額</div>
                                    </div>
                                    <div className={`text-center p-3 rounded-lg ${project.profit >= 0 ? "bg-green-50" : "bg-red-50"}`}>
                                      <div className={`text-lg font-bold ${project.profit >= 0 ? "text-green-700" : "text-red-700"}`}>
                                        {formatCurrency(project.profit)}
                                      </div>
                                      <div className={`text-xs ${project.profit >= 0 ? "text-green-600" : "text-red-600"}`}>利益</div>
                                    </div>
                                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                                      <div className="text-lg font-bold text-purple-700">{formatPercent(project.roas)}</div>
                                      <div className="text-xs text-purple-600">ROAS</div>
                                    </div>
                                    <div className="text-center p-3 bg-amber-50 rounded-lg">
                                      <div className="text-lg font-bold text-amber-700">{project.cv}件</div>
                                      <div className="text-xs text-amber-600">CV</div>
                                    </div>
                                  </div>
                                ) : null}
                                
                                {/* この案件のCPN一覧 */}
                                <div className="mt-4">
                                  <h5 className="text-xs font-medium text-slate-500 mb-2">この案件のCPN一覧</h5>
                                  <div className="max-h-48 overflow-y-auto">
                                    <table className="w-full text-xs">
                                      <thead className="bg-slate-100 sticky top-0">
                                        <tr>
                                          <th className="px-2 py-1 text-left">CPN名</th>
                                          <th className="px-2 py-1 text-right">消化</th>
                                          <th className="px-2 py-1 text-right">利益</th>
                                          <th className="px-2 py-1 text-right">ROAS</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {cpnList
                                          .filter(cpn => {
                                            // CPN名から案件名を抽出して一致するものをフィルタ
                                            const cpnParts = cpn.cpnName.split("_");
                                            // 案件名は通常3番目の要素（例：新規グロース部_悠太_TCB-ニキビ女性_...）
                                            const cpnProject = cpnParts[2] || "";
                                            return cpnProject === project.projectName || 
                                                   cpn.cpnName.includes(project.projectName);
                                          })
                                          .slice(0, 20)
                                          .map((cpn, cpnIdx) => (
                                            <tr key={cpnIdx} className="hover:bg-slate-50">
                                              <td className="px-2 py-1 text-slate-700 truncate max-w-xs" title={cpn.cpnName}>
                                                {cpn.cpnName.length > 50 ? cpn.cpnName.substring(0, 50) + "..." : cpn.cpnName}
                                              </td>
                                              <td className="px-2 py-1 text-right text-slate-600">{formatCurrency(cpn.spend)}</td>
                                              <td className={`px-2 py-1 text-right font-medium ${cpn.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                                {formatCurrency(cpn.profit)}
                                              </td>
                                              <td className="px-2 py-1 text-right text-slate-600">{formatPercent(cpn.roas)}</td>
                                            </tr>
                                          ))
                                        }
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ④ 媒体別 */}
      {activeTab === "media" && (
        <div className="space-y-6">
          {/* エクスポートボタン（右上に配置） */}
          <div className="flex justify-end">
            <ExportButton
              data={mediaList.map(m => ({
                媒体: m.media,
                消化: m.spend,
                MCV: m.mcv,
                CV: m.cv,
                売上: m.revenue,
                利益: m.profit,
                "ROAS%": m.roas?.toFixed(1),
                CPA: m.cpa,
              }))}
              filename="媒体別データ"
              title="媒体別パフォーマンス"
            />
          </div>
          
          {/* 媒体別グラフ（横並び） */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 利益比較グラフ */}
            <Card>
              <CardHeader>
                <CardTitle>📊 媒体別利益比較</CardTitle>
              </CardHeader>
              <CardContent>
                {mediaList.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={mediaList} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="media" tick={{ fontSize: 12 }} />
                      <YAxis 
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value) => `¥${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip 
                        formatter={(value) => [`¥${(value as number)?.toLocaleString() || 0}`, "利益"]}
                      />
                      <Bar dataKey="profit" name="利益" radius={[4, 4, 0, 0]}>
                        {mediaList.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={
                              entry.media === "Meta" ? "#3b82f6" :
                              entry.media === "TikTok" ? "#ec4899" :
                              entry.media === "Pangle" ? "#f97316" :
                              entry.media === "YouTube" ? "#ef4444" :
                              entry.media === "LINE" ? "#22c55e" :
                              "#6366f1"
                            } 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-slate-400">
                    データがありません
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 円グラフ - 消化金額シェア */}
            <Card>
              <CardHeader>
                <CardTitle>🥧 消化金額シェア</CardTitle>
              </CardHeader>
              <CardContent>
                {mediaList.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={mediaList.filter(m => m.spend > 0) as unknown as Array<Record<string, unknown>>}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`}
                        outerRadius={90}
                        fill="#8884d8"
                        dataKey="spend"
                        nameKey="media"
                      >
                        {mediaList.filter(m => m.spend > 0).map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={
                              entry.media === "Meta" ? "#3b82f6" :
                              entry.media === "TikTok" ? "#ec4899" :
                              entry.media === "Pangle" ? "#f97316" :
                              entry.media === "YouTube" ? "#ef4444" :
                              entry.media === "LINE" ? "#22c55e" :
                              COLORS[index % COLORS.length]
                            } 
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`¥${(value as number)?.toLocaleString() || 0}`, "消化金額"]} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-slate-400">
                    データがありません
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 媒体一覧（クリックで詳細） */}
          <Card>
            <CardHeader>
              <CardTitle>媒体別の利益（{mediaList.length}件）</CardTitle>
              <p className="text-sm text-slate-500 mt-1">媒体名をクリックすると詳細を表示</p>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">媒体</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">消化金額</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">MCV</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">CV</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">売上</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">利益</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">ROAS</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">CPA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {mediaList.map((media, index) => (
                    <>
                      <tr 
                        key={index} 
                        className={`hover:bg-slate-50 cursor-pointer transition-colors ${selectedMedia === media.media ? "bg-indigo-50" : ""}`}
                        onClick={() => setSelectedMedia(selectedMedia === media.media ? null : media.media)}
                      >
                        <td className="px-4 py-2 font-medium text-slate-900">
                          <div className="flex items-center gap-2">
                            <span className={`transition-transform ${selectedMedia === media.media ? "rotate-90" : ""}`}>▶</span>
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                              media.media === "Meta" ? "bg-blue-100 text-blue-700" :
                              media.media === "TikTok" ? "bg-pink-100 text-pink-700" :
                              media.media === "Pangle" ? "bg-orange-100 text-orange-700" :
                              media.media === "YouTube" ? "bg-red-100 text-red-700" :
                              media.media === "LINE" ? "bg-green-100 text-green-700" :
                              "bg-slate-100 text-slate-700"
                            }`}>
                              {media.media === "Meta" ? "📘" : 
                               media.media === "TikTok" ? "🎵" : 
                               media.media === "Pangle" ? "🔶" : 
                               media.media === "YouTube" ? "▶️" : 
                               media.media === "LINE" ? "💬" : "📱"}
                              {media.media}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right text-slate-600">{formatCurrency(media.spend)}</td>
                        <td className="px-4 py-2 text-right text-slate-600">{media.mcv}</td>
                        <td className="px-4 py-2 text-right text-slate-600">{media.cv}</td>
                        <td className="px-4 py-2 text-right text-slate-600">{formatCurrency(media.revenue)}</td>
                        <td className={`px-4 py-2 text-right font-medium ${media.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {formatCurrency(media.profit)}
                        </td>
                        <td className="px-4 py-2 text-right text-slate-600">{formatPercent(media.roas)}</td>
                        <td className="px-4 py-2 text-right text-slate-600">{formatCurrency(media.cpa)}</td>
                      </tr>
                      {/* 詳細パネル */}
                      {selectedMedia === media.media && (
                        <tr key={`${index}-detail`}>
                          <td colSpan={8} className="px-4 py-4 bg-slate-50">
                            <div className="space-y-4">
                              <div className="bg-white rounded-lg p-4 border border-slate-200">
                                <h4 className="text-sm font-semibold text-slate-700 mb-3">
                                  📈 「{media.media}」のパフォーマンス詳細
                                </h4>
                                
                                {/* サマリーカード */}
                                <div className="grid grid-cols-4 gap-4 mb-4">
                                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                                    <div className="text-lg font-bold text-blue-700">{formatCurrency(media.spend)}</div>
                                    <div className="text-xs text-blue-600">消化金額</div>
                                  </div>
                                  <div className={`text-center p-3 rounded-lg ${media.profit >= 0 ? "bg-green-50" : "bg-red-50"}`}>
                                    <div className={`text-lg font-bold ${media.profit >= 0 ? "text-green-700" : "text-red-700"}`}>
                                      {formatCurrency(media.profit)}
                                    </div>
                                    <div className={`text-xs ${media.profit >= 0 ? "text-green-600" : "text-red-600"}`}>利益</div>
                                  </div>
                                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                                    <div className="text-lg font-bold text-purple-700">{formatPercent(media.roas)}</div>
                                    <div className="text-xs text-purple-600">ROAS</div>
                                  </div>
                                  <div className="text-center p-3 bg-amber-50 rounded-lg">
                                    <div className="text-lg font-bold text-amber-700">{media.cv}件</div>
                                    <div className="text-xs text-amber-600">CV</div>
                                  </div>
                                </div>
                                
                                {/* この媒体のCPN一覧 */}
                                <div className="mt-4">
                                  <h5 className="text-xs font-medium text-slate-500 mb-2">この媒体のCPN一覧（TOP20）</h5>
                                  <div className="max-h-64 overflow-y-auto">
                                    <table className="w-full text-xs">
                                      <thead className="bg-slate-100 sticky top-0">
                                        <tr>
                                          <th className="px-2 py-1 text-left">CPN名</th>
                                          <th className="px-2 py-1 text-right">消化</th>
                                          <th className="px-2 py-1 text-right">利益</th>
                                          <th className="px-2 py-1 text-right">ROAS</th>
                                          <th className="px-2 py-1 text-right">MCV</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {cpnList
                                          .filter(cpn => cpn.media === media.media)
                                          .sort((a, b) => b.profit - a.profit)
                                          .slice(0, 20)
                                          .map((cpn, cpnIdx) => (
                                            <tr key={cpnIdx} className="hover:bg-slate-50">
                                              <td className="px-2 py-1 text-slate-700 truncate max-w-xs" title={cpn.cpnName}>
                                                {cpn.cpnName.length > 60 ? cpn.cpnName.substring(0, 60) + "..." : cpn.cpnName}
                                              </td>
                                              <td className="px-2 py-1 text-right text-slate-600">{formatCurrency(cpn.spend)}</td>
                                              <td className={`px-2 py-1 text-right font-medium ${cpn.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                                {formatCurrency(cpn.profit)}
                                              </td>
                                              <td className="px-2 py-1 text-right text-slate-600">{formatPercent(cpn.roas)}</td>
                                              <td className="px-2 py-1 text-right text-slate-600">{cpn.mcv}</td>
                                            </tr>
                                          ))
                                        }
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

