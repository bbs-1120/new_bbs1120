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
    // 12月シートのヘッダーを確認
    console.log("=== 2025年12月 シート ===");
    
    const header = await sheets.spreadsheets.values.get({
      spreadsheetId: historicalSpreadsheetId,
      range: "'2025年12月'!A1:Z1",
    });
    
    const h = header.data.values?.[0] || [];
    console.log("\nヘッダー:");
    h.forEach((col, i) => {
      const letter = i < 26 
        ? String.fromCharCode(65 + i) 
        : String.fromCharCode(65 + Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26));
      console.log(`${letter}(${i}): ${col}`);
    });
    
    // データ確認
    const data = await sheets.spreadsheets.values.get({
      spreadsheetId: historicalSpreadsheetId,
      range: "'2025年12月'!A:Z",
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
          // 日付列（恐らくA列かB列）
          if (row[0]) dates.add(String(row[0]).split(" ")[0]);
          if (row[1]) dates.add(String(row[1]).split(" ")[0]);
          
          if (found <= 2) {
            console.log(`\nサンプル行${i+1}:`);
            for (let k = 0; k < Math.min(15, row.length); k++) {
              if (row[k]) console.log(`  ${String.fromCharCode(65+k)}(${k}): ${String(row[k]).substring(0, 50)}`);
            }
          }
          break;
        }
      }
    }
    
    console.log(`\n「新規グロース部_悠太」を含む行: ${found}件`);
    const sortedDates = Array.from(dates).filter(d => d.match(/^\d{4}[\/\-]\d/)).sort();
    console.log(`日付一覧: ${sortedDates.join(", ")}`);
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

checkCSV();
