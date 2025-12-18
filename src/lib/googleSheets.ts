import { google } from "googleapis";

// Google Sheets APIクライアントを初期化
function getGoogleSheetsClient() {
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;

  if (!privateKey || !clientEmail) {
    throw new Error("Google Sheets API credentials are not configured");
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return google.sheets({ version: "v4", auth });
}

// RAWシートのカラムマッピング
interface RawRowData {
  media: string;
  cpnKey: string;
  cpnName: string;
  date: Date;
  spend: number;
  revenue: number;
  profit: number;
  roas: number;
  cv: number;
  mcv: number;
  cpm: number;
  cpc: number;
}

// ヘッダー行からカラムインデックスを取得
function getColumnIndices(headerRow: string[]): Record<string, number> {
  const mapping: Record<string, string> = {
    "媒体": "media",
    "CPNキー": "cpnKey",
    "CPN名": "cpnName",
    "日付": "date",
    "消化金額": "spend",
    "売上": "revenue",
    "利益": "profit",
    "ROAS": "roas",
    "CV": "cv",
    "MCV": "mcv",
    "CPM": "cpm",
    "CPC": "cpc",
  };

  const indices: Record<string, number> = {};

  for (let i = 0; i < headerRow.length; i++) {
    const header = headerRow[i]?.trim();
    if (header && mapping[header]) {
      indices[mapping[header]] = i;
    }
  }

  return indices;
}

// 値をパース
function parseValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function parseNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const str = String(value).replace(/[,¥%]/g, "").trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function parseDate(value: unknown): Date {
  if (value === null || value === undefined) return new Date();
  
  const str = String(value).trim();
  
  // YYYY/MM/DD or YYYY-MM-DD 形式
  const match = str.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (match) {
    return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
  }
  
  // Google Sheetsのシリアル値（数値）の場合
  const num = parseFloat(str);
  if (!isNaN(num) && num > 0) {
    // Excelのシリアル値を変換（1900年1月1日が基準）
    const date = new Date((num - 25569) * 86400 * 1000);
    return date;
  }
  
  return new Date(str);
}

/**
 * スプレッドシートからRAWデータを取得
 */
export async function fetchRawDataFromSheet(spreadsheetId: string): Promise<RawRowData[]> {
  const sheets = getGoogleSheetsClient();

  // RAWシートのデータを取得
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "RAW!A:L", // A列からL列まで
  });

  const rows = response.data.values;
  if (!rows || rows.length < 2) {
    return [];
  }

  // ヘッダー行からカラムインデックスを取得
  const headerRow = rows[0] as string[];
  const indices = getColumnIndices(headerRow);

  // データ行をパース
  const data: RawRowData[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const cpnKey = parseValue(row[indices.cpnKey]);
    if (!cpnKey) continue; // CPNキーがない行はスキップ

    data.push({
      media: parseValue(row[indices.media]),
      cpnKey,
      cpnName: parseValue(row[indices.cpnName]),
      date: parseDate(row[indices.date]),
      spend: parseNumber(row[indices.spend]),
      revenue: parseNumber(row[indices.revenue]),
      profit: parseNumber(row[indices.profit]),
      roas: parseNumber(row[indices.roas]),
      cv: Math.round(parseNumber(row[indices.cv])),
      mcv: Math.round(parseNumber(row[indices.mcv])),
      cpm: parseNumber(row[indices.cpm]),
      cpc: parseNumber(row[indices.cpc]),
    });
  }

  return data;
}

/**
 * スプレッドシートのシート一覧を取得（接続確認用）
 */
export async function testConnection(spreadsheetId: string): Promise<{
  success: boolean;
  sheets?: string[];
  error?: string;
}> {
  try {
    const sheetsClient = getGoogleSheetsClient();
    
    const response = await sheetsClient.spreadsheets.get({
      spreadsheetId,
    });

    const sheetNames = response.data.sheets?.map(
      (sheet) => sheet.properties?.title || "Unknown"
    ) || [];

    return {
      success: true,
      sheets: sheetNames,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export type { RawRowData };

