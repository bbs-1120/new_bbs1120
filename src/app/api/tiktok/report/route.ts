/**
 * TikTok 広告レポート取得API
 * GASの機能をNext.jsに統合
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTikTokAdsReport, getCampaignDetails, TikTokAdData } from "@/lib/tiktok";

interface TikTokReportRequest {
  advertiserId?: string;
  date?: string; // YYYY-MM-DD形式、省略時は当日
  type?: "today" | "yesterday";
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "認証が必要です" }, { status: 401 });
    }

    const body: TikTokReportRequest = await request.json();
    
    // 日付の決定
    let targetDate: string;
    if (body.date) {
      targetDate = body.date;
    } else if (body.type === "yesterday") {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      targetDate = yesterday.toISOString().split("T")[0];
    } else {
      // デフォルトは当日
      targetDate = new Date().toISOString().split("T")[0];
    }

    // アクセストークン取得
    const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: "TikTok APIの認証情報が設定されていません" },
        { status: 500 }
      );
    }

    // 広告主ID
    let advertiserIds: string[] = [];
    if (body.advertiserId) {
      advertiserIds = [body.advertiserId];
    } else {
      const advertiserIdsStr = process.env.TIKTOK_ADVERTISER_IDS || "";
      advertiserIds = advertiserIdsStr.split(",").filter(Boolean);
    }

    if (advertiserIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "広告主IDが設定されていません" },
        { status: 400 }
      );
    }

    console.log(`[TikTok Report API] Getting data for ${advertiserIds.length} advertisers on ${targetDate}`);

    // 全広告主のデータを取得
    const allAdsData: Array<TikTokAdData & { advertiserId: string }> = [];
    const errors: Array<{ advertiserId: string; error: string }> = [];

    for (const advertiserId of advertiserIds) {
      try {
        const adsData = await getTikTokAdsReport(
          { accessToken, advertiserId },
          targetDate
        );

        for (const ad of adsData) {
          allAdsData.push({ ...ad, advertiserId });
        }

        console.log(`[TikTok Report API] ${advertiserId}: ${adsData.length} records`);
      } catch (error) {
        console.error(`[TikTok Report API] Error for ${advertiserId}:`, error);
        errors.push({
          advertiserId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }

      // APIレート制限対策
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // キャンペーン詳細を取得
    const uniqueCampaignIds = [...new Set(allAdsData.map(ad => ad.campaignId).filter(id => id))];
    
    // 広告主ごとにキャンペーン詳細を取得
    const campaignDetailsMap: Record<string, { operationStatus: string; secondaryStatus: string; dailyBudget: number | null }> = {};
    
    for (const advertiserId of advertiserIds) {
      const campaignIdsForAdvertiser = [...new Set(
        allAdsData
          .filter(ad => ad.advertiserId === advertiserId)
          .map(ad => ad.campaignId)
          .filter(id => id)
      )];

      if (campaignIdsForAdvertiser.length > 0) {
        try {
          const details = await getCampaignDetails(
            { accessToken, advertiserId },
            campaignIdsForAdvertiser
          );

          for (const detail of details) {
            campaignDetailsMap[detail.campaignId] = {
              operationStatus: detail.operationStatus,
              secondaryStatus: detail.secondaryStatus,
              dailyBudget: detail.dailyBudget,
            };
          }
        } catch (error) {
          console.error(`[TikTok Report API] Campaign details error for ${advertiserId}:`, error);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 結果を整形
    const result = allAdsData.map(ad => ({
      ...ad,
      status: campaignDetailsMap[ad.campaignId]?.operationStatus || "UNKNOWN",
      secondaryStatus: campaignDetailsMap[ad.campaignId]?.secondaryStatus || "UNKNOWN",
      dailyBudget: campaignDetailsMap[ad.campaignId]?.dailyBudget || null,
    }));

    return NextResponse.json({
      success: true,
      date: targetDate,
      totalRecords: result.length,
      advertisersProcessed: advertiserIds.length,
      errors: errors.length > 0 ? errors : undefined,
      data: result,
    });
  } catch (error) {
    console.error("[TikTok Report API] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// GETでも当日データを取得可能
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "認証が必要です" }, { status: 401 });
    }

    // 当日の日付
    const today = new Date().toISOString().split("T")[0];

    // アクセストークン取得
    const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: "TikTok APIの認証情報が設定されていません" },
        { status: 500 }
      );
    }

    // 全広告主ID
    const advertiserIdsStr = process.env.TIKTOK_ADVERTISER_IDS || "";
    const advertiserIds = advertiserIdsStr.split(",").filter(Boolean);

    if (advertiserIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "広告主IDが設定されていません" },
        { status: 400 }
      );
    }

    // 最初の広告主のデータのみ取得（プレビュー用）
    const firstAdvertiserId = advertiserIds[0];
    const adsData = await getTikTokAdsReport(
      { accessToken, advertiserId: firstAdvertiserId },
      today
    );

    return NextResponse.json({
      success: true,
      date: today,
      advertiserId: firstAdvertiserId,
      totalAdvertisers: advertiserIds.length,
      preview: adsData.slice(0, 10), // 最初の10件のみ
      message: "全データを取得するにはPOSTリクエストを使用してください",
    });
  } catch (error) {
    console.error("[TikTok Report API] GET Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

