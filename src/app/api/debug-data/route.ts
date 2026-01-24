import { NextResponse } from "next/server";
import { getFullAnalysisData, getMonthlyProfit, getDailyTrendData } from "@/lib/googleSheets";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    const userRole = session?.user?.role || "member";
    const userTeamName = session?.user?.teamName || null;
    
    // フィルタリング用teamName
    const filterTeamName = userRole !== "admin" ? userTeamName : null;
    
    console.log("Debug - Session:", { userRole, userTeamName, filterTeamName });
    
    // データを取得（キャッシュなし）
    const [allData, monthlyProfit] = await Promise.all([
      getFullAnalysisData(),
      getMonthlyProfit(filterTeamName),
    ]);
    
    // メンバーの場合、CPNをフィルタリング
    let filteredData = allData;
    if (filterTeamName) {
      const filterPattern = `新規グロース部_${filterTeamName}_`;
      filteredData = allData.filter(row => row.cpnName?.includes(filterPattern));
    }
    
    // 当日の合計を計算
    const todayProfit = filteredData.reduce((sum, row) => sum + (row.profit || 0), 0);
    const todaySpend = filteredData.reduce((sum, row) => sum + (row.spend || 0), 0);
    
    return NextResponse.json({
      success: true,
      session: {
        role: userRole,
        teamName: userTeamName,
        filterTeamName,
      },
      data: {
        totalCpnCount: allData.length,
        filteredCpnCount: filteredData.length,
        monthlyProfit: Math.round(monthlyProfit),
        todayProfit: Math.round(todayProfit),
        todaySpend: Math.round(todaySpend),
        sampleCpns: filteredData.slice(0, 3).map(c => ({
          name: c.cpnName?.substring(0, 50),
          profit: c.profit,
        })),
      },
    });
  } catch (error) {
    console.error("Debug data error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "不明なエラー",
    }, { status: 500 });
  }
}

