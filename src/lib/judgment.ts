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
  RE_CONSECUTIVE_LOSS_7DAYS_MINUS: "Re有+連続赤字3日+7日マイナス",
  RE_7DAYS_LOSS_OVER_30K: "Re有+7日赤字3万超",
  RE_CONSECUTIVE_LOSS_7DAYS_PLUS: "Re有+連続赤字3日+7日プラス",
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
  consecutiveLoss: number; // 連続赤字日数
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
 * 1. _Reあり + 連続赤字3日以上 + 7日利益マイナス
 * 2. _Reあり + 7日利益が-30,000円以下
 */
function checkStop(
  isRe: boolean,
  consecutiveLoss: number,
  profit7Days: number
): { judgment: JudgmentType; reasons: string[] } | null {
  if (!isRe) return null;

  const reasons: string[] = [];

  // 条件1: _Reあり + 連続赤字3日以上 + 7日利益マイナス
  if (consecutiveLoss >= 3 && profit7Days < 0) {
    reasons.push(REASON.RE_CONSECUTIVE_LOSS_7DAYS_MINUS);
  }

  // 条件2: _Reあり + 7日利益が-30,000円以下
  if (profit7Days <= -30000) {
    reasons.push(REASON.RE_7DAYS_LOSS_OVER_30K);
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
 * 1. _Reあり + 連続赤字3日以上 + 7日利益プラス
 * 2. 停止でも継続でもないもの
 */
function checkReplace(
  isRe: boolean,
  consecutiveLoss: number,
  profit7Days: number,
  isStopOrContinue: boolean
): { judgment: JudgmentType; reasons: string[] } | null {
  const reasons: string[] = [];

  // 条件1: _Reあり + 連続赤字3日以上 + 7日利益プラス
  if (isRe && consecutiveLoss >= 3 && profit7Days >= 0) {
    reasons.push(REASON.RE_CONSECUTIVE_LOSS_7DAYS_PLUS);
  }

  // 条件2: 停止でも継続でもないもの
  if (!isStopOrContinue) {
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
 * 1. 停止 (_Reあり + 連続赤字3日以上 + 7日利益マイナス OR 7日利益-3万以下)
 * 2. 作り替え (_Reあり + 連続赤字3日以上)
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

  // 1. 停止条件をチェック
  const stopResult = checkStop(isRe, consecutiveLoss, profit7Days);
  if (stopResult) {
    return {
      cpnKey: cpnData.cpnKey,
      cpnName: cpnData.cpnName,
      media: cpnData.media,
      todayProfit,
      profit7Days,
      roas7Days,
      consecutiveLossDays: consecutiveLoss,
      judgment: stopResult.judgment,
      reasons: stopResult.reasons,
      isRe,
      accountName: cpnData.accountName,
    };
  }

  // 2. 作り替え条件をチェック（_Reあり + 連続赤字3日以上）← 継続より先にチェック
  if (isRe && consecutiveLoss >= 3) {
    const reasons: string[] = [];
    if (profit7Days >= 0) {
      reasons.push(REASON.RE_CONSECUTIVE_LOSS_7DAYS_PLUS);
    } else {
      reasons.push(`${REASON.RE_CONSECUTIVE_LOSS_7DAYS_MINUS}(継続条件該当)`);
    }
    return {
      cpnKey: cpnData.cpnKey,
      cpnName: cpnData.cpnName,
      media: cpnData.media,
      todayProfit,
      profit7Days,
      roas7Days,
      consecutiveLossDays: consecutiveLoss,
      judgment: JUDGMENT.REPLACE,
      reasons,
      isRe,
      accountName: cpnData.accountName,
    };
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
      judgment: continueResult.judgment,
      reasons: continueResult.reasons,
      isRe,
      accountName: cpnData.accountName,
    };
  }

  // 4. 作り替え条件をチェック（停止・継続以外）
  const replaceResult = checkReplace(isRe, consecutiveLoss, profit7Days, false);
  if (replaceResult) {
    return {
      cpnKey: cpnData.cpnKey,
      cpnName: cpnData.cpnName,
      media: cpnData.media,
      todayProfit,
      profit7Days,
      roas7Days,
      consecutiveLossDays: consecutiveLoss,
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
