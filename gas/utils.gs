/**
 * CPN自動仕分けシステム - ユーティリティ関数
 */

/**
 * CPNがReありかどうかを判定
 * @param {string} cpnName CPN名
 * @returns {boolean} Reありの場合true
 */
function isReCpn(cpnName) {
  if (!cpnName) return false;
  return cpnName.includes('_Re');
}

/**
 * 日付をYYYY/MM/DD形式にフォーマット
 * @param {Date} date 日付
 * @returns {string} フォーマットされた日付文字列
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

/**
 * 今日の日付を取得（時刻なし）
 * @returns {Date} 今日の日付
 */
function getToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * 指定日数前の日付を取得
 * @param {number} days 日数
 * @returns {Date} 指定日数前の日付
 */
function getDaysAgo(days) {
  const today = getToday();
  return new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
}

/**
 * 数値を通貨形式にフォーマット
 * @param {number} value 数値
 * @returns {string} フォーマットされた文字列
 */
function formatCurrency(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return '¥0';
  }
  const sign = value < 0 ? '-' : '';
  const absValue = Math.abs(Math.round(value));
  return sign + '¥' + absValue.toLocaleString('ja-JP');
}

/**
 * パーセンテージをフォーマット
 * @param {number} value パーセンテージ値
 * @returns {string} フォーマットされた文字列
 */
function formatPercentage(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return '0%';
  }
  return Math.round(value) + '%';
}

/**
 * RAWデータをCPN単位でグループ化
 * @param {Array} rawData RAWシートのデータ
 * @param {Object} columnIndex 列インデックスのマッピング
 * @returns {Object} CPNキーをキーとしたオブジェクト
 */
function groupByCpn(rawData, columnIndex) {
  const grouped = {};
  
  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    const cpnKey = row[columnIndex.cpnKey];
    
    if (!cpnKey) continue;
    
    if (!grouped[cpnKey]) {
      grouped[cpnKey] = {
        cpnKey: cpnKey,
        cpnName: row[columnIndex.cpnName],
        media: row[columnIndex.media],
        dailyData: []
      };
    }
    
    grouped[cpnKey].dailyData.push({
      date: row[columnIndex.date],
      spend: Number(row[columnIndex.spend]) || 0,
      revenue: Number(row[columnIndex.revenue]) || 0,
      profit: Number(row[columnIndex.profit]) || 0,
      roas: Number(row[columnIndex.roas]) || 0,
      cv: Number(row[columnIndex.cv]) || 0,
      mcv: Number(row[columnIndex.mcv]) || 0,
      cpm: Number(row[columnIndex.cpm]) || 0,
      cpc: Number(row[columnIndex.cpc]) || 0
    });
  }
  
  // 日付でソート（新しい順）
  for (const cpnKey in grouped) {
    grouped[cpnKey].dailyData.sort((a, b) => new Date(b.date) - new Date(a.date));
  }
  
  return grouped;
}

/**
 * RAWシートの列インデックスを取得
 * @param {Array} headerRow ヘッダー行
 * @returns {Object} 列インデックスのマッピング
 */
function getColumnIndex(headerRow) {
  const mapping = {
    media: -1,
    cpnKey: -1,
    cpnName: -1,
    date: -1,
    spend: -1,
    revenue: -1,
    profit: -1,
    roas: -1,
    cv: -1,
    mcv: -1,
    cpm: -1,
    cpc: -1
  };
  
  const columnNames = {
    '媒体': 'media',
    'CPNキー': 'cpnKey',
    'CPN名': 'cpnName',
    '日付': 'date',
    '消化金額': 'spend',
    '売上': 'revenue',
    '利益': 'profit',
    'ROAS': 'roas',
    'CV': 'cv',
    'MCV': 'mcv',
    'CPM': 'cpm',
    'CPC': 'cpc'
  };
  
  for (let i = 0; i < headerRow.length; i++) {
    const header = String(headerRow[i]).trim();
    if (columnNames[header]) {
      mapping[columnNames[header]] = i;
    }
  }
  
  return mapping;
}

/**
 * 連続赤字日数を計算
 * @param {Array} dailyData 日次データ（新しい順でソート済み）
 * @returns {number} 連続赤字日数
 */
function calculateConsecutiveLossDays(dailyData) {
  let count = 0;
  
  for (let i = 0; i < dailyData.length; i++) {
    if (dailyData[i].profit < 0) {
      count++;
    } else {
      break; // 黒字になったらカウント停止
    }
  }
  
  return count;
}

/**
 * 直近N日間の集計値を計算
 * @param {Array} dailyData 日次データ（新しい順でソート済み）
 * @param {number} days 日数
 * @returns {Object} 集計結果
 */
function calculateLastNDays(dailyData, days) {
  const targetData = dailyData.slice(0, days);
  
  let totalSpend = 0;
  let totalRevenue = 0;
  let totalProfit = 0;
  
  for (let i = 0; i < targetData.length; i++) {
    totalSpend += targetData[i].spend;
    totalRevenue += targetData[i].revenue;
    totalProfit += targetData[i].profit;
  }
  
  // ROAS = 売上 / 消化金額 * 100
  const roas = totalSpend > 0 ? (totalRevenue / totalSpend) * 100 : 0;
  
  return {
    totalSpend: totalSpend,
    totalRevenue: totalRevenue,
    totalProfit: totalProfit,
    roas: roas,
    daysCount: targetData.length
  };
}

/**
 * 当日のデータを取得
 * @param {Array} dailyData 日次データ（新しい順でソート済み）
 * @returns {Object|null} 当日のデータ
 */
function getTodayData(dailyData) {
  if (dailyData.length === 0) return null;
  
  // 最新のデータを当日として扱う
  return dailyData[0];
}

/**
 * エラーをログに記録
 * @param {string} message エラーメッセージ
 * @param {Error} error エラーオブジェクト
 */
function logError(message, error) {
  Logger.log(`[ERROR] ${message}: ${error.message}`);
  Logger.log(error.stack);
}

/**
 * 情報をログに記録
 * @param {string} message メッセージ
 */
function logInfo(message) {
  Logger.log(`[INFO] ${message}`);
}

