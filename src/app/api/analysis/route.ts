import { NextResponse } from "next/server";
import { getFullAnalysisData, getMonthlyProfit, getDailyTrendData, getProjectMonthlyData } from "@/lib/googleSheets";
import { getCache, setCache } from "@/lib/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CACHE_KEY = "analysis_data";
const CACHE_TTL = 60 * 60 * 1000; // 60分間キャッシュ（パフォーマンス改善）

interface CachedData {
  sheetData: Awaited<ReturnType<typeof getFullAnalysisData>>;
  monthlyProfit: number;
  dailyTrend: Awaited<ReturnType<typeof getDailyTrendData>>;
  projectMonthly: Awaited<ReturnType<typeof getProjectMonthlyData>>;
}

interface CpnItem {
  cpnName: string;
  profit: number;
  roas: number;
  consecutiveLoss: number;
  spend: number;
}

interface ProjectItem {
  projectName: string;
  profit: number;
  roas: number;
}

interface MediaItem {
  media: string;
  profit: number;
  roas: number;
}

interface DailyItem {
  date: string;
  profit: number;
  cumulativeProfit: number;
}

interface AIAdvice {
  type: "success" | "warning" | "info" | "danger";
  title: string;
  message: string;
  priority: number;
}

// AIアドバイス生成
function generateAIAdvice(
  summary: { profit: number; roas: number; monthlyProfit: number; spend: number },
  cpnList: CpnItem[],
  projectList: ProjectItem[],
  mediaList: MediaItem[],
  dailyTrend: DailyItem[]
): AIAdvice[] {
  const advice: AIAdvice[] = [];

  // 1. 当日利益の評価
  if (summary.profit > 50000) {
    advice.push({
      type: "success",
      title: "🎉 本日は好調です！",
      message: `本日の利益は¥${Math.round(summary.profit).toLocaleString()}と高水準です。好調なCPNを分析し、他のCPNにも同様の施策を適用することを検討してください。`,
      priority: 1,
    });
  } else if (summary.profit < 0) {
    advice.push({
      type: "danger",
      title: "⚠️ 本日は赤字です",
      message: `本日の利益は¥${Math.round(summary.profit).toLocaleString()}です。赤字CPNの早急な見直しが必要です。`,
      priority: 1,
    });
  }

  // 2. ROAS評価
  if (summary.roas < 100 && summary.spend > 10000) {
    advice.push({
      type: "warning",
      title: "📉 ROASが100%を下回っています",
      message: `現在のROASは${summary.roas.toFixed(1)}%です。広告費用対効果の改善が必要です。低ROASのCPNを特定し、クリエイティブや配信設定の見直しを行いましょう。`,
      priority: 2,
    });
  } else if (summary.roas >= 200) {
    advice.push({
      type: "success",
      title: "💰 ROASが非常に高いです",
      message: `ROASは${summary.roas.toFixed(1)}%と好調です。この勢いを維持しながら、スケールアップの機会を探りましょう。`,
      priority: 2,
    });
  }

  // 3. 赤字CPN警告
  const lossCpns = cpnList.filter(c => c.profit < 0 && c.consecutiveLoss >= 3);
  if (lossCpns.length > 0) {
    advice.push({
      type: "warning",
      title: `🚨 連続赤字CPNが${lossCpns.length}件あります`,
      message: `3日以上連続赤字のCPNがあります。停止または作り替えを検討してください: ${lossCpns.slice(0, 3).map(c => c.cpnName.substring(0, 30)).join(", ")}${lossCpns.length > 3 ? "..." : ""}`,
      priority: 1,
    });
  }

  // 4. 好調CPN
  const topCpns = cpnList.filter(c => c.profit > 10000).slice(0, 3);
  if (topCpns.length > 0) {
    advice.push({
      type: "info",
      title: "✨ 好調なCPNをスケールアップしましょう",
      message: `高利益のCPN: ${topCpns.map(c => `${c.cpnName.substring(0, 25)}(¥${Math.round(c.profit).toLocaleString()})`).join(", ")}。予算増加や類似CPNの作成を検討してください。`,
      priority: 3,
    });
  }

  // 5. 案件別アドバイス
  const topProject = projectList[0];
  const worstProject = projectList[projectList.length - 1];
  if (topProject && topProject.profit > 0) {
    advice.push({
      type: "info",
      title: `📊 「${topProject.projectName}」が最も利益貢献`,
      message: `本日の最高利益案件です（¥${Math.round(topProject.profit).toLocaleString()}）。この案件へのリソース集中を検討してください。`,
      priority: 4,
    });
  }
  if (worstProject && worstProject.profit < -10000) {
    advice.push({
      type: "warning",
      title: `📉 「${worstProject.projectName}」の見直しが必要`,
      message: `この案件は大きな赤字（¥${Math.round(worstProject.profit).toLocaleString()}）を出しています。配信設定の見直しを行いましょう。`,
      priority: 2,
    });
  }

  // 6. 媒体別アドバイス
  const bestMedia = mediaList[0];
  if (bestMedia && bestMedia.profit > 0) {
    advice.push({
      type: "info",
      title: `📱 ${bestMedia.media}が最も効率的`,
      message: `${bestMedia.media}からの利益が¥${Math.round(bestMedia.profit).toLocaleString()}で最高です。この媒体への投資拡大を検討してください。`,
      priority: 4,
    });
  }

  // 7. 月間トレンド
  if (dailyTrend.length >= 3) {
    const recent3Days = dailyTrend.slice(-3);
    const avgProfit = recent3Days.reduce((sum, d) => sum + d.profit, 0) / 3;
    if (avgProfit < 0) {
      advice.push({
        type: "warning",
        title: "📈 直近3日間の利益が低下傾向",
        message: `直近3日間の平均利益は¥${Math.round(avgProfit).toLocaleString()}です。全体的な見直しが必要かもしれません。`,
        priority: 2,
      });
    }
  }

  // 8. 月間累計
  const currentMonth = new Date().getMonth() + 1; // 現在の月を動的に取得
  if (summary.monthlyProfit > 0) {
    advice.push({
      type: "success",
      title: "📅 今月の累計は黒字です",
      message: `${currentMonth}月の累計利益は¥${Math.round(summary.monthlyProfit).toLocaleString()}です。${summary.monthlyProfit > 500000 ? "素晴らしい成績です！" : "このペースを維持しましょう。"}`,
      priority: 5,
    });
  } else if (summary.monthlyProfit < 0) {
    advice.push({
      type: "danger",
      title: "📅 今月の累計が赤字です",
      message: `${currentMonth}月の累計利益は¥${Math.round(summary.monthlyProfit).toLocaleString()}です。早急な対策が必要です。`,
      priority: 1,
    });
  }

  // 優先度でソート
  return advice.sort((a, b) => a.priority - b.priority);
}

export async function GET(request: Request) {
  try {
    // ユーザーセッションを取得
    const session = await auth();
    const userRole = session?.user?.role || "member";
    const userTeamName = session?.user?.teamName || null;
    const userMediaFilter = session?.user?.mediaFilter || null;

    // URLパラメータでキャッシュをスキップできる
    const { searchParams } = new URL(request.url);
    const skipCache = searchParams.get("refresh") === "true";

    // キャッシュからデータを取得（管理者と一般ユーザーで別キャッシュ）
    const cacheKeyWithUser = userRole === "admin" && !userMediaFilter 
      ? CACHE_KEY 
      : `${CACHE_KEY}_${userTeamName || "all"}_${userMediaFilter || "all"}`;
    let cachedData = skipCache ? null : getCache<CachedData>(cacheKeyWithUser);

    // メンバーの場合のフィルタリング用teamName
    const filterTeamName = userRole !== "admin" ? userTeamName : null;

    if (!cachedData) {
      // キャッシュがない場合はスプレッドシートから取得
      // メンバーの場合はteamNameでフィルタリング
      const [sheetData, monthlyProfit, dailyTrend, projectMonthly] = await Promise.all([
        getFullAnalysisData(),
        getMonthlyProfit(filterTeamName),
        getDailyTrendData(filterTeamName),
        getProjectMonthlyData(filterTeamName),
      ]);

      cachedData = { sheetData, monthlyProfit, dailyTrend, projectMonthly };
      setCache(cacheKeyWithUser, cachedData, CACHE_TTL);
      
      // CPNマッピングをDBに保存（非同期）
      const mappingsToSave = sheetData
        .filter(row => row.cpnName && row.campaignId)
        .map(row => ({
          cpnName: row.cpnName,
          campaignId: row.campaignId,
          media: row.media === "Meta" ? "FB" : row.media || "その他",
          accountName: row.accountName,
        }));
      
      if (mappingsToSave.length > 0) {
        Promise.all(mappingsToSave.map(m => 
          prisma.cpn_campaign_mapping.upsert({
            where: { cpn_name: m.cpnName },
            update: { campaign_id: m.campaignId, media: m.media, account_name: m.accountName },
            create: { cpn_name: m.cpnName, campaign_id: m.campaignId, media: m.media, account_name: m.accountName },
          }).catch(() => {})
        )).catch(() => {});
      }
    }

    let { sheetData, monthlyProfit, dailyTrend, projectMonthly } = cachedData;

    // メンバーの場合、担当者名でCPNをフィルタリング
    // CPN名に「新規グロース部_{担当者名}_」が含まれるもののみ表示
    if (filterTeamName) {
      const filterPattern = `新規グロース部_${filterTeamName}_`;
      sheetData = sheetData.filter(row => row.cpnName?.includes(filterPattern));
    }

    // 媒体フィルターが設定されている場合、特定媒体のみ表示
    if (userMediaFilter) {
      sheetData = sheetData.filter(row => row.media === userMediaFilter);
    }

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
      monthlyProfit: monthlyProfit, // 今月利益（動的）
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
    const cpnList = sheetData.map((row) => {
      const spend = row.spend || 0;
      const mcv = row.mcv || 0;
      const cv = row.cv || 0;
      const revenue = row.revenue || 0;
      const impressions = row.impressions || 0;
      const clicks = row.clicks || 0;
      
      // 計算フィールド
      const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
      const cpc = clicks > 0 ? spend / clicks : 0;
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
      const cvr = clicks > 0 ? (cv / clicks) * 100 : 0;
      const mcvr = clicks > 0 ? (mcv / clicks) * 100 : 0;
      const mcpa = mcv > 0 ? spend / mcv : 0;
      const cpa = cv > 0 ? spend / cv : 0;
      
      return {
        cpnKey: row.cpnKey || "",
        cpnName: row.cpnName || "",
        accountName: row.accountName || "",
        dailyBudget: row.dailyBudget || "-",
        budgetSchedule: row.budgetSchedule || "-",
        profit7Days: row.profit7Days || 0,
        roas7Days: row.roas7Days || 0,
        consecutiveZeroMcv: row.consecutiveZeroMcv || 0,
        consecutiveLoss: row.consecutiveLoss || 0,
        spend,
        mcv,
        cv,
        media: row.media || "",
        revenue,
        profit: row.profit || 0,
        roas: row.roas || 0,
        cpa,
        status: row.status || "",
        campaignId: row.campaignId || "",
        // 追加フィールド
        impressions,
        clicks,
        cpm,
        cpc,
        ctr,
        cvr,
        mcvr,
        mcpa,
      };
    });

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

    // AIアドバイスを生成
    const aiAdvice = generateAIAdvice(summary, cpnList, projectList, mediaList, dailyTrend);

    // レスポンスにキャッシュヘッダーを追加
    const response = NextResponse.json({
      success: true,
      summary,
      cpnList,
      projectList,
      mediaList,
      dailyTrend,
      projectMonthly,
      aiAdvice,
      cachedAt: new Date().toISOString(),
      // デバッグ情報（ユーザーフィルタリングの確認用）
      _debug: {
        userRole,
        userTeamName,
        filterTeamName,
        cpnCount: cpnList.length,
      },
    });

    // 積極的なキャッシュ設定（高速表示のため）
    // ブラウザキャッシュ5分、CDNキャッシュ10分、stale-while-revalidate 30分
    response.headers.set("Cache-Control", "public, max-age=300, s-maxage=600, stale-while-revalidate=1800");
    
    return response;
  } catch (error) {
    console.error("Analysis API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: "分析データの取得に失敗しました", details: errorMessage },
      { status: 500 }
    );
  }
}
