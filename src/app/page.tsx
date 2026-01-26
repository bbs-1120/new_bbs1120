"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { 
  Heart,
  MessageCircle,
  Bookmark,
  MoreHorizontal,
  TrendingUp,
  TrendingDown,
  BarChart3,
  FileText,
  Power,
  Settings,
  Users,
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowRight,
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

interface ActivityItem {
  id: string;
  type: "profit" | "alert" | "success" | "info";
  title: string;
  description: string;
  value?: string;
  time: string;
  icon: "trending" | "alert" | "check" | "info";
}

const CACHE_KEY = "home_data_cache";

// ストーリーズ風クイックアクセス
const quickAccess = [
  { id: "analysis", label: "マイ分析", href: "/analysis", color: "from-pink-500 to-rose-500", icon: BarChart3 },
  { id: "team", label: "チーム", href: "/team-analysis", color: "from-purple-500 to-violet-500", icon: Users },
  { id: "report", label: "レポート", href: "/reports/weekly", color: "from-blue-500 to-cyan-500", icon: FileText },
  { id: "schedule", label: "予約", href: "/scheduled-on", color: "from-amber-500 to-orange-500", icon: Power },
  { id: "rules", label: "ルール", href: "/judgment-rules", color: "from-emerald-500 to-teal-500", icon: Zap },
  { id: "settings", label: "設定", href: "/settings", color: "from-slate-400 to-slate-600", icon: Settings },
];

export default function HomePage() {
  const { data: session } = useSession();
  const [todaySummary, setTodaySummary] = useState<TodaySummary>({
    spend: 0, revenue: 0, profit: 0, roas: 0, cv: 0, mcv: 0, monthlyProfit: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set());

  const userName = session?.user?.name || session?.user?.email?.split("@")[0] || "ユーザー";
  const userTeamName = session?.user?.teamName || null;

  const fetchData = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      // キャッシュをスキップして最新データを取得（ユーザー別フィルタリングを確実に適用）
      const analysisRes = await fetch("/api/analysis?refresh=true", { signal: controller.signal });
      clearTimeout(timeoutId);
      
      const analysisData = await analysisRes.json();
      
      if (analysisData.success) {
        const newTodaySummary = {
          spend: analysisData.summary.spend,
          revenue: analysisData.summary.revenue,
          profit: analysisData.summary.profit,
          roas: analysisData.summary.roas,
          cv: analysisData.summary.cv,
          mcv: analysisData.summary.mcv,
          monthlyProfit: analysisData.summary.monthlyProfit || 0,
        };
        setTodaySummary(newTodaySummary);

        // デバッグ情報をログに出力
        if (analysisData._debug) {
          console.log("Analysis API Debug:", analysisData._debug);
        }

        // アクティビティを生成
        const newActivities: ActivityItem[] = [];
        
        // 利益情報
        newActivities.push({
          id: "profit-today",
          type: newTodaySummary.profit >= 0 ? "profit" : "alert",
          title: "本日のパフォーマンス",
          description: `ROAS ${newTodaySummary.roas.toFixed(0)}% | CV ${newTodaySummary.cv}件`,
          value: `${newTodaySummary.profit >= 0 ? "+" : ""}¥${Math.floor(newTodaySummary.profit).toLocaleString()}`,
          time: "今日",
          icon: newTodaySummary.profit >= 0 ? "trending" : "alert",
        });

        // 月間累計
        newActivities.push({
          id: "monthly-profit",
          type: newTodaySummary.monthlyProfit >= 0 ? "success" : "alert",
          title: "今月の累計利益",
          description: `消化: ¥${Math.floor(newTodaySummary.spend).toLocaleString()}`,
          value: `${newTodaySummary.monthlyProfit >= 0 ? "+" : ""}¥${Math.floor(newTodaySummary.monthlyProfit).toLocaleString()}`,
          time: "今月",
          icon: newTodaySummary.monthlyProfit >= 0 ? "check" : "alert",
        });

        // CV情報
        if (newTodaySummary.cv > 0) {
          newActivities.push({
            id: "cv-info",
            type: "info",
            title: "コンバージョン",
            description: `本日 ${newTodaySummary.cv}件のCVを獲得しました`,
            time: "今日",
            icon: "info",
          });
        }

        setActivities(newActivities);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // ユーザー別データを取得するため、常に最新データを取得
    // ローカルキャッシュをクリアして新しいデータを取得
    if (typeof window !== "undefined") {
      localStorage.removeItem(CACHE_KEY);
    }
    fetchData();
  }, []);

  const toggleLike = (postId: string) => {
    setLikedPosts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  const toggleSave = (postId: string) => {
    setSavedPosts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  const formatNumber = (value: number) => {
    return Math.floor(Math.abs(value)).toLocaleString("ja-JP");
  };

  const getIconComponent = (iconType: string) => {
    switch (iconType) {
      case "trending": return TrendingUp;
      case "alert": return AlertTriangle;
      case "check": return CheckCircle;
      default: return Zap;
    }
  };

  // ローディング
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white -mx-4 lg:-mx-8 -mt-4 lg:-mt-6">
        <div className="max-w-2xl mx-auto px-4">
          {/* ストーリーズスケルトン */}
          <div className="py-4 border-b border-gray-100">
            <div className="flex gap-4 overflow-x-auto pb-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2 animate-pulse">
                  <div className="w-16 h-16 rounded-full bg-gray-200" />
                  <div className="w-12 h-3 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          </div>
          {/* フィードスケルトン */}
          <div className="py-4 space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="border border-gray-100 rounded-lg p-4 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gray-200" />
                  <div className="flex-1">
                    <div className="w-24 h-4 bg-gray-200 rounded mb-2" />
                    <div className="w-16 h-3 bg-gray-200 rounded" />
                  </div>
                </div>
                <div className="h-32 bg-gray-200 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const profitIsPositive = todaySummary.profit >= 0;

  return (
    <div className="min-h-screen bg-white -mx-4 lg:-mx-8 -mt-4 lg:-mt-6">
      <div className="flex">
        {/* メインフィード */}
        <div className="flex-1 max-w-2xl mx-auto border-x border-gray-100">
          
          {/* ストーリーズ風クイックアクセス */}
          <div className="py-4 px-4 border-b border-gray-100 bg-white">
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {quickAccess.map((item) => (
                <Link 
                  key={item.id} 
                  href={item.href}
                  className="flex flex-col items-center gap-1.5 flex-shrink-0 group"
                >
                  <div className={`p-0.5 rounded-full bg-gradient-to-tr ${item.color}`}>
                    <div className="p-0.5 rounded-full bg-white">
                      <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${item.color} flex items-center justify-center group-hover:scale-105 transition-transform`}>
                        <item.icon className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-600 font-medium">
                    {item.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* フィード */}
          <div className="divide-y divide-gray-100">
            
            {/* サマリーカード（投稿風） */}
            <article className="bg-white">
              {/* ヘッダー */}
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    profitIsPositive ? "bg-gradient-to-br from-emerald-400 to-teal-500" : "bg-gradient-to-br from-red-400 to-rose-500"
                  }`}>
                    {profitIsPositive ? (
                      <TrendingUp className="w-5 h-5 text-white" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">AdProfit</p>
                    <p className="text-xs text-gray-500">本日のサマリー</p>
                  </div>
                </div>
                <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <MoreHorizontal className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* コンテンツ */}
              <div className={`mx-3 rounded-xl p-6 ${
                profitIsPositive 
                  ? "bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100" 
                  : "bg-gradient-to-br from-red-50 to-rose-50 border border-red-100"
              }`}>
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-2">本日の利益</p>
                  <p className={`text-4xl font-bold mb-4 ${
                    profitIsPositive ? "text-emerald-600" : "text-red-600"
                  }`}>
                    {profitIsPositive ? "+" : "-"}¥{formatNumber(todaySummary.profit)}
                  </p>
                  <div className="flex items-center justify-center gap-6 text-sm">
                    <div>
                      <span className="text-gray-500">ROAS</span>
                      <p className={`font-bold ${todaySummary.roas >= 100 ? "text-emerald-600" : "text-red-600"}`}>
                        {todaySummary.roas.toFixed(0)}%
                      </p>
                    </div>
                    <div className="w-px h-8 bg-gray-200" />
                    <div>
                      <span className="text-gray-500">CV</span>
                      <p className="font-bold text-gray-900">{todaySummary.cv}</p>
                    </div>
                    <div className="w-px h-8 bg-gray-200" />
                    <div>
                      <span className="text-gray-500">消化</span>
                      <p className="font-bold text-gray-900">¥{formatNumber(todaySummary.spend)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* アクション */}
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => toggleLike("summary")}
                    className="hover:opacity-70 transition-opacity"
                  >
                    <Heart className={`w-6 h-6 ${likedPosts.has("summary") ? "fill-red-500 text-red-500" : "text-gray-900"}`} />
                  </button>
                  <Link href="/analysis" className="hover:opacity-70 transition-opacity">
                    <MessageCircle className="w-6 h-6 text-gray-900" />
                  </Link>
                </div>
                <button 
                  onClick={() => toggleSave("summary")}
                  className="hover:opacity-70 transition-opacity"
                >
                  <Bookmark className={`w-6 h-6 ${savedPosts.has("summary") ? "fill-gray-900 text-gray-900" : "text-gray-900"}`} />
                </button>
              </div>

              {/* いいね数 */}
              <div className="px-3 pb-3">
                <p className="text-sm font-semibold text-gray-900">
                  {likedPosts.has("summary") ? "あなた" : ""}がチェックしました
                </p>
                <Link href="/analysis" className="text-sm text-gray-500 hover:text-gray-900">
                  詳細を見る
                </Link>
              </div>
            </article>

            {/* アクティビティカード */}
            {activities.map((activity) => {
              const IconComponent = getIconComponent(activity.icon);
              return (
                <article key={activity.id} className="bg-white">
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        activity.type === "profit" ? "bg-gradient-to-br from-emerald-400 to-teal-500" :
                        activity.type === "alert" ? "bg-gradient-to-br from-amber-400 to-orange-500" :
                        activity.type === "success" ? "bg-gradient-to-br from-blue-400 to-indigo-500" :
                        "bg-gradient-to-br from-purple-400 to-violet-500"
                      }`}>
                        <IconComponent className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{activity.title}</p>
                        <p className="text-xs text-gray-500">{activity.time}</p>
                      </div>
                    </div>
                    <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                      <MoreHorizontal className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>

                  <div className="px-3 pb-3">
                    <p className="text-sm text-gray-600 mb-2">{activity.description}</p>
                    {activity.value && (
                      <p className={`text-2xl font-bold ${
                        activity.type === "profit" || activity.type === "success" ? "text-emerald-600" : 
                        activity.type === "alert" ? "text-amber-600" : "text-gray-900"
                      }`}>
                        {activity.value}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 px-3 pb-3">
                    <button 
                      onClick={() => toggleLike(activity.id)}
                      className="hover:opacity-70 transition-opacity"
                    >
                      <Heart className={`w-5 h-5 ${likedPosts.has(activity.id) ? "fill-red-500 text-red-500" : "text-gray-600"}`} />
                    </button>
                  </div>
                </article>
              );
            })}

            {/* クイックリンクカード */}
            <article className="bg-white p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Quick Links
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Link 
                  href="/results"
                  className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors group"
                >
                  <span className="text-sm font-medium text-gray-700">判定結果一覧</span>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link 
                  href="/results/stop"
                  className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors group"
                >
                  <span className="text-sm font-medium text-gray-700">CPN診断</span>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link 
                  href="/auto-stop-rules"
                  className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors group"
                >
                  <span className="text-sm font-medium text-gray-700">自動停止ルール</span>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link 
                  href="/history"
                  className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors group"
                >
                  <span className="text-sm font-medium text-gray-700">実行履歴</span>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </article>
          </div>
        </div>

        {/* 右サイドバー（デスクトップのみ） */}
        <aside className="hidden xl:block w-80 p-6 sticky top-20 h-fit">
          {/* ユーザー情報 */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 p-0.5">
              <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                <span className="text-lg font-bold text-gray-700">
                  {userName.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">{userName}</p>
              <p className="text-sm text-gray-500">{session?.user?.teamName || "AdProfit"}</p>
            </div>
            <button className="text-xs font-semibold text-blue-500 hover:text-blue-600">
              切替
            </button>
          </div>

          {/* おすすめ */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-gray-500">おすすめ</p>
              <Link href="/analysis" className="text-xs font-semibold text-gray-900 hover:text-gray-600">
                すべて見る
              </Link>
            </div>
            <div className="space-y-3">
              <Link href="/analysis" className="flex items-center gap-3 group">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">マイ分析</p>
                  <p className="text-xs text-gray-500">詳細データを確認</p>
                </div>
                <span className="text-xs font-semibold text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  開く
                </span>
              </Link>
              <Link href="/team-analysis" className="flex items-center gap-3 group">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-violet-500 flex items-center justify-center">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">チーム分析</p>
                  <p className="text-xs text-gray-500">チーム全体の成績</p>
                </div>
                <span className="text-xs font-semibold text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  開く
                </span>
              </Link>
              <Link href="/reports/weekly" className="flex items-center gap-3 group">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">週次レポート</p>
                  <p className="text-xs text-gray-500">週間パフォーマンス</p>
                </div>
                <span className="text-xs font-semibold text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  開く
                </span>
              </Link>
            </div>
          </div>

          {/* 月間サマリー */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              今月のサマリー
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">累計利益</span>
                <span className={`text-sm font-bold ${todaySummary.monthlyProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {todaySummary.monthlyProfit >= 0 ? "+" : ""}¥{formatNumber(todaySummary.monthlyProfit)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">本日CV</span>
                <span className="text-sm font-bold text-gray-900">{todaySummary.cv}件</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">ROAS</span>
                <span className={`text-sm font-bold ${todaySummary.roas >= 100 ? "text-emerald-600" : "text-red-600"}`}>
                  {todaySummary.roas.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>

          {/* フッター */}
          <footer className="mt-8 text-xs text-gray-400 space-y-2">
            <div className="flex flex-wrap gap-x-2">
              <span>AdProfit</span>
              <span>・</span>
              <span>ヘルプ</span>
              <span>・</span>
              <span>API</span>
            </div>
            <p>&copy; 2026 AdProfit from Growth</p>
          </footer>
        </aside>
      </div>
    </div>
  );
}
