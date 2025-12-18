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

// Meta (Facebook) Ads API - 複数のビジネスマネージャー対応
async function updateMetaBudget(
  campaignId: string | undefined,
  newBudget: number
): Promise<{ success: boolean; error?: string }> {
  // 全てのビジネスマネージャーのトークンを取得
  const tokens = [
    process.env.META_ACCESS_TOKEN,
    process.env.META_TOKEN_BUSINESS01,
    process.env.META_TOKEN_BUSINESS03,
    process.env.META_TOKEN_BUSINESS08,
    process.env.META_TOKEN_BUSINESS11,
    process.env.META_TOKEN_BUSINESS13,
    process.env.META_TOKEN_BUSINESS14,
  ].filter(Boolean) as string[];
  
  if (tokens.length === 0) {
    return { success: false, error: "Meta APIの認証情報が設定されていません。.envにMETA_ACCESS_TOKENを追加してください。" };
  }

  if (!campaignId) {
    return { success: false, error: "キャンペーンIDが取得できません" };
  }

  // 予算は円単位で送信（日本のアカウントの場合）
  // ※通常は100倍（セント）だが、日本円アカウントは円のまま
  const budgetValue = newBudget;

  // 各トークンで試行
  let lastError = "";
  for (const accessToken of tokens) {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${campaignId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            daily_budget: budgetValue,
            access_token: accessToken,
          }),
        }
      );

      const data = await response.json();

      if (data.success || data.id) {
        return { success: true };
      } else {
        lastError = data.error?.message || "Meta APIエラー";
        // 権限エラーの場合は次のトークンを試す
        if (data.error?.code === 190 || data.error?.code === 200) {
          continue;
        }
      }
    } catch (error) {
      console.error("Meta API error:", error);
      lastError = "Meta APIへの接続に失敗しました";
    }
  }

  return { success: false, error: lastError };
}

// TikTok Ads API - 複数の広告主ID対応 + Smart Performance Campaign対応
async function updateTikTokBudget(
  campaignId: string | undefined,
  newBudget: number
): Promise<{ success: boolean; error?: string }> {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  
  if (!accessToken) {
    return { success: false, error: "TikTok APIの認証情報が設定されていません。.envにTIKTOK_ACCESS_TOKENを追加してください。" };
  }

  if (!campaignId) {
    return { success: false, error: "キャンペーンIDが取得できません" };
  }

  // 広告主IDリストを取得
  const advertiserIdsStr = process.env.TIKTOK_ADVERTISER_IDS || "";
  const advertiserIds = advertiserIdsStr.split(",").filter(Boolean);

  if (advertiserIds.length === 0) {
    return { success: false, error: "広告主IDが設定されていません" };
  }

  let lastError = "広告主IDが見つかりませんでした";
  
  for (const advertiserId of advertiserIds) {
    // 1. まず通常のキャンペーン更新APIを試す
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
            advertiser_id: advertiserId.trim(),
            campaign_id: campaignId,
            budget: newBudget,
          }),
        }
      );

      const data = await response.json();

      if (data.code === 0) {
        return { success: true };
      } else {
        lastError = data.message || "TikTok APIエラー";
        
        // Smart Performance Campaignエラーの場合はSPC APIを試す
        if (data.message?.includes("Smart Performance Campaign") || data.message?.includes("spc")) {
          const spcResult = await updateTikTokSpcBudget(accessToken, advertiserId.trim(), campaignId, newBudget);
          if (spcResult.success) {
            return { success: true };
          }
          lastError = spcResult.error || lastError;
        }
        
        // 権限エラーやキャンペーンが見つからない場合は次の広告主IDを試す
        if (data.code === 40002 || data.code === 40001 || data.code === 40100) {
          continue;
        }
      }
    } catch (error) {
      console.error("TikTok API error:", error);
      lastError = "TikTok APIへの接続に失敗しました";
    }
  }

  return { success: false, error: lastError };
}

// TikTok Smart Performance Campaign 専用API
async function updateTikTokSpcBudget(
  accessToken: string,
  advertiserId: string,
  campaignId: string,
  newBudget: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      "https://business-api.tiktok.com/open_api/v1.3/campaign/spc/update/",
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
      return { success: false, error: data.message || "SPC APIエラー" };
    }
  } catch (error) {
    console.error("TikTok SPC API error:", error);
    return { success: false, error: "SPC APIへの接続に失敗しました" };
  }
}

// Pangle Ads API (TikTok for Business経由) - 複数の広告主ID対応 + Smart Performance Campaign対応
async function updatePangleBudget(
  campaignId: string | undefined,
  newBudget: number
): Promise<{ success: boolean; error?: string }> {
  // PangleはTikTok for Businessと同じAPIを使用
  const accessToken = process.env.PANGLE_ACCESS_TOKEN || process.env.TIKTOK_ACCESS_TOKEN;
  
  if (!accessToken) {
    return { success: false, error: "Pangle APIの認証情報が設定されていません。" };
  }

  if (!campaignId) {
    return { success: false, error: "キャンペーンIDが取得できません" };
  }

  // 広告主IDリストを取得
  const advertiserIdsStr = process.env.PANGLE_ADVERTISER_IDS || process.env.TIKTOK_ADVERTISER_IDS || "";
  const advertiserIds = advertiserIdsStr.split(",").filter(Boolean);

  if (advertiserIds.length === 0) {
    return { success: false, error: "広告主IDが設定されていません" };
  }

  let lastError = "広告主IDが見つかりませんでした";
  
  for (const advertiserId of advertiserIds) {
    // 1. まず通常のキャンペーン更新APIを試す
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
            advertiser_id: advertiserId.trim(),
            campaign_id: campaignId,
            budget: newBudget,
          }),
        }
      );

      const data = await response.json();

      if (data.code === 0) {
        return { success: true };
      } else {
        lastError = data.message || "Pangle APIエラー";
        
        // Smart Performance Campaignエラーの場合はSPC APIを試す
        if (data.message?.includes("Smart Performance Campaign") || data.message?.includes("spc")) {
          const spcResult = await updateTikTokSpcBudget(accessToken, advertiserId.trim(), campaignId, newBudget);
          if (spcResult.success) {
            return { success: true };
          }
          lastError = spcResult.error || lastError;
        }
        
        if (data.code === 40002 || data.code === 40001 || data.code === 40100) {
          continue;
        }
      }
    } catch (error) {
      console.error("Pangle API error:", error);
      lastError = "Pangle APIへの接続に失敗しました";
    }
  }

  return { success: false, error: lastError };
}

