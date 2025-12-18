/**
 * CPN自動仕分けシステム - 判定ロジック
 */

/**
 * 判定結果の定数
 */
const JUDGMENT = {
  STOP: '停止',
  REPLACE: '作り替え',
  CONTINUE: '継続',
  CHECK: '要確認'
};

/**
 * 理由タグの定数
 */
const REASON = {
  CONSECUTIVE_LOSS: '連続赤字',
  LOSS_7DAYS: '7日間赤字超過',
  LOW_ROAS: 'ROAS基準未達',
  PROFIT_7DAYS: '7日間黒字',
  PROFIT_TODAY: '当日黒字',
  HIGH_ROAS: 'ROAS基準達成',
  NO_MATCH: '条件不一致'
};

/**
 * CPNを判定する
 * @param {Object} cpnData CPNデータ
 * @param {Object} config 設定
 * @returns {Object} 判定結果
 */
function judgeCpn(cpnData, config) {
  const isRe = isReCpn(cpnData.cpnName);
  const dailyData = cpnData.dailyData;
  
  // 当日データ
  const todayData = getTodayData(dailyData);
  const todayProfit = todayData ? todayData.profit : 0;
  
  // 直近7日間の集計
  const last7Days = calculateLastNDays(dailyData, 7);
  
  // 連続赤字日数
  const consecutiveLossDays = calculateConsecutiveLossDays(dailyData);
  
  // 判定用データ
  const metrics = {
    todayProfit: todayProfit,
    profit7Days: last7Days.totalProfit,
    roas7Days: last7Days.roas,
    consecutiveLossDays: consecutiveLossDays,
    isRe: isRe
  };
  
  // 判定実行（優先順位: 停止 > 作り替え > 継続 > 要確認）
  let result = checkStop(metrics, config);
  if (result) return buildResult(cpnData, metrics, result);
  
  result = checkReplace(metrics, config);
  if (result) return buildResult(cpnData, metrics, result);
  
  result = checkContinue(metrics, config);
  if (result) return buildResult(cpnData, metrics, result);
  
  // いずれにも該当しない場合は要確認
  return buildResult(cpnData, metrics, {
    judgment: JUDGMENT.CHECK,
    reasons: [REASON.NO_MATCH]
  });
}

/**
 * 停止条件をチェック（Reあり CPN のみ）
 * @param {Object} metrics 指標データ
 * @param {Object} config 設定
 * @returns {Object|null} 判定結果またはnull
 */
function checkStop(metrics, config) {
  // Reあり CPNのみが停止対象
  if (!metrics.isRe) return null;
  
  const reasons = [];
  
  // 条件1: 連続赤字日数 ≥ 設定値
  if (metrics.consecutiveLossDays >= config.STOP_RE_CONSECUTIVE_LOSS_DAYS) {
    reasons.push(REASON.CONSECUTIVE_LOSS + `(${metrics.consecutiveLossDays}日)`);
  }
  
  // 条件2: 直近7日間赤字額 ≥ 閾値（利益がマイナスで、その絶対値が閾値以上）
  if (metrics.profit7Days < 0 && Math.abs(metrics.profit7Days) >= config.LOSS_THRESHOLD_7DAYS) {
    reasons.push(REASON.LOSS_7DAYS);
  }
  
  // 条件3: 直近7日間ROAS < 閾値
  if (metrics.roas7Days < config.ROAS_THRESHOLD_STOP) {
    reasons.push(REASON.LOW_ROAS + `(${Math.round(metrics.roas7Days)}%)`);
  }
  
  if (reasons.length > 0) {
    return {
      judgment: JUDGMENT.STOP,
      reasons: reasons
    };
  }
  
  return null;
}

/**
 * 作り替え条件をチェック（Reなし CPN のみ）
 * @param {Object} metrics 指標データ
 * @param {Object} config 設定
 * @returns {Object|null} 判定結果またはnull
 */
function checkReplace(metrics, config) {
  // Reなし CPNのみが作り替え対象
  if (metrics.isRe) return null;
  
  const reasons = [];
  
  // 条件1: 連続赤字日数 ≥ 設定値
  if (metrics.consecutiveLossDays >= config.REPLACE_NO_RE_CONSECUTIVE_LOSS_DAYS) {
    reasons.push(REASON.CONSECUTIVE_LOSS + `(${metrics.consecutiveLossDays}日)`);
  }
  
  // 条件2: 直近7日間赤字額 ≥ 閾値
  if (metrics.profit7Days < 0 && Math.abs(metrics.profit7Days) >= config.LOSS_THRESHOLD_7DAYS) {
    reasons.push(REASON.LOSS_7DAYS);
  }
  
  // 条件3: 直近7日間ROAS < 閾値
  if (metrics.roas7Days < config.ROAS_THRESHOLD_STOP) {
    reasons.push(REASON.LOW_ROAS + `(${Math.round(metrics.roas7Days)}%)`);
  }
  
  if (reasons.length > 0) {
    return {
      judgment: JUDGMENT.REPLACE,
      reasons: reasons
    };
  }
  
  return null;
}

/**
 * 継続条件をチェック
 * @param {Object} metrics 指標データ
 * @param {Object} config 設定
 * @returns {Object|null} 判定結果またはnull
 */
function checkContinue(metrics, config) {
  const reasons = [];
  
  // 条件1: 直近7日間利益 > 0
  if (metrics.profit7Days > 0) {
    reasons.push(REASON.PROFIT_7DAYS);
  }
  
  // 条件2: 当日利益 > 0
  if (metrics.todayProfit > 0) {
    reasons.push(REASON.PROFIT_TODAY);
  }
  
  // 条件3: 直近7日間ROAS ≥ 継続閾値
  if (metrics.roas7Days >= config.ROAS_THRESHOLD_CONTINUE) {
    reasons.push(REASON.HIGH_ROAS + `(${Math.round(metrics.roas7Days)}%)`);
  }
  
  if (reasons.length > 0) {
    return {
      judgment: JUDGMENT.CONTINUE,
      reasons: reasons
    };
  }
  
  return null;
}

/**
 * 判定結果オブジェクトを構築
 * @param {Object} cpnData CPNデータ
 * @param {Object} metrics 指標データ
 * @param {Object} judgmentResult 判定結果
 * @returns {Object} 完全な判定結果
 */
function buildResult(cpnData, metrics, judgmentResult) {
  // 推奨アクションを決定
  let recommendedAction = '';
  switch (judgmentResult.judgment) {
    case JUDGMENT.STOP:
      recommendedAction = '広告配信を停止してください';
      break;
    case JUDGMENT.REPLACE:
      recommendedAction = 'クリエイティブの作り替えを検討してください';
      break;
    case JUDGMENT.CONTINUE:
      recommendedAction = '現状維持で継続してください';
      break;
    case JUDGMENT.CHECK:
      recommendedAction = '個別に状況を確認してください';
      break;
  }
  
  return {
    media: cpnData.media,
    cpnName: cpnData.cpnName,
    cpnKey: cpnData.cpnKey,
    todayProfit: metrics.todayProfit,
    profit7Days: metrics.profit7Days,
    roas7Days: metrics.roas7Days,
    consecutiveLossDays: metrics.consecutiveLossDays,
    judgment: judgmentResult.judgment,
    reasons: judgmentResult.reasons,
    recommendedAction: recommendedAction,
    isRe: metrics.isRe
  };
}

/**
 * 判定結果を判定タイプ別にグループ化
 * @param {Array} results 判定結果の配列
 * @returns {Object} グループ化された結果
 */
function groupResultsByJudgment(results) {
  return {
    stop: results.filter(r => r.judgment === JUDGMENT.STOP),
    replace: results.filter(r => r.judgment === JUDGMENT.REPLACE),
    continue: results.filter(r => r.judgment === JUDGMENT.CONTINUE),
    check: results.filter(r => r.judgment === JUDGMENT.CHECK)
  };
}

