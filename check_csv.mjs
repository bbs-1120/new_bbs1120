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
    // シート一覧を取得
    const meta = await sheets.spreadsheets.get({ spreadsheetId: historicalSpreadsheetId });
    console.log("スプレッドシート名:", meta.data.properties?.title);
    
    const sheetNames = meta.data.sheets?.map(s => s.properties?.title) || [];
    console.log("\nシート一覧:");
    sheetNames.forEach((name, i) => console.log(`  ${i+1}. ${name}`));
    
    // 最初のシートのヘッダーを確認
    const firstSheet = sheetNames[0];
    console.log(`\n=== ${firstSheet} ヘッダー ===`);
    
    const header = await sheets.spreadsheets.values.get({
      spreadsheetId: historicalSpreadsheetId,
      range: `'${firstSheet}'!A1:Z1`,
    });
    
    const h = header.data.values?.[0] || [];
    h.forEach((col, i) => {
      const letter = i < 26 
        ? String.fromCharCode(65 + i) 
        : String.fromCharCode(65 + Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26));
      console.log(`${letter}(${i}): ${col}`);
    });
    
    // データ確認
    const data = await sheets.spreadsheets.values.get({
      spreadsheetId: historicalSpreadsheetId,
      range: `'${firstSheet}'!A:Z`,
    });
    
    const rows = data.data.values || [];
    console.log(`\n総行数: ${rows.length}`);
    
    // 「新規グロース部_悠太」を検索
    let found = 0;
    const dates = new Set();
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      for (let j = 0; j < row.length; j++) {
        if (row[j] && String(row[j]).includes("新規グロース部_悠太")) {
          found++;
          // 日付を探す
          for (let k = 0; k < Math.min(5, row.length); k++) {
            const val = String(row[k] || "");
            if (val.match(/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/)) {
              dates.add(val);
            }
          }
          if (found <= 2) {
            console.log(`\nサンプル行${i+1}:`, row.slice(0, 10));
          }
          break;
        }
      }
    }
    
    console.log(`\n「新規グロース部_悠太」を含む行: ${found}件`);
    console.log(`日付一覧: ${Array.from(dates).sort().slice(0, 20).join(", ")}`);
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

checkCSV();
