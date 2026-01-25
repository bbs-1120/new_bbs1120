import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: 予約一覧と履歴を取得
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "pending";

    if (type === "history") {
      // 実行履歴を取得
      const history = await prisma.scheduled_on_history.findMany({
        orderBy: { executed_at: "desc" },
        take: 30,
      });

      return NextResponse.json({
        success: true,
        history,
      });
    }

    // 翌日の予約を取得
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const scheduled = await prisma.scheduled_on.findMany({
      where: {
        scheduled_at: {
          gte: today,
        },
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

// POST: 予約を登録（コピペ一括登録対応）
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { cpnNames, media } = body;

    if (!cpnNames || !media) {
      return NextResponse.json(
        { success: false, error: "cpnNamesとmediaは必須です" },
        { status: 400 }
      );
    }

    // 改行で分割してCPN名リストを作成
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

    // 翌日の日付を設定
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    // 重複チェックして登録
    const results = [];
    let addedCount = 0;
    let duplicateCount = 0;

    for (const cpnName of cpnList) {
      // 同じ日に同じCPNが既に登録されていないかチェック
      const existing = await prisma.scheduled_on.findFirst({
        where: {
          cpn_name: cpnName,
          media,
          scheduled_at: tomorrow,
          status: "pending",
        },
      });

      if (existing) {
        duplicateCount++;
        results.push({ cpnName, status: "duplicate" });
        continue;
      }

      await prisma.scheduled_on.create({
        data: {
          cpn_name: cpnName,
          media,
          scheduled_at: tomorrow,
          status: "pending",
        },
      });

      addedCount++;
      results.push({ cpnName, status: "added" });
    }

    return NextResponse.json({
      success: true,
      message: `${addedCount}件追加、${duplicateCount}件重複`,
      addedCount,
      duplicateCount,
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
    const all = searchParams.get("all");

    // 全削除
    if (all === "true") {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const result = await prisma.scheduled_on.deleteMany({
        where: {
          scheduled_at: tomorrow,
          status: "pending",
          ...(media ? { media } : {}),
        },
      });

      return NextResponse.json({
        success: true,
        deleted: result.count,
      });
    }

    // 個別削除
    if (id) {
      await prisma.scheduled_on.delete({
        where: { id },
      });

      return NextResponse.json({
        success: true,
        message: "削除しました",
      });
    }

    return NextResponse.json(
      { success: false, error: "idまたはallパラメータが必要です" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Delete scheduled ON error:", error);
    return NextResponse.json(
      { success: false, error: "削除に失敗しました" },
      { status: 500 }
    );
  }
}

