/**
 * CPN自動仕分けシステム - 設定管理
 * 
 * SETTINGSシートから設定値を読み込む
 */

/**
 * デフォルト設定値
 */
const DEFAULT_CONFIG = {
  // 停止条件（Reあり）
  STOP_RE_CONSECUTIVE_LOSS_DAYS: 2,
  
  // 作り替え条件（Reなし）
  REPLACE_NO_RE_CONSECUTIVE_LOSS_DAYS: 3,
  
  // 共通閾値
  LOSS_THRESHOLD_7DAYS: 40000,      // 7日間赤字額閾値
  ROAS_THRESHOLD_STOP: 105,          // 停止/作り替えROAS閾値(%)
  ROAS_THRESHOLD_CONTINUE: 110,      // 継続ROAS閾値(%)
  
  // Chatwork設定
  CHATWORK_ROOM_ID: '',
  CHATWORK_API_TOKEN: '',
  
  // システム設定
  RULE_VERSION: '1.0'
};

/**
 * SETTINGSシートから設定を読み込む
 * @returns {Object} 設定オブジェクト
 */
function loadConfig() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settingsSheet = ss.getSheetByName('SETTINGS');
  
  if (!settingsSheet) {
    Logger.log('SETTINGSシートが見つかりません。デフォルト設定を使用します。');
    return DEFAULT_CONFIG;
  }
  
  const data = settingsSheet.getDataRange().getValues();
  const config = { ...DEFAULT_CONFIG };
  
  // 設定値をパース（A列: キー名, B列: 値）
  for (let i = 1; i < data.length; i++) {
    const key = data[i][0];
    const value = data[i][1];
    
    if (key && value !== '') {
      switch (key) {
        case '停止_Re_連続赤字日数':
          config.STOP_RE_CONSECUTIVE_LOSS_DAYS = Number(value);
          break;
        case '作替_Reなし_連続赤字日数':
          config.REPLACE_NO_RE_CONSECUTIVE_LOSS_DAYS = Number(value);
          break;
        case '赤字額閾値_7日':
          config.LOSS_THRESHOLD_7DAYS = Number(value);
          break;
        case 'ROAS閾値_停止作替':
          config.ROAS_THRESHOLD_STOP = Number(value);
          break;
        case 'ROAS閾値_継続':
          config.ROAS_THRESHOLD_CONTINUE = Number(value);
          break;
        case 'Chatwork_room_id':
          config.CHATWORK_ROOM_ID = String(value);
          break;
        case 'Chatwork_API_token':
          config.CHATWORK_API_TOKEN = String(value);
          break;
        case 'ルールバージョン':
          config.RULE_VERSION = String(value);
          break;
      }
    }
  }
  
  return config;
}

/**
 * 設定値を検証
 * @param {Object} config 設定オブジェクト
 * @returns {Object} {isValid: boolean, errors: string[]}
 */
function validateConfig(config) {
  const errors = [];
  
  if (config.STOP_RE_CONSECUTIVE_LOSS_DAYS < 1) {
    errors.push('停止_Re_連続赤字日数は1以上である必要があります');
  }
  
  if (config.REPLACE_NO_RE_CONSECUTIVE_LOSS_DAYS < 1) {
    errors.push('作替_Reなし_連続赤字日数は1以上である必要があります');
  }
  
  if (config.LOSS_THRESHOLD_7DAYS < 0) {
    errors.push('赤字額閾値は0以上である必要があります');
  }
  
  if (config.ROAS_THRESHOLD_STOP <= 0) {
    errors.push('ROAS閾値（停止/作替）は0より大きい必要があります');
  }
  
  if (config.ROAS_THRESHOLD_CONTINUE <= 0) {
    errors.push('ROAS閾値（継続）は0より大きい必要があります');
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

