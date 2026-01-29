import { NextResponse } from "next/server";

// ======================================
// この機能は完全に無効化されています
// 10:00/11:00の自動送信機能は削除されました
// ======================================

// POSTで手動実行/スケジュール実行 - 無効化済み
export async function POST() {
  return NextResponse.json({
    success: true,
    message: "この機能は無効化されています。定期送信は行われません。",
    sentCount: 0,
    disabled: true,
  });
}

// GETでステータス確認
export async function GET() {
  return NextResponse.json({
    configured: false,
    disabled: true,
    message: "定期送信機能は無効化されています",
  });
}
