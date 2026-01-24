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
    // ヘッダー行を取得
    const data = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "'突き合わせ_前日CPN一覧'!A6:CM6",
    });
    
    const header = data.data.values?.[0] || [];
    console.log("=== 突き合わせ_前日CPN一覧 ヘッダー（行6） ===\n");
    
    header.forEach((col, i) => {
      if (col) {
        const letter = i < 26 
          ? String.fromCharCode(65 + i) 
          : String.fromCharCode(65 + Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26));
        console.log(`${letter}(${i}): ${col}`);
      }
    });
    
    // データ確認
    const data2 = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "'突き合わせ_前日CPN一覧'!A:CM",
    });
    
    const rows = data2.data.values || [];
    console.log("\n総行数:", rows.length);
    
    // 「新規グロース部_悠太」を検索
    let found = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cpnName = row[8] || "";
      if (cpnName.includes("新規グロース部_悠太")) {
        found++;
        if (found === 1) {
          console.log("\nサンプルデータ（行", i+1, "）:");
          console.log("  H(7) 日付:", row[7]);
          console.log("  I(8) CPN名:", row[8]?.substring(0, 50));
          console.log("  J(9) Cost:", row[9]);
          console.log("  X(23) 媒体名:", row[23]);
          console.log("  AY(50) 売上:", row[50]);
          console.log("  BB(53) MCV:", row[53]);
          console.log("  BC(54) CV:", row[54]);
        }
      }
    }
    
    console.log(`\n「新規グロース部_悠太」を含む行: ${found}件`);
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

check();
