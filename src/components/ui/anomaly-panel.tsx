"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, TrendingUp, TrendingDown, RefreshCw, Bell, CheckCircle } from "lucide-react";
import { Button } from "./button";
import { CpnAnomalyCheck } from "@/lib/anomaly-detection";

interface AnomalyPanelProps {
  onAnomalyDetected?: (count: number) => void;
}

export function AnomalyPanel({ onAnomalyDetected }: AnomalyPanelProps) {
  const [anomalies, setAnomalies] = useState<CpnAnomalyCheck[]>([]);
  const [analysis, setAnalysis] = useState<string>("");
  const [summary, setSummary] = useState<{ total: number; critical: number; high: number; medium: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkAnomalies = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/anomaly');
      const data = await res.json();
      
      if (data.success) {
        setAnomalies(data.anomalies || []);
        setAnalysis(data.analysis || "");
        setSummary(data.summary || null);
        setLastChecked(new Date());
        
        if (onAnomalyDetected) {
          onAnomalyDetected(data.anomalies?.length || 0);
        }
      }
    } catch (error) {
      console.error("Failed to check anomalies:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAnomalies();
    
    // 5分ごとに自動チェック
    const interval = setInterval(checkAnomalies, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-400';
      case 'high': return 'bg-orange-100 dark:bg-orange-900/30 border-orange-500 text-orange-700 dark:text-orange-400';
      case 'medium': return 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-500 text-yellow-700 dark:text-yellow-400';
      default: return 'bg-blue-100 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-400';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* ヘッダー */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-purple-500/10 to-pink-500/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-500 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">🤖 異常検知AI</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                急激な変化を自動検出
              </p>
            </div>
          </div>
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={checkAnomalies}
            loading={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            更新
          </Button>
        </div>
      </div>

      {/* サマリー */}
      {summary && (
        <div className="p-4 grid grid-cols-4 gap-2 border-b border-slate-200 dark:border-slate-700">
          <div className="text-center p-2 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{summary.total}</div>
            <div className="text-xs text-slate-500">合計</div>
          </div>
          <div className="text-center p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{summary.critical}</div>
            <div className="text-xs text-red-500">クリティカル</div>
          </div>
          <div className="text-center p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{summary.high}</div>
            <div className="text-xs text-orange-500">高</div>
          </div>
          <div className="text-center p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{summary.medium}</div>
            <div className="text-xs text-yellow-500">中</div>
          </div>
        </div>
      )}

      {/* 異常リスト */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {anomalies.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p className="text-slate-600 dark:text-slate-400">異常は検出されていません</p>
            {lastChecked && (
              <p className="text-xs text-slate-400 mt-1">
                最終チェック: {lastChecked.toLocaleTimeString('ja-JP')}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {anomalies.slice(0, 10).map((anomaly, index) => (
              <div 
                key={index}
                className={`p-3 rounded-lg border-l-4 ${getSeverityColor(anomaly.result.severity)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getSeverityIcon(anomaly.result.severity)}
                    <span className="font-medium text-sm">{anomaly.metric}</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm">
                    {anomaly.result.changePercent > 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <span className={anomaly.result.changePercent > 0 ? 'text-green-600' : 'text-red-600'}>
                      {anomaly.result.changePercent > 0 ? '+' : ''}{anomaly.result.changePercent.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <p className="text-xs mt-1 truncate" title={anomaly.cpnName}>
                  {anomaly.cpnName}
                </p>
                <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                  <span>¥{anomaly.previousValue.toLocaleString()}</span>
                  <span>→</span>
                  <span className="font-medium">¥{anomaly.currentValue.toLocaleString()}</span>
                </div>
                <p className="text-xs mt-1 text-slate-600 dark:text-slate-300">
                  💡 {anomaly.result.recommendation}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* フッター */}
      {lastChecked && (
        <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30">
          <p className="text-xs text-slate-500 text-center">
            最終チェック: {lastChecked.toLocaleString('ja-JP')} | 5分ごとに自動更新
          </p>
        </div>
      )}
    </div>
  );
}

