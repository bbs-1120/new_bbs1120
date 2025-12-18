"use client";

import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { RefreshCw, CheckCircle, AlertCircle, Clock } from "lucide-react";

interface SyncStatus {
  lastSync: string | null;
  status: "idle" | "syncing" | "success" | "error";
  message: string;
  recordCount: number;
}

export default function SyncPage() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    lastSync: "2024/12/18 09:30",
    status: "idle",
    message: "",
    recordCount: 156,
  });

  const handleSync = async () => {
    setSyncStatus((prev) => ({
      ...prev,
      status: "syncing",
      message: "スプレッドシートからデータを取得中...",
    }));

    // TODO: 実際の同期処理
    await new Promise((resolve) => setTimeout(resolve, 3000));

    setSyncStatus({
      lastSync: new Date().toLocaleString("ja-JP"),
      status: "success",
      message: "同期が完了しました",
      recordCount: 162,
    });
  };

  return (
    <>
      <Header
        title="データ同期"
        description="スプレッドシートからデータを取得してDBに同期"
      />

      <div className="max-w-2xl space-y-6">
        {/* 同期ステータス */}
        <Card>
          <CardHeader>
            <CardTitle>同期ステータス</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">最終同期日時</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {syncStatus.lastSync || "未実行"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500">取得レコード数</p>
                  <p className="text-2xl font-bold text-indigo-600">
                    {syncStatus.recordCount}
                  </p>
                </div>
              </div>

              {syncStatus.status === "success" && (
                <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg">
                  <CheckCircle className="h-5 w-5" />
                  <span>{syncStatus.message}</span>
                </div>
              )}

              {syncStatus.status === "error" && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg">
                  <AlertCircle className="h-5 w-5" />
                  <span>{syncStatus.message}</span>
                </div>
              )}

              {syncStatus.status === "syncing" && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg">
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span>{syncStatus.message}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 同期実行 */}
        <Card>
          <CardHeader>
            <CardTitle>同期を実行</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 mb-4">
              Google スプレッドシートのRAWシートからデータを取得し、
              データベースに同期します。既存のデータは上書きされます。
            </p>

            <Button
              size="lg"
              onClick={handleSync}
              loading={syncStatus.status === "syncing"}
              className="w-full"
            >
              <RefreshCw className="mr-2 h-5 w-5" />
              {syncStatus.status === "syncing" ? "同期中..." : "同期を実行"}
            </Button>
          </CardContent>
        </Card>

        {/* 同期対象シート */}
        <Card>
          <CardHeader>
            <CardTitle>同期対象シート</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                <div>
                  <p className="font-medium text-slate-900">RAW</p>
                  <p className="text-sm text-slate-500">媒体からの生データ</p>
                </div>
                <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">
                  対象
                </span>
              </div>
              <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg opacity-50">
                <div>
                  <p className="font-medium text-slate-900">SETTINGS</p>
                  <p className="text-sm text-slate-500">設定値（管理画面で管理）</p>
                </div>
                <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-500 rounded">
                  対象外
                </span>
              </div>
              <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg opacity-50">
                <div>
                  <p className="font-medium text-slate-900">OUTPUT</p>
                  <p className="text-sm text-slate-500">仕分け結果（DBから生成）</p>
                </div>
                <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-500 rounded">
                  対象外
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

