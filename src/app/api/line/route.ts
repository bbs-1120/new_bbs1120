import { NextResponse } from "next/server";
import { sendLineNotify, sendErrorNotification, sendDailySummaryNotification } from "@/lib/line";

// LINE通知テスト & 手動送信
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, message, errorType, errorMessage, details, profit, spend, roas, topCpn, worstCpn } = body;

    let success = false;

    switch (type) {
      case "test":
        success = await sendLineNotify({ 
          message: message || "\n🔔 AdPilot LINE通知テスト\n\n接続成功しました！" 
        });
        break;

      case "error":
        success = await sendErrorNotification(
          errorType || "システムエラー",
          errorMessage || "不明なエラー",
          details
        );
        break;

      case "daily":
        success = await sendDailySummaryNotification(
          profit || 0,
          spend || 0,
          roas || 0,
          topCpn || "-",
          worstCpn || "-"
        );
        break;

      case "custom":
        success = await sendLineNotify({ message: message || "通知" });
        break;

      default:
        return NextResponse.json({ success: false, error: "Invalid type" }, { status: 400 });
    }

    return NextResponse.json({ success });
  } catch (error) {
    console.error("LINE API error:", error);
    return NextResponse.json({ success: false, error: "Failed to send LINE notification" }, { status: 500 });
  }
}

// LINE通知設定の確認
export async function GET() {
  const hasToken = !!process.env.LINE_NOTIFY_TOKEN;
  
  return NextResponse.json({
    configured: hasToken,
    message: hasToken ? "LINE Notify is configured" : "LINE_NOTIFY_TOKEN is not set"
  });
}

