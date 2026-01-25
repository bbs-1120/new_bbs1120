import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getFullAnalysisData } from "@/lib/googleSheets";

interface StopRuleConditions {
  spendMin?: number;
  mcvMax?: number;
  cvMax?: number;
  cvMin?: number;
  roasMax?: number;
  profitMax?: number;
  consecutiveLossMin?: number;
}

// GET: ルール一覧、案件リスト、停止履歴を取得
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeProjects = searchParams.get("projects") === "true";
    const includeHistory = searchParams.get("history") === "true";
    
    // ルールを取得（優先度順）
    const dbRules = await prisma.auto_stop_rules.findMany({
      orderBy: { priority: "asc" },
    });
    
    const rules = dbRules.map(r => ({
      id: r.id,
      memberName: r.member_name || "全員",
      projectName: r.project_name || "全案件",
      conditions: (r.conditions as StopRuleConditions) || {},
      isActive: r.is_active,
      priority: r.priority,
      createdBy: r.member_name || "不明",
      createdAt: r.created_at.toISOString(),
    }));
    
    // 案件リストを取得（チームで運用中の案件）
    let projects: string[] = [];
    let members: string[] = [];
    
    if (includeProjects) {
      try {
        const allData = await getFullAnalysisData();
        const projectSet = new Set<string>();
        const memberSet = new Set<string>();
        
        for (const row of allData) {
          const cpnName = row.cpnName || "";
          
          // メンバー抽出
          const memberMatch = cpnName.match(/新規グロース部_([^_]+)_/);
          if (memberMatch) {
            memberSet.add(memberMatch[1]);
          }
          
          // 案件抽出
          const projectMatch = cpnName.match(/新規グロース部_[^_]+_([^_]+)_/);
          if (projectMatch) {
            projectSet.add(projectMatch[1]);
          }
        }
        
        projects = Array.from(projectSet).sort();
        members = Array.from(memberSet).sort();
      } catch (error) {
        console.error("Failed to fetch analysis data:", error);
        // フォールバック: 既知のメンバーリストを返す
        members = ["悠太", "圭市", "正弥", "祐輝"];
        projects = [];
      }
      
      // メンバーが取得できなかった場合のフォールバック
      if (members.length === 0) {
        members = ["悠太", "圭市", "正弥", "祐輝"];
      }
    }
    
    // 停止履歴を取得
    let history: {
      id: string;
      cpnName: string;
      media: string;
      memberName: string;
      projectName: string;
      ruleName: string;
      conditions: StopRuleConditions;
      metrics: Record<string, number>;
      stoppedAt: string;
      status: string;
    }[] = [];
    
    if (includeHistory) {
      const dbHistory = await prisma.auto_stop_history.findMany({
        orderBy: { stopped_at: "desc" },
        take: 100,
      });
      
      history = dbHistory.map(h => ({
        id: h.id,
        cpnName: h.cpn_name,
        media: h.media,
        memberName: h.member_name,
        projectName: h.project_name,
        ruleName: h.rule_name,
        conditions: (h.conditions as StopRuleConditions) || {},
        metrics: (h.metrics as Record<string, number>) || {},
        stoppedAt: h.stopped_at.toISOString(),
        status: h.status,
      }));
    }
    
    return NextResponse.json({ 
      success: true, 
      rules,
      projects,
      members,
      history,
    });
  } catch (error) {
    console.error("Auto-stop rules GET error:", error);
    return NextResponse.json(
      { success: false, error: "ルールの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST: ルールを作成
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "認証が必要です" }, { status: 401 });
    }
    
    const body = await request.json();
    const { memberName, projectName, conditions, priority } = body;
    
    if (!memberName || !projectName) {
      return NextResponse.json({ success: false, error: "メンバーと案件を選択してください" }, { status: 400 });
    }
    
    // 優先度が指定されていない場合、最大値+1を設定
    let finalPriority = priority;
    if (finalPriority === undefined) {
      const maxPriority = await prisma.auto_stop_rules.aggregate({
        _max: { priority: true },
      });
      finalPriority = (maxPriority._max.priority || 0) + 1;
    }
    
    await prisma.auto_stop_rules.create({
      data: {
        rule_name: `${memberName} - ${projectName}`,
        priority: finalPriority,
        project_name: projectName,
        member_name: memberName,
        media: "all",
        conditions: conditions || {},
        is_active: true,
        updated_at: new Date(),
      },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Auto-stop rules POST error:", error);
    return NextResponse.json(
      { success: false, error: "ルールの保存に失敗しました" },
      { status: 500 }
    );
  }
}

// PUT: ルールを更新（ON/OFF切り替え、優先度変更）
export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "認証が必要です" }, { status: 401 });
    }
    
    const body = await request.json();
    const { id, isActive, priority, reorderRules } = body;
    
    // 一括で優先度を更新
    if (reorderRules && Array.isArray(reorderRules)) {
      for (const rule of reorderRules) {
        await prisma.auto_stop_rules.update({
          where: { id: rule.id },
          data: { priority: rule.priority, updated_at: new Date() },
        });
      }
      return NextResponse.json({ success: true });
    }
    
    if (!id) {
      return NextResponse.json({ success: false, error: "IDが指定されていません" }, { status: 400 });
    }
    
    const updateData: { is_active?: boolean; priority?: number; updated_at: Date } = {
      updated_at: new Date(),
    };
    
    if (isActive !== undefined) updateData.is_active = isActive;
    if (priority !== undefined) updateData.priority = priority;
    
    await prisma.auto_stop_rules.update({
      where: { id },
      data: updateData,
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Auto-stop rules PUT error:", error);
    return NextResponse.json(
      { success: false, error: "ルールの更新に失敗しました" },
      { status: 500 }
    );
  }
}

// DELETE: ルールを削除
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
    
    await prisma.auto_stop_rules.delete({
      where: { id },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Auto-stop rules DELETE error:", error);
    return NextResponse.json(
      { success: false, error: "ルールの削除に失敗しました" },
      { status: 500 }
    );
  }
}
