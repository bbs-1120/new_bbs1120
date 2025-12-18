import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { judgeCpn, DEFAULT_CONFIG, JudgmentConfig, DailyData, CpnData } from "@/lib/judgment";
import { Decimal } from "@prisma/client/runtime/library";

// 設定を取得
async function getConfig(): Promise<JudgmentConfig> {
  const settings = await prisma.setting.findMany();
  const config = { ...DEFAULT_CONFIG };

  for (const setting of settings) {
    switch (setting.key) {
      case "stopReConsecutiveLossDays":
        config.stopReConsecutiveLossDays = Number(setting.value);
        break;
      case "replaceNoReConsecutiveLossDays":
        config.replaceNoReConsecutiveLossDays = Number(setting.value);
        break;
      case "lossThreshold7Days":
        config.lossThreshold7Days = Number(setting.value);
        break;
      case "roasThresholdStop":
        config.roasThresholdStop = Number(setting.value);
        break;
      case "roasThresholdContinue":
        config.roasThresholdContinue = Number(setting.value);
        break;
    }
  }

  return config;
}

// Decimalを数値に変換
function decimalToNumber(decimal: Decimal): number {
  return decimal.toNumber();
}

// POST: 仕分け実行
export async function POST() {
  try {
    // 設定を取得
    const config = await getConfig();

    // 全CPNの日次データを取得
    const allDailyData = await prisma.cpnDailyData.findMany({
      include: { media: true },
      orderBy: { date: "desc" },
    });

    // CPNキーでグループ化
    const cpnMap = new Map<string, CpnData>();

    for (const data of allDailyData) {
      if (!cpnMap.has(data.cpnKey)) {
        cpnMap.set(data.cpnKey, {
          cpnKey: data.cpnKey,
          cpnName: data.cpnName,
          mediaId: data.mediaId,
          dailyData: [],
        });
      }

      const cpn = cpnMap.get(data.cpnKey)!;
      cpn.dailyData.push({
        date: data.date,
        spend: decimalToNumber(data.spend),
        revenue: decimalToNumber(data.revenue),
        profit: decimalToNumber(data.profit),
        roas: decimalToNumber(data.roas),
      });
    }

    // 各CPNを判定
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const results = [];

    for (const cpnData of cpnMap.values()) {
      const result = judgeCpn(cpnData, config);

      // 既存の判定結果を更新または作成
      const judgmentResult = await prisma.judgmentResult.upsert({
        where: {
          cpnKey_judgmentDate: {
            cpnKey: result.cpnKey,
            judgmentDate: today,
          },
        },
        update: {
          cpnName: result.cpnName,
          todayProfit: result.todayProfit,
          profit7Days: result.profit7Days,
          roas7Days: result.roas7Days,
          consecutiveLossDays: result.consecutiveLossDays,
          judgment: result.judgment,
          reasons: result.reasons,
          recommendedAction: result.recommendedAction,
          isRe: result.isRe,
        },
        create: {
          cpnKey: result.cpnKey,
          cpnName: result.cpnName,
          mediaId: result.mediaId,
          judgmentDate: today,
          todayProfit: result.todayProfit,
          profit7Days: result.profit7Days,
          roas7Days: result.roas7Days,
          consecutiveLossDays: result.consecutiveLossDays,
          judgment: result.judgment,
          reasons: result.reasons,
          recommendedAction: result.recommendedAction,
          isRe: result.isRe,
        },
      });

      results.push(judgmentResult);
    }

    // 実行ログを記録
    const ruleVersionSetting = await prisma.setting.findUnique({
      where: { key: "ruleVersion" },
    });

    await prisma.executionLog.create({
      data: {
        executedBy: "中田悠太",
        actionType: "judgment",
        targetCount: results.length,
        ruleVersion: ruleVersionSetting?.value || "1.0",
        status: "success",
      },
    });

    return NextResponse.json({
      success: true,
      count: results.length,
      results: results,
    });
  } catch (error) {
    console.error("Judgment error:", error);

    // エラーログを記録
    await prisma.executionLog.create({
      data: {
        executedBy: "中田悠太",
        actionType: "judgment",
        targetCount: 0,
        ruleVersion: "1.0",
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return NextResponse.json(
      { success: false, error: "仕分け処理に失敗しました" },
      { status: 500 }
    );
  }
}

// GET: 仕分け結果を取得
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const results = await prisma.judgmentResult.findMany({
      where: {
        judgmentDate: targetDate,
      },
      include: {
        media: true,
      },
      orderBy: [
        { judgment: "asc" },
        { cpnName: "asc" },
      ],
    });

    // サマリーを計算
    const summary = {
      stop: results.filter((r) => r.judgment === "停止").length,
      replace: results.filter((r) => r.judgment === "作り替え").length,
      continue: results.filter((r) => r.judgment === "継続").length,
      check: results.filter((r) => r.judgment === "要確認").length,
      total: results.length,
    };

    return NextResponse.json({
      success: true,
      date: targetDate.toISOString().split("T")[0],
      summary,
      results,
    });
  } catch (error) {
    console.error("Get judgment results error:", error);
    return NextResponse.json(
      { success: false, error: "結果の取得に失敗しました" },
      { status: 500 }
    );
  }
}

