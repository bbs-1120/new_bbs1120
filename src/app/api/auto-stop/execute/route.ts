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

// TikTok広告を停止するAPI
async function stopTikTokCampaign(campaignId: string, advertiserId: string): Promise<{ success: boolean; error?: string }> {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  if (!accessToken) {
    return { success: false, error: "TikTok access token not configured" };
  }

  try {
    const response = await fetch(
      "https://business-api.tiktok.com/open_api/v1.3/campaign/update/status/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Access-Token": accessToken,
        },
        body: JSON.stringify({
          advertiser_id: advertiserId,
          campaign_ids: [campaignId],
          operation_status: "DISABLE",
        }),
      }
    );

    const data = await response.json();
    if (data.code === 0) {
      return { success: true };
    }
    return { success: false, error: data.message || "TikTok API error" };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
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

      // campaignIdがない場合はスキップ
      if (!cpn.campaignId) continue;

      const { memberName, projectName, offerName } = extractFromCpnName(cpn.cpnName);

      // 各ルールをチェック（優先度順）
      for (const rule of dbRules) {
        // メンバーが一致するかチェック
        if (rule.member_name !== "全員" && rule.member_name !== memberName) continue;

        // 案件が一致するかチェック
        if (rule.project_name !== "全案件" && rule.project_name !== projectName) continue;

        // 媒体が一致するかチェック（allまたは一致）
        if (rule.media !== "all" && rule.media !== "全媒体") {
          const ruleMedia = rule.media.toLowerCase();
          const cpnMedia = (cpn.media || "").toLowerCase();
          if (ruleMedia !== cpnMedia && 
              !(ruleMedia === "meta" && cpnMedia === "fb") &&
              !(ruleMedia === "fb" && cpnMedia === "meta")) {
            continue;
          }
        }

        const conditions = rule.conditions as StopRuleConditions & { offerName?: string };
        
        // オファーが一致するかチェック
        const ruleOfferName = conditions.offerName || "全オファー";
        if (ruleOfferName !== "全オファー" && ruleOfferName !== offerName) continue;

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

      const { memberName, projectName } = extractFromCpnName(cpn.cpnName);

      for (const rule of dbRules) {
        if (rule.member_name !== "全員" && rule.member_name !== memberName) continue;
        if (rule.project_name !== "全案件" && rule.project_name !== projectName) continue;

        if (rule.media !== "all") {
          const ruleMedia = rule.media.toLowerCase();
          const cpnMedia = (cpn.media || "").toLowerCase();
          if (ruleMedia !== cpnMedia && 
              !(ruleMedia === "meta" && cpnMedia === "fb") &&
              !(ruleMedia === "fb" && cpnMedia === "meta")) {
            continue;
          }
        }

        const conditions = rule.conditions as StopRuleConditions;

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
