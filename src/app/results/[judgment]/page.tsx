"use client";

import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JudgmentBadge } from "@/components/ui/badge";
import { useState, useEffect, use, useCallback } from "react";
import { ArrowLeft, Download, RefreshCw, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
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
  consecutiveProfitDays: number;
  reasons: string[];
  isRe: boolean;
  accountName?: string;
}

const CACHE_KEY_PREFIX = "judgment_cache_";
const CACHE_DURATION = 3 * 60 * 1000; // 3分

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
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  
  // ソート用state
  type SortKey = "accountName" | "cpnName" | "media" | "todayProfit" | "profit7Days" | "roas7Days" | "consecutiveLossDays";
  const [sortKey, setSortKey] = useState<SortKey>("todayProfit");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // ソート処理
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
  };

  // ソート済みデータ
  const sortedResults = [...results].sort((a, b) => {
    let aVal: string | number = a[sortKey] ?? "";
    let bVal: string | number = b[sortKey] ?? "";
    
    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortOrder === "desc" 
        ? bVal.localeCompare(aVal, "ja") 
        : aVal.localeCompare(bVal, "ja");
    }
    
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
    }
    
    return 0;
  });

  // ソートヘッダーコンポーネント
  const SortHeader = ({ label, sortKeyName, align = "left" }: { label: string; sortKeyName: SortKey; align?: "left" | "right" | "center" }) => (
    <th 
      className={`px-4 py-3 text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 transition-colors ${
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
      }`}
      onClick={() => handleSort(sortKeyName)}
    >
      <div className={`flex items-center gap-1 ${align === "right" ? "justify-end" : align === "center" ? "justify-center" : ""}`}>
        {label}
        {sortKey === sortKeyName ? (
          sortOrder === "desc" ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3 opacity-30" />
        )}
      </div>
    </th>
  );

  // コピー機能
  const handleCopy = async (result: JudgmentResult, type: "account" | "cpn" | "both") => {
    let text = "";
    if (type === "account") {
      text = result.accountName || "";
    } else if (type === "cpn") {
      text = result.cpnName;
    } else {
      text = `${result.accountName || ""}\t${result.cpnName}`;
    }
    
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(`${result.cpnKey}-${type}`);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // 全件コピー機能
  const handleCopyAll = async () => {
    const text = results
      .map((r) => `${r.accountName || ""}\t${r.cpnName}`)
      .join("\n");
    
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey("all");
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      console.error("Failed to copy all:", err);
    }
  };

  // ローカルキャッシュから読み込み
  const loadFromCache = useCallback(() => {
    if (typeof window === "undefined") return false;
    try {
      const cacheKey = CACHE_KEY_PREFIX + judgment;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          setResults(data);
          setIsLoading(false);
          return true;
        }
      }
    } catch {}
    return false;
  }, [judgment]);

  // キャッシュに保存
  const saveToCache = useCallback((data: JudgmentResult[]) => {
    if (typeof window === "undefined") return;
    try {
      const cacheKey = CACHE_KEY_PREFIX + judgment;
      localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
    } catch {}
  }, [judgment]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(`/api/judgment?judgment=${judgment}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        const data = await response.json();

        if (data.success) {
          setResults(data.results);
          saveToCache(data.results);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    // キャッシュから読み込み
    const hasCachedData = loadFromCache();
    // バックグラウンドで更新
    fetchData();
  }, [judgment, loadFromCache, saveToCache]);

  const formatCurrency = (value: number) => {
    const sign = value >= 0 ? "＋" : "";
    return `${sign}¥${Math.floor(value).toLocaleString("ja-JP")}`;
  };

  // スケルトンUI（キャッシュがない時のみ）
  if (isLoading && results.length === 0) {
    return (
      <>
        <div className="mb-4 lg:mb-6">
          <div className="h-8 w-24 bg-slate-200 rounded animate-pulse" />
        </div>
        <Header title={config.title} description={config.description} />
        <div className="space-y-3 mt-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-2 flex-1">
                  <div className="h-3 w-32 bg-slate-200 rounded animate-pulse" />
                  <div className="h-4 w-48 bg-slate-200 rounded animate-pulse" />
                </div>
                <div className="flex gap-4">
                  <div className="h-6 w-16 bg-slate-200 rounded animate-pulse" />
                  <div className="h-6 w-16 bg-slate-200 rounded animate-pulse" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mb-4 lg:mb-6">
        <Link href="/">
          <Button variant="ghost" size="sm" className="text-sm">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            <span className="hidden sm:inline">ダッシュボードに戻る</span>
            <span className="sm:hidden">戻る</span>
          </Button>
        </Link>
      </div>

      <Header title={`${config.title}（${results.length}件）`} description={config.description} />

      {/* アクションバー */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-4 lg:mb-6">
        {/* タブ */}
        <div className="flex gap-1.5 lg:gap-2 overflow-x-auto pb-1">
          <Link href="/results/stop">
            <Button variant={judgment === "stop" ? "primary" : "secondary"} size="sm" className="text-xs lg:text-sm whitespace-nowrap px-2.5 lg:px-3">
              停止
            </Button>
          </Link>
          <Link href="/results/replace">
            <Button variant={judgment === "replace" ? "primary" : "secondary"} size="sm" className="text-xs lg:text-sm whitespace-nowrap px-2.5 lg:px-3">
              作り替え
            </Button>
          </Link>
          <Link href="/results/continue">
            <Button variant={judgment === "continue" ? "primary" : "secondary"} size="sm" className="text-xs lg:text-sm whitespace-nowrap px-2.5 lg:px-3">
              継続
            </Button>
          </Link>
          <Link href="/results/error">
            <Button variant={judgment === "error" ? "primary" : "secondary"} size="sm" className="text-xs lg:text-sm whitespace-nowrap px-2.5 lg:px-3">
              エラー
            </Button>
          </Link>
        </div>
        {/* アクション */}
        <div className="flex gap-2">
          <Button 
            variant="secondary" 
            size="sm"
            onClick={handleCopyAll}
            className="text-xs lg:text-sm flex-1 lg:flex-none"
          >
            {copiedKey === "all" ? (
              <>
                <Check className="mr-1.5 h-3.5 w-3.5 lg:h-4 lg:w-4 text-green-600" />
                コピー完了
              </>
            ) : (
              <>
                <Copy className="mr-1.5 h-3.5 w-3.5 lg:h-4 lg:w-4" />
                全件コピー
              </>
            )}
          </Button>
          <Button variant="secondary" size="sm" className="text-xs lg:text-sm flex-1 lg:flex-none">
            <Download className="mr-1.5 h-3.5 w-3.5 lg:h-4 lg:w-4" />
            CSV出力
          </Button>
        </div>
      </div>

      {/* モバイル用カードビュー */}
      <div className="lg:hidden space-y-3">
        {results.length > 0 ? (
          sortedResults.map((result) => (
            <Card key={result.cpnKey} className="p-3">
              {/* ヘッダー: 媒体 & Re */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full ${
                    result.media === "Meta" ? "bg-blue-100 text-blue-700" :
                    result.media === "TikTok" ? "bg-pink-100 text-pink-700" :
                    result.media === "Pangle" ? "bg-orange-100 text-orange-700" :
                    "bg-slate-100 text-slate-700"
                  }`}>
                    {result.media}
                  </span>
                  {result.isRe && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                      Re
                    </span>
                  )}
                </div>
                {/* 連続日数 */}
                {result.todayProfit >= 0 ? (
                  <span className="text-[10px] font-medium text-green-600">
                    {result.consecutiveProfitDays >= 2 ? `${result.consecutiveProfitDays}日連続+` : "当日+"}
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-red-600">
                    {result.consecutiveLossDays >= 2 ? `${result.consecutiveLossDays}日連続-` : "当日-"}
                  </span>
                )}
              </div>

              {/* アカウント名 */}
              <div className="flex items-center gap-1.5 mb-1">
                <p className="text-[11px] text-slate-500 truncate flex-1">{result.accountName || "-"}</p>
                <button
                  onClick={() => handleCopy(result, "account")}
                  className={`p-1 rounded transition-colors flex-shrink-0 ${
                    copiedKey === `${result.cpnKey}-account`
                      ? "bg-green-100 text-green-600"
                      : "bg-slate-100 text-slate-400 active:bg-slate-200"
                  }`}
                >
                  {copiedKey === `${result.cpnKey}-account` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>

              {/* CPN名 */}
              <div className="flex items-center gap-1.5 mb-3">
                <p className="text-sm font-medium text-slate-900 truncate flex-1">{result.cpnName}</p>
                <button
                  onClick={() => handleCopy(result, "cpn")}
                  className={`p-1 rounded transition-colors flex-shrink-0 ${
                    copiedKey === `${result.cpnKey}-cpn`
                      ? "bg-green-100 text-green-600"
                      : "bg-slate-100 text-slate-400 active:bg-slate-200"
                  }`}
                >
                  {copiedKey === `${result.cpnKey}-cpn` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>

              {/* 数値 */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center bg-slate-50 rounded-lg py-1.5">
                  <p className="text-[10px] text-slate-500 mb-0.5">当日利益</p>
                  <p className={`text-xs font-bold ${result.todayProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {result.todayProfit >= 0 ? "+" : ""}{(result.todayProfit / 10000).toFixed(1)}万
                  </p>
                </div>
                <div className="text-center bg-slate-50 rounded-lg py-1.5">
                  <p className="text-[10px] text-slate-500 mb-0.5">7日利益</p>
                  <p className={`text-xs font-bold ${result.profit7Days >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {result.profit7Days >= 0 ? "+" : ""}{(result.profit7Days / 10000).toFixed(1)}万
                  </p>
                </div>
                <div className="text-center bg-slate-50 rounded-lg py-1.5">
                  <p className="text-[10px] text-slate-500 mb-0.5">7日ROAS</p>
                  <p className="text-xs font-bold text-slate-700">{result.roas7Days.toFixed(0)}%</p>
                </div>
              </div>

              {/* 理由 */}
              <div className="flex flex-wrap gap-1">
                {result.reasons.map((reason, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600"
                  >
                    {reason}
                  </span>
                ))}
              </div>
            </Card>
          ))
        ) : (
          <div className="p-8 text-center text-slate-500 bg-white rounded-lg border border-slate-200">
            該当するCPNがありません
          </div>
        )}
      </div>

      {/* デスクトップ用テーブル */}
      <Card className="hidden lg:block">
        {results.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <SortHeader label="アカウント名" sortKeyName="accountName" />
                  <SortHeader label="CPN名" sortKeyName="cpnName" />
                  <SortHeader label="媒体" sortKeyName="media" />
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Re
                  </th>
                  <SortHeader label="当日利益" sortKeyName="todayProfit" align="right" />
                  <SortHeader label="7日利益" sortKeyName="profit7Days" align="right" />
                  <SortHeader label="7日ROAS" sortKeyName="roas7Days" align="right" />
                  <SortHeader label="赤字日数" sortKeyName="consecutiveLossDays" align="center" />
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    理由
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sortedResults.map((result) => (
                  <tr key={result.cpnKey} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-slate-600">{result.accountName || "-"}</p>
                        <button
                          onClick={() => handleCopy(result, "account")}
                          className={`p-1 rounded transition-colors flex-shrink-0 ${
                            copiedKey === `${result.cpnKey}-account`
                              ? "bg-green-100 text-green-600"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600"
                          }`}
                          title="アカウント名をコピー"
                        >
                          {copiedKey === `${result.cpnKey}-account` ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-900">{result.cpnName}</p>
                        <button
                          onClick={() => handleCopy(result, "cpn")}
                          className={`p-1 rounded transition-colors flex-shrink-0 ${
                            copiedKey === `${result.cpnKey}-cpn`
                              ? "bg-green-100 text-green-600"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600"
                          }`}
                          title="CPN名をコピー"
                        >
                          {copiedKey === `${result.cpnKey}-cpn` ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
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
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span
                        className={`text-sm font-medium ${
                          result.todayProfit >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {result.todayProfit >= 0 ? "+" : ""}¥{Math.floor(result.todayProfit).toLocaleString("ja-JP")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span
                        className={`text-sm font-medium ${
                          result.profit7Days >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {result.profit7Days >= 0 ? "+" : ""}¥{Math.floor(result.profit7Days).toLocaleString("ja-JP")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-slate-600">
                        {result.roas7Days.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {result.todayProfit >= 0 ? (
                        result.consecutiveProfitDays === 1 ? (
                          <span className="inline-flex items-center text-green-600 font-medium text-sm">当日プラス</span>
                        ) : result.consecutiveProfitDays >= 2 ? (
                          <span className="inline-flex items-center text-green-600 font-medium text-sm">{result.consecutiveProfitDays}日連続プラス</span>
                        ) : (
                          <span className="inline-flex items-center text-green-600 font-medium text-sm">当日プラス</span>
                        )
                      ) : result.consecutiveLossDays === 1 ? (
                        <span className="inline-flex items-center text-red-600 font-medium text-sm">当日マイナス</span>
                      ) : result.consecutiveLossDays >= 2 ? (
                        <span className="inline-flex items-center text-red-600 font-medium text-sm">{result.consecutiveLossDays}日連続マイナス</span>
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
