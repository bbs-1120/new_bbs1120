import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json({
        success: false,
        message: "未ログイン",
        session: null
      });
    }
    
    return NextResponse.json({
      success: true,
      session: {
        user: {
          id: session.user?.id,
          email: session.user?.email,
          name: session.user?.name,
          role: session.user?.role,
          teamName: session.user?.teamName,
        }
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "不明なエラー"
    }, { status: 500 });
  }
}

