"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";

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

