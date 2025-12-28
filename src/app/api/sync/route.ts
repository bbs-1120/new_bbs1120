import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 6桁のランダムな同期コードを生成
function generateSyncCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 紛らわしい文字を除外
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// GET: 設定を取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const syncCode = searchParams.get("code");

    if (!syncCode) {
      return NextResponse.json(
        { success: false, error: "同期コードが必要です" },
        { status: 400 }
      );
    }

    const settings = await prisma.user_settings.findUnique({
      where: { sync_code: syncCode.toUpperCase() },
    });

    if (!settings) {
      return NextResponse.json(
        { success: false, error: "同期コードが見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        syncCode: settings.sync_code,
        darkMode: settings.dark_mode,
        cpnMemos: settings.cpn_memos,
        dashboardConfig: settings.dashboard_config,
        monthlyGoal: settings.monthly_goal,
        alertSettings: settings.alert_settings,
        updatedAt: settings.updated_at,
      },
    });
  } catch (error) {
    console.error("Sync GET error:", error);
    return NextResponse.json(
      { success: false, error: "設定の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST: 新しい同期コードを生成、または既存の設定を更新
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, syncCode, settings } = body;

    // 新規同期コード生成
    if (action === "generate") {
      // ユニークなコードが生成されるまでループ
      let newCode = generateSyncCode();
      let attempts = 0;
      while (attempts < 10) {
        const existing = await prisma.user_settings.findUnique({
          where: { sync_code: newCode },
        });
        if (!existing) break;
        newCode = generateSyncCode();
        attempts++;
      }

      const newSettings = await prisma.user_settings.create({
        data: {
          sync_code: newCode,
          dark_mode: settings?.darkMode ?? false,
          cpn_memos: settings?.cpnMemos ?? {},
          dashboard_config: settings?.dashboardConfig ?? {},
          monthly_goal: settings?.monthlyGoal ?? 0,
          alert_settings: settings?.alertSettings ?? {},
        },
      });

      return NextResponse.json({
        success: true,
        syncCode: newSettings.sync_code,
        message: "同期コードを生成しました",
      });
    }

    // 設定を更新
    if (action === "update" && syncCode) {
      const updated = await prisma.user_settings.update({
        where: { sync_code: syncCode.toUpperCase() },
        data: {
          dark_mode: settings?.darkMode,
          cpn_memos: settings?.cpnMemos,
          dashboard_config: settings?.dashboardConfig,
          monthly_goal: settings?.monthlyGoal,
          alert_settings: settings?.alertSettings,
        },
      });

      return NextResponse.json({
        success: true,
        syncCode: updated.sync_code,
        message: "設定を更新しました",
      });
    }

    return NextResponse.json(
      { success: false, error: "無効なアクションです" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Sync POST error:", error);
    return NextResponse.json(
      { success: false, error: "設定の保存に失敗しました" },
      { status: 500 }
    );
  }
}
