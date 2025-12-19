import { NextResponse } from "next/server";
import { fetchTodayData } from "@/lib/googleSheets";

/**
 * リアルタイム速報API
 * キャッシュを使わず、常に最新のGoogle Sheetsデータを取得
 */
export async function GET() {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    if (!spreadsheetId) {
      return NextResponse.json(
        { success: false, error: "Spreadsheet ID not configured" },
        { status: 500 }
      );
    }

    // 当日データを直接取得（キャッシュなし）
    const todayData = await fetchTodayData(spreadsheetId);

    // 集計
    let totalSpend = 0;
    let totalRevenue = 0;
    let totalProfit = 0;
    let totalMcv = 0;
    let totalCv = 0;

    // 媒体別集計
    const mediaStats: Record<string, { spend: number; revenue: number; profit: number; mcv: number; cv: number }> = {};

    for (const row of todayData) {
      totalSpend += row.spend || 0;
      totalRevenue += row.revenue || 0;
      totalProfit += row.profit || 0;
      totalMcv += row.mcv || 0;
      totalCv += row.cv || 0;

      // 媒体別
      const media = row.media || "その他";
      if (!mediaStats[media]) {
        mediaStats[media] = { spend: 0, revenue: 0, profit: 0, mcv: 0, cv: 0 };
      }
      mediaStats[media].spend += row.spend || 0;
      mediaStats[media].revenue += row.revenue || 0;
      mediaStats[media].profit += row.profit || 0;
      mediaStats[media].mcv += row.mcv || 0;
      mediaStats[media].cv += row.cv || 0;
    }

    // ROAS計算
    const totalRoas = totalSpend > 0 ? (totalRevenue / totalSpend) * 100 : 0;

    // 媒体別データを配列に変換
    const mediaList = Object.entries(mediaStats).map(([media, stats]) => ({
      media,
      ...stats,
      roas: stats.spend > 0 ? (stats.revenue / stats.spend) * 100 : 0,
    })).sort((a, b) => b.profit - a.profit);

    // 更新時刻（JST）
    const now = new Date();
    const jstTime = now.toLocaleString("ja-JP", { 
      timeZone: "Asia/Tokyo",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });

    return NextResponse.json({
      success: true,
      realtime: {
        spend: totalSpend,
        revenue: totalRevenue,
        profit: totalProfit,
        roas: totalRoas,
        mcv: totalMcv,
        cv: totalCv,
        cpnCount: todayData.length,
      },
      mediaList,
      updatedAt: jstTime,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("Realtime API error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

