import { NextResponse } from "next/server";

interface StatusChangeRequest {
  cpnKey: string;
  cpnName: string;
  media: string;
  campaignId?: string;
  status: "active" | "paused"; // ON = active, OFF = paused
}

export async function POST(request: Request) {
  try {
    const body: StatusChangeRequest = await request.json();
    const { cpnName, media, campaignId, status } = body;

    console.log("Status change request:", { cpnName, media, campaignId, status });

    // 対象媒体かチェック
    if (!["Meta", "TikTok", "Pangle"].includes(media)) {
      return NextResponse.json(
        { success: false, error: "この媒体はステータス変更に対応していません" },
        { status: 400 }
      );
    }

    // 媒体別のAPI呼び出し
    let result;
    switch (media) {
      case "Meta":
        result = await updateMetaStatus(campaignId, status);
        break;
      case "TikTok":
        result = await updateTikTokStatus(campaignId, status);
        break;
      case "Pangle":
        result = await updatePangleStatus(campaignId, status);
        break;
      default:
        return NextResponse.json(
          { success: false, error: "未対応の媒体です" },
          { status: 400 }
        );
    }

    if (result.success) {
      const statusText = status === "active" ? "ON" : "OFF";
      return NextResponse.json({
        success: true,
        message: `${cpnName}を${statusText}にしました`,
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Status API error:", error);
    return NextResponse.json(
      { success: false, error: "ステータス変更に失敗しました" },
      { status: 500 }
    );
  }
}

// Meta (Facebook) Ads API - キャンペーンステータス変更
async function updateMetaStatus(
  campaignId: string | undefined,
  status: "active" | "paused"
): Promise<{ success: boolean; error?: string }> {
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
    return { success: false, error: "Meta APIの認証情報が設定されていません" };
  }

  if (!campaignId) {
    return { success: false, error: "キャンペーンIDが取得できません" };
  }

  // Meta APIのステータス値
  const metaStatus = status === "active" ? "ACTIVE" : "PAUSED";

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
            status: metaStatus,
            access_token: accessToken,
          }),
        }
      );

      const data = await response.json();

      if (data.success || data.id) {
        return { success: true };
      } else {
        lastError = data.error?.message || "Meta APIエラー";
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

// TikTok Ads API - キャンペーンステータス変更 + Smart Performance Campaign対応
async function updateTikTokStatus(
  campaignId: string | undefined,
  status: "active" | "paused"
): Promise<{ success: boolean; error?: string }> {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  
  if (!accessToken) {
    return { success: false, error: "TikTok APIの認証情報が設定されていません" };
  }

  if (!campaignId) {
    return { success: false, error: "キャンペーンIDが取得できません" };
  }

  // TikTok APIのステータス値: ENABLE = ON, DISABLE = OFF
  const tiktokStatus = status === "active" ? "ENABLE" : "DISABLE";

  // 広告主IDリストを取得
  const advertiserIdsStr = process.env.TIKTOK_ADVERTISER_IDS || "";
  const advertiserIds = advertiserIdsStr.split(",").filter(Boolean);

  if (advertiserIds.length === 0) {
    return { success: false, error: "広告主IDが設定されていません" };
  }

  let lastError = "広告主IDが見つかりませんでした";
  
  for (const advertiserId of advertiserIds) {
    // 1. まず通常のステータス更新APIを試す
    try {
      const response = await fetch(
        "https://business-api.tiktok.com/open_api/v1.3/campaign/status/update/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Access-Token": accessToken,
          },
          body: JSON.stringify({
            advertiser_id: advertiserId.trim(),
            campaign_ids: [campaignId],
            opt_status: tiktokStatus,
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
          const spcResult = await updateTikTokSpcStatus(accessToken, advertiserId.trim(), campaignId, tiktokStatus);
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

// TikTok Smart Performance Campaign ステータス変更
async function updateTikTokSpcStatus(
  accessToken: string,
  advertiserId: string,
  campaignId: string,
  optStatus: string
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
          operation_status: optStatus,
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
    console.error("TikTok SPC Status API error:", error);
    return { success: false, error: "SPC APIへの接続に失敗しました" };
  }
}

// Pangle Ads API - キャンペーンステータス変更 + Smart Performance Campaign対応
async function updatePangleStatus(
  campaignId: string | undefined,
  status: "active" | "paused"
): Promise<{ success: boolean; error?: string }> {
  const accessToken = process.env.PANGLE_ACCESS_TOKEN || process.env.TIKTOK_ACCESS_TOKEN;
  
  if (!accessToken) {
    return { success: false, error: "Pangle APIの認証情報が設定されていません" };
  }

  if (!campaignId) {
    return { success: false, error: "キャンペーンIDが取得できません" };
  }

  const pangleStatus = status === "active" ? "ENABLE" : "DISABLE";

  // 広告主IDリストを取得
  const advertiserIdsStr = process.env.PANGLE_ADVERTISER_IDS || process.env.TIKTOK_ADVERTISER_IDS || "";
  const advertiserIds = advertiserIdsStr.split(",").filter(Boolean);

  if (advertiserIds.length === 0) {
    return { success: false, error: "広告主IDが設定されていません" };
  }

  let lastError = "広告主IDが見つかりませんでした";
  
  for (const advertiserId of advertiserIds) {
    // 1. まず通常のステータス更新APIを試す
    try {
      const response = await fetch(
        "https://business-api.tiktok.com/open_api/v1.3/campaign/status/update/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Access-Token": accessToken,
          },
          body: JSON.stringify({
            advertiser_id: advertiserId.trim(),
            campaign_ids: [campaignId],
            opt_status: pangleStatus,
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
          const spcResult = await updateTikTokSpcStatus(accessToken, advertiserId.trim(), campaignId, pangleStatus);
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

