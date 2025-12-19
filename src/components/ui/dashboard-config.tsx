"use client";

import { useState, useEffect } from "react";
import { Settings, GripVertical, Eye, EyeOff, Check, X, RotateCcw } from "lucide-react";
import { Button } from "./button";

export interface DashboardWidget {
  id: string;
  name: string;
  description: string;
  visible: boolean;
  order: number;
}

const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: "goal", name: "月間目標", description: "目標と進捗バー", visible: true, order: 0 },
  { id: "comparison", name: "前日比・前週比", description: "比較カード", visible: true, order: 1 },
  { id: "summary", name: "サマリーカード", description: "消化・利益・ROAS", visible: true, order: 2 },
  { id: "dailyChart", name: "日別利益グラフ", description: "今月の推移", visible: true, order: 3 },
  { id: "mediaChart", name: "媒体別グラフ", description: "円グラフ", visible: true, order: 4 },
  { id: "projectRanking", name: "案件別ランキング", description: "TOP10", visible: true, order: 5 },
  { id: "gptAdvice", name: "GPT運用分析", description: "AIアドバイス", visible: true, order: 6 },
  { id: "alerts", name: "アラート", description: "注意事項", visible: true, order: 7 },
];

const STORAGE_KEY = "dashboard_config";

export function getWidgetConfig(): DashboardWidget[] {
  if (typeof window === "undefined") return DEFAULT_WIDGETS;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // デフォルトとマージ（新しいウィジェットを追加）
      const savedIds = new Set(parsed.map((w: DashboardWidget) => w.id));
      const merged = [...parsed];
      for (const widget of DEFAULT_WIDGETS) {
        if (!savedIds.has(widget.id)) {
          merged.push(widget);
        }
      }
      return merged.sort((a: DashboardWidget, b: DashboardWidget) => a.order - b.order);
    }
    return DEFAULT_WIDGETS;
  } catch {
    return DEFAULT_WIDGETS;
  }
}

export function saveWidgetConfig(widgets: DashboardWidget[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
}

export function isWidgetVisible(widgetId: string): boolean {
  const config = getWidgetConfig();
  const widget = config.find((w) => w.id === widgetId);
  return widget?.visible ?? true;
}

interface DashboardConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (widgets: DashboardWidget[]) => void;
}

export function DashboardConfigModal({ isOpen, onClose, onSave }: DashboardConfigModalProps) {
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setWidgets(getWidgetConfig());
    }
  }, [isOpen]);

  const toggleVisibility = (index: number) => {
    const newWidgets = [...widgets];
    newWidgets[index].visible = !newWidgets[index].visible;
    setWidgets(newWidgets);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newWidgets = [...widgets];
    const draggedWidget = newWidgets[draggedIndex];
    newWidgets.splice(draggedIndex, 1);
    newWidgets.splice(index, 0, draggedWidget);

    // orderを更新
    newWidgets.forEach((w, i) => {
      w.order = i;
    });

    setWidgets(newWidgets);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSave = () => {
    saveWidgetConfig(widgets);
    onSave(widgets);
    onClose();
  };

  const handleReset = () => {
    setWidgets(DEFAULT_WIDGETS);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg animate-slide-in">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Settings className="h-5 w-5 text-indigo-600" />
                ダッシュボード設定
              </h2>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <p className="text-sm text-slate-500 mb-4">
              表示するウィジェットを選択し、ドラッグで順序を変更できます。
            </p>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {widgets.map((widget, index) => (
                <div
                  key={widget.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-move ${
                    draggedIndex === index
                      ? "border-indigo-500 bg-indigo-50 shadow-lg"
                      : widget.visible
                      ? "border-slate-200 bg-white hover:border-slate-300"
                      : "border-slate-100 bg-slate-50 opacity-60"
                  }`}
                >
                  <GripVertical className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm">{widget.name}</p>
                    <p className="text-xs text-slate-500">{widget.description}</p>
                  </div>
                  <button
                    onClick={() => toggleVisibility(index)}
                    className={`p-2 rounded-lg transition-colors ${
                      widget.visible
                        ? "text-indigo-600 hover:bg-indigo-50"
                        : "text-slate-400 hover:bg-slate-100"
                    }`}
                  >
                    {widget.visible ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-200">
              <button
                onClick={handleReset}
                className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1"
              >
                <RotateCcw className="h-4 w-4" />
                リセット
              </button>
              <div className="flex-1" />
              <Button variant="secondary" onClick={onClose}>
                キャンセル
              </Button>
              <Button onClick={handleSave}>
                <Check className="h-4 w-4 mr-1" />
                保存
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ダッシュボード設定ボタン
interface DashboardConfigButtonProps {
  onOpen: () => void;
}

export function DashboardConfigButton({ onOpen }: DashboardConfigButtonProps) {
  return (
    <button
      onClick={onOpen}
      className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
      title="ダッシュボードをカスタマイズ"
    >
      <Settings className="h-5 w-5" />
    </button>
  );
}

