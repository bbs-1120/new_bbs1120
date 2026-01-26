import { NextResponse } from "next/server";

// Meta API からクリエイティブデータを取得（改善版）
async function getMetaCreatives(campaignId: string, startDate?: string, endDate?: string) {
  // 全てのアクセストークンを収集（両方の命名規則に対応）
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

  console.log(`[Creatives API] Trying ${accessTokens.length} tokens for campaign ${campaignId}`);

  for (const accessToken of accessTokens) {
    try {
      // 方法1: キャンペーンから直接広告を取得（より確実）
      const timeRange = startDate && endDate 
        ? `&time_range={"since":"${startDate}","until":"${endDate}"}`
        : `&date_preset=last_7d`;
      
      // キャンペーンのinsightsを広告レベルで取得
      const insightsUrl = `https://graph.facebook.com/v19.0/${campaignId}/insights?level=ad&fields=ad_id,ad_name,spend,impressions,clicks,actions&${timeRange}&access_token=${accessToken}`;
      const insightsRes = await fetch(insightsUrl);
      const insightsData = await insightsRes.json();
      
      if (insightsData.error) {
        console.log(`[Creatives API] Insights error:`, insightsData.error.message);
        continue;
      }
      
      if (!insightsData.data || insightsData.data.length === 0) {
        console.log(`[Creatives API] No insights data found, trying alternative method`);
        
        // 方法2: 広告セット経由で広告を取得
        const adsUrl = `https://graph.facebook.com/v19.0/${campaignId}/ads?fields=id,name,creative{id,video_id,thumbnail_url,image_url,object_story_spec}&limit=100&access_token=${accessToken}`;
        const adsRes = await fetch(adsUrl);
        const adsData = await adsRes.json();
        
        if (adsData.error) {
          console.log(`[Creatives API] Ads error:`, adsData.error.message);
          continue;
        }
        
        if (!adsData.data || adsData.data.length === 0) {
          continue;
        }
        
        // 各広告のinsightsを個別に取得
        const allAds = [];
        for (const ad of adsData.data) {
          const adInsightsUrl = `https://graph.facebook.com/v19.0/${ad.id}/insights?fields=spend,impressions,clicks,actions${timeRange}&access_token=${accessToken}`;
          const adInsightsRes = await fetch(adInsightsUrl);
          const adInsightsData = await adInsightsRes.json();
          
          const insights = adInsightsData.data?.[0] || {};
          const spend = parseFloat(insights.spend || "0");
          const impressions = parseInt(insights.impressions || "0", 10);
          const clicks = parseInt(insights.clicks || "0", 10);
          
          const actions = insights.actions || [];
          const cvAction = actions.find((a: { action_type: string }) => 
            a.action_type === "offsite_conversion.fb_pixel_purchase" ||
            a.action_type === "omni_purchase" ||
            a.action_type === "purchase" ||
            a.action_type === "lead"
          );
          const cv = parseInt(cvAction?.value || "0", 10);
          
          // サムネイル/動画URL取得
          let videoUrl = undefined;
          let thumbnailUrl = ad.creative?.thumbnail_url || ad.creative?.image_url;
          
          if (ad.creative?.video_id) {
            try {
              const videoRes = await fetch(`https://graph.facebook.com/v19.0/${ad.creative.video_id}?fields=source,thumbnails&access_token=${accessToken}`);
              const videoData = await videoRes.json();
              videoUrl = videoData.source;
              if (!thumbnailUrl && videoData.thumbnails?.data?.[0]?.uri) {
                thumbnailUrl = videoData.thumbnails.data[0].uri;
              }
            } catch (e) {
              console.log(`[Creatives API] Video fetch error:`, e);
            }
          }
          
          const unitPrice = 20000;
          const revenue = cv * unitPrice;
          const profit = revenue - spend;
          
          allAds.push({
            adId: ad.id,
            name: ad.name || "不明",
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
            videoUrl,
            thumbnailUrl,
          });
        }
        
        if (allAds.length > 0) {
          console.log(`[Creatives API] Found ${allAds.length} ads via alternative method`);
          return allAds;
        }
        continue;
      }
      
      // insightsデータから広告情報を構築
      const allAds = [];
      for (const insight of insightsData.data) {
        const spend = parseFloat(insight.spend || "0");
        const impressions = parseInt(insight.impressions || "0", 10);
        const clicks = parseInt(insight.clicks || "0", 10);
        
        const actions = insight.actions || [];
        const cvAction = actions.find((a: { action_type: string }) => 
          a.action_type === "offsite_conversion.fb_pixel_purchase" ||
          a.action_type === "omni_purchase" ||
          a.action_type === "purchase" ||
          a.action_type === "lead"
        );
        const cv = parseInt(cvAction?.value || "0", 10);
        
        // 広告のクリエイティブ情報を取得
        let videoUrl = undefined;
        let thumbnailUrl = undefined;
        
        if (insight.ad_id) {
          try {
            const adDetailUrl = `https://graph.facebook.com/v19.0/${insight.ad_id}?fields=creative{video_id,thumbnail_url,image_url}&access_token=${accessToken}`;
            const adDetailRes = await fetch(adDetailUrl);
            const adDetailData = await adDetailRes.json();
            
            thumbnailUrl = adDetailData.creative?.thumbnail_url || adDetailData.creative?.image_url;
            
            if (adDetailData.creative?.video_id) {
              const videoRes = await fetch(`https://graph.facebook.com/v19.0/${adDetailData.creative.video_id}?fields=source&access_token=${accessToken}`);
              const videoData = await videoRes.json();
              videoUrl = videoData.source;
            }
          } catch (e) {
            console.log(`[Creatives API] Ad detail fetch error:`, e);
          }
        }
        
        const unitPrice = 20000;
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
          videoUrl,
          thumbnailUrl,
        });
      }
      
      if (allAds.length > 0) {
        console.log(`[Creatives API] Found ${allAds.length} ads via insights method`);
        return allAds;
      }
    } catch (error) {
      console.error("[Creatives API] Meta API error:", error);
    }
  }
  
  console.log(`[Creatives API] No creatives found for campaign ${campaignId}`);
  return [];
}

// TikTok API からクリエイティブデータを取得
async function getTikTokCreatives(campaignId: string, startDate?: string, endDate?: string) {
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
          
          // 仮の単価
          const unitPrice = 20000;
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
  
  if (!campaignId) {
    return NextResponse.json({ success: false, error: "campaignId is required" }, { status: 400 });
  }
  
  try {
    let creatives: {
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
      creatives = await getMetaCreatives(campaignId, startDate, endDate);
    } else if (media === "TikTok" || media === "Pangle") {
      creatives = await getTikTokCreatives(campaignId, startDate, endDate);
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

