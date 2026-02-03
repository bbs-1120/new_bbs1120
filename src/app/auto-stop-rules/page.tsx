"use client";

import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback } from "react";
import { 
  Users, Briefcase, Plus, Trash2, ChevronRight, Save, X,
  AlertTriangle, History, Clock, User,
  UserCheck, Building2, Zap, ChevronUp, ChevronDown, Play, Eye, Loader2
} from "lucide-react";

interface Rule {
  id: string;
  memberName: string;
  projectName: string;
  conditions: {
    spendMin?: number;
    mcvMax?: number;
    cvMax?: number;
    cvMin?: number;
    roasMax?: number;
    profitMax?: number;
    consecutiveLossMin?: number;
  };
  isActive: boolean;
  priority: number;
  createdBy: string;
  createdAt: string;
}

interface StopHistory {
  id: string;
  cpnName: string;
  media: string;
  memberName: string;
  projectName: string;
  ruleName: string;
  conditions: Record<string, number | string[]> & { matched_descriptions?: string[] };
  metrics: Record<string, number>;
  stoppedAt: string;
  status: string;
  errorMessage?: string;
}

export default function AutoStopRulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [offers, setOffers] = useState<string[]>([]);
  const [mediaList, setMediaList] = useState<string[]>([]);
  const [projectOffers, setProjectOffers] = useState<Record<string, string[]>>({});
  const [history, setHistory] = useState<StopHistory[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"rules" | "history">("rules");
  const [isExecuting, setIsExecuting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewResults, setPreviewResults] = useState<{
    cpnName: string;
    media: string;
    memberName: string;
    projectName: string;
    ruleName: string;
    metrics: { spend: number; cv: number; mcv: number; profit: number; roas: number };
  }[] | null>(null);
  const [executeMessage, setExecuteMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  // 新規ルール作成用
  const [newRule, setNewRule] = useState({
    memberName: "",
    projectName: "",
    offerNames: [] as string[],  // 複数選択対応
    mediaFilters: [] as string[], // 複数選択対応
    conditions: {
      spendMin: undefined as number | undefined,
      mcvMax: undefined as number | undefined,
      cvMax: undefined as number | undefined,
      cvMin: undefined as number | undefined,
      roasMax: undefined as number | undefined,
      profitMax: undefined as number | undefined,
      consecutiveLossMin: undefined as number | undefined,
    },
  });
  
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auto-stop-rules?projects=true&history=true");
      const data = await res.json();
      if (data.success) {
        setRules(data.rules || []);
        setProjects(data.projects || []);
        setMembers(data.members || []);
        setOffers(data.offers || []);
        setMediaList(data.mediaList || ["Meta", "TikTok", "Pangle"]);
        setProjectOffers(data.projectOffers || {});
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error("Failed to fetch:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const resetNewRule = () => {
    setNewRule({
      memberName: "",
      projectName: "",
      offerNames: [],
      mediaFilters: [],
      conditions: {
        spendMin: undefined, mcvMax: undefined, cvMax: undefined,
        cvMin: undefined, roasMax: undefined, profitMax: undefined,
        consecutiveLossMin: undefined,
      },
    });
    setStep(1);
    setIsCreating(false);
  };
  
  const saveRule = async () => {
    if (!newRule.memberName || !newRule.projectName) return;
    if (isSaving) return; // 二重クリック防止
    
    setIsSaving(true);
    try {
      const res = await fetch("/api/auto-stop-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newRule,
          offerNames: newRule.offerNames.length > 0 ? newRule.offerNames : ["全オファー"],
          mediaFilters: newRule.mediaFilters.length > 0 ? newRule.mediaFilters : ["全媒体"],
        }),
      });
      if (res.ok) {
        await fetchData();
        resetNewRule();
      }
    } catch (error) {
      console.error("Failed to save rule:", error);
    } finally {
      setIsSaving(false);
    }
  };
  
  const deleteRule = async (id: string) => {
    try {
      await fetch(`/api/auto-stop-rules?id=${id}`, { method: "DELETE" });
      await fetchData();
    } catch (error) {
      console.error("Failed to delete rule:", error);
    }
  };
  
  const toggleRule = async (id: string, isActive: boolean) => {
    try {
      await fetch("/api/auto-stop-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive: !isActive }),
      });
      await fetchData();
    } catch (error) {
      console.error("Failed to toggle rule:", error);
    }
  };
  
  const movePriority = async (id: string, direction: "up" | "down") => {
    const idx = rules.findIndex(r => r.id === id);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === rules.length - 1) return;
    
    const newRules = [...rules];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    
    // 優先度を入れ替え
    const tempPriority = newRules[idx].priority;
    newRules[idx].priority = newRules[swapIdx].priority;
    newRules[swapIdx].priority = tempPriority;
    
    // 配列内の位置も入れ替え
    [newRules[idx], newRules[swapIdx]] = [newRules[swapIdx], newRules[idx]];
    
    setRules(newRules);
    
    // API更新
    try {
      await fetch("/api/auto-stop-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reorderRules: newRules.map((r, i) => ({ id: r.id, priority: i + 1 })),
        }),
      });
    } catch (error) {
      console.error("Failed to reorder:", error);
    }
  };

  // プレビュー（どのCPNが停止対象か確認）
  const previewStopTargets = async () => {
    setIsPreviewing(true);
    setPreviewResults(null);
    try {
      const res = await fetch("/api/auto-stop/execute");
      const data = await res.json();
      if (data.success) {
        setPreviewResults(data.targets || []);
      } else {
        setExecuteMessage({ type: "error", text: data.error || "プレビューに失敗しました" });
      }
    } catch (error) {
      console.error("Preview failed:", error);
      setExecuteMessage({ type: "error", text: "プレビューに失敗しました" });
    } finally {
      setIsPreviewing(false);
    }
  };

  // 自動停止を実行
  const executeAutoStop = async () => {
    if (!confirm("本当に自動停止を実行しますか？\n対象のCPNがすべてOFFになります。")) return;
    
    setIsExecuting(true);
    setExecuteMessage(null);
    try {
      const res = await fetch("/api/auto-stop/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false }),
      });
      const data = await res.json();
      if (data.success) {
        setExecuteMessage({ 
          type: "success", 
          text: `${data.stopped}/${data.processed}件のCPNを停止しました` 
        });
        setPreviewResults(null);
        await fetchData(); // 履歴を更新
      } else {
        setExecuteMessage({ type: "error", text: data.error || "実行に失敗しました" });
      }
    } catch (error) {
      console.error("Execute failed:", error);
      setExecuteMessage({ type: "error", text: "実行に失敗しました" });
    } finally {
      setIsExecuting(false);
      setTimeout(() => setExecuteMessage(null), 5000);
    }
  };
  
  const formatConditions = (conditions: Rule["conditions"]): string => {
    const parts: string[] = [];
    if (conditions.spendMin) parts.push(`消化≥¥${conditions.spendMin.toLocaleString()}`);
    if (conditions.mcvMax !== undefined) parts.push(`MCV≤${conditions.mcvMax}`);
    if (conditions.cvMax !== undefined) parts.push(`CV≤${conditions.cvMax}`);
    if (conditions.cvMin !== undefined) parts.push(`CV≥${conditions.cvMin}`);
    if (conditions.roasMax !== undefined) parts.push(`ROAS≤${conditions.roasMax}%`);
    if (conditions.profitMax !== undefined) parts.push(`利益≤¥${conditions.profitMax.toLocaleString()}`);
    if (conditions.consecutiveLossMin !== undefined) parts.push(`赤字≥${conditions.consecutiveLossMin}日`);
    return parts.join(" & ") || "条件なし";
  };
  
  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };
  
  return (
    <>
      <Header title="自動停止ルール" description="CPNの自動停止条件を設定" />
      
      {/* タブ */}
      <div className="mb-6 flex gap-4 border-b">
        <button
          onClick={() => setActiveTab("rules")}
          className={`pb-3 px-2 font-medium flex items-center gap-2 ${
            activeTab === "rules" ? "border-b-2 border-emerald-600 text-emerald-600" : "text-slate-500"
          }`}
        >
          <AlertTriangle className="h-4 w-4" />ルール設定
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`pb-3 px-2 font-medium flex items-center gap-2 ${
            activeTab === "history" ? "border-b-2 border-emerald-600 text-emerald-600" : "text-slate-500"
          }`}
        >
          <History className="h-4 w-4" />停止履歴
        </button>
      </div>
      
      {activeTab === "rules" && (
        <>
          {/* 実行セクション */}
          {!isCreating && rules.length > 0 && (
            <Card className="mb-6 border-2 border-red-200 bg-red-50">
              <CardContent className="p-4">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Zap className="h-5 w-5 text-red-500" />
                        自動停止を実行
                      </h3>
                      <p className="text-sm text-slate-600 mt-1">
                        設定したルールに基づいて、条件に該当するCPNを自動的にOFFにします
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="secondary" 
                        onClick={previewStopTargets}
                        disabled={isPreviewing || isExecuting}
                      >
                        {isPreviewing ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Eye className="h-4 w-4 mr-2" />
                        )}
                        プレビュー
                      </Button>
                      <Button 
                        onClick={executeAutoStop}
                        disabled={isExecuting || isPreviewing}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        {isExecuting ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4 mr-2" />
                        )}
                        実行する
                      </Button>
                    </div>
                  </div>

                  {/* メッセージ */}
                  {executeMessage && (
                    <div className={`p-3 rounded-lg ${
                      executeMessage.type === "success" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                    }`}>
                      {executeMessage.text}
                    </div>
                  )}

                  {/* プレビュー結果 */}
                  {previewResults !== null && (
                    <div className="border-t border-red-200 pt-4">
                      <h4 className="font-medium text-slate-700 mb-3">
                        停止対象: {previewResults.length}件
                      </h4>
                      {previewResults.length === 0 ? (
                        <p className="text-sm text-slate-500">条件に該当するCPNはありません</p>
                      ) : (
                        <div className="max-h-60 overflow-y-auto space-y-2">
                          {previewResults.map((target, idx) => (
                            <div key={idx} className="bg-white p-3 rounded-lg border text-sm">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  target.media === "Meta" || target.media === "FB" ? "bg-blue-100 text-blue-700" :
                                  target.media === "TikTok" ? "bg-slate-800 text-white" :
                                  "bg-cyan-100 text-cyan-700"
                                }`}>{target.media}</span>
                                <span className="text-xs text-slate-500">
                                  {target.memberName} / {target.projectName}
                                </span>
                              </div>
                              <p className="font-medium text-slate-800 break-all">{target.cpnName}</p>
                              <div className="flex gap-4 mt-1 text-xs text-slate-500">
                                <span>消化: ¥{target.metrics.spend.toLocaleString()}</span>
                                <span>CV: {target.metrics.cv}</span>
                                <span>利益: ¥{target.metrics.profit.toLocaleString()}</span>
                                <span>ROAS: {target.metrics.roas.toFixed(1)}%</span>
                              </div>
                              <p className="text-xs text-amber-600 mt-1">適用ルール: {target.ruleName}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ルール作成ボタン */}
          {!isCreating && (
            <div className="mb-6">
              <Button onClick={() => setIsCreating(true)} className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-4 w-4 mr-2" />新しいルールを作成
              </Button>
            </div>
          )}
          
          {/* ルール作成ウィザード */}
          {isCreating && (
            <Card className="mb-8 border-2 border-emerald-500">
              <CardHeader className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />新しいルールを作成
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {/* ステップインジケーター */}
                <div className="flex items-center justify-center mb-8">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${step >= 1 ? "bg-emerald-500 text-white" : "bg-slate-200"}`}>1</div>
                  <div className={`w-10 h-1 ${step >= 2 ? "bg-emerald-500" : "bg-slate-200"}`}></div>
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${step >= 2 ? "bg-emerald-500 text-white" : "bg-slate-200"}`}>2</div>
                  <div className={`w-10 h-1 ${step >= 3 ? "bg-emerald-500" : "bg-slate-200"}`}></div>
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${step >= 3 ? "bg-emerald-500 text-white" : "bg-slate-200"}`}>3</div>
                  <div className={`w-10 h-1 ${step >= 4 ? "bg-emerald-500" : "bg-slate-200"}`}></div>
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${step >= 4 ? "bg-emerald-500 text-white" : "bg-slate-200"}`}>4</div>
                </div>
                
                {/* ステップ1: メンバー選択 */}
                {step === 1 && (
                  <div>
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <UserCheck className="h-6 w-6 text-emerald-500" />誰に適用しますか？
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      <button
                        onClick={() => { setNewRule({ ...newRule, memberName: "全員" }); setStep(2); }}
                        className="p-4 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 text-white border-2 border-purple-500 hover:shadow-lg transition-all"
                      >
                        <Users className="h-8 w-8 mx-auto mb-2" />全員
                      </button>
                      {members.map((member) => (
                        <button
                          key={member}
                          onClick={() => { setNewRule({ ...newRule, memberName: member }); setStep(2); }}
                          className="p-4 rounded-xl border-2 border-slate-200 bg-white hover:border-emerald-500 hover:bg-emerald-50 transition-all"
                        >
                          <User className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                          {member}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* ステップ2: 案件選択 */}
                {step === 2 && (
                  <div>
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <Building2 className="h-6 w-6 text-emerald-500" />どの案件に適用しますか？
                    </h3>
                    <p className="text-sm text-slate-500 mb-4">対象: <span className="font-bold text-emerald-600">{newRule.memberName}</span></p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-80 overflow-y-auto">
                      <button
                        onClick={() => { setNewRule({ ...newRule, projectName: "全案件", offerNames: [] }); setStep(3); }}
                        className="p-4 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white border-2 border-amber-500 hover:shadow-lg transition-all"
                      >
                        <Briefcase className="h-6 w-6 mx-auto mb-2" />
                        <span className="text-sm font-bold">全案件</span>
                      </button>
                      {projects.map((project) => (
                        <button
                          key={project}
                          onClick={() => { setNewRule({ ...newRule, projectName: project }); setStep(3); }}
                          className="p-4 rounded-xl border-2 border-slate-200 bg-white hover:border-emerald-500 hover:bg-emerald-50 transition-all"
                        >
                          <Briefcase className="h-6 w-6 mx-auto mb-2 text-slate-400" />
                          <span className="text-xs">{project}</span>
                        </button>
                      ))}
                    </div>
                    
                    <div className="mt-4">
                      <Button variant="secondary" onClick={() => setStep(1)}>← 戻る</Button>
                    </div>
                  </div>
                )}
                
                {/* ステップ3: オファー・媒体選択 */}
                {step === 3 && (
                  <div>
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <Briefcase className="h-6 w-6 text-emerald-500" />オファーと媒体を選択
                    </h3>
                    <div className="text-sm text-slate-500 mb-4">
                      対象: <span className="font-bold text-purple-600">{newRule.memberName}</span> の 
                      <span className="font-bold text-amber-600 ml-1">{newRule.projectName}</span>
                    </div>
                    
                    {/* オファー選択（複数選択可） */}
                    <div className="mb-6">
                      <p className="text-sm font-medium text-slate-700 mb-3">📦 オファー（複数選択可）
                        {newRule.offerNames.length > 0 && (
                          <span className="ml-2 text-emerald-600">({newRule.offerNames.length}件選択中)</span>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setNewRule({ ...newRule, offerNames: [] })}
                          className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                            newRule.offerNames.length === 0
                              ? "bg-emerald-500 text-white" 
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          全オファー
                        </button>
                        {(newRule.projectName !== "全案件" && projectOffers[newRule.projectName]
                          ? projectOffers[newRule.projectName]
                          : offers
                        ).map((offer) => (
                          <button
                            key={offer}
                            onClick={() => {
                              const isSelected = newRule.offerNames.includes(offer);
                              setNewRule({
                                ...newRule,
                                offerNames: isSelected
                                  ? newRule.offerNames.filter(o => o !== offer)
                                  : [...newRule.offerNames, offer]
                              });
                            }}
                            className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                              newRule.offerNames.includes(offer)
                                ? "bg-emerald-500 text-white" 
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                            }`}
                          >
                            {offer}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* 媒体選択（複数選択可） */}
                    <div className="mb-6">
                      <p className="text-sm font-medium text-slate-700 mb-3">📱 媒体（複数選択可）
                        {newRule.mediaFilters.length > 0 && (
                          <span className="ml-2 text-blue-600">({newRule.mediaFilters.length}件選択中)</span>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setNewRule({ ...newRule, mediaFilters: [] })}
                          className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                            newRule.mediaFilters.length === 0
                              ? "bg-blue-500 text-white" 
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          全媒体
                        </button>
                        {mediaList.map((media) => (
                          <button
                            key={media}
                            onClick={() => {
                              const isSelected = newRule.mediaFilters.includes(media);
                              setNewRule({
                                ...newRule,
                                mediaFilters: isSelected
                                  ? newRule.mediaFilters.filter(m => m !== media)
                                  : [...newRule.mediaFilters, media]
                              });
                            }}
                            className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                              newRule.mediaFilters.includes(media)
                                ? "bg-blue-500 text-white" 
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                            }`}
                          >
                            {media}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex justify-between">
                      <Button variant="secondary" onClick={() => setStep(2)}>← 戻る</Button>
                      <Button onClick={() => setStep(4)} className="bg-emerald-600 hover:bg-emerald-700">
                        次へ →
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* ステップ4: 条件設定 */}
                {step === 4 && (
                  <div>
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <AlertTriangle className="h-6 w-6 text-emerald-500" />停止条件を設定
                    </h3>
                    <div className="text-sm text-slate-500 mb-6 flex flex-wrap items-center gap-1">
                      <span className="font-bold text-purple-600">{newRule.memberName}</span>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                      <span className="font-bold text-amber-600">{newRule.projectName}</span>
                      {newRule.offerNames.length > 0 && (
                        <>
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                          <span className="font-bold text-teal-600">
                            {newRule.offerNames.length === 1 ? newRule.offerNames[0] : `${newRule.offerNames.length}オファー`}
                          </span>
                        </>
                      )}
                      {newRule.mediaFilters.length > 0 && (
                        <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                          {newRule.mediaFilters.length === 1 ? newRule.mediaFilters[0] : `${newRule.mediaFilters.length}媒体`}
                        </span>
                      )}
                    </div>
                    
                    {/* プリセットテンプレート */}
                    <div className="mb-6">
                      <p className="text-sm font-medium text-slate-700 mb-3">📋 よく使うルール（クリックで適用）</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setNewRule({ ...newRule, conditions: { ...newRule.conditions, profitMax: -5000, spendMin: undefined, mcvMax: undefined, cvMax: undefined, cvMin: undefined, roasMax: undefined, consecutiveLossMin: undefined } })}
                          className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded-full hover:bg-red-200 transition-colors"
                        >
                          利益 -5,000円以下
                        </button>
                        <button
                          onClick={() => setNewRule({ ...newRule, conditions: { ...newRule.conditions, profitMax: -10000, spendMin: undefined, mcvMax: undefined, cvMax: undefined, cvMin: undefined, roasMax: undefined, consecutiveLossMin: undefined } })}
                          className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded-full hover:bg-red-200 transition-colors"
                        >
                          利益 -10,000円以下
                        </button>
                        <button
                          onClick={() => setNewRule({ ...newRule, conditions: { ...newRule.conditions, profitMax: -20000, spendMin: undefined, mcvMax: undefined, cvMax: undefined, cvMin: undefined, roasMax: undefined, consecutiveLossMin: undefined } })}
                          className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded-full hover:bg-red-200 transition-colors"
                        >
                          利益 -20,000円以下
                        </button>
                        <button
                          onClick={() => setNewRule({ ...newRule, conditions: { ...newRule.conditions, spendMin: 5000, mcvMax: 0, profitMax: undefined, cvMax: undefined, cvMin: undefined, roasMax: undefined, consecutiveLossMin: undefined } })}
                          className="px-3 py-1.5 text-xs bg-amber-100 text-amber-700 rounded-full hover:bg-amber-200 transition-colors"
                        >
                          消化5,000円以上 & MCV0
                        </button>
                        <button
                          onClick={() => setNewRule({ ...newRule, conditions: { ...newRule.conditions, spendMin: 3000, cvMax: 0, profitMax: undefined, mcvMax: undefined, cvMin: undefined, roasMax: undefined, consecutiveLossMin: undefined } })}
                          className="px-3 py-1.5 text-xs bg-amber-100 text-amber-700 rounded-full hover:bg-amber-200 transition-colors"
                        >
                          消化3,000円以上 & CV0
                        </button>
                        <button
                          onClick={() => setNewRule({ ...newRule, conditions: { ...newRule.conditions, consecutiveLossMin: 3, profitMax: undefined, spendMin: undefined, mcvMax: undefined, cvMax: undefined, cvMin: undefined, roasMax: undefined } })}
                          className="px-3 py-1.5 text-xs bg-orange-100 text-orange-700 rounded-full hover:bg-orange-200 transition-colors"
                        >
                          3日連続赤字
                        </button>
                        <button
                          onClick={() => setNewRule({ ...newRule, conditions: { ...newRule.conditions, roasMax: 100, profitMax: undefined, spendMin: undefined, mcvMax: undefined, cvMax: undefined, cvMin: undefined, consecutiveLossMin: undefined } })}
                          className="px-3 py-1.5 text-xs bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 transition-colors"
                        >
                          ROAS 100%以下
                        </button>
                      </div>
                    </div>
                    
                    <div className="bg-slate-50 rounded-xl p-6 mb-6">
                      <p className="text-sm text-slate-600 mb-4">💡 以下の条件を<strong>すべて満たす</strong>CPNを自動停止します</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-lg border">
                          <label className="block text-sm font-medium text-slate-700 mb-2">💰 消化金額（以上）</label>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500">¥</span>
                            <input type="number" value={newRule.conditions.spendMin || ""} onChange={(e) => setNewRule({ ...newRule, conditions: { ...newRule.conditions, spendMin: e.target.value ? Number(e.target.value) : undefined } })} placeholder="例: 2400" className="flex-1 px-3 py-2 border rounded-lg" />
                          </div>
                        </div>
                        
                        <div className="bg-white p-4 rounded-lg border">
                          <label className="block text-sm font-medium text-slate-700 mb-2">📊 MCV（以下）</label>
                          <input type="number" value={newRule.conditions.mcvMax ?? ""} onChange={(e) => setNewRule({ ...newRule, conditions: { ...newRule.conditions, mcvMax: e.target.value !== "" ? Number(e.target.value) : undefined } })} placeholder="例: 0" className="w-full px-3 py-2 border rounded-lg" />
                        </div>
                        
                        <div className="bg-white p-4 rounded-lg border">
                          <label className="block text-sm font-medium text-slate-700 mb-2">🎯 CV（以下）</label>
                          <input type="number" value={newRule.conditions.cvMax ?? ""} onChange={(e) => setNewRule({ ...newRule, conditions: { ...newRule.conditions, cvMax: e.target.value !== "" ? Number(e.target.value) : undefined } })} placeholder="例: 0" className="w-full px-3 py-2 border rounded-lg" />
                        </div>
                        
                        <div className="bg-white p-4 rounded-lg border">
                          <label className="block text-sm font-medium text-slate-700 mb-2">🎯 CV（以上）</label>
                          <input type="number" value={newRule.conditions.cvMin ?? ""} onChange={(e) => setNewRule({ ...newRule, conditions: { ...newRule.conditions, cvMin: e.target.value !== "" ? Number(e.target.value) : undefined } })} placeholder="例: 1" className="w-full px-3 py-2 border rounded-lg" />
                        </div>
                        
                        <div className="bg-white p-4 rounded-lg border">
                          <label className="block text-sm font-medium text-slate-700 mb-2">📈 ROAS（以下）</label>
                          <div className="flex items-center gap-2">
                            <input type="number" value={newRule.conditions.roasMax ?? ""} onChange={(e) => setNewRule({ ...newRule, conditions: { ...newRule.conditions, roasMax: e.target.value !== "" ? Number(e.target.value) : undefined } })} placeholder="例: 130" className="flex-1 px-3 py-2 border rounded-lg" />
                            <span className="text-slate-500">%</span>
                          </div>
                        </div>
                        
                        <div className="bg-white p-4 rounded-lg border">
                          <label className="block text-sm font-medium text-slate-700 mb-2">💸 利益（以下）</label>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500">¥</span>
                            <input type="number" value={newRule.conditions.profitMax ?? ""} onChange={(e) => setNewRule({ ...newRule, conditions: { ...newRule.conditions, profitMax: e.target.value !== "" ? Number(e.target.value) : undefined } })} placeholder="例: -23000" className="flex-1 px-3 py-2 border rounded-lg" />
                          </div>
                        </div>
                        
                        <div className="bg-white p-4 rounded-lg border">
                          <label className="block text-sm font-medium text-slate-700 mb-2">📅 連続赤字日数（以上）</label>
                          <div className="flex items-center gap-2">
                            <input type="number" value={newRule.conditions.consecutiveLossMin ?? ""} onChange={(e) => setNewRule({ ...newRule, conditions: { ...newRule.conditions, consecutiveLossMin: e.target.value !== "" ? Number(e.target.value) : undefined } })} placeholder="例: 3" className="flex-1 px-3 py-2 border rounded-lg" />
                            <span className="text-slate-500">日</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between">
                      <Button variant="secondary" onClick={() => setStep(3)}>← 戻る</Button>
                      <div className="flex gap-2">
                        <Button variant="secondary" onClick={resetNewRule}><X className="h-4 w-4 mr-1" />キャンセル</Button>
                        <Button onClick={saveRule} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">
                          {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                          {isSaving ? "保存中..." : "ルールを保存"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          
          {/* ルール一覧 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />設定済みルール（優先度順）
              </h2>
              <p className="text-sm text-slate-500">↑↓ で優先度を変更</p>
            </div>
            
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
              </div>
            ) : rules.length === 0 ? (
              <Card className="p-8 text-center">
                <AlertTriangle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">まだルールがありません</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {rules.map((rule, idx) => (
                  <Card key={rule.id} className={`border-2 ${rule.isActive ? "border-emerald-200" : "border-slate-200 opacity-60"}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        {/* 優先度表示と上下ボタン */}
                        <div className="flex flex-col items-center gap-1">
                          <button onClick={() => movePriority(rule.id, "up")} disabled={idx === 0} className={`p-1 rounded ${idx === 0 ? "text-slate-300" : "text-slate-500 hover:bg-slate-100"}`}>
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <span className="text-xs font-bold text-slate-400 w-6 text-center">{idx + 1}</span>
                          <button onClick={() => movePriority(rule.id, "down")} disabled={idx === rules.length - 1} className={`p-1 rounded ${idx === rules.length - 1 ? "text-slate-300" : "text-slate-500 hover:bg-slate-100"}`}>
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </div>
                        
                        {/* ON/OFFスイッチ */}
                        <button onClick={() => toggleRule(rule.id, rule.isActive)} className={`w-12 h-6 rounded-full transition-colors ${rule.isActive ? "bg-emerald-500" : "bg-slate-300"}`}>
                          <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${rule.isActive ? "translate-x-6" : "translate-x-0.5"}`}></div>
                        </button>
                        
                        {/* ルール情報 */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 text-sm mb-1">
                            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">{rule.memberName}</span>
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">{rule.projectName}</span>
                          </div>
                          <p className="text-sm text-slate-600">{formatConditions(rule.conditions)}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            <User className="h-3 w-3 inline mr-1" />{rule.createdBy} が作成 • {formatDateTime(rule.createdAt)}
                          </p>
                        </div>
                        
                        {/* 削除ボタン */}
                        <button onClick={() => deleteRule(rule.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="h-5 w-5" /></button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      
      {/* 停止履歴タブ */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <History className="h-5 w-5 text-blue-500" />停止履歴
          </h2>
          
          {history.length === 0 ? (
            <Card className="p-8 text-center">
              <History className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">まだ停止履歴がありません</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {history.map((h) => (
                <Card key={h.id} className="border">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            h.status === "stopped" ? "bg-red-100 text-red-700" :
                            h.status === "error" ? "bg-yellow-100 text-yellow-700" :
                            "bg-slate-100 text-slate-700"
                          }`}>
                            {h.status === "stopped" ? "停止済み" : h.status === "error" ? "エラー" : h.status}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            h.media === "FB" ? "bg-blue-100 text-blue-700" :
                            h.media === "TikTok" ? "bg-slate-800 text-white" :
                            "bg-cyan-100 text-cyan-700"
                          }`}>{h.media}</span>
                        </div>
                        
                        <p className="font-medium text-sm text-slate-800 break-all mb-2">{h.cpnName}</p>
                        
                        <div className="text-xs text-slate-500 space-y-2">
                          <p><span className="font-medium">適用ルール:</span> {h.ruleName}</p>
                          <p><span className="font-medium">対象:</span> {h.memberName} / {h.projectName}</p>
                          
                          {/* マッチした条件を表示 */}
                          {h.conditions?.matched_descriptions && h.conditions.matched_descriptions.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-2 mt-2">
                              <p className="font-medium text-red-700 mb-1">📌 停止理由（該当した条件）:</p>
                              <ul className="list-disc list-inside text-red-600 space-y-0.5">
                                {h.conditions.matched_descriptions.map((desc, idx) => (
                                  <li key={idx}>{desc}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {h.metrics && (
                            <div className="flex flex-wrap gap-2 mt-1">
                              <span className="px-2 py-0.5 bg-slate-100 rounded">消化: ¥{h.metrics.spend?.toLocaleString() || 0}</span>
                              <span className="px-2 py-0.5 bg-slate-100 rounded">MCV: {h.metrics.mcv || 0}</span>
                              <span className="px-2 py-0.5 bg-slate-100 rounded">CV: {h.metrics.cv || 0}</span>
                              <span className={`px-2 py-0.5 rounded ${(h.metrics.profit || 0) >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                利益: ¥{h.metrics.profit?.toLocaleString() || 0}
                              </span>
                              <span className="px-2 py-0.5 bg-slate-100 rounded">ROAS: {h.metrics.roas?.toFixed(1) || 0}%</span>
                            </div>
                          )}
                          
                          {h.errorMessage && (
                            <p className="text-amber-600 mt-1">⚠️ エラー: {h.errorMessage}</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right text-sm">
                        <div className="flex items-center gap-1 text-slate-500">
                          <Clock className="h-4 w-4" />
                          {formatDateTime(h.stoppedAt)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
