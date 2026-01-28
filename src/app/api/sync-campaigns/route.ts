import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Google Sheetsからマッピングデータを取得
async function getGoogleSheetsData(): Promise<Array<{
  cpnName: string;
  campaignId: string;
  media: string;
  accountName?: string;
}>> {
  try {
    const { getFullAnalysisData } = await import("@/lib/googleSheets");
    const data = await getFullAnalysisData();
    
    const mappings: Array<{
      cpnName: string;
      campaignId: string;
      media: string;
      accountName?: string;
    }> = [];
    
    // campaignIdが存在するデータのみ抽出
    for (const row of data) {
      if (row.cpnName && row.campaignId) {
        mappings.push({
          cpnName: row.cpnName,
          campaignId: row.campaignId,
          media: row.media === "Meta" ? "FB" : row.media || "その他",
          accountName: row.accountName,
        });
      }
    }
    
    return mappings;
  } catch (error) {
    console.error("[Sync] Failed to fetch Google Sheets data:", error);
    return [];
  }
}

export async function POST(request: Request) {
  try {
    // 内部呼び出しかどうかをチェック
    const { searchParams } = new URL(request.url);
    const isInternal = searchParams.get("internal") === "true";
    
    if (!isInternal) {
      const session = await auth();
      if (!session?.user) {
        return NextResponse.json({ success: false, error: "認証が必要です" }, { status: 401 });
      }
    }

    console.log("[Sync] Starting campaign sync from Google Sheets...");

    // 1. Google Sheetsからマッピングデータを取得
    const sheetsData = await getGoogleSheetsData();
    console.log(`[Sync] Fetched ${sheetsData.length} CPNs with campaignId from Google Sheets`);

    // 2. 既存のマッピングを取得
    const existingMappings = await prisma.cpn_campaign_mapping.findMany();
    const existingMap = new Map(existingMappings.map(m => [m.cpn_name, m]));

    // 3. Google Sheetsからのマッピングをupsert
    let newCount = 0;
    let updatedCount = 0;

    for (const mapping of sheetsData) {
      const existing = existingMap.get(mapping.cpnName);
      
      if (!existing) {
        // 新規マッピング
        try {
          await prisma.cpn_campaign_mapping.create({
            data: {
              cpn_name: mapping.cpnName,
              campaign_id: mapping.campaignId,
              media: mapping.media,
              account_name: mapping.accountName,
            },
          });
          newCount++;
        } catch {
          // 既に存在する場合はupsertで更新
          try {
            await prisma.cpn_campaign_mapping.upsert({
              where: { cpn_name: mapping.cpnName },
              update: { 
                campaign_id: mapping.campaignId, 
                media: mapping.media,
                account_name: mapping.accountName,
              },
              create: {
                cpn_name: mapping.cpnName,
                campaign_id: mapping.campaignId,
                media: mapping.media,
                account_name: mapping.accountName,
              },
            });
            newCount++;
          } catch {}
        }
      } else if (!existing.campaign_id || existing.campaign_id === "") {
        // campaignIdが空の場合は更新
        try {
          await prisma.cpn_campaign_mapping.update({
            where: { cpn_name: mapping.cpnName },
            data: { 
              campaign_id: mapping.campaignId, 
              media: mapping.media,
              account_name: mapping.accountName,
            },
          });
          updatedCount++;
        } catch {}
      }
    }

    // 4. 統計情報を取得
    const totalMappings = await prisma.cpn_campaign_mapping.count();
    const mappedCount = await prisma.cpn_campaign_mapping.count({
      where: { campaign_id: { not: "" } },
    });
    const unmappedCount = totalMappings - mappedCount;

    console.log(`[Sync] Complete: ${newCount} new, ${updatedCount} updated, ${unmappedCount} still unmapped`);

    return NextResponse.json({
      success: true,
      stats: {
        sheetsDataCount: sheetsData.length,
        totalMappings,
        mappedCount,
        unmappedCount,
        newMappings: newCount,
        updatedMappings: updatedCount,
      },
    });
  } catch (error) {
    console.error("[Sync] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "同期に失敗しました" },
      { status: 500 }
    );
  }
}

// GET: 現在のマッピング状況を取得
export async function GET() {
  try {
    const totalMappings = await prisma.cpn_campaign_mapping.count();
    const mappedCount = await prisma.cpn_campaign_mapping.count({
      where: { campaign_id: { not: "" } },
    });
    const unmappedCount = totalMappings - mappedCount;

    // 未マッピングのCPN一覧（最大50件）
    const unmappedList = await prisma.cpn_campaign_mapping.findMany({
      where: { campaign_id: "" },
      take: 50,
      orderBy: { cpn_name: "asc" },
    });

    return NextResponse.json({
      success: true,
      totalMappings,
      mappedCount,
      unmappedCount,
      unmappedList: unmappedList.map(m => m.cpn_name),
    });
  } catch (error) {
    console.error("Get mapping status error:", error);
    return NextResponse.json(
      { success: false, error: "取得に失敗しました" },
      { status: 500 }
    );
  }
}
