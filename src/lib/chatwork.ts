import { formatDate, formatCurrency, formatPercentage } from "./utils";

interface JudgmentResult {
  cpnName: string;
  media: { name: string };
  judgment: string;
  todayProfit: number | { toNumber: () => number };
  profit7Days: number | { toNumber: () => number };
  roas7Days: number | { toNumber: () => number };
  reasons: string[];
  isRe: boolean;
}

interface SimpleCpnResult {
  cpnName: string;
  media: string;
  judgment: string;
}

// Decimalの値を数値に変換
function toNumber(value: number | { toNumber: () => number }): number {
  if (typeof value === "number") return value;
  return value.toNumber();
}

/**
 * 仕分け結果からChatworkメッセージを生成
 */
export function generateChatworkMessage(results: JudgmentResult[]): string {
  const today = formatDate(new Date());
  
  // 判定結果でグループ化
  const grouped = {
    stop: results.filter((r) => r.judgment === "停止"),
    replace: results.filter((r) => r.judgment === "作り替え"),
    continue: results.filter((r) => r.judgment === "継続"),
    check: results.filter((r) => r.judgment === "要確認"),
  };

  let message = `[info][title]【本日のCPN仕分け】${today}[/title]`;

  // 停止（Reあり）
  if (grouped.stop.length > 0) {
    message += "\n■ 停止（Reあり）\n";
    for (const r of grouped.stop) {
      const todayProfit = toNumber(r.todayProfit);
      const profit7Days = toNumber(r.profit7Days);
      const roas7Days = toNumber(r.roas7Days);
      message += `${r.cpnName}｜${formatCurrency(todayProfit)}｜${formatCurrency(profit7Days)}｜${formatPercentage(roas7Days)}｜${r.reasons.join(", ")}\n`;
    }
  }

  // 作り替え（Reなし）
  if (grouped.replace.length > 0) {
    message += "\n■ 作り替え（Reなし）\n";
    for (const r of grouped.replace) {
      const todayProfit = toNumber(r.todayProfit);
      const profit7Days = toNumber(r.profit7Days);
      const roas7Days = toNumber(r.roas7Days);
      message += `${r.cpnName}｜${formatCurrency(todayProfit)}｜${formatCurrency(profit7Days)}｜${formatPercentage(roas7Days)}｜${r.reasons.join(", ")}\n`;
    }
  }

  // 継続
  if (grouped.continue.length > 0) {
    message += "\n■ 継続\n";
    for (const r of grouped.continue) {
      const todayProfit = toNumber(r.todayProfit);
      const profit7Days = toNumber(r.profit7Days);
      const roas7Days = toNumber(r.roas7Days);
      message += `${r.cpnName}｜${formatCurrency(todayProfit)}｜${formatCurrency(profit7Days)}｜${formatPercentage(roas7Days)}\n`;
    }
  }

  // 要確認
  if (grouped.check.length > 0) {
    message += "\n■ 要確認\n";
    for (const r of grouped.check) {
      const todayProfit = toNumber(r.todayProfit);
      const profit7Days = toNumber(r.profit7Days);
      const roas7Days = toNumber(r.roas7Days);
      message += `${r.cpnName}｜${formatCurrency(todayProfit)}｜${formatCurrency(profit7Days)}｜${formatPercentage(roas7Days)}｜${r.reasons.join(", ")}\n`;
    }
  }

  message += "\n▼詳細\n管理画面URL[/info]";

  return message;
}

/**
 * 継続CPNを媒体別にグループ化したメッセージを生成
 */
export function generateContinueMessageByMedia(results: SimpleCpnResult[]): { media: string; message: string }[] {
  // 継続のみをフィルタ
  const continueResults = results.filter((r) => r.judgment === "継続");

  // 媒体別にグループ化
  const mediaGroups: Record<string, string[]> = {};
  for (const r of continueResults) {
    // TikTokとPangleを統合表示
    let mediaKey = r.media;
    if (r.media === "Pangle") {
      mediaKey = "TikTok"; // Pangleの場合もTikTokとして表示
    }
    
    if (!mediaGroups[mediaKey]) {
      mediaGroups[mediaKey] = [];
    }
    mediaGroups[mediaKey].push(r.cpnName);
  }

  // 媒体別メッセージを生成
  const messages: { media: string; message: string }[] = [];
  
  for (const [media, cpnNames] of Object.entries(mediaGroups)) {
    let message = `媒体：${media}\n`;
    message += `処理：追加\n`;
    message += `CP名：\n\n`;
    message += cpnNames.join("\n");
    
    messages.push({ media, message });
  }

  return messages;
}

/**
 * Chatworkにメッセージを送信
 */
export async function sendToChatwork(
  apiToken: string,
  roomId: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await fetch(
      `https://api.chatwork.com/v2/rooms/${roomId}/messages`,
      {
        method: "POST",
        headers: {
          "X-ChatWorkToken": apiToken,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `body=${encodeURIComponent(message)}`,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Chatwork API error: ${response.status} ${errorText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      messageId: data.message_id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * エラー通知をChatworkに送信
 */
export async function sendErrorNotification(
  errorType: "api_error" | "anomaly" | "budget_change" | "status_change" | "system",
  errorMessage: string,
  details?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const apiToken = process.env.CHATWORK_API_TOKEN;
  const roomId = process.env.CHATWORK_ERROR_ROOM_ID;

  if (!apiToken || !roomId) {
    console.error("Chatwork error notification: Missing API token or room ID");
    return { success: false, error: "Chatwork設定が不完全です" };
  }

  const now = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  
  const errorTypeLabels: Record<string, string> = {
    api_error: "APIエラー",
    anomaly: "異常検知",
    budget_change: "予算変更エラー",
    status_change: "ステータス変更エラー",
    system: "システムエラー",
  };

  let message = `[toall]\n\n`;
  message += `エラーが発生しています。\n`;
  message += `以下エラー内容\n↓\n\n`;
  message += `【${errorTypeLabels[errorType] || "エラー"}】\n`;
  message += `発生日時：${now}\n`;
  message += `内容：${errorMessage}\n`;
  
  if (details) {
    message += `\n詳細：\n`;
    for (const [key, value] of Object.entries(details)) {
      message += `${key}: ${JSON.stringify(value)}\n`;
    }
  }

  return sendToChatwork(apiToken, roomId, message);
}

/**
 * 異常検知アラートをChatworkに送信
 */
export async function sendAnomalyAlert(
  cpnName: string,
  media: string,
  anomalyDetails: string
): Promise<{ success: boolean; error?: string }> {
  const apiToken = process.env.CHATWORK_API_TOKEN;
  const roomId = process.env.CHATWORK_ERROR_ROOM_ID;

  if (!apiToken || !roomId) {
    return { success: false, error: "Chatwork設定が不完全です" };
  }

  const now = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });

  let message = `[toall]\n\n`;
  message += `エラーが発生しています。\n`;
  message += `以下エラー内容\n↓\n\n`;
  message += `【異常検知アラート】\n`;
  message += `検知日時：${now}\n`;
  message += `媒体：${media}\n`;
  message += `CPN：${cpnName}\n`;
  message += `\n${anomalyDetails}\n`;

  return sendToChatwork(apiToken, roomId, message);
}

