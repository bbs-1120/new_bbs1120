"use client";

import { useState, useEffect } from "react";
import { 
  Smartphone, 
  RefreshCw, 
  Copy, 
  Check, 
  Cloud, 
  CloudOff,
  Link2,
  Unlink
} from "lucide-react";

interface SyncSettings {
  darkMode: boolean;
  cpnMemos: Record<string, string>;
  dashboardConfig: Record<string, boolean>;
  monthlyGoal: number;
  alertSettings: Record<string, unknown>;
}

export function DeviceSync() {
  const [syncCode, setSyncCode] = useState<string | null>(null);
  const [inputCode, setInputCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  // 初期化: localStorageから同期コードを読み込む
  useEffect(() => {
    const savedCode = localStorage.getItem("syncCode");
    if (savedCode) {
      setSyncCode(savedCode);
      setIsSynced(true);
      // 最後の同期日時も読み込む
      const lastSync = localStorage.getItem("lastSyncedAt");
      if (lastSync) {
        setLastSynced(new Date(lastSync));
      }
    }
  }, []);

  // 現在のlocalStorage設定を取得
  const getCurrentSettings = (): SyncSettings => {
    return {
      darkMode: localStorage.getItem("darkMode") === "true",
      cpnMemos: JSON.parse(localStorage.getItem("cpnMemos") || "{}"),
      dashboardConfig: JSON.parse(localStorage.getItem("dashboardConfig") || "{}"),
      monthlyGoal: parseInt(localStorage.getItem("monthlyGoal") || "0"),
      alertSettings: JSON.parse(localStorage.getItem("alertSettings") || "{}"),
    };
  };

  // 設定をlocalStorageに保存
  const applySettings = (settings: SyncSettings) => {
    localStorage.setItem("darkMode", String(settings.darkMode));
    localStorage.setItem("cpnMemos", JSON.stringify(settings.cpnMemos));
    localStorage.setItem("dashboardConfig", JSON.stringify(settings.dashboardConfig));
    localStorage.setItem("monthlyGoal", String(settings.monthlyGoal));
    localStorage.setItem("alertSettings", JSON.stringify(settings.alertSettings));
    
    // ダークモードの適用
    if (settings.darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // 新しい同期コードを生成
  const generateNewCode = async () => {
    setIsLoading(true);
    setMessage(null);
    
    try {
      const currentSettings = getCurrentSettings();
      
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          settings: currentSettings,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSyncCode(data.syncCode);
        setIsSynced(true);
        localStorage.setItem("syncCode", data.syncCode);
        localStorage.setItem("lastSyncedAt", new Date().toISOString());
        setLastSynced(new Date());
        setMessage({ type: "success", text: "同期コードを生成しました！" });
      } else {
        setMessage({ type: "error", text: data.error || "エラーが発生しました" });
      }
    } catch {
      setMessage({ type: "error", text: "通信エラーが発生しました" });
    } finally {
      setIsLoading(false);
    }
  };

  // 既存のコードで同期
  const linkWithCode = async () => {
    if (inputCode.length !== 6) {
      setMessage({ type: "error", text: "6桁のコードを入力してください" });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/sync?code=${inputCode.toUpperCase()}`);
      const data = await response.json();

      if (data.success) {
        setSyncCode(data.data.syncCode);
        setIsSynced(true);
        localStorage.setItem("syncCode", data.data.syncCode);
        localStorage.setItem("lastSyncedAt", new Date().toISOString());
        setLastSynced(new Date());
        
        // 設定を適用
        applySettings({
          darkMode: data.data.darkMode,
          cpnMemos: data.data.cpnMemos || {},
          dashboardConfig: data.data.dashboardConfig || {},
          monthlyGoal: data.data.monthlyGoal || 0,
          alertSettings: data.data.alertSettings || {},
        });
        
        setMessage({ type: "success", text: "設定を同期しました！" });
        setInputCode("");
        
        // ページをリロードして設定を反映
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        setMessage({ type: "error", text: data.error || "コードが見つかりません" });
      }
    } catch {
      setMessage({ type: "error", text: "通信エラーが発生しました" });
    } finally {
      setIsLoading(false);
    }
  };

  // 設定をクラウドに保存
  const saveToCloud = async () => {
    if (!syncCode) return;

    setIsLoading(true);
    setMessage(null);

    try {
      const currentSettings = getCurrentSettings();

      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          syncCode,
          settings: currentSettings,
        }),
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem("lastSyncedAt", new Date().toISOString());
        setLastSynced(new Date());
        setMessage({ type: "success", text: "設定を保存しました！" });
      } else {
        setMessage({ type: "error", text: data.error || "保存に失敗しました" });
      }
    } catch {
      setMessage({ type: "error", text: "通信エラーが発生しました" });
    } finally {
      setIsLoading(false);
    }
  };

  // クラウドから設定を読み込む
  const loadFromCloud = async () => {
    if (!syncCode) return;

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/sync?code=${syncCode}`);
      const data = await response.json();

      if (data.success) {
        applySettings({
          darkMode: data.data.darkMode,
          cpnMemos: data.data.cpnMemos || {},
          dashboardConfig: data.data.dashboardConfig || {},
          monthlyGoal: data.data.monthlyGoal || 0,
          alertSettings: data.data.alertSettings || {},
        });
        
        localStorage.setItem("lastSyncedAt", new Date().toISOString());
        setLastSynced(new Date());
        setMessage({ type: "success", text: "設定を読み込みました！" });
        
        // ページをリロードして設定を反映
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        setMessage({ type: "error", text: data.error || "読み込みに失敗しました" });
      }
    } catch {
      setMessage({ type: "error", text: "通信エラーが発生しました" });
    } finally {
      setIsLoading(false);
    }
  };

  // コードをコピー
  const copyCode = () => {
    if (syncCode) {
      navigator.clipboard.writeText(syncCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 連携解除
  const unlinkDevice = () => {
    localStorage.removeItem("syncCode");
    localStorage.removeItem("lastSyncedAt");
    setSyncCode(null);
    setIsSynced(false);
    setLastSynced(null);
    setMessage({ type: "success", text: "連携を解除しました" });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
          <Smartphone className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900">デバイス間同期</h3>
          <p className="text-sm text-slate-500">
            他のデバイスと設定を共有
          </p>
        </div>
      </div>

      {/* メッセージ表示 */}
      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {isSynced && syncCode ? (
        /* 同期済みの場合 */
        <div className="space-y-4">
          {/* 同期コード表示 */}
          <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-500">あなたの同期コード</span>
              <div className="flex items-center gap-1 text-green-600 text-sm">
                <Cloud className="h-4 w-4" />
                <span>同期中</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <code className="flex-1 text-2xl font-mono font-bold tracking-widest text-slate-900">
                {syncCode}
              </code>
              <button
                onClick={copyCode}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-white rounded-lg transition-colors"
                title="コピー"
              >
                {copied ? (
                  <Check className="h-5 w-5 text-green-600" />
                ) : (
                  <Copy className="h-5 w-5" />
                )}
              </button>
            </div>
            {lastSynced && (
              <p className="text-xs text-slate-400 mt-2">
                最終同期: {lastSynced.toLocaleString("ja-JP")}
              </p>
            )}
          </div>

          {/* 操作ボタン */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={saveToCloud}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Cloud className="h-4 w-4" />
              )}
              <span className="text-sm font-medium">保存</span>
            </button>
            <button
              onClick={loadFromCloud}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="text-sm font-medium">読み込み</span>
            </button>
          </div>

          {/* 連携解除 */}
          <button
            onClick={unlinkDevice}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Unlink className="h-4 w-4" />
            <span className="text-sm">連携を解除</span>
          </button>
        </div>
      ) : (
        /* 未同期の場合 */
        <div className="space-y-6">
          {/* 新規コード生成 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Cloud className="h-4 w-4 text-blue-500" />
              新しい同期コードを作成
            </div>
            <button
              onClick={generateNewCode}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 shadow-sm"
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Cloud className="h-4 w-4" />
              )}
              <span className="font-medium">同期コードを生成</span>
            </button>
            <p className="text-xs text-slate-500">
              現在の設定を保存し、他のデバイスで使える同期コードを発行します
            </p>
          </div>

          {/* 区切り線 */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-white text-slate-400">または</span>
            </div>
          </div>

          {/* 既存コードで連携 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Link2 className="h-4 w-4 text-green-500" />
              既存の同期コードで連携
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="コードを入力"
                className="flex-1 px-4 py-3 text-center text-lg font-mono tracking-widest border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                maxLength={6}
              />
              <button
                onClick={linkWithCode}
                disabled={isLoading || inputCode.length !== 6}
                className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <RefreshCw className="h-5 w-5 animate-spin" />
                ) : (
                  <Link2 className="h-5 w-5" />
                )}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              別のデバイスで生成した同期コードを入力して設定を取得します
            </p>
          </div>
        </div>
      )}

      {/* 同期される設定の説明 */}
      <div className="mt-6 pt-4 border-t border-slate-100">
        <p className="text-xs text-slate-400 mb-2">同期される設定：</p>
        <div className="flex flex-wrap gap-2">
          {["ダークモード", "CPNメモ", "ダッシュボード設定", "月間目標", "アラート設定"].map(
            (item) => (
              <span
                key={item}
                className="px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded"
              >
                {item}
              </span>
            )
          )}
        </div>
      </div>
    </div>
  );
}

