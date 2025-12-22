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
  campaignId: string; // CPID
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
 * 突き合わせ_当日CPN一覧 シートからデータを取得
 * Updated: 2024-12-22
 * 「新規グロース部_悠太」を含む行のみ抽出
 * 
 * カラム構成（H列から開始）:
 * H(7): Today（日付）
 * I(8): campaign_name（キャンペーン名）
 * J(9): Cost（消化）
 * K(10): Imp.
 * L(11): Clicks
 * M(12): Clicks(YT)
 * N(13): 予算スケジューリング
 * O(14): アカウント名
 * P(15): 日予算
 * Q(16): CPNステータス
 * R(17): CPID
 * T(19): 所属TM
 * U(20): 担当者名
 * V(21): 案件名
 * W(22): オファー名
 * X(23): 媒体名
 * AU(46): 当日単価
 * AY(50): 売上
 * BB(53): MCV
 * BC(54): CV
 */
export async function fetchTodayData(spreadsheetId: string): Promise<RawRowData[]> {
  const sheets = getGoogleSheetsClient();

  // 突き合わせ_当日CPN一覧シートからデータを取得
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "突き合わせ_当日CPN一覧!A:CH",
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    return [];
  }

  const data: RawRowData[] = [];

  // ヘッダー行をスキップ（1行目）
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 55) continue; // BC列(54)まで必要

    const cpnName = parseValue(row[8]); // I列: campaign_name
    
    // 「新規グロース部_悠太」を含む行のみ抽出
    if (!cpnName.includes("新規グロース部_悠太")) continue;

    const media = parseValue(row[23]); // X列: 媒体名
    const spend = parseNumber(row[9]); // J列: Cost（消化）
    const revenue = parseNumber(row[50]); // AY列: 売上
    const profit = revenue - spend; // 利益 = 売上 - Cost
    const cv = Math.round(parseNumber(row[44])); // AS列: CV数（実成果）
    const mcv = Math.round(parseNumber(row[43])); // AR列: クリック数（MCV相当）
    const unitPrice = parseNumber(row[46]); // AU列: 当日単価

    data.push({
      media: normalizeMediaName(media),
      cpnKey: `${parseValue(row[7])}_${cpnName}`, // 日付+キャンペーン名
      cpnName,
      date: parseDate(row[7]), // H列: Today（日付）
      spend,
      revenue,
      profit,
      roas: spend > 0 ? (revenue / spend) * 100 : 0,
      cv,
      mcv,
      impressions: Math.round(parseNumber(row[10])), // K列: Imp.
      clicks: Math.round(parseNumber(row[11])), // L列: Clicks
      cpm: 0,
      cpc: 0,
      unitPrice,
      teamName: parseValue(row[19]), // T列: 所属TM
      personName: parseValue(row[20]), // U列: 担当者名
      projectName: parseValue(row[21]), // V列: 案件名
      projectOfferName: parseValue(row[22]), // W列: オファー名
      accountName: parseValue(row[14]), // O列: アカウント名
      campaignBudget: parseValue(row[15]), // P列: 日予算
      status: parseValue(row[16]), // Q列: CPNステータス
      campaignId: parseValue(row[17]), // R列: CPID
      budgetSchedule: parseValue(row[13]), // N列: 予算スケジューリング
    });
  }

  return data;
}

/**
 * CSV保管シートから過去データを取得
 * 「新規グロース部_悠太」を含む行のみ抽出
 * 
 * カラム構成:
 * B(1): 日付+キャンペーン名
 * C(2): 日付 (2025/12/01形式)
 * D(3): キャンペーン名
 * E(4): Cost（消化）
 * F(5): Imp
 * G(6): Clicks
 * I(8): MCV
 * J(9): CV
 * K(10): 単価
 * M(12): 媒体名
 * N(13): チーム名
 * O(14): 担当者名
 * P(15): 案件名
 * Q(16): 案件名_オファー名
 * R(17): 売上
 * S(18): アカウント名
 */
export async function fetchHistoricalData(_spreadsheetId: string): Promise<RawRowData[]> {
  const sheets = getGoogleSheetsClient();
  
  // CSV保管シートのスプレッドシートID
  const historicalSpreadsheetId = process.env.GOOGLE_SHEETS_HISTORICAL_SPREADSHEET_ID;
  if (!historicalSpreadsheetId) {
    console.warn("GOOGLE_SHEETS_HISTORICAL_SPREADSHEET_ID is not configured");
    return [];
  }

  // 現在の月のシート名を取得
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const sheetName = `${year}年${month}月`;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: historicalSpreadsheetId,
      range: `'${sheetName}'!A:T`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    const data: RawRowData[] = [];

    // データ行を処理（1行目はヘッダーなのでスキップ）
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
      const cv = Math.round(parseNumber(row[9])); // J列: CV
      const mcv = Math.round(parseNumber(row[8])); // I列: MCV
      const unitPrice = parseNumber(row[10]); // K列: 単価

      data.push({
        media: normalizeMediaName(media),
        cpnKey: parseValue(row[1]), // B列: 日付+キャンペーン名
        cpnName,
        date: parseDate(row[2]), // C列: 日付
        spend,
        revenue,
        profit,
        roas: spend > 0 ? (revenue / spend) * 100 : 0,
        cv,
        mcv,
        impressions: Math.round(parseNumber(row[5])), // F列: Imp
        clicks: Math.round(parseNumber(row[6])), // G列: Clicks
        cpm: 0,
        cpc: 0,
        unitPrice,
        teamName: parseValue(row[13]), // N列: チーム名
        personName: parseValue(row[14]), // O列: 担当者名
        projectName: parseValue(row[15]), // P列: 案件名
        projectOfferName: parseValue(row[16]), // Q列: 案件名_オファー名
        accountName: parseValue(row[18]), // S列: アカウント名
        campaignBudget: "",
        status: "",
        campaignId: "",
        budgetSchedule: "",
      });
    }

    return data;
  } catch (error) {
    console.error("Error fetching historical data:", error);
    return [];
  }
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

  // CPN別に過去データを日付順に整理
  const cpnHistoryMap = new Map<string, { date: Date; profit: number; mcv: number; spend: number; revenue: number }[]>();

  for (const row of historicalData) {
    if (row.date < sevenDaysAgo) continue;

    const key = row.cpnName;
    if (!cpnHistoryMap.has(key)) {
      cpnHistoryMap.set(key, []);
    }
    cpnHistoryMap.get(key)!.push({
      date: row.date,
      profit: row.profit,
      mcv: row.mcv,
      spend: row.spend,
      revenue: row.revenue,
    });
  }

  // CPN別に7日間の集計と連続日数を計算
  const cpn7DaysMap = new Map<string, { 
    profit: number; 
    spend: number; 
    revenue: number; 
    consecutiveLoss: number; 
    consecutiveProfit: number; 
    zeroMcvDays: number 
  }>();

  for (const [cpnName, history] of cpnHistoryMap.entries()) {
    // 日付降順にソート（新しい日付から）
    history.sort((a, b) => b.date.getTime() - a.date.getTime());

    let profit = 0;
    let spend = 0;
    let revenue = 0;
    let zeroMcvDays = 0;
    let consecutiveLoss = 0;
    let consecutiveProfit = 0;

    // 集計
    for (const day of history) {
      profit += day.profit;
      spend += day.spend;
      revenue += day.revenue;
      if (day.mcv === 0 && day.spend >= 3000) zeroMcvDays++;
    }

    // 連続日数を計算（新しい日付から遡って連続をカウント）
    for (const day of history) {
      if (day.profit < 0) {
        if (consecutiveProfit === 0) {
          consecutiveLoss++;
        } else {
          break; // プラスの連続が切れた
        }
      } else {
        if (consecutiveLoss === 0) {
          consecutiveProfit++;
        } else {
          break; // マイナスの連続が切れた
        }
      }
    }

    cpn7DaysMap.set(cpnName, { profit, spend, revenue, consecutiveLoss, consecutiveProfit, zeroMcvDays });
  }

  // 当日データに7日間集計を追加
  return todayData.map((row) => {
    const stats = cpn7DaysMap.get(row.cpnName);
    
    // 当日の状態を含めた連続日数を計算
    let consecutiveLoss = 0;
    let consecutiveProfit = 0;

    if (row.profit < 0) {
      // 当日がマイナス → 過去のマイナス連続 + 1
      consecutiveLoss = (stats?.consecutiveLoss || 0) + 1;
      consecutiveProfit = 0;
    } else {
      // 当日がプラス → 過去のプラス連続 + 1
      consecutiveProfit = (stats?.consecutiveProfit || 0) + 1;
      consecutiveLoss = 0;
    }
    
    return {
      ...row,
      dailyBudget: row.campaignBudget || "-",
      campaignId: row.campaignId || "", // CPID
      profit7Days: stats?.profit || 0,
      roas7Days: stats && stats.spend > 0 ? (stats.revenue / stats.spend) * 100 : 0,
      consecutiveZeroMcv: stats?.zeroMcvDays || 0,
      consecutiveLoss,
      consecutiveProfit,
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

/**
 * 当月の日別データを取得（グラフ用）
 */
export async function getDailyTrendData() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not configured");
  }

  try {
    // 過去データと当日データを取得
    const [historicalData, todayData] = await Promise.all([
      fetchHistoricalData(spreadsheetId),
      fetchTodayData(spreadsheetId),
    ]);

    // 今月の開始日を計算
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);

    // 日別にデータを集計
    const dailyMap = new Map<string, {
      date: string;
      spend: number;
      revenue: number;
      profit: number;
      cv: number;
      mcv: number;
    }>();

    // 過去データから今月分を集計
    for (const row of historicalData) {
      if (row.date < monthStart) continue;
      
      const dateStr = row.date.toISOString().split("T")[0];
      if (!dailyMap.has(dateStr)) {
        dailyMap.set(dateStr, { date: dateStr, spend: 0, revenue: 0, profit: 0, cv: 0, mcv: 0 });
      }
      
      const daily = dailyMap.get(dateStr)!;
      daily.spend += row.spend || 0;
      daily.revenue += row.revenue || 0;
      daily.profit += row.profit || 0;
      daily.cv += row.cv || 0;
      daily.mcv += row.mcv || 0;
    }

    // 当日データを追加
    const todayStr = now.toISOString().split("T")[0];
    if (!dailyMap.has(todayStr)) {
      dailyMap.set(todayStr, { date: todayStr, spend: 0, revenue: 0, profit: 0, cv: 0, mcv: 0 });
    }
    const todayDaily = dailyMap.get(todayStr)!;
    for (const row of todayData) {
      todayDaily.spend += row.spend || 0;
      todayDaily.revenue += row.revenue || 0;
      todayDaily.profit += row.profit || 0;
      todayDaily.cv += row.cv || 0;
      todayDaily.mcv += row.mcv || 0;
    }

    // 日付順にソートして返す
    const dailyList = Array.from(dailyMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        ...d,
        roas: d.spend > 0 ? (d.revenue / d.spend) * 100 : 0,
        cumulativeProfit: 0, // 後で計算
      }));

    // 累計利益を計算
    let cumulative = 0;
    for (const day of dailyList) {
      cumulative += day.profit;
      day.cumulativeProfit = cumulative;
    }

    return dailyList;
  } catch (error) {
    console.error("Error getting daily trend data:", error);
    return [];
  }
}

/**
 * 案件別の当月パフォーマンスを取得
 */
export async function getProjectMonthlyData() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not configured");
  }

  try {
    const [historicalData, todayData] = await Promise.all([
      fetchHistoricalData(spreadsheetId),
      fetchTodayData(spreadsheetId),
    ]);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);

    // 案件別に集計
    const projectMap = new Map<string, {
      spend: number;
      revenue: number;
      profit: number;
      cv: number;
      mcv: number;
      cpnCount: number;
    }>();

    // 過去データ
    for (const row of historicalData) {
      if (row.date < monthStart) continue;
      
      const projectName = row.projectName || "その他";
      if (!projectMap.has(projectName)) {
        projectMap.set(projectName, { spend: 0, revenue: 0, profit: 0, cv: 0, mcv: 0, cpnCount: 0 });
      }
      
      const project = projectMap.get(projectName)!;
      project.spend += row.spend || 0;
      project.revenue += row.revenue || 0;
      project.profit += row.profit || 0;
      project.cv += row.cv || 0;
      project.mcv += row.mcv || 0;
    }

    // 当日データ
    const cpnSet = new Set<string>();
    for (const row of todayData) {
      const projectName = row.projectName || "その他";
      if (!projectMap.has(projectName)) {
        projectMap.set(projectName, { spend: 0, revenue: 0, profit: 0, cv: 0, mcv: 0, cpnCount: 0 });
      }
      
      const project = projectMap.get(projectName)!;
      project.spend += row.spend || 0;
      project.revenue += row.revenue || 0;
      project.profit += row.profit || 0;
      project.cv += row.cv || 0;
      project.mcv += row.mcv || 0;
      
      // CPN数カウント用
      const cpnKey = `${projectName}:${row.cpnName}`;
      if (!cpnSet.has(cpnKey)) {
        cpnSet.add(cpnKey);
        project.cpnCount++;
      }
    }

    return Array.from(projectMap.entries())
      .map(([name, data]) => ({
        name,
        ...data,
        roas: data.spend > 0 ? (data.revenue / data.spend) * 100 : 0,
      }))
      .sort((a, b) => b.profit - a.profit);
  } catch (error) {
    console.error("Error getting project monthly data:", error);
    return [];
  }
}

/**
 * 前日比・前週比の比較データを取得
 */
export async function getComparisonData() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not configured");
  }

  try {
    const [historicalData, todayData] = await Promise.all([
      fetchHistoricalData(spreadsheetId),
      fetchTodayData(spreadsheetId),
    ]);

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // 日付ごとにデータを集計
    const dailyMap = new Map<string, { spend: number; revenue: number; profit: number; cv: number; mcv: number }>();

    for (const row of historicalData) {
      const dateStr = row.date.toISOString().split("T")[0];
      if (!dailyMap.has(dateStr)) {
        dailyMap.set(dateStr, { spend: 0, revenue: 0, profit: 0, cv: 0, mcv: 0 });
      }
      const daily = dailyMap.get(dateStr)!;
      daily.spend += row.spend || 0;
      daily.revenue += row.revenue || 0;
      daily.profit += row.profit || 0;
      daily.cv += row.cv || 0;
      daily.mcv += row.mcv || 0;
    }

    // 当日データを集計
    const today = { spend: 0, revenue: 0, profit: 0, cv: 0, mcv: 0 };
    for (const row of todayData) {
      today.spend += row.spend || 0;
      today.revenue += row.revenue || 0;
      today.profit += row.profit || 0;
      today.cv += row.cv || 0;
      today.mcv += row.mcv || 0;
    }

    // 前日の日付
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    // 先週同日の日付
    const lastWeek = new Date(now);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastWeekStr = lastWeek.toISOString().split("T")[0];

    const yesterdayData = dailyMap.get(yesterdayStr) || { spend: 0, revenue: 0, profit: 0, cv: 0, mcv: 0 };
    const lastWeekData = dailyMap.get(lastWeekStr) || { spend: 0, revenue: 0, profit: 0, cv: 0, mcv: 0 };

    // 比率計算（前日比）
    const calcChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / Math.abs(previous)) * 100;
    };

    return {
      today: {
        ...today,
        roas: today.spend > 0 ? (today.revenue / today.spend) * 100 : 0,
      },
      yesterday: {
        ...yesterdayData,
        roas: yesterdayData.spend > 0 ? (yesterdayData.revenue / yesterdayData.spend) * 100 : 0,
      },
      lastWeek: {
        ...lastWeekData,
        roas: lastWeekData.spend > 0 ? (lastWeekData.revenue / lastWeekData.spend) * 100 : 0,
      },
      dayOverDay: {
        spend: calcChange(today.spend, yesterdayData.spend),
        revenue: calcChange(today.revenue, yesterdayData.revenue),
        profit: calcChange(today.profit, yesterdayData.profit),
        cv: calcChange(today.cv, yesterdayData.cv),
        mcv: calcChange(today.mcv, yesterdayData.mcv),
      },
      weekOverWeek: {
        spend: calcChange(today.spend, lastWeekData.spend),
        revenue: calcChange(today.revenue, lastWeekData.revenue),
        profit: calcChange(today.profit, lastWeekData.profit),
        cv: calcChange(today.cv, lastWeekData.cv),
        mcv: calcChange(today.mcv, lastWeekData.mcv),
      },
    };
  } catch (error) {
    console.error("Error getting comparison data:", error);
    return null;
  }
}

export type { RawRowData };
