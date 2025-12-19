import OpenAI from "openai";

// OpenAIクライアントを初期化
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return new OpenAI({ apiKey });
}

interface AnalysisData {
  summary: {
    spend: number;
    profit: number;
    roas: number;
    monthlyProfit: number;
    mcv: number;
    cv: number;
  };
  topCpns: { name: string; profit: number; roas: number }[];
  worstCpns: { name: string; profit: number; consecutiveLoss: number }[];
  topProjects: { name: string; profit: number }[];
  worstProjects: { name: string; profit: number }[];
  mediaPerformance: { name: string; profit: number; roas: number }[];
  dailyTrend: { date: string; profit: number }[];
}

/**
 * GPTによる運用傾向分析とアドバイスを生成
 */
export async function generateGPTAdvice(data: AnalysisData): Promise<string> {
  const client = getOpenAIClient();

  // 運用傾向の分析データを整形
  const totalProfit = data.dailyTrend.reduce((sum, d) => sum + d.profit, 0);
  const avgDailyProfit = data.dailyTrend.length > 0 ? totalProfit / data.dailyTrend.length : 0;
  const profitableDays = data.dailyTrend.filter(d => d.profit > 0).length;
  const lossDays = data.dailyTrend.filter(d => d.profit < 0).length;
  const winRate = data.dailyTrend.length > 0 ? (profitableDays / data.dailyTrend.length * 100) : 0;
  
  // 最も得意な案件・媒体を特定
  const bestProject = data.topProjects[0];
  const worstProject = data.worstProjects[0];
  const bestMedia = data.mediaPerformance[0];
  
  // 直近の傾向（上昇/下降）
  const recentTrend = data.dailyTrend.slice(-5);
  const trendDirection = recentTrend.length >= 2 
    ? (recentTrend[recentTrend.length - 1]?.profit > recentTrend[0]?.profit ? "上昇" : "下降")
    : "不明";

  const prompt = `あなたは広告運用コンサルタントです。中田悠太さんの運用データを分析し、**悠太さん個人の運用傾向**に基づいたパーソナライズされたアドバイスを提供してください。

## 👤 悠太さんの運用プロフィール

### 📊 今月の運用成績
- 12月累計利益: ¥${data.summary.monthlyProfit.toLocaleString()}
- 平均日次利益: ¥${Math.round(avgDailyProfit).toLocaleString()}
- 黒字日数: ${profitableDays}日 / 赤字日数: ${lossDays}日
- 勝率: ${winRate.toFixed(1)}%
- 直近の傾向: ${trendDirection}傾向

### 🎯 本日の成績
- 消化金額: ¥${data.summary.spend.toLocaleString()}
- 利益: ¥${data.summary.profit.toLocaleString()}
- ROAS: ${data.summary.roas.toFixed(1)}%
- MCV: ${data.summary.mcv}件 / CV: ${data.summary.cv}件

### 💪 悠太さんの強み（得意な領域）
- 最も利益を出している案件: ${bestProject ? `${bestProject.name}（¥${bestProject.profit.toLocaleString()}）` : "データなし"}
- 最も効率の良い媒体: ${bestMedia ? `${bestMedia.name}（ROAS ${bestMedia.roas.toFixed(1)}%）` : "データなし"}
- 好調なCPN TOP3:
${data.topCpns.slice(0, 3).map((c, i) => `  ${i + 1}. ${c.name.substring(0, 40)}...（¥${c.profit.toLocaleString()}）`).join("\n")}

### ⚠️ 改善が必要な領域
- 赤字が大きい案件: ${worstProject ? `${worstProject.name}（¥${worstProject.profit.toLocaleString()}）` : "なし"}
- 要注意CPN（連続赤字）:
${data.worstCpns.slice(0, 3).map((c, i) => `  ${i + 1}. ${c.name.substring(0, 40)}...（${c.consecutiveLoss}日連続赤字）`).join("\n")}

### 📈 直近5日間の利益推移
${recentTrend.map(d => `- ${d.date}: ¥${d.profit.toLocaleString()}`).join("\n")}

---

## 🎯 分析してほしいこと

悠太さんの運用データから、以下を分析してアドバイスしてください：

1. **運用傾向の分析**: 悠太さんはどんな案件・媒体が得意で、どこに課題があるか
2. **今日やるべきこと**: 本日のデータを見て、今すぐ取るべきアクション
3. **強みを活かす提案**: 得意領域をさらに伸ばすための具体策
4. **弱点の改善策**: 赤字領域の改善アプローチ
5. **今後の戦略**: 12月残りの期間で利益を最大化するための提案

親しみやすく、悠太さんに直接話しかけるような口調で、具体的で実行可能なアドバイスをお願いします。絵文字を使って分かりやすく！`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "あなたは広告運用のパーソナルコンサルタントです。中田悠太さんの運用傾向を理解し、彼に合わせたカスタマイズされたアドバイスを提供します。親しみやすく、具体的で実行可能なアドバイスを日本語で提供してください。"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || "アドバイスを生成できませんでした。";
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw error;
  }
}

/**
 * OpenAI APIが利用可能かチェック
 */
export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

