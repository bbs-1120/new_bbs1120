import { NextResponse } from "next/server";
import { getAdvertiserIdByAccountName } from "@/lib/advertiserMapping";
import { sendErrorNotification } from "@/lib/chatwork";

interface BudgetChangeRequest {
  cpnKey: string;
  cpnName: string;
  media: string;
  campaignId?: string;
  accountName?: string;
  newBudget: number;
}

export async function POST(request: Request) {
  try {
    const body: BudgetChangeRequest = await request.json();
    const { cpnName, media, campaignId, accountName, newBudget } = body;

    console.log("Budget change request:", { cpnName, media, campaignId, accountName, newBudget });

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

    // 広告アカウント名から広告主IDを特定（TikTok/Pangle用）
    let advertiserId: string | null = null;
    if (accountName && (media === "TikTok" || media === "Pangle")) {
      advertiserId = getAdvertiserIdByAccountName(accountName);
      console.log(`Account name mapping: ${accountName} -> ${advertiserId}`);
    }

    // 媒体別のAPI呼び出し
    let result;
    switch (media) {
      case "Meta":
        result = await updateMetaBudget(campaignId, newBudget);
        break;
      case "TikTok":
        result = await updateTikTokBudget(campaignId, newBudget, advertiserId);
        break;
      case "Pangle":
        result = await updatePangleBudget(campaignId, newBudget, advertiserId);
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
      // エラー通知を送信
      await sendErrorNotification("budget_change", result.error || "予算変更に失敗", {
        cpnName,
        media,
        campaignId,
        newBudget,
      });
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Budget API error:", error);
    // エラー通知を送信
    await sendErrorNotification("budget_change", "予算変更中にエラーが発生", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
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
        `https://graph.facebook.com/v22.0/${campaignId}`,
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

// TikTok Upgraded Smart Plus / SPC 対応判定
function isSmartPlusCampaignError(message: string | undefined): boolean {
  if (!message) return false;
  const keywords = [
    "Smart Performance Campaign",
    "Upgraded Smart Plus",
    "smart_plus",
    "SPC",
    "spc",
    "This API does not support",
    "not support Upgraded",
  ];
  return keywords.some(keyword => message.toLowerCase().includes(keyword.toLowerCase()));
}

// TikTok Ads API - 複数トークン対応 + 広告アカウント名から広告主ID特定 + Smart Performance Campaign対応
async function updateTikTokBudget(
  campaignId: string | undefined,
  newBudget: number,
  knownAdvertiserId: string | null = null
): Promise<{ success: boolean; error?: string }> {
  // 複数のアクセストークンを取得（新しいビジネスセンター対応）
  const accessTokens = [
    process.env.TIKTOK_ACCESS_TOKEN,
    process.env.TIKTOK_ACCESS_TOKEN_2,
    process.env.TIKTOK_ACCESS_TOKEN_3,
  ].filter(Boolean) as string[];
  
  console.log("[TikTok Budget] Starting update...");
  console.log("[TikTok Budget] AccessTokens count:", accessTokens.length);
  console.log("[TikTok Budget] CampaignId:", campaignId);
  console.log("[TikTok Budget] Known Advertiser ID:", knownAdvertiserId);
  
  if (accessTokens.length === 0) {
    return { success: false, error: "TikTok APIの認証情報が設定されていません。.envにTIKTOK_ACCESS_TOKENを追加してください。" };
  }

  if (!campaignId) {
    return { success: false, error: "キャンペーンIDが取得できません" };
  }

  // 広告主IDリストを準備（knownAdvertiserIdがあれば先頭に）
  let advertiserIds: string[] = [];
  
  if (knownAdvertiserId) {
    // 広告アカウント名から特定した広告主IDを最優先で使用
    advertiserIds = [knownAdvertiserId];
    console.log("[TikTok Budget] Using known advertiser ID from account name mapping");
  } else {
    // フォールバック: 全広告主IDを試す（最大10個）
    const advertiserIdsStr = process.env.TIKTOK_ADVERTISER_IDS || "";
    advertiserIds = advertiserIdsStr.split(",").filter(Boolean);
    console.log("[TikTok Budget] Falling back to advertiser ID list, trying first 10");
  }

  if (advertiserIds.length === 0) {
    return { success: false, error: "広告主IDが設定されていません" };
  }

  let lastError = "広告主IDが見つかりませんでした";
  
  // 各トークンで試行（複数ビジネスセンター対応）
  for (let t = 0; t < accessTokens.length; t++) {
    const accessToken = accessTokens[t];
    console.log(`[TikTok Budget] [Token ${t + 1}/${accessTokens.length}] Trying...`);
    
    for (let i = 0; i < advertiserIds.length; i++) {
      const advertiserId = advertiserIds[i].trim();
      console.log(`[TikTok Budget] [Advertiser ${i + 1}/${advertiserIds.length}] ${advertiserId}`);
      
      // === 方法1: campaign/update/ API（通常キャンペーン） ===
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
              budget_mode: "BUDGET_MODE_DAY",
            }),
          }
        );

        const data = await response.json();
        console.log(`[TikTok Budget] campaign/update response - code: ${data.code}, message: ${data.message}`);

        if (data.code === 0) {
          console.log("[TikTok Budget] Success with campaign/update!");
          return { success: true };
        } else {
          lastError = data.message || "TikTok APIエラー";
          
          // Upgraded Smart Plus / SPC エラーの場合は複数の方法を試す
          if (isSmartPlusCampaignError(data.message)) {
            console.log("[TikTok Budget] Upgraded Smart Plus detected, trying alternative APIs...");
            
            // === 方法2: campaign/spc/update/ API（SPC専用） ===
            const spcResult = await updateTikTokSpcBudget(accessToken, advertiserId, campaignId, newBudget);
            if (spcResult.success) {
              console.log("[TikTok Budget] Success with SPC API!");
              return { success: true };
            }
            console.log(`[TikTok Budget] SPC API failed: ${spcResult.error}`);
            
            // === 方法3: campaign/budget/update/ API（予算専用、もしあれば） ===
            // TikTokにはこのエンドポイントは存在しないが、将来のために記載
            
            lastError = `Upgraded Smart Plus: ${spcResult.error || data.message}`;
          }
          
          // 権限エラーやキャンペーンが見つからない場合は次を試す
          if (data.code === 40002 || data.code === 40001 || data.code === 40100 || data.code === 40007) {
            continue;
          }
        }
      } catch (error) {
        console.error("[TikTok Budget] API error:", error);
        lastError = "TikTok APIへの接続に失敗しました";
      }
    }
  }

  console.log(`[TikTok Budget] All tries completed. Last error: ${lastError}`);
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
    console.log(`SPC API call - advertiser: ${advertiserId}, campaign: ${campaignId}, budget: ${newBudget}`);
    
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
          budget_mode: "BUDGET_MODE_DAY",
          operation_status: "ENABLE",
        }),
      }
    );

    const data = await response.json();
    console.log(`SPC API response - code: ${data.code}, message: ${data.message}`);

    if (data.code === 0) {
      console.log("SPC API Success!");
      return { success: true };
    } else {
      // 権限エラーの詳細を確認
      console.log(`SPC API Failed - full response:`, JSON.stringify(data));
      return { success: false, error: data.message || "SPC APIエラー" };
    }
  } catch (error) {
    console.error("TikTok SPC API error:", error);
    return { success: false, error: "SPC APIへの接続に失敗しました" };
  }
}

// Pangle Ads API (TikTok for Business経由) - 広告アカウント名から広告主ID特定
async function updatePangleBudget(
  campaignId: string | undefined,
  newBudget: number,
  knownAdvertiserId: string | null = null
): Promise<{ success: boolean; error?: string }> {
  // PangleはTikTok for Businessと同じAPIを使用
  const accessToken = process.env.PANGLE_ACCESS_TOKEN || process.env.TIKTOK_ACCESS_TOKEN;
  
  if (!accessToken) {
    return { success: false, error: "Pangle APIの認証情報が設定されていません。" };
  }

  if (!campaignId) {
    return { success: false, error: "キャンペーンIDが取得できません" };
  }

  // 広告主IDリストを準備（knownAdvertiserIdがあれば先頭に）
  let advertiserIds: string[] = [];
  
  if (knownAdvertiserId) {
    advertiserIds = [knownAdvertiserId];
    console.log("Using known advertiser ID from account name mapping");
  } else {
    const advertiserIdsStr = process.env.PANGLE_ADVERTISER_IDS || process.env.TIKTOK_ADVERTISER_IDS || "";
    advertiserIds = advertiserIdsStr.split(",").filter(Boolean);
  }

  if (advertiserIds.length === 0) {
    return { success: false, error: "広告主IDが設定されていません" };
  }

  let lastError = "広告主IDが見つかりませんでした";
  
  for (let i = 0; i < advertiserIds.length; i++) {
    const advertiserId = advertiserIds[i].trim();
    
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
            budget_mode: "BUDGET_MODE_DAY",
            operation_status: "ENABLE",
          }),
        }
      );

      const data = await response.json();

      if (data.code === 0) {
        return { success: true };
      } else {
        lastError = data.message || "Pangle APIエラー";
        
        // Smart Performance Campaign または Upgraded Smart Plus エラーの場合はSPC APIを試す
        if (data.message?.includes("Smart Performance Campaign") || 
            data.message?.includes("spc") ||
            data.message?.includes("Upgraded Smart Plus") ||
            data.message?.includes("Smart Plus")) {
          console.log("Pangle: Trying SPC API for Smart Plus campaign...");
          const spcResult = await updateTikTokSpcBudget(accessToken, advertiserId, campaignId, newBudget);
          if (spcResult.success) {
            return { success: true };
          }
          lastError = spcResult.error || lastError;
          continue;
        }
        
        if (data.code === 40002 || data.code === 40001 || data.code === 40100 || data.code === 40007) {
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

