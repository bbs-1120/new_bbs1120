"use client";

import { Suspense, lazy, useState, useEffect } from "react";

// 遅延読み込み用のプレースホルダー
function ChartPlaceholder({ height = 300 }: { height?: number }) {
  return (
    <div 
      className="animate-pulse bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 rounded-lg flex items-center justify-center"
      style={{ height }}
    >
      <div className="text-slate-400 text-sm">グラフを読み込み中...</div>
    </div>
  );
}

// Rechartsコンポーネントを遅延読み込み
const LazyLineChart = lazy(() => 
  import("recharts").then(mod => ({ default: mod.LineChart }))
);
const LazyBarChart = lazy(() => 
  import("recharts").then(mod => ({ default: mod.BarChart }))
);
const LazyPieChart = lazy(() => 
  import("recharts").then(mod => ({ default: mod.PieChart }))
);
const LazyResponsiveContainer = lazy(() => 
  import("recharts").then(mod => ({ default: mod.ResponsiveContainer }))
);

// 遅延読み込みラッパー
interface LazyChartWrapperProps {
  children: React.ReactNode;
  height?: number;
  delay?: number; // 表示遅延（ミリ秒）
}

export function LazyChartWrapper({ children, height = 300, delay = 0 }: LazyChartWrapperProps) {
  const [shouldRender, setShouldRender] = useState(delay === 0);

  useEffect(() => {
    if (delay > 0) {
      const timer = setTimeout(() => setShouldRender(true), delay);
      return () => clearTimeout(timer);
    }
  }, [delay]);

  if (!shouldRender) {
    return <ChartPlaceholder height={height} />;
  }

  return (
    <Suspense fallback={<ChartPlaceholder height={height} />}>
      {children}
    </Suspense>
  );
}

// IntersectionObserverを使った遅延読み込み（ビューポートに入ったら読み込み）
interface LazyOnViewChartProps {
  children: React.ReactNode;
  height?: number;
  rootMargin?: string;
}

export function LazyOnViewChart({ children, height = 300, rootMargin = "100px" }: LazyOnViewChartProps) {
  const [isInView, setIsInView] = useState(false);
  const [ref, setRef] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(ref);

    return () => observer.disconnect();
  }, [ref, rootMargin]);

  return (
    <div ref={setRef} style={{ minHeight: height }}>
      {isInView ? (
        <Suspense fallback={<ChartPlaceholder height={height} />}>
          {children}
        </Suspense>
      ) : (
        <ChartPlaceholder height={height} />
      )}
    </div>
  );
}

export { LazyLineChart, LazyBarChart, LazyPieChart, LazyResponsiveContainer, ChartPlaceholder };
