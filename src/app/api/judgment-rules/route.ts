import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: ユーザーの判定ルールを取得
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "認証が必要です" },
        { status: 401 }
      );
    }

    const rules = await prisma.member_judgment_rules.findMany({
      where: { user_id: session.user.id },
      orderBy: [{ rule_type: "asc" }, { priority: "desc" }],
    });

    return NextResponse.json({ success: true, rules });
  } catch (error) {
    console.error("Judgment rules GET error:", error);
    return NextResponse.json(
      { success: false, error: "ルールの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST: 判定ルールを作成
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "認証が必要です" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { rule_type, rule_name, priority, conditions, is_active } = body;

    if (!rule_type || !rule_name || !conditions) {
      return NextResponse.json(
        { success: false, error: "必須項目が不足しています" },
        { status: 400 }
      );
    }

    const rule = await prisma.member_judgment_rules.create({
      data: {
        user_id: session.user.id,
        rule_type,
        rule_name,
        priority: priority || 0,
        conditions,
        is_active: is_active !== false,
      },
    });

    return NextResponse.json({ success: true, rule });
  } catch (error) {
    console.error("Judgment rules POST error:", error);
    return NextResponse.json(
      { success: false, error: "ルールの作成に失敗しました" },
      { status: 500 }
    );
  }
}

// PUT: 判定ルールを更新
export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "認証が必要です" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, rule_type, rule_name, priority, conditions, is_active } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ルールIDが必要です" },
        { status: 400 }
      );
    }

    // ユーザーのルールかどうか確認
    const existingRule = await prisma.member_judgment_rules.findFirst({
      where: { id, user_id: session.user.id },
    });

    if (!existingRule) {
      return NextResponse.json(
        { success: false, error: "ルールが見つかりません" },
        { status: 404 }
      );
    }

    const rule = await prisma.member_judgment_rules.update({
      where: { id },
      data: {
        rule_type: rule_type || existingRule.rule_type,
        rule_name: rule_name || existingRule.rule_name,
        priority: priority ?? existingRule.priority,
        conditions: conditions || existingRule.conditions,
        is_active: is_active ?? existingRule.is_active,
      },
    });

    return NextResponse.json({ success: true, rule });
  } catch (error) {
    console.error("Judgment rules PUT error:", error);
    return NextResponse.json(
      { success: false, error: "ルールの更新に失敗しました" },
      { status: 500 }
    );
  }
}

// DELETE: 判定ルールを削除
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "認証が必要です" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ルールIDが必要です" },
        { status: 400 }
      );
    }

    // ユーザーのルールかどうか確認
    const existingRule = await prisma.member_judgment_rules.findFirst({
      where: { id, user_id: session.user.id },
    });

    if (!existingRule) {
      return NextResponse.json(
        { success: false, error: "ルールが見つかりません" },
        { status: 404 }
      );
    }

    await prisma.member_judgment_rules.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Judgment rules DELETE error:", error);
    return NextResponse.json(
      { success: false, error: "ルールの削除に失敗しました" },
      { status: 500 }
    );
  }
}
