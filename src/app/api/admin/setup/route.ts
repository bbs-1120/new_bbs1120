import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// 初期管理者ユーザーを作成（一度だけ実行可能）
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name, setupKey } = body;

    // セットアップキーで認証（環境変数で設定）
    const validSetupKey = process.env.ADMIN_SETUP_KEY || "shibuya-ad-admin-2025";
    if (setupKey !== validSetupKey) {
      return NextResponse.json(
        { success: false, error: "セットアップキーが無効です" },
        { status: 403 }
      );
    }

    if (!email || !password || !name) {
      return NextResponse.json(
        { success: false, error: "全ての項目を入力してください" },
        { status: 400 }
      );
    }

    // 既存の管理者が存在するか確認
    const existingAdmin = await prisma.user.findFirst({
      where: { role: "admin" },
    });

    if (existingAdmin) {
      return NextResponse.json(
        { success: false, error: "管理者は既に存在します" },
        { status: 400 }
      );
    }

    // パスワードをハッシュ化
    const hashedPassword = await bcrypt.hash(password, 10);

    // 管理者ユーザーを作成
    const admin = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: "admin",
        teamName: null, // 管理者は全CPN閲覧可能
      },
    });

    return NextResponse.json({
      success: true,
      message: "管理者ユーザーを作成しました",
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Failed to setup admin:", error);
    return NextResponse.json(
      { success: false, error: "管理者の作成に失敗しました" },
      { status: 500 }
    );
  }
}

// 管理者が存在するか確認
export async function GET() {
  try {
    const existingAdmin = await prisma.user.findFirst({
      where: { role: "admin" },
    });

    return NextResponse.json({
      success: true,
      adminExists: !!existingAdmin,
    });
  } catch (error) {
    console.error("Failed to check admin:", error);
    return NextResponse.json(
      { success: false, error: "確認に失敗しました" },
      { status: 500 }
    );
  }
}

