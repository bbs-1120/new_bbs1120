import { NextResponse } from "next/server";
import { sendToChatwork } from "@/lib/chatwork";

interface CpnItem {
  cpnName: string;
  media: string;
  profit: number;
}

interface SendRequest {
  cpns: CpnItem[];
}

// 媒体名をChatwork用に変換
function getMediaDisplayName(media: string): string {
  if (media === "Meta") return "FB";
  return media;
}

// POSTでカスタムCPN一覧をChatworkに送信
export async function POST(request: Request) {
  try {
    const body: SendRequest = await request.json();
    const { cpns } = body;

    if (!cpns || cpns.length === 0) {
      return NextResponse.json({
        success: false,
        error: "送信するCPNがありません",
      }, { status: 400 });
    }

    // Chatwork設定を取得
    const apiToken = process.env.CHATWORK_API_TOKEN;
    const roomId = process.env.CHATWORK_ROOM_ID;

    if (!apiToken || !roomId) {
      return NextResponse.json({
        success: false,
        error: "Chatwork設定が見つかりません",
      }, { status: 500 });
    }

    // 媒体別にグループ化
    const mediaGroups: Record<string, CpnItem[]> = {};
    for (const cpn of cpns) {
      const displayMedia = getMediaDisplayName(cpn.media);
      if (!mediaGroups[displayMedia]) {
        mediaGroups[displayMedia] = [];
      }
      mediaGroups[displayMedia].push(cpn);
    }

    // 各媒体ごとにメッセージを生成して送信
    const results: { media: string; success: boolean; messageId?: string; error?: string }[] = [];

    for (const [media, items] of Object.entries(mediaGroups)) {
      // メッセージ生成
      let message = `[To:9952259]自動送信犬さん\n`;
      message += `媒体：${media}\n`;
      message += `処理：追加\n`;
      message += `CP名：\n`;
      items.forEach(item => {
        message += `${item.cpnName}\n`;
      });

      // 送信
      const result = await sendToChatwork(apiToken, roomId, message);
      results.push({
        media,
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      });

      // API制限を避けるため少し待機
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const successCount = results.filter((r) => r.success).length;
    const totalMedia = results.length;

    return NextResponse.json({
      success: successCount > 0,
      message: `${successCount}/${totalMedia}媒体にChatwork送信しました`,
      sentCount: successCount,
      totalCpns: cpns.length,
      results,
      sentAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Custom chatwork send error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GETで設定状況を確認
export async function GET() {
  const apiToken = process.env.CHATWORK_API_TOKEN;
  const roomId = process.env.CHATWORK_ROOM_ID;

  return NextResponse.json({
    configured: !!(apiToken && roomId),
    description: "カスタムCPN一覧をChatwork送信",
  });
}

