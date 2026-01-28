import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET: 除外リストを取得
export async function GET() {
  try {
    const exclusions = await prisma.auto_stop_exclusions.findMany({
      orderBy: { excluded_at: "desc" },
    });

    return NextResponse.json({
      success: true,
      exclusions,
      count: exclusions.length,
    });
  } catch (error) {
    console.error("Exclusions GET error:", error);
    return NextResponse.json(
      { success: false, error: "取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST: 除外リストに追加
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "認証が必要です" }, { status: 401 });
    }

    const body = await request.json();
    const { cpnName, cpnKey, reason } = body;

    if (!cpnName) {
      return NextResponse.json({ success: false, error: "cpnNameが必要です" }, { status: 400 });
    }

    // 既存の除外をチェック
    const existing = await prisma.auto_stop_exclusions.findUnique({
      where: { cpn_name: cpnName },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        message: "既に除外リストに存在します",
        exclusion: existing,
      });
    }

    const exclusion = await prisma.auto_stop_exclusions.create({
      data: {
        cpn_name: cpnName,
        cpn_key: cpnKey || null,
        reason: reason || null,
        excluded_by: session.user.name || session.user.email || "unknown",
      },
    });

    return NextResponse.json({
      success: true,
      exclusion,
    });
  } catch (error) {
    console.error("Exclusions POST error:", error);
    return NextResponse.json(
      { success: false, error: "追加に失敗しました" },
      { status: 500 }
    );
  }
}

// DELETE: 除外リストから削除
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "認証が必要です" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cpnName = searchParams.get("cpnName");

    if (!cpnName) {
      return NextResponse.json({ success: false, error: "cpnNameが必要です" }, { status: 400 });
    }

    await prisma.auto_stop_exclusions.deleteMany({
      where: { cpn_name: cpnName },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Exclusions DELETE error:", error);
    return NextResponse.json(
      { success: false, error: "削除に失敗しました" },
      { status: 500 }
    );
  }
}
