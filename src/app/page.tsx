"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { 
  TrendingUp, 
  TrendingDown,
  BarChart3,
  FileText,
  Power,
  ChevronRight,
  Settings,
  Zap,
  Users,
} from "lucide-react";

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
const CACHE_DURATION = 30 * 60 * 1000;

export default function HomePage() {
  const [todaySummary, setTodaySummary] = useState<TodaySummary>({
    spend: 0, revenue: 0, profit: 0, roas: 0, cv: 0, mcv: 0, monthlyProfit: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [hasCache, setHasCache] = useState(false);

  const { greeting, currentDate, currentMonth } = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    let greet = "Good Afternoon";
    if (hour >= 5 && hour < 12) greet = "Good Morning";
    else if (hour >= 18 || hour < 5) greet = "Good Evening";
    
    const date = now.toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "long",
      day: "numeric",
      weekday: "short",
    });
    const month = now.getMonth() + 1;
    return { greeting: greet, currentDate: date, currentMonth: month };
  }, []);

  const loadFromCache = useCallback(() => {
    if (typeof window === "undefined") return false;
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          setTodaySummary(data.todaySummary);
          setHasCache(true);
          setIsLoading(false);
          return true;
        }
      }
    } catch {}
    return false;
  }, []);

  const saveToCache = useCallback((data: { todaySummary: TodaySummary }) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
    } catch {}
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const analysisRes = await fetch("/api/analysis", { signal: controller.signal });
      clearTimeout(timeoutId);
      
      const analysisData = await analysisRes.json();
      
      const newTodaySummary = analysisData.success ? {
        spend: analysisData.summary.spend,
        revenue: analysisData.summary.revenue,
        profit: analysisData.summary.profit,
        roas: analysisData.summary.roas,
        cv: analysisData.summary.cv,
        mcv: analysisData.summary.mcv,
        monthlyProfit: analysisData.summary.monthlyProfit || 0,
      } : todaySummary;

      setTodaySummary(newTodaySummary);
      saveToCache({ todaySummary: newTodaySummary });
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [todaySummary, saveToCache]);

  useEffect(() => {
    const hasCachedData = loadFromCache();
    if (hasCachedData) {
      setTimeout(() => fetchData(), 2000);
    } else {
      fetchData();
    }
  }, []);

  const formatNumber = (value: number) => {
    return Math.floor(Math.abs(value)).toLocaleString("ja-JP");
  };

  const menuItems = [
    {
      title: "マイ分析",
      subtitle: "Daily Analytics",
      href: "/analysis",
      icon: BarChart3,
      color: "from-emerald-500 to-teal-600",
    },
    {
      title: "チーム分析",
      subtitle: "Team Analytics",
      href: "/team-analysis",
      icon: Users,
      color: "from-violet-500 to-purple-600",
    },
    {
      title: "週次レポート",
      subtitle: "Weekly Report",
      href: "/reports/weekly",
      icon: FileText,
      color: "from-blue-500 to-indigo-600",
    },
    {
      title: "翌日ON予約",
      subtitle: "Schedule Activation",
      href: "/scheduled-on",
      icon: Power,
      color: "from-amber-500 to-orange-600",
    },
    {
      title: "設定",
      subtitle: "Settings",
      href: "/settings",
      icon: Settings,
      color: "from-slate-500 to-slate-700",
    },
  ];

  // ローディング
  if (isLoading && !hasCache) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 -mx-4 lg:-mx-8 -mt-4 lg:-mt-6 px-6 lg:px-8 pt-12 lg:pt-16">
        <div className="max-w-lg mx-auto">
          <div className="animate-pulse">
            <div className="h-4 w-24 bg-slate-800 rounded mb-2" />
            <div className="h-8 w-32 bg-slate-800 rounded mb-16" />
            <div className="h-48 bg-slate-800/50 rounded-3xl mb-8" />
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-slate-800/50 rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const profitIsPositive = todaySummary.profit >= 0;
  const monthlyIsPositive = todaySummary.monthlyProfit >= 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 -mx-4 lg:-mx-8 -mt-4 lg:-mt-6 px-6 lg:px-8 pt-10 lg:pt-14 pb-16">
      <div className="max-w-lg mx-auto">
        
        {/* ヘッダー */}
        <header className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-4 w-4 text-amber-400" />
            <p className="text-xs text-slate-500 font-medium tracking-widest uppercase">
              {greeting}
            </p>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            {currentDate}
          </h1>
        </header>

        {/* メインカード */}
        <div className="relative mb-8">
          {/* 背景のグロー効果 */}
          <div className={`absolute inset-0 rounded-3xl blur-xl opacity-20 ${
            profitIsPositive ? "bg-emerald-500" : "bg-red-500"
          }`} />
          
          <div className="relative bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-3xl border border-slate-700/50 p-6 shadow-2xl">
            
            {/* 当日利益 */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-400">
                  本日の利益
                </span>
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  todaySummary.roas >= 100 
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                    : "bg-red-500/20 text-red-400 border border-red-500/30"
                }`}>
                  {todaySummary.roas >= 100 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  ROAS {todaySummary.roas.toFixed(0)}%
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl lg:text-5xl font-black tracking-tight ${
                  profitIsPositive ? "text-white" : "text-red-400"
                }`}>
                  {profitIsPositive ? "+" : "-"}¥{formatNumber(todaySummary.profit)}
                </span>
              </div>
            </div>

            {/* 区切り線 */}
            <div className="h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent mb-6" />

            {/* 月間累計 */}
            <div className="flex items-end justify-between">
              <div>
                <span className="text-sm font-medium text-slate-400 block mb-2">
                  {currentMonth}月累計
                </span>
                <span className={`text-2xl lg:text-3xl font-bold tracking-tight ${
                  monthlyIsPositive ? "text-emerald-400" : "text-red-400"
                }`}>
                  {monthlyIsPositive ? "+" : "-"}¥{formatNumber(todaySummary.monthlyProfit)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 block mb-1">CV</span>
                <span className="text-2xl font-bold text-white">
                  {todaySummary.cv}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ナビゲーションメニュー */}
        <nav>
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-3 px-1">
            Menu
          </p>
          <div className="space-y-2">
            {menuItems.map((item) => (
              <Link 
                key={item.href} 
                href={item.href}
                className="group block"
              >
                <div className="relative overflow-hidden bg-slate-800/50 hover:bg-slate-800 rounded-2xl border border-slate-700/50 hover:border-slate-600 p-4 transition-all duration-300 active:scale-[0.98]">
                  <div className="flex items-center gap-4">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      <item.icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[15px] font-bold text-white">
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {item.subtitle}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-600 group-hover:text-slate-400 group-hover:translate-x-1 transition-all duration-300" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </nav>

        {/* クイックリンク */}
        <div className="mt-8 flex items-center justify-center gap-8">
          <Link 
            href="/results" 
            className="text-xs text-slate-500 hover:text-emerald-400 transition-colors font-medium"
          >
            判断結果 →
          </Link>
          <Link 
            href="/history" 
            className="text-xs text-slate-500 hover:text-emerald-400 transition-colors font-medium"
          >
            実行履歴 →
          </Link>
        </div>

        {/* フッター */}
        <footer className="mt-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700/50">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] text-slate-500 font-medium">
              GrowthDeck
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
