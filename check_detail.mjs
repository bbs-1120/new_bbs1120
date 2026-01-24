import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

async function checkDetail() {
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  console.log("Client Email:", clientEmail);
  console.log("Spreadsheet ID:", spreadsheetId);

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  
  try {
    // シートのメタデータを取得
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    console.log("\nスプレッドシート名:", meta.data.properties?.title);
    
    // 各シートの行数を確認
    for (const sheet of meta.data.sheets || []) {
      const title = sheet.properties?.title;
      const rowCount = sheet.properties?.gridProperties?.rowCount;
      const colCount = sheet.properties?.gridProperties?.columnCount;
      console.log(`\nシート: ${title}`);
      console.log(`  行数: ${rowCount}, 列数: ${colCount}`);
      
      // 最初の5行だけ取得してみる
      try {
        const data = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `'${title}'!A1:E5`,
        });
        const values = data.data.values || [];
        console.log(`  データ行数: ${values.length}`);
        if (values.length > 0) {
          console.log(`  最初の行:`, values[0]);
        }
      } catch (e) {
        console.log(`  エラー: ${e.message}`);
      }
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}

checkDetail();
