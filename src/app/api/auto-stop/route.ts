import { NextResponse } from "next/server";
import { getFullAnalysisData } from "@/lib/googleSheets";

// Meta広告を停止するAPI
async function stopMetaCampaign(campaignId: string, accessToken: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v22.0/${campaignId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "PAUSED",
          access_token: accessToken,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.error?.message || "Failed to stop campaign" };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// 利益閾値（デフォルト: -23,000円）
const PROFIT_THRESHOLD = -23000;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const threshold = body.threshold || PROFIT_THRESHOLD;
    const dryRun = body.dryRun !== false; // デフォルトはdry run（実際には停止しない）

    // データを取得
    const data = await getFullAnalysisData();

    // Metaの利益が閾値を下回っているCPNをフィルタ
    const targetCpns = data.filter(
      (cpn) => cpn.media === "Meta" && cpn.profit < threshold && cpn.campaignId
    );

    if (targetCpns.length === 0) {
      return NextResponse.json({
        success: true,
        message: "停止対象のCPNはありません",
        stopped: [],
        threshold,
      });
    }

    // Meta Access Tokenを取得
    const accessTokens = [
      process.env.META_ACCESS_TOKEN_BUSINESS_01,
      process.env.META_ACCESS_TOKEN_BUSINESS_03,
      process.env.META_ACCESS_TOKEN_BUSINESS_08,
      process.env.META_ACCESS_TOKEN_BUSINESS_11,
      process.env.META_ACCESS_TOKEN_BUSINESS_13,
      process.env.META_ACCESS_TOKEN_BUSINESS_14,
    ].filter(Boolean);

    if (accessTokens.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Meta Access Tokenが設定されていません",
      });
    }

    const results: {
      cpnName: string;
      campaignId: string;
      profit: number;
      stopped: boolean;
      error?: string;
    }[] = [];

    for (const cpn of targetCpns) {
      if (dryRun) {
        // Dry run: 実際には停止しない
        results.push({
          cpnName: cpn.cpnName,
          campaignId: cpn.campaignId,
          profit: cpn.profit,
          stopped: false,
          error: "Dry run mode",
        });
      } else {
        // 実際に停止を試行（複数のトークンを試す）
        let stopped = false;
        let lastError = "";

        for (const token of accessTokens) {
          const result = await stopMetaCampaign(cpn.campaignId, token!);
          if (result.success) {
            stopped = true;
            break;
          }
          lastError = result.error || "Unknown error";
        }

        results.push({
          cpnName: cpn.cpnName,
          campaignId: cpn.campaignId,
          profit: cpn.profit,
          stopped,
          error: stopped ? undefined : lastError,
        });
      }
    }

    const stoppedCount = results.filter((r) => r.stopped).length;

    return NextResponse.json({
      success: true,
      message: dryRun
        ? `${targetCpns.length}件のCPNが停止対象です（Dry Run）`
        : `${stoppedCount}/${targetCpns.length}件のCPNを停止しました`,
      stopped: results,
      threshold,
      dryRun,
    });
  } catch (error) {
    console.error("Auto-stop error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GETで現在の停止対象を確認
export async function GET() {
  try {
    const data = await getFullAnalysisData();

    // Metaの利益が閾値を下回っているCPNをフィルタ
    const targetCpns = data
      .filter((cpn) => cpn.media === "Meta" && cpn.profit < PROFIT_THRESHOLD)
      .map((cpn) => ({
        cpnName: cpn.cpnName,
        campaignId: cpn.campaignId,
        profit: cpn.profit,
        accountName: cpn.accountName,
        status: cpn.status,
      }));

    return NextResponse.json({
      success: true,
      threshold: PROFIT_THRESHOLD,
      count: targetCpns.length,
      targets: targetCpns,
    });
  } catch (error) {
    console.error("Auto-stop check error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

