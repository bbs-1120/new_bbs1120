import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

async function checkCPN() {
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const historicalSpreadsheetId = process.env.GOOGLE_SHEETS_HISTORICAL_SPREADSHEET_ID;

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const targetCpn = "BSクリニック女性_直フォーム_pangle_AXAD01_1210_記事002_詰め合わせ";
  
  try {
    // 当日データを確認
    console.log("=== 当日データ（突き合わせ_当日CPN一覧）===");
    const todayData = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "'突き合わせ_当日CPN一覧'!A:CM",
    });
    
    const todayRows = todayData.data.values || [];
    for (const row of todayRows) {
      const cpnName = row[8] || "";
      if (cpnName.includes(targetCpn)) {
        console.log("\nCPN名:", cpnName);
        console.log("日付:", row[7]);
        console.log("Cost:", row[9]);
        console.log("売上:", row[50]);
        console.log("CV数:", row[44]);
        console.log("媒体:", row[23]);
        
        const spend = parseFloat(String(row[9] || "0").replace(/[¥,]/g, ""));
        const revenue = parseFloat(String(row[50] || "0").replace(/[¥,]/g, ""));
        console.log("当日利益:", revenue - spend);
      }
    }
    
    // 過去データを確認
    console.log("\n=== 過去データ（CSV保管シート 2025年12月）===");
    const histData = await sheets.spreadsheets.values.get({
      spreadsheetId: historicalSpreadsheetId,
      range: "'2025年12月'!A:T",
    });
    
    const histRows = histData.data.values || [];
    let lossDays = 0;
    let totalProfit = 0;
    let totalSpend = 0;
    let totalRevenue = 0;
    
    for (const row of histRows) {
      const cpnName = row[3] || "";
      if (cpnName.includes(targetCpn)) {
        const spend = parseFloat(String(row[4] || "0").replace(/[¥,]/g, ""));
        const revenue = parseFloat(String(row[17] || "0").replace(/[¥,]/g, ""));
        const profit = revenue - spend;
        
        totalSpend += spend;
        totalRevenue += revenue;
        totalProfit += profit;
        if (profit < 0) lossDays++;
        
        console.log(`日付: ${row[2]}, Cost: ${row[4]}, 売上: ${row[17]}, 利益: ${profit.toFixed(0)}`);
      }
    }
    
    console.log("\n=== 集計 ===");
    console.log("7日間利益:", totalProfit.toFixed(0));
    console.log("赤字日数:", lossDays);
    console.log("7日ROAS:", totalSpend > 0 ? ((totalRevenue / totalSpend) * 100).toFixed(1) + "%" : "N/A");
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

checkCPN();
