import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

async function checkAllSheets() {
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
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetNames = meta.data.sheets?.map(s => s.properties?.title) || [];
    
    for (const name of sheetNames) {
      console.log(`\n=== ${name} ===`);
      
      try {
        const data = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `'${name}'!A:Z`,
        });
        
        const rows = data.data.values || [];
        console.log(`行数: ${rows.length}`);
        
        // 「新規グロース部_悠太」を検索
        let found = 0;
        const dates = new Set();
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          for (let j = 0; j < row.length; j++) {
            if (row[j] && String(row[j]).includes("新規グロース部_悠太")) {
              found++;
              // 日付らしいカラムを探す
              for (let k = 0; k < Math.min(10, row.length); k++) {
                const val = String(row[k] || "");
                if (val.match(/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/)) {
                  dates.add(val.split(" ")[0]);
                }
              }
              break;
            }
          }
        }
        
        if (found > 0) {
          console.log(`悠太さんのデータ: ${found}件`);
          console.log(`日付: ${Array.from(dates).slice(0, 5).join(", ")}`);
        }
      } catch (e) {
        console.log(`エラー: ${e.message}`);
      }
    }
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

checkAllSheets();
