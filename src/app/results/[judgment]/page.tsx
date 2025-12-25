"use client";

import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect, use, useCallback } from "react";
import { ArrowLeft, Download, RefreshCw, Copy, Check, ChevronDown, ChevronUp, ArrowRight, X } from "lucide-react";
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

interface JudgmentOverride {
  cpnKey: string;
  originalJudgment: string;
  newJudgment: string;
  timestamp: number;
}

const CACHE_KEY_PREFIX = "judgment_cache_";
const OVERRIDE_KEY = "judgment_overrides";
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

const judgmentOptions = [
  { value: "stop", label: "停止", color: "bg-red-100 text-red-700 hover:bg-red-200" },
  { value: "replace", label: "作り替え", color: "bg-orange-100 text-orange-700 hover:bg-orange-200" },
  { value: "continue", label: "継続", color: "bg-green-100 text-green-700 hover:bg-green-200" },
];

export default function JudgmentDetailPage({ params }: { params: Promise<{ judgment: string }> }) {
  const { judgment } = use(params);
  const [results, setResults] = useState<JudgmentResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [overrides, setOverrides] = useState<JudgmentOverride[]>([]);
  const [showMoveModal, setShowMoveModal] = useState<string | null>(null); // cpnKey
  const [selectedCpn, setSelectedCpn] = useState<JudgmentResult | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const config = judgmentConfig[judgment] || judgmentConfig.error;
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  
  // ソート用state
  type SortKey = "accountName" | "cpnName" | "media" | "todayProfit" | "profit7Days" | "roas7Days" | "consecutiveLossDays";
  const [sortKey, setSortKey] = useState<SortKey>("todayProfit");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // オーバーライドをロード
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(OVERRIDE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // 24時間以上経過したオーバーライドは削除
        const filtered = parsed.filter((o: JudgmentOverride) => Date.now() - o.timestamp < 24 * 60 * 60 * 1000);
        setOverrides(filtered);
        if (filtered.length !== parsed.length) {
          localStorage.setItem(OVERRIDE_KEY, JSON.stringify(filtered));
        }
      }
    } catch {}
  }, []);

  // オーバーライドを保存
  const saveOverrides = (newOverrides: JudgmentOverride[]) => {
    setOverrides(newOverrides);
    if (typeof window !== "undefined") {
      localStorage.setItem(OVERRIDE_KEY, JSON.stringify(newOverrides));
    }
  };

  // 判定を変更
  const handleChangeJudgment = (cpn: JudgmentResult, newJudgment: string) => {
    if (newJudgment === cpn.judgment) {
      // 元の判定に戻す場合はオーバーライドを削除
      const newOverrides = overrides.filter(o => o.cpnKey !== cpn.cpnKey);
      saveOverrides(newOverrides);
    } else {
      // 新しいオーバーライドを追加
      const existingIndex = overrides.findIndex(o => o.cpnKey === cpn.cpnKey);
      const newOverride: JudgmentOverride = {
        cpnKey: cpn.cpnKey,
        originalJudgment: cpn.judgment,
        newJudgment,
        timestamp: Date.now(),
      };
      
      if (existingIndex >= 0) {
        const newOverrides = [...overrides];
        newOverrides[existingIndex] = newOverride;
        saveOverrides(newOverrides);
      } else {
        saveOverrides([...overrides, newOverride]);
      }
    }
    
    setShowMoveModal(null);
    setSelectedCpn(null);
    setMessage({ type: "success", text: `${cpn.cpnName.substring(0, 30)}... を「${judgmentMap[newJudgment]}」に移動しました` });
    setTimeout(() => setMessage(null), 3000);
  };

  // オーバーライドをリセット
  const handleResetOverrides = () => {
    saveOverrides([]);
    setMessage({ type: "success", text: "全ての判定変更をリセットしました" });
    setTimeout(() => setMessage(null), 3000);
  };

  // 現在の判定カテゴリに属するCPN（オーバーライド適用後）
  const filteredResults = results.filter(r => {
    const override = overrides.find(o => o.cpnKey === r.cpnKey);
    const effectiveJudgment = override ? override.newJudgment : r.judgment;
    return effectiveJudgment === judgment;
  });

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
  const sortedResults = [...filteredResults].sort((a, b) => {
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
    const text = filteredResults
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
      const cacheKey = CACHE_KEY_PREFIX + "all";
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
  }, []);

  // キャッシュに保存
  const saveToCache = useCallback((data: JudgmentResult[]) => {
    if (typeof window === "undefined") return;
    try {
      const cacheKey = CACHE_KEY_PREFIX + "all";
      localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
    } catch {}
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        // 全てのCPNを取得（オーバーライド適用のため）
        const response = await fetch(`/api/judgment?refresh=true`, {
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
    loadFromCache();
    // バックグラウンドで更新
    fetchData();
  }, [loadFromCache, saveToCache]);

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

  // 変更済みCPN数をカウント
  const overrideCount = overrides.length;

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

      <Header title={`${config.title}（${filteredResults.length}件）`} description={config.description} />

      {/* メッセージ */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
          message.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
        }`}>
          <Check className="w-4 h-4" />
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-auto">×</button>
        </div>
      )}

      {/* オーバーライド警告 */}
      {overrideCount > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-800">
            <ArrowRight className="w-4 h-4" />
            <span className="text-sm font-medium">{overrideCount}件のCPNの判定を変更中</span>
            <span className="text-xs text-amber-600">（24時間後にリセットされます）</span>
          </div>
          <button
            onClick={handleResetOverrides}
            className="text-xs text-amber-700 hover:text-amber-900 underline"
          >
            全てリセット
          </button>
        </div>
      )}

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
        {filteredResults.length > 0 ? (
          sortedResults.map((result) => {
            const override = overrides.find(o => o.cpnKey === result.cpnKey);
            const isOverridden = !!override;
            
            return (
              <Card key={result.cpnKey} className={`p-3 ${isOverridden ? "ring-2 ring-amber-300" : ""}`}>
                {/* ヘッダー: 媒体 & Re & 移動ボタン */}
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
                    {isOverridden && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                        変更済
                      </span>
                    )}
                  </div>
                  {/* 判定変更ボタン */}
                  <button
                    onClick={() => {
                      setSelectedCpn(result);
                      setShowMoveModal(result.cpnKey);
                    }}
                    className="text-[10px] font-medium px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center gap-1"
                  >
                    <ArrowRight className="h-3 w-3" />
                    移動
                  </button>
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
            );
          })
        ) : (
          <div className="p-8 text-center text-slate-500 bg-white rounded-lg border border-slate-200">
            該当するCPNがありません
          </div>
        )}
      </div>

      {/* デスクトップ用テーブル */}
      <Card className="hidden lg:block">
        {filteredResults.length > 0 ? (
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
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">
                    移動
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sortedResults.map((result) => {
                  const override = overrides.find(o => o.cpnKey === result.cpnKey);
                  const isOverridden = !!override;
                  
                  return (
                    <tr key={result.cpnKey} className={`hover:bg-slate-50 ${isOverridden ? "bg-amber-50" : ""}`}>
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
                          {isOverridden && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                              変更済
                            </span>
                          )}
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
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => {
                            setSelectedCpn(result);
                            setShowMoveModal(result.cpnKey);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                        >
                          <ArrowRight className="h-3 w-3" />
                          移動
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-slate-500">
            該当するCPNがありません
          </div>
        )}
      </Card>

      {/* 判定変更モーダル */}
      {showMoveModal && selectedCpn && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">判定を変更</h3>
              <button
                onClick={() => {
                  setShowMoveModal(null);
                  setSelectedCpn(null);
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-4">
              <p className="text-sm text-slate-600 mb-2">CPN名:</p>
              <p className="text-sm font-medium text-slate-900 mb-4 truncate">{selectedCpn.cpnName}</p>
              
              <p className="text-sm text-slate-600 mb-2">現在の判定: <span className="font-medium">{judgmentMap[selectedCpn.judgment]}</span></p>
              
              <p className="text-sm text-slate-600 mb-3">移動先を選択:</p>
              
              <div className="flex flex-col gap-2">
                {judgmentOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => handleChangeJudgment(selectedCpn, option.value)}
                    disabled={option.value === judgment}
                    className={`w-full px-4 py-3 rounded-lg text-sm font-medium transition ${
                      option.value === judgment
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : option.color
                    }`}
                  >
                    {option.label}
                    {option.value === judgment && " (現在)"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
