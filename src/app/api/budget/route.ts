import { NextResponse } from "next/server";

interface BudgetChangeRequest {
  cpnKey: string;
  cpnName: string;
  media: string;
  campaignId?: string;
  newBudget: number;
}

export async function POST(request: Request) {
  try {
    const body: BudgetChangeRequest = await request.json();
    const { cpnName, media, campaignId, newBudget } = body;

    console.log("Budget change request:", { cpnName, media, campaignId, newBudget });

    // 対象媒体かチェック
    if (!["Meta", "TikTok", "Pangle"].includes(media)) {
      return NextResponse.json(
        { success: false, error: "この媒体は予算変更に対応していません" },
        { status: 400 }
      );
    }

    // 予算が有効かチェック
    if (newBudget < 0) {
      return NextResponse.json(
        { success: false, error: "予算は0以上で指定してください" },
        { status: 400 }
      );
    }

    // 媒体別のAPI呼び出し
    let result;
    switch (media) {
      case "Meta":
        result = await updateMetaBudget(campaignId, newBudget);
        break;
      case "TikTok":
        result = await updateTikTokBudget(campaignId, newBudget);
        break;
      case "Pangle":
        result = await updatePangleBudget(campaignId, newBudget);
        break;
      default:
        return NextResponse.json(
          { success: false, error: "未対応の媒体です" },
          { status: 400 }
        );
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `${cpnName}の予算を¥${newBudget.toLocaleString()}に変更しました`,
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Budget API error:", error);
    return NextResponse.json(
      { success: false, error: "予算変更に失敗しました" },
      { status: 500 }
    );
  }
}

// Meta (Facebook) Ads API
async function updateMetaBudget(
  campaignId: string | undefined,
  newBudget: number
): Promise<{ success: boolean; error?: string }> {
  const accessToken = process.env.META_ACCESS_TOKEN;
  
  if (!accessToken) {
    return { success: false, error: "Meta APIの認証情報が設定されていません。.envにMETA_ACCESS_TOKENを追加してください。" };
  }

  if (!campaignId) {
    return { success: false, error: "キャンペーンIDが取得できません" };
  }

  try {
    // Meta Marketing API - キャンペーンの日予算を更新
    // 予算はセント単位（100倍）で送信
    const budgetInCents = newBudget * 100;
    
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${campaignId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          daily_budget: budgetInCents,
          access_token: accessToken,
        }),
      }
    );

    const data = await response.json();

    if (data.success || data.id) {
      return { success: true };
    } else {
      return { success: false, error: data.error?.message || "Meta APIエラー" };
    }
  } catch (error) {
    console.error("Meta API error:", error);
    return { success: false, error: "Meta APIへの接続に失敗しました" };
  }
}

// TikTok Ads API
async function updateTikTokBudget(
  campaignId: string | undefined,
  newBudget: number
): Promise<{ success: boolean; error?: string }> {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  const advertiserId = process.env.TIKTOK_ADVERTISER_ID;
  
  if (!accessToken || !advertiserId) {
    return { success: false, error: "TikTok APIの認証情報が設定されていません。.envにTIKTOK_ACCESS_TOKENとTIKTOK_ADVERTISER_IDを追加してください。" };
  }

  if (!campaignId) {
    return { success: false, error: "キャンペーンIDが取得できません" };
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
          budget: newBudget,
        }),
      }
    );

    const data = await response.json();

    if (data.code === 0) {
      return { success: true };
    } else {
      return { success: false, error: data.message || "TikTok APIエラー" };
    }
  } catch (error) {
    console.error("TikTok API error:", error);
    return { success: false, error: "TikTok APIへの接続に失敗しました" };
  }
}

// Pangle Ads API (TikTok for Business経由)
async function updatePangleBudget(
  campaignId: string | undefined,
  newBudget: number
): Promise<{ success: boolean; error?: string }> {
  // PangleはTikTok for Businessと同じAPIを使用
  const accessToken = process.env.PANGLE_ACCESS_TOKEN || process.env.TIKTOK_ACCESS_TOKEN;
  const advertiserId = process.env.PANGLE_ADVERTISER_ID || process.env.TIKTOK_ADVERTISER_ID;
  
  if (!accessToken || !advertiserId) {
    return { success: false, error: "Pangle APIの認証情報が設定されていません。.envにPANGLE_ACCESS_TOKENとPANGLE_ADVERTISER_IDを追加してください。" };
  }

  if (!campaignId) {
    return { success: false, error: "キャンペーンIDが取得できません" };
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
          budget: newBudget,
        }),
      }
    );

    const data = await response.json();

    if (data.code === 0) {
      return { success: true };
    } else {
      return { success: false, error: data.message || "Pangle APIエラー" };
    }
  } catch (error) {
    console.error("Pangle API error:", error);
    return { success: false, error: "Pangle APIへの接続に失敗しました" };
  }
}

