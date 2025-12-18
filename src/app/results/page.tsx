"use client";

import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JudgmentBadge } from "@/components/ui/badge";
import { useState, useEffect, useMemo } from "react";
import { Search, Download, RefreshCw } from "lucide-react";
import { getRoasColorClass } from "@/lib/utils";

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
  const [sortKey, setSortKey] = useState<string>("todayProfit");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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

  // ソート処理
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortedResults = [...filteredResults].sort((a, b) => {
    let aVal: number | string = 0;
    let bVal: number | string = 0;

    switch (sortKey) {
      case "cpnName": aVal = a.cpnName; bVal = b.cpnName; break;
      case "todayProfit": aVal = a.todayProfit; bVal = b.todayProfit; break;
      case "profit7Days": aVal = a.profit7Days; bVal = b.profit7Days; break;
      case "roas7Days": aVal = a.roas7Days; bVal = b.roas7Days; break;
      case "consecutiveLossDays": aVal = a.consecutiveLossDays; bVal = b.consecutiveLossDays; break;
      default: aVal = a.todayProfit; bVal = b.todayProfit;
    }

    if (typeof aVal === "string") {
      return sortDir === "asc" ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
    }
    return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortKey !== columnKey) return <span className="text-slate-300 ml-1">↕</span>;
    return <span className="text-indigo-600 ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
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

      {/* 媒体タブ - スマホ対応 */}
      <div className="flex flex-wrap gap-1.5 lg:gap-2 mb-4 lg:mb-6 overflow-x-auto scrollbar-hide -mx-4 px-4 lg:mx-0 lg:px-0">
        {mediaList.map((media) => (
          <button
            key={media}
            onClick={() => setSelectedMedia(media)}
            className={`px-2 lg:px-4 py-1.5 lg:py-2 rounded-lg text-xs lg:text-sm font-medium border transition-all whitespace-nowrap ${
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
            <span className={`ml-1 lg:ml-2 px-1 lg:px-1.5 py-0.5 rounded text-[10px] lg:text-xs ${
              selectedMedia === media
                ? "bg-white/20"
                : "bg-black/10"
            }`}>
              {mediaCounts[media] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* フィルターバー - スマホ対応 */}
      <Card className="mb-4 lg:mb-6">
        <div className="p-2 lg:p-4 flex flex-col lg:flex-row gap-2 lg:gap-4 lg:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="CPN名で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 lg:pl-10 pr-3 lg:pr-4 py-1.5 lg:py-2 border border-slate-200 rounded-lg text-xs lg:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={selectedJudgment}
              onChange={(e) => setSelectedJudgment(e.target.value)}
              className="flex-1 lg:flex-none border border-slate-200 rounded-lg px-2 lg:px-3 py-1.5 lg:py-2 text-xs lg:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {judgmentOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "全て" ? "判定: 全て" : option}
                </option>
              ))}
            </select>

            <Button variant="secondary" size="sm" className="text-xs lg:text-sm whitespace-nowrap">
              <Download className="mr-1 lg:mr-2 h-3 w-3 lg:h-4 lg:w-4" />
              <span className="hidden lg:inline">CSV</span>出力
            </Button>
          </div>
        </div>
      </Card>

      {/* 選択アクション - スマホ対応 */}
      {selectedKeys.length > 0 && (
        <div className="mb-3 lg:mb-4 p-2 lg:p-4 bg-indigo-50 rounded-lg flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
          <span className="text-xs lg:text-sm text-indigo-700">
            {selectedKeys.length}件選択中
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" className="text-xs">
              手修正
            </Button>
            <Button size="sm" className="text-xs">
              送信対象に追加
            </Button>
          </div>
        </div>
      )}

      {/* 結果テーブル - スマホ対応 */}
      <Card>
        <div className="p-2 lg:p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm lg:text-base font-medium text-slate-900">
            {selectedMedia === "全て" ? "全媒体" : selectedMedia}
            <span className="ml-1 lg:ml-2 text-slate-500 font-normal">
              ({filteredResults.length}件)
            </span>
          </h3>
        </div>
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[700px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-2 lg:px-3 py-2 lg:py-3 text-left w-8 lg:w-10">
                  <input
                    type="checkbox"
                    checked={
                      selectedKeys.length === filteredResults.length &&
                      filteredResults.length > 0
                    }
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 h-3 w-3 lg:h-4 lg:w-4"
                  />
                </th>
                <th 
                  onClick={() => handleSort("cpnName")}
                  className="px-2 lg:px-3 py-2 lg:py-3 text-left text-[10px] lg:text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                >
                  CPN名 <SortIcon columnKey="cpnName" />
                </th>
                {(selectedMedia === "全て" || selectedMedia === "TikTok/Pangle") && (
                  <th className="px-2 lg:px-3 py-2 lg:py-3 text-left text-[10px] lg:text-xs font-medium text-slate-500 uppercase whitespace-nowrap">
                    媒体
                  </th>
                )}
                <th className="hidden lg:table-cell px-2 lg:px-3 py-2 lg:py-3 text-center text-[10px] lg:text-xs font-medium text-slate-500 uppercase whitespace-nowrap w-10 lg:w-12">
                  Re
                </th>
                <th className="px-2 lg:px-3 py-2 lg:py-3 text-left text-[10px] lg:text-xs font-medium text-slate-500 uppercase whitespace-nowrap">
                  判定
                </th>
                <th 
                  onClick={() => handleSort("todayProfit")}
                  className="px-2 lg:px-3 py-2 lg:py-3 text-right text-[10px] lg:text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                >
                  利益 <SortIcon columnKey="todayProfit" />
                </th>
                <th 
                  onClick={() => handleSort("profit7Days")}
                  className="hidden lg:table-cell px-2 lg:px-3 py-2 lg:py-3 text-right text-[10px] lg:text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                >
                  7日利益 <SortIcon columnKey="profit7Days" />
                </th>
                <th 
                  onClick={() => handleSort("roas7Days")}
                  className="px-2 lg:px-3 py-2 lg:py-3 text-right text-[10px] lg:text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                >
                  ROAS <SortIcon columnKey="roas7Days" />
                </th>
                <th 
                  onClick={() => handleSort("consecutiveLossDays")}
                  className="hidden lg:table-cell px-2 lg:px-3 py-2 lg:py-3 text-center text-[10px] lg:text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                >
                  赤字 <SortIcon columnKey="consecutiveLossDays" />
                </th>
                <th className="hidden lg:table-cell px-2 lg:px-3 py-2 lg:py-3 text-left text-[10px] lg:text-xs font-medium text-slate-500 uppercase whitespace-nowrap">
                  理由
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sortedResults.map((result) => (
                <tr
                  key={result.cpnKey}
                  className={`hover:bg-slate-50 ${
                    selectedKeys.includes(result.cpnKey) ? "bg-indigo-50" : ""
                  }`}
                >
                  <td className="px-2 lg:px-3 py-2 lg:py-3 w-8 lg:w-10">
                    <input
                      type="checkbox"
                      checked={selectedKeys.includes(result.cpnKey)}
                      onChange={() => toggleSelect(result.cpnKey)}
                      className="rounded border-slate-300 h-3 w-3 lg:h-4 lg:w-4"
                    />
                  </td>
                  <td className="px-2 lg:px-3 py-2 lg:py-3 min-w-[100px] lg:min-w-[180px]">
                    <p className="text-[10px] lg:text-sm font-medium text-slate-900 break-all line-clamp-2" title={result.cpnName}>
                      {result.cpnName}
                    </p>
                  </td>
                  {(selectedMedia === "全て" || selectedMedia === "TikTok/Pangle") && (
                    <td className="px-2 lg:px-3 py-2 lg:py-3 whitespace-nowrap">
                      <span className={`inline-flex px-1.5 lg:px-2 py-0.5 lg:py-1 text-[9px] lg:text-xs font-medium rounded-full ${
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
                  <td className="hidden lg:table-cell px-2 lg:px-3 py-2 lg:py-3 text-center whitespace-nowrap w-10 lg:w-12">
                    <span
                      className={`text-[9px] lg:text-xs font-medium px-1.5 lg:px-2 py-0.5 lg:py-1 rounded ${
                        result.isRe
                          ? "bg-purple-100 text-purple-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {result.isRe ? "Re" : "-"}
                    </span>
                  </td>
                  <td className="px-2 lg:px-3 py-2 lg:py-3 whitespace-nowrap">
                    <JudgmentBadge judgment={result.judgment} />
                  </td>
                  <td className="px-2 lg:px-3 py-2 lg:py-3 text-right whitespace-nowrap">
                    <span
                      className={`text-[10px] lg:text-sm font-medium ${
                        result.todayProfit >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {formatCurrency(result.todayProfit)}
                    </span>
                  </td>
                  <td className="hidden lg:table-cell px-2 lg:px-3 py-2 lg:py-3 text-right whitespace-nowrap">
                    <span
                      className={`text-[10px] lg:text-sm font-medium ${
                        result.profit7Days >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {formatCurrency(result.profit7Days)}
                    </span>
                  </td>
                  <td className="px-2 lg:px-3 py-2 lg:py-3 text-right whitespace-nowrap">
                    <span className={`text-[10px] lg:text-sm font-medium ${getRoasColorClass(result.roas7Days)}`}>
                      {result.roas7Days.toFixed(1)}%
                    </span>
                  </td>
                  <td className="hidden lg:table-cell px-2 lg:px-3 py-2 lg:py-3 text-center whitespace-nowrap">
                    {formatLossDays(result)}
                  </td>
                  <td className="hidden lg:table-cell px-2 lg:px-3 py-2 lg:py-3 min-w-[100px]">
                    <div className="flex flex-wrap gap-1">
                      {result.reasons.slice(0, 2).map((reason, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-1.5 lg:px-2 py-0.5 rounded text-[9px] lg:text-xs bg-slate-100 text-slate-600 whitespace-nowrap"
                        >
                          {reason}
                        </span>
                      ))}
                      {result.reasons.length > 2 && (
                        <span className="text-[9px] lg:text-xs text-slate-400">
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
