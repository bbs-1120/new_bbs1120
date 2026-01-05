"use client";

import { Card, CardContent } from "./card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ComparisonCardProps {
  title: string;
  value: number;
  previousValue?: number;
  change?: number;
  weekChange?: number;
  format?: "currency" | "number" | "percent";
  icon?: React.ReactNode;
  colorClass?: string;
  hideComparison?: boolean;
  showMonthlyNote?: boolean;
}

export function ComparisonCard({
  title,
  value,
  previousValue,
  change,
  weekChange,
  format = "currency",
  icon,
  colorClass = "from-slate-700 to-slate-800",
  hideComparison = false,
  showMonthlyNote = false,
}: ComparisonCardProps) {
  const formatValue = (val: number) => {
    switch (format) {
      case "currency":
        return `¥${Math.round(val).toLocaleString()}`;
      case "percent":
        return `${val.toFixed(1)}%`;
      case "number":
        return val.toLocaleString();
      default:
        return val.toString();
    }
  };

  const getTrendIcon = (changeVal: number | undefined) => {
    if (changeVal === undefined || hideComparison) return null;
    if (changeVal > 5) return <TrendingUp className="h-4 w-4 text-green-400" />;
    if (changeVal < -5) return <TrendingDown className="h-4 w-4 text-red-400" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  const getTrendColor = (changeVal: number | undefined, isProfit: boolean = true) => {
    if (changeVal === undefined) return "text-gray-400";
    if (format === "percent") {
      // ROAS: 上がったら良い
      if (changeVal > 0) return "text-green-400";
      if (changeVal < 0) return "text-red-400";
      return "text-gray-400";
    }
    if (isProfit) {
      if (changeVal > 0) return "text-green-400";
      if (changeVal < 0) return "text-red-400";
    } else {
      // spend は逆（減った方がいい）
      if (changeVal > 0) return "text-yellow-400";
      if (changeVal < 0) return "text-green-400";
    }
    return "text-gray-400";
  };

  const formatChange = (changeVal: number | undefined) => {
    if (changeVal === undefined) return "-";
    if (format === "percent") {
      // ROASはpt差で表示
      const sign = changeVal > 0 ? "+" : "";
      return `${sign}${changeVal.toFixed(1)}pt`;
    }
    const sign = changeVal > 0 ? "+" : "";
    return `${sign}${changeVal.toFixed(1)}%`;
  };

  const isProfit = title.includes("利益") || title.includes("売上") || title.includes("MCV") || title.includes("CV") || title.includes("ROAS");

  return (
    <Card className={`bg-gradient-to-br ${colorClass} text-white overflow-hidden shadow-lg`}>
      <CardContent className="pt-4 pb-4 lg:pt-5 lg:pb-5 px-4 lg:px-5">
        <div className="flex items-center justify-between mb-2 lg:mb-2">
          <div className="flex items-center gap-2">
            {icon && <span className="text-white/80">{icon}</span>}
            <span className="text-sm lg:text-sm font-medium text-white/90">{title}</span>
          </div>
          {getTrendIcon(change)}
        </div>
        
        <div className="text-2xl lg:text-3xl font-bold mb-3 lg:mb-3 tracking-tight">{formatValue(value)}</div>
        
        {/* 比較セクション */}
        {!hideComparison ? (
          <div className="flex gap-2 lg:gap-4 text-xs lg:text-xs">
            {/* 前日比 */}
            <div className="flex-1 bg-white/15 rounded-lg p-2 lg:p-2.5">
              <div className="text-white/70 mb-1 font-medium">前日比</div>
              <div className={`font-bold text-base lg:text-base ${getTrendColor(change, isProfit)}`}>
                {formatChange(change)}
              </div>
              {previousValue !== undefined && format !== "percent" && (
                <div className="hidden lg:block text-white/50 text-[10px] mt-0.5">
                  ({formatValue(previousValue)})
                </div>
              )}
            </div>
            
            {/* 前週比 */}
            <div className="flex-1 bg-white/15 rounded-lg p-2 lg:p-2.5">
              <div className="text-white/70 mb-1 font-medium">前週比</div>
              <div className={`font-bold text-base lg:text-base ${getTrendColor(weekChange, isProfit)}`}>
                {formatChange(weekChange)}
              </div>
            </div>
          </div>
        ) : showMonthlyNote ? (
          <div className="text-xs lg:text-sm text-white/70 bg-white/15 rounded-lg p-2 lg:p-2.5 font-medium">
            📊 今月の累計利益
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ミニ比較バッジ（インライン表示用）
export function ComparisonBadge({ 
  change, 
  showIcon = true,
  size = "sm" 
}: { 
  change: number; 
  showIcon?: boolean;
  size?: "sm" | "md";
}) {
  const isPositive = change > 0;
  const isNeutral = Math.abs(change) < 1;

  const sizeClasses = size === "sm" ? "text-xs px-1.5 py-0.5" : "text-sm px-2 py-1";

  if (isNeutral) {
    return (
      <span className={`inline-flex items-center gap-1 ${sizeClasses} rounded-full bg-gray-100 text-gray-600`}>
        {showIcon && <Minus className="h-3 w-3" />}
        {Math.abs(change).toFixed(1)}%
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 ${sizeClasses} rounded-full ${
      isPositive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
    }`}>
      {showIcon && (isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />)}
      {isPositive ? "+" : ""}{change.toFixed(1)}%
    </span>
  );
}

