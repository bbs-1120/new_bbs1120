import { NextResponse } from "next/server";
import { getFullAnalysisData } from "@/lib/googleSheets";

// GET: 連続赤字日数のデバッグ情報を取得（認証不要）
export async function GET() {
  try {
    const data = await getFullAnalysisData();
    
    // 連続赤字日数が0より大きいCPNを抽出
    const cpnsWithLoss = data.filter(cpn => cpn.consecutiveLoss > 0);
    
    // サンプルとして最初の20件を返す
    const sampleCpns = data.slice(0, 20).map(cpn => ({
      cpnName: cpn.cpnName,
      media: cpn.media,
      todayProfit: cpn.profit,
      profit7Days: cpn.profit7Days,
      consecutiveLoss: cpn.consecutiveLoss,
      consecutiveProfit: cpn.consecutiveProfit,
    }));
    
    // 赤字日数の分布
    const distribution = {
      loss0: data.filter(c => c.consecutiveLoss === 0).length,
      loss1: data.filter(c => c.consecutiveLoss === 1).length,
      loss2: data.filter(c => c.consecutiveLoss === 2).length,
      loss3: data.filter(c => c.consecutiveLoss >= 3).length,
    };

    return NextResponse.json({
      success: true,
      totalCpns: data.length,
      cpnsWithLossDays: cpnsWithLoss.length,
      distribution,
      sampleCpns,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Debug consecutive error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}

