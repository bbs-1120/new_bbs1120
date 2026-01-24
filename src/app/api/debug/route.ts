import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET() {
  try {
    const historicalSpreadsheetId = process.env.GOOGLE_SHEETS_HISTORICAL_SPREADSHEET_ID?.trim();
    const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n");
    const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
    
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    
    const sheets = google.sheets({ version: "v4", auth });
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const sheetName = `${year}年${month}月`;
    
    // データを取得
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: historicalSpreadsheetId,
      range: `'${sheetName}'!A7:T100`,
    });
    
    const rows = (response.data.values || []) as string[][];
    const yutaRows = rows.filter(row => (row[3] || "").includes("新規グロース部_悠太"));
    
    return NextResponse.json({
      success: true,
      spreadsheetId: historicalSpreadsheetId,
      sheetName,
      serverTime: now.toISOString(),
      totalRows: rows.length,
      yutaRows: yutaRows.length,
      sampleYuta: yutaRows[0] ? {
        date: yutaRows[0][2],
        cpnName: (yutaRows[0][3] || "").slice(0, 50),
        cost: yutaRows[0][4],
      } : null,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unknown error",
      spreadsheetIdUsed: process.env.GOOGLE_SHEETS_HISTORICAL_SPREADSHEET_ID,
    }, { status: 500 });
  }
}

