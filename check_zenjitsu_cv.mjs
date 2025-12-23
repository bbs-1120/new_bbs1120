import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
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
    // ヘッダー確認
    const header = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "'突き合わせ_前日CPN一覧'!AO6:CM6",
    });
    
    const h = header.data.values?.[0] || [];
    console.log("=== 前日一覧ヘッダー（AO列から）===");
    h.forEach((col, i) => {
      if (col) {
        const idx = 40 + i;
        const letter = idx < 26 
          ? String.fromCharCode(65 + idx) 
          : String.fromCharCode(65 + Math.floor(idx / 26) - 1) + String.fromCharCode(65 + (idx % 26));
        console.log(`${letter}(${idx}): ${col}`);
      }
    });
    
    // 「新規グロース部_悠太」のデータを確認
    const data = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "'突き合わせ_前日CPN一覧'!A:CM",
    });
    
    const rows = data.data.values || [];
    let found = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cpnName = row[8] || "";
      if (cpnName.includes("新規グロース部_悠太")) {
        found++;
        if (found <= 2) {
          console.log(`\n行${i+1}:`);
          console.log("  H(7) 日付:", row[7]);
          console.log("  AR(43) クリック数:", row[43]);
          console.log("  AS(44) CV数:", row[44]);
          console.log("  AY(50) 売上:", row[50]);
        }
      }
    }
    console.log(`\n合計: ${found}件`);
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

check();
