"use client";

import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect, use } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Target,
  Percent,
  BarChart3,
  Save,
  MessageSquare,
  Award,
  Layers
} from "lucide-react";

interface MemberReport {
  memberName: string;
  spend: number;
  revenue: number;
  profit: number;
  roas: number;
  cpnCount: number;
  profitChange: number;
}

interface ProjectData {
  name: string;
  spend: number;
  revenue: number;
  profit: number;
  roas: number;
  cpnCount: number;
}

interface MediaData {
  name: string;
  spend: number;
  revenue: number;
  profit: number;
  roas: number;
  cpnCount: number;
}

interface TopCpn {
  cpnName: string;
  media: string;
  spend: number;
  revenue: number;
  profit: number;
  roas: number;
  mcv: number;
  cv: number;
}

// 通貨フォーマット
function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `¥${(value / 1000000).toFixed(1)}M`;
  } else if (Math.abs(value) >= 1000) {
    return `¥${(value / 1000).toFixed(0)}K`;
  }
  return `¥${value.toLocaleString()}`;
}

// 媒体カラー
function getMediaColor(media: string): string {
  switch (media) {
    case "Meta":
    case "FB":
      return "bg-blue-100 text-blue-700";
    case "TikTok":
      return "bg-pink-100 text-pink-700";
    case "YouTube":
    case "YT":
      return "bg-red-100 text-red-700";
    case "LINE":
      return "bg-green-100 text-green-700";
    case "Pangle":
      return "bg-orange-100 text-orange-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function MemberReportPage({ 
  params 
}: { 
  params: Promise<{ week: string; member: string }> 
}) {
  const { week, member } = use(params);
  const memberName = decodeURIComponent(member);
  
  const [report, setReport] = useState<MemberReport | null>(null);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [medias, setMedias] = useState<MediaData[]>([]);
  const [topCpns, setTopCpns] = useState<TopCpn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // コメント欄
  const [todoComment, setTodoComment] = useState("");
  const [growthComment, setGrowthComment] = useState("");
  const [shrinkComment, setShrinkComment] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  // データ取得
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/reports/weekly?week=${week}&member=${encodeURIComponent(memberName)}`);
        const data = await response.json();
        
        if (data.success) {
          setReport(data.member);
          setProjects(data.projects || []);
          setMedias(data.medias || []);
          setTopCpns(data.topCpns || []);
        }
      } catch (error) {
        console.error("Failed to fetch member report:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [week, memberName]);
  
  // コメント取得
  useEffect(() => {
    const fetchComments = async () => {
      try {
        const response = await fetch(`/api/reports/comments?week=${week}&member=${encodeURIComponent(memberName)}`);
        const data = await response.json();
        
        if (data.success && data.comments) {
          setTodoComment(data.comments.todo || "");
          setGrowthComment(data.comments.growth || "");
          setShrinkComment(data.comments.shrink || "");
        }
      } catch (error) {
        console.error("Failed to fetch comments:", error);
      }
    };
    
    fetchComments();
  }, [week, memberName]);
  
  // コメント保存
  const handleSaveComments = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    
    try {
      const response = await fetch("/api/reports/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week,
          member: memberName,
          comments: {
            todo: todoComment,
            growth: growthComment,
            shrink: shrinkComment,
          },
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSaveMessage({ type: "success", text: "保存しました" });
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage({ type: "error", text: data.error || "保存に失敗しました" });
      }
    } catch {
      setSaveMessage({ type: "error", text: "通信エラーが発生しました" });
    } finally {
      setIsSaving(false);
    }
  };
  
  if (isLoading) {
    return (
      <>
        <div className="mb-4">
          <Link href="/reports/weekly">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              週次レポート一覧
            </Button>
          </Link>
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-32 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mb-4">
        <Link href="/reports/weekly">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            週次レポート一覧
          </Button>
        </Link>
      </div>
      
      <Header 
        title={`${memberName}の週次レポート`} 
        description={`${week} の詳細レポート`} 
      />
      
      {/* サマリーカード */}
      {report && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 opacity-80" />
                <span className="text-xs opacity-80">消化金額</span>
              </div>
              <p className="text-xl font-bold">{formatCurrency(report.spend)}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 opacity-80" />
                <span className="text-xs opacity-80">売上</span>
              </div>
              <p className="text-xl font-bold">{formatCurrency(report.revenue)}</p>
            </CardContent>
          </Card>
          
          <Card className={`bg-gradient-to-br ${report.profit >= 0 ? "from-green-500 to-green-600" : "from-red-500 to-red-600"} text-white`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                {report.profit >= 0 ? <TrendingUp className="h-4 w-4 opacity-80" /> : <TrendingDown className="h-4 w-4 opacity-80" />}
                <span className="text-xs opacity-80">利益</span>
              </div>
              <p className="text-xl font-bold">{formatCurrency(report.profit)}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Percent className="h-4 w-4 opacity-80" />
                <span className="text-xs opacity-80">ROAS</span>
              </div>
              <p className="text-xl font-bold">{report.roas.toFixed(1)}%</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 opacity-80" />
                <span className="text-xs opacity-80">運用CPN数</span>
              </div>
              <p className="text-xl font-bold">{report.cpnCount}</p>
            </CardContent>
          </Card>
        </div>
      )}
      
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* 案件別利益 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4 text-indigo-600" />
              案件別利益
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {projects.slice(0, 10).map((project, index) => (
                <div key={project.name} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-5">{index + 1}</span>
                    <span className="text-sm font-medium text-slate-700 truncate max-w-[150px]">{project.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-500">{project.cpnCount} CPN</span>
                    <span className={`text-sm font-bold ${project.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(project.profit)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        {/* 媒体別利益 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-indigo-600" />
              媒体別利益
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {medias.map((media) => (
                <div key={media.name} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${getMediaColor(media.name)}`}>
                      {media.name}
                    </span>
                    <span className="text-xs text-slate-500">{media.cpnCount} CPN</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-500">{formatCurrency(media.spend)}</span>
                    <span className={`text-sm font-bold ${media.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(media.profit)}
                    </span>
                    <span className="text-xs text-purple-600">{media.roas.toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* コメント欄 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4 text-indigo-600" />
              コメント
            </div>
            <Button
              size="sm"
              onClick={handleSaveComments}
              disabled={isSaving}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Save className="h-4 w-4 mr-1" />
              {isSaving ? "保存中..." : "保存"}
            </Button>
          </CardTitle>
          {saveMessage && (
            <p className={`text-sm ${saveMessage.type === "success" ? "text-green-600" : "text-red-600"}`}>
              {saveMessage.text}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              📋 今週やること
            </label>
            <textarea
              value={todoComment}
              onChange={(e) => setTodoComment(e.target.value)}
              placeholder="今週の予定やタスクを入力..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={3}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-green-700 mb-1">
              📈 先週のグロース理由
            </label>
            <textarea
              value={growthComment}
              onChange={(e) => setGrowthComment(e.target.value)}
              placeholder="成長した理由や成功要因を入力..."
              className="w-full px-3 py-2 border border-green-200 bg-green-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              rows={3}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-red-700 mb-1">
              📉 先週のシュリンク理由
            </label>
            <textarea
              value={shrinkComment}
              onChange={(e) => setShrinkComment(e.target.value)}
              placeholder="減少した理由や改善点を入力..."
              className="w-full px-3 py-2 border border-red-200 bg-red-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>
      
      {/* 利益TOP10 CPN */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Award className="h-4 w-4 text-amber-600" />
            利益TOP10 CPN
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">#</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">CPN名</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-slate-500">媒体</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">消化</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">利益</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">ROAS</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">MCV</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">CV</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {topCpns.map((cpn, index) => (
                  <tr key={index} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-400">{index + 1}</td>
                    <td className="px-3 py-2 text-slate-700 max-w-[200px] truncate" title={cpn.cpnName}>
                      {cpn.cpnName.length > 40 ? cpn.cpnName.substring(0, 40) + "..." : cpn.cpnName}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${getMediaColor(cpn.media)}`}>
                        {cpn.media}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(cpn.spend)}</td>
                    <td className={`px-3 py-2 text-right font-bold ${cpn.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(cpn.profit)}
                    </td>
                    <td className="px-3 py-2 text-right text-purple-600">{cpn.roas?.toFixed(0) || 0}%</td>
                    <td className="px-3 py-2 text-right text-slate-600">{cpn.mcv}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{cpn.cv}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
