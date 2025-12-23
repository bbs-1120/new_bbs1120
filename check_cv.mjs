import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

async function checkCV() {
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
    
    // 「新規グロース部_悠太」を含む行を確認
    let found = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cpnName = row[8] || "";
      if (cpnName.includes("新規グロース部_悠太")) {
        found++;
        if (found <= 3) {
          console.log(`\n=== 行${i+1} ===`);
          console.log("I(8) CPN名:", cpnName.substring(0, 40) + "...");
          console.log("J(9) Cost:", row[9]);
          console.log("X(23) 媒体名:", row[23]);
          console.log("AU(46) 単価:", row[46]);
          console.log("AY(50) 売上:", row[50]);
          console.log("BB(53) MCV:", row[53]);
          console.log("BC(54) CV:", row[54]);
          console.log("行の長さ:", row.length);
        }
      }
    }
    
    console.log(`\n合計: ${found}件`);
    
    // ヘッダー確認（行6）
    const header = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "'突き合わせ_当日CPN一覧'!AY6:BE6",
    });
    console.log("\n=== ヘッダー（AY-BE列）===");
    const h = header.data.values?.[0] || [];
    console.log("AY(50):", h[0]);
    console.log("AZ(51):", h[1]);
    console.log("BA(52):", h[2]);
    console.log("BB(53):", h[3]);
    console.log("BC(54):", h[4]);
    console.log("BD(55):", h[5]);
    console.log("BE(56):", h[6]);
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

checkCV();
