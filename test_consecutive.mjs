import { google } from "googleapis";
import dotenv from "dotenv";
dotenv.config();

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

// 当日CPNの1つを取得
const todayResponse = await sheets.spreadsheets.values.get({
  spreadsheetId,
  range: "'突き合わせ_当日CPN一覧'!H:I",
});

const todayRows = todayResponse.data.values || [];
let targetCpn = null;
for (const row of todayRows) {
  const cpnName = row[1] || "";
  if (cpnName.includes("新規グロース部_悠太")) {
    targetCpn = cpnName;
    break;
  }
}
console.log("確認するCPN:", targetCpn?.slice(0, 60));

// このCPNの過去データを取得
const histResponse = await sheets.spreadsheets.values.get({
  spreadsheetId: historicalSpreadsheetId,
  range: "'2025年12月'!A7:T",
});

const histRows = histResponse.data.values || [];
const history = [];
for (const row of histRows) {
  const cpnName = row[3] || "";
  if (cpnName === targetCpn) {
    history.push({
      date: row[2],
      cpnName,
    });
  }
}

console.log("\n過去データの日付:");
history.forEach(h => console.log("  ", h.date));

// 7日前のフィルタをシミュレート
const today = new Date();
today.setHours(0, 0, 0, 0);
const sevenDaysAgo = new Date(today);
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
console.log("\n今日:", today.toISOString());
console.log("7日前:", sevenDaysAgo.toISOString());

const filtered = history.filter(h => {
  const date = new Date(h.date);
  return date >= sevenDaysAgo;
});
console.log("\n7日以内の過去データ数:", filtered.length);
filtered.forEach(h => console.log("  ", h.date));
