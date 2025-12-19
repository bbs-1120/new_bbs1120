import { NextResponse } from "next/server";
import { getFullAnalysisData, getMonthlyProfit, getDailyTrendData, getProjectMonthlyData } from "@/lib/googleSheets";
import { getCache, setCache, getCacheStatus } from "@/lib/cache";

const CACHE_KEY = "analysis_data";
const CACHE_TTL = 30 * 60 * 1000; // 30分

// バックグラウンドでデータをプリロード
export async function POST() {
  try {
    console.log("[Preload] Starting data preload...");
    const startTime = Date.now();

    // 全データを並列取得
    const [sheetData, monthlyProfit, dailyTrend, projectMonthly] = await Promise.all([
      getFullAnalysisData(),
      getMonthlyProfit(),
      getDailyTrendData(),
      getProjectMonthlyData(),
    ]);

    const cachedData = { sheetData, monthlyProfit, dailyTrend, projectMonthly };
    setCache(CACHE_KEY, cachedData, CACHE_TTL);

    const duration = Date.now() - startTime;
    console.log(`[Preload] Data preloaded in ${duration}ms`);

    return NextResponse.json({
      success: true,
      duration,
      dataCount: sheetData.length,
      cachedUntil: new Date(Date.now() + CACHE_TTL).toISOString(),
    });
  } catch (error) {
    console.error("[Preload] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Preload failed" },
      { status: 500 }
    );
  }
}

// キャッシュ状態を確認
export async function GET() {
  const status = getCacheStatus(CACHE_KEY);
  
  return NextResponse.json({
    cached: status.exists,
    ageSeconds: status.age ? Math.round(status.age / 1000) : null,
    ttlRemainingSeconds: status.ttlRemaining ? Math.round(status.ttlRemaining / 1000) : null,
  });
}

