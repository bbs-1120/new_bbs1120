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
    if (isAchieved) return "from-emerald-500 to-green-500";
    if (progress >= 75) return "from-emerald-500 to-teal-500";
    if (progress >= 50) return "from-amber-500 to-yellow-500";
    if (progress >= 25) return "from-orange-500 to-amber-500";
    return "from-red-500 to-orange-500";
  };

  if (goal === 0 && !isEditing) {
    return (
      <Card className="bg-white border border-slate-200 shadow-sm">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                <Target className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-800">月間目標を設定しよう</p>
                <p className="text-sm text-slate-500">目標を設定すると進捗が可視化されます</p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setInputValue("");
                setIsEditing(true);
              }}
              className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200"
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
      <Card className="bg-white border border-slate-200 shadow-sm">
        <CardContent className="py-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm text-slate-500 mb-2 block">{label}利益（円）</label>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">¥</span>
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="1,000,000"
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex gap-2 pt-6">
              <Button variant="success" size="sm" onClick={handleSave}>
                <Check className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${isAchieved ? "bg-gradient-to-r from-emerald-500 to-green-500 text-white" : "bg-white border border-slate-200 shadow-sm"} overflow-hidden`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className={`flex items-center gap-2 ${isAchieved ? "text-white" : "text-slate-800"}`}>
            <Target className={`h-5 w-5 ${isAchieved ? "text-white" : "text-emerald-600"}`} />
            {label}
            {isAchieved && <span className="ml-2 text-sm bg-white/20 px-2 py-0.5 rounded-full">🎉 達成！</span>}
          </CardTitle>
          <button
            onClick={() => {
              setInputValue(goal.toString());
              setIsEditing(true);
            }}
            className={`p-1.5 rounded-lg transition-colors ${isAchieved ? "hover:bg-white/10" : "hover:bg-slate-100"}`}
          >
            <Edit2 className={`h-4 w-4 ${isAchieved ? "text-white/60" : "text-slate-400"}`} />
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* 数値表示 */}
        <div className="flex items-end gap-2 mb-3">
          <span className={`text-3xl font-bold ${isAchieved ? "text-white" : "text-slate-800"}`}>¥{currentValue.toLocaleString()}</span>
          <span className={`mb-1 ${isAchieved ? "text-white/60" : "text-slate-500"}`}>/ ¥{goal.toLocaleString()}</span>
        </div>

        {/* プログレスバー */}
        <div className={`relative h-4 ${isAchieved ? "bg-white/20" : "bg-slate-200"} rounded-full overflow-hidden mb-2`}>
          <div
            className={`absolute inset-y-0 left-0 bg-gradient-to-r ${getProgressColor()} rounded-full transition-all duration-500`}
            style={{ width: `${progress}%` }}
          />
          <div className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${isAchieved ? "text-white" : "text-slate-700"}`}>
            {progress.toFixed(1)}%
          </div>
        </div>

        {/* 残り/超過 */}
        <div className="flex flex-col sm:flex-row justify-between gap-1 text-xs sm:text-sm">
          <span className={isAchieved ? "text-white/60" : "text-slate-500"}>
            {isAchieved ? (
              <>超過: <span className="text-green-200 font-medium">+¥{Math.abs(remaining).toLocaleString()}</span></>
            ) : (
              <>残り: <span className="text-slate-700 font-medium">¥{remaining.toLocaleString()}</span></>
            )}
          </span>
          <span className={isAchieved ? "text-white/60" : "text-slate-500"}>
            日割り目安: ¥{Math.round(goal / 31).toLocaleString()}/日
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

