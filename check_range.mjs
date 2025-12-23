import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

async function checkRange() {
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
    // A1:Z20の範囲で確認
    const data = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "'突き合わせ_当日CPN一覧'!A1:Z20",
    });
    
    const values = data.data.values || [];
    console.log("=== 突き合わせ_当日CPN一覧 A1:Z20 ===");
    console.log("取得行数:", values.length);
    
    values.forEach((row, i) => {
      // 空でない列だけ表示
      const nonEmpty = row.map((v, j) => v ? `${String.fromCharCode(65+j)}:${v}` : null).filter(Boolean);
      if (nonEmpty.length > 0) {
        console.log(`行${i+1}:`, nonEmpty.slice(0, 5).join(", "), nonEmpty.length > 5 ? "..." : "");
      }
    });
  } catch (error) {
    console.error("Error:", error.message);
  }
}

checkRange();
