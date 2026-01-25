import { NextResponse } from "next/server";

// Meta API からクリエイティブデータを取得
async function getMetaCreatives(campaignId: string) {
  const accessTokens = [
    process.env.META_TOKEN_BUSINESS01,
    process.env.META_TOKEN_BUSINESS03,
    process.env.META_TOKEN_BUSINESS08,
    process.env.META_TOKEN_BUSINESS11,
    process.env.META_TOKEN_BUSINESS13,
    process.env.META_TOKEN_BUSINESS14,
    process.env.META_ACCESS_TOKEN, // フォールバック
  ].filter(Boolean);

  for (const accessToken of accessTokens) {
    try {
      // まずキャンペーンに紐づく広告セットを取得
      const adsetsUrl = `https://graph.facebook.com/v18.0/${campaignId}/adsets?fields=id,name&access_token=${accessToken}`;
      const adsetsRes = await fetch(adsetsUrl);
      const adsetsData = await adsetsRes.json();
      
      if (adsetsData.error) continue;
      
      const adsetIds = adsetsData.data?.map((a: { id: string }) => a.id) || [];
      
      // 広告セットに紐づく広告を取得
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
      
      for (const adsetId of adsetIds) {
        const adsUrl = `https://graph.facebook.com/v18.0/${adsetId}/ads?fields=id,name,creative{effective_object_story_id,video_id,thumbnail_url}&access_token=${accessToken}`;
        const adsRes = await fetch(adsUrl);
        const adsData = await adsRes.json();
        
        if (adsData.error || !adsData.data) continue;
        
        for (const ad of adsData.data) {
          // 広告の統計データを取得
          const insightsUrl = `https://graph.facebook.com/v18.0/${ad.id}/insights?fields=spend,impressions,clicks,actions&date_preset=last_7d&access_token=${accessToken}`;
          const insightsRes = await fetch(insightsUrl);
          const insightsData = await insightsRes.json();
          
          const insights = insightsData.data?.[0] || {};
          const spend = parseFloat(insights.spend || "0");
          const impressions = parseInt(insights.impressions || "0", 10);
          const clicks = parseInt(insights.clicks || "0", 10);
          
          // CVを抽出（actions配列から）
          const actions = insights.actions || [];
          const cvAction = actions.find((a: { action_type: string }) => 
            a.action_type === "offsite_conversion.fb_pixel_purchase" ||
            a.action_type === "omni_purchase" ||
            a.action_type === "purchase"
          );
          const cv = parseInt(cvAction?.value || "0", 10);
          
          // 動画URLを取得
          let videoUrl = undefined;
          let thumbnailUrl = ad.creative?.thumbnail_url;
          
          if (ad.creative?.video_id) {
            const videoRes = await fetch(`https://graph.facebook.com/v18.0/${ad.creative.video_id}?fields=source&access_token=${accessToken}`);
            const videoData = await videoRes.json();
            videoUrl = videoData.source;
          }
          
          // 仮の単価で計算（実際にはスプレッドシートから取得）
          const unitPrice = 20000; // 仮の単価
          const revenue = cv * unitPrice;
          const profit = revenue - spend;
          
          allAds.push({
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
      }
      
      if (allAds.length > 0) {
        return allAds;
      }
    } catch (error) {
      console.error("Meta API error:", error);
    }
  }
  
  return [];
}

// TikTok API からクリエイティブデータを取得
async function getTikTokCreatives(campaignId: string) {
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
              start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
              end_date: new Date().toISOString().split("T")[0],
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
      creatives = await getMetaCreatives(campaignId);
    } else if (media === "TikTok" || media === "Pangle") {
      creatives = await getTikTokCreatives(campaignId);
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

