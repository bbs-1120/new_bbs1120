import { NextResponse } from "next/server";

// Meta API からクリエイティブ（広告）データを取得
// unitPrice: CPN単価（売上額/CV から算出）
async function getMetaCreatives(campaignId: string, startDate?: string, endDate?: string, unitPrice: number = 20000) {
  // 全てのアクセストークンを収集
  const accessTokens = [
    process.env.META_TOKEN_BUSINESS01,
    process.env.META_TOKEN_BUSINESS03,
    process.env.META_TOKEN_BUSINESS08,
    process.env.META_TOKEN_BUSINESS11,
    process.env.META_TOKEN_BUSINESS13,
    process.env.META_TOKEN_BUSINESS14,
    process.env.META_ACCESS_TOKEN_BUSINESS_01,
    process.env.META_ACCESS_TOKEN_BUSINESS_03,
    process.env.META_ACCESS_TOKEN_BUSINESS_08,
    process.env.META_ACCESS_TOKEN_BUSINESS_11,
    process.env.META_ACCESS_TOKEN_BUSINESS_13,
    process.env.META_ACCESS_TOKEN_BUSINESS_14,
    process.env.META_ACCESS_TOKEN,
  ].filter(Boolean);

  console.log(`[Creatives API] Trying ${accessTokens.length} tokens for campaign ${campaignId}, unitPrice: ${unitPrice}`);

  for (const accessToken of accessTokens) {
    try {
      // time_range パラメータを構築
      const timeRangeParam = startDate && endDate 
        ? `time_range={"since":"${startDate}","until":"${endDate}"}`
        : `date_preset=last_7d`;
      
      // キャンペーンから広告セットを取得し、その広告セットから広告を取得
      // まずキャンペーンの広告セットを取得
      const adSetsUrl = `https://graph.facebook.com/v19.0/${campaignId}/adsets?fields=id,name&limit=100&access_token=${accessToken}`;
      const adSetsRes = await fetch(adSetsUrl);
      const adSetsData = await adSetsRes.json();
      
      if (adSetsData.error) {
        console.log(`[Creatives API] AdSets error:`, adSetsData.error.message);
        continue;
      }

      const allAds: {
        adId: string;
        name: string;
        spend: number;
        impressions: number;
        clicks: number;
        cv: number;
        cpa: number;
        revenue: number;
        profit: number;
        roas: number;
        ctr: number;
        cpm: number;
        cpc: number;
        videoUrl?: string;
        thumbnailUrl?: string;
      }[] = [];

      // 各広告セットの広告を取得
      const adSetList = adSetsData.data || [];
      console.log(`[Creatives API] Found ${adSetList.length} ad sets`);
      
      for (const adSet of adSetList) {
        // 広告セットのinsightsを広告レベルで取得
        const insightsUrl = `https://graph.facebook.com/v19.0/${adSet.id}/insights?level=ad&fields=ad_id,ad_name,spend,impressions,clicks,actions,action_values&${timeRangeParam}&limit=500&access_token=${accessToken}`;
        const insightsRes = await fetch(insightsUrl);
        const insightsData = await insightsRes.json();
        
        if (insightsData.error) {
          console.log(`[Creatives API] Insights error for adset ${adSet.id}:`, insightsData.error.message);
          continue;
        }
        
        if (!insightsData.data || insightsData.data.length === 0) {
          continue;
        }
        
        console.log(`[Creatives API] Found ${insightsData.data.length} ads in adset ${adSet.name}`);
        
        for (const insight of insightsData.data) {
          const spend = parseFloat(insight.spend || "0");
          const impressions = parseInt(insight.impressions || "0", 10);
          const clicks = parseInt(insight.clicks || "0", 10);
          
          // CVを取得: 様々なaction_typeに対応
          const actions = insight.actions || [];
          let cv = 0;
          
          // 優先順位でCVを探す
          const cvActionTypes = [
            "offsite_conversion.fb_pixel_purchase",
            "omni_purchase", 
            "purchase",
            "offsite_conversion.fb_pixel_lead",
            "lead",
            "onsite_conversion.lead_grouped",
            "complete_registration",
            "offsite_conversion.fb_pixel_complete_registration",
            "submit_application",
            "offsite_conversion.custom",
          ];
          
          for (const actionType of cvActionTypes) {
            const action = actions.find((a: { action_type: string; value: string }) => a.action_type === actionType);
            if (action) {
              cv = parseInt(action.value || "0", 10);
              console.log(`[Creatives API] Found CV: ${cv} from action_type: ${actionType}`);
              break;
            }
          }
          
          // CVが見つからない場合、全てのoffsite_conversionを合計
          if (cv === 0) {
            const offsiteConversions = actions.filter((a: { action_type: string }) => 
              a.action_type.startsWith("offsite_conversion")
            );
            cv = offsiteConversions.reduce((sum: number, a: { value: string }) => sum + parseInt(a.value || "0", 10), 0);
          }
          
          // 派生指標を計算
          const revenue = cv * unitPrice;
          const profit = revenue - spend;
          const cpa = cv > 0 ? spend / cv : 0;
          const roas = spend > 0 ? (revenue / spend) * 100 : 0;
          const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
          const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
          const cpc = clicks > 0 ? spend / clicks : 0;
          
          // 広告のクリエイティブ情報を取得
          let videoUrl: string | undefined = undefined;
          let thumbnailUrl: string | undefined = undefined;
          
          if (insight.ad_id) {
            try {
              const adDetailUrl = `https://graph.facebook.com/v19.0/${insight.ad_id}?fields=creative{video_id,thumbnail_url,image_url,effective_object_story_id}&access_token=${accessToken}`;
              const adDetailRes = await fetch(adDetailUrl);
              const adDetailData = await adDetailRes.json();
              
              thumbnailUrl = adDetailData.creative?.thumbnail_url || adDetailData.creative?.image_url;
              
              if (adDetailData.creative?.video_id) {
                const videoRes = await fetch(`https://graph.facebook.com/v19.0/${adDetailData.creative.video_id}?fields=source,thumbnails&access_token=${accessToken}`);
                const videoData = await videoRes.json();
                videoUrl = videoData.source;
                if (!thumbnailUrl && videoData.thumbnails?.data?.[0]?.uri) {
                  thumbnailUrl = videoData.thumbnails.data[0].uri;
                }
              }
            } catch (e) {
              console.log(`[Creatives API] Ad detail fetch error:`, e);
            }
          }
          
          allAds.push({
            adId: insight.ad_id,
            name: insight.ad_name || "不明",
            spend,
            impressions,
            clicks,
            cv,
            cpa,
            revenue,
            profit,
            roas,
            ctr,
            cpm,
            cpc,
            videoUrl,
            thumbnailUrl,
          });
        }
      }
      
      if (allAds.length > 0) {
        console.log(`[Creatives API] Total ${allAds.length} ads found for campaign ${campaignId}`);
        return allAds;
      }
      
      // 広告セットが見つからない場合、キャンペーン直下から取得を試みる
      console.log(`[Creatives API] No ads found via adsets, trying campaign level insights`);
      
      const campaignInsightsUrl = `https://graph.facebook.com/v19.0/${campaignId}/insights?level=ad&fields=ad_id,ad_name,spend,impressions,clicks,actions&${timeRangeParam}&limit=500&access_token=${accessToken}`;
      const campaignInsightsRes = await fetch(campaignInsightsUrl);
      const campaignInsightsData = await campaignInsightsRes.json();
      
      if (!campaignInsightsData.error && campaignInsightsData.data && campaignInsightsData.data.length > 0) {
        for (const insight of campaignInsightsData.data) {
          const spend = parseFloat(insight.spend || "0");
          const impressions = parseInt(insight.impressions || "0", 10);
          const clicks = parseInt(insight.clicks || "0", 10);
          
          const actions = insight.actions || [];
          let cv = 0;
          for (const actionType of ["offsite_conversion.fb_pixel_purchase", "purchase", "lead", "complete_registration"]) {
            const action = actions.find((a: { action_type: string; value: string }) => a.action_type === actionType);
            if (action) {
              cv = parseInt(action.value || "0", 10);
              break;
            }
          }
          
          const revenue = cv * unitPrice;
          const profit = revenue - spend;
          
          allAds.push({
            adId: insight.ad_id,
            name: insight.ad_name || "不明",
            spend,
            impressions,
            clicks,
            cv,
            cpa: cv > 0 ? spend / cv : 0,
            revenue,
            profit,
            roas: spend > 0 ? (revenue / spend) * 100 : 0,
            ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
            cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
            cpc: clicks > 0 ? spend / clicks : 0,
            videoUrl: undefined,
            thumbnailUrl: undefined,
          });
        }
        
        if (allAds.length > 0) {
          console.log(`[Creatives API] Found ${allAds.length} ads via campaign level insights`);
          return allAds;
        }
      }
    } catch (error) {
      console.error("[Creatives API] Meta API error:", error);
    }
  }
  
  console.log(`[Creatives API] No creatives found for campaign ${campaignId}`);
  return [];
}

// TikTok API からクリエイティブデータを取得
async function getTikTokCreatives(campaignId: string, startDate?: string, endDate?: string, unitPrice: number = 20000) {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  if (!accessToken) return [];
  
  const advertiserIds = (process.env.TIKTOK_ADVERTISER_IDS || "").split(",").filter(Boolean);
  
  for (const advertiserId of advertiserIds) {
    try {
      // キャンペーンに紐づく広告グループを取得
      const adGroupsUrl = `https://business-api.tiktok.com/open_api/v1.3/adgroup/get/`;
      const adGroupsRes = await fetch(adGroupsUrl, {
        method: "POST",
        headers: {
          "Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          advertiser_id: advertiserId,
          filtering: { campaign_ids: [campaignId] },
          page_size: 100,
        }),
      });
      const adGroupsData = await adGroupsRes.json();
      
      if (adGroupsData.code !== 0) continue;
      
      const adGroupIds = adGroupsData.data?.list?.map((g: { adgroup_id: string }) => g.adgroup_id) || [];
      
      // 広告グループに紐づく広告を取得
      const allAds: {
        name: string;
        spend: number;
        impressions: number;
        clicks: number;
        cv: number;
        cpa: number;
        revenue: number;
        profit: number;
        roas: number;
        ctr: number;
        cpm: number;
        cpc: number;
        videoUrl?: string;
        thumbnailUrl?: string;
      }[] = [];
      
      for (const adGroupId of adGroupIds) {
        const adsUrl = `https://business-api.tiktok.com/open_api/v1.3/ad/get/`;
        const adsRes = await fetch(adsUrl, {
          method: "POST",
          headers: {
            "Access-Token": accessToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            advertiser_id: advertiserId,
            filtering: { adgroup_ids: [adGroupId] },
            page_size: 100,
          }),
        });
        const adsData = await adsRes.json();
        
        if (adsData.code !== 0 || !adsData.data?.list) continue;
        
        for (const ad of adsData.data.list) {
          // 広告のレポートデータを取得
          const reportUrl = `https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/`;
          const reportRes = await fetch(reportUrl, {
            method: "POST",
            headers: {
              "Access-Token": accessToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              advertiser_id: advertiserId,
              report_type: "BASIC",
              dimensions: ["ad_id"],
              metrics: ["spend", "impressions", "clicks", "conversion"],
              filters: [{ field_name: "ad_id", filter_type: "IN", filter_value: [ad.ad_id] }],
              data_level: "AUCTION_AD",
              start_date: startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
              end_date: endDate || new Date().toISOString().split("T")[0],
            }),
          });
          const reportData = await reportRes.json();
          
          const metrics = reportData.data?.list?.[0]?.metrics || {};
          const spend = parseFloat(metrics.spend || "0");
          const impressions = parseInt(metrics.impressions || "0", 10);
          const clicks = parseInt(metrics.clicks || "0", 10);
          const cv = parseInt(metrics.conversion || "0", 10);
          
          const revenue = cv * unitPrice;
          const profit = revenue - spend;
          
          allAds.push({
            name: ad.ad_name || "不明",
            spend,
            impressions,
            clicks,
            cv,
            cpa: cv > 0 ? spend / cv : 0,
            revenue,
            profit,
            roas: spend > 0 ? (revenue / spend) * 100 : 0,
            ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
            cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
            cpc: clicks > 0 ? spend / clicks : 0,
            videoUrl: ad.video_url,
            thumbnailUrl: ad.image_url,
          });
        }
      }
      
      if (allAds.length > 0) {
        return allAds;
      }
    } catch (error) {
      console.error("TikTok API error:", error);
    }
  }
  
  return [];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get("campaignId");
  const media = searchParams.get("media");
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;
  const unitPriceParam = searchParams.get("unitPrice");
  const unitPrice = unitPriceParam ? parseFloat(unitPriceParam) : 20000;
  
  if (!campaignId) {
    return NextResponse.json({ success: false, error: "campaignId is required" }, { status: 400 });
  }
  
  console.log(`[Creatives API] Request: campaignId=${campaignId}, media=${media}, dates=${startDate}-${endDate}, unitPrice=${unitPrice}`);
  
  try {
    let creatives: {
      adId?: string;
      name: string;
      spend: number;
      impressions: number;
      clicks: number;
      cv: number;
      cpa: number;
      revenue: number;
      profit: number;
      roas: number;
      ctr: number;
      cpm: number;
      cpc: number;
      videoUrl?: string;
      thumbnailUrl?: string;
    }[] = [];
    
    if (media === "FB" || media === "Meta") {
      creatives = await getMetaCreatives(campaignId, startDate, endDate, unitPrice);
    } else if (media === "TikTok" || media === "Pangle") {
      creatives = await getTikTokCreatives(campaignId, startDate, endDate, unitPrice);
    }
    
    return NextResponse.json({
      success: true,
      creatives,
    });
  } catch (error) {
    console.error("Creatives API error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch creatives" }, { status: 500 });
  }
}

