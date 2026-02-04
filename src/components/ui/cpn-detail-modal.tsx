"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Search, Calendar, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "./button";

interface DailyData {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  mcv: number;
  cv: number;
  revenue: number;
  profit: number;
  roas: number;
  cpa: number;
  cpm: number;
  cpc: number;
  ctr: number;
  mcvr: number;
  mcpa: number;
  cvr: number;
}

interface CpnDetailData {
  cpnName: string;
  dailyData: DailyData[];
  summary: DailyData & { totalDays: number };
}

interface CpnDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  cpnName?: string;
  initialCpnName?: string;
}

export function CpnDetailModal({ isOpen, onClose, cpnName: propCpnName, initialCpnName }: CpnDetailModalProps) {
  const [searchCpnName, setSearchCpnName] = useState(propCpnName || initialCpnName || "");
  const [data, setData] = useState<CpnDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);

  useEffect(() => {
    if (propCpnName) {
      setSearchCpnName(propCpnName);
      fetchData(propCpnName);
    }
  }, [propCpnName]);

  const fetchData = async (cpn: string) => {
    if (!cpn.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/cpn-detail?cpnName=${encodeURIComponent(cpn.trim())}&days=${days}`);
      const result = await res.json();
      
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || "データの取得に失敗しました");
        setData(null);
      }
    } catch (err) {
      console.error("Error fetching CPN detail:", err);
      setError("データの取得に失敗しました");
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    fetchData(searchCpnName);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleDaysChange = (newDays: number) => {
    setDays(newDays);
    if (searchCpnName) {
      fetchData(searchCpnName);
    }
  };

  if (!isOpen) return null;

  const formatNumber = (num: number) => {
    return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  const formatCurrency = (num: number) => {
    return `¥${Math.round(num).toLocaleString()}`;
  };

  const formatPercent = (num: number) => {
    return `${num.toFixed(2)}%`;
  };

  const getProfitClass = (profit: number) => {
    if (profit > 0) return "text-emerald-600 bg-emerald-50";
    if (profit < 0) return "text-red-600 bg-red-50";
    return "";
  };

  const getRoasClass = (roas: number) => {
    if (roas >= 200) return "text-emerald-600 bg-emerald-50";
    if (roas >= 100) return "text-blue-600 bg-blue-50";
    return "text-red-600 bg-red-50";
  };

  const getCvrClass = (cvr: number) => {
    if (cvr > 0) return "text-emerald-600 bg-emerald-50";
    return "text-slate-400";
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Search className="h-5 w-5" />
            <h2 className="text-lg font-bold">CPN詳細データ</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 検索バー */}
        <div className="px-6 py-4 border-b bg-slate-50 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[300px]">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchCpnName}
                onChange={(e) => setSearchCpnName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="CPN名を入力（部分一致で検索）"
                className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button onClick={handleSearch} disabled={isLoading || !searchCpnName.trim()}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                検索
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-500" />
            <select
              value={days}
              onChange={(e) => handleDaysChange(parseInt(e.target.value))}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value={7}>過去7日間</option>
              <option value={14}>過去14日間</option>
              <option value={30}>過去30日間</option>
              <option value={40}>過去40日間</option>
            </select>
          </div>
        </div>

        {/* コンテンツ */}
        <div className="overflow-auto max-h-[calc(90vh-180px)]">
          {isLoading && (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          )}

          {error && (
            <div className="p-8 text-center">
              <p className="text-red-500">{error}</p>
            </div>
          )}

          {!isLoading && !error && !data && (
            <div className="p-8 text-center text-slate-500">
              <Search className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p>CPN名を入力して検索してください</p>
            </div>
          )}

          {data && (
            <div className="p-4">
              {/* CPN名 */}
              <div className="mb-4 px-2">
                <h3 className="text-sm text-slate-500 mb-1">検索CPN</h3>
                <p className="font-mono text-sm break-all bg-slate-100 px-3 py-2 rounded">{data.cpnName}</p>
              </div>

              {/* テーブル（シート風） */}
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="bg-slate-100 border-b">
                      <th className="sticky left-0 bg-slate-100 px-3 py-2 text-left font-bold border-r z-10">日付</th>
                      <th className="px-2 py-2 text-right font-bold whitespace-nowrap">消化金額</th>
                      <th className="px-2 py-2 text-right font-bold whitespace-nowrap">MCV</th>
                      <th className="px-2 py-2 text-right font-bold whitespace-nowrap">CV</th>
                      <th className="px-2 py-2 text-right font-bold whitespace-nowrap">売上</th>
                      <th className="px-2 py-2 text-right font-bold whitespace-nowrap">利益</th>
                      <th className="px-2 py-2 text-right font-bold whitespace-nowrap">ロアス</th>
                      <th className="px-2 py-2 text-right font-bold whitespace-nowrap">CPA</th>
                      <th className="px-2 py-2 text-right font-bold whitespace-nowrap">CPM</th>
                      <th className="px-2 py-2 text-right font-bold whitespace-nowrap">Imp.</th>
                      <th className="px-2 py-2 text-right font-bold whitespace-nowrap">Clicks</th>
                      <th className="px-2 py-2 text-right font-bold whitespace-nowrap">CTR</th>
                      <th className="px-2 py-2 text-right font-bold whitespace-nowrap">CPC</th>
                      <th className="px-2 py-2 text-right font-bold whitespace-nowrap">MCVR</th>
                      <th className="px-2 py-2 text-right font-bold whitespace-nowrap">MCPA</th>
                      <th className="px-2 py-2 text-right font-bold whitespace-nowrap">CVR</th>
                      <th className="px-2 py-2 text-right font-bold whitespace-nowrap">実績CVR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* 合計行（最初に表示） */}
                    <tr className="bg-yellow-50 border-b-2 border-yellow-300 font-bold">
                      <td className="sticky left-0 bg-yellow-50 px-3 py-2 border-r z-10">
                        合計 ({data.summary.totalDays}日)
                      </td>
                      <td className="px-2 py-2 text-right">{formatCurrency(data.summary.spend)}</td>
                      <td className="px-2 py-2 text-right">{formatNumber(data.summary.mcv)}</td>
                      <td className="px-2 py-2 text-right">{formatNumber(data.summary.cv)}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(data.summary.revenue)}</td>
                      <td className={`px-2 py-2 text-right ${getProfitClass(data.summary.profit)}`}>
                        {formatCurrency(data.summary.profit)}
                      </td>
                      <td className={`px-2 py-2 text-right ${getRoasClass(data.summary.roas)}`}>
                        {formatPercent(data.summary.roas)}
                      </td>
                      <td className="px-2 py-2 text-right">{formatCurrency(data.summary.cpa)}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(data.summary.cpm)}</td>
                      <td className="px-2 py-2 text-right">{formatNumber(data.summary.impressions)}</td>
                      <td className="px-2 py-2 text-right">{formatNumber(data.summary.clicks)}</td>
                      <td className="px-2 py-2 text-right">{formatPercent(data.summary.ctr)}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(data.summary.cpc)}</td>
                      <td className="px-2 py-2 text-right">{formatPercent(data.summary.mcvr)}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(data.summary.mcpa)}</td>
                      <td className={`px-2 py-2 text-right ${getCvrClass(data.summary.cvr)}`}>
                        {formatPercent(data.summary.cvr)}
                      </td>
                      <td className={`px-2 py-2 text-right ${getCvrClass(data.summary.cvr)}`}>
                        {formatPercent(data.summary.cvr)}
                      </td>
                    </tr>
                    
                    {/* 日別データ */}
                    {data.dailyData.map((day, idx) => (
                      <tr key={day.date} className={`border-b hover:bg-blue-50 ${idx % 2 === 1 ? "bg-slate-50" : ""}`}>
                        <td className={`sticky left-0 ${idx % 2 === 1 ? "bg-slate-50" : "bg-white"} px-3 py-1.5 border-r z-10 font-medium`}>
                          {day.date}
                        </td>
                        <td className="px-2 py-1.5 text-right">{formatCurrency(day.spend)}</td>
                        <td className="px-2 py-1.5 text-right">{formatNumber(day.mcv)}</td>
                        <td className="px-2 py-1.5 text-right">{formatNumber(day.cv)}</td>
                        <td className="px-2 py-1.5 text-right">{formatCurrency(day.revenue)}</td>
                        <td className={`px-2 py-1.5 text-right ${getProfitClass(day.profit)}`}>
                          {day.profit > 0 && <TrendingUp className="h-3 w-3 inline mr-0.5" />}
                          {day.profit < 0 && <TrendingDown className="h-3 w-3 inline mr-0.5" />}
                          {formatCurrency(day.profit)}
                        </td>
                        <td className={`px-2 py-1.5 text-right ${getRoasClass(day.roas)}`}>
                          {formatPercent(day.roas)}
                        </td>
                        <td className="px-2 py-1.5 text-right">{day.cv > 0 ? formatCurrency(day.cpa) : "-"}</td>
                        <td className="px-2 py-1.5 text-right">{formatCurrency(day.cpm)}</td>
                        <td className="px-2 py-1.5 text-right">{formatNumber(day.impressions)}</td>
                        <td className="px-2 py-1.5 text-right">{formatNumber(day.clicks)}</td>
                        <td className="px-2 py-1.5 text-right">{formatPercent(day.ctr)}</td>
                        <td className="px-2 py-1.5 text-right">{formatCurrency(day.cpc)}</td>
                        <td className="px-2 py-1.5 text-right">{formatPercent(day.mcvr)}</td>
                        <td className="px-2 py-1.5 text-right">{day.mcv > 0 ? formatCurrency(day.mcpa) : "-"}</td>
                        <td className={`px-2 py-1.5 text-right ${getCvrClass(day.cvr)}`}>
                          {day.mcv > 0 ? formatPercent(day.cvr) : "0.00%"}
                        </td>
                        <td className={`px-2 py-1.5 text-right ${getCvrClass(day.cvr)}`}>
                          {day.mcv > 0 ? formatPercent(day.cvr) : "0.00%"}
                        </td>
                      </tr>
                    ))}

                    {data.dailyData.length === 0 && (
                      <tr>
                        <td colSpan={17} className="px-4 py-8 text-center text-slate-500">
                          該当するデータがありません
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// CPN検索ボタン（各ページで使用）
interface CpnSearchButtonProps {
  cpnName?: string;
  className?: string;
}

export function CpnSearchButton({ cpnName, className }: CpnSearchButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`p-1 text-blue-500 hover:bg-blue-50 rounded ${className}`}
        title="詳細データを表示"
      >
        <Search className="h-4 w-4" />
      </button>
      <CpnDetailModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        cpnName={cpnName}
      />
    </>
  );
}

// グローバルCPN検索ボタン（ヘッダー等で使用）
export function GlobalCpnSearchButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => setIsOpen(true)}
        className="gap-2"
      >
        <Search className="h-4 w-4" />
        CPN検索
      </Button>
      <CpnDetailModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
