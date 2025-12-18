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

      {/* アクションボタン */}
      <div className="flex gap-4 mb-8">
        <Button size="lg" onClick={handleRefresh} loading={isRefreshing}>
          <PlayCircle className="mr-2 h-5 w-5" />
          判定実行
        </Button>
        <Button size="lg" variant="secondary" onClick={() => window.location.href = "/analysis"}>
          <RefreshCw className="mr-2 h-5 w-5" />
          マイ分析
        </Button>
        <Button size="lg" variant="secondary" onClick={() => window.location.href = "/send"}>
          <Send className="mr-2 h-5 w-5" />
          Chatwork送信
        </Button>
      </div>

      {/* サマリーカード - クリック可能 */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <Link href="/results/stop">
          <Card className="cursor-pointer hover:shadow-md transition-shadow hover:border-red-300">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">停止</p>
                  <p className="text-3xl font-bold text-red-600">{summary.stop}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                  <StopCircle className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm text-slate-500">
                <span>詳細を見る</span>
                <ChevronRight className="h-4 w-4 ml-1" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/results/replace">
          <Card className="cursor-pointer hover:shadow-md transition-shadow hover:border-orange-300">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">作り替え</p>
                  <p className="text-3xl font-bold text-orange-600">{summary.replace}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                  <RefreshCw className="h-6 w-6 text-orange-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm text-slate-500">
                <span>詳細を見る</span>
                <ChevronRight className="h-4 w-4 ml-1" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/results/continue">
          <Card className="cursor-pointer hover:shadow-md transition-shadow hover:border-green-300">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">継続</p>
                  <p className="text-3xl font-bold text-green-600">{summary.continue}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm text-slate-500">
                <span>詳細を見る</span>
                <ChevronRight className="h-4 w-4 ml-1" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/results/error">
          <Card className="cursor-pointer hover:shadow-md transition-shadow hover:border-yellow-300">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">エラー</p>
                  <p className="text-3xl font-bold text-yellow-600">{summary.error}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm text-slate-500">
                <span>詳細を見る</span>
                <ChevronRight className="h-4 w-4 ml-1" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* 最新の仕分け結果 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>判定結果（{summary.total}件）</CardTitle>
          <Link href="/results">
            <Button variant="ghost" size="sm">
              すべて見る
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        {recentResults.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    CPN名
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    媒体
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    判定
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    当日利益
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    7日利益
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    7日ROAS
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    理由
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {recentResults.map((result) => (
                  <tr key={result.cpnKey} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900 max-w-xs">
                        {result.cpnName}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        result.media === "Meta" ? "bg-blue-100 text-blue-700" :
                        result.media === "TikTok" ? "bg-pink-100 text-pink-700" :
                        result.media === "Pangle" ? "bg-orange-100 text-orange-700" :
                        "bg-slate-100 text-slate-700"
                      }`}>
                        {result.media}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <JudgmentBadge judgment={result.judgment} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`text-sm font-medium ${
                          result.todayProfit >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {formatCurrency(result.todayProfit)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`text-sm font-medium ${
                          result.profit7Days >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {formatCurrency(result.profit7Days)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-slate-600">
                        {result.roas7Days.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {result.reasons.map((reason, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600"
                          >
                            {reason}
                          </span>
                        ))}
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
