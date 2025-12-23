import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

// 招待一覧を取得
export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "管理者権限が必要です" },
        { status: 403 }
      );
    }

    const invites = await prisma.invite.findMany({
      orderBy: { createdAt: "desc" },
    });

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        teamName: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      invites,
      users,
    });
  } catch (error) {
    console.error("Failed to fetch invites:", error);
    return NextResponse.json(
      { success: false, error: "招待一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// 新規招待を作成
export async function POST(request: Request) {
  try {
    const session = await auth();
    
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "管理者権限が必要です" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, role, teamName } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: "メールアドレスは必須です" },
        { status: 400 }
      );
    }

    // 既存ユーザーか確認
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "このメールアドレスは既に登録されています" },
        { status: 400 }
      );
    }

    // 既存の招待があれば削除
    await prisma.invite.deleteMany({
      where: { email },
    });

    // 招待トークンを生成
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7日間有効

    const invite = await prisma.invite.create({
      data: {
        email,
        token,
        role: role || "member",
        teamName: teamName || null,
        expiresAt,
      },
    });

    // 招待URL
    const baseUrl = process.env.NEXTAUTH_URL || "https://adpilot-311489166272.asia-northeast1.run.app";
    const inviteUrl = `${baseUrl}/register?token=${token}`;

    return NextResponse.json({
      success: true,
      invite: {
        ...invite,
        inviteUrl,
      },
    });
  } catch (error) {
    console.error("Failed to create invite:", error);
    return NextResponse.json(
      { success: false, error: "招待の作成に失敗しました" },
      { status: 500 }
    );
  }
}

// 招待を削除
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "管理者権限が必要です" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "招待IDは必須です" },
        { status: 400 }
      );
    }

    await prisma.invite.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "招待を削除しました",
    });
  } catch (error) {
    console.error("Failed to delete invite:", error);
    return NextResponse.json(
      { success: false, error: "招待の削除に失敗しました" },
      { status: 500 }
    );
  }
}

