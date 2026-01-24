"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Search, Bell, HelpCircle, X, History, AlertTriangle, CheckCircle, User, LogOut, Users, ChevronDown } from "lucide-react";

interface HeaderProps {
  title: string;
  description?: string;
}

interface Notification {
  id: string;
  type: "success" | "error" | "info" | "warning";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export function Header({ title, description }: HeaderProps) {
  const { data: session } = useSession();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    // ローカルストレージから通知を読み込み
    const loadNotifications = () => {
      try {
        const stored = localStorage.getItem("adpilot-notifications");
        if (stored) {
          setNotifications(JSON.parse(stored));
        }
      } catch {
        setNotifications([]);
      }
    };

    loadNotifications();
    
    // 変更履歴から通知を生成
    const handleHistoryUpdate = () => {
      try {
        const history = localStorage.getItem("adpilot-change-history");
        if (history) {
          const changes = JSON.parse(history).slice(0, 5);
          const newNotifications: Notification[] = changes.map((change: { id: string; type: string; cpnName: string; newValue: string | number; timestamp: string; success: boolean }) => ({
            id: change.id,
            type: change.success ? "success" : "error",
            title: change.type === "budget" ? "予算変更" : "ステータス変更",
            message: `${change.cpnName.substring(0, 30)}... → ${change.newValue}`,
            timestamp: change.timestamp,
            read: false,
          }));
          setNotifications(newNotifications);
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener("change-history-updated", handleHistoryUpdate);
    handleHistoryUpdate();

    return () => {
      window.removeEventListener("change-history-updated", handleHistoryUpdate);
    };
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 1) return "たった今";
    if (diffMins < 60) return `${diffMins}分前`;
    if (diffHours < 24) return `${diffHours}時間前`;
    return then.toLocaleDateString("ja-JP");
  };

  return (
    <header className="mb-4 lg:mb-6">
      {/* トップバー - デスクトップのみ表示 */}
      <div className="hidden lg:flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-slate-200 shadow-sm w-80">
            <Search className="h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="検索..." 
              className="flex-1 bg-transparent text-sm text-slate-600 placeholder:text-slate-400 focus:outline-none"
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-100 rounded border border-slate-200">
              ⌘K
            </kbd>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <HelpCircle className="h-5 w-5" />
          </button>
          
          {/* 通知ベル */}
          <div className="relative">
            <button 
              onClick={() => {
                setShowNotifications(!showNotifications);
                if (!showNotifications) markAllAsRead();
              }}
              className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-[#e01e5a] rounded-full text-[10px] text-white font-bold flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {/* 通知パネル */}
            {showNotifications && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowNotifications(false)}
                />
                <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
                  <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      通知
                    </h3>
                    <div className="flex gap-1">
                      {notifications.length > 0 && (
                        <button 
                          onClick={clearAll}
                          className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100"
                        >
                          クリア
                        </button>
                      )}
                      <button 
                        onClick={() => setShowNotifications(false)}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <Bell className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                        <p className="text-sm text-slate-500">通知はありません</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {notifications.map((notif) => (
                          <div 
                            key={notif.id}
                            className={`p-3 hover:bg-slate-50 ${
                              !notif.read ? "bg-emerald-50/50" : ""
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <div className={`p-1 rounded ${
                                notif.type === "success" ? "bg-emerald-100 text-emerald-600" :
                                notif.type === "error" ? "bg-red-100 text-red-600" :
                                notif.type === "warning" ? "bg-amber-100 text-amber-600" :
                                "bg-blue-100 text-blue-600"
                              }`}>
                                {notif.type === "success" ? <CheckCircle className="h-3 w-3" /> :
                                 notif.type === "error" ? <AlertTriangle className="h-3 w-3" /> :
                                 <History className="h-3 w-3" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-slate-900">{notif.title}</p>
                                <p className="text-xs text-slate-500 truncate">{notif.message}</p>
                                <p className="text-[10px] text-slate-400 mt-1">{formatTimeAgo(notif.timestamp)}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ユーザーメニュー */}
          {session?.user && (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors"
              >
                <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="text-left hidden lg:block">
                  <p className="text-sm font-medium text-slate-700 truncate max-w-[100px]">
                    {session.user.name || session.user.email?.split("@")[0]}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {session.user.role === "admin" ? "管理者" : session.user.teamName || "メンバー"}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>

              {showUserMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="absolute right-0 top-12 w-56 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden py-1">
                    <div className="px-3 py-2 border-b border-slate-100">
                      <p className="text-sm font-medium text-slate-900">{session.user.name}</p>
                      <p className="text-xs text-slate-500">{session.user.email}</p>
                      {session.user.teamName && (
                        <p className="text-xs text-blue-600 mt-1">担当: {session.user.teamName}</p>
                      )}
                    </div>

                    {session.user.role === "admin" && (
                      <Link
                        href="/admin/members"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <Users className="h-4 w-4" />
                        メンバー管理
                      </Link>
                    )}

                    <button
                      onClick={() => signOut({ callbackUrl: "/login" })}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" />
                      ログアウト
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* タイトル */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-800 tracking-tight">{title}</h1>
          {description && (
            <p className="text-xs lg:text-sm text-slate-500 mt-0.5">{description}</p>
          )}
        </div>
      </div>
    </header>
  );
}
