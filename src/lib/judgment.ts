// 判定結果の定数
export const JUDGMENT = {
  STOP: "停止",
  REPLACE: "作り替え",
  CONTINUE: "継続",
  ERROR: "エラー",
} as const;

export type JudgmentType = (typeof JUDGMENT)[keyof typeof JUDGMENT];

// 理由タグの定数
export const REASON = {
  RE_7DAYS_LOSS_OVER_30K: "Re有+7日赤字3万超",
  RE_7DAYS_MINUS_CONSECUTIVE_LOSS: "Re有+7日利益マイナス+3日連続赤字",
  RE_CONSECUTIVE_LOSS_3DAYS_7DAYS_PLUS: "Re有+3日連続赤字+7日利益プラス",
  NO_RE_CONSECUTIVE_LOSS_3DAYS: "Reなし+3日連続赤字",
  NOT_STOP_NOT_CONTINUE: "停止・継続条件外",
  TODAY_PROFIT: "当日プラス",
  ROAS_7DAYS_150: "7日ROAS150%以上",
  PROFIT_7DAYS_150K: "7日利益15万以上",
  CONSECUTIVE_LOSS_1DAY: "連続赤字1日以下",
  NO_MATCH: "条件不一致",
} as const;

// CPNデータ型（マイ分析用）
export interface AnalysisCpnData {
  cpnKey: string;
  cpnName: string;
  media: string;
  profit: number;        // 当日利益
  profit7Days: number;   // 7日間利益
  roas7Days: number;     // 7日間ROAS
  consecutiveLoss: number; // 連続マイナス日数
  consecutiveProfit: number; // 連続プラス日数
  accountName?: string;  // アカウント名
}

// 判定結果型
export interface JudgmentResultData {
  cpnKey: string;
  cpnName: string;
  media: string;
  todayProfit: number;
  profit7Days: number;
  roas7Days: number;
  consecutiveLossDays: number;
  consecutiveProfitDays: number;
  judgment: JudgmentType;
  reasons: string[];
  isRe: boolean;
  accountName?: string;  // アカウント名
}

/**
 * CPN名に「_Re」が含まれているかチェック
 */
export function hasRe(cpnName: string): boolean {
  return cpnName.includes("_Re");
}

/**
 * 停止条件をチェック
 * 1. _Reあり + 7日利益が-30,000円以下
 * 2. _Reあり + 7日利益マイナス + 当日含む直近3日連続赤字
 */
function checkStop(
  isRe: boolean,
  profit7Days: number,
  todayProfit: number,
  consecutiveLoss: number
): { judgment: JudgmentType; reasons: string[] } | null {
  if (!isRe) return null;

  const reasons: string[] = [];

  // 条件1: _Reあり + 7日利益が-30,000円以下
  if (profit7Days <= -30000) {
    reasons.push(REASON.RE_7DAYS_LOSS_OVER_30K);
  }

  // 条件2: _Reあり + 7日利益マイナス + 当日含む直近3日連続赤字
  // 当日が赤字 かつ 過去の赤字日数が2日以上 = 3日連続赤字とみなす
  if (profit7Days < 0 && todayProfit < 0 && consecutiveLoss >= 2) {
    reasons.push(REASON.RE_7DAYS_MINUS_CONSECUTIVE_LOSS);
  }

  if (reasons.length > 0) {
    return { judgment: JUDGMENT.STOP, reasons };
  }

  return null;
}

/**
 * 継続条件をチェック
 * - 当日黒字 OR
 * - 7日ROAS 150%以上 OR
 * - 7日利益 15万円以上 OR
 * - 連続赤字1日以下
 */
function checkContinue(
  todayProfit: number,
  profit7Days: number,
  roas7Days: number,
  consecutiveLoss: number
): { judgment: JudgmentType; reasons: string[] } | null {
  const reasons: string[] = [];

  // 当日黒字
  if (todayProfit >= 0) {
    reasons.push(REASON.TODAY_PROFIT);
  }

  // 7日ROAS 150%以上
  if (roas7Days >= 150) {
    reasons.push(REASON.ROAS_7DAYS_150);
  }

  // 7日利益 15万円以上
  if (profit7Days >= 150000) {
    reasons.push(REASON.PROFIT_7DAYS_150K);
  }

  // 連続赤字1日以下
  if (consecutiveLoss <= 1) {
    reasons.push(REASON.CONSECUTIVE_LOSS_1DAY);
  }

  if (reasons.length > 0) {
    return { judgment: JUDGMENT.CONTINUE, reasons };
  }

  return null;
}

/**
 * 作り替え条件をチェック
 * 1. _Reあり + 過去3日連続赤字（当日含む）
 * 2. 停止でも継続でもないもの
 */
function checkReplace(
  isRe: boolean,
  consecutiveLoss: number,
  todayProfit: number,
  isStopOrContinue: boolean
): { judgment: JudgmentType; reasons: string[] } | null {
  const reasons: string[] = [];

  // 条件1: _Reあり + 過去3日連続赤字（当日含む）
  // 当日が赤字 かつ 過去の赤字日数が2日以上 = 3日連続赤字とみなす
  if (isRe && todayProfit < 0 && consecutiveLoss >= 2) {
    reasons.push(REASON.RE_CONSECUTIVE_LOSS_3DAYS);
  }

  // 条件2: 停止でも継続でもないもの
  if (!isStopOrContinue && reasons.length === 0) {
    reasons.push(REASON.NOT_STOP_NOT_CONTINUE);
  }

  if (reasons.length > 0) {
    return { judgment: JUDGMENT.REPLACE, reasons };
  }

  return null;
}

/**
 * CPNを判定する（マイ分析データ用）
 * 
 * 優先順位:
 * 1. 停止 (_Reあり + 7日利益-3万以下)
 * 2. 作り替え (_Reあり + 過去3日連続赤字)
 * 3. 継続 (当日黒字 OR 7日ROAS150%以上 OR 連続赤字1日以下)
 * 4. 作り替え (上記以外)
 * 5. エラー (どれにも該当しない)
 */
export function judgeAnalysisCpn(cpnData: AnalysisCpnData): JudgmentResultData {
  const isRe = hasRe(cpnData.cpnName);
  const todayProfit = cpnData.profit;
  const profit7Days = cpnData.profit7Days;
  const roas7Days = cpnData.roas7Days;
  const consecutiveLoss = cpnData.consecutiveLoss;
  const consecutiveProfit = cpnData.consecutiveProfit || 0;

  // 1. 停止条件をチェック (_Reあり + 7日利益-3万以下 OR 7日利益マイナス+3日連続赤字)
  const stopResult = checkStop(isRe, profit7Days, todayProfit, consecutiveLoss);
  if (stopResult) {
    return {
      cpnKey: cpnData.cpnKey,
      cpnName: cpnData.cpnName,
      media: cpnData.media,
      todayProfit,
      profit7Days,
      roas7Days,
      consecutiveLossDays: consecutiveLoss,
      consecutiveProfitDays: consecutiveProfit,
      judgment: stopResult.judgment,
      reasons: stopResult.reasons,
      isRe,
      accountName: cpnData.accountName,
    };
  }

  // 2. 作り替え条件をチェック（3日連続赤字）← 継続より先にチェック
  // 当日が赤字 かつ 過去の赤字日数が2日以上 = 3日連続赤字
  // _Reあり: 3日連続赤字 + 7日利益プラス → 作り替え
  // _Reなし: 3日連続赤字 → 作り替え
  if (todayProfit < 0 && consecutiveLoss >= 2) {
    if (isRe && profit7Days >= 0) {
      // _Reあり + 3日連続赤字 + 7日利益プラス
      return {
        cpnKey: cpnData.cpnKey,
        cpnName: cpnData.cpnName,
        media: cpnData.media,
        todayProfit,
        profit7Days,
        roas7Days,
        consecutiveLossDays: consecutiveLoss,
        consecutiveProfitDays: consecutiveProfit,
        judgment: JUDGMENT.REPLACE,
        reasons: [REASON.RE_CONSECUTIVE_LOSS_3DAYS_7DAYS_PLUS],
        isRe,
        accountName: cpnData.accountName,
      };
    } else if (!isRe) {
      // _Reなし + 3日連続赤字
      return {
        cpnKey: cpnData.cpnKey,
        cpnName: cpnData.cpnName,
        media: cpnData.media,
        todayProfit,
        profit7Days,
        roas7Days,
        consecutiveLossDays: consecutiveLoss,
        consecutiveProfitDays: consecutiveProfit,
        judgment: JUDGMENT.REPLACE,
        reasons: [REASON.NO_RE_CONSECUTIVE_LOSS_3DAYS],
        isRe,
        accountName: cpnData.accountName,
      };
    }
  }

  // 3. 継続条件をチェック
  const continueResult = checkContinue(todayProfit, profit7Days, roas7Days, consecutiveLoss);
  if (continueResult) {
    return {
      cpnKey: cpnData.cpnKey,
      cpnName: cpnData.cpnName,
      media: cpnData.media,
      todayProfit,
      profit7Days,
      roas7Days,
      consecutiveLossDays: consecutiveLoss,
      consecutiveProfitDays: consecutiveProfit,
      judgment: continueResult.judgment,
      reasons: continueResult.reasons,
      isRe,
      accountName: cpnData.accountName,
    };
  }

  // 4. 作り替え条件をチェック（停止・継続以外）
  const replaceResult = checkReplace(isRe, consecutiveLoss, todayProfit, false);
  if (replaceResult) {
    return {
      cpnKey: cpnData.cpnKey,
      cpnName: cpnData.cpnName,
      media: cpnData.media,
      todayProfit,
      profit7Days,
      roas7Days,
      consecutiveLossDays: consecutiveLoss,
      consecutiveProfitDays: consecutiveProfit,
      judgment: replaceResult.judgment,
      reasons: replaceResult.reasons,
      isRe,
      accountName: cpnData.accountName,
    };
  }

  // 5. どれにも該当しない → エラー
  return {
    cpnKey: cpnData.cpnKey,
    cpnName: cpnData.cpnName,
    media: cpnData.media,
    todayProfit,
    profit7Days,
    roas7Days,
    consecutiveLossDays: consecutiveLoss,
    consecutiveProfitDays: consecutiveProfit,
    judgment: JUDGMENT.ERROR,
    reasons: [REASON.NO_MATCH],
    isRe,
    accountName: cpnData.accountName,
  };
}

/**
 * 複数のCPNを一括判定
 */
export function judgeAllCpns(cpnList: AnalysisCpnData[]): JudgmentResultData[] {
  return cpnList.map((cpn) => judgeAnalysisCpn(cpn));
}

/**
 * 判定結果のサマリーを取得
 */
export function getJudgmentSummary(results: JudgmentResultData[]) {
  return {
    stop: results.filter((r) => r.judgment === JUDGMENT.STOP).length,
    replace: results.filter((r) => r.judgment === JUDGMENT.REPLACE).length,
    continue: results.filter((r) => r.judgment === JUDGMENT.CONTINUE).length,
    error: results.filter((r) => r.judgment === JUDGMENT.ERROR).length,
    total: results.length,
  };
}
