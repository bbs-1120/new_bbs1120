"use client";

import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JudgmentBadge } from "@/components/ui/badge";
import { useState, useEffect, use } from "react";
import { ArrowLeft, Download, RefreshCw } from "lucide-react";
import Link from "next/link";

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

const judgmentConfig: Record<string, { title: string; description: string; color: string }> = {
  stop: {
    title: "停止",
    description: "広告配信を停止すべきCPN一覧",
    color: "red",
  },
  replace: {
    title: "作り替え",
    description: "クリエイティブの作り替えを検討すべきCPN一覧",
    color: "orange",
  },
  continue: {
    title: "継続",
    description: "現状維持で継続すべきCPN一覧",
    color: "green",
  },
  error: {
    title: "エラー",
    description: "条件に該当しないCPN一覧（要確認）",
    color: "yellow",
  },
};

const judgmentMap: Record<string, string> = {
  stop: "停止",
  replace: "作り替え",
  continue: "継続",
  error: "エラー",
};

export default function JudgmentDetailPage({ params }: { params: Promise<{ judgment: string }> }) {
  const { judgment } = use(params);
  const [results, setResults] = useState<JudgmentResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const config = judgmentConfig[judgment] || judgmentConfig.error;
  const judgmentLabel = judgmentMap[judgment] || "エラー";

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/judgment?judgment=${judgment}`);
        const data = await response.json();

        if (data.success) {
          setResults(data.results);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [judgment]);

  const formatCurrency = (value: number) => {
    const sign = value < 0 ? "" : "+";
    return `${sign}¥${Math.floor(value).toLocaleString("ja-JP")}`;
  };

  if (isLoading) {
    return (
      <>
        <Header title={config.title} description={config.description} />
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
          <p className="ml-2 text-slate-500">読み込み中...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mb-6">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            ダッシュボードに戻る
          </Button>
        </Link>
      </div>

      <Header title={`${config.title}（${results.length}件）`} description={config.description} />

      {/* アクションバー */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2">
          <Link href="/results/stop">
            <Button variant={judgment === "stop" ? "primary" : "secondary"} size="sm">
              停止
            </Button>
          </Link>
          <Link href="/results/replace">
            <Button variant={judgment === "replace" ? "primary" : "secondary"} size="sm">
              作り替え
            </Button>
          </Link>
          <Link href="/results/continue">
            <Button variant={judgment === "continue" ? "primary" : "secondary"} size="sm">
              継続
            </Button>
          </Link>
          <Link href="/results/error">
            <Button variant={judgment === "error" ? "primary" : "secondary"} size="sm">
              エラー
            </Button>
          </Link>
        </div>
        <Button variant="secondary" size="sm">
          <Download className="mr-2 h-4 w-4" />
          CSV出力
        </Button>
      </div>

      {/* 結果テーブル */}
      <Card>
        {results.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    CPN名
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    媒体
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Re
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                    当日利益
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                    7日利益
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                    7日ROAS
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">
                    赤字日数
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    理由
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {results.map((result) => (
                  <tr key={result.cpnKey} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">{result.cpnName}</p>
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
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded ${
                          result.isRe
                            ? "bg-purple-100 text-purple-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {result.isRe ? "Re" : "-"}
                      </span>
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
                    <td className="px-4 py-3 text-center">
                      {result.todayProfit >= 0 ? (
                        <span className="text-green-600 font-medium text-sm">当日プラス</span>
                      ) : result.consecutiveLossDays === 1 ? (
                        <span className="text-red-600 font-medium text-sm">当日マイナス</span>
                      ) : result.consecutiveLossDays >= 2 ? (
                        <span className="text-red-600 font-medium text-sm">マイナス{result.consecutiveLossDays}日</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
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
          <div className="p-12 text-center text-slate-500">
            該当するCPNがありません
          </div>
        )}
      </Card>
    </>
  );
}
