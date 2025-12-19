"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Button } from "./button";
import { Target, Edit2, Check, X } from "lucide-react";

interface GoalProgressProps {
  currentValue: number;
  label?: string;
}

const STORAGE_KEY = "monthly_goal";

export function GoalProgress({ currentValue, label = "12月目標" }: GoalProgressProps) {
  const [goal, setGoal] = useState<number>(0);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    // ローカルストレージから目標を読み込み
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setGoal(parseInt(saved, 10));
    }
  }, []);

  const handleSave = () => {
    const value = parseInt(inputValue.replace(/[,¥]/g, ""), 10);
    if (!isNaN(value) && value > 0) {
      setGoal(value);
      localStorage.setItem(STORAGE_KEY, value.toString());
      setIsEditing(false);
    }
  };

  const progress = goal > 0 ? Math.min((currentValue / goal) * 100, 100) : 0;
  const remaining = goal - currentValue;
  const isAchieved = currentValue >= goal && goal > 0;

  // 進捗に応じた色
  const getProgressColor = () => {
    if (isAchieved) return "from-green-500 to-emerald-500";
    if (progress >= 75) return "from-blue-500 to-indigo-500";
    if (progress >= 50) return "from-yellow-500 to-amber-500";
    if (progress >= 25) return "from-orange-500 to-red-500";
    return "from-red-500 to-rose-500";
  };

  if (goal === 0 && !isEditing) {
    return (
      <Card className="bg-gradient-to-r from-slate-800 to-slate-900 text-white">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                <Target className="h-6 w-6" />
              </div>
              <div>
                <p className="text-lg font-semibold">月間目標を設定しよう</p>
                <p className="text-sm text-white/60">目標を設定すると進捗が可視化されます</p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setInputValue("");
                setIsEditing(true);
              }}
            >
              <Target className="h-4 w-4 mr-1" />
              目標を設定
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isEditing) {
    return (
      <Card className="bg-gradient-to-r from-slate-800 to-slate-900 text-white">
        <CardContent className="py-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm text-white/60 mb-2 block">{label}利益（円）</label>
              <div className="flex items-center gap-2">
                <span className="text-white/60">¥</span>
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="1,000,000"
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex gap-2 pt-6">
              <Button variant="success" size="sm" onClick={handleSave}>
                <Check className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="text-white hover:bg-white/10">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-gradient-to-r ${isAchieved ? "from-green-600 to-emerald-600" : "from-slate-800 to-slate-900"} text-white overflow-hidden`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-white">
            <Target className="h-5 w-5" />
            {label}
            {isAchieved && <span className="ml-2 text-sm bg-white/20 px-2 py-0.5 rounded-full">🎉 達成！</span>}
          </CardTitle>
          <button
            onClick={() => {
              setInputValue(goal.toString());
              setIsEditing(true);
            }}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <Edit2 className="h-4 w-4 text-white/60" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* 数値表示 */}
        <div className="flex items-end gap-2 mb-3">
          <span className="text-3xl font-bold">¥{currentValue.toLocaleString()}</span>
          <span className="text-white/60 mb-1">/ ¥{goal.toLocaleString()}</span>
        </div>

        {/* プログレスバー */}
        <div className="relative h-4 bg-white/20 rounded-full overflow-hidden mb-2">
          <div
            className={`absolute inset-y-0 left-0 bg-gradient-to-r ${getProgressColor()} rounded-full transition-all duration-500`}
            style={{ width: `${progress}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">
            {progress.toFixed(1)}%
          </div>
        </div>

        {/* 残り/超過 */}
        <div className="flex flex-col sm:flex-row justify-between gap-1 text-xs sm:text-sm">
          <span className="text-white/60">
            {isAchieved ? (
              <>超過: <span className="text-green-300 font-medium">+¥{Math.abs(remaining).toLocaleString()}</span></>
            ) : (
              <>残り: <span className="text-white font-medium">¥{remaining.toLocaleString()}</span></>
            )}
          </span>
          <span className="text-white/60">
            日割り目安: ¥{Math.round(goal / 31).toLocaleString()}/日
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

