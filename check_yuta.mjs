import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

async function checkYuta() {
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
    // 全データを取得
    const data = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "'突き合わせ_当日CPN一覧'!A:CM",
    });
    
    const rows = data.data.values || [];
    console.log("総行数:", rows.length);
    
    // 「新規グロース部_悠太」を検索
    let found = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cpnName = row[8] || ""; // I列
      if (cpnName.includes("新規グロース部_悠太")) {
        found++;
        if (found <= 3) {
          console.log(`\n行${i+1}: ${cpnName.substring(0, 50)}...`);
        }
      }
    }
    
    console.log(`\n「新規グロース部_悠太」を含む行: ${found}件`);
    
    // 担当者名で確認
    console.log("\n=== 担当者名（U列）の確認 ===");
    const persons = new Set();
    for (const row of rows) {
      const person = row[20]; // U列
      if (person && person !== "担当者名") {
        persons.add(person);
      }
    }
    console.log("担当者一覧:", Array.from(persons).slice(0, 10));
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

checkYuta();
