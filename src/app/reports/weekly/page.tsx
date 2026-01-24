"use client";

import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { 
  Calendar, 
  ChevronRight, 
  TrendingUp, 
  TrendingDown, 
  Users,
  BarChart3,
  DollarSign,
  Target,
  Percent,
  FileText
} from "lucide-react";

interface WeekData {
  weekKey: string; // "2026-W03" 形式
  weekLabel: string; // "1/13〜1/19" 形式
  year: number;
  weekNumber: number;
  startDate: string;
  endDate: string;
}

interface MemberSummary {
  memberName: string;
  spend: number;
  revenue: number;
  profit: number;
  roas: number;
  cpnCount: number;
  profitChange: number; // 前週比
}

// 週の開始日（月曜日）を取得
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 月曜日に調整
  return new Date(d.setDate(diff));
}

// 週番号を取得（ISO 8601）
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// 過去の週リストを生成
function generateWeekList(count: number): WeekData[] {
  const weeks: WeekData[] = [];
  const today = new Date();
  
  for (let i = 0; i < count; i++) {
    const weekStart = getWeekStart(new Date(today.getTime() - i * 7 * 24 * 60 * 60 * 1000));
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
    const weekNumber = getWeekNumber(weekStart);
    const year = weekStart.getFullYear();
    
    weeks.push({
      weekKey: `${year}-W${weekNumber.toString().padStart(2, "0")}`,
      weekLabel: `${weekStart.getMonth() + 1}/${weekStart.getDate()}〜${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`,
      year,
      weekNumber,
      startDate: weekStart.toISOString().split("T")[0],
      endDate: weekEnd.toISOString().split("T")[0],
    });
  }
  
  return weeks;
}

// 通貨フォーマット
function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `¥${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `¥${(value / 1000).toFixed(0)}K`;
  }
  return `¥${value.toLocaleString()}`;
}

export default function WeeklyReportsPage() {
  const { data: session } = useSession();
  const [selectedWeek, setSelectedWeek] = useState<string>("");
  const [memberSummaries, setMemberSummaries] = useState<MemberSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // 過去12週分のリストを生成
  const weekList = useMemo(() => generateWeekList(12), []);
  
  // 現在の週をデフォルト選択
  useEffect(() => {
    if (weekList.length > 0 && !selectedWeek) {
      setSelectedWeek(weekList[0].weekKey);
    }
  }, [weekList, selectedWeek]);
  
  // メンバーサマリーを取得
  useEffect(() => {
    const fetchData = async () => {
      if (!selectedWeek) return;
      
      setIsLoading(true);
      try {
        const response = await fetch(`/api/reports/weekly?week=${selectedWeek}`);
        const data = await response.json();
        
        if (data.success) {
          setMemberSummaries(data.members || []);
        }
      } catch (error) {
        console.error("Failed to fetch weekly report:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [selectedWeek]);
  
  const selectedWeekData = weekList.find(w => w.weekKey === selectedWeek);
  
  // 全体サマリー
  const totalSummary = useMemo(() => {
    return memberSummaries.reduce(
      (acc, m) => ({
        spend: acc.spend + m.spend,
        revenue: acc.revenue + m.revenue,
        profit: acc.profit + m.profit,
        cpnCount: acc.cpnCount + m.cpnCount,
      }),
      { spend: 0, revenue: 0, profit: 0, cpnCount: 0 }
    );
  }, [memberSummaries]);
  
  const totalRoas = totalSummary.spend > 0 
    ? (totalSummary.revenue / totalSummary.spend) * 100 
    : 0;

  return (
    <>
      <Header title="週次レポート" description="メンバー別の週次パフォーマンスレポート" />
      
      {/* 週選択 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {weekList.slice(0, 8).map((week) => (
            <button
              key={week.weekKey}
              onClick={() => setSelectedWeek(week.weekKey)}
              className={`flex flex-col items-center px-4 py-2 rounded-lg border transition-all whitespace-nowrap ${
                selectedWeek === week.weekKey
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
              }`}
            >
              <span className="text-xs font-medium">{week.weekLabel}</span>
              <span className="text-[10px] opacity-75">{week.weekKey}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* 全体サマリーカード */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 opacity-80" />
              <span className="text-xs opacity-80">消化金額</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(totalSummary.spend)}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 opacity-80" />
              <span className="text-xs opacity-80">売上</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(totalSummary.revenue)}</p>
          </CardContent>
        </Card>
        
        <Card className={`bg-gradient-to-br ${totalSummary.profit >= 0 ? "from-green-500 to-green-600" : "from-red-500 to-red-600"} text-white`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              {totalSummary.profit >= 0 ? <TrendingUp className="h-4 w-4 opacity-80" /> : <TrendingDown className="h-4 w-4 opacity-80" />}
              <span className="text-xs opacity-80">利益</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(totalSummary.profit)}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Percent className="h-4 w-4 opacity-80" />
              <span className="text-xs opacity-80">ROAS</span>
            </div>
            <p className="text-xl font-bold">{totalRoas.toFixed(1)}%</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 opacity-80" />
              <span className="text-xs opacity-80">運用CPN数</span>
            </div>
            <p className="text-xl font-bold">{totalSummary.cpnCount}</p>
          </CardContent>
        </Card>
      </div>
      
      {/* メンバー別レポート一覧 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            メンバー別レポート
            {selectedWeekData && (
              <span className="text-sm font-normal text-slate-500">
                （{selectedWeekData.weekLabel}）
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : memberSummaries.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>この週のデータがありません</p>
            </div>
          ) : (
            <div className="space-y-3">
              {memberSummaries.map((member) => (
                <Link
                  key={member.memberName}
                  href={`/reports/weekly/${selectedWeek}/${encodeURIComponent(member.memberName)}`}
                  className="block"
                >
                  <div className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                        <span className="text-indigo-600 font-bold">{member.memberName.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{member.memberName}</p>
                        <p className="text-xs text-slate-500">{member.cpnCount} CPNs</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-xs text-slate-500">消化</p>
                        <p className="font-medium text-slate-700">{formatCurrency(member.spend)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">利益</p>
                        <p className={`font-bold ${member.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {formatCurrency(member.profit)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">ROAS</p>
                        <p className="font-medium text-purple-600">{member.roas.toFixed(1)}%</p>
                      </div>
                      <div className="text-right min-w-[60px]">
                        <p className="text-xs text-slate-500">前週比</p>
                        <p className={`font-medium flex items-center justify-end gap-1 ${
                          member.profitChange >= 0 ? "text-green-600" : "text-red-600"
                        }`}>
                          {member.profitChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {member.profitChange >= 0 ? "+" : ""}{member.profitChange.toFixed(0)}%
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-400" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
