import { NextResponse } from "next/server";
import { getSheetData } from "@/lib/googleSheets";

export async function GET() {
  try {
    // スプレッドシートからデータを取得
    const sheetData = await getSheetData();

    // 1. 当日合計を計算
    const summary = {
      spend: 0,
      mcv: 0,
      cv: 0,
      revenue: 0,
      profit: 0,
      roas: 0,
      cpa: 0,
      cvr: 0,
      monthlyProfit: 0,
    };

    // データを集計
    for (const row of sheetData) {
      summary.spend += row.spend || 0;
      summary.mcv += row.mcv || 0;
      summary.cv += row.cv || 0;
      summary.revenue += row.revenue || 0;
      summary.profit += row.profit || 0;
    }

    // 計算指標
    if (summary.spend > 0) {
      summary.roas = (summary.revenue / summary.spend) * 100;
    }
    if (summary.cv > 0) {
      summary.cpa = summary.spend / summary.cv;
    }
    // CVR計算（クリック数があれば）
    summary.cvr = 0; // クリック数がないため後で追加

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
      revenue: row.revenue || 0,
      profit: row.profit || 0,
      roas: row.roas || 0,
      cpa: row.cpa || 0,
    }));

    // 3. 案件名別の集計
    const projectMap = new Map<string, {
      spend: number;
      mcv: number;
      cv: number;
      revenue: number;
      profit: number;
    }>();

    for (const row of sheetData) {
      // 案件名をCPN名から抽出（例：「案件名_CPN名」の形式を想定）
      const projectName = extractProjectName(row.cpnName || "");
      
      if (!projectMap.has(projectName)) {
        projectMap.set(projectName, { spend: 0, mcv: 0, cv: 0, revenue: 0, profit: 0 });
      }
      
      const project = projectMap.get(projectName)!;
      project.spend += row.spend || 0;
      project.mcv += row.mcv || 0;
      project.cv += row.cv || 0;
      project.revenue += row.revenue || 0;
      project.profit += row.profit || 0;
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
      cvr: 0, // クリック数がないため
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

// 案件名を抽出するヘルパー関数
function extractProjectName(cpnName: string): string {
  // CPN名から案件名を抽出するロジック
  // 例：「案件名_CPN名」→「案件名」
  // 実際のスプレッドシートの形式に合わせて調整が必要
  
  // アンダースコアやハイフンで分割して最初の部分を取得
  const parts = cpnName.split(/[_\-\/]/);
  if (parts.length > 0) {
    return parts[0].trim() || "その他";
  }
  return cpnName || "その他";
}

