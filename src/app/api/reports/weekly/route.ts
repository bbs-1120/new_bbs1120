import { NextResponse } from "next/server";
import { getAnalysisData, getHistoricalData } from "@/lib/googleSheets";

interface CpnData {
  cpnKey: string;
  cpnName: string;
  media: string;
  spend: number;
  mcv: number;
  cv: number;
  revenue: number;
  profit: number;
  roas: number;
  impressions?: number;
  clicks?: number;
  ctr?: number;
  cpc?: number;
  cpm?: number;
  mcvr?: number;
  mcpa?: number;
  cvr?: number;
  cpa?: number;
}

// CPN名からメンバー名を抽出
function extractMemberName(cpnName: string): string {
  // 新規グロース部_悠太_DIOクリニック女性_... の形式から2番目を抽出
  const parts = cpnName.split("_");
  if (parts.length >= 2) {
    // "新規グロース部" の次がメンバー名
    if (parts[0].includes("グロース") || parts[0].includes("新規")) {
      return parts[1] || "不明";
    }
  }
  return "その他";
}

// CPN名から案件名を抽出
function extractProjectName(cpnName: string): string {
  // 新規グロース部_悠太_DIOクリニック女性_... の形式から3番目を抽出
  const parts = cpnName.split("_");
  if (parts.length >= 3) {
    if (parts[0].includes("グロース") || parts[0].includes("新規")) {
      return parts[2] || "不明";
    }
  }
  return "その他";
}

// 週の開始日（月曜日）を取得
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

// 週キーから日付範囲を取得
function getWeekDateRange(weekKey: string): { start: Date; end: Date } {
  // "2026-W03" 形式をパース
  const match = weekKey.match(/^(\d{4})-W(\d{2})$/);
  if (!match) {
    const today = new Date();
    const start = getWeekStart(today);
    const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
    return { start, end };
  }
  
  const year = parseInt(match[1]);
  const week = parseInt(match[2]);
  
  // ISO 8601: 第1週は1月4日を含む週
  const jan4 = new Date(year, 0, 4);
  const jan4DayOfWeek = jan4.getDay() || 7;
  const firstMonday = new Date(jan4.getTime() - (jan4DayOfWeek - 1) * 24 * 60 * 60 * 1000);
  
  const start = new Date(firstMonday.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
  
  return { start, end };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const weekKey = searchParams.get("week") || "";
    const memberName = searchParams.get("member") || "";
    
    // 分析データを取得
    const analysisData = await getAnalysisData();
    
    if (!analysisData || !analysisData.cpnList) {
      return NextResponse.json({
        success: false,
        error: "データの取得に失敗しました",
      });
    }
    
    const cpnList = analysisData.cpnList as CpnData[];
    
    // メンバー別に集計
    const memberMap = new Map<string, {
      memberName: string;
      spend: number;
      revenue: number;
      profit: number;
      cpnCount: number;
      cpns: CpnData[];
      projects: Map<string, { spend: number; revenue: number; profit: number; cpnCount: number }>;
      medias: Map<string, { spend: number; revenue: number; profit: number; cpnCount: number }>;
    }>();
    
    for (const cpn of cpnList) {
      const member = extractMemberName(cpn.cpnName);
      const project = extractProjectName(cpn.cpnName);
      
      if (!memberMap.has(member)) {
        memberMap.set(member, {
          memberName: member,
          spend: 0,
          revenue: 0,
          profit: 0,
          cpnCount: 0,
          cpns: [],
          projects: new Map(),
          medias: new Map(),
        });
      }
      
      const memberData = memberMap.get(member)!;
      memberData.spend += cpn.spend || 0;
      memberData.revenue += cpn.revenue || 0;
      memberData.profit += cpn.profit || 0;
      memberData.cpnCount += 1;
      memberData.cpns.push(cpn);
      
      // 案件別集計
      if (!memberData.projects.has(project)) {
        memberData.projects.set(project, { spend: 0, revenue: 0, profit: 0, cpnCount: 0 });
      }
      const projectData = memberData.projects.get(project)!;
      projectData.spend += cpn.spend || 0;
      projectData.revenue += cpn.revenue || 0;
      projectData.profit += cpn.profit || 0;
      projectData.cpnCount += 1;
      
      // 媒体別集計
      const media = cpn.media || "その他";
      if (!memberData.medias.has(media)) {
        memberData.medias.set(media, { spend: 0, revenue: 0, profit: 0, cpnCount: 0 });
      }
      const mediaData = memberData.medias.get(media)!;
      mediaData.spend += cpn.spend || 0;
      mediaData.revenue += cpn.revenue || 0;
      mediaData.profit += cpn.profit || 0;
      mediaData.cpnCount += 1;
    }
    
    // 特定メンバーの詳細を返す
    if (memberName) {
      const memberData = memberMap.get(memberName);
      
      if (!memberData) {
        return NextResponse.json({
          success: false,
          error: "メンバーが見つかりません",
        });
      }
      
      const roas = memberData.spend > 0 ? (memberData.revenue / memberData.spend) * 100 : 0;
      
      // 案件別データ
      const projects = Array.from(memberData.projects.entries()).map(([name, data]) => ({
        name,
        ...data,
        roas: data.spend > 0 ? (data.revenue / data.spend) * 100 : 0,
      })).sort((a, b) => b.profit - a.profit);
      
      // 媒体別データ
      const medias = Array.from(memberData.medias.entries()).map(([name, data]) => ({
        name,
        ...data,
        roas: data.spend > 0 ? (data.revenue / data.spend) * 100 : 0,
      })).sort((a, b) => b.profit - a.profit);
      
      // TOP10 CPN（詳細指標付き）
      const topCpns = memberData.cpns
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 10)
        .map(cpn => ({
          cpnName: cpn.cpnName,
          media: cpn.media,
          spend: cpn.spend,
          revenue: cpn.revenue,
          profit: cpn.profit,
          roas: cpn.roas,
          mcv: cpn.mcv,
          cv: cpn.cv,
          impressions: cpn.impressions || 0,
          clicks: cpn.clicks || 0,
          ctr: cpn.ctr || 0,
          cpc: cpn.cpc || 0,
          cpm: cpn.cpm || 0,
          mcvr: cpn.mcvr || 0,
          mcpa: cpn.mcpa || 0,
          cvr: cpn.cvr || 0,
          cpa: cpn.cpa || 0,
        }));
      
      return NextResponse.json({
        success: true,
        member: {
          memberName: memberData.memberName,
          spend: memberData.spend,
          revenue: memberData.revenue,
          profit: memberData.profit,
          roas,
          cpnCount: memberData.cpnCount,
          profitChange: 0, // TODO: 前週比計算
        },
        projects,
        medias,
        topCpns,
        weekKey,
      });
    }
    
    // メンバー一覧を返す
    const members = Array.from(memberMap.values())
      .filter(m => m.memberName !== "その他" && m.memberName !== "不明")
      .map(m => ({
        memberName: m.memberName,
        spend: m.spend,
        revenue: m.revenue,
        profit: m.profit,
        roas: m.spend > 0 ? (m.revenue / m.spend) * 100 : 0,
        cpnCount: m.cpnCount,
        profitChange: 0, // TODO: 前週比計算
      }))
      .sort((a, b) => b.profit - a.profit);
    
    return NextResponse.json({
      success: true,
      members,
      weekKey,
    });
  } catch (error) {
    console.error("Weekly report API error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
