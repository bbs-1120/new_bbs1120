import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

async function checkCSV() {
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const historicalSpreadsheetId = "1UxRyauwYSbERBa7q1y-QVLE9hvpJpXgaLovFaGsqaPo";

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  
  try {
    // 全列を確認
    const header = await sheets.spreadsheets.values.get({
      spreadsheetId: historicalSpreadsheetId,
      range: "'2025年12月'!A1:Z1",
    });
    
    console.log("=== ヘッダー行1 ===");
    const h1 = header.data.values?.[0] || [];
    console.log("ヘッダー:", h1);
    
    // 2行目を確認（実際のヘッダーかも）
    const row2 = await sheets.spreadsheets.values.get({
      spreadsheetId: historicalSpreadsheetId,
      range: "'2025年12月'!A2:Z2",
    });
    console.log("\n行2:", row2.data.values?.[0]);
    
    // サンプルデータ全列
    const sample = await sheets.spreadsheets.values.get({
      spreadsheetId: historicalSpreadsheetId,
      range: "'2025年12月'!A324:Z324",
    });
    
    const row = sample.data.values?.[0] || [];
    console.log("\n=== サンプルデータ（行324）全列 ===");
    row.forEach((col, i) => {
      const letter = i < 26 
        ? String.fromCharCode(65 + i) 
        : String.fromCharCode(65 + Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26));
      console.log(`${letter}(${i}): ${col}`);
    });
    
    // 日付の分布を確認
    const allData = await sheets.spreadsheets.values.get({
      spreadsheetId: historicalSpreadsheetId,
      range: "'2025年12月'!C:C",
    });
    
    const dates = new Set();
    const allRows = allData.data.values || [];
    for (const row of allRows) {
      if (row[0] && String(row[0]).match(/^\d{4}[\/\-]\d/)) {
        dates.add(row[0]);
      }
    }
    
    console.log("\n=== 日付一覧（C列）===");
    console.log(Array.from(dates).sort().join(", "));
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

checkCSV();
