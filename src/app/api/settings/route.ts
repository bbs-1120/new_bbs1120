import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET: 設定を取得
export async function GET() {
  try {
    const settings = await prisma.setting.findMany();
    
    // オブジェクト形式に変換
    const settingsObj: Record<string, string> = {};
    for (const setting of settings) {
      settingsObj[setting.key] = setting.value;
    }

    return NextResponse.json({
      success: true,
      settings: settingsObj,
    });
  } catch (error) {
    console.error("Get settings error:", error);
    return NextResponse.json(
      { success: false, error: "設定の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// PUT: 設定を更新
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { settings } = body;

    if (!settings || typeof settings !== "object") {
      return NextResponse.json(
        { success: false, error: "無効なリクエストです" },
        { status: 400 }
      );
    }

    // 各設定を更新
    for (const [key, value] of Object.entries(settings)) {
      await prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }

    return NextResponse.json({
      success: true,
      message: "設定を更新しました",
    });
  } catch (error) {
    console.error("Update settings error:", error);
    return NextResponse.json(
      { success: false, error: "設定の更新に失敗しました" },
      { status: 500 }
    );
  }
}

