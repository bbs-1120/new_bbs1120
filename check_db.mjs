import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

async function checkDB() {
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  
  try {
    // DBシートのヘッダーを確認
    const header = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "DB!A1:AA1",
    });
    
    const h = header.data.values?.[0] || [];
    console.log("=== DBシート ヘッダー ===");
    h.forEach((col, i) => {
      const letter = i < 26 
        ? String.fromCharCode(65 + i) 
        : String.fromCharCode(65 + Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26));
      console.log(`${letter}(${i}): ${col}`);
    });
    
    // データ行を確認
    const data = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "DB!A2:AA10",
    });
    
    const rows = data.data.values || [];
    console.log("\n=== サンプルデータ ===");
    for (let i = 0; i < Math.min(3, rows.length); i++) {
      const row = rows[i];
      console.log(`\n行${i+2}:`);
      console.log("  A(0):", row[0]);
      console.log("  B(1):", row[1]);
      console.log("  C(2):", row[2]);
      console.log("  D(3):", row[3]);
    }
    
    // 「新規グロース部_悠太」を検索
    const allData = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "DB!A:AA",
    });
    
    const allRows = allData.data.values || [];
    console.log("\n総行数:", allRows.length);
    
    let found = 0;
    const dates = new Set();
    for (let i = 1; i < allRows.length; i++) {
      const row = allRows[i];
      // キャンペーン名を探す
      for (let j = 0; j < row.length; j++) {
        if (row[j] && String(row[j]).includes("新規グロース部_悠太")) {
          found++;
          if (row[0]) dates.add(row[0].split(" ")[0]); // 日付部分
          break;
        }
      }
    }
    
    console.log(`\n「新規グロース部_悠太」を含む行: ${found}件`);
    console.log("日付一覧:", Array.from(dates).slice(0, 10));
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

checkDB();
