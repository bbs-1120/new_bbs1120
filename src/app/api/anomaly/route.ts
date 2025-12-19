import { NextResponse } from "next/server";
import { checkCpnAnomalies, analyzeAnomalyWithAI, CpnAnomalyCheck } from "@/lib/anomaly-detection";
import { sendAnomalyNotification } from "@/lib/line";
import { getSheetData } from "@/lib/googleSheets";

// 過去7日間のデータを取得してシミュレート（実際はDBから取得）
function generateHistoricalData(currentValue: number, variance: number = 0.2): number[] {
  const data: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const randomFactor = 1 + (Math.random() - 0.5) * variance;
    data.push(Math.round(currentValue * randomFactor));
  }
  return data;
}

export async function GET() {
  try {
    // Google Sheetsからデータ取得
    const rawData = await getSheetData();
    
    if (!rawData || rawData.length === 0) {
      return NextResponse.json({ 
        success: true, 
        anomalies: [],
        message: "データがありません"
      });
    }

    // CPNデータを異常検知用に変換
    const cpnData = rawData.slice(0, 50).map(row => ({
      cpnName: row.cpnName || "Unknown",
      spend: row.spend || 0,
      profit: row.profit || 0,
      mcv: row.mcv || 0,
      cv: row.cv || 0,
      roas: row.roas || 0,
      historical: {
        spend: generateHistoricalData(row.spend || 0),
        profit: generateHistoricalData(row.profit || 0, 0.4),
        mcv: generateHistoricalData(row.mcv || 0),
        cv: generateHistoricalData(row.cv || 0),
        roas: generateHistoricalData(row.roas || 0, 0.15)
      }
    }));

    // 異常検知実行
    const anomalies = checkCpnAnomalies(cpnData);
    
    // 分析テキスト生成
    const analysis = await analyzeAnomalyWithAI(anomalies);

    // クリティカルな異常があればLINE通知
    const criticalAnomalies = anomalies.filter(a => 
      a.result.severity === 'critical' || a.result.severity === 'high'
    );

    if (criticalAnomalies.length > 0) {
      for (const anomaly of criticalAnomalies.slice(0, 3)) {
        await sendAnomalyNotification(
          anomaly.metric,
          anomaly.cpnName,
          anomaly.currentValue,
          anomaly.previousValue,
          anomaly.result.changePercent
        );
      }
    }

    return NextResponse.json({
      success: true,
      anomalies,
      analysis,
      summary: {
        total: anomalies.length,
        critical: anomalies.filter(a => a.result.severity === 'critical').length,
        high: anomalies.filter(a => a.result.severity === 'high').length,
        medium: anomalies.filter(a => a.result.severity === 'medium').length,
      }
    });
  } catch (error) {
    console.error("Anomaly detection error:", error);
    return NextResponse.json({ 
      success: false, 
      error: "異常検知に失敗しました" 
    }, { status: 500 });
  }
}

// 手動で異常検知を実行
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { cpnData } = body;

    if (!cpnData || !Array.isArray(cpnData)) {
      return NextResponse.json({ 
        success: false, 
        error: "cpnDataが必要です" 
      }, { status: 400 });
    }

    const anomalies = checkCpnAnomalies(cpnData);
    const analysis = await analyzeAnomalyWithAI(anomalies);

    return NextResponse.json({
      success: true,
      anomalies,
      analysis
    });
  } catch (error) {
    console.error("Anomaly detection error:", error);
    return NextResponse.json({ 
      success: false, 
      error: "異常検知に失敗しました" 
    }, { status: 500 });
  }
}

