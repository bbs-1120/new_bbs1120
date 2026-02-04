import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getCache, setCache } from "@/lib/cache";

// Google Sheets APIクライアントを初期化
function getGoogleSheetsClient() {
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;

  if (!privateKey || !clientEmail) {
    throw new Error("Google Sheets credentials not configured");
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return google.sheets({ version: "v4", auth });
}

function parseNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const str = String(value).replace(/[,¥%円]/g, "").trim();
  const isNegative = str.startsWith("-") || str.startsWith("−") || str.startsWith("▲");
  const cleanStr = str.replace(/^[-−▲]/, "");
  const num = parseFloat(cleanStr);
  if (isNaN(num)) return 0;
  return isNegative ? -num : num;
}

function parseValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

interface DailyData {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  mcv: number;
  cv: number;
  revenue: number;
  profit: number;
  roas: number;
  cpa: number;
  cpm: number;
  cpc: number;
  ctr: number;
  mcvr: number;
  mcpa: number;
  cvr: number;
}

interface CpnDetailResponse {
  cpnName: string;
  dailyData: DailyData[];
  summary: DailyData & { totalDays: number };
}

const CACHE_KEY_PREFIX = "cpn_detail_";
const CACHE_TTL = 10 * 60 * 1000; // 10分

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cpnName = searchParams.get("cpnName");
    const days = parseInt(searchParams.get("days") || "7", 10);

    if (!cpnName) {
      return NextResponse.json({ success: false, error: "cpnName is required" }, { status: 400 });
    }

    // キャッシュチェック
    const cacheKey = `${CACHE_KEY_PREFIX}${cpnName}_${days}`;
    const cached = getCache<CpnDetailResponse>(cacheKey);
    if (cached) {
      return NextResponse.json({ success: true, data: cached });
    }

    const historicalSpreadsheetId = process.env.GOOGLE_SHEETS_HISTORICAL_SPREADSHEET_ID?.trim();
    if (!historicalSpreadsheetId) {
      return NextResponse.json({ success: false, error: "Historical spreadsheet ID not configured" }, { status: 500 });
    }

    const sheets = getGoogleSheetsClient();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const currentSheetName = `${year}年${month}月`;
    
    // 前月のシート名
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevSheetName = `${prevYear}年${prevMonth}月`;

    const dailyDataMap: Map<string, DailyData> = new Map();
    const sheetNames = [currentSheetName, prevSheetName];
    
    // 過去N日間の日付範囲
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    for (const sheetName of sheetNames) {
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: historicalSpreadsheetId,
          range: `'${sheetName}'!A7:T`,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) continue;

        for (const row of rows) {
          if (!row || row.length < 10) continue;

          const rowCpnName = parseValue(row[3]); // D列: キャンペーン名
          
          // CPN名が部分一致する場合
          if (!rowCpnName.includes(cpnName) && cpnName !== rowCpnName) continue;

          const dateStr = parseValue(row[2]); // C列: 日付
          if (!dateStr) continue;
          
          const rowDate = new Date(dateStr);
          if (isNaN(rowDate.getTime()) || rowDate < cutoffDate) continue;

          const spend = parseNumber(row[4]); // E列: Cost
          const revenue = parseNumber(row[17]); // R列: 売上
          const profit = revenue - spend;
          const cv = Math.round(parseNumber(row[9])); // J列: CV
          const mcv = Math.round(parseNumber(row[8])); // I列: MCV
          const impressions = Math.round(parseNumber(row[5])); // F列: Imp
          const clicks = Math.round(parseNumber(row[6])); // G列: Clicks

          const dateKey = `${String(rowDate.getMonth() + 1).padStart(2, "0")}/${String(rowDate.getDate()).padStart(2, "0")}`;
          
          const existing = dailyDataMap.get(dateKey) || {
            date: dateKey,
            spend: 0, impressions: 0, clicks: 0, mcv: 0, cv: 0,
            revenue: 0, profit: 0, roas: 0, cpa: 0, cpm: 0, cpc: 0, ctr: 0, mcvr: 0, mcpa: 0, cvr: 0,
          };

          existing.spend += spend;
          existing.impressions += impressions;
          existing.clicks += clicks;
          existing.mcv += mcv;
          existing.cv += cv;
          existing.revenue += revenue;
          existing.profit += profit;
          
          dailyDataMap.set(dateKey, existing);
        }
      } catch (error) {
        console.warn(`Error fetching sheet ${sheetName}:`, error);
        continue;
      }
    }

    // 当日データも取得
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
    if (spreadsheetId) {
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: "突き合わせ_当日CPN一覧!A:CH",
        });

        const rows = response.data.values;
        if (rows && rows.length > 0) {
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length < 55) continue;

            const rowCpnName = parseValue(row[8]); // I列: campaign_name
            if (!rowCpnName.includes(cpnName) && cpnName !== rowCpnName) continue;

            const dateStr = parseValue(row[7]); // H列: Today
            if (!dateStr) continue;
            
            const rowDate = new Date(dateStr);
            if (isNaN(rowDate.getTime())) continue;

            const spend = parseNumber(row[9]); // J列: Cost
            const revenue = parseNumber(row[50]); // AY列: 売上
            const profit = revenue - spend;
            const cv = Math.round(parseNumber(row[54])); // BC列: CV
            const mcv = Math.round(parseNumber(row[53])); // BB列: MCV
            const impressions = Math.round(parseNumber(row[10])); // K列: Imp
            const clicks = Math.round(parseNumber(row[11])); // L列: Clicks

            const dateKey = `${String(rowDate.getMonth() + 1).padStart(2, "0")}/${String(rowDate.getDate()).padStart(2, "0")}`;
            
            const existing = dailyDataMap.get(dateKey) || {
              date: dateKey,
              spend: 0, impressions: 0, clicks: 0, mcv: 0, cv: 0,
              revenue: 0, profit: 0, roas: 0, cpa: 0, cpm: 0, cpc: 0, ctr: 0, mcvr: 0, mcpa: 0, cvr: 0,
            };

            existing.spend += spend;
            existing.impressions += impressions;
            existing.clicks += clicks;
            existing.mcv += mcv;
            existing.cv += cv;
            existing.revenue += revenue;
            existing.profit += profit;
            
            dailyDataMap.set(dateKey, existing);
          }
        }
      } catch (error) {
        console.warn("Error fetching today data:", error);
      }
    }

    // 指標を計算
    const dailyData: DailyData[] = Array.from(dailyDataMap.values())
      .map(d => ({
        ...d,
        roas: d.spend > 0 ? (d.revenue / d.spend) * 100 : 0,
        cpa: d.cv > 0 ? d.spend / d.cv : 0,
        cpm: d.impressions > 0 ? (d.spend / d.impressions) * 1000 : 0,
        cpc: d.clicks > 0 ? d.spend / d.clicks : 0,
        ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
        mcvr: d.clicks > 0 ? (d.mcv / d.clicks) * 100 : 0,
        mcpa: d.mcv > 0 ? d.spend / d.mcv : 0,
        cvr: d.mcv > 0 ? (d.cv / d.mcv) * 100 : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // サマリー計算
    const summary: DailyData & { totalDays: number } = {
      date: "合計",
      totalDays: dailyData.length,
      spend: dailyData.reduce((s, d) => s + d.spend, 0),
      impressions: dailyData.reduce((s, d) => s + d.impressions, 0),
      clicks: dailyData.reduce((s, d) => s + d.clicks, 0),
      mcv: dailyData.reduce((s, d) => s + d.mcv, 0),
      cv: dailyData.reduce((s, d) => s + d.cv, 0),
      revenue: dailyData.reduce((s, d) => s + d.revenue, 0),
      profit: dailyData.reduce((s, d) => s + d.profit, 0),
      roas: 0, cpa: 0, cpm: 0, cpc: 0, ctr: 0, mcvr: 0, mcpa: 0, cvr: 0,
    };
    
    summary.roas = summary.spend > 0 ? (summary.revenue / summary.spend) * 100 : 0;
    summary.cpa = summary.cv > 0 ? summary.spend / summary.cv : 0;
    summary.cpm = summary.impressions > 0 ? (summary.spend / summary.impressions) * 1000 : 0;
    summary.cpc = summary.clicks > 0 ? summary.spend / summary.clicks : 0;
    summary.ctr = summary.impressions > 0 ? (summary.clicks / summary.impressions) * 100 : 0;
    summary.mcvr = summary.clicks > 0 ? (summary.mcv / summary.clicks) * 100 : 0;
    summary.mcpa = summary.mcv > 0 ? summary.spend / summary.mcv : 0;
    summary.cvr = summary.mcv > 0 ? (summary.cv / summary.mcv) * 100 : 0;

    const result: CpnDetailResponse = {
      cpnName,
      dailyData,
      summary,
    };

    setCache(cacheKey, result, CACHE_TTL);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Error fetching CPN detail:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch CPN detail" }, { status: 500 });
  }
}
