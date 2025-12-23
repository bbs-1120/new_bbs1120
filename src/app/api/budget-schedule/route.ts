import { NextResponse } from "next/server";

interface BudgetScheduleRequest {
  cpnName: string;
  campaignId: string;
  accountName?: string;
  startDateTime: string; // ISO形式
  endDateTime: string;   // ISO形式
  budgetAmount: number;  // 追加予算（円）
}

// Meta Graph API のバージョン
const META_API_VERSION = "v23.0";
const META_BASE_URL = "https://graph.facebook.com/";

// すべてのMetaトークンを取得
function getMetaTokens(): string[] {
  return [
    process.env.META_ACCESS_TOKEN,
    process.env.META_TOKEN_BUSINESS01,
    process.env.META_TOKEN_BUSINESS03,
    process.env.META_TOKEN_BUSINESS08,
    process.env.META_TOKEN_BUSINESS11,
    process.env.META_TOKEN_BUSINESS13,
    process.env.META_TOKEN_BUSINESS14,
  ].filter(Boolean) as string[];
}

// キャンペーンの予算スケジュールを有効化
async function enableBudgetSchedule(
  campaignId: string,
  accessToken: string
): Promise<{ success: boolean; error?: string }> {
  const url = `${META_BASE_URL}${META_API_VERSION}/${campaignId}`;
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `is_budget_schedule_enabled=true&access_token=${accessToken}`,
    });

    const data = await response.json();
    
    if (response.ok) {
      return { success: true };
    }
    
    const errorMessage = data.error?.error_user_msg || data.error?.message || "APIエラー";
    return { success: false, error: errorMessage };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "接続エラー" };
  }
}

// 予算スケジュールを作成
async function createBudgetSchedule(
  campaignId: string,
  accessToken: string,
  startTime: number,  // Unix timestamp
  endTime: number,    // Unix timestamp
  budgetValue: number // 円
): Promise<{ success: boolean; error?: string }> {
  const url = `${META_BASE_URL}${META_API_VERSION}/${campaignId}/budget_schedules`;
  
  const params = new URLSearchParams({
    time_start: startTime.toString(),
    time_end: endTime.toString(),
    budget_value: budgetValue.toString(),
    budget_value_type: "ABSOLUTE",
    access_token: accessToken,
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await response.json();
    
    if (response.ok && data.id) {
      return { success: true };
    }
    
    const errorMessage = data.error?.error_user_msg || data.error?.message || "スケジュール作成失敗";
    return { success: false, error: errorMessage };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "接続エラー" };
  }
}

export async function POST(request: Request) {
  try {
    const body: BudgetScheduleRequest = await request.json();
    const { cpnName, campaignId, startDateTime, endDateTime, budgetAmount } = body;

    console.log("Budget schedule request:", { cpnName, campaignId, startDateTime, endDateTime, budgetAmount });

    // バリデーション
    if (!campaignId) {
      return NextResponse.json(
        { success: false, error: "キャンペーンIDが必要です" },
        { status: 400 }
      );
    }

    if (!startDateTime || !endDateTime) {
      return NextResponse.json(
        { success: false, error: "開始日時と終了日時が必要です" },
        { status: 400 }
      );
    }

    if (!budgetAmount || budgetAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "追加予算は0より大きい値が必要です" },
        { status: 400 }
      );
    }

    // 日時をUnixタイムスタンプに変換
    const startTime = Math.floor(new Date(startDateTime).getTime() / 1000);
    const endTime = Math.floor(new Date(endDateTime).getTime() / 1000);
    const now = Math.floor(Date.now() / 1000);

    // 開始時刻のチェック
    if (startTime < now) {
      return NextResponse.json(
        { success: false, error: "開始日時は現在時刻より後に設定してください" },
        { status: 400 }
      );
    }

    // 終了時刻のチェック
    if (endTime <= startTime) {
      return NextResponse.json(
        { success: false, error: "終了日時は開始日時より後に設定してください" },
        { status: 400 }
      );
    }

    // 期間のチェック（最低3時間）
    const durationHours = (endTime - startTime) / 3600;
    if (durationHours < 3) {
      return NextResponse.json(
        { success: false, error: "期間は最低3時間必要です" },
        { status: 400 }
      );
    }

    // Metaトークンを取得
    const tokens = getMetaTokens();
    if (tokens.length === 0) {
      return NextResponse.json(
        { success: false, error: "Meta APIの認証情報が設定されていません" },
        { status: 500 }
      );
    }

    // 各トークンで試行
    let lastError = "トークンが見つかりませんでした";
    
    for (const token of tokens) {
      // Step 1: 予算スケジュールを有効化
      console.log("Enabling budget schedule...");
      const enableResult = await enableBudgetSchedule(campaignId, token);
      
      if (!enableResult.success) {
        // このトークンでは権限がない可能性 - 次のトークンを試す
        if (enableResult.error?.includes("permission") || enableResult.error?.includes("権限")) {
          continue;
        }
        lastError = enableResult.error || "有効化失敗";
        continue;
      }

      // 少し待機
      await new Promise(resolve => setTimeout(resolve, 300));

      // Step 2: 予算スケジュールを作成
      console.log("Creating budget schedule...");
      const createResult = await createBudgetSchedule(
        campaignId,
        token,
        startTime,
        endTime,
        budgetAmount
      );

      if (createResult.success) {
        console.log("Budget schedule created successfully!");
        return NextResponse.json({
          success: true,
          message: "予算スケジュールを設定しました",
          details: {
            campaignId,
            startDateTime,
            endDateTime,
            budgetAmount,
          },
        });
      } else {
        lastError = createResult.error || "スケジュール作成失敗";
        // エラーが権限関連でなければ、これ以上試さない
        if (!createResult.error?.includes("permission") && !createResult.error?.includes("権限")) {
          break;
        }
      }
    }

    return NextResponse.json(
      { success: false, error: lastError },
      { status: 400 }
    );
  } catch (error) {
    console.error("Budget schedule error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// 現在のスケジュールを取得
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get("campaignId");

  if (!campaignId) {
    return NextResponse.json(
      { success: false, error: "campaignId is required" },
      { status: 400 }
    );
  }

  const tokens = getMetaTokens();
  if (tokens.length === 0) {
    return NextResponse.json(
      { success: false, error: "Meta APIの認証情報が設定されていません" },
      { status: 500 }
    );
  }

  for (const token of tokens) {
    try {
      const url = `${META_BASE_URL}${META_API_VERSION}/${campaignId}/budget_schedules?access_token=${token}`;
      const response = await fetch(url);
      const data = await response.json();

      if (response.ok && data.data) {
        return NextResponse.json({
          success: true,
          schedules: data.data,
        });
      }
    } catch {
      continue;
    }
  }

  return NextResponse.json({
    success: true,
    schedules: [],
  });
}

