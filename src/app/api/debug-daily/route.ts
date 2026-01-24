import { NextResponse } from "next/server";
import { getDailyTrendData } from "@/lib/googleSheets";
import { auth } from "@/lib/auth";

// デバッグ用: デイリーレポートのデータを確認
export async function GET() {
  try {
    // ユーザーセッションを取得
    const session = await auth();
    const userRole = session?.user?.role || "member";
    const userTeamName = session?.user?.teamName || null;
    
    // メンバーの場合のフィルタリング用teamName
    const filterTeamName = userRole !== "admin" ? userTeamName : null;
    
    // 過去データのスプレッドシートから直接データを取得
    const historicalSpreadsheetId = process.env.GOOGLE_SHEETS_HISTORICAL_SPREADSHEET_ID?.trim();
    
    if (!historicalSpreadsheetId) {
      return NextResponse.json({ error: "GOOGLE_SHEETS_HISTORICAL_SPREADSHEET_ID not configured" });
    }

    // 現在の月のシート名
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const sheetName = `${year}年${month}月`;

    // 日別集計データを取得（メンバーの場合はフィルタリング）
    const dailyTrend = await getDailyTrendData(filterTeamName);

    // 日別の合計を計算
    const dailySummary = dailyTrend.map(day => ({
      date: day.date,
      spend: Math.round(day.spend),
      revenue: Math.round(day.revenue),
      profit: Math.round(day.profit),
      roas: Math.round(day.roas * 10) / 10,
    }));

    // 合計を計算
    const totals = {
      spend: dailySummary.reduce((sum, d) => sum + d.spend, 0),
      revenue: dailySummary.reduce((sum, d) => sum + d.revenue, 0),
      profit: dailySummary.reduce((sum, d) => sum + d.profit, 0),
    };

    return NextResponse.json({
      success: true,
      user: {
        role: userRole,
        teamName: userTeamName,
        filterApplied: filterTeamName,
      },
      spreadsheetId: historicalSpreadsheetId,
      sheetName,
      dailyCount: dailySummary.length,
      totals,
      dailySummary,
      currentDate: now.toISOString(),
    });
  } catch (error) {
    console.error("Debug daily error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

