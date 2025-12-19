// LINE Notify API
const LINE_NOTIFY_TOKEN = process.env.LINE_NOTIFY_TOKEN;

export interface LineNotifyOptions {
  message: string;
  stickerPackageId?: number;
  stickerId?: number;
}

export async function sendLineNotify(options: LineNotifyOptions): Promise<boolean> {
  if (!LINE_NOTIFY_TOKEN) {
    console.error("LINE_NOTIFY_TOKEN is not set");
    return false;
  }

  try {
    const params = new URLSearchParams();
    params.append("message", options.message);
    
    if (options.stickerPackageId && options.stickerId) {
      params.append("stickerPackageId", options.stickerPackageId.toString());
      params.append("stickerId", options.stickerId.toString());
    }

    const response = await fetch("https://notify-api.line.me/api/notify", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LINE_NOTIFY_TOKEN}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("LINE Notify error:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("LINE Notify error:", error);
    return false;
  }
}

// エラー通知用のフォーマット済みメッセージ
export async function sendErrorNotification(
  errorType: string,
  errorMessage: string,
  details?: string
): Promise<boolean> {
  const timestamp = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  
  const message = `
🚨 GrowthDeck エラー通知

【種類】${errorType}
【時刻】${timestamp}
【内容】${errorMessage}
${details ? `【詳細】${details}` : ""}

▶ 確認: https://adpilot-311489166272.asia-northeast1.run.app
`;

  return sendLineNotify({ 
    message,
    stickerPackageId: 446,  // 警告系スタンプ
    stickerId: 2027
  });
}

// 異常検知通知用
export async function sendAnomalyNotification(
  anomalyType: string,
  cpnName: string,
  currentValue: number,
  previousValue: number,
  changePercent: number
): Promise<boolean> {
  const timestamp = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  const direction = changePercent > 0 ? "📈 急上昇" : "📉 急下降";
  
  const message = `
${direction} 異常検知アラート

【種類】${anomalyType}
【CPN】${cpnName}
【変化】${previousValue.toLocaleString()} → ${currentValue.toLocaleString()}
【変化率】${changePercent > 0 ? "+" : ""}${changePercent.toFixed(1)}%
【時刻】${timestamp}

▶ 確認: https://adpilot-311489166272.asia-northeast1.run.app/analysis
`;

  return sendLineNotify({ message });
}

// 日次サマリー通知用
export async function sendDailySummaryNotification(
  profit: number,
  spend: number,
  roas: number,
  topCpn: string,
  worstCpn: string
): Promise<boolean> {
  const profitEmoji = profit >= 0 ? "💰" : "📉";
  const roasEmoji = roas >= 100 ? "✅" : "⚠️";
  
  const message = `
📊 GrowthDeck 日次レポート

${profitEmoji} 本日利益: ¥${profit.toLocaleString()}
💸 消化: ¥${spend.toLocaleString()}
${roasEmoji} ROAS: ${roas.toFixed(1)}%

🏆 TOP CPN: ${topCpn}
⚠️ WORST CPN: ${worstCpn}

▶ 詳細: https://adpilot-311489166272.asia-northeast1.run.app/analysis
`;

  return sendLineNotify({ message });
}

