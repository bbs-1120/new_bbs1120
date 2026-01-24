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
    // ヘッダー全体を確認（AO-CM）
    const header = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "'突き合わせ_当日CPN一覧'!AO6:CM6",
    });
    
    const h = header.data.values?.[0] || [];
    console.log("=== ヘッダー（AO列から）===");
    h.forEach((col, i) => {
      if (col) {
        const idx = 40 + i; // AOは40
        const letter = idx < 26 
          ? String.fromCharCode(65 + idx) 
          : String.fromCharCode(65 + Math.floor(idx / 26) - 1) + String.fromCharCode(65 + (idx % 26));
        console.log(`${letter}(${idx}): ${col}`);
      }
    });
    
    // データ行を確認
    const data = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "'突き合わせ_当日CPN一覧'!A917:CM920",
    });
    
    const rows = data.data.values || [];
    console.log("\n=== データ行917-920（悠太さんのデータ）===");
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      console.log(`\n行${917+i}:`);
      console.log("  AR(43) クリック数:", row[43]);
      console.log("  AS(44) CV数:", row[44]);
      console.log("  AU(46) 単価:", row[46]);
      console.log("  AY(50) 売上:", row[50]);
      console.log("  BB(53) MCV:", row[53]);
      console.log("  BC(54) CV:", row[54]);
      console.log("  BL(63) MCV:", row[63]);
      console.log("  BM(64) CV:", row[64]);
    }
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

checkCV();
