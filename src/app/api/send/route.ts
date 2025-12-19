import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateChatworkMessage, sendToChatwork } from "@/lib/chatwork";

// POST: Chatworkに送信
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { resultIds } = body;

    // 設定を取得
    const chatworkRoomIdSetting = await prisma.setting.findUnique({
      where: { key: "chatworkRoomId" },
    });
    const chatworkApiTokenSetting = await prisma.setting.findUnique({
      where: { key: "chatworkApiToken" },
    });
    const ruleVersionSetting = await prisma.setting.findUnique({
      where: { key: "ruleVersion" },
    });

    if (!chatworkRoomIdSetting?.value || !chatworkApiTokenSetting?.value) {
      return NextResponse.json(
        { success: false, error: "Chatwork APIの設定がされていません" },
        { status: 400 }
      );
    }

    // 送信対象の結果を取得
    let results;
    if (resultIds && resultIds.length > 0) {
      results = await prisma.judgmentResult.findMany({
        where: { id: { in: resultIds } },
        include: { media: true },
      });
    } else {
      // 今日の送信対象フラグが立っているものを取得
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      results = await prisma.judgmentResult.findMany({
        where: {
          judgmentDate: today,
          isSendTarget: true,
        },
        include: { media: true },
      });
    }

    if (results.length === 0) {
      return NextResponse.json(
        { success: false, error: "送信対象のCPNがありません" },
        { status: 400 }
      );
    }

    // メッセージを生成
    const message = generateChatworkMessage(results);

    // Chatworkに送信
    const sendResult = await sendToChatwork(
      chatworkApiTokenSetting.value,
      chatworkRoomIdSetting.value,
      message
    );

    if (!sendResult.success) {
      // エラーログを記録
      await prisma.executionLog.create({
        data: {
          executedBy: "中田悠太",
          actionType: "send",
          targetCount: results.length,
          ruleVersion: ruleVersionSetting?.value || "1.0",
          status: "error",
          errorMessage: sendResult.error,
        },
      });

      return NextResponse.json(
        { success: false, error: sendResult.error },
        { status: 500 }
      );
    }

    // 成功ログを記録
    await prisma.executionLog.create({
      data: {
        executedBy: "中田悠太",
        actionType: "send",
        targetCount: results.length,
        ruleVersion: ruleVersionSetting?.value || "1.0",
        status: "success",
      },
    });

    return NextResponse.json({
      success: true,
      messageId: sendResult.messageId,
      sentCount: results.length,
    });
  } catch (error) {
    console.error("Send to Chatwork error:", error);
    return NextResponse.json(
      { success: false, error: "送信に失敗しました" },
      { status: 500 }
    );
  }
}

// GET: プレビュー用メッセージを取得
export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const results = await prisma.judgmentResult.findMany({
      where: {
        judgmentDate: today,
        isSendTarget: true,
      },
      include: { media: true },
    });

    if (results.length === 0) {
      return NextResponse.json({
        success: true,
        message: "送信対象のCPNがありません",
        count: 0,
      });
    }

    const message = generateChatworkMessage(results);

    return NextResponse.json({
      success: true,
      message,
      count: results.length,
    });
  } catch (error) {
    console.error("Get preview error:", error);
    return NextResponse.json(
      { success: false, error: "プレビューの取得に失敗しました" },
      { status: 500 }
    );
  }
}

