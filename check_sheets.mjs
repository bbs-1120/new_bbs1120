import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

async function checkSheets() {
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  console.log("Spreadsheet ID:", spreadsheetId);

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  
  try {
    const response = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetNames = response.data.sheets?.map(sheet => sheet.properties?.title) || [];
    console.log("\nシート一覧:");
    sheetNames.forEach((name, i) => console.log("  " + (i + 1) + ". " + name));
  } catch (error) {
    console.error("Error:", error.message);
  }
}

checkSheets();
