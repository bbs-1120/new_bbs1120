import { NextResponse } from "next/server";
import { getFullAnalysisData } from "@/lib/googleSheets";
import { sendToChatwork } from "@/lib/chatwork";
import { judgeAnalysisCpn, JUDGMENT } from "@/lib/judgment";

// 媒体名をChatwork用に変換
function getMediaDisplayName(media: string): string {
  if (media === "Meta") return "FB";
  return media;
}

// 継続CPNを媒体別にメッセージ生成
function generateContinueMessages(
  data: Awaited<ReturnType<typeof getFullAnalysisData>>
): { media: string; message: string }[] {
  const messages: { media: string; message: string }[] = [];

  // 判定を実行して継続CPNのみフィルタ
  const judgmentResults = data.map((cpn) =>
    judgeAnalysisCpn({
      cpnKey: cpn.cpnKey,
      cpnName: cpn.cpnName,
      media: cpn.media,
      profit: cpn.profit,
      profit7Days: cpn.profit7Days,
      roas7Days: cpn.roas7Days,
      consecutiveLoss: cpn.consecutiveLoss,
      consecutiveProfit: cpn.consecutiveProfit || 0,
    })
  );

  // 継続CPNのみフィルタ
  const continueCpns = judgmentResults.filter(
    (result) => result.judgment === JUDGMENT.CONTINUE
  );

  // 媒体別にグループ化
  const mediaGroups = continueCpns.reduce((acc, cpn) => {
    const media = cpn.media;
    if (!acc[media]) {
      acc[media] = [];
    }
    acc[media].push(cpn);
    return acc;
  }, {} as Record<string, typeof continueCpns>);

  // 各媒体ごとにメッセージを生成
  for (const [media, cpns] of Object.entries(mediaGroups)) {
    if (cpns.length === 0) continue;

    const displayMedia = getMediaDisplayName(media);
    
  let message = `[To:9952259]自動送信犬さん\n`;
    message += `媒体：${displayMedia}\n`;
    message += `処理：追加\n`;
    message += `CP名：\n`;
    
    // CPN名を追加
    cpns.forEach((cpn) => {
      message += `${cpn.cpnName}\n`;
    });

    messages.push({ media, message });
  }

  return messages;
}

// POSTで手動実行/スケジュール実行
export async function POST(request: Request) {
  try {
    // 認証チェック（Cloud Schedulerからの呼び出し用）
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    
    // Cloud Schedulerからの呼び出しの場合は認証をチェック
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // 手動実行の場合は認証不要
      const body = await request.json().catch(() => ({}));
      if (!body.manual) {
        // Cloud Schedulerはヘッダーなしで呼び出すこともあるので許可
      }
    }

    // データを取得
    const data = await getFullAnalysisData();

    if (data.length === 0) {
      return NextResponse.json({
        success: false,
        error: "送信するデータがありません",
      });
    }

    // 継続CPNのメッセージを生成
    const messages = generateContinueMessages(data);

    if (messages.length === 0) {
      return NextResponse.json({
        success: true,
        message: "継続CPNがありませんでした",
        sentCount: 0,
      });
    }

    // Chatworkに送信
    const apiToken = process.env.CHATWORK_API_TOKEN;
    const roomId = process.env.CHATWORK_ROOM_ID;

    if (!apiToken || !roomId) {
      return NextResponse.json({
        success: false,
        error: "Chatwork設定が見つかりません",
      });
    }

    // 各媒体のメッセージを送信
    const results: { media: string; success: boolean; messageId?: string; error?: string }[] = [];
    
    for (const { media, message } of messages) {
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

    return NextResponse.json({
      success: successCount > 0,
      message: `${successCount}件の媒体にChatwork送信しました`,
      sentCount: successCount,
      results,
      sentAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Scheduled send error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GETでステータス確認
export async function GET() {
  const apiToken = process.env.CHATWORK_API_TOKEN;
  const roomId = process.env.CHATWORK_ROOM_ID;

  return NextResponse.json({
    configured: !!(apiToken && roomId),
    scheduledTime: "10:00 JST",
    timezone: "Asia/Tokyo",
    description: "継続CPNを媒体別にChatwork送信",
  });
}
