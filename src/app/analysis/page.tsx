"use client";

import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { RefreshCw, TrendingUp, TrendingDown, DollarSign, Target, BarChart3, Power } from "lucide-react";

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

export default function AnalysisPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [cpnList, setCpnList] = useState<CpnData[]>([]);
  const [projectList, setProjectList] = useState<ProjectData[]>([]);
  const [mediaList, setMediaList] = useState<MediaData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"summary" | "cpn" | "project" | "media">("summary");
  const [cpnSortKey, setCpnSortKey] = useState<string>("profit");
  const [cpnSortDir, setCpnSortDir] = useState<"asc" | "desc">("desc");
  const [budgetInputs, setBudgetInputs] = useState<Record<string, string>>({});
  const [budgetUpdating, setBudgetUpdating] = useState<Record<string, boolean>>({});
  const [budgetMessages, setBudgetMessages] = useState<Record<string, { type: "success" | "error"; text: string }>>({});
  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>({});
  const [statusMessages, setStatusMessages] = useState<Record<string, { type: "success" | "error"; text: string }>>({});

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
    return [...cpnList].sort((a, b) => {
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
    fetchData();
  }, []);

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
        <Header title="マイ分析" description="悠太のCPN分析ダッシュボード" />
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
        <Header title="マイ分析" description="悠太のCPN分析ダッシュボード" />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={fetchData}>再試行</Button>
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
      <Header title="マイ分析" description="悠太のCPN分析ダッシュボード" />

      {/* 更新ボタン */}
      <div className="mb-6">
        <Button onClick={handleRefresh} loading={isRefreshing}>
          <RefreshCw className="mr-2 h-4 w-4" />
          データを更新
        </Button>
      </div>

      {/* タブナビゲーション */}
      <div className="flex gap-2 mb-6 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("summary")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "summary"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          ① 当日合計
        </button>
        <button
          onClick={() => setActiveTab("cpn")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "cpn"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          ② CPN別
        </button>
        <button
          onClick={() => setActiveTab("project")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "project"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          ③ 案件別
        </button>
        <button
          onClick={() => setActiveTab("media")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "media"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          ④ 媒体別
        </button>
      </div>

      {/* ① 当日合計 */}
      {activeTab === "summary" && (
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
        <Card>
          <CardHeader>
            <CardTitle>CPN単位のデータ（{cpnList.length}件）</CardTitle>
            <p className="text-xs text-slate-500 mt-1">※予算変更は Meta / TikTok / Pangle のみ対応</p>
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
                  <th 
                    className="px-3 py-2 text-center text-xs font-medium text-slate-500 cursor-pointer hover:bg-slate-100"
                    onClick={() => handleCpnSort("consecutiveLoss")}
                  >
                    連続赤字<SortIcon columnKey="consecutiveLoss" />
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {getSortedCpnList().map((cpn, index) => {
                  const isTargetMedia = ["Meta", "TikTok", "Pangle"].includes(cpn.media);
                  const message = budgetMessages[cpn.cpnKey];
                  
                  return (
                  <tr key={index} className="hover:bg-slate-50">
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-900 text-xs leading-relaxed">{cpn.cpnName}</p>
                    </td>
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
                    <td className="px-3 py-2 text-right text-slate-600 whitespace-nowrap">{cpn.dailyBudget}</td>
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
                    <td className={`px-3 py-2 text-right font-medium whitespace-nowrap ${cpn.profit7Days >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(cpn.profit7Days)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600 whitespace-nowrap">{formatPercent(cpn.roas7Days)}</td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      {cpn.consecutiveLoss > 0 && (
                        <span className="text-red-600 font-medium">{cpn.consecutiveLoss}日</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600 whitespace-nowrap">{formatCurrency(cpn.spend)}</td>
                    <td className="px-3 py-2 text-right text-slate-600 whitespace-nowrap">{cpn.mcv.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-slate-600 whitespace-nowrap">{cpn.cv}</td>
                    <td className={`px-3 py-2 text-right font-medium whitespace-nowrap ${cpn.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(cpn.profit)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600 whitespace-nowrap">{formatPercent(cpn.roas)}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ③ 案件別 */}
      {activeTab === "project" && (
        <Card>
          <CardHeader>
            <CardTitle>案件名別の利益（{projectList.length}件）</CardTitle>
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
                  <tr key={index} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-900">{project.projectName}</td>
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
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ④ 媒体別 */}
      {activeTab === "media" && (
        <Card>
          <CardHeader>
            <CardTitle>媒体別の利益（{mediaList.length}件）</CardTitle>
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
                  <tr key={index} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-900">{media.media}</td>
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
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

