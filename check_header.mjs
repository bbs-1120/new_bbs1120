import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

async function checkHeader() {
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
    // 行6（ヘッダー）を広い範囲で取得
    const data = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "'突き合わせ_当日CPN一覧'!A6:CM6",
    });
    
    const header = data.data.values?.[0] || [];
    console.log("=== ヘッダー行（行6） ===\n");
    
    header.forEach((col, i) => {
      if (col) {
        const letter = i < 26 
          ? String.fromCharCode(65 + i) 
          : String.fromCharCode(65 + Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26));
        console.log(`${letter}(${i}): ${col}`);
      }
    });
    
    console.log("\n総列数:", header.length);
    
    // 行17（最初のデータ）も確認
    const data2 = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "'突き合わせ_当日CPN一覧'!A17:CM17",
    });
    
    const row17 = data2.data.values?.[0] || [];
    console.log("\n=== データ行（行17）サンプル ===");
    console.log("I(8) campaign_name:", row17[8]);
    console.log("J(9) Cost:", row17[9]);
    console.log("列数:", row17.length);
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

checkHeader();
