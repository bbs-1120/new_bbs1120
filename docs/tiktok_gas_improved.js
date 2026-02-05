/**
 * ==========================================================
 * TikTok Ads Manager - 改良版 v4.0
 * 
 * 【主な改善点】
 * 1. キャンペーン/広告セット/広告のON/OFF機能追加
 * 2. Upgraded Smart Plus (SPC) キャンペーン対応
 * 3. PropertiesServiceによるトークン管理
 * 4. 指数バックオフ付きリトライ機能
 * 5. ChatWork通知機能
 * 6. 一括操作機能
 * 7. 詳細なエラーログ
 * ==========================================================
 */

// ========== 設定 ==========
const CONFIG = {
  // APIエンドポイント
  API_BASE: "https://business-api.tiktok.com/open_api/v1.3",
  
  // リトライ設定
  MAX_RETRIES: 3,
  INITIAL_DELAY_MS: 1000,
  
  // バッチサイズ
  BATCH_SIZE: 50,
  CAMPAIGN_BATCH_SIZE: 30,
  
  // シート名
  SHEET_TODAY: 'TikTok_Today',
  SHEET_YESTERDAY: 'TikTok_Yesterday',
  SHEET_ACCOUNTS: '広告アカウント一覧',
  SHEET_CONTROL: 'ON_OFF制御', // 新規シート
};

// ========== 初期設定 ==========
/**
 * 初回セットアップ - PropertiesServiceにトークンを保存
 * ★ 実行後は関数内のトークンを削除してください
 */
function initialSetup() {
  const props = PropertiesService.getScriptProperties();
  
  // ★ ここにトークンを入力して実行後、削除してください
  props.setProperties({
    'TIKTOK_ACCESS_TOKEN': '544f7c0ba64ca9f7dd50874a035a34205ec93fac', // ← 実行後削除
    'TIKTOK_APP_ID': '7259642503828078594',
    'TIKTOK_SECRET': 'be57c53d17dd5b0ca4fe1ecb8d9dd926b0910f83', // ← 実行後削除
    'CHATWORK_API_TOKEN': '50bc1f810382deb087d1f67bb8f243d6', // ← 実行後削除
    'CHATWORK_ROOM_ID': '407653961',
  });
  
  Logger.log('✅ 初期設定完了！トークンをコードから削除してください。');
}

/**
 * トークンを取得
 */
function getAccessToken() {
  return PropertiesService.getScriptProperties().getProperty('TIKTOK_ACCESS_TOKEN');
}

// ========== メニュー ==========
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🚀 TikTok Ads Manager')
    .addSubMenu(ui.createMenu('📊 データ取得')
      .addItem('当日の数値を更新', 'getTodayTiktokData')
      .addItem('前日の数値を更新', 'getYesterdayTiktokData'))
    .addSeparator()
    .addSubMenu(ui.createMenu('⚡ キャンペーン操作')
      .addItem('選択したキャンペーンをON', 'turnOnSelectedCampaigns')
      .addItem('選択したキャンペーンをOFF', 'turnOffSelectedCampaigns'))
    .addSubMenu(ui.createMenu('📦 広告セット操作')
      .addItem('選択した広告セットをON', 'turnOnSelectedAdGroups')
      .addItem('選択した広告セットをOFF', 'turnOffSelectedAdGroups'))
    .addSubMenu(ui.createMenu('📝 広告操作')
      .addItem('選択した広告をON', 'turnOnSelectedAds')
      .addItem('選択した広告をOFF', 'turnOffSelectedAds'))
    .addSeparator()
    .addItem('⚙️ 設定を確認', 'checkSettings')
    .addToUi();
}

// ========== ON/OFF制御機能 ==========

/**
 * キャンペーンのステータスを変更（Upgraded Smart Plus対応）
 * @param {string} advertiserId - 広告主ID
 * @param {string[]} campaignIds - キャンペーンIDの配列
 * @param {string} status - 'ENABLE' または 'DISABLE'
 * @returns {Object} 結果オブジェクト
 */
function updateCampaignStatus(advertiserId, campaignIds, status) {
  const accessToken = getAccessToken();
  const results = { success: [], failed: [], spcRetried: [] };
  
  // バッチ処理
  for (let i = 0; i < campaignIds.length; i += CONFIG.BATCH_SIZE) {
    const batch = campaignIds.slice(i, i + CONFIG.BATCH_SIZE);
    
    try {
      // 通常のキャンペーン更新API
      const response = callTikTokApiWithRetry(
        `${CONFIG.API_BASE}/campaign/update/`,
        'POST',
        accessToken,
        {
          advertiser_id: advertiserId,
          campaign_ids: batch,
          operation_status: status
        }
      );
      
      if (response.code === 0) {
        results.success.push(...batch);
      } else {
        // Upgraded Smart Plus エラーの場合、SPC APIを試行
        if (isSmartPlusCampaignError(response.message)) {
          Logger.log(`⚠️ SPC検出: ${batch.join(', ')} - SPC APIで再試行`);
          const spcResult = updateSpcCampaignStatus(advertiserId, batch, status, accessToken);
          results.success.push(...spcResult.success);
          results.failed.push(...spcResult.failed);
          results.spcRetried.push(...batch);
        } else {
          results.failed.push(...batch.map(id => ({ id, error: response.message })));
        }
      }
    } catch (e) {
      results.failed.push(...batch.map(id => ({ id, error: e.toString() })));
    }
    
    // レート制限対策
    if (i + CONFIG.BATCH_SIZE < campaignIds.length) {
      Utilities.sleep(500);
    }
  }
  
  return results;
}

/**
 * Smart Performance Campaign (SPC) 専用API
 */
function updateSpcCampaignStatus(advertiserId, campaignIds, status, accessToken) {
  const results = { success: [], failed: [] };
  
  for (const campaignId of campaignIds) {
    try {
      const response = callTikTokApiWithRetry(
        `${CONFIG.API_BASE}/campaign/spc/update/`,
        'POST',
        accessToken,
        {
          advertiser_id: advertiserId,
          campaign_id: campaignId,
          operation_status: status
        }
      );
      
      if (response.code === 0) {
        results.success.push(campaignId);
        Logger.log(`✅ SPC更新成功: ${campaignId}`);
      } else {
        results.failed.push({ id: campaignId, error: response.message });
        Logger.log(`❌ SPC更新失敗: ${campaignId} - ${response.message}`);
      }
    } catch (e) {
      results.failed.push({ id: campaignId, error: e.toString() });
    }
    
    Utilities.sleep(300);
  }
  
  return results;
}

/**
 * 広告セットのステータスを変更
 */
function updateAdGroupStatus(advertiserId, adGroupIds, status) {
  const accessToken = getAccessToken();
  const results = { success: [], failed: [] };
  
  for (let i = 0; i < adGroupIds.length; i += CONFIG.BATCH_SIZE) {
    const batch = adGroupIds.slice(i, i + CONFIG.BATCH_SIZE);
    
    try {
      const response = callTikTokApiWithRetry(
        `${CONFIG.API_BASE}/adgroup/update/status/`,
        'POST',
        accessToken,
        {
          advertiser_id: advertiserId,
          adgroup_ids: batch,
          operation_status: status
        }
      );
      
      if (response.code === 0) {
        results.success.push(...batch);
      } else {
        results.failed.push(...batch.map(id => ({ id, error: response.message })));
      }
    } catch (e) {
      results.failed.push(...batch.map(id => ({ id, error: e.toString() })));
    }
    
    if (i + CONFIG.BATCH_SIZE < adGroupIds.length) {
      Utilities.sleep(500);
    }
  }
  
  return results;
}

/**
 * 広告のステータスを変更
 */
function updateAdStatus(advertiserId, adIds, status) {
  const accessToken = getAccessToken();
  const results = { success: [], failed: [] };
  
  for (let i = 0; i < adIds.length; i += CONFIG.BATCH_SIZE) {
    const batch = adIds.slice(i, i + CONFIG.BATCH_SIZE);
    
    try {
      const response = callTikTokApiWithRetry(
        `${CONFIG.API_BASE}/ad/update/status/`,
        'POST',
        accessToken,
        {
          advertiser_id: advertiserId,
          ad_ids: batch,
          operation_status: status
        }
      );
      
      if (response.code === 0) {
        results.success.push(...batch);
      } else {
        results.failed.push(...batch.map(id => ({ id, error: response.message })));
      }
    } catch (e) {
      results.failed.push(...batch.map(id => ({ id, error: e.toString() })));
    }
    
    if (i + CONFIG.BATCH_SIZE < adIds.length) {
      Utilities.sleep(500);
    }
  }
  
  return results;
}

// ========== スプレッドシート連携操作 ==========

/**
 * 選択した行のキャンペーンをON
 */
function turnOnSelectedCampaigns() {
  processSelectedItems('campaign', 'ENABLE');
}

function turnOffSelectedCampaigns() {
  processSelectedItems('campaign', 'DISABLE');
}

function turnOnSelectedAdGroups() {
  processSelectedItems('adgroup', 'ENABLE');
}

function turnOffSelectedAdGroups() {
  processSelectedItems('adgroup', 'DISABLE');
}

function turnOnSelectedAds() {
  processSelectedItems('ad', 'ENABLE');
}

function turnOffSelectedAds() {
  processSelectedItems('ad', 'DISABLE');
}

/**
 * 選択した項目を処理
 */
function processSelectedItems(type, status) {
  const sheet = SpreadsheetApp.getActiveSheet();
  const selection = sheet.getActiveRange();
  
  if (!selection) {
    SpreadsheetApp.getUi().alert('行を選択してください');
    return;
  }
  
  const startRow = selection.getRow();
  const numRows = selection.getNumRows();
  
  // ヘッダー行をスキップ
  if (startRow === 1) {
    SpreadsheetApp.getUi().alert('ヘッダー行は選択できません');
    return;
  }
  
  // 列インデックス（ヘッダーに基づく）
  const COLS = {
    ACCOUNT_ID: 2,     // B列: アカウントID
    CAMPAIGN_ID: 13,   // M列: CP ID
    ADGROUP_ID: 4,     // D列: アドセットID（必要に応じて調整）
    AD_ID: 16,         // P列: 広告ID
  };
  
  // データを収集
  const itemsByAccount = {};
  
  for (let i = 0; i < numRows; i++) {
    const row = startRow + i;
    const accountId = sheet.getRange(row, COLS.ACCOUNT_ID).getValue();
    
    let itemId;
    switch (type) {
      case 'campaign':
        itemId = sheet.getRange(row, COLS.CAMPAIGN_ID).getValue();
        break;
      case 'adgroup':
        // 広告セットIDがシートにない場合は別途取得が必要
        itemId = sheet.getRange(row, COLS.ADGROUP_ID).getValue();
        break;
      case 'ad':
        itemId = sheet.getRange(row, COLS.AD_ID).getValue();
        break;
    }
    
    if (accountId && itemId) {
      if (!itemsByAccount[accountId]) {
        itemsByAccount[accountId] = new Set();
      }
      itemsByAccount[accountId].add(String(itemId));
    }
  }
  
  // 処理実行
  let totalSuccess = 0;
  let totalFailed = 0;
  const errors = [];
  
  for (const [accountId, itemSet] of Object.entries(itemsByAccount)) {
    const items = Array.from(itemSet);
    let result;
    
    switch (type) {
      case 'campaign':
        result = updateCampaignStatus(accountId, items, status);
        break;
      case 'adgroup':
        result = updateAdGroupStatus(accountId, items, status);
        break;
      case 'ad':
        result = updateAdStatus(accountId, items, status);
        break;
    }
    
    totalSuccess += result.success.length;
    totalFailed += result.failed.length;
    
    if (result.failed.length > 0) {
      errors.push(...result.failed.map(f => `${accountId}: ${f.id} - ${f.error}`));
    }
  }
  
  // 結果表示
  const statusText = status === 'ENABLE' ? 'ON' : 'OFF';
  let message = `${type}を${statusText}に変更しました\n\n成功: ${totalSuccess}件\n失敗: ${totalFailed}件`;
  
  if (errors.length > 0) {
    message += `\n\n【エラー詳細】\n${errors.slice(0, 5).join('\n')}`;
    if (errors.length > 5) {
      message += `\n...他${errors.length - 5}件`;
    }
    
    // ChatWork通知
    sendChatWorkNotification(`【TikTok ${statusText}エラー】\n${errors.join('\n')}`);
  }
  
  SpreadsheetApp.getUi().alert(message);
}

// ========== ユーティリティ関数 ==========

/**
 * SPC/Upgraded Smart Plus エラーかどうか判定
 */
function isSmartPlusCampaignError(message) {
  if (!message) return false;
  const spcKeywords = [
    'Smart Performance Campaign',
    'Upgraded Smart Plus',
    'SPC',
    'smart_plus',
    'This API does not support'
  ];
  return spcKeywords.some(keyword => message.includes(keyword));
}

/**
 * リトライ付きAPI呼び出し（指数バックオフ）
 */
function callTikTokApiWithRetry(url, method, accessToken, payload, retryCount = 0) {
  const options = {
    method: method.toLowerCase(),
    headers: {
      'Access-Token': accessToken,
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  };
  
  if (payload && method.toUpperCase() === 'POST') {
    options.payload = JSON.stringify(payload);
  }
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());
    
    // レート制限エラーの場合はリトライ
    if (data.code === 40100 && retryCount < CONFIG.MAX_RETRIES) {
      const delay = CONFIG.INITIAL_DELAY_MS * Math.pow(2, retryCount);
      Logger.log(`⏳ レート制限 - ${delay}ms後にリトライ (${retryCount + 1}/${CONFIG.MAX_RETRIES})`);
      Utilities.sleep(delay);
      return callTikTokApiWithRetry(url, method, accessToken, payload, retryCount + 1);
    }
    
    return data;
  } catch (e) {
    if (retryCount < CONFIG.MAX_RETRIES) {
      const delay = CONFIG.INITIAL_DELAY_MS * Math.pow(2, retryCount);
      Logger.log(`⏳ エラー発生 - ${delay}ms後にリトライ: ${e}`);
      Utilities.sleep(delay);
      return callTikTokApiWithRetry(url, method, accessToken, payload, retryCount + 1);
    }
    throw e;
  }
}

/**
 * ChatWork通知
 */
function sendChatWorkNotification(message) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('CHATWORK_API_TOKEN');
  const roomId = props.getProperty('CHATWORK_ROOM_ID');
  
  if (!token || !roomId) {
    Logger.log('⚠️ ChatWork設定がありません');
    return;
  }
  
  try {
    UrlFetchApp.fetch(`https://api.chatwork.com/v2/rooms/${roomId}/messages`, {
      method: 'post',
      headers: { 'X-ChatWorkToken': token },
      payload: { body: message }
    });
    Logger.log('✅ ChatWork通知送信完了');
  } catch (e) {
    Logger.log(`❌ ChatWork通知エラー: ${e}`);
  }
}

/**
 * 設定確認
 */
function checkSettings() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('TIKTOK_ACCESS_TOKEN');
  const chatworkToken = props.getProperty('CHATWORK_API_TOKEN');
  
  let message = '【設定状況】\n\n';
  message += `TikTok Token: ${token ? '✅ 設定済み' : '❌ 未設定'}\n`;
  message += `ChatWork Token: ${chatworkToken ? '✅ 設定済み' : '❌ 未設定'}\n`;
  
  SpreadsheetApp.getUi().alert(message);
}

// ========== 既存のデータ取得機能（改良版） ==========

/**
 * 当日データ取得
 */
function getTodayTiktokData() {
  const spreadSheet = SpreadsheetApp.getActiveSpreadsheet();
  const sh_Ac = spreadSheet.getSheetByName(CONFIG.SHEET_ACCOUNTS);
  const statusCell = sh_Ac.getRange("E3");
  const logCell = sh_Ac.getRange("E4");
  const start = new Date();

  statusCell.setValue("🔄 実行中...");
  logCell.clearContent();

  try {
    const today = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd");
    getTikTokReportByDate(today, CONFIG.SHEET_TODAY);

    const end = new Date();
    const exeTime = Utilities.formatDate(end, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
    const diffSec = Math.round((end - start) / 1000);
    statusCell.setValue(`✅ 完了 (${exeTime})`);
    logCell.setValue(`正常終了 / 所要時間: ${diffSec}秒`);

  } catch (e) {
    statusCell.setValue("❌ エラー");
    logCell.setValue(e.toString());
    sendChatWorkNotification(`【TikTok GAS エラー】当日データ取得\n${e.toString()}`);
    throw e;
  }
}

/**
 * 前日データ取得
 */
function getYesterdayTiktokData() {
  const spreadSheet = SpreadsheetApp.getActiveSpreadsheet();
  const sh_Ac = spreadSheet.getSheetByName(CONFIG.SHEET_ACCOUNTS);
  const statusCell = sh_Ac.getRange("F3");
  const logCell = sh_Ac.getRange("F4");
  const start = new Date();

  statusCell.setValue("🔄 実行中...");
  logCell.clearContent();

  try {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    const yesterday = Utilities.formatDate(date, "Asia/Tokyo", "yyyy-MM-dd");
    getTikTokReportByDate(yesterday, CONFIG.SHEET_YESTERDAY);

    const end = new Date();
    const exeTime = Utilities.formatDate(end, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
    const diffSec = Math.round((end - start) / 1000);
    statusCell.setValue(`✅ 完了 (${exeTime})`);
    logCell.setValue(`正常終了 / 所要時間: ${diffSec}秒`);

  } catch (e) {
    statusCell.setValue("❌ エラー");
    logCell.setValue(e.toString());
    sendChatWorkNotification(`【TikTok GAS エラー】前日データ取得\n${e.toString()}`);
    throw e;
  }
}

/**
 * レポート取得（改良版）
 */
function getTikTokReportByDate(targetDate, outputSheetName) {
  const spreadSheet = SpreadsheetApp.getActiveSpreadsheet();
  const sh_paste = spreadSheet.getSheetByName(outputSheetName);
  if (!sh_paste) throw new Error(`シート『${outputSheetName}』が存在しません。`);

  const sh_Ac = spreadSheet.getSheetByName(CONFIG.SHEET_ACCOUNTS);
  if (!sh_Ac) throw new Error("シート『広告アカウント一覧』が存在しません。");

  const exeDate = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');

  const headers = [
    'GAS実行日時',      // A
    'アカウントID',     // B
    'アカウント名',     // C
    'CP名',            // D
    'アドセット名',     // E
    '広告名',          // F
    '消化金額',         // G
    'コンバージョン数', // H
    'imp',             // I
    'click',           // J
    '日時',            // K
    '日予算',          // L
    'CP ID',           // M
    'ステータス',       // N
    '審査',            // O
    '広告ID',          // P
    '目標単価',        // Q
    'アドセットID'     // R（新規追加）
  ];

  var result_data = [headers];

  const lastRow_Ac = sh_Ac.getRange(7, 6).getNextDataCell(SpreadsheetApp.Direction.DOWN).getRow();
  const ID_LIST = sh_Ac.getRange(7, 5, lastRow_Ac - 6, 2).getValues();

  const CP_ID_LIST = ID_LIST
    .filter(row => row[1])
    .map(row => [row[0] || "-", row[1]]);

  Logger.log(`▶︎ 対象アカウント数: ${CP_ID_LIST.length}`);

  for (let i = 0; i < CP_ID_LIST.length; i++) {
    const accountName = CP_ID_LIST[i][0];
    const accountId = CP_ID_LIST[i][1];

    Logger.log(`▶︎ ${i + 1}/${CP_ID_LIST.length}: ${accountName}（ID=${accountId}）`);

    try {
      let Tk = new TikTokADSUnified({
        ACCESS_TOKEN: getAccessToken(),
        getStat: ['ad_id', 'ad_name', 'adgroup_id', 'adgroup_name', 'campaign_id', 'campaign_name', 'spend', 'impressions', 'clicks'],
        advertiser_id: accountId
      });

      let adsData = Tk.getAdsDataByDate(targetDate);
      Logger.log(`▶︎ ${accountName} 広告データ: ${adsData.length - 1}件`);

      if (adsData.length <= 1) {
        Logger.log(`⚠️ ${accountName} データなし`);
        continue;
      }

      // キャンペーン詳細取得
      let uniqueCampaignIds = new Set();
      for (let j = 1; j < adsData.length; j++) {
        if (Number(adsData[j][8]) >= 1) {
          const campaignId = String(adsData[j][5]);
          if (campaignId && campaignId !== 'UNKNOWN' && campaignId !== '') {
            uniqueCampaignIds.add(campaignId);
          }
        }
      }

      let campaignDetails = [];
      if (uniqueCampaignIds.size > 0) {
        campaignDetails = Tk.getCampaignDetailsByIds(Array.from(uniqueCampaignIds));
      }

      let accountRecordCount = 0;
      for (let j = 1; j < adsData.length; j++) {
        if (Number(adsData[j][8]) >= 1) {
          let adId = String(adsData[j][1]);
          let campaignId = String(adsData[j][5]);
          let adGroupId = String(adsData[j][3]); // アドセットID

          let campaignDetail = campaignDetails.find(detail => String(detail.id) === campaignId);

          let dataRow = [
            exeDate,
            accountId,
            accountName,
            adsData[j][6],
            adsData[j][4],
            adsData[j][2],
            adsData[j][7],
            adsData[j][10] || 0,
            adsData[j][8],
            adsData[j][9],
            adsData[j][0],
            campaignDetail ? (campaignDetail.details.daily_budget || 'セット予算') : 'セット予算',
            campaignId,
            campaignDetail ? campaignDetail.details.operation_status : 'UNKNOWN',
            campaignDetail ? campaignDetail.details.secondary_status : 'UNKNOWN',
            adId,
            adsData[j][11] || 'N/A',
            adGroupId // 新規追加
          ];

          result_data.push(dataRow);
          accountRecordCount++;
        }
      }
      Logger.log(`▶︎ ${accountName} 完了: ${accountRecordCount}件`);

    } catch (err) {
      Logger.log(`⚠️ ${accountName} エラー: ${err}`);
      continue;
    }

    if (i < CP_ID_LIST.length - 1) {
      Utilities.sleep(2000);
    }
  }

  Logger.log(`▶︎ 最終レコード数: ${result_data.length - 1}`);

  if (result_data.length > 1) {
    sh_paste.getRange('A2:R').clearContent();
    Utilities.sleep(500);
    sh_paste.getRange(1, 1, result_data.length, result_data[0].length).setValues(result_data);
    Logger.log(`✅ 書き込み完了 → ${outputSheetName}`);
  } else {
    Logger.log(`⚠️ データなし → ${outputSheetName}`);
  }
}

// ========== TikTokADSUnified クラス（改良版） ==========
class TikTokADSUnified {
  constructor(op) {
    this.API_BASE = CONFIG.API_BASE;
    this.PATH_REPORTS = `${this.API_BASE}/report/integrated/get/`;
    this.PATH_CAMPAIGN_DETAILS = `${this.API_BASE}/campaign/get/`;
    this.PATH_AD_DETAILS = `${this.API_BASE}/ad/get/`;
    this.PATH_ADGROUP_DETAILS = `${this.API_BASE}/adgroup/get/`;
    this.ACCESS_TOKEN = op['ACCESS_TOKEN'];
    this.getStat = op['getStat'];
    this.advertiser_id = op['advertiser_id'];
  }

  getAdsDataByDate(targetDate) {
    let option = {
      advertiser_id: this.advertiser_id,
      report_type: 'BASIC',
      data_level: 'AUCTION_AD',
      start_date: targetDate,
      end_date: targetDate,
      dimensions: JSON.stringify(['stat_time_day', 'ad_id']),
      metrics: JSON.stringify(['spend', 'impressions', 'clicks', 'conversion']),
      page_size: 1000,
    }

    let params = Object.entries(option).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    let url = this.PATH_REPORTS + "?" + params;

    var allData = [];
    var currentPage = 1;
    var totalPages = 1;
    
    while (currentPage <= totalPages) {
      var data = callTikTokApiWithRetry(url + '&page=' + currentPage, 'GET', this.ACCESS_TOKEN);

      if (data["code"] !== 0) {
        throw new Error(`TikTok API Error: ${data["message"]}`);
      }

      if (data["data"] && data["data"]["list"]) {
        allData = allData.concat(data["data"]["list"]);
      }
      
      if (currentPage === 1 && data["data"]?.["page_info"]?.["total_page"]) {
        totalPages = data["data"]["page_info"]["total_page"];
      }
      
      currentPage++;
    }

    let adIds = [...new Set(allData.map(item => item.dimensions?.ad_id).filter(id => id))];
    let adDetailsMap = this.getAdDetailsMapByIds(adIds);

    let adGroupIds = [...new Set(Object.values(adDetailsMap).map(ad => ad.adgroup_id).filter(id => id))];
    let adGroupDetailsMap = this.getAdGroupDetailsMapByIds(adGroupIds);

    let result = [['stat_datetime', 'ad_id', 'ad_name', 'adgroup_id', 'adgroup_name', 'campaign_id', 'campaign_name', 'stat_cost', 'show_cnt', 'click_cnt', 'conversion', 'target_bid']];

    for (let elm of allData) {
      if (!elm.dimensions || !elm.metrics) continue;
      
      const impressions = parseFloat(elm.metrics.impressions) || 0;
      if (impressions < 1) continue;

      const adId = elm.dimensions.ad_id;
      const adDetail = adDetailsMap[adId] || {};
      const adGroupId = adDetail.adgroup_id;
      const adGroupDetail = adGroupDetailsMap[adGroupId] || {};
      const targetBid = adGroupDetail.cpa_bid || adGroupDetail.bid || 'N/A'; 

      let temp = [
        new Date(elm.dimensions.stat_time_day),
        String(adId),
        adDetail.ad_name || `Ad_${adId}`,
        String(adDetail.adgroup_id || ''),
        adDetail.adgroup_name || '',
        String(adDetail.campaign_id || ''),
        adDetail.campaign_name || '',
        parseFloat(elm.metrics.spend) || 0,
        impressions,
        parseFloat(elm.metrics.clicks) || 0,
        parseFloat(elm.metrics.conversion) || 0,
        targetBid
      ];
      
      result.push(temp);
    }
    
    return result.sort((a, b) => a[0] - b[0]);
  }

  getAdDetailsMapByIds(adIds) {
    if (!adIds || adIds.length === 0) return {};

    const batchSize = CONFIG.BATCH_SIZE;
    let detailsMap = {};

    for (let i = 0; i < adIds.length; i += batchSize) {
      const batch = adIds.slice(i, i + batchSize);
      
      try {
        let option = {
          advertiser_id: this.advertiser_id,
          filtering: JSON.stringify({ 'ad_ids': batch }),
          fields: JSON.stringify(["ad_id", "ad_name", "adgroup_id", "adgroup_name", "campaign_id", "campaign_name"]),
          page_size: 1000,
        }

        let params = Object.entries(option).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
        let url = this.PATH_AD_DETAILS + "?" + params;

        var data = callTikTokApiWithRetry(url, 'GET', this.ACCESS_TOKEN);
        
        if (data["code"] === 0 && data["data"]?.["list"]) {
          for (let ad of data["data"]["list"]) {
            detailsMap[ad.ad_id] = {
              ad_name: ad.ad_name,
              adgroup_id: ad.adgroup_id,
              adgroup_name: ad.adgroup_name || `AdGroup_${ad.adgroup_id}`,
              campaign_id: ad.campaign_id,
              campaign_name: ad.campaign_name || `Campaign_${ad.campaign_id}`
            };
          }
        }
      } catch (e) {
        Logger.log(`広告詳細取得エラー: ${e}`);
        for (let adId of batch) {
          detailsMap[adId] = { ad_name: `Ad_${adId}`, adgroup_id: '', adgroup_name: '', campaign_id: '', campaign_name: '' };
        }
      }
      
      if (i + batchSize < adIds.length) Utilities.sleep(1000);
    }

    return detailsMap;
  }

  getAdGroupDetailsMapByIds(adGroupIds) {
    if (!adGroupIds || adGroupIds.length === 0) return {};

    const batchSize = CONFIG.BATCH_SIZE;
    let detailsMap = {};

    for (let i = 0; i < adGroupIds.length; i += batchSize) {
      const batch = adGroupIds.slice(i, i + batchSize);
      
      try {
        let option = {
          advertiser_id: this.advertiser_id,
          filtering: JSON.stringify({ 'adgroup_ids': batch }),
          fields: JSON.stringify(["adgroup_id", "bid_price", "conversion_bid_price"]),
          page_size: 1000,
        }

        let params = Object.entries(option).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
        let url = this.PATH_ADGROUP_DETAILS + "?" + params;

        var data = callTikTokApiWithRetry(url, 'GET', this.ACCESS_TOKEN);
        
        if (data["code"] === 0 && data["data"]?.["list"]) {
          for (let adgroup of data["data"]["list"]) {
            detailsMap[adgroup.adgroup_id] = {
              bid: adgroup.bid_price,
              cpa_bid: adgroup.conversion_bid_price
            };
          }
        }
      } catch (e) {
        Logger.log(`広告セット詳細取得エラー: ${e}`);
        for (let adGroupId of batch) {
          detailsMap[adGroupId] = { bid: 'N/A', cpa_bid: 'N/A' };
        }
      }
      
      if (i + batchSize < adGroupIds.length) Utilities.sleep(1000);
    }

    return detailsMap;
  }

  getCampaignDetailsByIds(campaignIds) {
    if (!campaignIds || campaignIds.length === 0) return [];

    const validCampaignIds = campaignIds.filter(id => id && id !== 'UNKNOWN' && id !== '' && !isNaN(id));
    if (validCampaignIds.length === 0) return [];

    const results = [];
    const BATCH = CONFIG.CAMPAIGN_BATCH_SIZE;

    for (let i = 0; i < validCampaignIds.length; i += BATCH) {
      const batch = validCampaignIds.slice(i, i + BATCH);

      const option = {
        advertiser_id: this.advertiser_id,
        page_size: 1000,
        filtering: JSON.stringify({ primary_status: 'STATUS_ALL', campaign_ids: batch }),
        fields: JSON.stringify(["campaign_id", "operation_status", "secondary_status", "budget"])
      };

      let params = Object.entries(option).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
      const baseUrl = this.PATH_CAMPAIGN_DETAILS + "?" + params;

      let currentPage = 1;
      let totalPages = 1;

      while (currentPage <= totalPages) {
        const url = baseUrl + "&page=" + currentPage;
        const data = callTikTokApiWithRetry(url, 'GET', this.ACCESS_TOKEN);

        if (data["code"] !== 0) {
          Logger.log("キャンペーン詳細API Error: " + data["message"]);
          break;
        }

        if (data["data"]?.["list"]) {
          for (let campaign of data["data"]["list"]) {
            results.push({
              id: campaign.campaign_id,
              details: {
                operation_status: campaign.operation_status,
                secondary_status: campaign.secondary_status,
                daily_budget: campaign.budget
              }
            });
          }
        }

        if (currentPage === 1 && data["data"]?.["page_info"]?.["total_page"]) {
          totalPages = data["data"]["page_info"]["total_page"];
        }
        currentPage++;

        if (currentPage <= totalPages) Utilities.sleep(300);
      }

      if (i + BATCH < validCampaignIds.length) Utilities.sleep(400);
    }

    return results;
  }
}

// ========== 自動実行用トリガー設定 ==========

/**
 * 毎日自動実行を設定
 */
function setupDailyTrigger() {
  // 既存のトリガーを削除
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'getTodayTiktokData' || 
        trigger.getHandlerFunction() === 'getYesterdayTiktokData') {
      ScriptApp.deleteTrigger(trigger);
    }
  }
  
  // 毎日8:00に当日データ取得
  ScriptApp.newTrigger('getTodayTiktokData')
    .timeBased()
    .atHour(8)
    .everyDays(1)
    .inTimezone('Asia/Tokyo')
    .create();
  
  // 毎日7:00に前日データ取得
  ScriptApp.newTrigger('getYesterdayTiktokData')
    .timeBased()
    .atHour(7)
    .everyDays(1)
    .inTimezone('Asia/Tokyo')
    .create();
  
  Logger.log('✅ 自動実行トリガーを設定しました');
}

