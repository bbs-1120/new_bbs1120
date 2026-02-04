"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from "react";

// プリフェッチ用のグローバルキャッシュ
const prefetchCache = new Map<string, { data: unknown; timestamp: number; promise?: Promise<unknown> }>();
const PREFETCH_TTL = 5 * 60 * 1000; // 5分
const prefetchingUrls = new Set<string>();

// ページプリフェッチ関数（重複リクエスト防止）
export function prefetchPageData(url: string, priority: "high" | "low" = "low") {
  const cached = prefetchCache.get(url);
  if (cached && Date.now() - cached.timestamp < PREFETCH_TTL) {
    return cached.promise || Promise.resolve(cached.data); // 既にキャッシュ済み
  }
  
  if (prefetchingUrls.has(url)) {
    return cached?.promise; // 既にフェッチ中
  }
  
  prefetchingUrls.add(url);
  
  const fetchOptions: RequestInit = priority === "high" 
    ? { priority: "high" as RequestPriority }
    : {};
  
  const promise = fetch(url, fetchOptions)
    .then(res => res.json())
    .then(data => {
      prefetchCache.set(url, { data, timestamp: Date.now() });
      prefetchingUrls.delete(url);
      return data;
    })
    .catch((err) => {
      prefetchingUrls.delete(url);
      throw err;
    });
  
  prefetchCache.set(url, { data: null, timestamp: 0, promise });
  return promise;
}

// プリフェッチデータを取得
export function getPrefetchedData<T>(url: string): T | null {
  const cached = prefetchCache.get(url);
  if (cached && cached.data && Date.now() - cached.timestamp < PREFETCH_TTL) {
    return cached.data as T;
  }
  return null;
}

// 全ての重要APIをプリフェッチ
export function prefetchAllCriticalData() {
  prefetchPageData("/api/analysis", "high");
  prefetchPageData("/api/judgment", "low");
  prefetchPageData("/api/auto-stop-rules?projects=true", "low");
}

// ホバー時のプリフェッチ（遅延付き）
const hoverTimeouts = new Map<string, NodeJS.Timeout>();
export function prefetchOnHover(url: string, delayMs = 100) {
  // 既存のタイムアウトをクリア
  const existing = hoverTimeouts.get(url);
  if (existing) clearTimeout(existing);
  
  const timeout = setTimeout(() => {
    prefetchPageData(url);
    hoverTimeouts.delete(url);
  }, delayMs);
  
  hoverTimeouts.set(url, timeout);
}

export function cancelPrefetchOnHover(url: string) {
  const existing = hoverTimeouts.get(url);
  if (existing) {
    clearTimeout(existing);
    hoverTimeouts.delete(url);
  }
}

interface AnalysisData {
  summary: {
    spend: number;
    mcv: number;
    cv: number;
    revenue: number;
    profit: number;
    roas: number;
    cpa: number;
    cvr: number;
    monthlyProfit: number;
  };
  cpnList: unknown[];
  projectList: unknown[];
  mediaList: unknown[];
  dailyTrend: unknown[];
  projectMonthly: unknown[];
  aiAdvice: unknown[];
}

interface DataContextType {
  data: AnalysisData | null;
  isLoading: boolean;
  isStale: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: (force?: boolean) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const STORAGE_KEY = "cpn_analysis_cache";
const CACHE_DURATION = 30 * 60 * 1000; // 30分

// LocalStorageキャッシュ
function getLocalCache(): { data: AnalysisData; timestamp: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_DURATION) {
        return parsed;
      }
    }
  } catch {}
  return null;
}

function setLocalCache(data: AnalysisData) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {}
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const isMounted = useRef(true);

  // アプリ起動時に関連APIをプリフェッチ
  useEffect(() => {
    // 重要APIを全てプリフェッチ
    prefetchAllCriticalData();
    
    // 定期的にバックグラウンドでリフレッシュ（5分ごと）
    const interval = setInterval(() => {
      if (!document.hidden) { // タブがアクティブな場合のみ
        checkAndUpdateInBackground();
      }
    }, 5 * 60 * 1000);
    
    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, []);

  const fetchData = useCallback(async (force = false) => {
    // まずローカルキャッシュをチェック
    if (!force) {
      const localCache = getLocalCache();
      if (localCache) {
        setData(localCache.data);
        setIsLoading(false);
        setLastUpdated(new Date(localCache.timestamp));
        setIsStale(Date.now() - localCache.timestamp > 5 * 60 * 1000); // 5分以上経過でstale
        
        // バックグラウンドで更新チェック
        checkAndUpdateInBackground();
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const url = force ? "/api/analysis?refresh=true" : "/api/analysis";
      const response = await fetch(url);
      const result = await response.json();

      if (result.success) {
        const analysisData: AnalysisData = {
          summary: result.summary,
          cpnList: result.cpnList || [],
          projectList: result.projectList || [],
          mediaList: result.mediaList || [],
          dailyTrend: result.dailyTrend || [],
          projectMonthly: result.projectMonthly || [],
          aiAdvice: result.aiAdvice || [],
        };
        
        setData(analysisData);
        setLocalCache(analysisData);
        setLastUpdated(new Date());
        setIsStale(false);
      } else {
        setError(result.error || "データの取得に失敗しました");
      }
    } catch (err) {
      setError("ネットワークエラーが発生しました");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // バックグラウンドで更新チェック
  const checkAndUpdateInBackground = async () => {
    try {
      const response = await fetch("/api/analysis");
      const result = await response.json();
      
      if (result.success) {
        const analysisData: AnalysisData = {
          summary: result.summary,
          cpnList: result.cpnList || [],
          projectList: result.projectList || [],
          mediaList: result.mediaList || [],
          dailyTrend: result.dailyTrend || [],
          projectMonthly: result.projectMonthly || [],
          aiAdvice: result.aiAdvice || [],
        };
        
        setData(analysisData);
        setLocalCache(analysisData);
        setLastUpdated(new Date());
        setIsStale(false);
      }
    } catch {}
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <DataContext.Provider value={{ data, isLoading, isStale, error, lastUpdated, refresh: fetchData }}>
      {children}
    </DataContext.Provider>
  );
}

export function useAnalysisData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useAnalysisData must be used within a DataProvider");
  }
  return context;
}

