"use client";

import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useMemo } from "react";
import { Send, Eye, CheckCircle, Copy, RefreshCw, AlertCircle, Plus, Trash2, X, Minus } from "lucide-react";

interface CpnResult {
  cpnKey: string;
  cpnName: string;
  media: string;
  judgment: string;
  profit: number;
  profit7Days: number;
  roas7Days: number;
  reasons: string[];
}

const JUDGMENT_OVERRIDE_KEY = "judgment_overrides";

interface JudgmentOverride {
  cpnKey: string;
  originalJudgment: string;
  newJudgment: string;
  timestamp: number;
  memo?: string;
}

function getJudgmentOverrides(): JudgmentOverride[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(JUDGMENT_OVERRIDE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.filter((o: JudgmentOverride) => {
        const overrideDate = new Date(new Date(o.timestamp).toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
        const expiryDate = new Date(overrideDate);
        expiryDate.setHours(23, 59, 59, 999);
        const nowJst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
        return nowJst <= expiryDate;
      });
    }
  } catch {}
  return [];
}

// 媒体アイコンコンポーネント
function MediaIcon({ media, className = "w-5 h-5" }: { media: string; className?: string }) {
  if (media === "FB") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    );
  }
  if (media === "TikTok") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
      </svg>
    );
  }
  if (media === "LINE") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
      </svg>
    );
  }
  return null;
}

export default function SendDeletePage() {
  const [allCpns, setAllCpns] = useState<CpnResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendingMedia, setSendingMedia] = useState<string | null>(null);
  const [sentMedia, setSentMedia] = useState<Set<string>>(new Set());
  const [copiedMedia, setCopiedMedia] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState<string | null>(null);
  
  const [showAddModal, setShowAddModal] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [removedCpns, setRemovedCpns] = useState<Set<string>>(new Set());
  const [addedCpns, setAddedCpns] = useState<CpnResult[]>([]);
  const [judgmentOverrides, setJudgmentOverrides] = useState<JudgmentOverride[]>([]);
  const [overriddenCpns, setOverriddenCpns] = useState<CpnResult[]>([]);

  const fetchData = async () => {
    const overrides = getJudgmentOverrides();
    setJudgmentOverrides(overrides);
    
    try {
      setLoading(true);
      setError(null);
      
      const allResponse = await fetch("/api/judgment?refresh=true");
      const allData = await allResponse.json();
      
      if (allData.success) {
        const allCpnList = allData.results.filter((r: CpnResult) => r.media !== "YouTube");
        setAllCpns(allCpnList);
        
        const newContinueCpns = allCpnList.filter((r: CpnResult) => {
          const override = overrides.find(o => o.cpnKey === r.cpnKey);
          return override && override.newJudgment === "継続" && r.judgment !== "継続";
        });
        setOverriddenCpns(newContinueCpns);
      } else {
        setError(allData.error || "データの取得に失敗しました");
      }
      
      setRemovedCpns(new Set());
      setAddedCpns([]);
      setSentMedia(new Set());
    } catch (err) {
      setError("データの取得に失敗しました");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const continueCpns = useMemo(() => {
    return allCpns.filter((r: CpnResult) => {
      const override = judgmentOverrides.find(o => o.cpnKey === r.cpnKey);
      if (override) {
        return override.newJudgment === "継続";
      }
      return r.judgment === "継続";
    });
  }, [allCpns, judgmentOverrides]);

  const currentResults = useMemo(() => {
    const filtered = continueCpns.filter(r => !removedCpns.has(r.cpnKey));
    return [...filtered, ...addedCpns];
  }, [continueCpns, removedCpns, addedCpns]);

  const groupByMedia = (cpns: CpnResult[]) => {
    const groups: Record<string, CpnResult[]> = {};
    for (const r of cpns) {
      if (r.media === "YouTube") continue;
      let mediaKey = r.media;
      if (r.media === "Pangle") mediaKey = "TikTok";
      else if (r.media === "Meta") mediaKey = "FB";
      if (!groups[mediaKey]) groups[mediaKey] = [];
      groups[mediaKey].push(r);
    }
    return groups;
  };

  const mediaGroups = useMemo(() => groupByMedia(currentResults), [currentResults]);

  const availableCpns = useMemo(() => {
    const currentKeys = new Set(currentResults.map(r => r.cpnKey));
    return allCpns.filter(cpn => {
      if (currentKeys.has(cpn.cpnKey)) return false;
      if (cpn.media === "YouTube") return false;
      if (searchTerm && !cpn.cpnName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (showAddModal) {
        const cpnMedia = cpn.media === "Meta" ? "FB" : (cpn.media === "Pangle" ? "TikTok" : cpn.media);
        if (cpnMedia !== showAddModal) return false;
      }
      return true;
    });
  }, [allCpns, currentResults, searchTerm, showAddModal]);

  const handleRemoveCpn = (cpnKey: string) => {
    if (addedCpns.some(c => c.cpnKey === cpnKey)) {
      setAddedCpns(addedCpns.filter(c => c.cpnKey !== cpnKey));
    } else {
      setRemovedCpns(new Set([...removedCpns, cpnKey]));
    }
  };

  const handleAddCpn = (cpn: CpnResult) => {
    if (removedCpns.has(cpn.cpnKey)) {
      const newRemoved = new Set(removedCpns);
      newRemoved.delete(cpn.cpnKey);
      setRemovedCpns(newRemoved);
    } else {
      setAddedCpns([...addedCpns, cpn]);
    }
  };

  const generateMessage = (media: string, cpns: CpnResult[]) => {
    let message = `[To:9952259]自動送信犬さん\n`;
    message += `媒体：${media}\n`;
    message += `処理：削除\n`;
    message += `CP名：\n\n`;
    message += cpns.map(c => c.cpnName).join("\n");
    return message;
  };

  const handleCopy = async (media: string, message: string) => {
    try {
      await navigator.clipboard.writeText(message);
      setCopiedMedia(media);
      setTimeout(() => setCopiedMedia(null), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const handleSend = async (media: string, message: string) => {
    try {
      setIsSending(true);
      setSendingMedia(media);
      
      const response = await fetch("/api/chatwork/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSentMedia(prev => new Set(prev).add(media));
      } else {
        alert(`送信エラー: ${data.error}`);
      }
    } catch (err) {
      alert("送信に失敗しました");
      console.error(err);
    } finally {
      setIsSending(false);
      setSendingMedia(null);
    }
  };

  const getMediaStyle = (media: string) => {
    switch (media) {
      case "FB": return "from-blue-500 to-blue-600";
      case "TikTok": return "from-pink-500 to-rose-500";
      case "LINE": return "from-green-500 to-green-600";
      default: return "from-slate-500 to-slate-600";
    }
  };

  const getMediaBgStyle = (media: string) => {
    switch (media) {
      case "FB": return "bg-blue-50 border-blue-200";
      case "TikTok": return "bg-pink-50 border-pink-200";
      case "LINE": return "bg-green-50 border-green-200";
      default: return "bg-slate-50 border-slate-200";
    }
  };

  const getMediaTextColor = (media: string) => {
    switch (media) {
      case "FB": return "text-blue-600";
      case "TikTok": return "text-pink-600";
      case "LINE": return "text-green-600";
      default: return "text-slate-600";
    }
  };

  if (loading) {
    return (
      <>
        <Header title="削除用送信" description="CPNを媒体別に削除通知" />
        <Card className="max-w-4xl mx-auto">
          <CardContent className="py-12 text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600">データを読み込み中...</p>
          </CardContent>
        </Card>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header title="削除用送信" description="CPNを媒体別に削除通知" />
        <Card className="max-w-4xl mx-auto">
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={() => fetchData()}>再読み込み</Button>
          </CardContent>
        </Card>
      </>
    );
  }

  const mediaList = Object.entries(mediaGroups).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <>
      <Header title="削除用送信" description="CPNを媒体別に削除通知" />

      <div className="max-w-4xl mx-auto space-y-6">
        {overriddenCpns.length > 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm font-medium text-amber-800">
              📋 CPN診断で「継続」に変更されたCPN: {overriddenCpns.length}件
            </p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-500">
            {(removedCpns.size > 0 || addedCpns.length > 0) && (
              <span className="text-amber-600">
                ※ 編集中（除外: {removedCpns.size}件、追加: {addedCpns.length}件）
              </span>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={() => fetchData()} disabled={loading}>
            <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            最新データを取得
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {mediaList.map(([media, cpns]) => (
            <Card key={media} className={`${getMediaBgStyle(media)} border`}>
              <CardContent className="py-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <MediaIcon media={media} className={`w-5 h-5 ${getMediaTextColor(media)}`} />
                </div>
                <div className={`text-2xl font-bold bg-gradient-to-r ${getMediaStyle(media)} bg-clip-text text-transparent`}>
                  {cpns.length}
                </div>
                <div className="text-sm text-slate-600">{media}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {mediaList.map(([media, cpns]) => {
          const message = generateMessage(media, cpns);
          const isSent = sentMedia.has(media);
          const isCopied = copiedMedia === media;
          const isCurrentlySending = sendingMedia === media;
          
          return (
            <Card key={media} className="overflow-hidden">
              <CardHeader className={`bg-gradient-to-r ${getMediaStyle(media)} text-white`}>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Minus className="h-5 w-5" />
                    <MediaIcon media={media} className="w-5 h-5" />
                    {media}
                    <span className="text-sm font-normal opacity-90">（{cpns.length}件）</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setShowAddModal(media); setSearchTerm(""); }}
                      className="flex items-center gap-1 text-sm font-normal bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition"
                    >
                      <Plus className="h-4 w-4" />
                      追加
                    </button>
                    {isSent && (
                      <span className="flex items-center gap-1 text-sm font-normal bg-white/20 px-2 py-1 rounded">
                        <CheckCircle className="h-4 w-4" />
                        送信済み
                      </span>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              
              <CardContent className="p-0">
                <div className="max-h-48 overflow-y-auto border-b border-slate-200">
                  <table className="w-full">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">#</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">CPN名</th>
                        {media === "TikTok" && (
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">種別</th>
                        )}
                        <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 w-16">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cpns.map((cpn, idx) => {
                        const isAdded = addedCpns.some(c => c.cpnKey === cpn.cpnKey);
                        const isFromOverride = overriddenCpns.some(c => c.cpnKey === cpn.cpnKey);
                        return (
                          <tr key={cpn.cpnKey} className={`hover:bg-slate-50 ${isAdded ? "bg-blue-50" : ""} ${isFromOverride ? "bg-amber-50" : ""}`}>
                            <td className="px-4 py-2 text-sm text-slate-400">{idx + 1}</td>
                            <td className="px-4 py-2 text-sm text-slate-700 break-all">
                              {cpn.cpnName}
                              {isAdded && <span className="ml-2 text-xs text-blue-600 font-medium">追加</span>}
                              {isFromOverride && <span className="ml-2 text-xs text-amber-600 font-medium">診断から移動</span>}
                            </td>
                            {media === "TikTok" && (
                              <td className="px-4 py-2">
                                <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                                  cpn.media === "Pangle" ? "bg-orange-100 text-orange-700" : "bg-pink-100 text-pink-700"
                                }`}>
                                  {cpn.media}
                                </span>
                              </td>
                            )}
                            <td className="px-4 py-2 text-center">
                              <button onClick={() => handleRemoveCpn(cpn.cpnKey)} className="p-1 text-red-500 hover:bg-red-100 rounded transition" title="リストから除外">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {showPreview === media && (
                  <div className="p-4 bg-slate-900">
                    <pre className="text-slate-100 text-sm whitespace-pre-wrap font-mono">{message}</pre>
                  </div>
                )}

                <div className="p-4 flex gap-3 flex-wrap">
                  <Button variant="secondary" size="sm" onClick={() => setShowPreview(showPreview === media ? null : media)}>
                    <Eye className="mr-1 h-4 w-4" />
                    {showPreview === media ? "閉じる" : "プレビュー"}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => handleCopy(media, message)}>
                    <Copy className="mr-1 h-4 w-4" />
                    {isCopied ? "コピー済み!" : "コピー"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSend(media, message)}
                    disabled={isSending || isSent || cpns.length === 0}
                    loading={isCurrentlySending}
                    className={isSent ? "bg-green-500 hover:bg-green-500" : ""}
                  >
                    {isSent ? (
                      <><CheckCircle className="mr-1 h-4 w-4" />送信完了</>
                    ) : (
                      <><Send className="mr-1 h-4 w-4" />Chatworkに送信</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {mediaList.length > 0 && (
          <Card className="bg-gradient-to-r from-slate-700 to-slate-800">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div className="text-white">
                  <div className="font-semibold flex items-center gap-2">
                    <Minus className="h-5 w-5" />
                    全ての媒体をまとめて削除送信
                  </div>
                  <div className="text-sm text-slate-300">
                    {mediaList.length}媒体、合計{currentResults.length}件のCPNを送信
                  </div>
                </div>
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={async () => {
                    for (const [media, cpns] of mediaList) {
                      if (!sentMedia.has(media) && cpns.length > 0) {
                        const message = generateMessage(media, cpns);
                        await handleSend(media, message);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                      }
                    }
                  }}
                  disabled={isSending || mediaList.every(([media]) => sentMedia.has(media))}
                >
                  <Send className="mr-2 h-5 w-5" />
                  {mediaList.every(([media]) => sentMedia.has(media)) ? "全て送信済み" : "全て送信"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {mediaList.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-slate-500">削除対象のCPNがありません</p>
            </CardContent>
          </Card>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className={`p-4 border-b flex items-center justify-between bg-gradient-to-r ${getMediaStyle(showAddModal)} text-white`}>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <MediaIcon media={showAddModal} className="w-5 h-5" />
                {showAddModal} のCPNを削除リストに追加
              </h3>
              <button onClick={() => setShowAddModal(null)} className="p-2 hover:bg-white/20 rounded-lg transition">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 border-b">
              <input
                type="text"
                placeholder="CPN名で検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="max-h-[50vh] overflow-y-auto">
              {availableCpns.length === 0 ? (
                <div className="p-8 text-center text-slate-500">追加可能なCPNがありません</div>
              ) : (
                <div className="divide-y">
                  {availableCpns.slice(0, 50).map((cpn) => (
                    <div key={cpn.cpnKey} className="p-4 hover:bg-slate-50 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{cpn.cpnName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-500">{cpn.media}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            cpn.judgment === "継続" ? "bg-green-100 text-green-700" :
                            cpn.judgment === "停止" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                          }`}>{cpn.judgment}</span>
                        </div>
                      </div>
                      <button onClick={() => handleAddCpn(cpn)} className={`flex items-center gap-1 px-3 py-2 text-white rounded-lg text-sm transition bg-gradient-to-r ${getMediaStyle(showAddModal)}`}>
                        <Plus className="h-4 w-4" />追加
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t bg-slate-50 flex justify-end">
              <Button onClick={() => setShowAddModal(null)}>閉じる</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
