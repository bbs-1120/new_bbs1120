import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getFullAnalysisData } from "@/lib/googleSheets";
import { sendAutoStopFailedAlert, AutoStopFailedCpn } from "@/lib/chatwork";

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

// TikTok Smart Plus Campaign 停止API
async function stopTikTokSpcCampaign(
  accessToken: string,
  advertiserId: string,
  campaignId: string
): Promise<{ success: boolean; error?: string }> {
  // 明示的に文字列変換
  const advertiserIdStr = String(advertiserId).trim();
  const campaignIdStr = String(campaignId).trim();

  const payload = {
    advertiser_id: advertiserIdStr,
    campaign_id: campaignIdStr,
    operation_status: "DISABLE",
  };

  console.log(`[Auto-Stop] SPC API request:`, JSON.stringify(payload));

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
    console.log(`[Auto-Stop] SPC API response for ${campaignIdStr}:`, JSON.stringify(data));
    
    if (data.code === 0) {
      return { success: true };
    }
    
    // エラーメッセージを正規化
    const errorMsg = (data.message || "").toLowerCase();
    
    // Upgraded Smart Plus / Smart Plus はAPIで未サポートの場合、広告グループレベルで試す
    if (errorMsg.includes("upgraded smart plus") || 
        errorMsg.includes("smart plus") ||
        errorMsg.includes("does not support") ||
        errorMsg.includes("not support") ||
        errorMsg.includes("spc") ||
        data.code === 40701) {
      console.log(`[Auto-Stop] SPC API not supported for ${campaignIdStr}, trying adgroup level...`);
      // 広告グループレベルでの停止を試す
      return await stopTikTokAdGroups(accessToken, advertiserIdStr, campaignIdStr);
    }
    
    return { success: false, error: data.message || "SPC API error" };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "SPC API error" };
  }
}

// TikTok 広告グループ取得
async function getTikTokAdGroups(
  accessToken: string,
  advertiserId: string,
  campaignId: string
): Promise<{ success: boolean; adgroupIds?: string[]; error?: string }> {
  // 明示的に文字列変換
  const advertiserIdStr = String(advertiserId).trim();
  const campaignIdStr = String(campaignId).trim();

  try {
    const params = new URLSearchParams({
      advertiser_id: advertiserIdStr,
      filtering: JSON.stringify({
        campaign_ids: [campaignIdStr],
      }),
      page_size: "100",
    });

    console.log(`[Auto-Stop] Get adgroups request for campaign ${campaignIdStr}:`, params.toString());

    const response = await fetch(
      `https://business-api.tiktok.com/open_api/v1.3/adgroup/get/?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Access-Token": accessToken,
        },
      }
    );

    const data = await response.json();
    console.log(`[Auto-Stop] Get adgroups response for campaign ${campaignIdStr}:`, JSON.stringify(data));
    
    if (data.code === 0 && data.data?.list) {
      const adgroupIds = data.data.list.map((ag: { adgroup_id: string }) => String(ag.adgroup_id));
      return { success: true, adgroupIds };
    }
    
    return { success: false, error: data.message || "Failed to get adgroups" };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Get adgroups error" };
  }
}

// TikTok 広告グループレベルで停止
async function stopTikTokAdGroups(
  accessToken: string,
  advertiserId: string,
  campaignId: string
): Promise<{ success: boolean; error?: string }> {
  // 明示的に文字列変換
  const advertiserIdStr = String(advertiserId).trim();
  const campaignIdStr = String(campaignId).trim();

  // まず広告グループIDを取得
  const getResult = await getTikTokAdGroups(accessToken, advertiserIdStr, campaignIdStr);
  
  if (!getResult.success || !getResult.adgroupIds || getResult.adgroupIds.length === 0) {
    return { success: false, error: getResult.error || "広告グループが見つかりません" };
  }

  console.log(`[Auto-Stop] Found ${getResult.adgroupIds.length} adgroups for campaign ${campaignIdStr}`);

  const payload = {
    advertiser_id: advertiserIdStr,
    adgroup_ids: getResult.adgroupIds,
    operation_status: "DISABLE",
  };

  console.log(`[Auto-Stop] Adgroup status update request:`, JSON.stringify(payload));

  try {
    // 広告グループを停止
    const response = await fetch(
      "https://business-api.tiktok.com/open_api/v1.3/adgroup/status/update/",
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
    console.log(`[Auto-Stop] Adgroup status update response:`, JSON.stringify(data));
    
    if (data.code === 0) {
      return { success: true };
    }
    
    return { success: false, error: data.message || "Adgroup status update failed" };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Adgroup update error" };
  }
}

// TikTok広告を停止するAPI（Smart Plus対応）
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
    try {
      // リクエストペイロードを作成（GASと同じ形式）
      const payload = {
        advertiser_id: advertiserIdStr,
        campaign_ids: [campaignIdStr],
        operation_status: "DISABLE",
      };

      console.log(`[Auto-Stop] TikTok API request:`, JSON.stringify(payload));

      // まず通常のステータス更新APIを試す
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
      console.log(`[Auto-Stop] TikTok API response for ${campaignIdStr}:`, JSON.stringify(data));
      
      if (data.code === 0) {
        return { success: true };
      }
      
      lastError = data.message || "TikTok API error";
      
      // Smart Plus / SPC の場合はSPC APIを試す
      if (data.message?.includes("Smart Performance Campaign") || 
          data.message?.includes("spc") ||
          data.message?.includes("Upgraded Smart Plus") ||
          data.message?.includes("Smart Plus")) {
        console.log(`[Auto-Stop] Trying SPC API for ${campaignIdStr}...`);
        const spcResult = await stopTikTokSpcCampaign(accessToken, advertiserIdStr, campaignIdStr);
        if (spcResult.success) {
          return { success: true };
        }
        lastError = spcResult.error || lastError;
        // SPC APIも失敗した場合は次のトークンを試す
        continue;
      }
      
      // 権限エラーの場合は次のトークンを試す
      if (data.code === 40002 || data.code === 40001 || data.code === 40100) {
        continue;
      }
    } catch (error) {
      console.error(`[Auto-Stop] TikTok API error for ${campaignId}:`, error);
      lastError = error instanceof Error ? error.message : "Unknown error";
    }
  }

  return { success: false, error: lastError };
}

// 条件にマッチするかチェック
function matchesRule(cpn: CpnData, conditions: StopRuleConditions): boolean {
  // すべての条件を満たす必要がある（AND条件）
  // 条件が1つも設定されていない場合はマッチしない
  const hasAnyCondition = Object.values(conditions).some(v => v !== undefined && v !== null);
  if (!hasAnyCondition) return false;

  // 消化金額（以上）
  if (conditions.spendMin !== undefined) {
    if (cpn.spend < conditions.spendMin) return false;
  }

  // MCV（以下）
  if (conditions.mcvMax !== undefined) {
    if (cpn.mcv > conditions.mcvMax) return false;
  }

  // CV（以下）
  if (conditions.cvMax !== undefined) {
    if (cpn.cv > conditions.cvMax) return false;
  }

  // CV（以上）
  if (conditions.cvMin !== undefined) {
    if (cpn.cv < conditions.cvMin) return false;
  }

  // ROAS（以下）
  if (conditions.roasMax !== undefined) {
    if (cpn.roas > conditions.roasMax) return false;
  }

  // 利益（以下）
  if (conditions.profitMax !== undefined) {
    if (cpn.profit > conditions.profitMax) return false;
  }

  // 連続赤字日数（以上）
  if (conditions.consecutiveLossMin !== undefined) {
    if ((cpn.consecutiveLoss || 0) < conditions.consecutiveLossMin) return false;
  }

  return true;
}

// CPNからメンバー名、案件名、オファー名を抽出
function extractFromCpnName(cpnName: string): { memberName: string; projectName: string; offerName: string } {
  // 例: 新規グロース部_悠太_Rクリニック女性_新直LINE_FB_...
  // parts[0]: 新規グロース部
  // parts[1]: メンバー名 (悠太)
  // parts[2]: 案件名 (Rクリニック女性)
  // parts[3]: オファー名 (新直LINE)
  // parts[4]: 媒体 (FB)
  const parts = cpnName.split("_");
  return {
    memberName: parts.length > 1 ? parts[1] : "",
    projectName: parts.length > 2 ? parts[2] : "",
    offerName: parts.length > 3 ? parts[3] : "",
  };
}

// POST: 自動停止を実行
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "認証が必要です" }, { status: 401 });
    }

    const body = await request.json();
    const dryRun = body.dryRun !== false; // デフォルトはdry run

    // 有効なルールを取得（優先度順）
    const dbRules = await prisma.auto_stop_rules.findMany({
      where: { is_active: true },
      orderBy: { priority: "asc" },
    });

    if (dbRules.length === 0) {
      return NextResponse.json({
        success: true,
        message: "有効なルールがありません",
        processed: 0,
        stopped: 0,
        results: [],
      });
    }

    // 除外リストを取得
    const exclusions = await prisma.auto_stop_exclusions.findMany();
    const excludedCpns = new Set(exclusions.map(e => e.cpn_name));

    // 今日すでにエラーになったCPNを取得（重複通知を防ぐ）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayErrors = await prisma.auto_stop_history.findMany({
      where: {
        status: "error",
        stopped_at: { gte: today },
      },
      select: { cpn_name: true },
    });
    const todayErrorCpns = new Set(todayErrors.map(e => e.cpn_name));

    // 分析データを取得
    const analysisData = await getFullAnalysisData();

    // Meta Access Tokenを取得
    const metaTokens = [
      process.env.META_ACCESS_TOKEN_BUSINESS_01,
      process.env.META_ACCESS_TOKEN_BUSINESS_03,
      process.env.META_ACCESS_TOKEN_BUSINESS_08,
      process.env.META_ACCESS_TOKEN_BUSINESS_11,
      process.env.META_ACCESS_TOKEN_BUSINESS_13,
      process.env.META_ACCESS_TOKEN_BUSINESS_14,
    ].filter(Boolean) as string[];

    const results: {
      cpnName: string;
      media: string;
      memberName: string;
      projectName: string;
      ruleName: string;
      conditions: StopRuleConditions;
      metrics: { spend: number; cv: number; mcv: number; profit: number; roas: number };
      stopped: boolean;
      error?: string;
    }[] = [];

    // 各CPNをチェック
    for (const cpn of analysisData) {
      // 除外リストにあるCPNはスキップ
      if (excludedCpns.has(cpn.cpnName)) continue;

      // 今日すでにエラーになったCPNはスキップ（重複通知を防ぐ）
      if (todayErrorCpns.has(cpn.cpnName)) continue;

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
        if (matchesRule(cpn as CpnData, conditions)) {
          const metrics = {
            spend: cpn.spend || 0,
            cv: cpn.cv || 0,
            mcv: cpn.mcv || 0,
            profit: cpn.profit || 0,
            roas: cpn.roas || 0,
          };

          let stopped = false;
          let error: string | undefined;

          if (!dryRun) {
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
              if (mapping?.advertiser_id) {
                const result = await stopTikTokCampaign(cpn.campaignId, mapping.advertiser_id);
                stopped = result.success;
                error = result.error;
              } else {
                error = "Advertiser ID not found";
              }
            } else {
              error = `Unsupported media: ${cpn.media}`;
            }

            // マッチした条件の説明を生成
            const matchedConditions: string[] = [];
            if (conditions.spendMin !== undefined && metrics.spend >= conditions.spendMin) {
              matchedConditions.push(`消化≥¥${conditions.spendMin.toLocaleString()}（実際: ¥${metrics.spend.toLocaleString()}）`);
            }
            if (conditions.mcvMax !== undefined && metrics.mcv <= conditions.mcvMax) {
              matchedConditions.push(`MCV≤${conditions.mcvMax}（実際: ${metrics.mcv}）`);
            }
            if (conditions.cvMax !== undefined && metrics.cv <= conditions.cvMax) {
              matchedConditions.push(`CV≤${conditions.cvMax}（実際: ${metrics.cv}）`);
            }
            if (conditions.cvMin !== undefined && metrics.cv >= conditions.cvMin) {
              matchedConditions.push(`CV≥${conditions.cvMin}（実際: ${metrics.cv}）`);
            }
            if (conditions.roasMax !== undefined && metrics.roas <= conditions.roasMax) {
              matchedConditions.push(`ROAS≤${conditions.roasMax}%（実際: ${metrics.roas.toFixed(1)}%）`);
            }
            if (conditions.profitMax !== undefined && metrics.profit <= conditions.profitMax) {
              matchedConditions.push(`利益≤¥${conditions.profitMax.toLocaleString()}（実際: ¥${metrics.profit.toLocaleString()}）`);
            }
            if (conditions.consecutiveLossMin !== undefined) {
              const actualLoss = (cpn as CpnData).consecutiveLoss || 0;
              if (actualLoss >= conditions.consecutiveLossMin) {
                matchedConditions.push(`連続赤字≥${conditions.consecutiveLossMin}日（実際: ${actualLoss}日）`);
              }
            }

            // 履歴に保存（マッチした条件の説明を含める）
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
                  matched_descriptions: matchedConditions,
                } as object,
                metrics: metrics as object,
                status: stopped ? "stopped" : "error",
                error_message: error || null,
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
            metrics,
            stopped: dryRun ? false : stopped,
            error: dryRun ? "Dry run mode" : error,
          });

          // 最初にマッチしたルールで処理を終了（1つのCPNに複数ルールは適用しない）
          break;
        }
      }
    }

    const stoppedCount = results.filter(r => r.stopped).length;
    const failedResults = results.filter(r => !r.stopped && !dryRun);

    // 停止に失敗したCPNがあればChatWorkにアラートを送信
    if (failedResults.length > 0 && !dryRun) {
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

      // ChatWorkにアラート送信（非同期で実行、失敗しても処理は続行）
      sendAutoStopFailedAlert(failedCpns).catch(err => {
        console.error("Failed to send ChatWork alert:", err);
      });
    }

    return NextResponse.json({
      success: true,
      message: dryRun
        ? `${results.length}件のCPNが停止対象です（プレビュー）`
        : `${stoppedCount}/${results.length}件のCPNを停止しました`,
      processed: results.length,
      stopped: stoppedCount,
      failed: failedResults.length,
      dryRun,
      results,
      alertSent: failedResults.length > 0 && !dryRun,
    });
  } catch (error) {
    console.error("Auto-stop execute error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "実行に失敗しました" },
      { status: 500 }
    );
  }
}

// GET: プレビュー（dry run）
export async function GET() {
  try {
    // 有効なルールを取得
    const dbRules = await prisma.auto_stop_rules.findMany({
      where: { is_active: true },
      orderBy: { priority: "asc" },
    });

    if (dbRules.length === 0) {
      return NextResponse.json({
        success: true,
        message: "有効なルールがありません",
        targets: [],
        count: 0,
      });
    }

    // 除外リストを取得
    const exclusions = await prisma.auto_stop_exclusions.findMany();
    const excludedCpns = new Set(exclusions.map(e => e.cpn_name));

    // 分析データを取得
    const analysisData = await getFullAnalysisData();

    const targets: {
      cpnName: string;
      media: string;
      memberName: string;
      projectName: string;
      ruleName: string;
      metrics: { spend: number; cv: number; mcv: number; profit: number; roas: number };
    }[] = [];

    for (const cpn of analysisData) {
      if (excludedCpns.has(cpn.cpnName)) continue;
      if (!cpn.campaignId) continue;

      const { memberName, projectName, offerName } = extractFromCpnName(cpn.cpnName);

      for (const rule of dbRules) {
        if (rule.member_name !== "全員" && rule.member_name !== memberName) continue;
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

        if (matchesRule(cpn as CpnData, conditions)) {
          targets.push({
            cpnName: cpn.cpnName,
            media: cpn.media || "unknown",
            memberName,
            projectName,
            ruleName: rule.rule_name,
            metrics: {
              spend: cpn.spend || 0,
              cv: cpn.cv || 0,
              mcv: cpn.mcv || 0,
              profit: cpn.profit || 0,
              roas: cpn.roas || 0,
            },
          });
          break;
        }
      }
    }

    return NextResponse.json({
      success: true,
      count: targets.length,
      targets,
    });
  } catch (error) {
    console.error("Auto-stop preview error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "プレビューに失敗しました" },
      { status: 500 }
    );
  }
}
