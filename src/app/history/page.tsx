"use client";

import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { CheckCircle, XCircle, RefreshCw, PlayCircle, Send } from "lucide-react";
import { useState, useEffect } from "react";

interface ExecutionLog {
  id: string;
  executedAt: string;
  executedBy: string;
  actionType: string;
  targetCount: number;
  ruleVersion: string;
  status: string;
  errorMessage?: string;
}

const actionTypeLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  sync: { label: "データ同期", icon: <RefreshCw className="h-4 w-4" /> },
  judgment: { label: "仕分け実行", icon: <PlayCircle className="h-4 w-4" /> },
  send: { label: "Chatwork送信", icon: <Send className="h-4 w-4" /> },
};

export default function HistoryPage() {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch("/api/logs?limit=50");
        const data = await response.json();
        
        if (data.success) {
          setLogs(data.logs);
        }
      } catch (error) {
        console.error("Failed to fetch logs:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <>
        <Header title="実行履歴" description="データ同期・仕分け実行・送信の履歴" />
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-500">読み込み中...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="実行履歴" description="データ同期・仕分け実行・送信の履歴" />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  実行日時
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  実行者
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  処理種別
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                  対象件数
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  ルールVer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  ステータス
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-900">{formatDate(log.executedAt)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600">{log.executedBy}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      {actionTypeLabels[log.actionType]?.icon}
                      {actionTypeLabels[log.actionType]?.label || log.actionType}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-medium text-slate-900">
                      {log.targetCount}件
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600">v{log.ruleVersion}</span>
                  </td>
                  <td className="px-6 py-4">
                    {log.status === "success" ? (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm">成功</span>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-1 text-red-600">
                          <XCircle className="h-4 w-4" />
                          <span className="text-sm">エラー</span>
                        </div>
                        {log.errorMessage && (
                          <p className="text-xs text-red-500 mt-1">{log.errorMessage}</p>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {logs.length === 0 && (
          <div className="p-8 text-center text-slate-500">実行履歴がありません</div>
        )}
      </Card>
    </>
  );
}
