"use client";

import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NotificationSettings } from "@/components/ui/notification-settings";
import { AnomalyPanel } from "@/components/ui/anomaly-panel";
import { useState, useEffect } from "react";
import { Save, CheckCircle } from "lucide-react";

interface Settings {
  stopReConsecutiveLossDays: string;
  replaceNoReConsecutiveLossDays: string;
  lossThreshold7Days: string;
  roasThresholdStop: string;
  roasThresholdContinue: string;
  chatworkRoomId: string;
  chatworkApiToken: string;
  spreadsheetId: string;
  ruleVersion: string;
}

const defaultSettings: Settings = {
  stopReConsecutiveLossDays: "2",
  replaceNoReConsecutiveLossDays: "3",
  lossThreshold7Days: "40000",
  roasThresholdStop: "105",
  roasThresholdContinue: "110",
  chatworkRoomId: "",
  chatworkApiToken: "",
  spreadsheetId: "",
  ruleVersion: "1.0",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 設定を読み込み
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/settings");
        const data = await response.json();
        
        if (data.success) {
          setSettings({ ...defaultSettings, ...data.settings });
        }
      } catch (error) {
        console.error("Failed to fetch settings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleChange = (key: keyof Settings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessage({ type: "success", text: "設定を保存しました" });
      } else {
        setMessage({ type: "error", text: data.error || "保存に失敗しました" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "通信エラーが発生しました" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <Header title="設定" description="仕分けルール・API連携の設定" />
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-500">読み込み中...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="設定" description="仕分けルール・API連携の設定" />

      {/* メッセージ表示 */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.type === "success" && <CheckCircle className="h-5 w-5" />}
          {message.text}
        </div>
      )}

      <div className="grid gap-6 max-w-3xl">
        {/* 仕分けルール設定 */}
        <Card>
          <CardHeader>
            <CardTitle>仕分けルール設定</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  停止条件: 連続赤字日数（Reあり）
                </label>
                <input
                  type="number"
                  value={settings.stopReConsecutiveLossDays}
                  onChange={(e) => handleChange("stopReConsecutiveLossDays", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="mt-1 text-xs text-slate-500">
                  この日数以上連続で赤字の場合、停止判定
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  作り替え条件: 連続赤字日数（Reなし）
                </label>
                <input
                  type="number"
                  value={settings.replaceNoReConsecutiveLossDays}
                  onChange={(e) => handleChange("replaceNoReConsecutiveLossDays", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="mt-1 text-xs text-slate-500">
                  この日数以上連続で赤字の場合、作り替え判定
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                7日間赤字額閾値（円）
              </label>
              <input
                type="number"
                value={settings.lossThreshold7Days}
                onChange={(e) => handleChange("lossThreshold7Days", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="mt-1 text-xs text-slate-500">
                7日間の累積赤字がこの金額以上で停止/作り替え判定
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  ROAS閾値: 停止/作り替え（%）
                </label>
                <input
                  type="number"
                  value={settings.roasThresholdStop}
                  onChange={(e) => handleChange("roasThresholdStop", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="mt-1 text-xs text-slate-500">この値未満で停止/作り替え判定</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  ROAS閾値: 継続（%）
                </label>
                <input
                  type="number"
                  value={settings.roasThresholdContinue}
                  onChange={(e) => handleChange("roasThresholdContinue", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="mt-1 text-xs text-slate-500">この値以上で継続判定</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                ルールバージョン
              </label>
              <input
                type="text"
                value={settings.ruleVersion}
                onChange={(e) => handleChange("ruleVersion", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Google Sheets連携 */}
        <Card>
          <CardHeader>
            <CardTitle>Google Sheets連携</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                スプレッドシートID
              </label>
              <input
                type="text"
                value={settings.spreadsheetId}
                onChange={(e) => handleChange("spreadsheetId", e.target.value)}
                placeholder="例: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="mt-1 text-xs text-slate-500">
                スプレッドシートURLの /d/ と /edit の間の文字列
              </p>
            </div>
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-700">
                <strong>注意:</strong> Google Sheets APIを使用するには、サービスアカウントの設定が必要です。
                設定方法は管理者にお問い合わせください。
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Chatwork連携 */}
        <Card>
          <CardHeader>
            <CardTitle>Chatwork連携</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Room ID
              </label>
              <input
                type="text"
                value={settings.chatworkRoomId}
                onChange={(e) => handleChange("chatworkRoomId", e.target.value)}
                placeholder="例: 123456789"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                APIトークン
              </label>
              <input
                type="password"
                value={settings.chatworkApiToken}
                onChange={(e) => handleChange("chatworkApiToken", e.target.value)}
                placeholder="Chatwork APIトークン"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="mt-1 text-xs text-slate-500">
                Chatwork → 動作設定 → API で取得
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 保存ボタン */}
        <div className="flex justify-end">
          <Button size="lg" onClick={handleSave} loading={isSaving}>
            <Save className="mr-2 h-5 w-5" />
            設定を保存
          </Button>
        </div>

        {/* 通知設定 */}
        <NotificationSettings />

        {/* 異常検知AI */}
        <AnomalyPanel />
      </div>
    </>
  );
}
