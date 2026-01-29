import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchTodayData } from "@/lib/googleSheets";
import { getAdvertiserIdByAccountName } from "@/lib/advertiserMapping";

// 日本時間の今日の日付を取得
function getJSTDate(): Date {
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstTime = new Date(now.getTime() + jstOffset);
  return new Date(Date.UTC(jstTime.getUTCFullYear(), jstTime.getUTCMonth(), jstTime.getUTCDate()));
}

// CPN名からキャンペーンIDと広告主IDを取得するためのキャッシュ
let cpnDataCache: {
  data: Map<string, { campaignId: string; accountName: string; media: string }>;
  timestamp: number;
} | null = null;

const CACHE_TTL = 30 * 60 * 1000; // 30分

// DBとGoogleシートからデータを取得してキャッシュ
async function getCpnDataMap() {
  const now = Date.now();
  
  if (cpnDataCache && (now - cpnDataCache.timestamp) < CACHE_TTL) {
    return cpnDataCache.data;
  }

  const cpnMap = new Map<string, { campaignId: string; accountName: string; media: string }>();

  try {
    // 1. まずDBのマッピングテーブルから取得（履歴データを含む）
    const dbMappings = await prisma.cpn_campaign_mapping.findMany();
    for (const mapping of dbMappings) {
      if (mapping.cpn_name && mapping.campaign_id) {
        cpnMap.set(mapping.cpn_name, {
          campaignId: mapping.campaign_id,
          accountName: mapping.account_name || "",
          media: mapping.media || "",
        });
      }
    }
    console.log(`Loaded ${dbMappings.length} CPN mappings from DB`);
  } catch (error) {
    console.error("Error fetching CPN mappings from DB:", error);
  }

  try {
    // 2. Googleシートの当日データで上書き（最新データを優先）
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    if (spreadsheetId) {
      const todayData = await fetchTodayData(spreadsheetId);
      for (const row of todayData) {
        if (row.cpnName && row.campaignId) {
          cpnMap.set(row.cpnName, {
            campaignId: row.campaignId,
            accountName: row.accountName,
            media: row.media,
          });
        }
      }
      console.log(`Updated with ${todayData.length} entries from today's data`);
    }
  } catch (error) {
    console.error("Error fetching CPN data from Google Sheets:", error);
  }

  cpnDataCache = { data: cpnMap, timestamp: now };
  console.log(`CPN data cache total: ${cpnMap.size} entries`);
  return cpnMap;
}

// GET: 予約一覧と履歴を取得
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "pending";

    if (type === "history") {
      const history = await prisma.scheduled_on_history.findMany({
        orderBy: { executed_at: "desc" },
        take: 30,
      });

      return NextResponse.json({
        success: true,
        history,
      });
    }

    // pending状態の予約を全て取得
    const scheduled = await prisma.scheduled_on.findMany({
      where: {
        status: "pending",
      },
      orderBy: [{ media: "asc" }, { cpn_name: "asc" }],
    });

    // 媒体別にグループ化
    const groupedByMedia: Record<string, typeof scheduled> = {
      Meta: [],
      TikTok: [],
      Pangle: [],
    };

    for (const item of scheduled) {
      if (groupedByMedia[item.media]) {
        groupedByMedia[item.media].push(item);
      }
    }

    return NextResponse.json({
      success: true,
      scheduled: groupedByMedia,
      total: scheduled.length,
    });
  } catch (error) {
    console.error("Get scheduled ON error:", error);
    return NextResponse.json(
      { success: false, error: "データの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST: 予約を登録
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { cpnNames, media } = body;

    if (!cpnNames || !media) {
      return NextResponse.json(
        { success: false, error: "CPN名と媒体を指定してください" },
        { status: 400 }
      );
    }

    // CPN名をリスト化（改行区切り）
    const cpnList = cpnNames
      .split("\n")
      .map((name: string) => name.trim())
      .filter((name: string) => name.length > 0);

    if (cpnList.length === 0) {
      return NextResponse.json(
        { success: false, error: "有効なCPN名がありません" },
        { status: 400 }
      );
    }

    // 日本時間の今日の日付
    const todayJST = getJSTDate();

    // CPN名からキャンペーンIDを取得するためのマップ
    const cpnDataMap = await getCpnDataMap();

    const results: { 
      cpnName: string; 
      status: string; 
      campaignId?: string | null;
      advertiserId?: string | null;
      accountName?: string | null;
    }[] = [];
    let addedCount = 0;
    let duplicateCount = 0;
    let unmappedCount = 0;

    for (const cpnName of cpnList) {
      // 同じCPNが既にpendingで登録されていないかチェック
      const existing = await prisma.scheduled_on.findFirst({
        where: {
          cpn_name: cpnName,
          status: "pending",
        },
      });

      if (existing) {
        duplicateCount++;
        results.push({ cpnName, status: "duplicate" });
        continue;
      }

      // キャンペーンIDと広告主IDを自動取得
      const cpnData = cpnDataMap.get(cpnName);
      const campaignId = cpnData?.campaignId || null;
      const accountName = cpnData?.accountName || null;
      
      // TikTok/Pangleの場合は広告主IDを取得
      let advertiserId: string | null = null;
      if ((media === "TikTok" || media === "Pangle") && accountName) {
        advertiserId = getAdvertiserIdByAccountName(accountName);
      }

      if (!campaignId) {
        unmappedCount++;
      }

      // 予約を作成（scheduled_atは今日の日付、0:00に実行される）
      await prisma.scheduled_on.create({
        data: {
          cpn_name: cpnName,
          media: media === "TikTok/Pangle" ? "TikTok" : media,
          campaign_id: campaignId,
          advertiser_id: advertiserId,
          account_name: accountName,
          scheduled_at: todayJST,
          status: "pending",
        },
      });

      addedCount++;
      results.push({ cpnName, status: "added", campaignId, advertiserId, accountName });
    }

    return NextResponse.json({
      success: true,
      message: `${addedCount}件追加、${duplicateCount}件重複、${unmappedCount}件未紐付け`,
      addedCount,
      duplicateCount,
      unmappedCount,
      results,
    });
  } catch (error) {
    console.error("Create scheduled ON error:", error);
    return NextResponse.json(
      { success: false, error: "予約の登録に失敗しました" },
      { status: 500 }
    );
  }
}

// DELETE: 予約を削除
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const media = searchParams.get("media");

    if (id) {
      // 単一削除
      await prisma.scheduled_on.delete({
        where: { id },
      });

      return NextResponse.json({
        success: true,
        message: "予約を削除しました",
      });
    } else if (media) {
      // 媒体別全削除
      const mediaToDelete = media === "TikTok/Pangle" ? ["TikTok", "Pangle"] : [media];
      
      const deleted = await prisma.scheduled_on.deleteMany({
        where: {
          media: { in: mediaToDelete },
          status: "pending",
        },
      });

      return NextResponse.json({
        success: true,
        message: `${deleted.count}件の予約を削除しました`,
        deletedCount: deleted.count,
      });
    } else {
      return NextResponse.json(
        { success: false, error: "削除対象を指定してください" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Delete scheduled ON error:", error);
    return NextResponse.json(
      { success: false, error: "予約の削除に失敗しました" },
      { status: 500 }
    );
  }
}
