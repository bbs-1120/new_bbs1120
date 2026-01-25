import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendErrorNotification } from "@/lib/chatwork";

// Meta APIでキャンペーンをONにする
async function turnOnMetaCampaign(
  cpnName: string,
  campaignId?: string | null
): Promise<{ success: boolean; error?: string }> {
  // キャンペーンIDがない場合はスキップ
  if (!campaignId) {
    return { success: false, error: "キャンペーンIDがありません" };
  }

  const tokens = [
    process.env.META_ACCESS_TOKEN,
    process.env.META_TOKEN_BUSINESS01,
    process.env.META_TOKEN_BUSINESS03,
    process.env.META_TOKEN_BUSINESS08,
    process.env.META_TOKEN_BUSINESS11,
    process.env.META_TOKEN_BUSINESS13,
    process.env.META_TOKEN_BUSINESS14,
  ].filter(Boolean);

  for (const token of tokens) {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${campaignId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "ACTIVE",
            access_token: token,
          }),
        }
      );

      const data = await response.json();

      if (data.success || !data.error) {
        return { success: true };
      }
    } catch (error) {
      console.error(`Meta API error for ${cpnName}:`, error);
    }
  }

  return { success: false, error: "全てのトークンで失敗しました" };
}

// TikTok/Pangle APIでキャンペーンをONにする
async function turnOnTikTokCampaign(
  cpnName: string,
  campaignId?: string | null,
  advertiserId?: string | null
): Promise<{ success: boolean; error?: string }> {
  if (!campaignId || !advertiserId) {
    return { success: false, error: "キャンペーンIDまたは広告主IDがありません" };
  }

  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  if (!accessToken) {
    return { success: false, error: "TikTokアクセストークンがありません" };
  }

  try {
    const response = await fetch(
      "https://business-api.tiktok.com/open_api/v1.3/campaign/update/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Access-Token": accessToken,
        },
        body: JSON.stringify({
          advertiser_id: advertiserId,
          campaign_id: campaignId,
          operation_status: "ENABLE",
        }),
      }
    );

    const data = await response.json();

    if (data.code === 0) {
      return { success: true };
    } else {
      return { success: false, error: data.message || "TikTok API error" };
    }
  } catch (error) {
    console.error(`TikTok API error for ${cpnName}:`, error);
    return { success: false, error: "TikTok API呼び出しに失敗しました" };
  }
}

// POST: 0:00に実行される自動ON処理
export async function POST(request: Request) {
  try {
    // 今日の日付を取得
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 今日実行予定の予約を取得
    const scheduled = await prisma.scheduled_on.findMany({
      where: {
        scheduled_at: today,
        status: "pending",
      },
    });

    if (scheduled.length === 0) {
      return NextResponse.json({
        success: true,
        message: "実行する予約がありません",
        executed: 0,
      });
    }

    const results: {
      cpnName: string;
      media: string;
      success: boolean;
      error?: string;
    }[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (const item of scheduled) {
      let result: { success: boolean; error?: string };

      if (item.media === "Meta") {
        result = await turnOnMetaCampaign(item.cpn_name, item.campaign_id);
      } else if (item.media === "TikTok" || item.media === "Pangle") {
        // TikTok/Pangleの場合は広告主IDも必要
        // TODO: advertiserIdのマッピングを追加
        result = await turnOnTikTokCampaign(item.cpn_name, item.campaign_id, null);
      } else {
        result = { success: false, error: "不明な媒体です" };
      }

      // ステータスを更新
      await prisma.scheduled_on.update({
        where: { id: item.id },
        data: {
          status: result.success ? "completed" : "failed",
          executed_at: new Date(),
          error_message: result.error,
        },
      });

      if (result.success) {
        successCount++;
      } else {
        failedCount++;
      }

      results.push({
        cpnName: item.cpn_name,
        media: item.media,
        success: result.success,
        error: result.error,
      });

      // API制限を避けるため少し待機
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // 履歴を保存
    await prisma.scheduled_on_history.create({
      data: {
        total_count: scheduled.length,
        success_count: successCount,
        failed_count: failedCount,
        details: results,
      },
    });

    // 失敗があった場合はChatworkに通知
    if (failedCount > 0) {
      const failedItems = results.filter((r) => !r.success);
      const errorDetails = failedItems
        .map((r) => `・${r.media}: ${r.cpnName} - ${r.error}`)
        .join("\n");

      await sendErrorNotification(
        "status_change",
        `翌日ON自動実行で${failedCount}件の失敗がありました`,
        {
          成功: successCount,
          失敗: failedCount,
          失敗詳細: errorDetails,
        }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${successCount}件成功、${failedCount}件失敗`,
      successCount,
      failedCount,
      results,
    });
  } catch (error) {
    console.error("Execute scheduled ON error:", error);

    // エラー通知
    await sendErrorNotification(
      "system",
      "翌日ON自動実行でシステムエラーが発生しました",
      { error: error instanceof Error ? error.message : "Unknown error" }
    );

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET: ステータス確認
export async function GET() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pendingCount = await prisma.scheduled_on.count({
    where: {
      scheduled_at: today,
      status: "pending",
    },
  });

  return NextResponse.json({
    scheduledTime: "0:00 JST",
    pendingCount,
    description: "予約されたCPNを自動でONにする",
  });
}

