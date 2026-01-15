"use client";

import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useMemo } from "react";
import { RefreshCw, TrendingUp, TrendingDown, DollarSign, Target, BarChart3, Power, Lightbulb, AlertTriangle, CheckCircle, Info, History, Calendar, X } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from "recharts";
import { GoalProgress } from "@/components/ui/goal-progress";
import { ExportButton } from "@/components/ui/export-button";
import { AlertBanner, AlertSettingsModal, AutoStopPanel } from "@/components/ui/alert-banner";
import { SearchFilter, FilterOptions } from "@/components/ui/search-filter";
import { CpnMemo } from "@/components/ui/cpn-memo";
import { DashboardConfigModal, DashboardConfigButton, getWidgetConfig, DashboardWidget } from "@/components/ui/dashboard-config";
import { addChangeRecord, ChangeHistory } from "@/components/ui/change-history";
import { AnalysisPageSkeleton } from "@/components/ui/skeleton";
import { getRoasColorClass } from "@/lib/utils";

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
  profit40Days?: number;  // 40日間利益
  roas40Days?: number;    // 40日間ROAS
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

// ステータスオーバーライドをサーバーに保存
async function saveStatusOverrideToServer(cpnKey: string, cpnName: string, media: string, status: string) {
  try {
    await fetch("/api/status-override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cpnKey, cpnName, media, status }),
    });
  } catch (error) {
    console.error("Failed to save status override:", error);
  }
}

// CPNリストにステータスオーバーライドを適用
function applyStatusOverrides(cpnList: CpnData[], overrides: Record<string, string>): CpnData[] {
  return cpnList.map(cpn => {
    if (overrides[cpn.cpnKey]) {
      return { ...cpn, status: overrides[cpn.cpnKey] };
    }
    return cpn;
  });
}

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
  const [showChangeHistory, setShowChangeHistory] = useState(false);
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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [nextRefreshIn, setNextRefreshIn] = useState(5 * 60); // 5分に変更
  
  // 予算スケジュールモーダル用
  const [showBudgetScheduleModal, setShowBudgetScheduleModal] = useState(false);
  const [budgetScheduleCpn, setBudgetScheduleCpn] = useState<CpnData | null>(null);
  const [budgetScheduleForm, setBudgetScheduleForm] = useState({
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    budgetAmount: "",
  });
  const [budgetScheduleSubmitting, setBudgetScheduleSubmitting] = useState(false);
  const [budgetScheduleMessage, setBudgetScheduleMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // モバイル用ページネーション
  const [mobilePage, setMobilePage] = useState(1);
  const MOBILE_PAGE_SIZE = 10;
  
  // Pull-to-refresh
  const [isPulling, setIsPulling] = useState(false);

  // 現在の月を動的に取得
  const currentMonth = useMemo(() => {
    const now = new Date();
    return now.toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "numeric",
    }).replace("月", "");
  }, []);

  // 予算スケジュールモーダルを開く
  const openBudgetScheduleModal = (cpn: CpnData) => {
    // デフォルト値を設定（現在時刻から次の15分刻みを開始時刻に）
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // 現在時刻から次の15分刻みを計算
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const nextSlotMinutes = Math.ceil(currentMinutes / 15) * 15 + 15; // 次の15分刻み（余裕を持たせる）
    const startHour = Math.floor(nextSlotMinutes / 60) % 24;
    const startMinute = nextSlotMinutes % 60;
    const defaultStartTime = `${startHour.toString().padStart(2, "0")}:${startMinute.toString().padStart(2, "0")}`;
    
    // 開始時刻が24時を超える場合は翌日に
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
          cpnName: budgetScheduleCpn.cpnName,
          campaignId: budgetScheduleCpn.campaignId,
          accountName: budgetScheduleCpn.accountName,
          startDateTime,
          endDateTime,
          budgetAmount: amount,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setBudgetScheduleMessage({ type: "success", text: "予算スケジュールを設定しました" });
        // 成功したら3秒後にモーダルを閉じる
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
        // 変更履歴を追加
        addChangeRecord({
          type: "budget",
          cpnName: cpn.cpnName,
          media: cpn.media,
          oldValue: cpn.dailyBudget,
          newValue: budgetValue,
          success: true,
        });
      } else {
        setBudgetMessages(prev => ({ 
          ...prev, 
          [cpn.cpnKey]: { type: "error", text: result.error || "変更に失敗しました" } 
        }));
        // 失敗も記録
        addChangeRecord({
          type: "budget",
          cpnName: cpn.cpnName,
          media: cpn.media,
          oldValue: cpn.dailyBudget,
          newValue: budgetValue,
          success: false,
        });
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
        const newStatusValue = newStatus === "active" ? "ACTIVE" : "PAUSED";
        setStatusMessages(prev => ({ 
          ...prev, 
          [cpn.cpnKey]: { type: "success", text: newStatus === "active" ? "ONにしました" : "OFFにしました" } 
        }));
        // ステータスを更新
        setCpnList(prev => prev.map(c => 
          c.cpnKey === cpn.cpnKey 
            ? { ...c, status: newStatusValue }
            : c
        ));
        // ステータス変更をサーバーに保存（デバイス間共有）
        saveStatusOverrideToServer(cpn.cpnKey, cpn.cpnName, cpn.media, newStatusValue);
        // 変更履歴を追加
        addChangeRecord({
          type: "status",
          cpnName: cpn.cpnName,
          media: cpn.media,
          oldValue: isCurrentlyActive ? "ON" : "OFF",
          newValue: newStatus === "active" ? "ON" : "OFF",
          success: true,
        });
      } else {
        setStatusMessages(prev => ({ 
          ...prev, 
          [cpn.cpnKey]: { type: "error", text: result.error || "変更に失敗しました" } 
        }));
        // 失敗も記録
        addChangeRecord({
          type: "status",
          cpnName: cpn.cpnName,
          media: cpn.media,
          oldValue: isCurrentlyActive ? "ON" : "OFF",
          newValue: newStatus === "active" ? "ON" : "OFF",
          success: false,
        });
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
  const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2時間（パフォーマンス改善）

  // ローカルキャッシュから即座にデータを読み込み
  const loadFromLocalCache = async () => {
    if (typeof window === "undefined") return false;
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          // サーバーからステータスオーバーライドを取得
          let statusOverrides: Record<string, string> = {};
          try {
            const overrideResponse = await fetch("/api/status-override");
            const overrideData = await overrideResponse.json();
            statusOverrides = overrideData.overrides || {};
          } catch {}
          
          setSummary(data.summary);
          setCpnList(applyStatusOverrides(data.cpnList || [], statusOverrides));
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
      
      // タイムアウト付きfetch（30秒）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      // データとステータスオーバーライドを並列取得
      const [response, overrideResponse] = await Promise.all([
        fetch(url, { 
          signal: controller.signal,
          cache: refresh ? "no-store" : "default",
        }),
        fetch("/api/status-override", { signal: controller.signal }).catch(() => null),
      ]);
      clearTimeout(timeoutId);
      
      const data = await response.json();
      const overrideData = overrideResponse ? await overrideResponse.json().catch(() => ({ overrides: {} })) : { overrides: {} };
      const statusOverrides = overrideData.overrides || {};

      if (data.success) {
        setSummary(data.summary);
        setCpnList(applyStatusOverrides(data.cpnList || [], statusOverrides));
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
        
        // 最終更新時刻を記録
        setLastUpdated(new Date());
        setNextRefreshIn(10 * 60); // 10分（パフォーマンス向上）
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
    setDashboardWidgets(getWidgetConfig()); // ダッシュボード設定を読み込み
    
    // すべてのデータを並列で取得（高速化）
    const loadAllData = async () => {
      // まずローカルキャッシュから読み込み（即座に表示）
      const hasCachedData = await loadFromLocalCache();
      
      if (hasCachedData) {
        // キャッシュがある場合は1秒後にバックグラウンド更新（体感速度UP）
        setTimeout(() => {
          fetchData().catch(() => {});
        }, 1000);
        // GPTと比較データは非同期で取得
        setTimeout(() => {
          fetchGptAdvice();
          fetchComparisonData();
        }, 2000);
      } else {
        // キャッシュがない場合は即座に取得
      await Promise.all([
          fetchData(),
        fetchGptAdvice(),
        fetchComparisonData(),
      ]);
      }
    };
    
    loadAllData();
  }, []);

  // 5分ごとの自動更新
  useEffect(() => {
    if (!autoRefreshEnabled) return;

    // カウントダウン用のインターバル（1秒ごと）
    const countdownInterval = setInterval(() => {
      setNextRefreshIn(prev => {
        if (prev <= 1) {
          // 0になったらデータを更新
          fetchData(true);
          return 5 * 60; // 5分にリセット
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [autoRefreshEnabled]);

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

  // メンテナンス時間チェック（0:00〜0:30）
  const isMaintenanceTime = () => {
    const now = new Date();
    const jstHour = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" })).getHours();
    const jstMinute = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" })).getMinutes();
    return jstHour === 0 && jstMinute < 30;
  };

  if (isMaintenanceTime()) {
    return (
      <>
        <Header title="デイリーレポート" description="本日の広告パフォーマンス" />
        <div className="flex items-center justify-center h-64">
          <div className="text-center p-8 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 shadow-lg max-w-md">
            <div className="text-5xl mb-4">🔧</div>
            <h2 className="text-xl font-bold text-amber-800 mb-2">メンテナンス中</h2>
            <p className="text-amber-700 mb-4">
              毎日 0:00〜0:30 の間はデータ更新のため<br />
              一時的にご利用いただけません。
            </p>
            <div className="text-sm text-amber-600 bg-amber-100 px-4 py-2 rounded-lg">
              0:30以降に再度アクセスしてください
            </div>
          </div>
        </div>
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <Header title="デイリーレポート" description="本日の広告パフォーマンス" />
        <AnalysisPageSkeleton />
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

      {/* 自動更新バー - モバイル対応 */}
      <div className="mb-4 p-2 lg:p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
        {/* モバイル: 縦積み / デスクトップ: 横並び */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
          {/* ステータス表示 */}
          <div className="flex flex-wrap items-center gap-2 lg:gap-4 text-xs lg:text-sm">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${autoRefreshEnabled ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
              <span className="text-slate-600">
                {autoRefreshEnabled ? "自動更新ON" : "OFF"}
              </span>
            </div>
            {lastUpdated && (
              <span className="text-slate-500">
                更新: {lastUpdated.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            {autoRefreshEnabled && (
              <span className="text-slate-500">
                次回: {Math.floor(nextRefreshIn / 60)}:{String(nextRefreshIn % 60).padStart(2, '0')}
              </span>
            )}
          </div>
          {/* ボタン */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
              className={`px-4 py-2 text-sm font-bold rounded-xl transition-colors ${
                autoRefreshEnabled 
                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" 
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {autoRefreshEnabled ? "自動更新 停止" : "自動更新 開始"}
            </button>
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => handleRefresh()}
              disabled={isRefreshing}
              className="px-4 py-2 text-sm font-bold rounded-xl"
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />
              更新
            </Button>
          </div>
        </div>
      </div>

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

      {/* 設定ボタン */}
      <div className="mb-4 lg:mb-6 flex justify-end">
        <DashboardConfigButton onOpen={() => setShowDashboardConfig(true)} />
      </div>

      {/* タブナビゲーション - モバイル最適化 */}
      <div className="lg:hidden mb-4 -mx-4 px-4">
        <div className="flex bg-slate-100 rounded-2xl p-1.5 gap-1">
          {[
            { key: "overview", emoji: "📊", label: "概要" },
            { key: "cpn", emoji: "📋", label: "CPN" },
            { key: "project", emoji: "📁", label: "案件" },
            { key: "media", emoji: "📱", label: "媒体" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key as typeof activeTab);
                if (tab.key === "cpn") setMobilePage(1);
              }}
              className={`flex-1 flex items-center justify-center py-2.5 text-sm font-bold rounded-xl transition-all duration-200 ${
                activeTab === tab.key
                  ? "bg-white text-indigo-600 shadow-md"
                  : "text-slate-500"
              }`}
            >
              <span className="text-base mr-0.5">{tab.emoji}</span>
              <span className="text-xs">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* デスクトップ用タブ */}
      <div className="hidden lg:flex gap-2 mb-6 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center px-4 py-2 text-sm font-bold border-b-2 transition-all ${
            activeTab === "overview"
              ? "text-indigo-600 border-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span className="text-base mr-1">📊</span>
          概要
        </button>
        <button
          onClick={() => setActiveTab("cpn")}
          className={`flex items-center px-4 py-2 text-sm font-bold border-b-2 transition-all ${
            activeTab === "cpn"
              ? "text-indigo-600 border-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span className="text-base mr-1">📋</span>
          CPN
        </button>
        <button
          onClick={() => setActiveTab("project")}
          className={`flex items-center px-4 py-2 text-sm font-bold border-b-2 transition-all ${
            activeTab === "project"
              ? "text-indigo-600 border-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span className="text-base mr-1">📁</span>
          案件
        </button>
        <button
          onClick={() => setActiveTab("media")}
          className={`flex items-center px-4 py-2 text-sm font-bold border-b-2 transition-all ${
            activeTab === "media"
              ? "text-indigo-600 border-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span className="text-base mr-1">📱</span>
          媒体
        </button>
      </div>

      {/* オーバービュー */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* 月間目標と進捗バー */}
          <GoalProgress 
            currentValue={displaySummary.monthlyProfit} 
            label={`${currentMonth}月目標`} 
          />

          {/* メインサマリーカード（シンプル表示） */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 lg:gap-4">
            <div className={`rounded-xl p-4 lg:p-6 text-white bg-gradient-to-br ${displaySummary.profit >= 0 ? "from-emerald-500 to-green-600" : "from-red-500 to-rose-600"}`}>
              <p className="text-xs lg:text-sm opacity-90">本日利益</p>
              <p className="text-xl lg:text-3xl font-bold mt-1">¥{Math.round(displaySummary.profit).toLocaleString()}</p>
            </div>
            <div className={`rounded-xl p-4 lg:p-6 text-white bg-gradient-to-br ${displaySummary.monthlyProfit >= 0 ? "from-indigo-500 to-blue-600" : "from-orange-500 to-red-600"}`}>
              <p className="text-xs lg:text-sm opacity-90">{currentMonth}月累計利益</p>
              <p className="text-xl lg:text-3xl font-bold mt-1">¥{Math.round(displaySummary.monthlyProfit).toLocaleString()}</p>
              <p className="text-xs opacity-75 mt-1">今月の累計利益</p>
            </div>
            <div className={`rounded-xl p-4 lg:p-6 text-white bg-gradient-to-br ${displaySummary.roas >= 100 ? "from-teal-500 to-emerald-600" : "from-amber-500 to-orange-600"}`}>
              <p className="text-xs lg:text-sm opacity-90">ROAS</p>
              <p className="text-xl lg:text-3xl font-bold mt-1">{displaySummary.roas.toFixed(1)}%</p>
            </div>
            <div className="rounded-xl p-4 lg:p-6 text-white bg-gradient-to-br from-blue-500 to-indigo-600">
              <p className="text-xs lg:text-sm opacity-90">消化金額</p>
              <p className="text-xl lg:text-3xl font-bold mt-1">¥{Math.round(displaySummary.spend).toLocaleString()}</p>
            </div>
            <div className="rounded-xl p-4 lg:p-6 text-white bg-gradient-to-br from-purple-500 to-violet-600">
              <p className="text-xs lg:text-sm opacity-90">MCV</p>
              <p className="text-xl lg:text-3xl font-bold mt-1">{Math.round(displaySummary.mcv).toLocaleString()}</p>
            </div>
            <div className="rounded-xl p-4 lg:p-6 text-white bg-gradient-to-br from-amber-500 to-orange-600">
              <p className="text-xs lg:text-sm opacity-90">CV</p>
              <p className="text-xl lg:text-3xl font-bold mt-1">{Math.round(displaySummary.cv).toLocaleString()}</p>
            </div>
          </div>

          {/* 好調だがOFFのCPN一覧 */}
          {(() => {
            const goodButOffCpns = cpnList.filter(cpn => {
              const noSpendToday = cpn.spend === 0; // 当日消化0円
              // 40日間データを参照（profit40Days, roas40Daysを使用）
              const profit40 = cpn.profit40Days || cpn.profit7Days;  // fallback to 7days if 40days not available
              const roas40 = cpn.roas40Days || cpn.roas7Days;
              const isGood = profit40 >= 50000 || roas40 >= 150; // 40日利益5万円以上 または ROAS150%以上
              return noSpendToday && isGood;
            }).sort((a, b) => (b.profit40Days || b.profit7Days) - (a.profit40Days || a.profit7Days));

            if (goodButOffCpns.length === 0) {
              return (
                <Card className="border-emerald-200 bg-emerald-50">
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-emerald-800">本日好調なCPNは全て出稿されています</p>
                        <p className="text-xs text-emerald-600">40日間利益5万円以上 or ROAS150%以上のCPNは全て配信中です</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            }

            return (
              <Card className="border-amber-200 bg-amber-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base lg:text-lg flex items-center gap-2 text-amber-800">
                    <Lightbulb className="h-5 w-5 text-amber-500" />
                    好調だが本日未配信のCPN（{goodButOffCpns.length}件）
                  </CardTitle>
                  <p className="text-xs text-amber-600">40日間利益5万円以上 or ROAS150%以上で、本日消化0円のCPNです</p>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {goodButOffCpns.map((cpn) => (
                      <div key={cpn.cpnKey} className="flex items-center justify-between bg-white rounded-lg p-3 border border-amber-200">
                        <div className="flex-1 min-w-0 mr-3">
                          <p className="text-sm font-medium text-slate-800 truncate">{cpn.cpnName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              cpn.media === "Meta" ? "bg-blue-100 text-blue-700" :
                              cpn.media === "TikTok" ? "bg-pink-100 text-pink-700" :
                              "bg-slate-100 text-slate-700"
                            }`}>{cpn.media}</span>
                            <span className="text-xs text-emerald-600 font-medium">40日利益: +¥{(cpn.profit40Days || cpn.profit7Days).toLocaleString()}</span>
                            <span className="text-xs text-slate-500">ROAS: {(cpn.roas40Days || cpn.roas7Days).toFixed(0)}%</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleStatusToggle(cpn)}
                          disabled={statusUpdating[cpn.cpnKey]}
                          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                          <Power className="h-3 w-3" />
                          {statusUpdating[cpn.cpnKey] ? "..." : "ONにする"}
                        </button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* グラフセクション */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            {/* 日別利益推移 */}
            <Card>
              <CardHeader className="pb-2 lg:pb-4">
                <CardTitle className="text-base lg:text-lg">📈 {currentMonth}月 日別利益推移</CardTitle>
              </CardHeader>
              <CardContent className="px-2 lg:px-6">
                {dailyTrend.length > 0 ? (
                  <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 10 }}
                        tickFormatter={(value) => value.split("-")[2] + "日"}
                      />
                      <YAxis 
                        tick={{ fontSize: 9 }}
                        tickFormatter={(value) => {
                          const absValue = Math.abs(value);
                          if (absValue >= 1000000) return `${value < 0 ? "-" : ""}¥${(absValue / 1000000).toFixed(1)}M`;
                          if (absValue >= 1000) return `${value < 0 ? "-" : ""}¥${Math.floor(absValue / 1000)}k`;
                          return `¥${Math.floor(value)}`;
                        }}
                        width={50}
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

          {/* 当日利益TOP10 CPN */}
          <Card className="mb-6">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-base flex items-center gap-2">
                🔥 本日の利益TOP10 CPN
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {cpnList.length > 0 ? (
                <div className="overflow-x-auto scrollbar-hide">
                  <table className="w-full text-sm table-auto min-w-[500px] lg:min-w-0">
                    <thead className="bg-slate-50 border-y border-slate-200">
                      <tr>
                        <th className="px-1.5 lg:px-2 py-2 text-center text-[10px] lg:text-xs font-medium text-slate-500 w-7 lg:w-8">#</th>
                        <th className="px-1.5 lg:px-2 py-2 text-left text-[10px] lg:text-xs font-medium text-slate-500 w-12 lg:w-14">媒体</th>
                        <th className="px-1.5 lg:px-2 py-2 text-left text-[10px] lg:text-xs font-medium text-slate-500 min-w-[120px]">CPN名</th>
                        <th className="px-1.5 lg:px-2 py-2 text-right text-[10px] lg:text-xs font-medium text-slate-500 whitespace-nowrap bg-emerald-50">💰 利益</th>
                        <th className="px-1.5 lg:px-2 py-2 text-right text-[10px] lg:text-xs font-medium text-slate-500 whitespace-nowrap">ROAS</th>
                        <th className="hidden sm:table-cell px-1.5 lg:px-2 py-2 text-right text-[10px] lg:text-xs font-medium text-slate-500 whitespace-nowrap">消化</th>
                        <th className="hidden sm:table-cell px-1.5 lg:px-2 py-2 pr-3 lg:pr-4 text-right text-[10px] lg:text-xs font-medium text-slate-500 whitespace-nowrap">CV</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[...cpnList]
                        .sort((a, b) => b.profit - a.profit)
                        .slice(0, 10)
                        .map((cpn, index) => {
                          const rank = index + 1;
                          return (
                            <tr key={cpn.cpnKey} className="hover:bg-slate-50">
                              <td className="px-1.5 lg:px-2 py-1.5 lg:py-2 text-center">
                                <span className={`inline-flex items-center justify-center w-5 h-5 lg:w-6 lg:h-6 rounded-full text-[10px] lg:text-xs font-bold ${
                                  rank === 1 ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-sm" :
                                  rank === 2 ? "bg-gradient-to-br from-slate-300 to-slate-400 text-white shadow-sm" :
                                  rank === 3 ? "bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-sm" :
                                  "bg-slate-100 text-slate-600"
                                }`}>
                                  {rank}
                                </span>
                              </td>
                              <td className="px-1.5 lg:px-2 py-1.5 lg:py-2">
                                <span className={`px-1 lg:px-1.5 py-0.5 text-[9px] lg:text-[10px] font-medium rounded ${
                                  cpn.media === "Meta" ? "bg-blue-100 text-blue-700" :
                                  cpn.media === "TikTok" ? "bg-pink-100 text-pink-700" :
                                  cpn.media === "Pangle" ? "bg-orange-100 text-orange-700" :
                                  "bg-slate-100 text-slate-600"
                                }`}>
                                  {cpn.media}
                                </span>
                              </td>
                              <td className="px-1.5 lg:px-2 py-1.5 lg:py-2">
                                <p className="text-[10px] lg:text-xs text-slate-800 break-all line-clamp-2">
                                  {cpn.cpnName}
                                </p>
                              </td>
                              <td className={`px-2 lg:px-3 py-1.5 lg:py-2 text-right whitespace-nowrap ${
                                cpn.profit >= 0 
                                  ? "bg-gradient-to-r from-emerald-50 to-green-100" 
                                  : "bg-gradient-to-r from-red-50 to-rose-100"
                              }`}>
                                <span className={`text-xs lg:text-sm font-bold ${cpn.profit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                                  ¥{Math.floor(cpn.profit).toLocaleString()}
                                </span>
                              </td>
                              <td className={`px-1.5 lg:px-2 py-1.5 lg:py-2 text-right text-[10px] lg:text-xs whitespace-nowrap ${getRoasColorClass(cpn.roas)}`}>
                                {cpn.roas.toFixed(1)}%
                              </td>
                              <td className="hidden sm:table-cell px-1.5 lg:px-2 py-1.5 lg:py-2 text-right text-[10px] lg:text-xs text-slate-500 whitespace-nowrap">
                                ¥{Math.floor(cpn.spend).toLocaleString()}
                              </td>
                              <td className="hidden sm:table-cell px-1.5 lg:px-2 py-1.5 lg:py-2 pr-3 lg:pr-4 text-right text-[10px] lg:text-xs text-slate-500 whitespace-nowrap">
                                {cpn.cv.toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-6 text-center text-slate-400 text-sm">
                  データがありません
                </div>
              )}
            </CardContent>
          </Card>

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
                      tick={{ fontSize: 9 }}
                      tickFormatter={(value) => {
                        const absValue = Math.abs(value);
                        if (absValue >= 1000000) return `${value < 0 ? "-" : ""}¥${(absValue / 1000000).toFixed(1)}M`;
                        if (absValue >= 1000) return `${value < 0 ? "-" : ""}¥${Math.floor(absValue / 1000)}k`;
                        return `¥${Math.floor(value)}`;
                      }}
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

        </div>
      )}

      {/* CPN別（旧 当日合計の一部） */}
      {activeTab === "cpn" && (
        <div className="space-y-6">
          {/* ヘッダーと変更履歴ボタン */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">当日のCPN合計数値（{cpnList.length}件）</h2>
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => setShowChangeHistory(!showChangeHistory)}
              className="flex items-center gap-2"
            >
              <History className="h-4 w-4" />
              変更履歴
            </Button>
          </div>

          {/* 変更履歴パネル */}
          {showChangeHistory && (
            <ChangeHistory onClose={() => setShowChangeHistory(false)} />
          )}
          
          {/* メイン指標 - モバイル最適化 */}
          <div className="lg:hidden">
            {/* モバイル: コンパクトなカード */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="grid grid-cols-3 divide-x divide-slate-100">
                <div className="p-3 text-center">
                  <p className="text-[10px] text-slate-500 mb-0.5">消化</p>
                  <p className="text-base font-bold text-slate-800">{formatCurrency(displaySummary.spend)}</p>
                </div>
                <div className={`p-3 text-center ${displaySummary.profit >= 0 ? "bg-green-50" : "bg-red-50"}`}>
                  <p className="text-[10px] text-slate-500 mb-0.5">利益</p>
                  <p className={`text-base font-bold ${displaySummary.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatCurrency(displaySummary.profit)}
                  </p>
                </div>
                <div className="p-3 text-center">
                  <p className="text-[10px] text-slate-500 mb-0.5">ROAS</p>
                  <p className={`text-base font-bold ${getRoasColorClass(displaySummary.roas)}`}>
                    {formatPercent(displaySummary.roas)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* デスクトップ用カード */}
          <div className="hidden lg:grid grid-cols-3 gap-6">
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
                    <p className={`text-2xl font-bold ${getRoasColorClass(displaySummary.roas)}`}>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 lg:gap-4">
            <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-xl p-3 lg:p-4 border border-cyan-200">
              <div className="flex items-center gap-2 mb-1 lg:mb-2">
                <div className="h-6 w-6 lg:h-8 lg:w-8 rounded-lg bg-cyan-500 flex items-center justify-center">
                  <Target className="h-3 w-3 lg:h-4 lg:w-4 text-white" />
                </div>
                <p className="text-[10px] lg:text-xs font-medium text-cyan-700">MCV</p>
              </div>
              <p className="text-lg lg:text-2xl font-bold text-cyan-900">{displaySummary.mcv.toLocaleString()}</p>
            </div>

            <div className="bg-gradient-to-br from-violet-50 to-violet-100 rounded-xl p-3 lg:p-4 border border-violet-200">
              <div className="flex items-center gap-2 mb-1 lg:mb-2">
                <div className="h-6 w-6 lg:h-8 lg:w-8 rounded-lg bg-violet-500 flex items-center justify-center">
                  <Target className="h-3 w-3 lg:h-4 lg:w-4 text-white" />
                </div>
                <p className="text-[10px] lg:text-xs font-medium text-violet-700">CV</p>
              </div>
              <p className="text-lg lg:text-2xl font-bold text-violet-900">{displaySummary.cv.toLocaleString()}</p>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-3 lg:p-4 border border-amber-200">
              <div className="flex items-center gap-2 mb-1 lg:mb-2">
                <div className="h-6 w-6 lg:h-8 lg:w-8 rounded-lg bg-amber-500 flex items-center justify-center">
                  <DollarSign className="h-3 w-3 lg:h-4 lg:w-4 text-white" />
                </div>
                <p className="text-[10px] lg:text-xs font-medium text-amber-700">売上</p>
              </div>
              <p className="text-lg lg:text-2xl font-bold text-amber-900">{formatCurrency(displaySummary.revenue)}</p>
            </div>

            <div className="bg-gradient-to-br from-rose-50 to-rose-100 rounded-xl p-3 lg:p-4 border border-rose-200">
              <div className="flex items-center gap-2 mb-1 lg:mb-2">
                <div className="h-6 w-6 lg:h-8 lg:w-8 rounded-lg bg-rose-500 flex items-center justify-center">
                  <DollarSign className="h-3 w-3 lg:h-4 lg:w-4 text-white" />
                </div>
                <p className="text-[10px] lg:text-xs font-medium text-rose-700">CPA</p>
              </div>
              <p className="text-lg lg:text-2xl font-bold text-rose-900">{formatCurrency(displaySummary.cpa)}</p>
            </div>

            <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl p-3 lg:p-4 border border-teal-200">
              <div className="flex items-center gap-2 mb-1 lg:mb-2">
                <div className="h-6 w-6 lg:h-8 lg:w-8 rounded-lg bg-teal-500 flex items-center justify-center">
                  <BarChart3 className="h-3 w-3 lg:h-4 lg:w-4 text-white" />
                </div>
                <p className="text-[10px] lg:text-xs font-medium text-teal-700">CVR</p>
              </div>
              <p className="text-lg lg:text-2xl font-bold text-teal-900">{formatPercent(displaySummary.cvr)}</p>
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
                }`}>{currentMonth}月利益</p>
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
          
          {/* モバイル用カード表示 - ページネーション対応 */}
          <div className="lg:hidden p-3 space-y-3">
            {/* CPN件数表示 */}
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>{getSortedCpnList().length}件中 {Math.min(mobilePage * MOBILE_PAGE_SIZE, getSortedCpnList().length)}件表示</span>
              {mobilePage > 1 && (
                <button 
                  onClick={() => setMobilePage(1)}
                  className="text-indigo-600 font-medium"
                >
                  最初に戻る
                </button>
              )}
            </div>
            
            {getSortedCpnList().slice(0, mobilePage * MOBILE_PAGE_SIZE).map((cpn, index) => {
              const isTargetMedia = ["Meta", "TikTok", "Pangle"].includes(cpn.media);
              const currentStatus = cpn.status?.toLowerCase() || "";
              const isActive = currentStatus === "active" || currentStatus === "enable" || currentStatus === "enabled" || currentStatus === "on";
              const statusMessage = statusMessages[cpn.cpnKey];
              const message = budgetMessages[cpn.cpnKey];
              
              return (
                <div key={index} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  {/* ヘッダー行: 媒体 + 利益 + ROAS + ON/OFF */}
                  <div className="flex items-center gap-2 p-2.5 bg-slate-50/50">
                    <span className={`inline-flex px-2 py-1 text-xs font-bold rounded-lg shrink-0 ${
                      cpn.media === "Meta" ? "bg-blue-500 text-white" :
                      cpn.media === "TikTok" ? "bg-pink-500 text-white" :
                      cpn.media === "Pangle" ? "bg-orange-500 text-white" :
                      cpn.media === "YouTube" ? "bg-red-500 text-white" :
                      cpn.media === "LINE" ? "bg-green-500 text-white" :
                      "bg-slate-500 text-white"
                    }`}>
                      {cpn.media || "-"}
                    </span>
                    <div className="flex-1 flex items-center justify-center gap-3">
                      <span className={`text-sm font-bold ${cpn.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatCurrency(cpn.profit)}
                      </span>
                      <span className={`text-sm font-bold ${getRoasColorClass(cpn.roas)}`}>
                        {formatPercent(cpn.roas)}
                      </span>
                    </div>
                    {isTargetMedia && (
                      <button
                        onClick={() => handleStatusToggle(cpn)}
                        disabled={statusUpdating[cpn.cpnKey]}
                        className={`inline-flex items-center justify-center w-14 h-7 rounded-full transition-colors font-bold text-xs shrink-0 ${
                          statusUpdating[cpn.cpnKey] 
                            ? "bg-slate-200 cursor-wait" 
                            : isActive 
                              ? "bg-green-500 text-white" 
                              : "bg-slate-300 text-slate-600"
                        }`}
                      >
                        {statusUpdating[cpn.cpnKey] ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          isActive ? "ON" : "OFF"
                        )}
                      </button>
                    )}
                  </div>
                  
                  {/* CPN名 */}
                  <p className="text-xs text-slate-700 px-2.5 py-2 leading-relaxed line-clamp-2 border-b border-slate-100">{cpn.cpnName}</p>
                  
                  {/* サブ指標 - 横並び */}
                  <div className="grid grid-cols-5 divide-x divide-slate-100 text-center py-2">
                    <div>
                      <p className="text-[9px] text-slate-400">消化</p>
                      <p className="text-[11px] font-bold text-slate-700">{formatCurrency(cpn.spend)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-400">MCV</p>
                      <p className="text-[11px] font-bold text-slate-700">{cpn.mcv}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-400">CV</p>
                      <p className="text-[11px] font-bold text-slate-700">{cpn.cv}</p>
                    </div>
                    <div className={cpn.consecutiveLoss >= 2 ? "bg-red-50" : ""}>
                      <p className="text-[9px] text-slate-400">赤字</p>
                      <p className={`text-[11px] font-bold ${cpn.consecutiveLoss >= 2 ? "text-red-600" : "text-slate-700"}`}>
                        {cpn.profit >= 0 ? "-" : cpn.consecutiveLoss === 1 ? "当日" : `${cpn.consecutiveLoss}日`}
                      </p>
                    </div>
                    <div className="bg-indigo-50/50">
                      <p className="text-[9px] text-indigo-500">7日</p>
                      <p className={`text-[11px] font-bold ${cpn.profit7Days >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatCurrency(cpn.profit7Days)}
                      </p>
                    </div>
                  </div>
                  
                  {/* 予算変更（Meta/TikTok/Pangleのみ） */}
                  {isTargetMedia && (
                    <div className="flex items-center gap-1.5 px-2.5 py-2 bg-slate-50/50 border-t border-slate-100">
                      <span className="text-[10px] text-slate-500 shrink-0">{cpn.dailyBudget}</span>
                      <span className="text-slate-300 shrink-0">→</span>
                      <input
                        type="text"
                        placeholder="¥"
                        value={budgetInputs[cpn.cpnKey] || ""}
                        onChange={(e) => handleBudgetChange(cpn.cpnKey, e.target.value)}
                        className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        onClick={() => handleBudgetSubmit(cpn)}
                        disabled={budgetUpdating[cpn.cpnKey] || !budgetInputs[cpn.cpnKey]}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg disabled:bg-slate-300 disabled:cursor-not-allowed shrink-0"
                      >
                        {budgetUpdating[cpn.cpnKey] ? "..." : "変更"}
                      </button>
                      {/* Meta専用: 予算スケジュール */}
                      {cpn.media === "Meta" && (
                        <button
                          onClick={() => openBudgetScheduleModal(cpn)}
                          className="px-2.5 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg shrink-0 flex items-center gap-1"
                        >
                          <Calendar className="h-3 w-3" />
                          <span>スケ</span>
                        </button>
                      )}
                    </div>
                  )}
                  
                  {/* ステータスメッセージ */}
                  {(statusMessage || message) && (
                    <p className={`px-2.5 py-1 text-[10px] text-center ${
                      (statusMessage?.type || message?.type) === "success" ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"
                    }`}>
                      {statusMessage?.text || message?.text}
                    </p>
                  )}
                </div>
              );
            })}
            
            {/* もっと見るボタン */}
            {mobilePage * MOBILE_PAGE_SIZE < getSortedCpnList().length && (
              <button
                onClick={() => setMobilePage(prev => prev + 1)}
                className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold rounded-xl shadow-lg active:scale-[0.98] transition-transform"
              >
                もっと見る ({getSortedCpnList().length - mobilePage * MOBILE_PAGE_SIZE}件)
              </button>
            )}
          </div>
          
          {/* PC用テーブル表示 */}
          <div className="hidden lg:block overflow-x-auto scrollbar-hide">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr>
                  <th 
                    className="px-2 lg:px-3 py-2 text-left text-[10px] lg:text-xs font-medium text-slate-500 cursor-pointer hover:bg-slate-100 whitespace-nowrap min-w-[150px]"
                    onClick={() => handleCpnSort("cpnName")}
                  >
                    CPN名<SortIcon columnKey="cpnName" />
                  </th>
                  <th className="px-1.5 lg:px-2 py-2 text-center text-[10px] lg:text-xs font-medium text-slate-500 whitespace-nowrap">媒体</th>
                  <th className="px-1.5 lg:px-2 py-2 text-center text-[10px] lg:text-xs font-medium text-slate-500 whitespace-nowrap">ON/OFF</th>
                  <th 
                    className="px-2 lg:px-3 py-2 text-right text-[10px] lg:text-xs font-medium text-slate-500 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                    onClick={() => handleCpnSort("dailyBudget")}
                  >
                    現在予算<SortIcon columnKey="dailyBudget" />
                  </th>
                  <th className="px-1.5 lg:px-2 py-2 text-center text-[10px] lg:text-xs font-medium text-slate-500 whitespace-nowrap">予算スケ</th>
                  <th className="px-1.5 lg:px-2 py-2 text-center text-[10px] lg:text-xs font-medium text-slate-500 whitespace-nowrap">変更後</th>
                  <th 
                    className="px-2 lg:px-3 py-2 text-right text-[10px] lg:text-xs font-medium text-slate-500 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                    onClick={() => handleCpnSort("profit")}
                  >
                    利益<SortIcon columnKey="profit" />
                  </th>
                  <th 
                    className="px-2 lg:px-3 py-2 text-right text-[10px] lg:text-xs font-medium text-slate-500 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                    onClick={() => handleCpnSort("roas")}
                  >
                    ROAS<SortIcon columnKey="roas" />
                  </th>
                  <th 
                    className="px-2 lg:px-3 py-2 text-right text-[10px] lg:text-xs font-medium text-slate-500 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                    onClick={() => handleCpnSort("spend")}
                  >
                    消化<SortIcon columnKey="spend" />
                  </th>
                  <th 
                    className="px-2 lg:px-3 py-2 text-right text-[10px] lg:text-xs font-medium text-slate-500 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                    onClick={() => handleCpnSort("mcv")}
                  >
                    MCV<SortIcon columnKey="mcv" />
                  </th>
                  <th 
                    className="px-2 lg:px-3 py-2 text-right text-[10px] lg:text-xs font-medium text-slate-500 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                    onClick={() => handleCpnSort("cv")}
                  >
                    CV<SortIcon columnKey="cv" />
                  </th>
                  <th 
                    className="px-2 lg:px-3 py-2 text-center text-[10px] lg:text-xs font-medium text-slate-500 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                    onClick={() => handleCpnSort("consecutiveLoss")}
                  >
                    赤字<SortIcon columnKey="consecutiveLoss" />
                  </th>
                  <th 
                    className="px-2 lg:px-3 py-2 text-right text-[10px] lg:text-xs font-medium text-slate-500 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                    onClick={() => handleCpnSort("profit7Days")}
                  >
                    7日益<SortIcon columnKey="profit7Days" />
                  </th>
                  <th 
                    className="px-2 lg:px-3 py-2 text-right text-[10px] lg:text-xs font-medium text-slate-500 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
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
                    {/* 予算スケジュール（Metaのみ設定可能） */}
                    <td className="px-2 py-2 text-center whitespace-nowrap">
                      {cpn.media === "Meta" ? (
                        <button
                          onClick={() => openBudgetScheduleModal(cpn)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md transition-colors"
                          title="予算スケジュールを設定"
                        >
                          <Calendar className="h-3 w-3" />
                          設定
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
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
                    <td className={`px-3 py-2 text-right whitespace-nowrap ${getRoasColorClass(cpn.roas)}`}>{formatPercent(cpn.roas)}</td>
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
                      tick={{ fontSize: 9 }}
                      tickFormatter={(value) => {
                        const absValue = Math.abs(value);
                        if (absValue >= 1000000) return `${value < 0 ? "-" : ""}¥${(absValue / 1000000).toFixed(1)}M`;
                        if (absValue >= 1000) return `${value < 0 ? "-" : ""}¥${Math.floor(absValue / 1000)}k`;
                        return `¥${Math.floor(value)}`;
                      }}
                      width={50}
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
            <CardHeader className="pb-2 lg:pb-4">
              <CardTitle className="text-base lg:text-lg">案件名別の利益（{projectList.length}件）</CardTitle>
              <p className="text-xs lg:text-sm text-slate-500 mt-1">案件名をクリックすると詳細を表示</p>
            </CardHeader>
            <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-2 lg:px-4 py-2 text-left text-[10px] lg:text-xs font-medium text-slate-500 whitespace-nowrap">案件名</th>
                    <th className="px-2 lg:px-4 py-2 text-right text-[10px] lg:text-xs font-medium text-slate-500 whitespace-nowrap">消化</th>
                    <th className="hidden sm:table-cell px-2 lg:px-4 py-2 text-right text-[10px] lg:text-xs font-medium text-slate-500 whitespace-nowrap">MCV</th>
                    <th className="px-2 lg:px-4 py-2 text-right text-[10px] lg:text-xs font-medium text-slate-500 whitespace-nowrap">CV</th>
                    <th className="hidden sm:table-cell px-2 lg:px-4 py-2 text-right text-[10px] lg:text-xs font-medium text-slate-500 whitespace-nowrap">売上</th>
                    <th className="px-2 lg:px-4 py-2 text-right text-[10px] lg:text-xs font-medium text-slate-500 whitespace-nowrap">利益</th>
                    <th className="px-2 lg:px-4 py-2 text-right text-[10px] lg:text-xs font-medium text-slate-500 whitespace-nowrap">ROAS</th>
                    <th className="hidden lg:table-cell px-2 lg:px-4 py-2 text-right text-[10px] lg:text-xs font-medium text-slate-500 whitespace-nowrap">CPA</th>
                    <th className="hidden lg:table-cell px-2 lg:px-4 py-2 text-right text-[10px] lg:text-xs font-medium text-slate-500 whitespace-nowrap">CVR</th>
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
                        <td className="px-2 lg:px-4 py-2 font-medium text-slate-900 text-xs lg:text-sm">
                          <div className="flex items-center gap-1 lg:gap-2">
                            <span className={`transition-transform text-[10px] lg:text-sm ${selectedProject === project.projectName ? "rotate-90" : ""}`}>▶</span>
                            <span className="break-all">{project.projectName}</span>
                          </div>
                        </td>
                        <td className="px-2 lg:px-4 py-2 text-right text-slate-600 text-xs lg:text-sm whitespace-nowrap">{formatCurrency(project.spend)}</td>
                        <td className="hidden sm:table-cell px-2 lg:px-4 py-2 text-right text-slate-600 text-xs lg:text-sm">{project.mcv}</td>
                        <td className="px-2 lg:px-4 py-2 text-right text-slate-600 text-xs lg:text-sm">{project.cv}</td>
                        <td className="hidden sm:table-cell px-2 lg:px-4 py-2 text-right text-slate-600 text-xs lg:text-sm whitespace-nowrap">{formatCurrency(project.revenue)}</td>
                        <td className={`px-2 lg:px-4 py-2 text-right font-medium text-xs lg:text-sm whitespace-nowrap ${project.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {formatCurrency(project.profit)}
                        </td>
                        <td className={`px-2 lg:px-4 py-2 text-right text-xs lg:text-sm whitespace-nowrap ${getRoasColorClass(project.roas)}`}>{formatPercent(project.roas)}</td>
                        <td className="hidden lg:table-cell px-2 lg:px-4 py-2 text-right text-slate-600 text-xs lg:text-sm whitespace-nowrap">{formatCurrency(project.cpa)}</td>
                        <td className="hidden lg:table-cell px-2 lg:px-4 py-2 text-right text-slate-600 text-xs lg:text-sm">{formatPercent(project.cvr)}</td>
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
                                              <td className={`px-2 py-1 text-right ${getRoasColorClass(cpn.roas)}`}>{formatPercent(cpn.roas)}</td>
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
                    <BarChart data={mediaList} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="media" tick={{ fontSize: 11 }} />
                      <YAxis 
                        tick={{ fontSize: 9 }}
                        tickFormatter={(value) => {
                          const absValue = Math.abs(value);
                          if (absValue >= 1000000) return `${value < 0 ? "-" : ""}¥${(absValue / 1000000).toFixed(1)}M`;
                          if (absValue >= 1000) return `${value < 0 ? "-" : ""}¥${Math.floor(absValue / 1000)}k`;
                          return `¥${Math.floor(value)}`;
                        }}
                        width={50}
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
                                
                                {/* サマリーカード - スマホ対応 */}
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4 mb-4">
                                  <div className="text-center p-2 lg:p-3 bg-blue-50 rounded-lg">
                                    <div className="text-sm lg:text-lg font-bold text-blue-700">{formatCurrency(media.spend)}</div>
                                    <div className="text-[10px] lg:text-xs text-blue-600">消化</div>
                                  </div>
                                  <div className={`text-center p-2 lg:p-3 rounded-lg ${media.profit >= 0 ? "bg-green-50" : "bg-red-50"}`}>
                                    <div className={`text-sm lg:text-lg font-bold ${media.profit >= 0 ? "text-green-700" : "text-red-700"}`}>
                                      {formatCurrency(media.profit)}
                                    </div>
                                    <div className={`text-[10px] lg:text-xs ${media.profit >= 0 ? "text-green-600" : "text-red-600"}`}>利益</div>
                                  </div>
                                  <div className="text-center p-2 lg:p-3 bg-purple-50 rounded-lg">
                                    <div className="text-sm lg:text-lg font-bold text-purple-700">{formatPercent(media.roas)}</div>
                                    <div className="text-[10px] lg:text-xs text-purple-600">ROAS</div>
                                  </div>
                                  <div className="text-center p-2 lg:p-3 bg-amber-50 rounded-lg">
                                    <div className="text-sm lg:text-lg font-bold text-amber-700">{media.cv}件</div>
                                    <div className="text-[10px] lg:text-xs text-amber-600">CV</div>
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
                                              <td className={`px-2 py-1 text-right ${getRoasColorClass(cpn.roas)}`}>{formatPercent(cpn.roas)}</td>
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
              {/* CPN名 */}
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-xs text-blue-600 mb-1">対象CPN</p>
                <p className="text-sm font-medium text-blue-900 break-all">
                  {budgetScheduleCpn.cpnName}
                </p>
              </div>

              {/* 開始日時 */}
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
                      const timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
                      // 当日の場合、現在時刻より前は無効
                      const now = new Date();
                      const isToday = budgetScheduleForm.startDate === now.toISOString().split("T")[0];
                      const currentMinutes = now.getHours() * 60 + now.getMinutes();
                      const optionMinutes = hour * 60 + minute;
                      const isDisabled = isToday && optionMinutes < currentMinutes;
                      return (
                        <option key={timeStr} value={timeStr} disabled={isDisabled}>
                          {timeStr}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* 終了日時 */}
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
                      const timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
                      // 開始日時より前は無効
                      const isSameDay = budgetScheduleForm.startDate === budgetScheduleForm.endDate;
                      const startMinutes = budgetScheduleForm.startTime 
                        ? parseInt(budgetScheduleForm.startTime.split(":")[0]) * 60 + parseInt(budgetScheduleForm.startTime.split(":")[1])
                        : 0;
                      const optionMinutes = hour * 60 + minute;
                      const isDisabled = isSameDay && optionMinutes <= startMinutes;
                      return (
                        <option key={timeStr} value={timeStr} disabled={isDisabled}>
                          {timeStr}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* 追加予算 */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">追加予算（円）</label>
                <input
                  type="text"
                  placeholder="例: 10000"
                  value={budgetScheduleForm.budgetAmount}
                  onChange={(e) => setBudgetScheduleForm(prev => ({ ...prev, budgetAmount: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">指定期間中の追加予算額を入力</p>
              </div>

              {/* メッセージ */}
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
                  "スケジュール設定"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

