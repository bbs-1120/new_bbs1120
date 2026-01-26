"use client";

import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useMemo, useCallback } from "react";
import { 
  Calendar, Users, Play, X, ChevronDown, ChevronUp,
  Save, Plus, Trash2, Check, Trophy, AlertTriangle, 
  Briefcase, Video, ExternalLink, MessageSquare, FileText, Search
} from "lucide-react";

interface MemberRanking {
  name: string;
  profit: number;
  spend: number;
  revenue: number;
  roas: number;
  cpnCount: number;
}

interface ProjectData {
  name: string;
  profit: number;
  spend: number;
  revenue: number;
  cv: number;
  mcv: number;
  roas: number;
}

interface MediaData {
  media: string;
  profit: number;
  spend: number;
  revenue: number;
  cv: number;
  roas: number;
}

// 媒体ロゴコンポーネント
function MediaLogo({ media, size = 20 }: { media: string; size?: number }) {
  const logoMap: Record<string, string> = {
    "FB": "/icons/fb-logo.png",
    "Meta": "/icons/fb-logo.png",
    "TikTok": "/icons/tiktok-logo.png",
    "Pangle": "/icons/pangle-logo.png",
    "Yahoo": "/icons/yahoo-logo.png",
  };
  const src = logoMap[media];
  if (!src) return <span className="text-sm font-medium">{media}</span>;
  return (
    <div className="flex items-center gap-2">
      <img src={src} alt={media} style={{ width: size, height: size }} className="object-contain shrink-0" />
      <span className="text-sm font-medium">{media}</span>
    </div>
  );
}

interface ProjectMediaData {
  project: string;
  media: string;
  profit: number;
  spend: number;
  revenue: number;
  cv: number;
  mcv: number;
  roas: number;
}

interface CpnData {
  cpnKey: string;
  cpnName: string;
  media: string;
  memberName: string;
  spend: number;
  revenue: number;
  profit: number;
  roas: number;
  cv: number;
  mcv: number;
  impressions: number;
  clicks: number;
  cpm: number;
  cpc: number;
  ctr: number;
  cpa: number;
  mcvr: number;
  mcpa: number;
  cvr: number;
  campaignId?: string;
}

interface CreativeData {
  adId?: string;
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  cv: number;
  cpa: number;
  revenue: number;
  profit: number;
  roas: number;
  ctr: number;
  cpm: number;
  cpc: number;
  videoUrl?: string;
  thumbnailUrl?: string;
}

interface WeekData {
  weekKey: string;
  weekLabel: string;
}

interface ProjectComment {
  shokan: string;
  result: string;
  next: string;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

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
    });
  }
  return weeks;
}

function formatCurrency(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}¥${Math.abs(Math.round(value)).toLocaleString()}`;
}

export default function WeeklyReportsPage() {
  const [selectedWeek, setSelectedWeek] = useState<string>("");
  const [selectedMember, setSelectedMember] = useState<string>("全員");
  const [members, setMembers] = useState<string[]>([]);
  const [memberRankings, setMemberRankings] = useState<MemberRanking[]>([]);
  const [projectData, setProjectData] = useState<ProjectData[]>([]);
  const [mediaData, setMediaData] = useState<MediaData[]>([]);
  const [projectMediaData, setProjectMediaData] = useState<ProjectMediaData[]>([]);
  const [top10Profit, setTop10Profit] = useState<CpnData[]>([]);
  const [top10Loss, setTop10Loss] = useState<CpnData[]>([]);
  const [cpnList, setCpnList] = useState<CpnData[]>([]);
  const [growthText, setGrowthText] = useState("");
  const [shrinkText, setShrinkText] = useState("");
  const [tasks, setTasks] = useState<{ id: string; content: string; completed: boolean }[]>([]);
  const [newTask, setNewTask] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCpnDetail, setSelectedCpnDetail] = useState<CpnData | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "project-media" | "cpn-list">("overview");
  const [selectedProjectMedia, setSelectedProjectMedia] = useState<{project: string; media: string} | null>(null);
  const [projectComments, setProjectComments] = useState<Record<string, ProjectComment>>({});
  const [videoModal, setVideoModal] = useState<{ url: string; name: string } | null>(null);
  const [videoLoading, setVideoLoading] = useState<string | null>(null);
  const [creatives, setCreatives] = useState<CreativeData[]>([]);
  const [creativesLoading, setCreativesLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({ key: "profit", direction: "desc" });
  const [expandedCpn, setExpandedCpn] = useState<string | null>(null);
  
  const weekList = useMemo(() => generateWeekList(8), []);
  
  useEffect(() => {
    if (weekList.length > 0 && !selectedWeek) {
      setSelectedWeek(weekList[0].weekKey);
    }
  }, [weekList, selectedWeek]);
  
  const fetchData = useCallback(async (weekKey: string, member: string) => {
    if (!weekKey) return;
    setIsLoading(true);
    try {
      const url = `/api/reports/weekly?week=${weekKey}${member !== "全員" ? `&member=${encodeURIComponent(member)}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setMembers(data.members || []);
        setMemberRankings(data.memberRankings || []);
        setProjectData(data.projectData || []);
        setMediaData(data.mediaData || []);
        setProjectMediaData(data.projectMediaData || []);
        setTop10Profit(data.top10Profit || []);
        setTop10Loss(data.top10Loss || []);
        setCpnList(data.cpnList || []);
        setGrowthText(data.growthFactors || "");
        setShrinkText(data.shrinkFactors || "");
        setTasks(data.tasks || []);
        setProjectComments(data.projectComments || {});
      }
    } catch (error) {
      console.error("Failed to fetch report:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    if (selectedWeek) fetchData(selectedWeek, selectedMember);
  }, [selectedWeek, selectedMember, fetchData]);
  
  // 週の開始日と終了日を計算する関数
  const getWeekDates = useCallback((weekKey: string) => {
    const match = weekKey.match(/(\d{4})-W(\d{2})/);
    if (!match) return { startDate: "", endDate: "" };
    
    const year = parseInt(match[1], 10);
    const week = parseInt(match[2], 10);
    
    // ISO週の最初の日（月曜日）を計算
    const jan4 = new Date(year, 0, 4);
    const dayOfWeek = jan4.getDay() || 7;
    const firstMonday = new Date(jan4);
    firstMonday.setDate(jan4.getDate() - dayOfWeek + 1);
    
    const weekStart = new Date(firstMonday);
    weekStart.setDate(firstMonday.getDate() + (week - 1) * 7);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const formatDate = (d: Date) => d.toISOString().split("T")[0];
    return { startDate: formatDate(weekStart), endDate: formatDate(weekEnd) };
  }, []);

  const fetchCreatives = useCallback(async (cpn: CpnData) => {
    if (!cpn.campaignId || !selectedWeek) return;
    setCreativesLoading(true);
    setCreatives([]);
    try {
      const { startDate, endDate } = getWeekDates(selectedWeek);
      const res = await fetch(`/api/campaigns/creatives?campaignId=${cpn.campaignId}&media=${cpn.media}&startDate=${startDate}&endDate=${endDate}`);
      const data = await res.json();
      if (data.success) setCreatives(data.creatives || []);
    } catch (error) {
      console.error("Failed to fetch creatives:", error);
    } finally {
      setCreativesLoading(false);
    }
  }, [selectedWeek, getWeekDates]);
  
  useEffect(() => {
    if (selectedCpnDetail) fetchCreatives(selectedCpnDetail);
  }, [selectedCpnDetail, fetchCreatives]);

  // 動画を読み込んで再生モーダルを開く
  const openVideoModal = async (cr: CreativeData) => {
    if (cr.videoUrl) {
      setVideoModal({ url: cr.videoUrl, name: cr.name });
      return;
    }
    
    // videoUrlがない場合はAPIから取得を試みる
    if (!selectedCpnDetail?.campaignId) return;
    
    setVideoLoading(cr.name);
    try {
      // adIdがある場合は広告IDで取得、なければキャンペーンIDで取得
      const adIdParam = cr.adId ? `&adId=${cr.adId}` : "";
      const res = await fetch(`/api/campaigns/video?campaignId=${selectedCpnDetail.campaignId}&media=${selectedCpnDetail.media}${adIdParam}`);
      const data = await res.json();
      if (data.success && data.videoUrl) {
        setVideoModal({ url: data.videoUrl, name: cr.name });
      } else {
        // サムネイルがあれば画像モーダルとして表示
        if (cr.thumbnailUrl) {
          window.open(cr.thumbnailUrl, "_blank");
        } else {
          alert("動画を取得できませんでした。Meta APIの権限制限の可能性があります。");
        }
      }
    } catch (error) {
      console.error("Failed to fetch video:", error);
      alert("動画の取得に失敗しました");
    } finally {
      setVideoLoading(null);
    }
  };
  
  const saveComments = async () => {
    setIsSaving(true);
    try {
      await fetch("/api/reports/weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          weekKey: selectedWeek, 
          memberName: selectedMember, 
          growthFactors: growthText, 
          shrinkFactors: shrinkText, 
          tasks,
          projectComments,
        }),
      });
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  };
  
  const updateProjectComment = (projectMedia: string, field: keyof ProjectComment, value: string) => {
    setProjectComments(prev => ({
      ...prev,
      [projectMedia]: { ...(prev[projectMedia] || { shokan: "", result: "", next: "" }), [field]: value }
    }));
  };
  
  const addTask = () => {
    if (!newTask.trim()) return;
    setTasks([...tasks, { id: Date.now().toString(), content: newTask.trim(), completed: false }]);
    setNewTask("");
  };
  
  const toggleTask = (id: string) => setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  const deleteTask = (id: string) => setTasks(tasks.filter(t => t.id !== id));
  
  const selectedMemberData = memberRankings.find(m => m.name === selectedMember) || memberRankings[0];
  
  // 検索とソート
  const filteredCpnList = useMemo(() => {
    let list = [...cpnList];
    if (searchQuery) {
      list = list.filter(c => c.cpnName.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    list.sort((a, b) => {
      const aVal = a[sortConfig.key as keyof CpnData] as number || 0;
      const bVal = b[sortConfig.key as keyof CpnData] as number || 0;
      return sortConfig.direction === "desc" ? bVal - aVal : aVal - bVal;
    });
    return list;
  }, [cpnList, searchQuery, sortConfig]);
  
  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc"
    }));
  };
  
  // 選択した案件×媒体のCPN一覧
  const selectedProjectCpns = selectedProjectMedia 
    ? cpnList.filter(c => c.cpnName.includes(selectedProjectMedia.project) && c.media === selectedProjectMedia.media)
    : [];
  
  const projectMediaKey = selectedProjectMedia ? `${selectedProjectMedia.project}|${selectedProjectMedia.media}` : "";
  const currentComment = projectComments[projectMediaKey] || { shokan: "", result: "", next: "" };
  
  const SortHeader = ({ label, sortKey, className = "" }: { label: string; sortKey: string; className?: string }) => (
    <th 
      className={`p-2 text-right cursor-pointer hover:bg-slate-200 ${className}`}
      onClick={() => handleSort(sortKey)}
    >
      {label}
      {sortConfig.key === sortKey && (sortConfig.direction === "desc" ? <ChevronDown className="h-3 w-3 inline ml-1" /> : <ChevronUp className="h-3 w-3 inline ml-1" />)}
    </th>
  );
  
  return (
    <>
      <Header title="週次レポート" description="週間パフォーマンス分析" />
      
      {/* 週選択 */}
      <div className="mb-4 flex flex-wrap gap-2">
        {weekList.map((week) => (
          <button key={week.weekKey} onClick={() => setSelectedWeek(week.weekKey)} className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedWeek === week.weekKey ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100 border"}`}>
            <Calendar className="h-3 w-3" />{week.weekLabel}
          </button>
        ))}
      </div>
      
      {/* メンバー選択 */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button onClick={() => setSelectedMember("全員")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedMember === "全員" ? "bg-purple-600 text-white" : "bg-white text-slate-600 hover:bg-purple-50 border"}`}>
          <Users className="h-4 w-4 inline mr-1" />全員
        </button>
        {members.map((member) => (
          <button key={member} onClick={() => setSelectedMember(member)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedMember === member ? "bg-emerald-600 text-white" : "bg-white text-slate-600 hover:bg-emerald-50 border"}`}>{member}</button>
        ))}
      </div>
      
      {/* タブ */}
      <div className="mb-6 border-b flex gap-4">
        <button onClick={() => setActiveTab("overview")} className={`pb-2 px-1 font-medium ${activeTab === "overview" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-slate-500"}`}>📊 概要</button>
        <button onClick={() => setActiveTab("project-media")} className={`pb-2 px-1 font-medium ${activeTab === "project-media" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-slate-500"}`}>📁 案件×媒体別</button>
        <button onClick={() => setActiveTab("cpn-list")} className={`pb-2 px-1 font-medium ${activeTab === "cpn-list" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-slate-500"}`}>📋 全CPN一覧 ({cpnList.length}件)</button>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
      ) : (
        <>
          {/* 概要タブ */}
          {activeTab === "overview" && (
            <div className="space-y-8">
              {selectedMember === "全員" && memberRankings.length > 0 && (
                <section>
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-500" />メンバーランキング</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {memberRankings.map((member, idx) => (
                      <button key={member.name} onClick={() => setSelectedMember(member.name)} className="relative p-4 rounded-xl border-2 border-slate-200 bg-white hover:border-emerald-500 transition-all">
                        <div className={`absolute -top-2 -left-2 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${idx === 0 ? "bg-amber-500" : idx === 1 ? "bg-slate-400" : idx === 2 ? "bg-amber-700" : "bg-slate-300"}`}>{idx + 1}</div>
                        <div className="text-center pt-2">
                          <div className="text-lg font-bold text-slate-800 mb-1">{member.name}</div>
                          <div className={`text-xl font-bold ${member.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(member.profit)}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}
              
              {selectedMemberData && (
                <section>
                  <h2 className="text-xl font-bold mb-4">{selectedMember === "全員" ? "全体" : selectedMemberData.name} の週間実績</h2>
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                    <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white"><CardContent className="p-4"><div className="text-xs opacity-80">売上</div><div className="text-2xl font-bold">¥{Math.round(selectedMemberData.revenue).toLocaleString()}</div></CardContent></Card>
                    <Card className={`bg-gradient-to-br ${selectedMemberData.profit >= 0 ? "from-emerald-500 to-emerald-600" : "from-red-500 to-red-600"} text-white`}><CardContent className="p-4"><div className="text-xs opacity-80">利益</div><div className="text-2xl font-bold">{formatCurrency(selectedMemberData.profit)}</div></CardContent></Card>
                    <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white"><CardContent className="p-4"><div className="text-xs opacity-80">消化金額</div><div className="text-2xl font-bold">¥{Math.round(selectedMemberData.spend).toLocaleString()}</div></CardContent></Card>
                    <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white"><CardContent className="p-4"><div className="text-xs opacity-80">ROAS</div><div className="text-2xl font-bold">{selectedMemberData.roas.toFixed(1)}%</div></CardContent></Card>
                    <Card className="bg-gradient-to-br from-slate-600 to-slate-700 text-white"><CardContent className="p-4"><div className="text-xs opacity-80">運用数</div><div className="text-2xl font-bold">{selectedMemberData.cpnCount}</div></CardContent></Card>
                  </div>
                </section>
              )}
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card><CardHeader className="bg-amber-500 text-white py-3 rounded-t-lg"><CardTitle className="text-base">📊 案件別</CardTitle></CardHeader><CardContent className="p-0 max-h-80 overflow-y-auto"><table className="w-full text-sm"><thead className="bg-slate-50 sticky top-0"><tr><th className="p-2 text-left">案件名</th><th className="p-2 text-right">利益</th><th className="p-2 text-right">ROAS</th></tr></thead><tbody>{projectData.map((p, i) => (<tr key={p.name} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}><td className="p-2">{p.name}</td><td className={`p-2 text-right font-bold ${p.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(p.profit)}</td><td className="p-2 text-right">{p.roas.toFixed(1)}%</td></tr>))}</tbody></table></CardContent></Card>
                <Card><CardHeader className="bg-pink-500 text-white py-3 rounded-t-lg"><CardTitle className="text-base">📺 媒体別</CardTitle></CardHeader><CardContent className="p-0"><table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className="p-2 text-left">媒体</th><th className="p-2 text-right">消化</th><th className="p-2 text-right">利益</th><th className="p-2 text-right">ROAS</th></tr></thead><tbody>{mediaData.map((m) => (<tr key={m.media} className="border-b"><td className="p-2"><MediaLogo media={m.media} size={24} /></td><td className="p-2 text-right">¥{Math.round(m.spend).toLocaleString()}</td><td className={`p-2 text-right font-bold ${m.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(m.profit)}</td><td className="p-2 text-right">{m.roas.toFixed(1)}%</td></tr>))}</tbody></table></CardContent></Card>
              </div>
              
              <section className="space-y-6">
                <Card><CardHeader className="bg-emerald-500 text-white py-3 rounded-t-lg"><CardTitle className="text-base">📈 グロース要因（{selectedMember}）</CardTitle></CardHeader><CardContent className="p-4"><textarea value={growthText} onChange={(e) => setGrowthText(e.target.value)} placeholder="グロース要因を記入..." className="w-full h-48 p-4 border rounded-lg resize-none text-sm" /></CardContent></Card>
                <Card><CardHeader className="bg-red-500 text-white py-3 rounded-t-lg"><CardTitle className="text-base">📉 シュリンク要因（{selectedMember}）</CardTitle></CardHeader><CardContent className="p-4"><textarea value={shrinkText} onChange={(e) => setShrinkText(e.target.value)} placeholder="シュリンク要因を記入..." className="w-full h-48 p-4 border rounded-lg resize-none text-sm" /></CardContent></Card>
              </section>
              
              <div className="flex justify-center"><Button onClick={saveComments} disabled={isSaving} className="px-8"><Save className="h-4 w-4 mr-2" />{isSaving ? "保存中..." : "コメントを保存"}</Button></div>
              
              <Card><CardHeader className="bg-blue-600 text-white py-3 rounded-t-lg"><CardTitle className="text-base">📝 今週やること（{selectedMember}）</CardTitle></CardHeader><CardContent className="p-4"><div className="flex gap-2 mb-4"><input type="text" value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="タスクを追加..." className="flex-1 px-4 py-2 border rounded-lg" /><Button onClick={addTask} className="px-4 bg-emerald-600 hover:bg-emerald-700"><Plus className="h-4 w-4 mr-1" />追加</Button></div><div className="space-y-2">{tasks.map((task) => (<div key={task.id} className={`flex items-center gap-3 p-3 rounded-lg border ${task.completed ? "bg-slate-100" : "bg-white"}`}><button onClick={() => toggleTask(task.id)} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${task.completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300"}`}>{task.completed && <Check className="h-4 w-4" />}</button><span className={`flex-1 ${task.completed ? "line-through text-slate-400" : ""}`}>{task.content}</span><button onClick={() => deleteTask(task.id)} className="text-red-500 p-1"><Trash2 className="h-4 w-4" /></button></div>))}</div></CardContent></Card>
              
              {/* TOP10テーブル */}
              <Card>
                <CardHeader className="bg-amber-600 text-white py-3 rounded-t-lg"><CardTitle className="text-base"><Trophy className="h-4 w-4 inline mr-1" />利益額 TOP10（クリックで詳細）</CardTitle></CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-xs whitespace-nowrap">
                    <thead className="bg-slate-100"><tr><th className="p-2 text-left sticky left-0 bg-slate-100">CPN名</th><th className="p-2 text-right">消化</th><th className="p-2 text-right">MCV</th><th className="p-2 text-right">CV</th><th className="p-2 text-right">売上</th><th className="p-2 text-right">利益</th><th className="p-2 text-right">ROAS</th><th className="p-2 text-right">CPA</th><th className="p-2 text-right">CPM</th><th className="p-2 text-right">Imp.</th><th className="p-2 text-right">Clicks</th><th className="p-2 text-right">CTR</th><th className="p-2 text-right">CPC</th><th className="p-2 text-right">MCVR</th><th className="p-2 text-right">MCPA</th><th className="p-2 text-right">CVR</th></tr></thead>
                    <tbody>{top10Profit.map((cpn, idx) => (<tr key={cpn.cpnKey} className={`cursor-pointer hover:bg-indigo-50 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50"}`} onClick={() => setSelectedCpnDetail(cpn)}><td className="p-2 max-w-xs truncate sticky left-0 bg-inherit font-medium">{cpn.cpnName}</td><td className="p-2 text-right">{formatCurrency(cpn.spend)}</td><td className="p-2 text-right">{cpn.mcv}</td><td className="p-2 text-right">{cpn.cv}</td><td className="p-2 text-right">{formatCurrency(cpn.revenue)}</td><td className="p-2 text-right font-bold text-emerald-600">{formatCurrency(cpn.profit)}</td><td className="p-2 text-right font-bold">{cpn.roas.toFixed(1)}%</td><td className="p-2 text-right">{cpn.cv > 0 ? formatCurrency(cpn.spend / cpn.cv) : "-"}</td><td className="p-2 text-right">{cpn.impressions > 0 ? formatCurrency((cpn.spend / cpn.impressions) * 1000) : "-"}</td><td className="p-2 text-right">{cpn.impressions?.toLocaleString() || 0}</td><td className="p-2 text-right">{cpn.clicks?.toLocaleString() || 0}</td><td className="p-2 text-right">{cpn.impressions > 0 ? ((cpn.clicks / cpn.impressions) * 100).toFixed(2) : 0}%</td><td className="p-2 text-right">{cpn.clicks > 0 ? formatCurrency(cpn.spend / cpn.clicks) : "-"}</td><td className="p-2 text-right">{cpn.clicks > 0 ? ((cpn.mcv / cpn.clicks) * 100).toFixed(2) : 0}%</td><td className="p-2 text-right">{cpn.mcv > 0 ? formatCurrency(cpn.spend / cpn.mcv) : "-"}</td><td className="p-2 text-right">{cpn.mcv > 0 ? ((cpn.cv / cpn.mcv) * 100).toFixed(2) : 0}%</td></tr>))}</tbody>
                  </table>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="bg-red-600 text-white py-3 rounded-t-lg"><CardTitle className="text-base"><AlertTriangle className="h-4 w-4 inline mr-1" />赤字 TOP10（クリックで詳細）</CardTitle></CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-xs whitespace-nowrap">
                    <thead className="bg-slate-100"><tr><th className="p-2 text-left sticky left-0 bg-slate-100">CPN名</th><th className="p-2 text-right">消化</th><th className="p-2 text-right">MCV</th><th className="p-2 text-right">CV</th><th className="p-2 text-right">売上</th><th className="p-2 text-right">利益</th><th className="p-2 text-right">ROAS</th><th className="p-2 text-right">CPA</th><th className="p-2 text-right">CPM</th><th className="p-2 text-right">Imp.</th><th className="p-2 text-right">Clicks</th><th className="p-2 text-right">CTR</th><th className="p-2 text-right">CPC</th><th className="p-2 text-right">MCVR</th><th className="p-2 text-right">MCPA</th><th className="p-2 text-right">CVR</th></tr></thead>
                    <tbody>{top10Loss.map((cpn, idx) => (<tr key={cpn.cpnKey} className={`cursor-pointer hover:bg-indigo-50 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50"}`} onClick={() => setSelectedCpnDetail(cpn)}><td className="p-2 max-w-xs truncate sticky left-0 bg-inherit font-medium">{cpn.cpnName}</td><td className="p-2 text-right">{formatCurrency(cpn.spend)}</td><td className="p-2 text-right">{cpn.mcv}</td><td className="p-2 text-right">{cpn.cv}</td><td className="p-2 text-right">{formatCurrency(cpn.revenue)}</td><td className="p-2 text-right font-bold text-red-600">{formatCurrency(cpn.profit)}</td><td className="p-2 text-right font-bold">{cpn.roas.toFixed(1)}%</td><td className="p-2 text-right">{cpn.cv > 0 ? formatCurrency(cpn.spend / cpn.cv) : "-"}</td><td className="p-2 text-right">{cpn.impressions > 0 ? formatCurrency((cpn.spend / cpn.impressions) * 1000) : "-"}</td><td className="p-2 text-right">{cpn.impressions?.toLocaleString() || 0}</td><td className="p-2 text-right">{cpn.clicks?.toLocaleString() || 0}</td><td className="p-2 text-right">{cpn.impressions > 0 ? ((cpn.clicks / cpn.impressions) * 100).toFixed(2) : 0}%</td><td className="p-2 text-right">{cpn.clicks > 0 ? formatCurrency(cpn.spend / cpn.clicks) : "-"}</td><td className="p-2 text-right">{cpn.clicks > 0 ? ((cpn.mcv / cpn.clicks) * 100).toFixed(2) : 0}%</td><td className="p-2 text-right">{cpn.mcv > 0 ? formatCurrency(cpn.spend / cpn.mcv) : "-"}</td><td className="p-2 text-right">{cpn.mcv > 0 ? ((cpn.cv / cpn.mcv) * 100).toFixed(2) : 0}%</td></tr>))}</tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* 案件×媒体別タブ */}
          {activeTab === "project-media" && (
            <div className="space-y-6">
              <Card>
                <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white py-3 rounded-t-lg">
                  <CardTitle className="text-base"><Briefcase className="h-4 w-4 inline mr-1" />案件×媒体別一覧（クリックで詳細）</CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100"><tr><th className="p-3 text-left">案件名</th><th className="p-3 text-left">媒体</th><th className="p-3 text-right">消化</th><th className="p-3 text-right">売上</th><th className="p-3 text-right">利益</th><th className="p-3 text-right">ROAS</th><th className="p-3 text-right">CV</th><th className="p-3 text-center">詳細</th></tr></thead>
                    <tbody>
                      {projectMediaData.map((pm, i) => (
                        <tr 
                          key={`${pm.project}-${pm.media}`} 
                          className={`cursor-pointer hover:bg-indigo-50 ${i % 2 === 0 ? "bg-white" : "bg-slate-50"} ${selectedProjectMedia?.project === pm.project && selectedProjectMedia?.media === pm.media ? "bg-indigo-100" : ""}`}
                          onClick={() => setSelectedProjectMedia({project: pm.project, media: pm.media})}
                        >
                          <td className="p-3 font-medium">{pm.project}</td>
                          <td className="p-3"><MediaLogo media={pm.media} size={20} /></td>
                          <td className="p-3 text-right">¥{Math.round(pm.spend).toLocaleString()}</td>
                          <td className="p-3 text-right">¥{Math.round(pm.revenue).toLocaleString()}</td>
                          <td className={`p-3 text-right font-bold ${pm.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(pm.profit)}</td>
                          <td className="p-3 text-right">{pm.roas.toFixed(1)}%</td>
                          <td className="p-3 text-right">{pm.cv}</td>
                          <td className="p-3 text-center"><MessageSquare className="h-4 w-4 text-indigo-500" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
              
              {/* 選択した案件×媒体の詳細 */}
              {selectedProjectMedia && (
                <div className="space-y-6">
                  <Card className="border-2 border-indigo-500">
                    <CardHeader className="bg-indigo-500 text-white py-3 rounded-t-lg flex flex-row items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        {selectedProjectMedia.project} ({selectedProjectMedia.media}) の振り返り
                      </CardTitle>
                      <button onClick={() => setSelectedProjectMedia(null)}><X className="h-5 w-5" /></button>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      <div>
                        <label className="block text-sm font-bold mb-2 text-slate-700">📝 所感</label>
                        <textarea 
                          value={currentComment.shokan} 
                          onChange={(e) => updateProjectComment(projectMediaKey, "shokan", e.target.value)}
                          placeholder="今週の所感を記入..." 
                          className="w-full h-28 p-3 border rounded-lg resize-none text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold mb-2 text-slate-700">📊 結果</label>
                        <textarea 
                          value={currentComment.result} 
                          onChange={(e) => updateProjectComment(projectMediaKey, "result", e.target.value)}
                          placeholder="今週の結果・分析を記入..." 
                          className="w-full h-28 p-3 border rounded-lg resize-none text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold mb-2 text-slate-700">🚀 NEXT</label>
                        <textarea 
                          value={currentComment.next} 
                          onChange={(e) => updateProjectComment(projectMediaKey, "next", e.target.value)}
                          placeholder="来週やること・改善点を記入..." 
                          className="w-full h-28 p-3 border rounded-lg resize-none text-sm"
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button onClick={saveComments} disabled={isSaving}>
                          <Save className="h-4 w-4 mr-2" />{isSaving ? "保存中..." : "保存"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* 該当CPN一覧 */}
                  <Card>
                    <CardHeader className="bg-slate-700 text-white py-3 rounded-t-lg">
                      <CardTitle className="text-base">📋 {selectedProjectMedia.project}（{selectedProjectMedia.media}）のCPN一覧 ({selectedProjectCpns.length}件)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto overflow-y-auto max-h-[600px]">
                      {selectedProjectCpns.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">該当するCPNがありません</div>
                      ) : (
                        <table className="text-xs whitespace-nowrap min-w-max">
                          <thead className="bg-slate-100 sticky top-0">
                            <tr><th className="p-2 text-left sticky left-0 bg-slate-100 z-10">CPN名</th><th className="p-2 text-right">消化</th><th className="p-2 text-right">MCV</th><th className="p-2 text-right">CV</th><th className="p-2 text-right">売上</th><th className="p-2 text-right">利益</th><th className="p-2 text-right">ROAS</th><th className="p-2 text-right">CPA</th><th className="p-2 text-right">CPM</th><th className="p-2 text-right">Imp.</th><th className="p-2 text-right">Clicks</th><th className="p-2 text-right">CTR</th><th className="p-2 text-right">CPC</th><th className="p-2 text-right">MCVR</th><th className="p-2 text-right">MCPA</th><th className="p-2 text-right">CVR</th></tr>
                          </thead>
                          <tbody>
                            {selectedProjectCpns.map((cpn, idx) => (
                              <tr key={cpn.cpnKey} className={`cursor-pointer hover:bg-indigo-50 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50"}`} onClick={() => setSelectedCpnDetail(cpn)}>
                                <td className="p-2 sticky left-0 bg-inherit z-10">{cpn.cpnName}</td>
                                <td className="p-2 text-right">{formatCurrency(cpn.spend)}</td>
                                <td className="p-2 text-right">{cpn.mcv}</td>
                                <td className="p-2 text-right">{cpn.cv}</td>
                                <td className="p-2 text-right">{formatCurrency(cpn.revenue)}</td>
                                <td className={`p-2 text-right font-bold ${cpn.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(cpn.profit)}</td>
                                <td className="p-2 text-right">{cpn.roas.toFixed(1)}%</td>
                                <td className="p-2 text-right">{cpn.cv > 0 ? formatCurrency(cpn.spend / cpn.cv) : "-"}</td>
                                <td className="p-2 text-right">{cpn.impressions > 0 ? formatCurrency((cpn.spend / cpn.impressions) * 1000) : "-"}</td>
                                <td className="p-2 text-right">{cpn.impressions?.toLocaleString() || 0}</td>
                                <td className="p-2 text-right">{cpn.clicks?.toLocaleString() || 0}</td>
                                <td className="p-2 text-right">{cpn.impressions > 0 ? ((cpn.clicks / cpn.impressions) * 100).toFixed(2) : 0}%</td>
                                <td className="p-2 text-right">{cpn.clicks > 0 ? formatCurrency(cpn.spend / cpn.clicks) : "-"}</td>
                                <td className="p-2 text-right">{cpn.clicks > 0 ? ((cpn.mcv / cpn.clicks) * 100).toFixed(2) : 0}%</td>
                                <td className="p-2 text-right">{cpn.mcv > 0 ? formatCurrency(cpn.spend / cpn.mcv) : "-"}</td>
                                <td className="p-2 text-right">{cpn.mcv > 0 ? ((cpn.cv / cpn.mcv) * 100).toFixed(2) : 0}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
          
          {/* 全CPN一覧タブ */}
          {activeTab === "cpn-list" && (
            <Card>
              <CardHeader className="bg-slate-700 text-white py-3 rounded-t-lg">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>📋 全CPN一覧（{filteredCpnList.length}件）- クリックで詳細</span>
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="CPN検索..."
                      className="pl-10 pr-4 py-1 rounded text-sm text-slate-800 w-64"
                    />
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 max-h-[800px] overflow-x-auto overflow-y-auto">
                {filteredCpnList.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">この週のCPNデータがありません</div>
                ) : (
                  <table className="text-xs whitespace-nowrap min-w-max">
                    <thead className="bg-slate-100 sticky top-0">
                      <tr>
                        <th className="p-2 text-left sticky left-0 bg-slate-100 z-10">CPN名</th>
                        <th className="p-2 text-left">媒体</th>
                        <SortHeader label="消化" sortKey="spend" />
                        <SortHeader label="MCV" sortKey="mcv" />
                        <SortHeader label="CV" sortKey="cv" />
                        <SortHeader label="売上" sortKey="revenue" />
                        <SortHeader label="利益" sortKey="profit" />
                        <SortHeader label="ROAS" sortKey="roas" />
                        <th className="p-2 text-right">CPA</th>
                        <th className="p-2 text-right">CPM</th>
                        <SortHeader label="Imp." sortKey="impressions" />
                        <SortHeader label="Clicks" sortKey="clicks" />
                        <th className="p-2 text-right">CTR</th>
                        <th className="p-2 text-right">CPC</th>
                        <th className="p-2 text-right">MCVR</th>
                        <th className="p-2 text-right">MCPA</th>
                        <th className="p-2 text-right">CVR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCpnList.map((cpn, i) => (
                        <tr 
                          key={cpn.cpnKey} 
                          className={`cursor-pointer hover:bg-indigo-50 ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}
                          onClick={() => setSelectedCpnDetail(cpn)}
                        >
                          <td className="p-2 sticky left-0 bg-inherit z-10">{cpn.cpnName}</td>
                          <td className="p-2"><span className={`px-1 py-0.5 rounded text-xs ${cpn.media === "FB" ? "bg-blue-100 text-blue-700" : cpn.media === "TikTok" ? "bg-slate-800 text-white" : "bg-cyan-100 text-cyan-700"}`}>{cpn.media}</span></td>
                          <td className="p-2 text-right">{formatCurrency(cpn.spend)}</td>
                          <td className="p-2 text-right">{cpn.mcv}</td>
                          <td className="p-2 text-right">{cpn.cv}</td>
                          <td className="p-2 text-right">{formatCurrency(cpn.revenue)}</td>
                          <td className={`p-2 text-right font-bold ${cpn.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(cpn.profit)}</td>
                          <td className="p-2 text-right">{cpn.roas.toFixed(1)}%</td>
                          <td className="p-2 text-right">{cpn.cv > 0 ? formatCurrency(cpn.spend / cpn.cv) : "-"}</td>
                          <td className="p-2 text-right">{cpn.impressions > 0 ? formatCurrency((cpn.spend / cpn.impressions) * 1000) : "-"}</td>
                          <td className="p-2 text-right">{cpn.impressions?.toLocaleString() || 0}</td>
                          <td className="p-2 text-right">{cpn.clicks?.toLocaleString() || 0}</td>
                          <td className="p-2 text-right">{cpn.impressions > 0 ? ((cpn.clicks / cpn.impressions) * 100).toFixed(2) : 0}%</td>
                          <td className="p-2 text-right">{cpn.clicks > 0 ? formatCurrency(cpn.spend / cpn.clicks) : "-"}</td>
                          <td className="p-2 text-right">{cpn.clicks > 0 ? ((cpn.mcv / cpn.clicks) * 100).toFixed(2) : 0}%</td>
                          <td className="p-2 text-right">{cpn.mcv > 0 ? formatCurrency(cpn.spend / cpn.mcv) : "-"}</td>
                          <td className="p-2 text-right">{cpn.mcv > 0 ? ((cpn.cv / cpn.mcv) * 100).toFixed(2) : 0}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
      
      {/* CPN詳細モーダル（CR単位データ含む） */}
      {selectedCpnDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-6xl w-full max-h-[95vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-t-xl">
              <h3 className="font-bold text-lg">CPN詳細 & クリエイティブ</h3>
              <button onClick={() => { setSelectedCpnDetail(null); setCreatives([]); }}><X className="h-6 w-6" /></button>
            </div>
            <div className="p-4">
              <p className="text-sm text-slate-600 mb-4 break-all font-medium bg-slate-50 p-3 rounded">{selectedCpnDetail.cpnName}</p>
              
              {/* CPN全体の指標 */}
              <h4 className="font-bold text-lg mb-3 flex items-center gap-2">📊 CPN全体指標</h4>
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-xs border">
                  <thead className="bg-slate-100">
                    <tr><th className="p-2 border">消化金額</th><th className="p-2 border">MCV</th><th className="p-2 border">CV</th><th className="p-2 border">売上</th><th className="p-2 border">利益</th><th className="p-2 border">ROAS</th><th className="p-2 border">CPA</th><th className="p-2 border">CPM</th><th className="p-2 border">Imp.</th><th className="p-2 border">Clicks</th><th className="p-2 border">CTR</th><th className="p-2 border">CPC</th><th className="p-2 border">MCVR</th><th className="p-2 border">MCPA</th><th className="p-2 border">CVR</th></tr>
                  </thead>
                  <tbody>
                    <tr className="text-center">
                      <td className="p-2 border font-bold">{formatCurrency(selectedCpnDetail.spend)}</td>
                      <td className="p-2 border">{selectedCpnDetail.mcv}</td>
                      <td className="p-2 border">{selectedCpnDetail.cv}</td>
                      <td className="p-2 border">{formatCurrency(selectedCpnDetail.revenue)}</td>
                      <td className={`p-2 border font-bold ${selectedCpnDetail.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(selectedCpnDetail.profit)}</td>
                      <td className="p-2 border font-bold">{selectedCpnDetail.roas.toFixed(1)}%</td>
                      <td className="p-2 border">{selectedCpnDetail.cv > 0 ? formatCurrency(selectedCpnDetail.spend / selectedCpnDetail.cv) : "-"}</td>
                      <td className="p-2 border">{selectedCpnDetail.impressions > 0 ? formatCurrency((selectedCpnDetail.spend / selectedCpnDetail.impressions) * 1000) : "-"}</td>
                      <td className="p-2 border">{selectedCpnDetail.impressions?.toLocaleString()}</td>
                      <td className="p-2 border">{selectedCpnDetail.clicks?.toLocaleString()}</td>
                      <td className="p-2 border">{selectedCpnDetail.impressions > 0 ? ((selectedCpnDetail.clicks / selectedCpnDetail.impressions) * 100).toFixed(2) : 0}%</td>
                      <td className="p-2 border">{selectedCpnDetail.clicks > 0 ? formatCurrency(selectedCpnDetail.spend / selectedCpnDetail.clicks) : "-"}</td>
                      <td className="p-2 border">{selectedCpnDetail.clicks > 0 ? ((selectedCpnDetail.mcv / selectedCpnDetail.clicks) * 100).toFixed(2) : 0}%</td>
                      <td className="p-2 border">{selectedCpnDetail.mcv > 0 ? formatCurrency(selectedCpnDetail.spend / selectedCpnDetail.mcv) : "-"}</td>
                      <td className="p-2 border">{selectedCpnDetail.mcv > 0 ? ((selectedCpnDetail.cv / selectedCpnDetail.mcv) * 100).toFixed(2) : 0}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              {/* クリエイティブ（CR）単位 */}
              <h4 className="font-bold text-lg mb-3 flex items-center gap-2"><Video className="h-5 w-5" />クリエイティブ別 ({creatives.length}件)</h4>
              {creativesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  <span className="ml-3 text-slate-600">クリエイティブデータを読み込み中...</span>
                </div>
              ) : creatives.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border">
                    <thead className="bg-indigo-50">
                      <tr>
                        <th className="p-2 border text-left">クリエイティブ名</th>
                        <th className="p-2 border text-right">消化金額</th>
                        <th className="p-2 border text-right">Imp.</th>
                        <th className="p-2 border text-right">Clicks</th>
                        <th className="p-2 border text-right">CV</th>
                        <th className="p-2 border text-right">CPA</th>
                        <th className="p-2 border text-right">売上</th>
                        <th className="p-2 border text-right">利益</th>
                        <th className="p-2 border text-right">ROAS</th>
                        <th className="p-2 border text-right">CTR</th>
                        <th className="p-2 border text-right">CPM</th>
                        <th className="p-2 border text-right">CPC</th>
                        <th className="p-2 border text-center">動画</th>
                      </tr>
                    </thead>
                    <tbody>
                      {creatives.map((cr, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                          <td className="p-2 border max-w-xs truncate">{cr.name}</td>
                          <td className="p-2 border text-right">{formatCurrency(cr.spend)}</td>
                          <td className="p-2 border text-right">{cr.impressions.toLocaleString()}</td>
                          <td className="p-2 border text-right">{cr.clicks.toLocaleString()}</td>
                          <td className="p-2 border text-right">{cr.cv}</td>
                          <td className="p-2 border text-right">{cr.cv > 0 ? formatCurrency(cr.cpa) : "-"}</td>
                          <td className="p-2 border text-right">{formatCurrency(cr.revenue)}</td>
                          <td className={`p-2 border text-right font-bold ${cr.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(cr.profit)}</td>
                          <td className="p-2 border text-right font-bold">{cr.roas.toFixed(1)}%</td>
                          <td className="p-2 border text-right">{cr.ctr.toFixed(2)}%</td>
                          <td className="p-2 border text-right">{formatCurrency(cr.cpm)}</td>
                          <td className="p-2 border text-right">{formatCurrency(cr.cpc)}</td>
                          <td className="p-2 border text-center">
                            {cr.videoUrl || cr.thumbnailUrl ? (
                              <button
                                onClick={() => openVideoModal(cr)}
                                disabled={videoLoading === cr.name}
                                className="relative group cursor-pointer"
                              >
                                {cr.thumbnailUrl ? (
                                  <img src={cr.thumbnailUrl} alt="" className="w-10 h-10 object-cover rounded mx-auto group-hover:opacity-75 transition-opacity" />
                                ) : (
                                  <div className="w-10 h-10 bg-slate-200 rounded mx-auto flex items-center justify-center">
                                    <Play className="h-4 w-4 text-slate-600" />
                                  </div>
                                )}
                                <div className="absolute inset-0 flex items-center justify-center">
                                  {videoLoading === cr.name ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                  ) : (
                                    <Play className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                                  )}
                                </div>
                              </button>
                            ) : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-slate-100 rounded-lg p-8 text-center">
                  <Video className="h-12 w-12 mx-auto mb-3 text-slate-400" />
                  <p className="text-slate-600 mb-2">クリエイティブデータが取得できませんでした</p>
                  <p className="text-xs text-slate-400">Campaign ID: {selectedCpnDetail.campaignId || "未取得"}</p>
                  {selectedCpnDetail.campaignId && (
                    <a 
                      href={selectedCpnDetail.media === "FB" ? `https://business.facebook.com/adsmanager/manage/campaigns?act=${selectedCpnDetail.campaignId}` : `https://ads.tiktok.com/i18n/perf`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="inline-flex items-center gap-1 mt-3 text-indigo-600 hover:text-indigo-800"
                    >
                      <ExternalLink className="h-4 w-4" />広告マネージャーで確認
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 動画再生モーダル */}
      {videoModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4" onClick={() => setVideoModal(null)}>
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-lg truncate flex-1 mr-4">{videoModal.name}</h3>
              <button onClick={() => setVideoModal(null)} className="p-1 hover:bg-slate-100 rounded-full">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4 bg-black">
              <video
                src={videoModal.url}
                controls
                autoPlay
                className="w-full max-h-[70vh] mx-auto"
              >
                お使いのブラウザは動画再生に対応していません
              </video>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
