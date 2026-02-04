"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface SkeletonProps {
  className?: string;
  shimmer?: boolean;
}

// シマー効果付きスケルトン
export function Skeleton({ className, shimmer = true }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-md bg-slate-200 dark:bg-slate-700",
        shimmer && "relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent",
        !shimmer && "animate-pulse",
        className
      )}
    />
  );
}

// 即座に表示されるローディングインジケーター
export function InstantLoader({ show, delay = 0 }: { show: boolean; delay?: number }) {
  const [shouldShow, setShouldShow] = useState(delay === 0 && show);
  
  useEffect(() => {
    if (!show) {
      setShouldShow(false);
      return;
    }
    
    if (delay === 0) {
      setShouldShow(true);
      return;
    }
    
    const timer = setTimeout(() => setShouldShow(true), delay);
    return () => clearTimeout(timer);
  }, [show, delay]);
  
  if (!shouldShow) return null;
  
  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 animate-loading-bar" />
    </div>
  );
}

// プログレスバー付きローダー
export function ProgressLoader({ progress }: { progress: number }) {
  return (
    <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
      <div 
        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <Skeleton className="h-6 w-48" />
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-4 flex items-center gap-4">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 flex-1 max-w-xs" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
      <Skeleton className="h-6 w-32 mb-4" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function AnalysisPageSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>

      {/* グラフエリア */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>

      {/* テーブル */}
      <TableSkeleton rows={8} />
    </div>
  );
}

