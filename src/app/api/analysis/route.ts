import { NextResponse } from "next/server";
import { getFullAnalysisData, getMonthlyProfit } from "@/lib/googleSheets";
import { getCache, setCache } from "@/lib/cache";

const CACHE_KEY = "analysis_data";
const CACHE_TTL = 3 * 60 * 1000; // 3分間キャッシュ

interface CachedData {
  sheetData: Awaited<ReturnType<typeof getFullAnalysisData>>;
  monthlyProfit: number;
}

export async function GET(request: Request) {
  try {
    // URLパラメータでキャッシュをスキップできる
    const { searchParams } = new URL(request.url);
    const skipCache = searchParams.get("refresh") === "true";

    // キャッシュからデータを取得
    let cachedData = skipCache ? null : getCache<CachedData>(CACHE_KEY);

    if (!cachedData) {
      // キャッシュがない場合はスプレッドシートから取得
      const [sheetData, monthlyProfit] = await Promise.all([
        getFullAnalysisData(),
        getMonthlyProfit(),
      ]);

      cachedData = { sheetData, monthlyProfit };
      setCache(CACHE_KEY, cachedData, CACHE_TTL);
    }

    const { sheetData, monthlyProfit } = cachedData;

    // 1. 当日合計を計算
    let totalClicks = 0;
    const summary = {
      spend: 0,
      mcv: 0,
      cv: 0,
      revenue: 0,
      profit: 0,
      roas: 0,
      cpa: 0,
      cvr: 0,
      monthlyProfit: monthlyProfit, // 12月利益
    };

    // データを集計
    for (const row of sheetData) {
      summary.spend += row.spend || 0;
      summary.mcv += row.mcv || 0;
      summary.cv += row.cv || 0;
      summary.revenue += row.revenue || 0;
      summary.profit += row.profit || 0;
      totalClicks += row.clicks || 0;
    }

    // 計算指標
    if (summary.spend > 0) {
      summary.roas = (summary.revenue / summary.spend) * 100;
    }
    if (summary.cv > 0) {
      summary.cpa = summary.spend / summary.cv;
    }
    // CVR計算（クリック数がある場合）
    if (totalClicks > 0) {
      summary.cvr = (summary.cv / totalClicks) * 100;
    }

    // 2. CPN別データ
    const cpnList = sheetData.map((row) => ({
      cpnKey: row.cpnKey || "",
      cpnName: row.cpnName || "",
      accountName: row.accountName || "",
      dailyBudget: row.dailyBudget || "-",
      budgetSchedule: row.budgetSchedule || "-",
      profit7Days: row.profit7Days || 0,
      roas7Days: row.roas7Days || 0,
      consecutiveZeroMcv: row.consecutiveZeroMcv || 0,
      consecutiveLoss: row.consecutiveLoss || 0,
      spend: row.spend || 0,
      mcv: row.mcv || 0,
      cv: row.cv || 0,
      media: row.media || "",
      revenue: row.revenue || 0,
      profit: row.profit || 0,
      roas: row.roas || 0,
      cpa: row.cpa || 0,
      status: row.status || "",
      campaignId: row.campaignId || "", // CPID（キャンペーンID）
    }));

    // 3. 案件名別の集計（スプレッドシートのprojectName列を使用）
    const projectMap = new Map<string, {
      spend: number;
      mcv: number;
      cv: number;
      revenue: number;
      profit: number;
      clicks: number;
    }>();

    for (const row of sheetData) {
      // スプレッドシートの案件名列を使用
      const projectName = row.projectName || "その他";
      
      if (!projectMap.has(projectName)) {
        projectMap.set(projectName, { spend: 0, mcv: 0, cv: 0, revenue: 0, profit: 0, clicks: 0 });
      }
      
      const project = projectMap.get(projectName)!;
      project.spend += row.spend || 0;
      project.mcv += row.mcv || 0;
      project.cv += row.cv || 0;
      project.revenue += row.revenue || 0;
      project.profit += row.profit || 0;
      project.clicks += row.clicks || 0;
    }

    const projectList = Array.from(projectMap.entries()).map(([projectName, data]) => ({
      projectName,
      spend: data.spend,
      mcv: data.mcv,
      cv: data.cv,
      revenue: data.revenue,
      profit: data.profit,
      roas: data.spend > 0 ? (data.revenue / data.spend) * 100 : 0,
      cpa: data.cv > 0 ? data.spend / data.cv : 0,
      cvr: data.clicks > 0 ? (data.cv / data.clicks) * 100 : 0,
    })).sort((a, b) => b.profit - a.profit);

    // 4. 媒体別の集計
    const mediaMap = new Map<string, {
      spend: number;
      mcv: number;
      cv: number;
      revenue: number;
      profit: number;
    }>();

    for (const row of sheetData) {
      const mediaName = row.media || "その他";
      
      if (!mediaMap.has(mediaName)) {
        mediaMap.set(mediaName, { spend: 0, mcv: 0, cv: 0, revenue: 0, profit: 0 });
      }
      
      const media = mediaMap.get(mediaName)!;
      media.spend += row.spend || 0;
      media.mcv += row.mcv || 0;
      media.cv += row.cv || 0;
      media.revenue += row.revenue || 0;
      media.profit += row.profit || 0;
    }

    const mediaList = Array.from(mediaMap.entries()).map(([media, data]) => ({
      media,
      spend: data.spend,
      mcv: data.mcv,
      cv: data.cv,
      revenue: data.revenue,
      profit: data.profit,
      roas: data.spend > 0 ? (data.revenue / data.spend) * 100 : 0,
      cpa: data.cv > 0 ? data.spend / data.cv : 0,
    })).sort((a, b) => b.profit - a.profit);

    return NextResponse.json({
      success: true,
      summary,
      cpnList,
      projectList,
      mediaList,
    });
  } catch (error) {
    console.error("Analysis API error:", error);
    return NextResponse.json(
      { success: false, error: "分析データの取得に失敗しました" },
      { status: 500 }
    );
  }
}
