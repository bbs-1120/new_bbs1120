import { NextResponse } from "next/server";
import { getDailyTrendData } from "@/lib/googleSheets";
import { google } from "googleapis";

// デバッグ用: デイリーレポートのデータを確認
export async function GET() {
  try {
    // 過去データのスプレッドシートから直接データを取得
    const historicalSpreadsheetId = process.env.GOOGLE_SHEETS_HISTORICAL_SPREADSHEET_ID?.trim();
    
    if (!historicalSpreadsheetId) {
      return NextResponse.json({ error: "GOOGLE_SHEETS_HISTORICAL_SPREADSHEET_ID not configured" });
    }

    // Google Sheets APIクライアントを初期化
    const credentials = JSON.parse(
      Buffer.from(process.env.GOOGLE_SHEETS_CREDENTIALS || "", "base64").toString()
    );
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    // 現在の月のシート名
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const sheetName = `${year}年${month}月`;

    // スプレッドシートからデータを取得（7行目から10行だけ）
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: historicalSpreadsheetId,
      range: `'${sheetName}'!A7:T17`, // 最初の10行だけ
    });

    const rows = response.data.values || [];
    
    // サンプルデータを解析
    const sampleRows = rows.slice(0, 5).map((row, idx) => ({
      rowIndex: idx + 7,
      A_empty: row[0] || "(empty)",
      B_dateKey: row[1] || "(empty)",
      C_date: row[2] || "(empty)",
      D_cpnName: row[3] || "(empty)",
      E_cost: row[4] || "(empty)",
      R_revenue: row[17] || "(empty)",
      columnCount: row.length,
    }));

    // 日別集計データも取得
    const dailyTrend = await getDailyTrendData();

    // 日別の合計を計算
    const dailySummary = dailyTrend.map(day => ({
      date: day.date,
      spend: Math.round(day.spend),
      revenue: Math.round(day.revenue),
      profit: Math.round(day.profit),
      roas: Math.round(day.roas * 10) / 10,
    }));

    return NextResponse.json({
      success: true,
      spreadsheetId: historicalSpreadsheetId,
      sheetName,
      totalRows: rows.length,
      sampleRows,
      dailySummary,
      currentDate: now.toISOString(),
    });
  } catch (error) {
    console.error("Debug daily error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

