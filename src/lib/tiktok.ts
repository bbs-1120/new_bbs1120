/**
 * TikTok Ads API ライブラリ
 * GASの機能をNext.jsに統合
 */

export interface TikTokAdData {
  statDatetime: Date;
  adId: string;
  adName: string;
  adGroupId: string;
  adGroupName: string;
  campaignId: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  targetBid: number | null;
}

export interface TikTokCampaignDetail {
  campaignId: string;
  operationStatus: string;
  secondaryStatus: string;
  dailyBudget: number | null;
}

export interface TikTokAdGroupDetail {
  adGroupId: string;
  bidPrice: number | null;
  conversionBidPrice: number | null;
}

interface TikTokApiOptions {
  accessToken: string;
  advertiserId: string;
}

const API_BASE = "https://business-api.tiktok.com/open_api/v1.3";

/**
 * TikTok APIを呼び出す（リトライ付き）
 */
async function callTikTokApi<T>(
  url: string,
  method: "GET" | "POST",
  accessToken: string,
  body?: Record<string, unknown>,
  retryCount = 0
): Promise<T> {
  const maxRetries = 3;
  const initialDelay = 1000;

  const options: RequestInit = {
    method,
    headers: {
      "Access-Token": accessToken,
      "Content-Type": "application/json",
    },
  };

  if (body && method === "POST") {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();

    // レート制限エラーの場合はリトライ
    if (data.code === 40100 && retryCount < maxRetries) {
      const delay = initialDelay * Math.pow(2, retryCount);
      console.log(`[TikTok API] Rate limited - retrying in ${delay}ms (${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callTikTokApi<T>(url, method, accessToken, body, retryCount + 1);
    }

    return data;
  } catch (error) {
    if (retryCount < maxRetries) {
      const delay = initialDelay * Math.pow(2, retryCount);
      console.log(`[TikTok API] Error - retrying in ${delay}ms: ${error}`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callTikTokApi<T>(url, method, accessToken, body, retryCount + 1);
    }
    throw error;
  }
}

/**
 * TikTok広告レポートを取得
 */
export async function getTikTokAdsReport(
  options: TikTokApiOptions,
  targetDate: string // YYYY-MM-DD形式
): Promise<TikTokAdData[]> {
  const { accessToken, advertiserId } = options;

  console.log(`[TikTok] Getting ads report for ${advertiserId} on ${targetDate}`);

  // 1. パフォーマンスレポート取得
  const reportParams = new URLSearchParams({
    advertiser_id: advertiserId,
    report_type: "BASIC",
    data_level: "AUCTION_AD",
    start_date: targetDate,
    end_date: targetDate,
    dimensions: JSON.stringify(["stat_time_day", "ad_id"]),
    metrics: JSON.stringify(["spend", "impressions", "clicks", "conversion"]),
    page_size: "1000",
  });

  const allReportData: Array<{
    dimensions: { stat_time_day: string; ad_id: string };
    metrics: { spend: string; impressions: string; clicks: string; conversion: string };
  }> = [];

  let currentPage = 1;
  let totalPages = 1;

  while (currentPage <= totalPages) {
    const url = `${API_BASE}/report/integrated/get/?${reportParams.toString()}&page=${currentPage}`;
    
    const data = await callTikTokApi<{
      code: number;
      message: string;
      data: {
        list: Array<{
          dimensions: { stat_time_day: string; ad_id: string };
          metrics: { spend: string; impressions: string; clicks: string; conversion: string };
        }>;
        page_info: { total_page: number };
      };
    }>(url, "GET", accessToken);

    if (data.code !== 0) {
      console.error(`[TikTok] Report API error: ${data.message}`);
      throw new Error(`TikTok API Error: ${data.message}`);
    }

    if (data.data?.list) {
      allReportData.push(...data.data.list);
    }

    if (currentPage === 1 && data.data?.page_info?.total_page) {
      totalPages = data.data.page_info.total_page;
    }

    currentPage++;
  }

  console.log(`[TikTok] Got ${allReportData.length} report records`);

  if (allReportData.length === 0) {
    return [];
  }

  // 2. 広告IDを収集してバッチで広告詳細情報を取得
  const adIds = [...new Set(allReportData.map(item => item.dimensions?.ad_id).filter(Boolean))];
  const adDetailsMap = await getAdDetailsMap(accessToken, advertiserId, adIds);

  // 3. 広告詳細から adgroup_id を収集
  const adGroupIds = [...new Set(Object.values(adDetailsMap).map(ad => ad.adgroup_id).filter(Boolean))];

  // 4. 広告セット詳細（目標単価など）を取得
  const adGroupDetailsMap = await getAdGroupDetailsMap(accessToken, advertiserId, adGroupIds);

  // 5. 結果を整形
  const results: TikTokAdData[] = [];

  for (const item of allReportData) {
    if (!item.dimensions || !item.metrics) continue;

    const impressions = parseFloat(item.metrics.impressions) || 0;
    if (impressions < 1) continue; // imp >= 1 のみ

    const adId = item.dimensions.ad_id;
    const adDetail = adDetailsMap[adId] || {};
    const adGroupId = adDetail.adgroup_id;
    const adGroupDetail = adGroupDetailsMap[adGroupId] || {};

    // 目標単価(cpa_bid)を優先し、なければ入札額(bid)を採用
    const targetBid = adGroupDetail.conversion_bid_price || adGroupDetail.bid_price || null;

    results.push({
      statDatetime: new Date(item.dimensions.stat_time_day),
      adId: String(adId),
      adName: adDetail.ad_name || `Ad_${adId}`,
      adGroupId: String(adDetail.adgroup_id || ""),
      adGroupName: adDetail.adgroup_name || "",
      campaignId: String(adDetail.campaign_id || ""),
      campaignName: adDetail.campaign_name || "",
      spend: parseFloat(item.metrics.spend) || 0,
      impressions,
      clicks: parseFloat(item.metrics.clicks) || 0,
      conversions: parseFloat(item.metrics.conversion) || 0,
      targetBid,
    });
  }

  console.log(`[TikTok] Processed ${results.length} ad records`);
  return results.sort((a, b) => a.statDatetime.getTime() - b.statDatetime.getTime());
}

/**
 * 広告詳細をマップ形式で取得（バッチ処理で効率化）
 */
async function getAdDetailsMap(
  accessToken: string,
  advertiserId: string,
  adIds: string[]
): Promise<Record<string, {
  ad_name: string;
  adgroup_id: string;
  adgroup_name: string;
  campaign_id: string;
  campaign_name: string;
}>> {
  if (adIds.length === 0) return {};

  const batchSize = 50;
  const detailsMap: Record<string, {
    ad_name: string;
    adgroup_id: string;
    adgroup_name: string;
    campaign_id: string;
    campaign_name: string;
  }> = {};

  for (let i = 0; i < adIds.length; i += batchSize) {
    const batch = adIds.slice(i, i + batchSize);

    const params = new URLSearchParams({
      advertiser_id: advertiserId,
      filtering: JSON.stringify({ ad_ids: batch }),
      fields: JSON.stringify(["ad_id", "ad_name", "adgroup_id", "adgroup_name", "campaign_id", "campaign_name"]),
      page_size: "1000",
    });

    const url = `${API_BASE}/ad/get/?${params.toString()}`;

    try {
      const data = await callTikTokApi<{
        code: number;
        message: string;
        data: {
          list: Array<{
            ad_id: string;
            ad_name: string;
            adgroup_id: string;
            adgroup_name: string;
            campaign_id: string;
            campaign_name: string;
          }>;
        };
      }>(url, "GET", accessToken);

      if (data.code === 0 && data.data?.list) {
        for (const ad of data.data.list) {
          detailsMap[ad.ad_id] = {
            ad_name: ad.ad_name,
            adgroup_id: ad.adgroup_id,
            adgroup_name: ad.adgroup_name || `AdGroup_${ad.adgroup_id}`,
            campaign_id: ad.campaign_id,
            campaign_name: ad.campaign_name || `Campaign_${ad.campaign_id}`,
          };
        }
      }
    } catch (e) {
      console.error(`[TikTok] Ad details error:`, e);
      // エラー時は空の情報をマップに詰める
      for (const adId of batch) {
        detailsMap[adId] = {
          ad_name: `Ad_${adId}`,
          adgroup_id: "",
          adgroup_name: "",
          campaign_id: "",
          campaign_name: "",
        };
      }
    }

    if (i + batchSize < adIds.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return detailsMap;
}

/**
 * 広告セット詳細をマップ形式で取得
 */
async function getAdGroupDetailsMap(
  accessToken: string,
  advertiserId: string,
  adGroupIds: string[]
): Promise<Record<string, { bid_price: number | null; conversion_bid_price: number | null }>> {
  if (adGroupIds.length === 0) return {};

  const batchSize = 50;
  const detailsMap: Record<string, { bid_price: number | null; conversion_bid_price: number | null }> = {};

  for (let i = 0; i < adGroupIds.length; i += batchSize) {
    const batch = adGroupIds.slice(i, i + batchSize);

    const params = new URLSearchParams({
      advertiser_id: advertiserId,
      filtering: JSON.stringify({ adgroup_ids: batch }),
      fields: JSON.stringify(["adgroup_id", "bid_price", "conversion_bid_price"]),
      page_size: "1000",
    });

    const url = `${API_BASE}/adgroup/get/?${params.toString()}`;

    try {
      const data = await callTikTokApi<{
        code: number;
        message: string;
        data: {
          list: Array<{
            adgroup_id: string;
            bid_price: number;
            conversion_bid_price: number;
          }>;
        };
      }>(url, "GET", accessToken);

      if (data.code === 0 && data.data?.list) {
        for (const adGroup of data.data.list) {
          detailsMap[adGroup.adgroup_id] = {
            bid_price: adGroup.bid_price || null,
            conversion_bid_price: adGroup.conversion_bid_price || null,
          };
        }
      }
    } catch (e) {
      console.error(`[TikTok] AdGroup details error:`, e);
      for (const adGroupId of batch) {
        detailsMap[adGroupId] = { bid_price: null, conversion_bid_price: null };
      }
    }

    if (i + batchSize < adGroupIds.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return detailsMap;
}

/**
 * キャンペーン詳細を取得
 */
export async function getCampaignDetails(
  options: TikTokApiOptions,
  campaignIds: string[]
): Promise<TikTokCampaignDetail[]> {
  const { accessToken, advertiserId } = options;

  if (campaignIds.length === 0) return [];

  // 無効なIDを除外
  const validCampaignIds = campaignIds.filter(
    id => id && id !== "UNKNOWN" && id !== "" && !isNaN(Number(id))
  );
  if (validCampaignIds.length === 0) return [];

  const results: TikTokCampaignDetail[] = [];
  const batchSize = 30;

  for (let i = 0; i < validCampaignIds.length; i += batchSize) {
    const batch = validCampaignIds.slice(i, i + batchSize);

    const params = new URLSearchParams({
      advertiser_id: advertiserId,
      page_size: "1000",
      filtering: JSON.stringify({ primary_status: "STATUS_ALL", campaign_ids: batch }),
      fields: JSON.stringify(["campaign_id", "operation_status", "secondary_status", "budget"]),
    });

    let currentPage = 1;
    let totalPages = 1;

    while (currentPage <= totalPages) {
      const url = `${API_BASE}/campaign/get/?${params.toString()}&page=${currentPage}`;

      const data = await callTikTokApi<{
        code: number;
        message: string;
        data: {
          list: Array<{
            campaign_id: string;
            operation_status: string;
            secondary_status: string;
            budget: number;
          }>;
          page_info: { total_page: number };
        };
      }>(url, "GET", accessToken);

      if (data.code !== 0) {
        console.error(`[TikTok] Campaign details API error: ${data.message}`);
        break;
      }

      if (data.data?.list) {
        for (const campaign of data.data.list) {
          results.push({
            campaignId: campaign.campaign_id,
            operationStatus: campaign.operation_status,
            secondaryStatus: campaign.secondary_status,
            dailyBudget: campaign.budget || null,
          });
        }
      }

      if (currentPage === 1 && data.data?.page_info?.total_page) {
        totalPages = data.data.page_info.total_page;
      }
      currentPage++;

      if (currentPage <= totalPages) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    if (i + batchSize < validCampaignIds.length) {
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  }

  return results;
}

/**
 * キャンペーンステータスを変更（Upgraded Smart Plus対応）
 */
export async function updateCampaignStatus(
  options: TikTokApiOptions,
  campaignId: string,
  status: "ENABLE" | "DISABLE"
): Promise<{ success: boolean; error?: string; usedSpcApi?: boolean }> {
  const { accessToken, advertiserId } = options;

  console.log(`[TikTok] Updating campaign ${campaignId} status to ${status}`);

  // 方法1: campaign/status/update/ API
  try {
    const response = await fetch(`${API_BASE}/campaign/status/update/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Access-Token": accessToken,
      },
      body: JSON.stringify({
        advertiser_id: advertiserId,
        campaign_ids: [campaignId],
        operation_status: status,
      }),
    });

    const data = await response.json();

    if (data.code === 0) {
      return { success: true };
    }

    // Upgraded Smart Plus エラーの場合
    if (isSmartPlusCampaignError(data.message)) {
      console.log(`[TikTok] Upgraded Smart Plus detected, trying SPC API...`);

      // 方法2: campaign/spc/update/ API
      const spcResponse = await fetch(`${API_BASE}/campaign/spc/update/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Access-Token": accessToken,
        },
        body: JSON.stringify({
          advertiser_id: advertiserId,
          campaign_id: campaignId,
          operation_status: status,
        }),
      });

      const spcData = await spcResponse.json();

      if (spcData.code === 0) {
        return { success: true, usedSpcApi: true };
      }

      // 方法3: campaign/update/ API
      const updateResponse = await fetch(`${API_BASE}/campaign/update/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Access-Token": accessToken,
        },
        body: JSON.stringify({
          advertiser_id: advertiserId,
          campaign_id: campaignId,
          operation_status: status,
        }),
      });

      const updateData = await updateResponse.json();

      if (updateData.code === 0) {
        return { success: true };
      }

      return { success: false, error: `Upgraded Smart Plus: ${spcData.message || updateData.message}` };
    }

    return { success: false, error: data.message || "Unknown error" };
  } catch (error) {
    console.error(`[TikTok] Status update error:`, error);
    return { success: false, error: "API connection failed" };
  }
}

/**
 * Upgraded Smart Plus / SPC エラー判定
 */
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

/**
 * 広告主一覧を取得
 */
export async function getAdvertiserList(
  accessToken: string,
  appId: string
): Promise<Array<{ advertiserId: string; advertiserName: string }>> {
  const params = new URLSearchParams({
    app_id: appId,
    secret: process.env.TIKTOK_SECRET || "",
  });

  const url = `${API_BASE}/oauth2/advertiser/get/?${params.toString()}`;

  try {
    const data = await callTikTokApi<{
      code: number;
      message: string;
      data: {
        list: Array<{
          advertiser_id: string;
          advertiser_name: string;
        }>;
      };
    }>(url, "GET", accessToken);

    if (data.code === 0 && data.data?.list) {
      return data.data.list.map(item => ({
        advertiserId: item.advertiser_id,
        advertiserName: item.advertiser_name,
      }));
    }
  } catch (e) {
    console.error(`[TikTok] Get advertiser list error:`, e);
  }

  return [];
}

/**
 * 全広告主の広告データを取得
 */
export async function getAllAdvertisersAdsReport(
  accessToken: string,
  advertiserIds: string[],
  targetDate: string
): Promise<Array<TikTokAdData & { advertiserId: string; advertiserName?: string }>> {
  const allResults: Array<TikTokAdData & { advertiserId: string; advertiserName?: string }> = [];

  for (const advertiserId of advertiserIds) {
    try {
      const ads = await getTikTokAdsReport({ accessToken, advertiserId }, targetDate);
      
      for (const ad of ads) {
        allResults.push({
          ...ad,
          advertiserId,
        });
      }

      // APIレート制限対策
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`[TikTok] Error getting ads for ${advertiserId}:`, error);
      // エラーがあっても続行
    }
  }

  return allResults;
}

