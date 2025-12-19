import { NextResponse } from "next/server";
import { getFullAnalysisData } from "@/lib/googleSheets";
import { sendToChatwork } from "@/lib/chatwork";

// Chatwork送信用のメッセージを生成
function generateScheduledMessage(
  data: Awaited<ReturnType<typeof getFullAnalysisData>>
) {
  const now = new Date();
  const dateStr = `${now.getMonth() + 1}/${now.getDate()}`;

  // 媒体別に集計
  const mediaGroups = data.reduce((acc, cpn) => {
    const media = cpn.media === "Meta" ? "FB" : cpn.media;
    if (!acc[media]) {
      acc[media] = { spend: 0, profit: 0, cpns: [] as typeof data };
    }
    acc[media].spend += cpn.spend;
    acc[media].profit += cpn.profit;
    acc[media].cpns.push(cpn);
    return acc;
  }, {} as Record<string, { spend: number; profit: number; cpns: typeof data }>);

  // 全体集計
  const totalSpend = data.reduce((sum, cpn) => sum + cpn.spend, 0);
  const totalProfit = data.reduce((sum, cpn) => sum + cpn.profit, 0);
  const totalRoas = totalSpend > 0 ? (totalProfit / totalSpend + 1) * 100 : 0;

  // メッセージ生成
  let message = `[To:9952259]自動送信犬さん\n`;
  message += `[info][title]【${dateStr} デイリーレポート】自動送信[/title]`;
  message += `\n📊 本日の成績\n`;
  message += `消化: ¥${Math.round(totalSpend).toLocaleString()}\n`;
  message += `利益: ¥${Math.round(totalProfit).toLocaleString()}\n`;
  message += `ROAS: ${totalRoas.toFixed(1)}%\n`;

  // 媒体別サマリー
  message += `\n📱 媒体別\n`;
  for (const [media, stats] of Object.entries(mediaGroups)) {
    const roas = stats.spend > 0 ? (stats.profit / stats.spend + 1) * 100 : 0;
    message += `${media}: ¥${Math.round(stats.profit).toLocaleString()} (ROAS ${roas.toFixed(0)}%)\n`;
  }

  // 好調CPN TOP3
  const topCpns = [...data].sort((a, b) => b.profit - a.profit).slice(0, 3);
  if (topCpns.length > 0) {
    message += `\n🏆 好調CPN TOP3\n`;
    topCpns.forEach((cpn, idx) => {
      const shortName = cpn.cpnName.split("_").slice(-3).join("_");
      message += `${idx + 1}. ${shortName}: ¥${Math.round(cpn.profit).toLocaleString()}\n`;
    });
  }

  // 要注意CPN（利益-10000円以下）
  const warnCpns = data.filter((cpn) => cpn.profit < -10000).slice(0, 5);
  if (warnCpns.length > 0) {
    message += `\n⚠️ 要注意CPN\n`;
    warnCpns.forEach((cpn) => {
      const shortName = cpn.cpnName.split("_").slice(-3).join("_");
      message += `・${shortName}: ¥${Math.round(cpn.profit).toLocaleString()}\n`;
    });
  }

  message += `[/info]`;

  return message;
}

// POSTで手動実行/スケジュール実行
export async function POST(request: Request) {
  try {
    // 認証チェック（Vercel Cronからの呼び出し用）
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    
    // Vercel Cronからの呼び出しの場合は認証をチェック
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // 手動実行の場合は認証不要
      const body = await request.json().catch(() => ({}));
      if (!body.manual) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
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

    // メッセージを生成
    const message = generateScheduledMessage(data);

    // Chatworkに送信
    const apiToken = process.env.CHATWORK_API_TOKEN;
    const roomId = process.env.CHATWORK_ROOM_ID;

    if (!apiToken || !roomId) {
      return NextResponse.json({
        success: false,
        error: "Chatwork設定が見つかりません",
      });
    }

    const result = await sendToChatwork(apiToken, roomId, message);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Chatworkに送信しました",
      messageId: result.messageId,
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
  });
}

