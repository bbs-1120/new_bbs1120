import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { fetchRawDataFromSheet, testConnection } from "@/lib/googleSheets";

// POST: スプレッドシートからデータを同期
export async function POST() {
  try {
    // スプレッドシートIDを取得
    const spreadsheetIdSetting = await prisma.setting.findUnique({
      where: { key: "spreadsheetId" },
    });
    const ruleVersionSetting = await prisma.setting.findUnique({
      where: { key: "ruleVersion" },
    });

    if (!spreadsheetIdSetting?.value) {
      return NextResponse.json(
        { success: false, error: "スプレッドシートIDが設定されていません" },
        { status: 400 }
      );
    }

    // スプレッドシートからデータを取得
    const rawData = await fetchRawDataFromSheet(spreadsheetIdSetting.value);

    if (rawData.length === 0) {
      return NextResponse.json(
        { success: false, error: "取得できるデータがありません" },
        { status: 400 }
      );
    }

    // 媒体マスタを取得
    const mediaList = await prisma.media.findMany();
    const mediaMap = new Map(mediaList.map((m) => [m.name, m.id]));

    // データをDBに保存
    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const row of rawData) {
      // 媒体IDを取得
      let mediaId = mediaMap.get(row.media);
      
      // 媒体が存在しない場合は作成
      if (!mediaId) {
        const newMedia = await prisma.media.create({
          data: { name: row.media },
        });
        mediaId = newMedia.id;
        mediaMap.set(row.media, mediaId);
      }

      try {
        // upsertでデータを保存
        const result = await prisma.cpnDailyData.upsert({
          where: {
            cpnKey_date: {
              cpnKey: row.cpnKey,
              date: row.date,
            },
          },
          update: {
            cpnName: row.cpnName,
            mediaId,
            spend: row.spend,
            revenue: row.revenue,
            profit: row.profit,
            roas: row.roas,
            cv: row.cv,
            mcv: row.mcv,
            cpm: row.cpm,
            cpc: row.cpc,
          },
          create: {
            cpnKey: row.cpnKey,
            cpnName: row.cpnName,
            mediaId,
            date: row.date,
            spend: row.spend,
            revenue: row.revenue,
            profit: row.profit,
            roas: row.roas,
            cv: row.cv,
            mcv: row.mcv,
            cpm: row.cpm,
            cpc: row.cpc,
          },
        });

        if (result.createdAt.getTime() === result.updatedAt.getTime()) {
          insertedCount++;
        } else {
          updatedCount++;
        }
      } catch (error) {
        console.error(`Error saving row: ${row.cpnKey}`, error);
        skippedCount++;
      }
    }

    // 実行ログを記録
    await prisma.executionLog.create({
      data: {
        executedBy: "中田悠太",
        actionType: "sync",
        targetCount: insertedCount + updatedCount,
        ruleVersion: ruleVersionSetting?.value || "1.0",
        status: "success",
      },
    });

    return NextResponse.json({
      success: true,
      totalRows: rawData.length,
      inserted: insertedCount,
      updated: updatedCount,
      skipped: skippedCount,
    });
  } catch (error) {
    console.error("Sync error:", error);

    // エラーログを記録
    try {
      const ruleVersionSetting = await prisma.setting.findUnique({
        where: { key: "ruleVersion" },
      });
      
      await prisma.executionLog.create({
        data: {
          executedBy: "中田悠太",
          actionType: "sync",
          targetCount: 0,
          ruleVersion: ruleVersionSetting?.value || "1.0",
          status: "error",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
      });
    } catch (logError) {
      console.error("Failed to log error:", logError);
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "同期処理に失敗しました" 
      },
      { status: 500 }
    );
  }
}

// GET: 接続テスト
export async function GET() {
  try {
    const spreadsheetIdSetting = await prisma.setting.findUnique({
      where: { key: "spreadsheetId" },
    });

    if (!spreadsheetIdSetting?.value) {
      return NextResponse.json({
        success: false,
        error: "スプレッドシートIDが設定されていません",
      });
    }

    const result = await testConnection(spreadsheetIdSetting.value);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "接続テストに失敗しました",
    });
  }
}

