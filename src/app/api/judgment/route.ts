import { NextResponse } from "next/server";
import { getFullAnalysisData } from "@/lib/googleSheets";
import { judgeAllCpns, judgeAllCpnsWithCustomRules, getJudgmentSummary, AnalysisCpnData, JUDGMENT, CustomRule, RuleCondition } from "@/lib/judgment";
import { getCache, setCache } from "@/lib/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CACHE_KEY = "judgment_results";

// ログを保存する関数
async function saveJudgmentLog(
  userId: string,
  userName: string,
  actionType: string,
  details: Record<string, unknown>
) {
  try {
    await prisma.execution_logs.create({
      data: {
        executed_by: userName || userId,
        action_type: actionType,
        target_count: (details.count as number) || 0,
        rule_version: "custom",
        status: "success",
        error_message: details.customRulesCount ? `カスタムルール${details.customRulesCount}件適用` : null,
      },
    });
  } catch (e) {
    console.error("Failed to save judgment log:", e);
  }
}

// GET: 判定結果を取得
export async function GET(request: Request) {
  try {
    // ユーザーセッションを取得
    const session = await auth();
    const userRole = session?.user?.role || "member";
    const userTeamName = session?.user?.teamName || null;
    const userMediaFilter = session?.user?.mediaFilter || null;

    const { searchParams } = new URL(request.url);
    const judgment = searchParams.get("judgment"); // フィルター用
    const forceRefresh = searchParams.get("refresh") === "true"; // 強制更新

    // ユーザーのカスタム判定ルールを取得
    let customRules: CustomRule[] = [];
    if (session?.user?.id) {
      try {
        const dbRules = await prisma.member_judgment_rules.findMany({
          where: { user_id: session.user.id, is_active: true },
          orderBy: { priority: "desc" },
        });
        customRules = dbRules.map(r => ({
          id: r.id,
          rule_type: r.rule_type as "stop" | "replace" | "continue",
          rule_name: r.rule_name,
          priority: r.priority,
          conditions: r.conditions as RuleCondition[],
          is_active: r.is_active,
        }));
      } catch (e) {
        console.error("Failed to fetch custom rules:", e);
      }
    }

    // カスタムルールがある場合はキャッシュを使わない（リアルタイム判定）
    const hasCustomRules = customRules.length > 0;
    
    // キャッシュをチェック（ユーザー別キャッシュ、カスタムルールがある場合はスキップ）
    const cacheKeyWithUser = userRole === "admin" && !userMediaFilter 
      ? CACHE_KEY 
      : `${CACHE_KEY}_${userTeamName || "all"}_${userMediaFilter || "all"}`;
    let results = (hasCustomRules || forceRefresh) ? null : getCache<ReturnType<typeof judgeAllCpns>>(cacheKeyWithUser);

    if (!results) {
      // マイ分析と同じデータソースからデータを取得
      let analysisData = await getFullAnalysisData();

      // メンバーの場合、担当者名でCPNをフィルタリング
      if (userRole !== "admin" && userTeamName) {
        const filterPattern = `新規グロース部_${userTeamName}_`;
        analysisData = analysisData.filter(row => row.cpnName?.includes(filterPattern));
      }

      // 媒体フィルターが設定されている場合、特定媒体のみ表示
      if (userMediaFilter) {
        analysisData = analysisData.filter(row => row.media === userMediaFilter);
      }

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

      // 判定実行（カスタムルールがあれば適用）
      if (hasCustomRules) {
        results = judgeAllCpnsWithCustomRules(cpnList, customRules);
      } else {
        results = judgeAllCpns(cpnList);
        // キャッシュに保存（60分）- カスタムルールがない場合のみ
        if (!forceRefresh) {
          setCache(cacheKeyWithUser, results, 60 * 60 * 1000);
        }
      }

      // 強制更新の場合はログを保存
      if (forceRefresh && session?.user?.id) {
        saveJudgmentLog(
          session.user.id,
          session.user.teamName || session.user.name || "unknown",
          "judgment_refresh",
          { count: results.length, customRulesCount: customRules.length }
        );
      }
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

    // キャッシュヘッダー付きレスポンス（パフォーマンス改善）
    return NextResponse.json({
      success: true,
      date: new Date().toISOString().split("T")[0],
      summary,
      results: filteredResults,
    }, {
      headers: {
        "Cache-Control": "private, max-age=300, stale-while-revalidate=600",
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
