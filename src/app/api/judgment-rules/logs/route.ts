import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: ルール関連のログを取得
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "認証が必要です" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");

    // 自分のログのみ取得（ルール関連と判定更新）
    const userName = session.user.teamName || session.user.name || "";
    
    const logs = await prisma.execution_logs.findMany({
      where: {
        OR: [
          { action_type: { startsWith: "rule_" } },
          { action_type: "judgment_refresh" },
        ],
        executed_by: userName,
      },
      orderBy: { executed_at: "desc" },
      take: limit,
    });

    return NextResponse.json({ success: true, logs });
  } catch (error) {
    console.error("Judgment rules logs error:", error);
    return NextResponse.json(
      { success: false, error: "ログの取得に失敗しました" },
      { status: 500 }
    );
  }
}
