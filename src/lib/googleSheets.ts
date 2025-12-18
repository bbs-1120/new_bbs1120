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

// 値をパース
function parseValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function parseNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const str = String(value).replace(/[,¥%円]/g, "").trim();
  // マイナス記号の処理
  const isNegative = str.startsWith("-") || str.startsWith("−") || str.startsWith("▲");
  const cleanStr = str.replace(/^[-−▲]/, "");
  const num = parseFloat(cleanStr);
  if (isNaN(num)) return 0;
  return isNegative ? -num : num;
}

/**
 * ◆新規グロース部_当日 シートからデータを取得
 * 269行目以降で「悠太」を含む行のみ抽出
 */
export async function fetchRawDataFromSheet(spreadsheetId: string): Promise<RawRowData[]> {
  const sheets = getGoogleSheetsClient();

  // シートのデータを取得（269行目以降、十分な範囲を取得）
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "◆新規グロース部_当日!A269:Z1000",
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    return [];
  }

  // 今日の日付
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // データ行をパース（「悠太」を含む行のみ）
  const data: RawRowData[] = [];

  // 列インデックス（0始まり）
  // B列(1): 媒体
  // L列(11): キャンペーン別データ（CPNキー）
  // M列(12): 消化金額
  // N列(13): MCV
  // O列(14): CV
  // P列(15): 売上
  // Q列(16): 利益
  // R列(17): ロアス

  for (const row of rows) {
    if (!row || row.length < 12) continue;

    const cpnKey = parseValue(row[11]); // L列: キャンペーン別データ
    
    // 「悠太」を含む行のみ抽出
    if (!cpnKey.includes("悠太")) continue;

    const media = parseValue(row[1]); // B列: 媒体
    if (!media) continue;

    // 媒体名を正規化
    let normalizedMedia = media;
    if (media.toLowerCase() === "fb" || media.toLowerCase() === "facebook") {
      normalizedMedia = "Meta";
    } else if (media.toLowerCase() === "tiktok") {
      normalizedMedia = "TikTok";
    } else if (media.toLowerCase() === "pangle") {
      normalizedMedia = "Pangle";
    } else if (media.toLowerCase() === "youtube") {
      normalizedMedia = "YouTube";
    } else if (media.toLowerCase() === "line") {
      normalizedMedia = "LINE";
    }

    // CPN名を抽出（CPNキーから最後の部分を取得）
    const cpnParts = cpnKey.split("_");
    const cpnName = cpnParts.length > 0 ? cpnParts[cpnParts.length - 1] : cpnKey;

    const spend = parseNumber(row[12]);    // M列: 消化金額
    const revenue = parseNumber(row[15]);  // P列: 売上
    const profit = parseNumber(row[16]);   // Q列: 利益
    const roas = parseNumber(row[17]);     // R列: ロアス
    const mcv = Math.round(parseNumber(row[13])); // N列: MCV
    const cv = Math.round(parseNumber(row[14]));  // O列: CV

    data.push({
      media: normalizedMedia,
      cpnKey,
      cpnName,
      date: today,
      spend,
      revenue,
      profit,
      roas,
      cv,
      mcv,
      cpm: 0, // このシートにはCPMがない
      cpc: 0, // このシートにはCPCがない
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
