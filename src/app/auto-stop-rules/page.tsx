"use client";

import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback } from "react";
import { 
  Users, Briefcase, Plus, Trash2, ChevronRight, Save, X,
  AlertTriangle, History, GripVertical, Clock, User,
  UserCheck, Building2, Zap, ChevronUp, ChevronDown
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
  conditions: Record<string, number>;
  metrics: Record<string, number>;
  stoppedAt: string;
  status: string;
}

export default function AutoStopRulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [history, setHistory] = useState<StopHistory[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"rules" | "history">("rules");
  
  // 新規ルール作成用
  const [newRule, setNewRule] = useState({
    memberName: "",
    projectName: "",
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
    try {
      const res = await fetch("/api/auto-stop-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRule),
      });
      if (res.ok) {
        await fetchData();
        resetNewRule();
      }
    } catch (error) {
      console.error("Failed to save rule:", error);
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
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold ${step >= 1 ? "bg-emerald-500 text-white" : "bg-slate-200"}`}>1</div>
                  <div className={`w-16 h-1 ${step >= 2 ? "bg-emerald-500" : "bg-slate-200"}`}></div>
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold ${step >= 2 ? "bg-emerald-500 text-white" : "bg-slate-200"}`}>2</div>
                  <div className={`w-16 h-1 ${step >= 3 ? "bg-emerald-500" : "bg-slate-200"}`}></div>
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold ${step >= 3 ? "bg-emerald-500 text-white" : "bg-slate-200"}`}>3</div>
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
                        onClick={() => { setNewRule({ ...newRule, projectName: "全案件" }); setStep(3); }}
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
                
                {/* ステップ3: 条件設定 */}
                {step === 3 && (
                  <div>
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <AlertTriangle className="h-6 w-6 text-emerald-500" />停止条件を設定
                    </h3>
                    <div className="text-sm text-slate-500 mb-6">
                      <span className="font-bold text-purple-600">{newRule.memberName}</span> の 
                      <span className="font-bold text-amber-600 ml-1">{newRule.projectName}</span> に適用
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
                      <Button variant="secondary" onClick={() => setStep(2)}>← 戻る</Button>
                      <div className="flex gap-2">
                        <Button variant="secondary" onClick={resetNewRule}><X className="h-4 w-4 mr-1" />キャンセル</Button>
                        <Button onClick={saveRule} className="bg-emerald-600 hover:bg-emerald-700"><Save className="h-4 w-4 mr-1" />ルールを保存</Button>
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
                        
                        <p className="font-medium text-sm text-slate-800 break-all mb-1">{h.cpnName}</p>
                        
                        <div className="text-xs text-slate-500 space-y-1">
                          <p><span className="font-medium">適用ルール:</span> {h.ruleName}</p>
                          <p><span className="font-medium">対象:</span> {h.memberName} / {h.projectName}</p>
                          {h.metrics && (
                            <p>
                              <span className="font-medium">停止時の数値:</span> 
                              消化¥{h.metrics.spend?.toLocaleString() || 0} / 
                              利益¥{h.metrics.profit?.toLocaleString() || 0} / 
                              ROAS {h.metrics.roas?.toFixed(1) || 0}%
                            </p>
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
