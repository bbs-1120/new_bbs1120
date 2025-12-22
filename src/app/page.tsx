"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { 
  ArrowRight, 
  TrendingUp, 
  TrendingDown,
  BarChart3,
  Stethoscope,
  MessageSquare,
  Settings,
  RefreshCw,
} from "lucide-react";

interface SummaryData {
  stop: number;
  replace: number;
  continue: number;
  error: number;
  total: number;
}

interface TodaySummary {
  spend: number;
  revenue: number;
  profit: number;
  roas: number;
  cv: number;
  mcv: number;
  monthlyProfit: number;
}

const CACHE_KEY = "home_data_cache";
const CACHE_DURATION = 3 * 60 * 1000; // 3分

export default function HomePage() {
  const [summary, setSummary] = useState<SummaryData>({
    stop: 0, replace: 0, continue: 0, error: 0, total: 0,
  });
  const [todaySummary, setTodaySummary] = useState<TodaySummary>({
    spend: 0, revenue: 0, profit: 0, roas: 0, cv: 0, mcv: 0, monthlyProfit: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [hasCache, setHasCache] = useState(false);

  // 時刻はuseMemoで計算（毎回再計算しない）
  const currentTime = useMemo(() => {
    const now = new Date();
    return now.toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "long",
      day: "numeric",
      weekday: "short",
    });
  }, []);

  // ローカルキャッシュから読み込み
  const loadFromCache = useCallback(() => {
    if (typeof window === "undefined") return false;
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        // キャッシュが有効期間内なら使用
        if (Date.now() - timestamp < CACHE_DURATION) {
          setSummary(data.summary);
          setTodaySummary(data.todaySummary);
          setHasCache(true);
          setIsLoading(false);
          return true;
        }
      }
    } catch {}
    return false;
  }, []);

  // キャッシュに保存
  const saveToCache = useCallback((data: { summary: SummaryData; todaySummary: TodaySummary }) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
    } catch {}
  }, []);

  // データを取得（並列リクエスト）
  const fetchData = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒タイムアウト

      const [judgmentRes, analysisRes] = await Promise.all([
        fetch("/api/judgment", { signal: controller.signal }),
        fetch("/api/analysis", { signal: controller.signal }),
      ]);
      clearTimeout(timeoutId);
      
      const [judgmentData, analysisData] = await Promise.all([
        judgmentRes.json(),
        analysisRes.json(),
      ]);
      
      const newSummary = judgmentData.success ? judgmentData.summary : summary;
      const newTodaySummary = analysisData.success ? {
        spend: analysisData.summary.spend,
        revenue: analysisData.summary.revenue,
        profit: analysisData.summary.profit,
        roas: analysisData.summary.roas,
        cv: analysisData.summary.cv,
        mcv: analysisData.summary.mcv,
        monthlyProfit: analysisData.summary.monthlyProfit || 0,
      } : todaySummary;

      setSummary(newSummary);
      setTodaySummary(newTodaySummary);
      
      // キャッシュに保存
      saveToCache({ summary: newSummary, todaySummary: newTodaySummary });
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [summary, todaySummary, saveToCache]);

  // 初回読み込み
  useEffect(() => {
    const hasCachedData = loadFromCache();
    // キャッシュがあってもバックグラウンドで更新
    fetchData();
  }, []);

  const formatCurrency = (value: number, short = false) => {
    const sign = value >= 0 ? "+" : "";
    const absValue = Math.abs(value);
    // モバイルでは万単位で表示（オプション）
    if (short && absValue >= 10000) {
      return `${sign}${(value / 10000).toFixed(1)}万`;
    }
    return `${sign}¥${Math.floor(value).toLocaleString("ja-JP")}`;
  };

  const menuItems = [
    {
      title: "マイ分析",
      description: "詳細なCPN分析・日別推移",
      href: "/analysis",
      icon: BarChart3,
    },
    {
      title: "CPN診断",
      description: "停止・作り替え・継続の判定",
      href: "/results/stop",
      icon: Stethoscope,
    },
    {
      title: "Chatwork",
      description: "レポート送信",
      href: "/send",
      icon: MessageSquare,
    },
    {
      title: "設定",
      description: "目標・通知設定",
      href: "/settings",
      icon: Settings,
    },
  ];

  // スケルトンUI（キャッシュがない場合のみ表示）
  if (isLoading && !hasCache) {
    return (
      <div className="min-h-screen bg-slate-50">
        <section className="bg-white border-b border-slate-200 -mx-4 lg:-mx-8 -mt-4 lg:-mt-6 px-4 lg:px-8 pt-6 lg:pt-8 pb-8 lg:pb-10">
          <div className="h-4 w-24 bg-slate-200 rounded animate-pulse mb-2" />
          <div className="h-8 w-48 bg-slate-200 rounded animate-pulse mb-6" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-3 lg:p-4">
                <div className="h-3 w-12 bg-slate-200 rounded animate-pulse mb-2" />
                <div className="h-6 w-20 bg-slate-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </section>
        <section className="py-4 lg:py-8">
          <div className="h-5 w-32 bg-slate-200 rounded animate-pulse mb-4" />
          <div className="grid grid-cols-4 gap-1.5 lg:gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-lg lg:rounded-xl p-2 lg:p-4 text-center">
                <div className="h-8 w-8 mx-auto bg-slate-200 rounded animate-pulse mb-1" />
                <div className="h-3 w-10 mx-auto bg-slate-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダーセクション */}
      <section className="bg-white border-b border-slate-200 -mx-4 lg:-mx-8 -mt-4 lg:-mt-6 px-4 lg:px-8 pt-6 lg:pt-8 pb-8 lg:pb-10">
        <p className="text-slate-500 text-sm mb-1">{currentTime}</p>
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight mb-6">
          ダッシュボード
        </h1>

        {/* メイン指標 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 lg:p-4">
            <p className="text-slate-500 text-[10px] lg:text-xs mb-1">当日利益</p>
            <div className="flex items-center gap-1 lg:gap-2">
              {todaySummary.profit >= 0 ? (
                <TrendingUp className="h-3 w-3 lg:h-4 lg:w-4 text-emerald-500 flex-shrink-0" />
              ) : (
                <TrendingDown className="h-3 w-3 lg:h-4 lg:w-4 text-red-500 flex-shrink-0" />
              )}
              <span className={`text-base lg:text-2xl font-bold ${todaySummary.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                <span className="lg:hidden">{formatCurrency(todaySummary.profit, true)}</span>
                <span className="hidden lg:inline">{formatCurrency(todaySummary.profit)}</span>
              </span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 lg:p-4">
            <p className="text-slate-500 text-[10px] lg:text-xs mb-1">12月累計</p>
            <span className={`text-base lg:text-2xl font-bold ${todaySummary.monthlyProfit >= 0 ? "text-slate-800" : "text-red-600"}`}>
              <span className="lg:hidden">{formatCurrency(todaySummary.monthlyProfit, true)}</span>
              <span className="hidden lg:inline">{formatCurrency(todaySummary.monthlyProfit)}</span>
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 lg:p-4">
            <p className="text-slate-500 text-[10px] lg:text-xs mb-1">当日ROAS</p>
            <span className={`text-base lg:text-2xl font-bold ${todaySummary.roas >= 100 ? "text-emerald-600" : "text-red-600"}`}>
              {todaySummary.roas.toFixed(0)}%
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 lg:p-4">
            <p className="text-slate-500 text-[10px] lg:text-xs mb-1">当日CV</p>
            <span className="text-base lg:text-2xl font-bold text-slate-800">
              {todaySummary.cv}<span className="text-xs lg:text-sm ml-1 font-normal text-slate-500">件</span>
            </span>
          </div>
        </div>
      </section>

      {/* CPN判定結果 */}
      <section className="py-4 lg:py-8">
        <div className="flex items-center justify-between mb-3 lg:mb-4">
          <h2 className="text-base lg:text-lg font-bold text-slate-900">CPN判定結果</h2>
          <Link href="/results" className="text-xs lg:text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
            すべて見る <ArrowRight className="h-3 w-3 lg:h-4 lg:w-4" />
          </Link>
        </div>
        
        <div className="grid grid-cols-4 gap-1.5 lg:gap-3">
          <Link href="/results/stop" className="group">
            <div className="bg-white border border-slate-200 rounded-lg lg:rounded-xl p-2 lg:p-4 text-center hover:border-red-300 hover:shadow-sm transition-all">
              <p className="text-xl lg:text-3xl font-bold text-red-500">{summary.stop}</p>
              <p className="text-[10px] lg:text-xs text-slate-500 mt-0.5 lg:mt-1">停止</p>
            </div>
          </Link>
          <Link href="/results/replace" className="group">
            <div className="bg-white border border-slate-200 rounded-lg lg:rounded-xl p-2 lg:p-4 text-center hover:border-amber-300 hover:shadow-sm transition-all">
              <p className="text-xl lg:text-3xl font-bold text-amber-500">{summary.replace}</p>
              <p className="text-[10px] lg:text-xs text-slate-500 mt-0.5 lg:mt-1">作り替え</p>
            </div>
          </Link>
          <Link href="/results/continue" className="group">
            <div className="bg-white border border-slate-200 rounded-lg lg:rounded-xl p-2 lg:p-4 text-center hover:border-emerald-300 hover:shadow-sm transition-all">
              <p className="text-xl lg:text-3xl font-bold text-emerald-500">{summary.continue}</p>
              <p className="text-[10px] lg:text-xs text-slate-500 mt-0.5 lg:mt-1">継続</p>
            </div>
          </Link>
          <Link href="/results/error" className="group">
            <div className="bg-white border border-slate-200 rounded-lg lg:rounded-xl p-2 lg:p-4 text-center hover:border-slate-300 hover:shadow-sm transition-all">
              <p className="text-xl lg:text-3xl font-bold text-slate-400">{summary.error}</p>
              <p className="text-[10px] lg:text-xs text-slate-500 mt-0.5 lg:mt-1">エラー</p>
            </div>
          </Link>
        </div>
      </section>

      {/* メニュー */}
      <section className="pb-6 lg:pb-8">
        <h2 className="text-base lg:text-lg font-bold text-slate-900 mb-3 lg:mb-4">メニュー</h2>
        <div className="grid grid-cols-2 gap-2 lg:gap-3">
          {menuItems.map((item) => (
            <Link key={item.href} href={item.href} className="group">
              <div className="bg-white border border-slate-200 rounded-lg lg:rounded-xl p-3 lg:p-4 hover:border-emerald-300 hover:shadow-sm transition-all h-full active:scale-[0.98]">
                <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg bg-emerald-50 flex items-center justify-center mb-2 lg:mb-3 group-hover:bg-emerald-100 transition-colors">
                  <item.icon className="h-4 w-4 lg:h-5 lg:w-5 text-emerald-600" />
                </div>
                <h3 className="font-bold text-sm lg:text-base text-slate-800 mb-0.5 lg:mb-1">{item.title}</h3>
                <p className="text-[10px] lg:text-xs text-slate-500">{item.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
