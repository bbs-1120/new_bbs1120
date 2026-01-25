import { NextResponse } from "next/server";

// Meta Graph APIから動画を取得
async function getMetaVideoUrl(campaignId: string): Promise<string | null> {
  try {
    // 複数のアクセストークンを試す
    const tokens = [
      process.env.META_ACCESS_TOKEN_BUSINESS_01,
      process.env.META_ACCESS_TOKEN_BUSINESS_03,
      process.env.META_ACCESS_TOKEN_BUSINESS_08,
      process.env.META_ACCESS_TOKEN_BUSINESS_11,
      process.env.META_ACCESS_TOKEN_BUSINESS_13,
      process.env.META_ACCESS_TOKEN_BUSINESS_14,
    ].filter(Boolean);

    for (const accessToken of tokens) {
      try {
        // キャンペーンから広告を取得
        const adsRes = await fetch(
          `https://graph.facebook.com/v19.0/${campaignId}/ads?fields=creative{object_story_spec,video_id}&access_token=${accessToken}`,
          { next: { revalidate: 3600 } }
        );
        
        if (!adsRes.ok) continue;
        
        const adsData = await adsRes.json();
        
        if (adsData.data && adsData.data.length > 0) {
          const ad = adsData.data[0];
          
          // video_idがある場合は動画URLを取得
          if (ad.creative?.video_id) {
            const videoRes = await fetch(
              `https://graph.facebook.com/v19.0/${ad.creative.video_id}?fields=source&access_token=${accessToken}`
            );
            
            if (videoRes.ok) {
              const videoData = await videoRes.json();
              if (videoData.source) {
                return videoData.source;
              }
            }
          }
          
          // object_story_specからmedia_urlを取得
          if (ad.creative?.object_story_spec?.video_data?.video_id) {
            const videoId = ad.creative.object_story_spec.video_data.video_id;
            const videoRes = await fetch(
              `https://graph.facebook.com/v19.0/${videoId}?fields=source&access_token=${accessToken}`
            );
            
            if (videoRes.ok) {
              const videoData = await videoRes.json();
              if (videoData.source) {
                return videoData.source;
              }
            }
          }
        }
      } catch (error) {
        console.error(`Meta API error with token:`, error);
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error("Meta video fetch error:", error);
    return null;
  }
}

// TikTok APIから動画を取得
async function getTikTokVideoUrl(campaignId: string): Promise<string | null> {
  try {
    const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
    const advertiserIds = process.env.TIKTOK_ADVERTISER_IDS?.split(",") || [];
    
    if (!accessToken || advertiserIds.length === 0) {
      return null;
    }
    
    for (const advertiserId of advertiserIds) {
      try {
        // 広告情報を取得
        const adRes = await fetch(
          `https://business-api.tiktok.com/open_api/v1.3/ad/get/?advertiser_id=${advertiserId.trim()}&filtering={"campaign_ids":["${campaignId}"]}&fields=["video_id"]`,
          {
            headers: {
              "Access-Token": accessToken,
              "Content-Type": "application/json",
            },
            next: { revalidate: 3600 },
          }
        );
        
        if (!adRes.ok) continue;
        
        const adData = await adRes.json();
        
        if (adData.data?.list && adData.data.list.length > 0) {
          const videoId = adData.data.list[0].video_id;
          
          if (videoId) {
            // 動画情報を取得
            const videoRes = await fetch(
              `https://business-api.tiktok.com/open_api/v1.3/file/video/ad/info/?advertiser_id=${advertiserId.trim()}&video_ids=["${videoId}"]`,
              {
                headers: {
                  "Access-Token": accessToken,
                  "Content-Type": "application/json",
                },
              }
            );
            
            if (videoRes.ok) {
              const videoData = await videoRes.json();
              if (videoData.data?.list?.[0]?.video_url) {
                return videoData.data.list[0].video_url;
              }
            }
          }
        }
      } catch (error) {
        console.error(`TikTok API error with advertiser ${advertiserId}:`, error);
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error("TikTok video fetch error:", error);
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId");
    const media = searchParams.get("media");
    
    if (!campaignId) {
      return NextResponse.json({ success: false, error: "Campaign ID is required" }, { status: 400 });
    }
    
    let videoUrl: string | null = null;
    
    if (media === "FB" || media === "Meta") {
      videoUrl = await getMetaVideoUrl(campaignId);
    } else if (media === "TikTok" || media === "Pangle") {
      videoUrl = await getTikTokVideoUrl(campaignId);
    } else {
      // 両方試す
      videoUrl = await getMetaVideoUrl(campaignId);
      if (!videoUrl) {
        videoUrl = await getTikTokVideoUrl(campaignId);
      }
    }
    
    if (videoUrl) {
      return NextResponse.json({ success: true, videoUrl });
    } else {
      return NextResponse.json({ success: false, error: "Video not found" });
    }
  } catch (error) {
    console.error("Video API error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch video" }, { status: 500 });
  }
}

