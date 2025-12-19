import { NextResponse } from "next/server";
import { generateGPTAdvice, isOpenAIConfigured } from "@/lib/openai";
import { getFullAnalysisData, getMonthlyProfit, getDailyTrendData } from "@/lib/googleSheets";
import { getCache, setCache } from "@/lib/cache";

const CACHE_KEY = "gpt_advice";
const CACHE_TTL = 10 * 60 * 1000; // 10分間キャッシュ

export async function GET() {
  try {
    // OpenAI APIキーが設定されているかチェック
    if (!isOpenAIConfigured()) {
      return NextResponse.json({
        success: false,
        error: "OPENAI_API_KEY が設定されていません。.envファイルに追加してください。",
        configured: false,
      });
    }

    // キャッシュをチェック
    const cached = getCache<{ advice: string; generatedAt: string }>(CACHE_KEY);
    if (cached) {
      return NextResponse.json({
        success: true,
        advice: cached.advice,
        generatedAt: cached.generatedAt,
        fromCache: true,
        configured: true,
      });
    }

    // データを取得
    const [analysisData, monthlyProfit, dailyTrend] = await Promise.all([
      getFullAnalysisData(),
      getMonthlyProfit(),
      getDailyTrendData(),
    ]);

    // サマリーを計算
    const summary = {
      spend: 0,
      profit: 0,
      roas: 0,
      monthlyProfit,
      mcv: 0,
      cv: 0,
    };

    for (const row of analysisData) {
      summary.spend += row.spend || 0;
      summary.profit += row.profit || 0;
      summary.mcv += row.mcv || 0;
      summary.cv += row.cv || 0;
    }

    let totalRevenue = 0;
    for (const row of analysisData) {
      totalRevenue += row.revenue || 0;
    }
    summary.roas = summary.spend > 0 ? (totalRevenue / summary.spend) * 100 : 0;

    // TOP/WORST CPNを抽出
    const sortedByProfit = [...analysisData].sort((a, b) => b.profit - a.profit);
    const topCpns = sortedByProfit.slice(0, 5).map(c => ({
      name: c.cpnName,
      profit: c.profit,
      roas: c.roas || 0,
    }));

    const worstCpns = sortedByProfit
      .filter(c => c.profit < 0)
      .reverse()
      .slice(0, 5)
      .map(c => ({
        name: c.cpnName,
        profit: c.profit,
        consecutiveLoss: c.consecutiveLoss || 0,
      }));

    // 案件別集計
    const projectMap = new Map<string, number>();
    for (const row of analysisData) {
      const projectName = row.projectName || "その他";
      projectMap.set(projectName, (projectMap.get(projectName) || 0) + row.profit);
    }
    const projectList = Array.from(projectMap.entries())
      .map(([name, profit]) => ({ name, profit }))
      .sort((a, b) => b.profit - a.profit);

    // 媒体別集計
    const mediaMap = new Map<string, { profit: number; spend: number; revenue: number }>();
    for (const row of analysisData) {
      const media = row.media || "その他";
      if (!mediaMap.has(media)) {
        mediaMap.set(media, { profit: 0, spend: 0, revenue: 0 });
      }
      const m = mediaMap.get(media)!;
      m.profit += row.profit || 0;
      m.spend += row.spend || 0;
      m.revenue += row.revenue || 0;
    }
    const mediaPerformance = Array.from(mediaMap.entries())
      .map(([name, data]) => ({
        name,
        profit: data.profit,
        roas: data.spend > 0 ? (data.revenue / data.spend) * 100 : 0,
      }))
      .sort((a, b) => b.profit - a.profit);

    // GPTにデータを渡してアドバイスを生成
    const advice = await generateGPTAdvice({
      summary,
      topCpns,
      worstCpns,
      topProjects: projectList.slice(0, 5),
      worstProjects: projectList.filter(p => p.profit < 0).reverse().slice(0, 5),
      mediaPerformance,
      dailyTrend: dailyTrend.map(d => ({ date: d.date, profit: d.profit })),
    });

    const generatedAt = new Date().toISOString();

    // キャッシュに保存
    setCache(CACHE_KEY, { advice, generatedAt }, CACHE_TTL);

    return NextResponse.json({
      success: true,
      advice,
      generatedAt,
      fromCache: false,
      configured: true,
    });
  } catch (error) {
    console.error("AI Advice API error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "AIアドバイスの生成に失敗しました",
        configured: isOpenAIConfigured(),
      },
      { status: 500 }
    );
  }
}

// キャッシュをクリアして再生成
export async function POST() {
  try {
    if (!isOpenAIConfigured()) {
      return NextResponse.json({
        success: false,
        error: "OPENAI_API_KEY が設定されていません",
        configured: false,
      });
    }

    // キャッシュをクリア
    setCache(CACHE_KEY, null, 0);

    // GETと同じ処理を実行
    const response = await GET();
    return response;
  } catch (error) {
    console.error("AI Advice regenerate error:", error);
    return NextResponse.json(
      { success: false, error: "再生成に失敗しました" },
      { status: 500 }
    );
  }
}

