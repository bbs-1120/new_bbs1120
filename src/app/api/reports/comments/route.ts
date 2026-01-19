import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface CommentData {
  todo?: string;
  growth?: string;
  shrink?: string;
}

// コメント取得
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const weekKey = searchParams.get("week");
    const memberName = searchParams.get("member");
    
    if (!weekKey || !memberName) {
      return NextResponse.json({
        success: false,
        error: "week and member are required",
      }, { status: 400 });
    }
    
    const comment = await prisma.weeklyReportComment.findUnique({
      where: {
        weekKey_memberName: {
          weekKey,
          memberName,
        },
      },
    });
    
    if (comment) {
      return NextResponse.json({
        success: true,
        comments: {
          todo: comment.todoComment || "",
          growth: comment.growthComment || "",
          shrink: comment.shrinkComment || "",
        },
      });
    }
    
    return NextResponse.json({
      success: true,
      comments: {
        todo: "",
        growth: "",
        shrink: "",
      },
    });
  } catch (error) {
    console.error("Get comments error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}

// コメント保存
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { week, member, comments } = body as {
      week: string;
      member: string;
      comments: CommentData;
    };
    
    if (!week || !member) {
      return NextResponse.json({
        success: false,
        error: "week and member are required",
      }, { status: 400 });
    }
    
    // Upsert（存在すれば更新、なければ作成）
    const result = await prisma.weeklyReportComment.upsert({
      where: {
        weekKey_memberName: {
          weekKey: week,
          memberName: member,
        },
      },
      update: {
        todoComment: comments.todo || null,
        growthComment: comments.growth || null,
        shrinkComment: comments.shrink || null,
      },
      create: {
        weekKey: week,
        memberName: member,
        todoComment: comments.todo || null,
        growthComment: comments.growth || null,
        shrinkComment: comments.shrink || null,
      },
    });
    
    return NextResponse.json({
      success: true,
      id: result.id,
    });
  } catch (error) {
    console.error("Save comments error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}
