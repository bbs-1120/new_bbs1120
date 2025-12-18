"use client";

import { Card, CardContent } from "./card";
import { TrendingUp, TrendingDown, Minus, ArrowRight } from "lucide-react";

interface ComparisonCardProps {
  title: string;
  value: number;
  previousValue?: number;
  change?: number;
  weekChange?: number;
  format?: "currency" | "number" | "percent";
  icon?: React.ReactNode;
  colorClass?: string;
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
    if (changeVal === undefined) return null;
    if (changeVal > 5) return <TrendingUp className="h-4 w-4 text-green-400" />;
    if (changeVal < -5) return <TrendingDown className="h-4 w-4 text-red-400" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  const getTrendColor = (changeVal: number | undefined, isProfit: boolean = true) => {
    if (changeVal === undefined) return "text-gray-400";
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
    const sign = changeVal > 0 ? "+" : "";
    return `${sign}${changeVal.toFixed(1)}%`;
  };

  const isProfit = title.includes("利益") || title.includes("売上") || title.includes("MCV") || title.includes("CV");

  return (
    <Card className={`bg-gradient-to-br ${colorClass} text-white overflow-hidden`}>
      <CardContent className="pt-3 pb-3 lg:pt-4 lg:pb-4 px-3 lg:px-4">
        <div className="flex items-center justify-between mb-1 lg:mb-2">
          <div className="flex items-center gap-1 lg:gap-2">
            {icon && <span className="text-white/80">{icon}</span>}
            <span className="text-xs lg:text-sm text-white/80">{title}</span>
          </div>
          {getTrendIcon(change)}
        </div>
        
        <div className="text-lg lg:text-2xl font-bold mb-2 lg:mb-3">{formatValue(value)}</div>
        
        {/* 比較セクション */}
        <div className="flex gap-2 lg:gap-4 text-[10px] lg:text-xs">
          {/* 前日比 */}
          <div className="flex-1 bg-white/10 rounded-lg p-1.5 lg:p-2">
            <div className="text-white/60 mb-0.5 lg:mb-1">前日比</div>
            <div className={`font-semibold ${getTrendColor(change, isProfit)}`}>
              {formatChange(change)}
            </div>
            {previousValue !== undefined && (
              <div className="hidden lg:block text-white/40 text-[10px] mt-0.5">
                ({formatValue(previousValue)})
              </div>
            )}
          </div>
          
          {/* 前週比 */}
          <div className="flex-1 bg-white/10 rounded-lg p-1.5 lg:p-2">
            <div className="text-white/60 mb-0.5 lg:mb-1">前週比</div>
            <div className={`font-semibold ${getTrendColor(weekChange, isProfit)}`}>
              {formatChange(weekChange)}
            </div>
          </div>
        </div>
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

