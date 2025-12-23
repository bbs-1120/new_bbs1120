import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

async function checkColumns() {
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
    // 【TM5-1】当日CPN一覧のヘッダーを取得
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "'【TM5-1】突き合わせ_当日CPN一覧'!1:2",
    });
    
    const rows = response.data.values || [];
    console.log("=== 【TM5-1】突き合わせ_当日CPN一覧 ===");
    if (rows[0]) {
      rows[0].forEach((col, i) => {
        const letter = i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(65 + Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26));
        if (col) console.log(`${letter}(${i}): ${col}`);
      });
      console.log("\n最大列数:", rows[0].length);
    } else {
      console.log("ヘッダーが空です");
    }
    
    // DBシートも確認
    const response2 = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "DB!1:2",
    });
    
    const rows2 = response2.data.values || [];
    console.log("\n=== DB シート ===");
    if (rows2[0]) {
      rows2[0].forEach((col, i) => {
        const letter = i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(65 + Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26));
        if (col) console.log(`${letter}(${i}): ${col}`);
      });
      console.log("\n最大列数:", rows2[0].length);
    } else {
      console.log("ヘッダーが空です");
    }
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

checkColumns();
