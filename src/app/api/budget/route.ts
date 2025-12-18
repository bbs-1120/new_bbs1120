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

// TikTok Ads API - 複数の広告主ID対応
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

  // 主要な広告主IDリスト（CPNから自動で探索）
  const advertiserIds = [
    "7433722339872899088", "7431834844448997393", "7431483320573247504",
    "7424330265591627792", "7426279250719948817", "7426279558556663825",
    "7424321809509761040", "7424324316726181904", "7424324893380100113",
    "7424093414238535681", "7415898963447955472", "7413556028375236625",
    "7412906864523935760", "7412906577210097680", "7412906240952565777",
    "7312016244365099009", "7310106935712661506", "7288971698601279490",
  ];

  let lastError = "広告主IDが見つかりませんでした";
  
  for (const advertiserId of advertiserIds) {
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
        lastError = data.message || "TikTok APIエラー";
        // 権限エラーやキャンペーンが見つからない場合は次の広告主IDを試す
        if (data.code === 40002 || data.code === 40001) {
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

// Pangle Ads API (TikTok for Business経由) - 複数の広告主ID対応
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

  // Pangle用広告主IDリスト
  const advertiserIds = [
    "7556179607188307969", "7563224138828382216", "7563230653786046480",
    "7563231137359773697", "7563230674052939794", "7568789332065157128",
    "7543850664410103826", "7543851268230545409", "7543851608480923664",
    "7543982157253853192", "7543982888367456257", "7543982527271288850",
    "7496794352266788881", "7496810375237746704", "7496810726489669633",
    "7496811321158402049", "7496816002530017296", "7496819982039466000",
  ];

  let lastError = "広告主IDが見つかりませんでした";
  
  for (const advertiserId of advertiserIds) {
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
        lastError = data.message || "Pangle APIエラー";
        if (data.code === 40002 || data.code === 40001) {
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

