import { NextResponse } from "next/server";
import { getComparisonData } from "@/lib/googleSheets";
import { getCache, setCache } from "@/lib/cache";

const CACHE_KEY = "comparison_data";

export async function GET() {
  try {
    // キャッシュをチェック
    const cached = getCache<Awaited<ReturnType<typeof getComparisonData>>>(CACHE_KEY);
    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached,
        cached: true,
      });
    }

    // データを取得
    const data = await getComparisonData();

    if (!data) {
      return NextResponse.json({
        success: false,
        error: "比較データの取得に失敗しました",
      });
    }

    // キャッシュに保存（15分）
    setCache(CACHE_KEY, data, 15 * 60 * 1000);

    return NextResponse.json({
      success: true,
      data,
      cached: false,
    });
  } catch (error) {
    console.error("Comparison data error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

