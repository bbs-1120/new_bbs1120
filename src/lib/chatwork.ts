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

