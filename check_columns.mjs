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
    // 当日CPN一覧のヘッダーを取得
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "突き合わせ_当日CPN一覧!1:2",
    });
    
    const rows = response.data.values || [];
    console.log("=== 突き合わせ_当日CPN一覧 ヘッダー ===");
    if (rows[0]) {
      rows[0].forEach((col, i) => {
        const colLetter = String.fromCharCode(65 + Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26));
        const letter = i < 26 ? String.fromCharCode(65 + i) : colLetter;
        if (col) console.log(`${letter}(${i}): ${col}`);
      });
    }
    console.log("\n最大列数:", rows[0]?.length || 0);
    
    // 前日CPN一覧のヘッダーも確認
    const response2 = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "突き合わせ_前日CPN一覧!1:1",
    });
    
    const rows2 = response2.data.values || [];
    console.log("\n=== 突き合わせ_前日CPN一覧 ヘッダー ===");
    if (rows2[0]) {
      rows2[0].forEach((col, i) => {
        const letter = i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(65 + Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26));
        if (col) console.log(`${letter}(${i}): ${col}`);
      });
    }
    console.log("\n最大列数:", rows2[0]?.length || 0);
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

checkColumns();
