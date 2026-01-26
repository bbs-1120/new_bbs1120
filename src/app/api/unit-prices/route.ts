import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// 単価一覧を取得
export async function GET() {
  try {
    const prices = await prisma.offer_unit_prices.findMany({
      orderBy: [{ project_name: "asc" }, { offer_name: "asc" }, { media: "asc" }],
    });

    return NextResponse.json({
      success: true,
      prices,
      count: prices.length,
    });
  } catch (error) {
    console.error("Unit prices GET error:", error);
    return NextResponse.json({ success: false, error: "取得に失敗しました" }, { status: 500 });
  }
}

// 単価データをインポート（一括更新）
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ success: false, error: "管理者権限が必要です" }, { status: 403 });
    }

    const body = await request.json();
    const { prices } = body;

    if (!prices || !Array.isArray(prices)) {
      return NextResponse.json({ success: false, error: "prices配列が必要です" }, { status: 400 });
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const price of prices) {
      const { offerKey, projectName, offerName, media, yesterdayPrice, todayPrice } = price;

      if (!offerKey || !projectName || !offerName || !media) {
        skipped++;
        continue;
      }

      // メディア名の正規化
      let normalizedMedia = media;
      if (media.toLowerCase() === "pangle") normalizedMedia = "pangle";
      else if (media.toUpperCase() === "FB") normalizedMedia = "FB";
      else if (media.toLowerCase() === "tiktok") normalizedMedia = "TikTok";
      else if (media.toUpperCase() === "YT") normalizedMedia = "YT";
      else if (media.toUpperCase() === "LINE") normalizedMedia = "LINE";
      else if (media.toUpperCase() === "X") normalizedMedia = "X";

      try {
        const existing = await prisma.offer_unit_prices.findUnique({
          where: { offer_key: offerKey },
        });

        if (existing) {
          await prisma.offer_unit_prices.update({
            where: { offer_key: offerKey },
            data: {
              project_name: projectName,
              offer_name: offerName,
              media: normalizedMedia,
              yesterday_price: yesterdayPrice || 0,
              today_price: todayPrice || 0,
              updated_at: new Date(),
            },
          });
          updated++;
        } else {
          await prisma.offer_unit_prices.create({
            data: {
              offer_key: offerKey,
              project_name: projectName,
              offer_name: offerName,
              media: normalizedMedia,
              yesterday_price: yesterdayPrice || 0,
              today_price: todayPrice || 0,
            },
          });
          imported++;
        }
      } catch (e) {
        console.error(`Failed to import ${offerKey}:`, e);
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      updated,
      skipped,
      total: prices.length,
    });
  } catch (error) {
    console.error("Unit prices POST error:", error);
    return NextResponse.json({ success: false, error: "インポートに失敗しました" }, { status: 500 });
  }
}

// CPN名からオファーキーを抽出して単価を取得
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { cpnName } = body;

    if (!cpnName) {
      return NextResponse.json({ success: false, error: "cpnNameが必要です" }, { status: 400 });
    }

    // CPN名からオファーキーを抽出
    // 例: 新規グロース部_悠太_Rクリニック女性_新直LINE_FB_AX072_...
    // → Rクリニック女性_新直LINE_FB
    const parts = cpnName.split("_");
    
    // 新規グロース部_メンバー名_ の後から、案件名_オファー名_媒体名 を抽出
    // パターン: 新規グロース部_{メンバー}_{案件名}_{オファー名}_{媒体}_{以下略}
    if (parts.length < 5) {
      return NextResponse.json({ success: false, error: "CPN名の形式が不正です" });
    }

    // インデックス2: 案件名, インデックス3: オファー名, インデックス4: 媒体
    const projectName = parts[2];
    const offerName = parts[3];
    const media = parts[4];
    const offerKey = `${projectName}_${offerName}_${media}`;

    const price = await prisma.offer_unit_prices.findUnique({
      where: { offer_key: offerKey },
    });

    if (price) {
      return NextResponse.json({
        success: true,
        offerKey,
        projectName,
        offerName,
        media,
        unitPrice: price.today_price,
        yesterdayPrice: price.yesterday_price,
      });
    }

    // 見つからない場合、案件名のみで検索（部分一致）
    const partialMatch = await prisma.offer_unit_prices.findFirst({
      where: {
        project_name: projectName,
        media: media,
      },
    });

    if (partialMatch) {
      return NextResponse.json({
        success: true,
        offerKey,
        projectName,
        offerName,
        media,
        unitPrice: partialMatch.today_price,
        yesterdayPrice: partialMatch.yesterday_price,
        partial: true,
      });
    }

    return NextResponse.json({
      success: false,
      offerKey,
      error: "単価が見つかりません",
    });
  } catch (error) {
    console.error("Unit prices PUT error:", error);
    return NextResponse.json({ success: false, error: "取得に失敗しました" }, { status: 500 });
  }
}
