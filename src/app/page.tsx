"use client";

import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JudgmentBadge } from "@/components/ui/badge";
import {
  StopCircle,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  PlayCircle,
  Send,
  ChevronRight,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getRoasColorClass } from "@/lib/utils";

interface SummaryData {
  stop: number;
  replace: number;
  continue: number;
  error: number;
  total: number;
}

interface JudgmentResult {
  cpnKey: string;
  cpnName: string;
  media: string;
  judgment: string;
  todayProfit: number;
  profit7Days: number;
  roas7Days: number;
  consecutiveLossDays: number;
  reasons: string[];
  isRe: boolean;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<SummaryData>({
    stop: 0,
    replace: 0,
    continue: 0,
    error: 0,
    total: 0,
  });
  const [recentResults, setRecentResults] = useState<JudgmentResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [sortKey, setSortKey] = useState<string>("todayProfit");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // データを取得
  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const response = await fetch("/api/judgment");
      const data = await response.json();
      
      if (data.success) {
        setSummary(data.summary);
        setRecentResults(data.results.slice(0, 15));
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // データ再取得（キャッシュクリア）
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setMessage(null);
    
    try {
      const response = await fetch("/api/judgment", { method: "POST" });
      const data = await response.json();
      
      if (data.success) {
        setMessage({ type: "success", text: `${data.count}件のCPNを判定しました` });
        setSummary(data.summary);
        setRecentResults(data.results.slice(0, 15));
      } else {
        setMessage({ type: "error", text: data.error || "判定処理に失敗しました" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "通信エラーが発生しました" });
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatCurrency = (value: number) => {
    const sign = value < 0 ? "" : "+";
    return `${sign}¥${Math.floor(value).toLocaleString("ja-JP")}`;
  };

  // ソート処理
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortedResults = [...recentResults].sort((a, b) => {
    let aVal: number | string = 0;
    let bVal: number | string = 0;

    switch (sortKey) {
      case "cpnName": aVal = a.cpnName; bVal = b.cpnName; break;
      case "todayProfit": aVal = a.todayProfit; bVal = b.todayProfit; break;
      case "profit7Days": aVal = a.profit7Days; bVal = b.profit7Days; break;
      case "roas7Days": aVal = a.roas7Days; bVal = b.roas7Days; break;
      case "consecutiveLossDays": aVal = a.consecutiveLossDays; bVal = b.consecutiveLossDays; break;
      default: aVal = a.todayProfit; bVal = b.todayProfit;
    }

    if (typeof aVal === "string") {
      return sortDir === "asc" ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
    }
    return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortKey !== columnKey) return <span className="text-slate-300 ml-1">↕</span>;
    return <span className="text-indigo-600 ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  if (isLoading) {
    return (
      <>
        <Header title="CPN診断" description="自動判定によるCPN分析結果" />
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
          <span className="ml-3 text-slate-500">読み込み中...</span>
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title="ダッシュボード"
        description="CPN仕分け結果のサマリーと最新状況"
      />

      {/* メッセージ表示 */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* アクションボタン - スマホ対応 */}
      <div className="flex flex-wrap gap-2 lg:gap-4 mb-6 lg:mb-8">
        <Button size="sm" className="text-xs lg:text-sm px-3 lg:px-4 py-2" onClick={handleRefresh} loading={isRefreshing}>
          <PlayCircle className="mr-1 lg:mr-2 h-4 w-4 lg:h-5 lg:w-5" />
          判定実行
        </Button>
        <Button size="sm" className="text-xs lg:text-sm px-3 lg:px-4 py-2" variant="secondary" onClick={() => window.location.href = "/analysis"}>
          <RefreshCw className="mr-1 lg:mr-2 h-4 w-4 lg:h-5 lg:w-5" />
          マイ分析
        </Button>
        <Button size="sm" className="text-xs lg:text-sm px-3 lg:px-4 py-2" variant="secondary" onClick={() => window.location.href = "/send"}>
          <Send className="mr-1 lg:mr-2 h-4 w-4 lg:h-5 lg:w-5" />
          Chatwork
        </Button>
      </div>

      {/* サマリーカード - クリック可能・スマホ対応 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4 mb-6 lg:mb-8">
        <Link href="/results/stop">
          <Card className="cursor-pointer hover:shadow-md transition-shadow hover:border-red-300">
            <CardContent className="p-3 lg:pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs lg:text-sm text-slate-500">停止</p>
                  <p className="text-xl lg:text-3xl font-bold text-red-600">{summary.stop}</p>
                </div>
                <div className="h-8 w-8 lg:h-12 lg:w-12 rounded-full bg-red-100 flex items-center justify-center">
                  <StopCircle className="h-4 w-4 lg:h-6 lg:w-6 text-red-600" />
                </div>
              </div>
              <div className="mt-2 lg:mt-4 flex items-center text-[10px] lg:text-sm text-slate-500">
                <span>詳細</span>
                <ChevronRight className="h-3 w-3 lg:h-4 lg:w-4 ml-0.5" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/results/replace">
          <Card className="cursor-pointer hover:shadow-md transition-shadow hover:border-orange-300">
            <CardContent className="p-3 lg:pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs lg:text-sm text-slate-500">作り替え</p>
                  <p className="text-xl lg:text-3xl font-bold text-orange-600">{summary.replace}</p>
                </div>
                <div className="h-8 w-8 lg:h-12 lg:w-12 rounded-full bg-orange-100 flex items-center justify-center">
                  <RefreshCw className="h-4 w-4 lg:h-6 lg:w-6 text-orange-600" />
                </div>
              </div>
              <div className="mt-2 lg:mt-4 flex items-center text-[10px] lg:text-sm text-slate-500">
                <span>詳細</span>
                <ChevronRight className="h-3 w-3 lg:h-4 lg:w-4 ml-0.5" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/results/continue">
          <Card className="cursor-pointer hover:shadow-md transition-shadow hover:border-green-300">
            <CardContent className="p-3 lg:pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs lg:text-sm text-slate-500">継続</p>
                  <p className="text-xl lg:text-3xl font-bold text-green-600">{summary.continue}</p>
                </div>
                <div className="h-8 w-8 lg:h-12 lg:w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 lg:h-6 lg:w-6 text-green-600" />
                </div>
              </div>
              <div className="mt-2 lg:mt-4 flex items-center text-[10px] lg:text-sm text-slate-500">
                <span>詳細</span>
                <ChevronRight className="h-3 w-3 lg:h-4 lg:w-4 ml-0.5" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/results/error">
          <Card className="cursor-pointer hover:shadow-md transition-shadow hover:border-yellow-300">
            <CardContent className="p-3 lg:pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs lg:text-sm text-slate-500">エラー</p>
                  <p className="text-xl lg:text-3xl font-bold text-yellow-600">{summary.error}</p>
                </div>
                <div className="h-8 w-8 lg:h-12 lg:w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 lg:h-6 lg:w-6 text-yellow-600" />
                </div>
              </div>
              <div className="mt-2 lg:mt-4 flex items-center text-[10px] lg:text-sm text-slate-500">
                <span>詳細</span>
                <ChevronRight className="h-3 w-3 lg:h-4 lg:w-4 ml-0.5" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* 最新の仕分け結果 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between p-3 lg:p-6">
          <CardTitle className="text-sm lg:text-lg">判定結果（{summary.total}件）</CardTitle>
          <Link href="/results">
            <Button variant="ghost" size="sm" className="text-xs lg:text-sm">
              すべて見る
              <ChevronRight className="h-3 w-3 lg:h-4 lg:w-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        {recentResults.length > 0 ? (
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full min-w-[600px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th 
                    onClick={() => handleSort("cpnName")}
                    className="px-2 lg:px-4 py-2 lg:py-3 text-left text-[10px] lg:text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                  >
                    CPN名 <SortIcon columnKey="cpnName" />
                  </th>
                  <th className="px-2 lg:px-4 py-2 lg:py-3 text-left text-[10px] lg:text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    媒体
                  </th>
                  <th className="px-2 lg:px-4 py-2 lg:py-3 text-left text-[10px] lg:text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    判定
                  </th>
                  <th 
                    onClick={() => handleSort("todayProfit")}
                    className="px-2 lg:px-4 py-2 lg:py-3 text-right text-[10px] lg:text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                  >
                    当日利益 <SortIcon columnKey="todayProfit" />
                  </th>
                  <th 
                    onClick={() => handleSort("profit7Days")}
                    className="hidden lg:table-cell px-2 lg:px-4 py-2 lg:py-3 text-right text-[10px] lg:text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                  >
                    7日利益 <SortIcon columnKey="profit7Days" />
                  </th>
                  <th 
                    onClick={() => handleSort("roas7Days")}
                    className="px-2 lg:px-4 py-2 lg:py-3 text-right text-[10px] lg:text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                  >
                    ROAS <SortIcon columnKey="roas7Days" />
                  </th>
                  <th className="hidden lg:table-cell px-2 lg:px-4 py-2 lg:py-3 text-left text-[10px] lg:text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    理由
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sortedResults.map((result) => (
                  <tr key={result.cpnKey} className="hover:bg-slate-50">
                    <td className="px-2 lg:px-4 py-2 lg:py-3 min-w-[120px] lg:min-w-[200px]">
                      <p className="text-[10px] lg:text-sm font-medium text-slate-900 break-all line-clamp-2" title={result.cpnName}>
                        {result.cpnName}
                      </p>
                    </td>
                    <td className="px-2 lg:px-4 py-2 lg:py-3 whitespace-nowrap">
                      <span className={`inline-flex px-1.5 lg:px-2 py-0.5 lg:py-1 text-[9px] lg:text-xs font-medium rounded-full ${
                        result.media === "Meta" ? "bg-blue-100 text-blue-700" :
                        result.media === "TikTok" ? "bg-pink-100 text-pink-700" :
                        result.media === "Pangle" ? "bg-orange-100 text-orange-700" :
                        "bg-slate-100 text-slate-700"
                      }`}>
                        {result.media}
                      </span>
                    </td>
                    <td className="px-2 lg:px-4 py-2 lg:py-3 whitespace-nowrap">
                      <JudgmentBadge judgment={result.judgment} />
                    </td>
                    <td className="px-2 lg:px-4 py-2 lg:py-3 text-right whitespace-nowrap">
                      <span
                        className={`text-[10px] lg:text-sm font-medium ${
                          result.todayProfit >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {formatCurrency(result.todayProfit)}
                      </span>
                    </td>
                    <td className="hidden lg:table-cell px-2 lg:px-4 py-2 lg:py-3 text-right whitespace-nowrap">
                      <span
                        className={`text-[10px] lg:text-sm font-medium ${
                          result.profit7Days >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {formatCurrency(result.profit7Days)}
                      </span>
                    </td>
                    <td className="px-2 lg:px-4 py-2 lg:py-3 text-right whitespace-nowrap">
                      <span className={`text-[10px] lg:text-sm font-medium ${getRoasColorClass(result.roas7Days)}`}>
                        {result.roas7Days.toFixed(1)}%
                      </span>
                    </td>
                    <td className="hidden lg:table-cell px-2 lg:px-4 py-2 lg:py-3">
                      <div className="flex flex-wrap gap-1">
                        {result.reasons.slice(0, 2).map((reason, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-1.5 lg:px-2 py-0.5 rounded text-[9px] lg:text-xs bg-slate-100 text-slate-600"
                          >
                            {reason}
                          </span>
                        ))}
                        {result.reasons.length > 2 && (
                          <span className="text-[9px] lg:text-xs text-slate-400">+{result.reasons.length - 2}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <CardContent>
            <p className="text-center text-slate-500 py-8">
              まだ判定結果がありません。「判定実行」をクリックしてください。
            </p>
          </CardContent>
        )}
      </Card>
    </>
  );
}
