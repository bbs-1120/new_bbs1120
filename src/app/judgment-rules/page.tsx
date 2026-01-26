"use client";

import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Plus, Trash2, Save, AlertCircle, CheckCircle, Settings, ArrowLeft, History, RefreshCw } from "lucide-react";
import Link from "next/link";

interface RuleCondition {
  field: string;
  operator: string;
  value: number | string | boolean;
}

interface JudgmentRule {
  id: string;
  rule_type: "stop" | "replace" | "continue";
  rule_name: string;
  priority: number;
  conditions: RuleCondition[];
  is_active: boolean;
}

interface LogEntry {
  id: string;
  executed_at: string;
  executed_by: string;
  action_type: string;
  target_count: number;
  rule_version: string;
  status: string;
  error_message: string | null;
}

const FIELD_OPTIONS = [
  { value: "profit7Days", label: "7日間利益" },
  { value: "roas7Days", label: "7日間ROAS (%)" },
  { value: "todayProfit", label: "当日利益" },
  { value: "consecutiveLoss", label: "連続赤字日数" },
  { value: "isRe", label: "_Reあり" },
  { value: "media", label: "媒体" },
];

const OPERATOR_OPTIONS = [
  { value: "<", label: "より小さい (<)" },
  { value: "<=", label: "以下 (<=)" },
  { value: ">", label: "より大きい (>)" },
  { value: ">=", label: "以上 (>=)" },
  { value: "==", label: "等しい (==)" },
  { value: "!=", label: "等しくない (!=)" },
  { value: "contains", label: "含む" },
];

const RULE_TYPE_OPTIONS = [
  { value: "stop", label: "停止", color: "bg-red-100 text-red-700 border-red-200" },
  { value: "replace", label: "作り替え", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "continue", label: "継続", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
];

export default function JudgmentRulesPage() {
  const [rules, setRules] = useState<JudgmentRule[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editingRule, setEditingRule] = useState<JudgmentRule | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  // 新規ルールのテンプレート
  const createNewRule = (): JudgmentRule => ({
    id: "",
    rule_type: "stop",
    rule_name: "",
    priority: 0,
    conditions: [{ field: "profit7Days", operator: "<=", value: -30000 }],
    is_active: true,
  });

  // ログを取得
  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/judgment-rules/logs?limit=20");
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    }
  };

  // ルールを取得
  useEffect(() => {
    const fetchRules = async () => {
      try {
        const res = await fetch("/api/judgment-rules");
        const data = await res.json();
        if (data.success) {
          setRules(data.rules);
        }
      } catch (error) {
        console.error("Failed to fetch rules:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRules();
    fetchLogs();
  }, []);

  // ルールを保存
  const saveRule = async (rule: JudgmentRule) => {
    setIsSaving(true);
    try {
      const isNew = !rule.id;
      const res = await fetch("/api/judgment-rules", {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rule),
      });
      const data = await res.json();
      
      if (data.success) {
        if (isNew) {
          setRules([...rules, data.rule]);
        } else {
          setRules(rules.map(r => r.id === rule.id ? data.rule : r));
        }
        setMessage({ type: "success", text: "ルールを保存しました" });
        setEditingRule(null);
        setShowAddModal(false);
        fetchLogs(); // ログを再取得
      } else {
        setMessage({ type: "error", text: data.error || "保存に失敗しました" });
      }
    } catch {
      setMessage({ type: "error", text: "保存に失敗しました" });
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  // ルールを削除
  const deleteRule = async (id: string) => {
    if (!confirm("このルールを削除しますか？")) return;
    
    try {
      const res = await fetch(`/api/judgment-rules?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      
      if (data.success) {
        setRules(rules.filter(r => r.id !== id));
        setMessage({ type: "success", text: "ルールを削除しました" });
        fetchLogs(); // ログを再取得
      } else {
        setMessage({ type: "error", text: data.error || "削除に失敗しました" });
      }
    } catch {
      setMessage({ type: "error", text: "削除に失敗しました" });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  // 条件を追加
  const addCondition = (rule: JudgmentRule) => {
    const newCondition: RuleCondition = { field: "profit7Days", operator: "<=", value: 0 };
    setEditingRule({
      ...rule,
      conditions: [...rule.conditions, newCondition],
    });
  };

  // 条件を削除
  const removeCondition = (rule: JudgmentRule, index: number) => {
    if (rule.conditions.length <= 1) return;
    setEditingRule({
      ...rule,
      conditions: rule.conditions.filter((_, i) => i !== index),
    });
  };

  // 条件を更新
  const updateCondition = (rule: JudgmentRule, index: number, field: keyof RuleCondition, value: string | number | boolean) => {
    const newConditions = [...rule.conditions];
    newConditions[index] = { ...newConditions[index], [field]: value };
    setEditingRule({ ...rule, conditions: newConditions });
  };

  const getRuleTypeColor = (type: string) => {
    return RULE_TYPE_OPTIONS.find(o => o.value === type)?.color || "bg-slate-100 text-slate-700";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header title="判定ルール設定" subtitle="カスタム判定条件の管理" />
        <main className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-slate-200 rounded-xl" />
            <div className="h-32 bg-slate-200 rounded-xl" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="判定ルール設定" subtitle="カスタム判定条件の管理" />
      
      <main className="container mx-auto px-4 py-6">
        {/* 戻るリンク */}
        <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4">
          <ArrowLeft className="h-4 w-4" />
          設定に戻る
        </Link>

        {/* メッセージ */}
        {message && (
          <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
            message.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}>
            {message.type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {message.text}
          </div>
        )}

        {/* 説明 */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Settings className="h-5 w-5 text-emerald-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-slate-800 mb-1">カスタム判定ルールについて</h3>
                <p className="text-sm text-slate-600">
                  ここで設定したルールは、あなたのCPNにのみ適用されます。
                  複数の条件を組み合わせて、独自の判定ロジックを作成できます。
                  ルールは優先度順に評価され、最初にマッチしたルールが適用されます。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ルール一覧 */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">設定済みルール</h2>
          <Button onClick={() => { setEditingRule(createNewRule()); setShowAddModal(true); }}>
            <Plus className="h-4 w-4 mr-1" />
            新規ルール
          </Button>
        </div>

        {rules.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-slate-500 mb-4">まだルールが設定されていません</p>
              <Button onClick={() => { setEditingRule(createNewRule()); setShowAddModal(true); }}>
                <Plus className="h-4 w-4 mr-1" />
                最初のルールを作成
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <Card key={rule.id} className={!rule.is_active ? "opacity-50" : ""}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getRuleTypeColor(rule.rule_type)}`}>
                          {RULE_TYPE_OPTIONS.find(o => o.value === rule.rule_type)?.label}
                        </span>
                        <span className="font-medium text-slate-800">{rule.rule_name}</span>
                        {!rule.is_active && (
                          <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-500">無効</span>
                        )}
                        <span className="text-xs text-slate-400">優先度: {rule.priority}</span>
                      </div>
                      <div className="text-sm text-slate-600">
                        <span className="font-medium">条件:</span>
                        {rule.conditions.map((cond, i) => (
                          <span key={i} className="ml-2">
                            {i > 0 && <span className="text-slate-400 mx-1">AND</span>}
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">
                              {FIELD_OPTIONS.find(f => f.value === cond.field)?.label} {cond.operator} {String(cond.value)}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingRule(rule)}
                      >
                        編集
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteRule(rule.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 編集モーダル */}
        {(editingRule || showAddModal) && editingRule && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-lg max-h-[90vh] overflow-auto">
              <CardHeader>
                <CardTitle>{editingRule.id ? "ルールを編集" : "新規ルール作成"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* ルール名 */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">ルール名</label>
                  <input
                    type="text"
                    value={editingRule.rule_name}
                    onChange={(e) => setEditingRule({ ...editingRule, rule_name: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="例: 7日赤字3万超で停止"
                  />
                </div>

                {/* ルールタイプ */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">判定結果</label>
                  <div className="flex gap-2">
                    {RULE_TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setEditingRule({ ...editingRule, rule_type: opt.value as "stop" | "replace" | "continue" })}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          editingRule.rule_type === opt.value ? opt.color : "bg-slate-50 text-slate-500 border-slate-200"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 優先度 */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">優先度 (高い順に適用)</label>
                  <input
                    type="number"
                    value={editingRule.priority}
                    onChange={(e) => setEditingRule({ ...editingRule, priority: parseInt(e.target.value) || 0 })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                {/* 条件 */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">条件 (すべて満たす場合に適用)</label>
                  <div className="space-y-2">
                    {editingRule.conditions.map((cond, index) => (
                      <div key={index} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg">
                        <select
                          value={cond.field}
                          onChange={(e) => updateCondition(editingRule, index, "field", e.target.value)}
                          className="border rounded px-2 py-1 text-sm flex-1"
                        >
                          {FIELD_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <select
                          value={cond.operator}
                          onChange={(e) => updateCondition(editingRule, index, "operator", e.target.value)}
                          className="border rounded px-2 py-1 text-sm"
                        >
                          {OPERATOR_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <input
                          type={cond.field === "isRe" ? "checkbox" : "text"}
                          value={cond.field === "isRe" ? undefined : String(cond.value)}
                          checked={cond.field === "isRe" ? Boolean(cond.value) : undefined}
                          onChange={(e) => {
                            if (cond.field === "isRe") {
                              updateCondition(editingRule, index, "value", e.target.checked);
                            } else {
                              const numVal = parseFloat(e.target.value);
                              updateCondition(editingRule, index, "value", isNaN(numVal) ? e.target.value : numVal);
                            }
                          }}
                          className="border rounded px-2 py-1 text-sm w-24"
                        />
                        {editingRule.conditions.length > 1 && (
                          <button
                            onClick={() => removeCondition(editingRule, index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addCondition(editingRule)}
                    className="mt-2"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    条件を追加
                  </Button>
                </div>

                {/* 有効/無効 */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={editingRule.is_active}
                    onChange={(e) => setEditingRule({ ...editingRule, is_active: e.target.checked })}
                    className="rounded"
                  />
                  <label htmlFor="is_active" className="text-sm text-slate-700">このルールを有効にする</label>
                </div>

                {/* ボタン */}
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => { setEditingRule(null); setShowAddModal(false); }}
                    className="flex-1"
                  >
                    キャンセル
                  </Button>
                  <Button
                    onClick={() => saveRule(editingRule)}
                    disabled={isSaving || !editingRule.rule_name}
                    className="flex-1"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    {isSaving ? "保存中..." : "保存"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 操作履歴セクション */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <History className="h-5 w-5" />
              操作履歴
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { fetchLogs(); setShowLogs(!showLogs); }}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              {showLogs ? "非表示" : "表示"}
            </Button>
          </div>

          {showLogs && (
            <Card>
              <CardContent className="py-4">
                {logs.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">操作履歴はまだありません</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {logs.map((log) => (
                      <div key={log.id} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
                        <div className={`w-2 h-2 rounded-full mt-1.5 ${
                          log.action_type === "judgment_refresh" ? "bg-blue-500" :
                          log.action_type === "rule_create" ? "bg-emerald-500" :
                          log.action_type === "rule_update" ? "bg-amber-500" :
                          log.action_type === "rule_delete" ? "bg-red-500" : "bg-slate-500"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-slate-800">
                              {log.action_type === "judgment_refresh" ? "判定更新" :
                               log.action_type === "rule_create" ? "ルール作成" :
                               log.action_type === "rule_update" ? "ルール更新" :
                               log.action_type === "rule_delete" ? "ルール削除" : log.action_type}
                            </span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-500">{log.executed_by}</span>
                          </div>
                          {log.error_message && (
                            <p className="text-xs text-slate-600 mt-0.5">{log.error_message}</p>
                          )}
                          <p className="text-xs text-slate-400 mt-0.5">
                            {new Date(log.executed_at).toLocaleString("ja-JP")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
