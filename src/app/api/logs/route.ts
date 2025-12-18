import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET: 実行ログを取得
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");

    const logs = await prisma.executionLog.findMany({
      take: limit,
      orderBy: { executedAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      logs,
    });
  } catch (error) {
    console.error("Get logs error:", error);
    return NextResponse.json(
      { success: false, error: "ログの取得に失敗しました" },
      { status: 500 }
    );
  }
}

