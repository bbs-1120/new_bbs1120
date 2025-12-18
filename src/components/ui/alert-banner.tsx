"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, X, Bell, BellOff, Settings, Power, Loader2, CheckCircle } from "lucide-react";
import { Button } from "./button";

interface AlertConfig {
  enabled: boolean;
  metaProfitThreshold: number; // Meta利益の閾値（円）
  autoStopThreshold: number; // 自動停止の閾値（円）
  autoStopEnabled: boolean; // 自動停止を有効化
  showWhenBelow: boolean; // 閾値以下で表示
}

interface AlertBannerProps {
  metaProfit: number;
  onSettingsClick?: () => void;
}

const STORAGE_KEY = "alert_config";

const DEFAULT_CONFIG: AlertConfig = {
  enabled: true,
  metaProfitThreshold: -50000, // デフォルト: -5万円
  autoStopThreshold: -23000, // 自動停止閾値: -23,000円
  autoStopEnabled: false, // デフォルトは無効
  showWhenBelow: true,
};

export function AlertBanner({ metaProfit, onSettingsClick }: AlertBannerProps) {
  const [config, setConfig] = useState<AlertConfig>(DEFAULT_CONFIG);
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setConfig(JSON.parse(saved));
      } catch {
        // 無効なデータの場合はデフォルトを使用
      }
    }
  }, []);

  // アラート表示条件をチェック
  const shouldShowAlert = () => {
    if (!config.enabled || dismissed) return false;
    if (config.showWhenBelow && metaProfit < config.metaProfitThreshold) {
      return true;
    }
    return false;
  };

  if (!mounted || !shouldShowAlert()) {
    return null;
  }

  return (
    <div className="mb-4 animate-slide-in">
      <div className="bg-gradient-to-r from-red-500 to-rose-600 rounded-lg p-4 text-white shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg">⚠️ Meta(FB) 利益アラート</h3>
            <p className="text-white/90 mt-1">
              本日のMeta利益が <span className="font-bold">¥{metaProfit.toLocaleString()}</span> です。
              設定した閾値 <span className="font-bold">¥{config.metaProfitThreshold.toLocaleString()}</span> を下回っています。
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={onSettingsClick}
                className="bg-white/20 hover:bg-white/30 text-white border-0"
              >
                <Settings className="h-4 w-4 mr-1" />
                閾値を変更
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDismissed(true)}
                className="text-white/80 hover:text-white hover:bg-white/10"
              >
                今日は表示しない
              </Button>
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="flex-shrink-0 p-1 rounded hover:bg-white/20 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// アラート設定モーダル
interface AlertSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  metaProfit?: number;
}

export function AlertSettingsModal({ isOpen, onClose, metaProfit }: AlertSettingsModalProps) {
  const [config, setConfig] = useState<AlertConfig>(DEFAULT_CONFIG);
  const [inputValue, setInputValue] = useState("-50000");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConfig(parsed);
        setInputValue(parsed.metaProfitThreshold.toString());
      } catch {
        // 無効なデータの場合はデフォルトを使用
      }
    }
  }, [isOpen]);

  const handleSave = () => {
    const threshold = parseInt(inputValue.replace(/[,¥]/g, ""), 10);
    if (!isNaN(threshold)) {
      const newConfig = {
        ...config,
        metaProfitThreshold: threshold,
      };
      setConfig(newConfig);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
      onClose();
    }
  };

  const toggleEnabled = () => {
    const newConfig = { ...config, enabled: !config.enabled };
    setConfig(newConfig);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
  };

  if (!isOpen) return null;

  return (
    <>
      {/* オーバーレイ */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      
      {/* モーダル */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-slide-in">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Bell className="h-5 w-5 text-indigo-600" />
                アラート設定
              </h2>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            {/* 有効/無効トグル */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg mb-6">
              <div className="flex items-center gap-3">
                {config.enabled ? (
                  <Bell className="h-5 w-5 text-indigo-600" />
                ) : (
                  <BellOff className="h-5 w-5 text-slate-400" />
                )}
                <div>
                  <p className="font-medium text-slate-900">アラート通知</p>
                  <p className="text-sm text-slate-500">{config.enabled ? "有効" : "無効"}</p>
                </div>
              </div>
              <button
                onClick={toggleEnabled}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  config.enabled ? "bg-indigo-600" : "bg-slate-300"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-transform ${
                    config.enabled ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Meta利益閾値設定 */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Meta(FB) 利益の警告閾値
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">¥</span>
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="-50000"
                    className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={!config.enabled}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  この金額を下回るとアラートが表示されます（負の値も設定可能）
                </p>
              </div>

              {/* 現在のMeta利益表示 */}
              {metaProfit !== undefined && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    📊 現在のMeta利益: <span className={`font-bold ${metaProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                      ¥{metaProfit.toLocaleString()}
                    </span>
                  </p>
                </div>
              )}

              {/* プリセット */}
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">クイック設定</p>
                <div className="flex flex-wrap gap-2">
                  {[-10000, -30000, -50000, -100000].map((val) => (
                    <button
                      key={val}
                      onClick={() => setInputValue(val.toString())}
                      className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                      disabled={!config.enabled}
                    >
                      ¥{val.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ボタン */}
            <div className="flex gap-3 mt-6">
              <Button variant="secondary" onClick={onClose} className="flex-1">
                キャンセル
              </Button>
              <Button onClick={handleSave} className="flex-1" disabled={!config.enabled}>
                保存
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// アラート設定用のフック
export function useAlertConfig() {
  const [config, setConfig] = useState<AlertConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setConfig(JSON.parse(saved));
      } catch {
        // 無効なデータの場合はデフォルトを使用
      }
    }
  }, []);

  return config;
}

// 自動停止パネル
interface AutoStopPanelProps {
  onExecute?: () => void;
}

interface StopTarget {
  cpnName: string;
  campaignId: string;
  profit: number;
  accountName: string;
  status: string;
}

export function AutoStopPanel({ onExecute }: AutoStopPanelProps) {
  const [targets, setTargets] = useState<StopTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [threshold, setThreshold] = useState(-23000);

  // 停止対象を取得
  const fetchTargets = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/auto-stop");
      const data = await response.json();
      if (data.success) {
        setTargets(data.targets || []);
        setThreshold(data.threshold);
      }
    } catch (error) {
      console.error("Failed to fetch targets:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTargets();
  }, []);

  // 自動停止を実行（Dry Run）
  const executeDryRun = async () => {
    setExecuting(true);
    setResult(null);
    try {
      const response = await fetch("/api/auto-stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threshold, dryRun: true }),
      });
      const data = await response.json();
      setResult({ success: data.success, message: data.message || data.error });
    } catch (error) {
      setResult({ success: false, message: "エラーが発生しました" });
    } finally {
      setExecuting(false);
    }
  };

  // 実際に停止を実行
  const executeStop = async () => {
    if (!confirm("本当にこれらのCPNを停止しますか？この操作は取り消せません。")) {
      return;
    }
    setExecuting(true);
    setResult(null);
    try {
      const response = await fetch("/api/auto-stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threshold, dryRun: false }),
      });
      const data = await response.json();
      setResult({ success: data.success, message: data.message || data.error });
      if (data.success) {
        fetchTargets(); // 再取得
        onExecute?.();
      }
    } catch (error) {
      setResult({ success: false, message: "エラーが発生しました" });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 bg-gradient-to-r from-red-50 to-orange-50 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Power className="h-5 w-5 text-red-600" />
            <h3 className="font-bold text-slate-900">Meta(FB) 自動停止</h3>
          </div>
          <button
            onClick={fetchTargets}
            disabled={loading}
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
          >
            <Loader2 className={`h-4 w-4 text-slate-500 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
        <p className="text-sm text-slate-600 mt-1">
          利益が <span className="font-bold text-red-600">¥{threshold.toLocaleString()}</span> を下回るCPNを自動停止
        </p>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : targets.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <p className="text-slate-600">停止対象のCPNはありません</p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <p className="text-sm font-medium text-red-600 mb-2">
                ⚠️ {targets.length}件のCPNが停止対象です
              </p>
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">CPN名</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600">利益</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {targets.map((target, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-700 truncate max-w-[200px]" title={target.cpnName}>
                          {target.cpnName.split("_").slice(-3).join("_")}
                        </td>
                        <td className="px-3 py-2 text-right text-red-600 font-medium">
                          ¥{target.profit.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {result && (
              <div className={`p-3 rounded-lg mb-4 ${result.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                {result.message}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={executeDryRun}
                disabled={executing}
                className="flex-1"
              >
                {executing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                テスト実行
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={executeStop}
                disabled={executing}
                className="flex-1"
              >
                {executing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Power className="h-4 w-4 mr-1" />}
                一括停止
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

