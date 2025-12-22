import { NextResponse } from "next/server";
import { getFullAnalysisData } from "@/lib/googleSheets";
import { judgeAllCpns, getJudgmentSummary, AnalysisCpnData, JUDGMENT } from "@/lib/judgment";
import { getCache, setCache } from "@/lib/cache";

const CACHE_KEY = "judgment_results";

// GET: 判定結果を取得
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const judgment = searchParams.get("judgment"); // フィルター用

    // キャッシュをチェック
    let results = getCache<ReturnType<typeof judgeAllCpns>>(CACHE_KEY);

    if (!results) {
      // マイ分析と同じデータソースからデータを取得
      const analysisData = await getFullAnalysisData();

      // CPN データを判定用の形式に変換（accountName追加）
      const cpnList: AnalysisCpnData[] = analysisData.map((cpn: {
        cpnKey: string;
        cpnName: string;
        media: string;
        profit: number;
        profit7Days: number;
        roas7Days: number;
        consecutiveLoss: number;
        consecutiveProfit: number;
        accountName?: string;
      }) => ({
        cpnKey: cpn.cpnKey,
        cpnName: cpn.cpnName,
        media: cpn.media,
        profit: cpn.profit,
        profit7Days: cpn.profit7Days,
        roas7Days: cpn.roas7Days,
        consecutiveLoss: cpn.consecutiveLoss,
        consecutiveProfit: cpn.consecutiveProfit || 0,
        accountName: cpn.accountName || "",
      }));

      // 判定実行
      results = judgeAllCpns(cpnList);

      // キャッシュに保存（3分）
      setCache(CACHE_KEY, results, 30 * 60 * 1000); // 30分
    }

    // フィルター適用
    let filteredResults = results;
    if (judgment) {
      const judgmentMap: Record<string, string> = {
        stop: JUDGMENT.STOP,
        replace: JUDGMENT.REPLACE,
        continue: JUDGMENT.CONTINUE,
        error: JUDGMENT.ERROR,
      };
      const targetJudgment = judgmentMap[judgment];
      if (targetJudgment) {
        filteredResults = results.filter((r) => r.judgment === targetJudgment);
      }
    }

    // サマリーを計算
    const summary = getJudgmentSummary(results);

    // キャッシュヘッダー付きレスポンス
    return NextResponse.json({
      success: true,
      date: new Date().toISOString().split("T")[0],
      summary,
      results: filteredResults,
    }, {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    console.error("Get judgment results error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "結果の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST: 判定を再実行（キャッシュクリア）
export async function POST() {
  try {
    // マイ分析と同じデータソースからデータを取得
    const analysisData = await getFullAnalysisData();

    // CPN データを判定用の形式に変換（accountName追加）
    const cpnList: AnalysisCpnData[] = analysisData.map((cpn: {
      cpnKey: string;
      cpnName: string;
      media: string;
      profit: number;
      profit7Days: number;
      roas7Days: number;
      consecutiveLoss: number;
      consecutiveProfit: number;
      accountName?: string;
    }) => ({
      cpnKey: cpn.cpnKey,
      cpnName: cpn.cpnName,
      media: cpn.media,
      profit: cpn.profit,
      profit7Days: cpn.profit7Days,
      roas7Days: cpn.roas7Days,
      consecutiveLoss: cpn.consecutiveLoss,
      consecutiveProfit: cpn.consecutiveProfit || 0,
      accountName: cpn.accountName || "",
    }));

    // 判定実行
    const results = judgeAllCpns(cpnList);

    // キャッシュを更新
    setCache(CACHE_KEY, results, 180);

    // サマリーを計算
    const summary = getJudgmentSummary(results);

    return NextResponse.json({
      success: true,
      count: results.length,
      summary,
      results,
    });
  } catch (error) {
    console.error("Judgment error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "判定処理に失敗しました" },
      { status: 500 }
    );
  }
}
