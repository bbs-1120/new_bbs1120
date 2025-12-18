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
  // 追加フィールド
  impressions: number;
  clicks: number;
  unitPrice: number;
  teamName: string;
  personName: string;
  projectName: string;
  projectOfferName: string;
  accountName: string;
  campaignBudget: string;
  status: string;
  budgetSchedule: string;
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

function parseDate(value: unknown): Date {
  if (value === null || value === undefined) return new Date();
  const str = String(value).trim();
  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) return new Date();
  return parsed;
}

// 媒体名を正規化
function normalizeMediaName(media: string): string {
  const lowerMedia = media.toLowerCase();
  if (lowerMedia === "fb" || lowerMedia === "facebook" || lowerMedia === "meta") {
    return "Meta";
  } else if (lowerMedia === "tiktok") {
    return "TikTok";
  } else if (lowerMedia === "pangle") {
    return "Pangle";
  } else if (lowerMedia === "youtube" || lowerMedia === "yt") {
    return "YouTube";
  } else if (lowerMedia === "line") {
    return "LINE";
  }
  return media;
}

/**
 * CSV_当日精査用 シートからデータを取得
 * 「新規グロース部_悠太」を含む行のみ抽出
 * 
 * カラム構成:
 * B(1): 日付+キャンペーン名
 * C(2): 日付
 * D(3): キャンペーン名
 * E(4): Cost
 * F(5): Imp.
 * G(6): Clicks
 * H(7): Clicks(YT)
 * I(8): MCV
 * J(9): CV
 * K(10): 当日単価
 * L(11): (空)
 * M(12): 媒体名
 * N(13): 所属TM
 * O(14): 担当者名
 * P(15): 案件名
 * Q(16): 案件名_オファー名
 * R(17): 売上
 * S(18): アカウント名
 * T(19): CampaignBudget
 * U(20): Status
 * V(21): CPID
 * W(22): 予算スケジューリング
 */
export async function fetchTodayData(spreadsheetId: string): Promise<RawRowData[]> {
  const sheets = getGoogleSheetsClient();

  // CSV_当日精査用シートからデータを取得
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "CSV_当日精査用!A:W",
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    return [];
  }

  const data: RawRowData[] = [];

  // ヘッダー行をスキップ（1行目）
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 10) continue;

    const cpnName = parseValue(row[3]); // D列: キャンペーン名
    
    // 「新規グロース部_悠太」を含む行のみ抽出
    if (!cpnName.includes("新規グロース部_悠太")) continue;

    const media = parseValue(row[12]); // M列: 媒体名
    const spend = parseNumber(row[4]); // E列: Cost
    const revenue = parseNumber(row[17]); // R列: 売上
    const profit = revenue - spend; // 利益 = 売上 - Cost

    data.push({
      media: normalizeMediaName(media),
      cpnKey: parseValue(row[1]), // B列: 日付+キャンペーン名
      cpnName,
      date: parseDate(row[2]), // C列: 日付
      spend,
      revenue,
      profit,
      roas: spend > 0 ? (revenue / spend) * 100 : 0,
      cv: Math.round(parseNumber(row[9])), // J列: CV
      mcv: Math.round(parseNumber(row[8])), // I列: MCV
      impressions: Math.round(parseNumber(row[5])), // F列: Imp.
      clicks: Math.round(parseNumber(row[6])), // G列: Clicks
      cpm: 0,
      cpc: 0,
      unitPrice: parseNumber(row[10]), // K列: 当日単価
      teamName: parseValue(row[13]), // N列: 所属TM
      personName: parseValue(row[14]), // O列: 担当者名
      projectName: parseValue(row[15]), // P列: 案件名
      projectOfferName: parseValue(row[16]), // Q列: 案件名_オファー名
      accountName: parseValue(row[18]), // S列: アカウント名
      campaignBudget: parseValue(row[19]), // T列: CampaignBudget
      status: parseValue(row[20]), // U列: Status
      budgetSchedule: parseValue(row[22]), // W列: 予算スケジューリング
    });
  }

  return data;
}

/**
 * CSV抽出 シートから過去データを取得
 * 「新規グロース部_悠太」を含む行のみ抽出
 * 
 * カラム構成（前半は当日精査用と同じ、後半に利益・ロアス列あり）:
 * B(1): 日付+キャンペーン名
 * C(2): 日付
 * D(3): キャンペーン名
 * E(4): Cost
 * F(5): Imp.
 * G(6): Clicks
 * H(7): Clicks(YT)
 * I(8): MCV
 * J(9): CV
 * K(10): 前日単価
 * M(12): 媒体名
 * N(13): 所属TM
 * O(14): 担当者名
 * P(15): 案件名
 * Q(16): 案件名_オファー名
 * R(17): 売上
 * S(18): アカウント名
 * 後半に 利益、ロアス、MCVR がある（列番号は動的に検出）
 */
export async function fetchHistoricalData(spreadsheetId: string): Promise<RawRowData[]> {
  const sheets = getGoogleSheetsClient();

  // CSV抽出シートからデータを取得
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "CSV抽出!A:AZ",
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    return [];
  }

  // ヘッダー行から利益・ロアス列を検出
  const headerRow = rows[0] || [];
  let profitColIndex = -1;
  let roasColIndex = -1;

  for (let i = 0; i < headerRow.length; i++) {
    const header = parseValue(headerRow[i]).toLowerCase();
    if (header === "利益") {
      profitColIndex = i;
    } else if (header === "ロアス") {
      roasColIndex = i;
    }
  }

  const data: RawRowData[] = [];

  // ヘッダー行をスキップ（1行目）
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 10) continue;

    const cpnName = parseValue(row[3]); // D列: キャンペーン名
    
    // 「新規グロース部_悠太」を含む行のみ抽出
    if (!cpnName.includes("新規グロース部_悠太")) continue;

    const media = parseValue(row[12]); // M列: 媒体名
    const spend = parseNumber(row[4]); // E列: Cost
    const revenue = parseNumber(row[17]); // R列: 売上

    // 利益・ロアスは検出した列から取得、なければ計算
    let profit = 0;
    let roas = 0;

    if (profitColIndex >= 0 && row[profitColIndex] !== undefined) {
      profit = parseNumber(row[profitColIndex]);
    } else {
      profit = revenue - spend;
    }

    if (roasColIndex >= 0 && row[roasColIndex] !== undefined) {
      roas = parseNumber(row[roasColIndex]);
    } else {
      roas = spend > 0 ? (revenue / spend) * 100 : 0;
    }

    data.push({
      media: normalizeMediaName(media),
      cpnKey: parseValue(row[1]), // B列: 日付+キャンペーン名
      cpnName,
      date: parseDate(row[2]), // C列: 日付
      spend,
      revenue,
      profit,
      roas,
      cv: Math.round(parseNumber(row[9])), // J列: CV
      mcv: Math.round(parseNumber(row[8])), // I列: MCV
      impressions: Math.round(parseNumber(row[5])), // F列: Imp.
      clicks: Math.round(parseNumber(row[6])), // G列: Clicks
      cpm: 0,
      cpc: 0,
      unitPrice: parseNumber(row[10]), // K列: 前日単価
      teamName: parseValue(row[13]), // N列: 所属TM
      personName: parseValue(row[14]), // O列: 担当者名
      projectName: parseValue(row[15]), // P列: 案件名
      projectOfferName: parseValue(row[16]), // Q列: 案件名_オファー名
      accountName: parseValue(row[18]), // S列: アカウント名
      campaignBudget: "",
      status: "",
      budgetSchedule: "",
    });
  }

  return data;
}

/**
 * 当日データと過去データを取得（旧関数との互換性のため維持）
 */
export async function fetchRawDataFromSheet(spreadsheetId: string): Promise<RawRowData[]> {
  // 当日データを取得
  return await fetchTodayData(spreadsheetId);
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

/**
 * 分析用のデータを取得（当日 + 過去7日分）
 */
export async function getSheetData() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not configured");
  }

  // 当日データを取得
  const todayData = await fetchTodayData(spreadsheetId);

  // 分析用に拡張データを返す
  return todayData.map((row) => ({
    ...row,
    dailyBudget: row.campaignBudget || "-",
    profit7Days: 0, // 7日間データは別途計算
    roas7Days: 0,
    consecutiveZeroMcv: 0,
    consecutiveLoss: 0,
    cpa: row.cv > 0 ? row.spend / row.cv : 0,
  }));
}

/**
 * 過去データ込みの分析用データを取得
 */
export async function getFullAnalysisData() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not configured");
  }

  // 当日データと過去データを取得
  const [todayData, historicalData] = await Promise.all([
    fetchTodayData(spreadsheetId),
    fetchHistoricalData(spreadsheetId),
  ]);

  // 過去7日間のデータを集計
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // CPN別に過去7日間の集計
  const cpn7DaysMap = new Map<string, { profit: number; spend: number; revenue: number; lossDays: number; zeroMcvDays: number }>();

  for (const row of historicalData) {
    if (row.date < sevenDaysAgo) continue;

    const key = row.cpnName;
    if (!cpn7DaysMap.has(key)) {
      cpn7DaysMap.set(key, { profit: 0, spend: 0, revenue: 0, lossDays: 0, zeroMcvDays: 0 });
    }

    const stats = cpn7DaysMap.get(key)!;
    stats.profit += row.profit;
    stats.spend += row.spend;
    stats.revenue += row.revenue;
    if (row.profit < 0) stats.lossDays++;
    if (row.mcv === 0 && row.spend >= 3000) stats.zeroMcvDays++;
  }

  // 当日データに7日間集計を追加
  return todayData.map((row) => {
    const stats = cpn7DaysMap.get(row.cpnName);
    return {
      ...row,
      dailyBudget: row.campaignBudget || "-",
      profit7Days: stats?.profit || 0,
      roas7Days: stats && stats.spend > 0 ? (stats.revenue / stats.spend) * 100 : 0,
      consecutiveZeroMcv: stats?.zeroMcvDays || 0,
      consecutiveLoss: stats?.lossDays || 0,
      cpa: row.cv > 0 ? row.spend / row.cv : 0,
    };
  });
}

/**
 * 今月（12月）の利益合計を取得
 */
export async function getMonthlyProfit(): Promise<number> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not configured");
  }

  try {
    // 過去データを取得
    const historicalData = await fetchHistoricalData(spreadsheetId);
    
    // 当日データも取得
    const todayData = await fetchTodayData(spreadsheetId);

    // 今月の開始日を計算（12月1日）
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);

    // 過去データから今月分を集計
    let monthlyProfit = 0;
    
    for (const row of historicalData) {
      if (row.date >= monthStart) {
        monthlyProfit += row.profit;
      }
    }

    // 当日データも加算
    for (const row of todayData) {
      monthlyProfit += row.profit;
    }

    return monthlyProfit;
  } catch (error) {
    console.error("Error calculating monthly profit:", error);
    return 0;
  }
}

export type { RawRowData };
