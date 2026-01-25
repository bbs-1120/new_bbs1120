import { NextResponse } from "next/server";
import { getFullAnalysisData, getMonthlyProfit } from "@/lib/googleSheets";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    const userRole = session?.user?.role || "member";

    // 全データと月間利益を並列取得
    const [allData, monthlyProfit] = await Promise.all([
      getFullAnalysisData(),
      getMonthlyProfit(null), // 全員分
    ]);

    // チームメンバー別に集計
    const memberMap = new Map<string, {
      spend: number;
      revenue: number;
      profit: number;
      cv: number;
      mcv: number;
      cpnCount: number;
      cpns: Array<{
        cpnName: string;
        cpnKey: string;
        media: string;
        spend: number;
        profit: number;
        revenue: number;
        roas: number;
        cv: number;
        mcv: number;
        cpa: number;
        cvr: number;
        status: string;
        campaignId: string;
        accountName: string;
        consecutiveLoss: number;
        profit7Days: number;
        roas7Days: number;
        dailyBudget: string;
      }>;
    }>();

    // 案件別集計
    const projectMap = new Map<string, {
      spend: number;
      revenue: number;
      profit: number;
      cv: number;
      mcv: number;
    }>();

    // 媒体別集計
    const mediaMap = new Map<string, {
      spend: number;
      revenue: number;
      profit: number;
      cv: number;
      mcv: number;
      impressions: number;
      clicks: number;
    }>();

    // 日別集計
    const dailyMap = new Map<string, { profit: number }>();

    for (const row of allData) {
      const cpnName = row.cpnName || "";
      const match = cpnName.match(/新規グロース部_([^_]+)_/);
      if (!match) continue;

      const memberName = match[1];

      // メンバー集計
      if (!memberMap.has(memberName)) {
        memberMap.set(memberName, {
          spend: 0, revenue: 0, profit: 0, cv: 0, mcv: 0, cpnCount: 0, cpns: [],
        });
      }

      const member = memberMap.get(memberName)!;
      member.spend += row.spend || 0;
      member.revenue += row.revenue || 0;
      member.profit += row.profit || 0;
      member.cv += row.cv || 0;
      member.mcv += row.mcv || 0;
      member.cpnCount++;

      member.cpns.push({
        cpnName: row.cpnName || "",
        cpnKey: row.cpnKey || "",
        media: row.media || "",
        spend: row.spend || 0,
        profit: row.profit || 0,
        revenue: row.revenue || 0,
        roas: row.roas || 0,
        cv: row.cv || 0,
        mcv: row.mcv || 0,
        cpa: row.cv > 0 ? (row.spend || 0) / row.cv : 0,
        cvr: row.mcv > 0 ? ((row.cv || 0) / row.mcv) * 100 : 0,
        status: row.status || "",
        campaignId: row.campaignId || "",
        accountName: row.accountName || "",
        consecutiveLoss: row.consecutiveLoss || 0,
        profit7Days: row.profit7Days || 0,
        roas7Days: row.roas7Days || 0,
        dailyBudget: row.dailyBudget || "",
      });

      // 案件名抽出
      const projectMatch = cpnName.match(/新規グロース部_[^_]+_([^_]+)_/);
      if (projectMatch) {
        const projectName = projectMatch[1];
        if (!projectMap.has(projectName)) {
          projectMap.set(projectName, { spend: 0, revenue: 0, profit: 0, cv: 0, mcv: 0 });
        }
        const project = projectMap.get(projectName)!;
        project.spend += row.spend || 0;
        project.revenue += row.revenue || 0;
        project.profit += row.profit || 0;
        project.cv += row.cv || 0;
        project.mcv += row.mcv || 0;
      }

      // 媒体集計
      const media = row.media || "その他";
      if (!mediaMap.has(media)) {
        mediaMap.set(media, { spend: 0, revenue: 0, profit: 0, cv: 0, mcv: 0, impressions: 0, clicks: 0 });
      }
      const mediaData = mediaMap.get(media)!;
      mediaData.spend += row.spend || 0;
      mediaData.revenue += row.revenue || 0;
      mediaData.profit += row.profit || 0;
      mediaData.cv += row.cv || 0;
      mediaData.mcv += row.mcv || 0;
      mediaData.impressions += row.impressions || 0;
      mediaData.clicks += row.clicks || 0;
    }

    // メンバーリスト
    const memberList = Array.from(memberMap.entries()).map(([name, data]) => ({
      name,
      spend: data.spend,
      revenue: data.revenue,
      profit: data.profit,
      roas: data.spend > 0 ? (data.revenue / data.spend) * 100 : 0,
      cv: data.cv,
      mcv: data.mcv,
      cpnCount: data.cpnCount,
      cpns: data.cpns.sort((a, b) => b.profit - a.profit),
    })).sort((a, b) => b.profit - a.profit);

    // 案件リスト
    const projectList = Array.from(projectMap.entries()).map(([name, data]) => ({
      name,
      spend: data.spend,
      revenue: data.revenue,
      profit: data.profit,
      roas: data.spend > 0 ? (data.revenue / data.spend) * 100 : 0,
      cv: data.cv,
      mcv: data.mcv,
      cpa: data.cv > 0 ? data.spend / data.cv : 0,
      cvr: data.mcv > 0 ? (data.cv / data.mcv) * 100 : 0,
    })).sort((a, b) => b.profit - a.profit);

    // 媒体リスト
    const mediaList = Array.from(mediaMap.entries()).map(([media, data]) => ({
      media,
      spend: data.spend,
      revenue: data.revenue,
      profit: data.profit,
      roas: data.spend > 0 ? (data.revenue / data.spend) * 100 : 0,
      cv: data.cv,
      mcv: data.mcv,
      cpa: data.cv > 0 ? data.spend / data.cv : 0,
      cvr: data.mcv > 0 ? (data.cv / data.mcv) * 100 : 0,
      cpm: data.impressions > 0 ? (data.spend / data.impressions) * 1000 : 0,
      cpc: data.clicks > 0 ? data.spend / data.clicks : 0,
      ctr: data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0,
      impressions: data.impressions,
      clicks: data.clicks,
    })).sort((a, b) => b.profit - a.profit);

    // 日別トレンドデータ（ダミー - 実際はhistoricalDataから計算）
    const today = new Date();
    const dailyTrend = [];
    let cumulativeProfit = 0;
    for (let i = 25; i >= 1; i--) {
      const date = new Date(today.getFullYear(), today.getMonth(), i);
      if (date > today) continue;
      
      // 今日のデータは実際の値を使用
      const dayProfit = i === today.getDate() 
        ? memberList.reduce((sum, m) => sum + m.profit, 0)
        : Math.floor(Math.random() * 100000) - 30000; // ダミー
      
      cumulativeProfit += dayProfit;
      dailyTrend.push({
        date: `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`,
        profit: dayProfit,
        cumulativeProfit,
      });
    }

    // チーム全体のサマリー
    const totalSpend = memberList.reduce((sum, m) => sum + m.spend, 0);
    const totalRevenue = memberList.reduce((sum, m) => sum + m.revenue, 0);
    const totalProfit = memberList.reduce((sum, m) => sum + m.profit, 0);
    const totalCv = memberList.reduce((sum, m) => sum + m.cv, 0);
    const totalMcv = memberList.reduce((sum, m) => sum + m.mcv, 0);

    const teamSummary = {
      totalSpend,
      totalRevenue,
      totalProfit,
      totalCv,
      totalMcv,
      totalCpnCount: memberList.reduce((sum, m) => sum + m.cpnCount, 0),
      memberCount: memberList.length,
      roas: totalSpend > 0 ? (totalRevenue / totalSpend) * 100 : 0,
      monthlyProfit: monthlyProfit || totalProfit,
      cpa: totalCv > 0 ? totalSpend / totalCv : 0,
      cvr: totalMcv > 0 ? (totalCv / totalMcv) * 100 : 0,
    };

    return NextResponse.json({
      success: true,
      teamSummary,
      memberList,
      projectList,
      mediaList,
      dailyTrend,
      userRole,
    });
  } catch (error) {
    console.error("Team analysis API error:", error);
    return NextResponse.json(
      { success: false, error: "チームデータの取得に失敗しました" },
      { status: 500 }
    );
  }
}
