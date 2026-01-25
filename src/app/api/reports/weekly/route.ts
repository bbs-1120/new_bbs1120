import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Google Sheets APIからデータ取得
async function getWeeklyData(weekKey: string) {
  try {
    const [year, weekStr] = weekKey.split("-W");
    const weekNum = parseInt(weekStr);
    
    const jan1 = new Date(parseInt(year), 0, 1);
    const days = (weekNum - 1) * 7;
    const weekStart = new Date(jan1.getTime() + days * 24 * 60 * 60 * 1000);
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
    weekStart.setDate(diff);
    
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
    
    const { getHistoricalData } = await import("@/lib/googleSheets");
    const allData = await getHistoricalData(weekStart, weekEnd);
    
    return allData;
  } catch (error) {
    console.error("Failed to get weekly data:", error);
    const { getFullAnalysisData } = await import("@/lib/googleSheets");
    return await getFullAnalysisData();
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const weekKey = searchParams.get("week");
    const memberFilter = searchParams.get("member");
    
    if (!weekKey) {
      return NextResponse.json({ success: false, error: "週が指定されていません" }, { status: 400 });
    }
    
    const allData = await getWeeklyData(weekKey);
    
    // メンバー一覧
    const memberSet = new Set<string>();
    for (const row of allData) {
      const match = row.cpnName?.match(/新規グロース部_([^_]+)_/);
      if (match) memberSet.add(match[1]);
    }
    const members = Array.from(memberSet).sort();
    
    // フィルタリング
    const filteredData = memberFilter && memberFilter !== "全員"
      ? allData.filter(row => row.cpnName?.includes(`新規グロース部_${memberFilter}_`))
      : allData;
    
    // 集計マップ
    const memberMap = new Map<string, { spend: number; revenue: number; profit: number; cv: number; mcv: number; cpnCount: number }>();
    const projectMap = new Map<string, { spend: number; revenue: number; profit: number; cv: number; mcv: number }>();
    const mediaMap = new Map<string, { spend: number; revenue: number; profit: number; cv: number; mcv: number }>();
    const projectMediaMap = new Map<string, { project: string; media: string; spend: number; revenue: number; profit: number; cv: number; mcv: number }>();
    
    // CPN別データ（詳細指標付き）
    const cpnList: {
      cpnKey: string; cpnName: string; media: string; memberName: string;
      spend: number; revenue: number; profit: number; roas: number;
      cv: number; mcv: number;
      impressions: number; clicks: number;
      cpm: number; cpc: number; ctr: number; cpa: number;
      mcvr: number; mcpa: number; cvr: number;
      campaignId?: string;
    }[] = [];
    
    for (const row of filteredData) {
      const cpnName = row.cpnName || "";
      const media = row.media === "Meta" ? "FB" : row.media || "その他";
      
      const memberMatch = cpnName.match(/新規グロース部_([^_]+)_/);
      const memberName = memberMatch ? memberMatch[1] : "不明";
      
      if (memberMatch) {
        const existing = memberMap.get(memberName) || { spend: 0, revenue: 0, profit: 0, cv: 0, mcv: 0, cpnCount: 0 };
        existing.spend += row.spend || 0;
        existing.revenue += row.revenue || 0;
        existing.profit += row.profit || 0;
        existing.cv += row.cv || 0;
        existing.mcv += row.mcv || 0;
        existing.cpnCount++;
        memberMap.set(memberName, existing);
      }
      
      const projectMatch = cpnName.match(/新規グロース部_[^_]+_([^_]+)_/);
      if (projectMatch) {
        const projectName = projectMatch[1];
        
        const projExisting = projectMap.get(projectName) || { spend: 0, revenue: 0, profit: 0, cv: 0, mcv: 0 };
        projExisting.spend += row.spend || 0;
        projExisting.revenue += row.revenue || 0;
        projExisting.profit += row.profit || 0;
        projExisting.cv += row.cv || 0;
        projExisting.mcv += row.mcv || 0;
        projectMap.set(projectName, projExisting);
        
        const pmKey = `${projectName}|${media}`;
        const pmExisting = projectMediaMap.get(pmKey) || { project: projectName, media, spend: 0, revenue: 0, profit: 0, cv: 0, mcv: 0 };
        pmExisting.spend += row.spend || 0;
        pmExisting.revenue += row.revenue || 0;
        pmExisting.profit += row.profit || 0;
        pmExisting.cv += row.cv || 0;
        pmExisting.mcv += row.mcv || 0;
        projectMediaMap.set(pmKey, pmExisting);
      }
      
      const mediaExisting = mediaMap.get(media) || { spend: 0, revenue: 0, profit: 0, cv: 0, mcv: 0 };
      mediaExisting.spend += row.spend || 0;
      mediaExisting.revenue += row.revenue || 0;
      mediaExisting.profit += row.profit || 0;
      mediaExisting.cv += row.cv || 0;
      mediaExisting.mcv += row.mcv || 0;
      mediaMap.set(media, mediaExisting);
      
      // CPN追加（詳細指標含む）
      const spend = row.spend || 0;
      const mcvVal = row.mcv || 0;
      const cvVal = row.cv || 0;
      const impressions = (row as { impressions?: number }).impressions || 0;
      const clicks = (row as { clicks?: number }).clicks || 0;
      
      cpnList.push({
        cpnKey: row.cpnKey || "",
        cpnName,
        media,
        memberName,
        spend,
        revenue: row.revenue || 0,
        profit: row.profit || 0,
        roas: row.roas || 0,
        cv: cvVal,
        mcv: mcvVal,
        impressions,
        clicks,
        cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
        cpc: clicks > 0 ? spend / clicks : 0,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        cpa: cvVal > 0 ? spend / cvVal : 0,
        mcvr: clicks > 0 ? (mcvVal / clicks) * 100 : 0,
        mcpa: mcvVal > 0 ? spend / mcvVal : 0,
        cvr: mcvVal > 0 ? (cvVal / mcvVal) * 100 : 0,
        campaignId: row.campaignId,
      });
    }
    
    // ランキング
    const memberRankings = Array.from(memberMap.entries())
      .map(([name, data]) => ({
        name, profit: data.profit, spend: data.spend, revenue: data.revenue,
        roas: data.spend > 0 ? (data.revenue / data.spend) * 100 : 0,
        cpnCount: data.cpnCount,
      }))
      .sort((a, b) => b.profit - a.profit);
    
    const projectData = Array.from(projectMap.entries())
      .map(([name, data]) => ({
        name, profit: data.profit, spend: data.spend, revenue: data.revenue,
        cv: data.cv, mcv: data.mcv,
        roas: data.spend > 0 ? (data.revenue / data.spend) * 100 : 0,
      }))
      .sort((a, b) => b.profit - a.profit);
    
    const mediaData = Array.from(mediaMap.entries())
      .map(([media, data]) => ({
        media, profit: data.profit, spend: data.spend, revenue: data.revenue, cv: data.cv,
        roas: data.spend > 0 ? (data.revenue / data.spend) * 100 : 0,
      }))
      .sort((a, b) => b.profit - a.profit);
    
    const projectMediaData = Array.from(projectMediaMap.values())
      .map(data => ({ ...data, roas: data.spend > 0 ? (data.revenue / data.spend) * 100 : 0 }))
      .sort((a, b) => b.profit - a.profit);
    
    // TOP10
    const top10Profit = cpnList.sort((a, b) => b.profit - a.profit).slice(0, 10);
    const top10Loss = cpnList.filter(c => c.profit < 0).sort((a, b) => a.profit - b.profit).slice(0, 10);
    
    // コメント取得
    const commentMember = memberFilter || "全体";
    const savedReport = await prisma.weekly_report_comments.findFirst({
      where: { week_key: weekKey, member_name: commentMember },
    }).catch(() => null);
    
    let tasks: { id: string; content: string; completed: boolean }[] = [];
    let projectComments: Record<string, { shokan: string; result: string; next: string }> = {};
    
    if (savedReport?.todo_list) {
      try { 
        const parsed = JSON.parse(savedReport.todo_list);
        // 新形式（tasks + projectComments）か旧形式（配列のみ）かを判定
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "tasks" in parsed) {
          tasks = parsed.tasks || [];
          projectComments = parsed.projectComments || {};
        } else if (Array.isArray(parsed)) {
          tasks = parsed;
        }
      } catch {}
    }
    
    return NextResponse.json({
      success: true,
      members,
      memberRankings,
      projectData,
      mediaData,
      projectMediaData,
      top10Profit,
      top10Loss,
      cpnList,
      growthFactors: savedReport?.growth_comment || "",
      shrinkFactors: savedReport?.shrink_comment || "",
      tasks,
      projectComments,
    });
  } catch (error) {
    console.error("Weekly report GET error:", error);
    return NextResponse.json({ success: false, error: "レポートの取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "認証が必要です" }, { status: 401 });
    }
    
    const body = await request.json();
    const { weekKey, memberName, growthFactors, shrinkFactors, tasks, projectComments } = body;
    
    if (!weekKey) {
      return NextResponse.json({ success: false, error: "週が指定されていません" }, { status: 400 });
    }
    
    const saveMemberName = memberName || "全体";
    
    // tasks と projectComments を一緒に保存
    const todoData = JSON.stringify({
      tasks: tasks || [],
      projectComments: projectComments || {},
    });
    
    await prisma.weekly_report_comments.upsert({
      where: { week_key_member_name: { week_key: weekKey, member_name: saveMemberName } },
      update: {
        growth_comment: growthFactors || "",
        shrink_comment: shrinkFactors || "",
        todo_list: todoData,
        updated_at: new Date(),
      },
      create: {
        week_key: weekKey,
        member_name: saveMemberName,
        growth_comment: growthFactors || "",
        shrink_comment: shrinkFactors || "",
        todo_list: todoData,
        updated_at: new Date(),
      },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Weekly report POST error:", error);
    return NextResponse.json({ success: false, error: "保存に失敗しました" }, { status: 500 });
  }
}
