import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullAnalysisData } from "@/lib/googleSheets";
import { auth } from "@/lib/auth";

// POST: 除外設定を追加
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "認証が必要です" }, { status: 401 });
    }
    
    const body = await request.json();
    const { cpnKeys, reason } = body;
    
    if (!cpnKeys || !Array.isArray(cpnKeys) || cpnKeys.length === 0) {
      return NextResponse.json({ success: false, error: "CPNが指定されていません" }, { status: 400 });
    }
    
    // CPN情報を取得
    const allData = await getFullAnalysisData();
    const cpnMap = new Map(allData.map(c => [c.cpnKey, c.cpnName]));
    
    // 除外設定を追加
    let addedCount = 0;
    for (const cpnKey of cpnKeys) {
      const cpnName = cpnMap.get(cpnKey) || cpnKey;
      
      // 既存チェック
      const existing = await prisma.auto_stop_exclusions.findFirst({
        where: { cpn_name: cpnName },
      });
      
      if (existing) {
        // 更新
        await prisma.auto_stop_exclusions.update({
          where: { id: existing.id },
          data: {
            reason: reason || "",
            cpn_key: cpnKey,
          },
        });
      } else {
        // 新規作成
        await prisma.auto_stop_exclusions.create({
          data: {
            cpn_name: cpnName,
            cpn_key: cpnKey,
            reason: reason || "",
            excluded_by: session.user.id || "system",
          },
        });
      }
      addedCount++;
    }
    
    return NextResponse.json({ success: true, count: addedCount });
  } catch (error) {
    console.error("Auto-stop exclusions POST error:", error);
    return NextResponse.json(
      { success: false, error: "除外設定の保存に失敗しました" },
      { status: 500 }
    );
  }
}

// DELETE: 除外設定を削除
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "認証が必要です" }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return NextResponse.json({ success: false, error: "IDが指定されていません" }, { status: 400 });
    }
    
    await prisma.auto_stop_exclusions.delete({
      where: { id },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Auto-stop exclusions DELETE error:", error);
    return NextResponse.json(
      { success: false, error: "除外設定の削除に失敗しました" },
      { status: 500 }
    );
  }
}
