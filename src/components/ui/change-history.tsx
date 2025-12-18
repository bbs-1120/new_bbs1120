"use client";

import { useState, useEffect } from "react";
import { History, DollarSign, Power, Trash2, X } from "lucide-react";
import { Button } from "./button";

export interface ChangeRecord {
  id: string;
  timestamp: string;
  type: "budget" | "status";
  cpnName: string;
  media: string;
  oldValue?: string | number;
  newValue: string | number;
  success: boolean;
}

interface ChangeHistoryProps {
  onClose?: () => void;
}

export function ChangeHistory({ onClose }: ChangeHistoryProps) {
  const [history, setHistory] = useState<ChangeRecord[]>([]);

  useEffect(() => {
    loadHistory();
    
    // 変更があった時に更新
    const handleStorageChange = () => loadHistory();
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("change-history-updated", handleStorageChange);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("change-history-updated", handleStorageChange);
    };
  }, []);

  const loadHistory = () => {
    try {
      const stored = localStorage.getItem("adpilot-change-history");
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch {
      setHistory([]);
    }
  };

  const clearHistory = () => {
    localStorage.removeItem("adpilot-change-history");
    setHistory([]);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 1) return "たった今";
    if (diffMins < 60) return `${diffMins}分前`;
    if (diffHours < 24) return `${diffHours}時間前`;
    return formatTime(timestamp);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* ヘッダー */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-500/10 to-purple-500/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-500 rounded-lg">
              <History className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">変更履歴</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                本日の操作: {history.filter(h => {
                  const today = new Date().toDateString();
                  return new Date(h.timestamp).toDateString() === today;
                }).length}件
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {history.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearHistory}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 履歴リスト */}
      <div className="max-h-80 overflow-y-auto">
        {history.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>変更履歴はありません</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {history.slice(0, 20).map((record) => (
              <div 
                key={record.id}
                className={`p-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 ${
                  !record.success ? 'bg-red-50 dark:bg-red-900/10' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-1.5 rounded-lg ${
                    record.type === "budget" 
                      ? "bg-green-100 dark:bg-green-900/30 text-green-600" 
                      : "bg-blue-100 dark:bg-blue-900/30 text-blue-600"
                  }`}>
                    {record.type === "budget" ? (
                      <DollarSign className="h-4 w-4" />
                    ) : (
                      <Power className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        record.media === "Meta" ? "bg-blue-100 text-blue-700" :
                        record.media === "TikTok" ? "bg-pink-100 text-pink-700" :
                        "bg-orange-100 text-orange-700"
                      }`}>
                        {record.media}
                      </span>
                      <span className="text-xs text-slate-400">{getTimeAgo(record.timestamp)}</span>
                      {!record.success && (
                        <span className="text-xs text-red-500">失敗</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-900 dark:text-white truncate mt-1" title={record.cpnName}>
                      {record.cpnName}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {record.type === "budget" ? (
                        <>予算: ¥{Number(record.oldValue || 0).toLocaleString()} → <span className="font-bold text-green-600">¥{Number(record.newValue).toLocaleString()}</span></>
                      ) : (
                        <>ステータス: <span className={`font-bold ${record.newValue === "ON" ? "text-green-600" : "text-red-500"}`}>{record.newValue}</span></>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// 履歴を追加するユーティリティ関数
export function addChangeRecord(record: Omit<ChangeRecord, "id" | "timestamp">) {
  try {
    const stored = localStorage.getItem("adpilot-change-history");
    const history: ChangeRecord[] = stored ? JSON.parse(stored) : [];
    
    const newRecord: ChangeRecord = {
      ...record,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };
    
    // 最新を先頭に追加、最大100件保持
    const updated = [newRecord, ...history].slice(0, 100);
    localStorage.setItem("adpilot-change-history", JSON.stringify(updated));
    
    // カスタムイベントを発火して他のコンポーネントに通知
    window.dispatchEvent(new Event("change-history-updated"));
    
    return newRecord;
  } catch (error) {
    console.error("Failed to add change record:", error);
    return null;
  }
}

