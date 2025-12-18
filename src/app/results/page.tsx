"use client";

import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JudgmentBadge } from "@/components/ui/badge";
import { useState } from "react";
import { Search, Filter, Download } from "lucide-react";

// 仮のデータ
const mockResults = [
  {
    id: "1",
    cpnKey: "営業_田中_化粧品A_初回_Meta_001_20241218_01_キャンペーンA",
    cpnName: "キャンペーンA",
    media: "Meta",
    judgment: "停止",
    todayProfit: -15000,
    profit7Days: -45000,
    roas7Days: 95,
    consecutiveLossDays: 3,
    reasons: ["連続赤字(3日)", "ROAS基準未達(95%)"],
    recommendedAction: "広告配信を停止してください",
    isRe: true,
    isSendTarget: true,
  },
  {
    id: "2",
    cpnKey: "営業_佐藤_健康食品B_定期_TikTok_002_20241218_02_キャンペーンB",
    cpnName: "キャンペーンB_Re",
    media: "TikTok",
    judgment: "継続",
    todayProfit: 8500,
    profit7Days: 32000,
    roas7Days: 125,
    consecutiveLossDays: 0,
    reasons: ["7日間黒字", "ROAS基準達成(125%)"],
    recommendedAction: "現状維持で継続してください",
    isRe: true,
    isSendTarget: false,
  },
  {
    id: "3",
    cpnKey: "営業_鈴木_美容C_お試し_YouTube_003_20241218_03_キャンペーンC",
    cpnName: "キャンペーンC",
    media: "YouTube",
    judgment: "作り替え",
    todayProfit: -5000,
    profit7Days: -28000,
    roas7Days: 102,
    consecutiveLossDays: 4,
    reasons: ["連続赤字(4日)"],
    recommendedAction: "クリエイティブの作り替えを検討してください",
    isRe: false,
    isSendTarget: true,
  },
  {
    id: "4",
    cpnKey: "営業_山田_食品D_限定_LINE_004_20241218_04_キャンペーンD",
    cpnName: "キャンペーンD",
    media: "LINE",
    judgment: "要確認",
    todayProfit: 0,
    profit7Days: -5000,
    roas7Days: 108,
    consecutiveLossDays: 1,
    reasons: ["条件不一致"],
    recommendedAction: "個別に状況を確認してください",
    isRe: false,
    isSendTarget: false,
  },
  {
    id: "5",
    cpnKey: "営業_高橋_サプリE_通常_Pangle_005_20241218_05_キャンペーンE",
    cpnName: "キャンペーンE",
    media: "Pangle",
    judgment: "継続",
    todayProfit: 12000,
    profit7Days: 55000,
    roas7Days: 135,
    consecutiveLossDays: 0,
    reasons: ["7日間黒字", "当日黒字", "ROAS基準達成(135%)"],
    recommendedAction: "現状維持で継続してください",
    isRe: false,
    isSendTarget: false,
  },
];

const mediaOptions = ["全て", "Meta", "TikTok", "YouTube", "Pangle", "LINE"];
const judgmentOptions = ["全て", "停止", "作り替え", "継続", "要確認"];

export default function ResultsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMedia, setSelectedMedia] = useState("全て");
  const [selectedJudgment, setSelectedJudgment] = useState("全て");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filteredResults = mockResults.filter((result) => {
    const matchesSearch =
      result.cpnName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      result.cpnKey.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMedia = selectedMedia === "全て" || result.media === selectedMedia;
    const matchesJudgment =
      selectedJudgment === "全て" || result.judgment === selectedJudgment;
    return matchesSearch && matchesMedia && matchesJudgment;
  });

  const formatCurrency = (value: number) => {
    const sign = value < 0 ? "" : "+";
    return `${sign}¥${value.toLocaleString("ja-JP")}`;
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredResults.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredResults.map((r) => r.id));
    }
  };

  return (
    <>
      <Header
        title="仕分け結果"
        description="CPN仕分け結果の一覧表示・フィルタ・手修正"
      />

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

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={selectedMedia}
              onChange={(e) => setSelectedMedia(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {mediaOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "全て" ? "媒体: 全て" : option}
                </option>
              ))}
            </select>

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
          </div>

          <Button variant="secondary" size="sm">
            <Download className="mr-2 h-4 w-4" />
            CSV出力
          </Button>
        </div>
      </Card>

      {/* 選択アクション */}
      {selectedIds.length > 0 && (
        <div className="mb-4 p-4 bg-indigo-50 rounded-lg flex items-center justify-between">
          <span className="text-sm text-indigo-700">
            {selectedIds.length}件選択中
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
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={
                      selectedIds.length === filteredResults.length &&
                      filteredResults.length > 0
                    }
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  CPN名
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  媒体
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
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">
                  送信
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredResults.map((result) => (
                <tr
                  key={result.id}
                  className={`hover:bg-slate-50 ${
                    selectedIds.includes(result.id) ? "bg-indigo-50" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(result.id)}
                      onChange={() => toggleSelect(result.id)}
                      className="rounded border-slate-300"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {result.cpnName}
                      </p>
                      <p className="text-xs text-slate-500 truncate max-w-[200px]">
                        {result.cpnKey}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-600">{result.media}</span>
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
                      {result.roas7Days}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-sm font-medium ${
                        result.consecutiveLossDays > 0
                          ? "text-red-600"
                          : "text-slate-600"
                      }`}
                    >
                      {result.consecutiveLossDays}日
                    </span>
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
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={result.isSendTarget}
                      onChange={() => {}}
                      className="rounded border-slate-300"
                    />
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

