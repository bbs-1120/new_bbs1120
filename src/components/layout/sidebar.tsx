"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ListChecks,
  Settings,
  History,
  RefreshCw,
  Send,
} from "lucide-react";

const navigation = [
  { name: "ダッシュボード", href: "/", icon: LayoutDashboard },
  { name: "仕分け結果", href: "/results", icon: ListChecks },
  { name: "データ同期", href: "/sync", icon: RefreshCw },
  { name: "Chatwork送信", href: "/send", icon: Send },
  { name: "実行履歴", href: "/history", icon: History },
  { name: "設定", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-slate-900">
      <div className="flex h-16 items-center px-6">
        <h1 className="text-xl font-bold text-white">
          CPN仕分けシステム
        </h1>
      </div>
      <nav className="mt-6 px-3">
        <ul className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-indigo-600 text-white"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <div className="rounded-lg bg-slate-800 p-3">
          <p className="text-xs text-slate-400">ログインユーザー</p>
          <p className="text-sm font-medium text-white">中田悠太</p>
        </div>
      </div>
    </aside>
  );
}

