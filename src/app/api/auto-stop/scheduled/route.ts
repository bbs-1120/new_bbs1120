import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullAnalysisData, getTikTokAdvertiserMapping } from "@/lib/googleSheets";
import { sendAutoStopFailedAlert, AutoStopFailedCpn } from "@/lib/chatwork";

// TikTok advertiser_idマッピングのキャッシュ
let tikTokAdvertiserMapping: Map<string, string> | null = null;
let mappingLoadedAt: number = 0;
const MAPPING_CACHE_TTL = 5 * 60 * 1000; // 5分キャッシュ

async function loadTikTokAdvertiserMapping(): Promise<Map<string, string>> {
  const now = Date.now();
  if (tikTokAdvertiserMapping && (now - mappingLoadedAt) < MAPPING_CACHE_TTL) {
    return tikTokAdvertiserMapping;
  }
  
  try {
    tikTokAdvertiserMapping = await getTikTokAdvertiserMapping();
    mappingLoadedAt = now;
    console.log(`[Scheduled Auto-Stop] Loaded TikTok advertiser mapping: ${tikTokAdvertiserMapping.size} entries`);
  } catch (error) {
    console.error("[Scheduled Auto-Stop] Failed to load TikTok advertiser mapping:", error);
    tikTokAdvertiserMapping = new Map();
  }
  
  return tikTokAdvertiserMapping;
}

interface StopRuleConditions {
  spendMin?: number;
  mcvMax?: number;
  cvMax?: number;
  cvMin?: number;
  roasMax?: number;
  profitMax?: number;
  consecutiveLossMin?: number;
}

interface CpnData {
  cpnName: string;
  campaignId?: string;
  media: string;
  spend: number;
  cv: number;
  mcv: number;
  profit: number;
  roas: number;
  accountName?: string;
  advertiserId?: string;
  consecutiveLoss?: number;
}

// TikTok キャンペーンIDからadvertiser_idを検索（スプレッドシート優先）
async function findTikTokAdvertiserId(campaignId: string, cpnName?: string): Promise<string | null> {
  const campaignIdStr = String(campaignId).trim();
  
  // 1. まずスプレッドシートのマッピングを確認
  const mapping = await loadTikTokAdvertiserMapping();
  
  // キャンペーンIDで検索
  if (mapping.has(campaignIdStr)) {
    const advertiserId = mapping.get(campaignIdStr)!;
    console.log(`[Scheduled Auto-Stop] Found advertiser_id ${advertiserId} from spreadsheet for campaign ${campaignIdStr}`);
    return advertiserId;
  }
  
  // CPN名で検索（バックアップ）
  if (cpnName && mapping.has(`cpn:${cpnName}`)) {
    const advertiserId = mapping.get(`cpn:${cpnName}`)!;
    console.log(`[Scheduled Auto-Stop] Found advertiser_id ${advertiserId} from spreadsheet for cpn ${cpnName}`);
    return advertiserId;
  }

  console.log(`[Scheduled Auto-Stop] Not found in spreadsheet, searching via API for campaign ${campaignIdStr}...`);

  // 2. スプレッドシートになければAPI検索
  const accessTokens = [
    process.env.TIKTOK_ACCESS_TOKEN,
    process.env.TIKTOK_ACCESS_TOKEN_2,
    process.env.TIKTOK_ACCESS_TOKEN_3,
  ].filter(Boolean) as string[];
  
  const advertiserIds = (process.env.TIKTOK_ADVERTISER_IDS || "").split(",").filter(Boolean);
  
  if (accessTokens.length === 0 || advertiserIds.length === 0) {
    return null;
  }

  for (const accessToken of accessTokens) {
    for (const advertiserId of advertiserIds) {
      try {
        const advertiserIdStr = String(advertiserId).trim();
        const params = new URLSearchParams({
          advertiser_id: advertiserIdStr,
          filtering: JSON.stringify({
            campaign_ids: [campaignIdStr],
          }),
        });

        const response = await fetch(
          `https://business-api.tiktok.com/open_api/v1.3/campaign/get/?${params.toString()}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "Access-Token": accessToken,
            },
          }
        );

        const data = await response.json();
        
        if (data.code === 0 && data.data?.list?.length > 0) {
          console.log(`[Scheduled Auto-Stop] Found advertiser_id ${advertiserIdStr} via API for campaign ${campaignIdStr}`);
          return advertiserIdStr;
        }
      } catch (error) {
        // エラーは無視して次のadvertiser_idを試す
      }
    }
  }

  console.log(`[Scheduled Auto-Stop] Could not find advertiser_id for campaign ${campaignIdStr}`);
  return null;
}

// Meta広告を停止するAPI
async function stopMetaCampaign(campaignId: string, accessTokens: string[]): Promise<{ success: boolean; error?: string }> {
  for (const accessToken of accessTokens) {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v22.0/${campaignId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "PAUSED",
            access_token: accessToken,
          }),
        }
      );

      if (response.ok) {
        return { success: true };
      }
      
      const errorData = await response.json();
      console.log(`Token failed for campaign ${campaignId}:`, errorData.error?.message);
    } catch (error) {
      console.log(`Token error for campaign ${campaignId}:`, error);
    }
  }
  
  return { success: false, error: "All tokens failed" };
}

// Upgraded Smart Plus / SPC エラー判定
function isSmartPlusCampaignError(message: string | undefined): boolean {
  if (!message) return false;
  const keywords = [
    "Smart Performance Campaign",
    "Upgraded Smart Plus",
    "smart_plus",
    "SPC",
    "spc",
    "This API does not support",
    "not support Upgraded",
  ];
  return keywords.some(keyword => message.toLowerCase().includes(keyword.toLowerCase()));
}

// TikTok広告を停止するAPI（Upgraded Smart Plus完全対応）
async function stopTikTokCampaign(campaignId: string, advertiserId: string): Promise<{ success: boolean; error?: string }> {
  // 複数のアクセストークンを取得
  const accessTokens = [
    process.env.TIKTOK_ACCESS_TOKEN,
    process.env.TIKTOK_ACCESS_TOKEN_2,
    process.env.TIKTOK_ACCESS_TOKEN_3,
  ].filter(Boolean) as string[];
  
  if (accessTokens.length === 0) {
    return { success: false, error: "TikTok access token not configured" };
  }

  // 明示的に文字列変換（GASと同じ方法）
  const campaignIdStr = String(campaignId).trim();
  const advertiserIdStr = String(advertiserId).trim();

  let lastError = "TikTok API error";

  for (const accessToken of accessTokens) {
    // === 方法1: campaign/status/update/ API（推奨） ===
    try {
      const payload = {
        advertiser_id: advertiserIdStr,
        campaign_ids: [campaignIdStr],
        operation_status: "DISABLE",
      };

      console.log(`[Scheduled Auto-Stop] TikTok status/update request:`, JSON.stringify(payload));

      const response = await fetch(
        "https://business-api.tiktok.com/open_api/v1.3/campaign/status/update/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Access-Token": accessToken,
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();
      console.log(`[Scheduled Auto-Stop] TikTok status/update response for ${campaignIdStr}:`, data.code, data.message);
      
      if (data.code === 0) {
        return { success: true };
      }
      
      lastError = data.message || "TikTok API error";
      
      // Upgraded Smart Plus / SPC エラーの場合は複数の方法を試す
      if (isSmartPlusCampaignError(data.message)) {
        console.log(`[Scheduled Auto-Stop] Upgraded Smart Plus detected for ${campaignIdStr}, trying alternative APIs...`);
        
        // === 方法2: campaign/spc/update/ API ===
        const spcResult = await stopTikTokSpcCampaign(accessToken, advertiserIdStr, campaignIdStr);
        if (spcResult.success) {
          console.log(`[Scheduled Auto-Stop] SPC API succeeded for ${campaignIdStr}`);
          return { success: true };
        }
        
        // === 方法3: campaign/update/ API（通常キャンペーン更新） ===
        const updateResult = await stopTikTokCampaignDirect(accessToken, advertiserIdStr, campaignIdStr);
        if (updateResult.success) {
          console.log(`[Scheduled Auto-Stop] campaign/update API succeeded for ${campaignIdStr}`);
          return { success: true };
        }
        
        lastError = `Upgraded Smart Plus: ${spcResult.error || updateResult.error || data.message}`;
      }
      
      // 権限エラーの場合は次のトークンを試す
      if (data.code === 40002 || data.code === 40001 || data.code === 40100) {
        continue;
      }
    } catch (error) {
      console.error(`[Scheduled Auto-Stop] TikTok API error for ${campaignIdStr}:`, error);
      lastError = error instanceof Error ? error.message : "Unknown error";
    }
  }

  return { success: false, error: lastError };
}

// TikTok campaign/update/ API（直接更新）
async function stopTikTokCampaignDirect(
  accessToken: string,
  advertiserId: string,
  campaignId: string
): Promise<{ success: boolean; error?: string }> {
  const payload = {
    advertiser_id: advertiserId,
    campaign_id: campaignId,
    operation_status: "DISABLE",
  };

  console.log(`[Scheduled Auto-Stop] TikTok campaign/update request:`, JSON.stringify(payload));

  try {
    const response = await fetch(
      "https://business-api.tiktok.com/open_api/v1.3/campaign/update/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Access-Token": accessToken,
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();
    console.log(`[Scheduled Auto-Stop] TikTok campaign/update response:`, data.code, data.message);

    if (data.code === 0) {
      return { success: true };
    }
    
    return { success: false, error: data.message || "campaign/update API error" };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "campaign/update API error" };
  }
}

// TikTok Smart Plus Campaign 停止API
async function stopTikTokSpcCampaign(
  accessToken: string,
  advertiserId: string,
  campaignId: string
): Promise<{ success: boolean; error?: string }> {
  const advertiserIdStr = String(advertiserId).trim();
  const campaignIdStr = String(campaignId).trim();

  const payload = {
    advertiser_id: advertiserIdStr,
    campaign_id: campaignIdStr,
    operation_status: "DISABLE",
  };

  console.log(`[Scheduled Auto-Stop] SPC API request:`, JSON.stringify(payload));

  try {
    const response = await fetch(
      "https://business-api.tiktok.com/open_api/v1.3/campaign/spc/update/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Access-Token": accessToken,
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();
    console.log(`[Scheduled Auto-Stop] SPC API response for ${campaignIdStr}:`, JSON.stringify(data));
    
    if (data.code === 0) {
      return { success: true };
    }
    
    return { success: false, error: data.message || "SPC API error" };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "SPC API error" };
  }
}

// 条件にマッチするかチェック
function matchesRule(cpn: CpnData, conditions: StopRuleConditions): { matches: boolean; descriptions: string[] } {
  const descriptions: string[] = [];
  
  // すべての条件を満たす必要がある（AND条件）
  const hasAnyCondition = Object.values(conditions).some(v => v !== undefined && v !== null);
  if (!hasAnyCondition) return { matches: false, descriptions: [] };

  // 消化金額（以上）
  if (conditions.spendMin !== undefined) {
    if (cpn.spend < conditions.spendMin) return { matches: false, descriptions: [] };
    descriptions.push(`消化≥¥${conditions.spendMin.toLocaleString()}（実際: ¥${cpn.spend.toLocaleString()}）`);
  }

  // MCV（以下）
  if (conditions.mcvMax !== undefined) {
    if (cpn.mcv > conditions.mcvMax) return { matches: false, descriptions: [] };
    descriptions.push(`MCV≤${conditions.mcvMax}（実際: ${cpn.mcv}）`);
  }

  // CV（以下）
  if (conditions.cvMax !== undefined) {
    if (cpn.cv > conditions.cvMax) return { matches: false, descriptions: [] };
    descriptions.push(`CV≤${conditions.cvMax}（実際: ${cpn.cv}）`);
  }

  // CV（以上）
  if (conditions.cvMin !== undefined) {
    if (cpn.cv < conditions.cvMin) return { matches: false, descriptions: [] };
    descriptions.push(`CV≥${conditions.cvMin}（実際: ${cpn.cv}）`);
  }

  // ROAS（以下）
  if (conditions.roasMax !== undefined) {
    if (cpn.roas > conditions.roasMax) return { matches: false, descriptions: [] };
    descriptions.push(`ROAS≤${conditions.roasMax}%（実際: ${cpn.roas.toFixed(1)}%）`);
  }

  // 利益（以下）
  if (conditions.profitMax !== undefined) {
    if (cpn.profit > conditions.profitMax) return { matches: false, descriptions: [] };
    descriptions.push(`利益≤¥${conditions.profitMax.toLocaleString()}（実際: ¥${cpn.profit.toLocaleString()}）`);
  }

  // 連続赤字日数（以上）
  if (conditions.consecutiveLossMin !== undefined) {
    const actualLoss = cpn.consecutiveLoss || 0;
    if (actualLoss < conditions.consecutiveLossMin) return { matches: false, descriptions: [] };
    descriptions.push(`連続赤字≥${conditions.consecutiveLossMin}日（実際: ${actualLoss}日）`);
  }

  return { matches: true, descriptions };
}

// CPNからメンバー名、案件名、オファー名を抽出
function extractFromCpnName(cpnName: string): { memberName: string; projectName: string; offerName: string } {
  const parts = cpnName.split("_");
  return {
    memberName: parts.length > 1 ? parts[1] : "",
    projectName: parts.length > 2 ? parts[2] : "",
    offerName: parts.length > 3 ? parts[3] : "",
  };
}

// スケジュール実行用エンドポイント（Cloud Schedulerから呼び出される）
export async function POST(request: Request) {
  try {
    // セキュリティ: シークレットキーの確認
    const authHeader = request.headers.get("Authorization");
    const expectedKey = process.env.CRON_SECRET_KEY || process.env.AUTH_SECRET;
    
    if (authHeader !== `Bearer ${expectedKey}`) {
      console.log("Unauthorized scheduled auto-stop attempt");
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Scheduled Auto-Stop] Starting execution...");

    // 有効なルールを取得（優先度順）
    const dbRules = await prisma.auto_stop_rules.findMany({
      where: { is_active: true },
      orderBy: { priority: "asc" },
    });

    if (dbRules.length === 0) {
      console.log("[Scheduled Auto-Stop] No active rules found");
      return NextResponse.json({
        success: true,
        message: "有効なルールがありません",
        processed: 0,
        stopped: 0,
      });
    }

    console.log(`[Scheduled Auto-Stop] Found ${dbRules.length} active rules`);

    // 除外リストを取得
    const exclusions = await prisma.auto_stop_exclusions.findMany();
    const excludedCpns = new Set(exclusions.map(e => e.cpn_name));

    // 分析データを取得
    const analysisData = await getFullAnalysisData();
    console.log(`[Scheduled Auto-Stop] Checking ${analysisData.length} CPNs`);

    // Meta Access Tokenを取得
    const metaTokens = [
      process.env.META_ACCESS_TOKEN,
      process.env.META_TOKEN_BUSINESS01,
      process.env.META_TOKEN_BUSINESS03,
      process.env.META_TOKEN_BUSINESS08,
      process.env.META_TOKEN_BUSINESS11,
      process.env.META_TOKEN_BUSINESS13,
      process.env.META_TOKEN_BUSINESS14,
    ].filter(Boolean) as string[];

    interface StopResult {
      cpnName: string;
      media: string;
      memberName: string;
      projectName: string;
      ruleName: string;
      conditions: StopRuleConditions;
      matchedDescriptions: string[];
      metrics: { spend: number; cv: number; mcv: number; profit: number; roas: number };
      stopped: boolean;
      error?: string;
    }

    const results: StopResult[] = [];

    // 各CPNをチェック
    for (const cpn of analysisData) {
      // 除外リストにあるCPNはスキップ
      if (excludedCpns.has(cpn.cpnName)) continue;

      // campaignIdがない場合はスキップ
      if (!cpn.campaignId) continue;

      const { memberName, projectName, offerName } = extractFromCpnName(cpn.cpnName);

      // 各ルールをチェック（優先度順）
      for (const rule of dbRules) {
        // メンバーが一致するかチェック
        if (rule.member_name !== "全員" && rule.member_name !== memberName) continue;

        // 案件が一致するかチェック
        if (rule.project_name !== "全案件" && rule.project_name !== projectName) continue;

        const conditions = rule.conditions as StopRuleConditions & { 
          offerName?: string; 
          offerNames?: string[]; 
          mediaFilters?: string[]; 
        };

        // 媒体が一致するかチェック（配列対応）
        const ruleMediaFilters = conditions.mediaFilters || (rule.media !== "all" && rule.media !== "全媒体" ? [rule.media] : []);
        if (ruleMediaFilters.length > 0 && !ruleMediaFilters.includes("全媒体")) {
          const cpnMedia = (cpn.media || "").toLowerCase();
          const mediaMatches = ruleMediaFilters.some(m => {
            const ruleMedia = m.toLowerCase();
            return ruleMedia === cpnMedia || 
                   (ruleMedia === "meta" && cpnMedia === "fb") ||
                   (ruleMedia === "fb" && cpnMedia === "meta");
          });
          if (!mediaMatches) continue;
        }
        
        // オファーが一致するかチェック（配列対応）
        const ruleOfferNames = conditions.offerNames || (conditions.offerName ? [conditions.offerName] : []);
        if (ruleOfferNames.length > 0 && !ruleOfferNames.includes("全オファー")) {
          if (!ruleOfferNames.includes(offerName)) continue;
        }

        // 条件にマッチするかチェック
        const { matches, descriptions } = matchesRule(cpn as CpnData, conditions);
        
        if (matches) {
          const metrics = {
            spend: cpn.spend || 0,
            cv: cpn.cv || 0,
            mcv: cpn.mcv || 0,
            profit: cpn.profit || 0,
            roas: cpn.roas || 0,
          };

          let stopped = false;
          let error: string | undefined;

          // 実際に停止を実行
          const media = (cpn.media || "").toLowerCase();
          
          if (media === "meta" || media === "fb") {
            const result = await stopMetaCampaign(cpn.campaignId, metaTokens);
            stopped = result.success;
            error = result.error;
          } else if (media === "tiktok" || media === "pangle") {
            // CPNマッピングからadvertiserIdを取得
            const mapping = await prisma.cpn_campaign_mapping.findUnique({
              where: { cpn_name: cpn.cpnName },
            });
            
            let advertiserId = mapping?.advertiser_id;
            
            // マッピングにadvertiser_idがない場合はAPIで検索
            if (!advertiserId) {
              console.log(`[Scheduled Auto-Stop] No advertiser_id in mapping for ${cpn.cpnName}, searching...`);
              const foundId = await findTikTokAdvertiserId(cpn.campaignId, cpn.cpnName);
              if (foundId) {
                advertiserId = foundId;
                // 見つかったらマッピングを更新
                try {
                  await prisma.cpn_campaign_mapping.upsert({
                    where: { cpn_name: cpn.cpnName },
                    update: { advertiser_id: foundId },
                    create: {
                      cpn_name: cpn.cpnName,
                      campaign_id: cpn.campaignId,
                      media: cpn.media || "TikTok",
                      advertiser_id: foundId,
                    },
                  });
                  console.log(`[Scheduled Auto-Stop] Saved advertiser_id ${foundId} for ${cpn.cpnName}`);
                } catch (e) {
                  console.error(`[Scheduled Auto-Stop] Failed to save mapping:`, e);
                }
              }
            }
            
            if (advertiserId) {
              const result = await stopTikTokCampaign(cpn.campaignId, advertiserId);
              stopped = result.success;
              error = result.error;
            } else {
              error = "Advertiser ID not found";
            }
          } else {
            error = `Unsupported media: ${cpn.media}`;
          }

          // エラーの場合のみ履歴に保存
          if (!stopped && error) {
            await prisma.auto_stop_history.create({
              data: {
                cpn_name: cpn.cpnName,
                cpn_key: cpn.cpnKey || cpn.cpnName,
                campaign_id: cpn.campaignId,
                media: cpn.media || "unknown",
                member_name: memberName,
                project_name: projectName,
                rule_name: rule.rule_name,
                conditions: {
                  ...conditions,
                  matched_descriptions: descriptions,
                } as object,
                metrics: metrics as object,
                status: "error",
                error_message: error,
              },
            });
          }

          results.push({
            cpnName: cpn.cpnName,
            media: cpn.media || "unknown",
            memberName,
            projectName,
            ruleName: rule.rule_name,
            conditions,
            matchedDescriptions: descriptions,
            metrics,
            stopped,
            error,
          });

          console.log(`[Scheduled Auto-Stop] ${stopped ? "Stopped" : "Failed"}: ${cpn.cpnName}`);

          // 最初にマッチしたルールで処理を終了
          break;
        }
      }
    }

    const stoppedCount = results.filter(r => r.stopped).length;
    const failedResults = results.filter(r => !r.stopped);

    console.log(`[Scheduled Auto-Stop] Completed: ${stoppedCount}/${results.length} stopped`);

    // 停止に失敗したCPNがあればChatWorkにアラートを送信（成功は通知しない）
    if (failedResults.length > 0) {
      const failedCpns: AutoStopFailedCpn[] = failedResults.map(r => ({
        cpnName: r.cpnName,
        media: r.media,
        memberName: r.memberName,
        projectName: r.projectName,
        ruleName: r.ruleName,
        error: r.error,
        metrics: {
          spend: r.metrics.spend,
          profit: r.metrics.profit,
          roas: r.metrics.roas,
        },
      }));

      try {
        await sendAutoStopFailedAlert(failedCpns);
      } catch (err) {
        console.error("Failed to send ChatWork error alert:", err);
      }
    }

    return NextResponse.json({
      success: true,
      message: `${stoppedCount}/${results.length}件のCPNを停止しました`,
      processed: results.length,
      stopped: stoppedCount,
      failed: failedResults.length,
      results: results.map(r => ({
        cpnName: r.cpnName,
        media: r.media,
        stopped: r.stopped,
        error: r.error,
      })),
    });
  } catch (error) {
    console.error("[Scheduled Auto-Stop] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "実行に失敗しました" },
      { status: 500 }
    );
  }
}

// GETでヘルスチェック
export async function GET() {
  return NextResponse.json({ 
    success: true, 
    message: "Scheduled auto-stop endpoint is ready",
    timestamp: new Date().toISOString(),
  });
}
