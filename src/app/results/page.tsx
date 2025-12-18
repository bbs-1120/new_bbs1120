"use client";

import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JudgmentBadge } from "@/components/ui/badge";
import { useState, useEffect, useMemo } from "react";
import { Search, Download, RefreshCw } from "lucide-react";

interface JudgmentResult {
  cpnKey: string;
  cpnName: string;
  media: string;
  judgment: string;
  todayProfit: number;
  profit7Days: number;
  roas7Days: number;
  consecutiveLossDays: number;
  reasons: string[];
  isRe: boolean;
}

const judgmentOptions = ["全て", "停止", "作り替え", "継続", "エラー"];

export default function ResultsPage() {
  const [results, setResults] = useState<JudgmentResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMedia, setSelectedMedia] = useState("全て");
  const [selectedJudgment, setSelectedJudgment] = useState("全て");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  // データを取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/judgment");
        const data = await response.json();
        
        if (data.success) {
          setResults(data.results);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // 媒体リストを動的に取得（TikTok/Pangleは統合）
  const mediaList = useMemo(() => {
    const mediaSet = new Set(results.map(r => {
      if (r.media === "TikTok" || r.media === "Pangle") return "TikTok/Pangle";
      return r.media;
    }));
    return ["全て", ...Array.from(mediaSet).sort()];
  }, [results]);

  // 媒体別のカウント
  const mediaCounts = useMemo(() => {
    const counts: Record<string, number> = { "全て": results.length };
    results.forEach(r => {
      const mediaKey = (r.media === "TikTok" || r.media === "Pangle") ? "TikTok/Pangle" : r.media;
      counts[mediaKey] = (counts[mediaKey] || 0) + 1;
    });
    return counts;
  }, [results]);

  const filteredResults = results.filter((result) => {
    const matchesSearch =
      result.cpnName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      result.cpnKey.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMedia = selectedMedia === "全て" || 
      (selectedMedia === "TikTok/Pangle" && (result.media === "TikTok" || result.media === "Pangle")) ||
      result.media === selectedMedia;
    const matchesJudgment =
      selectedJudgment === "全て" || result.judgment === selectedJudgment;
    return matchesSearch && matchesMedia && matchesJudgment;
  });

  const formatCurrency = (value: number) => {
    const sign = value < 0 ? "" : "+";
    return `${sign}¥${Math.floor(value).toLocaleString("ja-JP")}`;
  };

  const toggleSelect = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleSelectAll = () => {
    if (selectedKeys.length === filteredResults.length) {
      setSelectedKeys([]);
    } else {
      setSelectedKeys(filteredResults.map((r) => r.cpnKey));
    }
  };

  // 赤字日数の表示
  const formatLossDays = (result: JudgmentResult) => {
    if (result.todayProfit >= 0) {
      return <span className="text-green-600 font-medium text-sm">当日プラス</span>;
    } else if (result.consecutiveLossDays === 1) {
      return <span className="text-red-600 font-medium text-sm">当日マイナス</span>;
    } else if (result.consecutiveLossDays >= 2) {
      return <span className="text-red-600 font-medium text-sm">マイナス{result.consecutiveLossDays}日</span>;
    }
    return <span className="text-slate-400">-</span>;
  };

  // 媒体のスタイル
  const getMediaStyle = (media: string) => {
    switch (media) {
      case "Meta": return "bg-blue-100 text-blue-700 border-blue-200";
      case "TikTok": return "bg-pink-100 text-pink-700 border-pink-200";
      case "Pangle": return "bg-orange-100 text-orange-700 border-orange-200";
      case "TikTok/Pangle": return "bg-gradient-to-r from-pink-100 to-orange-100 text-pink-700 border-pink-200";
      case "YouTube": return "bg-red-100 text-red-700 border-red-200";
      case "LINE": return "bg-green-100 text-green-700 border-green-200";
      default: return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  if (isLoading) {
    return (
      <>
        <Header title="判断結果" description="CPNの自動判定結果一覧" />
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
          <span className="ml-3 text-slate-500">読み込み中...</span>
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title="仕分け結果"
        description={`CPN仕分け結果の一覧表示（${results.length}件）`}
      />

      {/* 媒体タブ */}
      <div className="flex flex-wrap gap-2 mb-6">
        {mediaList.map((media) => (
          <button
            key={media}
            onClick={() => setSelectedMedia(media)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
              selectedMedia === media
                ? media === "全て"
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : getMediaStyle(media).replace("100", "600").replace("700", "white") + " bg-opacity-100"
                : media === "全て"
                  ? "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  : `${getMediaStyle(media)} hover:opacity-80`
            }`}
          >
            {media}
            <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
              selectedMedia === media
                ? "bg-white/20"
                : "bg-black/10"
            }`}>
              {mediaCounts[media] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* フィルターバー */}
      <Card className="mb-6">
        <div className="p-4 flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="CPN名で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select
            value={selectedJudgment}
            onChange={(e) => setSelectedJudgment(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {judgmentOptions.map((option) => (
              <option key={option} value={option}>
                {option === "全て" ? "判定: 全て" : option}
              </option>
            ))}
          </select>

          <Button variant="secondary" size="sm">
            <Download className="mr-2 h-4 w-4" />
            CSV出力
          </Button>
        </div>
      </Card>

      {/* 選択アクション */}
      {selectedKeys.length > 0 && (
        <div className="mb-4 p-4 bg-indigo-50 rounded-lg flex items-center justify-between">
          <span className="text-sm text-indigo-700">
            {selectedKeys.length}件選択中
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary">
              手修正
            </Button>
            <Button size="sm">
              送信対象に追加
            </Button>
          </div>
        </div>
      )}

      {/* 結果テーブル */}
      <Card>
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-medium text-slate-900">
            {selectedMedia === "全て" ? "全媒体" : selectedMedia}
            <span className="ml-2 text-slate-500 font-normal">
              ({filteredResults.length}件)
            </span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={
                      selectedKeys.length === filteredResults.length &&
                      filteredResults.length > 0
                    }
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  CPN名
                </th>
                {(selectedMedia === "全て" || selectedMedia === "TikTok/Pangle") && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    媒体
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Re
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  判定
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                  当日利益
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                  7日利益
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                  7日ROAS
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">
                  赤字日数
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  理由
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredResults.map((result) => (
                <tr
                  key={result.cpnKey}
                  className={`hover:bg-slate-50 ${
                    selectedKeys.includes(result.cpnKey) ? "bg-indigo-50" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedKeys.includes(result.cpnKey)}
                      onChange={() => toggleSelect(result.cpnKey)}
                      className="rounded border-slate-300"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-900">
                      {result.cpnName}
                    </p>
                  </td>
                  {(selectedMedia === "全て" || selectedMedia === "TikTok/Pangle") && (
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        result.media === "Meta" ? "bg-blue-100 text-blue-700" :
                        result.media === "TikTok" ? "bg-pink-100 text-pink-700" :
                        result.media === "Pangle" ? "bg-orange-100 text-orange-700" :
                        result.media === "YouTube" ? "bg-red-100 text-red-700" :
                        result.media === "LINE" ? "bg-green-100 text-green-700" :
                        "bg-slate-100 text-slate-700"
                      }`}>
                        {result.media}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded ${
                        result.isRe
                          ? "bg-purple-100 text-purple-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {result.isRe ? "Re" : "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <JudgmentBadge judgment={result.judgment} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`text-sm font-medium ${
                        result.todayProfit >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {formatCurrency(result.todayProfit)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`text-sm font-medium ${
                        result.profit7Days >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {formatCurrency(result.profit7Days)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-slate-600">
                      {result.roas7Days.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {formatLossDays(result)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {result.reasons.slice(0, 2).map((reason, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600"
                        >
                          {reason}
                        </span>
                      ))}
                      {result.reasons.length > 2 && (
                        <span className="text-xs text-slate-400">
                          +{result.reasons.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredResults.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            条件に一致するCPNが見つかりません
          </div>
        )}
      </Card>
    </>
  );
}
