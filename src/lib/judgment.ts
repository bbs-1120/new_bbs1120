import { isReCpn } from "./utils";

// 判定結果の定数
export const JUDGMENT = {
  STOP: "停止",
  REPLACE: "作り替え",
  CONTINUE: "継続",
  CHECK: "要確認",
} as const;

export type JudgmentType = (typeof JUDGMENT)[keyof typeof JUDGMENT];

// 理由タグの定数
export const REASON = {
  CONSECUTIVE_LOSS: "連続赤字",
  LOSS_7DAYS: "7日間赤字超過",
  LOW_ROAS: "ROAS基準未達",
  PROFIT_7DAYS: "7日間黒字",
  PROFIT_TODAY: "当日黒字",
  HIGH_ROAS: "ROAS基準達成",
  NO_MATCH: "条件不一致",
} as const;

// 設定型
export interface JudgmentConfig {
  stopReConsecutiveLossDays: number;
  replaceNoReConsecutiveLossDays: number;
  lossThreshold7Days: number;
  roasThresholdStop: number;
  roasThresholdContinue: number;
}

// デフォルト設定
export const DEFAULT_CONFIG: JudgmentConfig = {
  stopReConsecutiveLossDays: 2,
  replaceNoReConsecutiveLossDays: 3,
  lossThreshold7Days: 40000,
  roasThresholdStop: 105,
  roasThresholdContinue: 110,
};

// 日次データ型
export interface DailyData {
  date: Date;
  spend: number;
  revenue: number;
  profit: number;
  roas: number;
}

// CPNデータ型
export interface CpnData {
  cpnKey: string;
  cpnName: string;
  mediaId: string;
  dailyData: DailyData[];
}

// 判定結果型
export interface JudgmentResultData {
  cpnKey: string;
  cpnName: string;
  mediaId: string;
  todayProfit: number;
  profit7Days: number;
  roas7Days: number;
  consecutiveLossDays: number;
  judgment: JudgmentType;
  reasons: string[];
  recommendedAction: string;
  isRe: boolean;
}

/**
 * 連続赤字日数を計算
 */
function calculateConsecutiveLossDays(dailyData: DailyData[]): number {
  // 日付で降順ソート（新しい順）
  const sorted = [...dailyData].sort((a, b) => b.date.getTime() - a.date.getTime());
  
  let count = 0;
  for (const data of sorted) {
    if (data.profit < 0) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * 直近N日間の集計値を計算
 */
function calculateLastNDays(dailyData: DailyData[], days: number) {
  const sorted = [...dailyData].sort((a, b) => b.date.getTime() - a.date.getTime());
  const targetData = sorted.slice(0, days);

  let totalSpend = 0;
  let totalRevenue = 0;
  let totalProfit = 0;

  for (const data of targetData) {
    totalSpend += data.spend;
    totalRevenue += data.revenue;
    totalProfit += data.profit;
  }

  const roas = totalSpend > 0 ? (totalRevenue / totalSpend) * 100 : 0;

  return {
    totalSpend,
    totalRevenue,
    totalProfit,
    roas,
    daysCount: targetData.length,
  };
}

/**
 * 当日のデータを取得
 */
function getTodayData(dailyData: DailyData[]): DailyData | null {
  if (dailyData.length === 0) return null;
  const sorted = [...dailyData].sort((a, b) => b.date.getTime() - a.date.getTime());
  return sorted[0];
}

/**
 * 停止条件をチェック（Reあり CPN のみ）
 */
function checkStop(
  isRe: boolean,
  consecutiveLossDays: number,
  profit7Days: number,
  roas7Days: number,
  config: JudgmentConfig
): { judgment: JudgmentType; reasons: string[] } | null {
  if (!isRe) return null;

  const reasons: string[] = [];

  if (consecutiveLossDays >= config.stopReConsecutiveLossDays) {
    reasons.push(`${REASON.CONSECUTIVE_LOSS}(${consecutiveLossDays}日)`);
  }

  if (profit7Days < 0 && Math.abs(profit7Days) >= config.lossThreshold7Days) {
    reasons.push(REASON.LOSS_7DAYS);
  }

  if (roas7Days < config.roasThresholdStop) {
    reasons.push(`${REASON.LOW_ROAS}(${Math.round(roas7Days)}%)`);
  }

  if (reasons.length > 0) {
    return { judgment: JUDGMENT.STOP, reasons };
  }

  return null;
}

/**
 * 作り替え条件をチェック（Reなし CPN のみ）
 */
function checkReplace(
  isRe: boolean,
  consecutiveLossDays: number,
  profit7Days: number,
  roas7Days: number,
  config: JudgmentConfig
): { judgment: JudgmentType; reasons: string[] } | null {
  if (isRe) return null;

  const reasons: string[] = [];

  if (consecutiveLossDays >= config.replaceNoReConsecutiveLossDays) {
    reasons.push(`${REASON.CONSECUTIVE_LOSS}(${consecutiveLossDays}日)`);
  }

  if (profit7Days < 0 && Math.abs(profit7Days) >= config.lossThreshold7Days) {
    reasons.push(REASON.LOSS_7DAYS);
  }

  if (roas7Days < config.roasThresholdStop) {
    reasons.push(`${REASON.LOW_ROAS}(${Math.round(roas7Days)}%)`);
  }

  if (reasons.length > 0) {
    return { judgment: JUDGMENT.REPLACE, reasons };
  }

  return null;
}

/**
 * 継続条件をチェック
 */
function checkContinue(
  todayProfit: number,
  profit7Days: number,
  roas7Days: number,
  config: JudgmentConfig
): { judgment: JudgmentType; reasons: string[] } | null {
  const reasons: string[] = [];

  if (profit7Days > 0) {
    reasons.push(REASON.PROFIT_7DAYS);
  }

  if (todayProfit > 0) {
    reasons.push(REASON.PROFIT_TODAY);
  }

  if (roas7Days >= config.roasThresholdContinue) {
    reasons.push(`${REASON.HIGH_ROAS}(${Math.round(roas7Days)}%)`);
  }

  if (reasons.length > 0) {
    return { judgment: JUDGMENT.CONTINUE, reasons };
  }

  return null;
}

/**
 * 推奨アクションを取得
 */
function getRecommendedAction(judgment: JudgmentType): string {
  switch (judgment) {
    case JUDGMENT.STOP:
      return "広告配信を停止してください";
    case JUDGMENT.REPLACE:
      return "クリエイティブの作り替えを検討してください";
    case JUDGMENT.CONTINUE:
      return "現状維持で継続してください";
    case JUDGMENT.CHECK:
      return "個別に状況を確認してください";
  }
}

/**
 * CPNを判定する
 */
export function judgeCpn(cpnData: CpnData, config: JudgmentConfig = DEFAULT_CONFIG): JudgmentResultData {
  const isRe = isReCpn(cpnData.cpnName);
  const todayData = getTodayData(cpnData.dailyData);
  const todayProfit = todayData?.profit ?? 0;
  const last7Days = calculateLastNDays(cpnData.dailyData, 7);
  const consecutiveLossDays = calculateConsecutiveLossDays(cpnData.dailyData);

  // 判定実行（優先順位: 停止 > 作り替え > 継続 > 要確認）
  let result = checkStop(isRe, consecutiveLossDays, last7Days.totalProfit, last7Days.roas, config);
  
  if (!result) {
    result = checkReplace(isRe, consecutiveLossDays, last7Days.totalProfit, last7Days.roas, config);
  }
  
  if (!result) {
    result = checkContinue(todayProfit, last7Days.totalProfit, last7Days.roas, config);
  }
  
  if (!result) {
    result = { judgment: JUDGMENT.CHECK, reasons: [REASON.NO_MATCH] };
  }

  return {
    cpnKey: cpnData.cpnKey,
    cpnName: cpnData.cpnName,
    mediaId: cpnData.mediaId,
    todayProfit,
    profit7Days: last7Days.totalProfit,
    roas7Days: last7Days.roas,
    consecutiveLossDays,
    judgment: result.judgment,
    reasons: result.reasons,
    recommendedAction: getRecommendedAction(result.judgment),
    isRe,
  };
}

