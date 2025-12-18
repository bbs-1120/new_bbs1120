"use client";

import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JudgmentBadge } from "@/components/ui/badge";
import { useState, useEffect, use } from "react";
import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";

interface JudgmentResult {
  id: string;
  cpnKey: string;
  cpnName: string;
  media: { name: string };
  judgment: string;
  todayProfit: number;
  profit7Days: number;
  roas7Days: number;
  consecutiveLossDays: number;
  reasons: string[];
  recommendedAction: string;
  isRe: boolean;
  isSendTarget: boolean;
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
  check: {
    title: "要確認",
    description: "個別に確認が必要なCPN一覧",
    color: "yellow",
  },
};

const judgmentMap: Record<string, string> = {
  stop: "停止",
  replace: "作り替え",
  continue: "継続",
  check: "要確認",
};

export default function JudgmentDetailPage({ params }: { params: Promise<{ judgment: string }> }) {
  const { judgment } = use(params);
  const [results, setResults] = useState<JudgmentResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const config = judgmentConfig[judgment] || judgmentConfig.check;
  const judgmentLabel = judgmentMap[judgment] || "要確認";

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/judgment");
        const data = await response.json();

        if (data.success) {
          // 該当する判定結果のみフィルタ
          const filtered = data.results.filter(
            (r: JudgmentResult) => r.judgment === judgmentLabel
          );
          setResults(filtered);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [judgmentLabel]);

  const formatCurrency = (value: number | { toNumber?: () => number }) => {
    const num = typeof value === "number" ? value : (value?.toNumber?.() ?? 0);
    const sign = num < 0 ? "" : "+";
    return `${sign}¥${num.toLocaleString("ja-JP")}`;
  };

  if (isLoading) {
    return (
      <>
        <Header title={config.title} description={config.description} />
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-500">読み込み中...</p>
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
          <Link href="/results/check">
            <Button variant={judgment === "check" ? "primary" : "secondary"} size="sm">
              要確認
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    推奨アクション
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {results.map((result) => (
                  <tr key={result.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{result.cpnName}</p>
                        <p className="text-xs text-slate-500 truncate max-w-[250px]">
                          {result.cpnKey}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-600">{result.media.name}</span>
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
                          Number(result.todayProfit) >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {formatCurrency(result.todayProfit)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`text-sm font-medium ${
                          Number(result.profit7Days) >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {formatCurrency(result.profit7Days)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-slate-600">
                        {Math.round(Number(result.roas7Days))}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`text-sm font-medium ${
                          result.consecutiveLossDays > 0 ? "text-red-600" : "text-slate-600"
                        }`}
                      >
                        {result.consecutiveLossDays}日
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
                    <td className="px-4 py-3">
                      <p className="text-xs text-slate-600 max-w-[200px]">
                        {result.recommendedAction}
                      </p>
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

