// 異常検知AI

export interface DataPoint {
  date: string;
  value: number;
}

export interface AnomalyResult {
  isAnomaly: boolean;
  type: 'spike' | 'drop' | 'trend_change' | 'outlier' | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  changePercent: number;
  message: string;
  recommendation: string;
}

export interface CpnAnomalyCheck {
  cpnName: string;
  metric: string;
  currentValue: number;
  previousValue: number;
  average7d: number;
  stdDev: number;
  result: AnomalyResult;
}

// 標準偏差を計算
function calculateStdDev(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const squareDiffs = values.map(value => Math.pow(value - mean, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / n;
  
  return Math.sqrt(avgSquareDiff);
}

// 移動平均を計算
function calculateMovingAverage(values: number[], window: number): number {
  if (values.length === 0) return 0;
  const slice = values.slice(-window);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

// Zスコアを計算
function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

// 変化率を計算
function calculateChangePercent(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

// 異常検知メイン関数
export function detectAnomaly(
  currentValue: number,
  historicalValues: number[],
  config: {
    zScoreThreshold?: number;
    changeThreshold?: number;
    minDataPoints?: number;
  } = {}
): AnomalyResult {
  const {
    zScoreThreshold = 2.5,
    changeThreshold = 50,
    minDataPoints = 3
  } = config;

  // データ不足の場合
  if (historicalValues.length < minDataPoints) {
    return {
      isAnomaly: false,
      type: null,
      severity: 'low',
      changePercent: 0,
      message: 'データ不足のため判定できません',
      recommendation: 'データが蓄積されるまでお待ちください'
    };
  }

  const mean = calculateMovingAverage(historicalValues, 7);
  const stdDev = calculateStdDev(historicalValues);
  const zScore = calculateZScore(currentValue, mean, stdDev);
  const previousValue = historicalValues[historicalValues.length - 1] || 0;
  const changePercent = calculateChangePercent(currentValue, previousValue);

  // 異常判定
  let isAnomaly = false;
  let type: AnomalyResult['type'] = null;
  let severity: AnomalyResult['severity'] = 'low';
  let message = '';
  let recommendation = '';

  // Zスコアによる外れ値検出
  if (Math.abs(zScore) > zScoreThreshold) {
    isAnomaly = true;
    type = zScore > 0 ? 'spike' : 'drop';
    
    if (Math.abs(zScore) > 4) {
      severity = 'critical';
    } else if (Math.abs(zScore) > 3) {
      severity = 'high';
    } else {
      severity = 'medium';
    }
  }

  // 急激な変化の検出
  if (Math.abs(changePercent) > changeThreshold) {
    isAnomaly = true;
    type = changePercent > 0 ? 'spike' : 'drop';
    
    if (Math.abs(changePercent) > 100) {
      severity = 'critical';
    } else if (Math.abs(changePercent) > 75) {
      severity = 'high';
    } else {
      severity = 'medium';
    }
  }

  // メッセージ生成
  if (isAnomaly) {
    if (type === 'spike') {
      message = `急激な上昇を検出（+${changePercent.toFixed(1)}%）`;
      recommendation = changePercent > 0 && currentValue > 0
        ? '好調です！予算増額を検討してください'
        : '消化が急増しています。CPAを確認してください';
    } else if (type === 'drop') {
      message = `急激な下降を検出（${changePercent.toFixed(1)}%）`;
      recommendation = '配信が大幅に減少しています。クリエイティブや入札を確認してください';
    }
  } else {
    message = '正常範囲内です';
    recommendation = '現状維持で問題ありません';
  }

  return {
    isAnomaly,
    type,
    severity,
    changePercent,
    message,
    recommendation
  };
}

// CPN単位で異常検知を実行
export function checkCpnAnomalies(
  cpnData: {
    cpnName: string;
    spend: number;
    profit: number;
    mcv: number;
    cv: number;
    roas: number;
    historical?: {
      spend: number[];
      profit: number[];
      mcv: number[];
      cv: number[];
      roas: number[];
    };
  }[]
): CpnAnomalyCheck[] {
  const results: CpnAnomalyCheck[] = [];

  for (const cpn of cpnData) {
    const historical = cpn.historical || {
      spend: [],
      profit: [],
      mcv: [],
      cv: [],
      roas: []
    };

    // 各指標をチェック
    const metrics = [
      { name: '消化', current: cpn.spend, history: historical.spend },
      { name: '利益', current: cpn.profit, history: historical.profit },
      { name: 'MCV', current: cpn.mcv, history: historical.mcv },
      { name: 'CV', current: cpn.cv, history: historical.cv },
      { name: 'ROAS', current: cpn.roas, history: historical.roas }
    ];

    for (const metric of metrics) {
      const result = detectAnomaly(
        metric.current,
        metric.history,
        { 
          zScoreThreshold: metric.name === '利益' ? 2 : 2.5,
          changeThreshold: metric.name === '利益' ? 30 : 50
        }
      );

      if (result.isAnomaly) {
        results.push({
          cpnName: cpn.cpnName,
          metric: metric.name,
          currentValue: metric.current,
          previousValue: metric.history[metric.history.length - 1] || 0,
          average7d: calculateMovingAverage(metric.history, 7),
          stdDev: calculateStdDev(metric.history),
          result
        });
      }
    }
  }

  // 重要度でソート
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  results.sort((a, b) => severityOrder[a.result.severity] - severityOrder[b.result.severity]);

  return results;
}

// GPT-4で詳細分析
export async function analyzeAnomalyWithAI(
  anomalies: CpnAnomalyCheck[]
): Promise<string> {
  if (anomalies.length === 0) {
    return '現在、異常は検出されていません。';
  }

  const criticalCount = anomalies.filter(a => a.result.severity === 'critical').length;
  const highCount = anomalies.filter(a => a.result.severity === 'high').length;

  let analysis = `## 🔍 異常検知サマリー\n\n`;
  analysis += `- 🚨 クリティカル: ${criticalCount}件\n`;
  analysis += `- ⚠️ 高: ${highCount}件\n`;
  analysis += `- 📊 合計: ${anomalies.length}件\n\n`;

  analysis += `## 📋 詳細\n\n`;

  for (const anomaly of anomalies.slice(0, 5)) {
    const emoji = anomaly.result.severity === 'critical' ? '🚨' :
                  anomaly.result.severity === 'high' ? '⚠️' : '📊';
    
    analysis += `### ${emoji} ${anomaly.cpnName}\n`;
    analysis += `- **指標**: ${anomaly.metric}\n`;
    analysis += `- **変化**: ${anomaly.previousValue.toLocaleString()} → ${anomaly.currentValue.toLocaleString()} (${anomaly.result.changePercent > 0 ? '+' : ''}${anomaly.result.changePercent.toFixed(1)}%)\n`;
    analysis += `- **判定**: ${anomaly.result.message}\n`;
    analysis += `- **推奨**: ${anomaly.result.recommendation}\n\n`;
  }

  return analysis;
}

