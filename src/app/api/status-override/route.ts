import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ステータスオーバーライドを取得
export async function GET() {
  try {
    // 有効期限内のオーバーライドのみ取得
    const overrides = await prisma.statusOverride.findMany({
      where: {
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    // cpnKeyをキーとしたオブジェクトに変換
    const overrideMap: Record<string, string> = {};
    for (const override of overrides) {
      overrideMap[override.cpnKey] = override.status;
    }

    return NextResponse.json({
      success: true,
      overrides: overrideMap,
    });
  } catch (error) {
    console.error("Failed to fetch status overrides:", error);
    return NextResponse.json({
      success: false,
      overrides: {},
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// ステータスオーバーライドを保存
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { cpnKey, cpnName, media, status } = body;

    if (!cpnKey || !status) {
      return NextResponse.json(
        { success: false, error: "cpnKey and status are required" },
        { status: 400 }
      );
    }

    // 24時間後の有効期限を設定
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // upsert（存在すれば更新、なければ作成）
    await prisma.statusOverride.upsert({
      where: { cpnKey },
      update: {
        status,
        changedAt: new Date(),
        expiresAt,
      },
      create: {
        cpnKey,
        cpnName: cpnName || "",
        media: media || "",
        status,
        expiresAt,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Status override saved",
    });
  } catch (error) {
    console.error("Failed to save status override:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// 期限切れのオーバーライドを削除（クリーンアップ用）
export async function DELETE() {
  try {
    const result = await prisma.statusOverride.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return NextResponse.json({
      success: true,
      deleted: result.count,
    });
  } catch (error) {
    console.error("Failed to cleanup status overrides:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

