import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: マッピングを取得
export async function GET() {
  try {
    const mappings = await prisma.cpn_campaign_mapping.findMany();
    
    const mappingMap: Record<string, {
      campaignId: string;
      media: string;
      accountName?: string;
      advertiserId?: string;
    }> = {};
    
    for (const m of mappings) {
      mappingMap[m.cpn_name] = {
        campaignId: m.campaign_id,
        media: m.media,
        accountName: m.account_name || undefined,
        advertiserId: m.advertiser_id || undefined,
      };
    }
    
    return NextResponse.json({ success: true, mappings: mappingMap });
  } catch (error) {
    console.error("CPN mapping GET error:", error);
    return NextResponse.json({ success: false, error: "マッピングの取得に失敗しました" }, { status: 500 });
  }
}

// POST: マッピングを保存（バルク）
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mappings } = body as {
      mappings: Array<{
        cpnName: string;
        campaignId: string;
        media: string;
        accountName?: string;
        advertiserId?: string;
      }>;
    };
    
    if (!mappings || !Array.isArray(mappings)) {
      return NextResponse.json({ success: false, error: "マッピングデータが無効です" }, { status: 400 });
    }
    
    let savedCount = 0;
    
    for (const mapping of mappings) {
      if (!mapping.cpnName || !mapping.campaignId) continue;
      
      try {
        await prisma.cpn_campaign_mapping.upsert({
          where: { cpn_name: mapping.cpnName },
          update: {
            campaign_id: mapping.campaignId,
            media: mapping.media || "不明",
            account_name: mapping.accountName,
            advertiser_id: mapping.advertiserId,
            updated_at: new Date(),
          },
          create: {
            cpn_name: mapping.cpnName,
            campaign_id: mapping.campaignId,
            media: mapping.media || "不明",
            account_name: mapping.accountName,
            advertiser_id: mapping.advertiserId,
          },
        });
        savedCount++;
      } catch (e) {
        console.error(`Failed to save mapping for ${mapping.cpnName}:`, e);
      }
    }
    
    return NextResponse.json({ success: true, savedCount });
  } catch (error) {
    console.error("CPN mapping POST error:", error);
    return NextResponse.json({ success: false, error: "マッピングの保存に失敗しました" }, { status: 500 });
  }
}

