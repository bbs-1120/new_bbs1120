"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  ListChecks,
  Settings,
  History,
  RefreshCw,
  Send,
  BarChart3,
  Sparkles,
  PieChart,
  ChevronDown,
  MessageSquare,
  Zap,
  Menu,
  X,
  Clock,
} from "lucide-react";
import { DarkModeToggle } from "@/components/ui/dark-mode-toggle";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavCategory {
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

const navigation: NavCategory[] = [
  {
    category: "データ分析",
    icon: PieChart,
    items: [
      { name: "デイリーレポート", href: "/analysis", icon: BarChart3 },
      { name: "CPN診断", href: "/", icon: Zap },
      { name: "判断結果", href: "/results", icon: ListChecks },
    ],
  },
  {
    category: "操作",
    icon: Send,
    items: [
      { name: "Chatwork送信", href: "/send", icon: MessageSquare },
      { name: "データ同期", href: "/sync", icon: RefreshCw },
    ],
  },
  {
    category: "システム",
    icon: Settings,
    items: [
      { name: "実行履歴", href: "/history", icon: History },
      { name: "設定", href: "/settings", icon: Settings },
    ],
  },
];

// サイドバー用の時計コンポーネント
function SidebarClock() {
  const [time, setTime] = useState<string>("");
  const [date, setDate] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("ja-JP", {
        timeZone: "Asia/Tokyo",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      const dateStr = now.toLocaleDateString("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        weekday: "short",
      });
      setTime(timeStr);
      setDate(dateStr);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mx-2 mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
      <div className="flex items-center gap-2 mb-1">
        <Clock className="h-4 w-4 text-[#36c5f0]" />
        <span className="text-xs text-white/60">日本時間</span>
      </div>
      <div className="text-2xl font-mono font-bold text-white tracking-wider">
        {time}
      </div>
      <div className="text-xs text-white/50 mt-0.5">
        {date}
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // ページ遷移時にメニューを閉じる
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // メニューが開いている時はスクロールを無効化
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      {/* モバイルヘッダー */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-[#3f0e40] flex items-center justify-between px-4 border-b border-white/10">
        <button
          onClick={() => setIsOpen(true)}
          className="p-2 -ml-2 rounded-lg hover:bg-white/10 transition-colors"
        >
          <Menu className="h-6 w-6 text-white" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#36c5f0] to-[#2eb67d] flex items-center justify-center">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="text-white font-bold">GrowthDeck</span>
        </div>
        <DarkModeToggle />
      </div>

      {/* オーバーレイ（モバイル） */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* サイドバー */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 lg:w-64 bg-[#3f0e40] flex flex-col transition-transform duration-300 ease-in-out",
          "lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#36c5f0] to-[#2eb67d] flex items-center justify-center shadow-lg">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-[15px] font-bold text-white tracking-tight">GrowthDeck</h1>
              <p className="text-[10px] text-white/50 -mt-0.5">広告運用ダッシュボード</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="hidden lg:block">
              <DarkModeToggle />
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>

        {/* ナビゲーション */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          {/* 時計 */}
          <SidebarClock />
          
          {navigation.map((category) => (
            <div key={category.category} className="mb-5">
              {/* カテゴリヘッダー */}
              <div className="flex items-center gap-1.5 px-3 py-1 text-white/60 hover:text-white/90 cursor-pointer group">
                <ChevronDown className="h-3 w-3 transition-transform" />
                <span className="text-[13px] font-medium tracking-wide">
                  {category.category}
                </span>
              </div>
              
              {/* アイテム */}
              <ul className="mt-1 space-y-0.5">
                {category.items.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-3 py-2.5 lg:py-1.5 text-[15px] transition-all",
                          isActive
                            ? "bg-[#1164a3] text-white font-medium"
                            : "text-white/70 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        <Icon className={cn(
                          "h-5 w-5 lg:h-4 lg:w-4",
                          isActive ? "text-white" : "text-white/50"
                        )} />
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* フッター - ユーザー情報 */}
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-white/10 cursor-pointer">
            <div className="relative">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#36c5f0] to-[#2eb67d] flex items-center justify-center text-white font-bold text-sm">
                悠
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#2eb67d] rounded-full border-2 border-[#3f0e40]"></div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">中田悠太</p>
              <p className="text-xs text-white/50 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-[#2eb67d] rounded-full"></span>
                アクティブ
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
