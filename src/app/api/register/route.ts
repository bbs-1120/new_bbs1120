import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// 招待情報を取得
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { success: false, error: "トークンが必要です" },
        { status: 400 }
      );
    }

    const invite = await prisma.invite.findUnique({
      where: { token },
    });

    if (!invite) {
      return NextResponse.json(
        { success: false, error: "招待が見つかりません" },
        { status: 404 }
      );
    }

    if (invite.usedAt) {
      return NextResponse.json(
        { success: false, error: "この招待は既に使用されています" },
        { status: 400 }
      );
    }

    if (new Date() > invite.expiresAt) {
      return NextResponse.json(
        { success: false, error: "招待の有効期限が切れています" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      invite: {
        email: invite.email,
        role: invite.role,
        teamName: invite.teamName,
      },
    });
  } catch (error) {
    console.error("Failed to get invite:", error);
    return NextResponse.json(
      { success: false, error: "招待情報の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// ユーザー登録
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, name, password } = body;

    if (!token || !name || !password) {
      return NextResponse.json(
        { success: false, error: "必須項目を入力してください" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: "パスワードは8文字以上で入力してください" },
        { status: 400 }
      );
    }

    // 招待を確認
    const invite = await prisma.invite.findUnique({
      where: { token },
    });

    if (!invite) {
      return NextResponse.json(
        { success: false, error: "招待が見つかりません" },
        { status: 404 }
      );
    }

    if (invite.usedAt) {
      return NextResponse.json(
        { success: false, error: "この招待は既に使用されています" },
        { status: 400 }
      );
    }

    if (new Date() > invite.expiresAt) {
      return NextResponse.json(
        { success: false, error: "招待の有効期限が切れています" },
        { status: 400 }
      );
    }

    // 既存ユーザーか確認
    const existingUser = await prisma.user.findUnique({
      where: { email: invite.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "このメールアドレスは既に登録されています" },
        { status: 400 }
      );
    }

    // パスワードをハッシュ化
    const hashedPassword = await bcrypt.hash(password, 10);

    // ユーザーを作成
    const user = await prisma.user.create({
      data: {
        email: invite.email,
        name,
        password: hashedPassword,
        role: invite.role,
        teamName: invite.teamName,
      },
    });

    // 招待を使用済みにする
    await prisma.invite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        teamName: user.teamName,
      },
    });
  } catch (error) {
    console.error("Failed to register:", error);
    return NextResponse.json(
      { success: false, error: "登録に失敗しました" },
      { status: 500 }
    );
  }
}

