"use client";

import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useMemo } from "react";
import { Send, Eye, CheckCircle, Copy, RefreshCw, AlertCircle, Plus, Trash2, X } from "lucide-react";

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

const CACHE_KEY = "chatwork_send_data";
const CACHE_DURATION = 5 * 60 * 1000; // 5分

// ローカルキャッシュ
function getLocalCache(): { data: CpnResult[]; timestamp: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_DURATION) {
        return parsed;
      }
    }
  } catch {}
  return null;
}

function setLocalCache(data: CpnResult[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {}
}

export default function SendPage() {
  const [results, setResults] = useState<CpnResult[]>([]);
  const [allCpns, setAllCpns] = useState<CpnResult[]>([]); // 全CPN（追加用）
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendingMedia, setSendingMedia] = useState<string | null>(null);
  const [sentMedia, setSentMedia] = useState<Set<string>>(new Set());
  const [copiedMedia, setCopiedMedia] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  
  // 追加・削除用の状態
  const [showAddModal, setShowAddModal] = useState<string | null>(null); // 追加モーダル表示中の媒体
  const [searchTerm, setSearchTerm] = useState("");
  const [removedCpns, setRemovedCpns] = useState<Set<string>>(new Set()); // 削除されたCPN
  const [addedCpns, setAddedCpns] = useState<CpnResult[]>([]); // 追加されたCPN

  // データ取得
  const fetchData = async (forceRefresh = false) => {
    // キャッシュ確認（強制更新でない場合）
    if (!forceRefresh) {
      const cached = getLocalCache();
      if (cached) {
        // YouTubeを除外
        const filteredData = cached.data.filter(r => r.media !== "YouTube");
        setResults(filteredData);
        setLoading(false);
        setIsFromCache(true);
        return;
      }
    }
    
    try {
      setLoading(true);
      setError(null);
      setIsFromCache(false);
      
      // 継続CPNを取得
      const response = await fetch("/api/judgment?judgment=continue");
      const data = await response.json();
      
      // 全CPNを取得（追加用）
      const allResponse = await fetch("/api/judgment?refresh=true");
      const allData = await allResponse.json();
      
      if (data.success) {
        // YouTubeを除外
        const filteredResults = data.results.filter((r: CpnResult) => r.media !== "YouTube");
        setResults(filteredResults);
        setLocalCache(filteredResults);
      } else {
        setError(data.error || "データの取得に失敗しました");
      }
      
      if (allData.success) {
        // YouTubeを除外
        const filteredAll = allData.results.filter((r: CpnResult) => r.media !== "YouTube");
        setAllCpns(filteredAll);
      }
      
      // 追加・削除状態をリセット
      setRemovedCpns(new Set());
      setAddedCpns([]);
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

  // 現在の送信対象CPN（削除されたものを除き、追加されたものを含む）
  const currentResults = useMemo(() => {
    const filtered = results.filter(r => !removedCpns.has(r.cpnKey));
    return [...filtered, ...addedCpns];
  }, [results, removedCpns, addedCpns]);

  // 媒体別にグループ化（TikTokとPangleは統合、MetaはFBに変更、YouTube除外）
  const mediaGroups = useMemo(() => {
    const groups: Record<string, CpnResult[]> = {};
    
    for (const r of currentResults) {
      // YouTubeは除外
      if (r.media === "YouTube") continue;
      
      // TikTokとPangleを統合、MetaはFBに変更
      let mediaKey = r.media;
      if (r.media === "Pangle") {
        mediaKey = "TikTok";
      } else if (r.media === "Meta") {
        mediaKey = "FB";
      }
      
      if (!groups[mediaKey]) {
        groups[mediaKey] = [];
      }
      groups[mediaKey].push(r);
    }
    
    return groups;
  }, [currentResults]);

  // 追加可能なCPN（現在の送信対象に含まれていないもの）
  const availableCpns = useMemo(() => {
    const currentKeys = new Set(currentResults.map(r => r.cpnKey));
    return allCpns.filter(cpn => {
      if (currentKeys.has(cpn.cpnKey)) return false;
      if (cpn.media === "YouTube") return false;
      if (searchTerm && !cpn.cpnName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      
      // モーダルの媒体でフィルタ
      if (showAddModal) {
        const cpnMedia = cpn.media === "Meta" ? "FB" : (cpn.media === "Pangle" ? "TikTok" : cpn.media);
        if (cpnMedia !== showAddModal) return false;
      }
      
      return true;
    });
  }, [allCpns, currentResults, searchTerm, showAddModal]);

  // CPNを削除
  const handleRemoveCpn = (cpnKey: string) => {
    // 追加されたCPNから削除する場合
    if (addedCpns.some(c => c.cpnKey === cpnKey)) {
      setAddedCpns(addedCpns.filter(c => c.cpnKey !== cpnKey));
    } else {
      // 元のリストから削除する場合
      setRemovedCpns(new Set([...removedCpns, cpnKey]));
    }
  };

  // CPNを追加
  const handleAddCpn = (cpn: CpnResult) => {
    // 削除されていた場合は削除リストから戻す
    if (removedCpns.has(cpn.cpnKey)) {
      const newRemoved = new Set(removedCpns);
      newRemoved.delete(cpn.cpnKey);
      setRemovedCpns(newRemoved);
    } else {
      // 新規追加
      setAddedCpns([...addedCpns, cpn]);
    }
  };

  // 媒体別メッセージ生成
  const generateMessage = (media: string, cpns: CpnResult[]) => {
    let message = `[To:9952259]自動送信犬さん\n`;
    message += `媒体：${media}\n`;
    message += `処理：追加\n`;
    message += `CP名：\n\n`;
    message += cpns.map(c => c.cpnName).join("\n");
    return message;
  };

  // コピー機能
  const handleCopy = async (media: string, message: string) => {
    try {
      await navigator.clipboard.writeText(message);
      setCopiedMedia(media);
      setTimeout(() => setCopiedMedia(null), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  // Chatwork送信
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

  // 媒体のスタイル
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

  if (loading) {
    return (
      <>
        <Header title="Chatwork送信" description="継続CPNを媒体別に通知" />
        <Card className="max-w-4xl">
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
        <Header title="Chatwork送信" description="継続CPNを媒体別に通知" />
        <Card className="max-w-4xl">
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
      <Header title="Chatwork送信" description="継続CPNを媒体別に通知（追加・削除可能）" />

      <div className="max-w-4xl space-y-6">
        {/* 更新ボタン */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-500">
            {isFromCache && "キャッシュから読み込み"}
            {(removedCpns.size > 0 || addedCpns.length > 0) && (
              <span className="ml-2 text-amber-600">
                ※ 編集中（削除: {removedCpns.size}件、追加: {addedCpns.length}件）
              </span>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={loading}
          >
            <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            最新データを取得
          </Button>
        </div>

        {/* サマリー */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {mediaList.map(([media, cpns]) => (
            <Card key={media} className={`${getMediaBgStyle(media)} border`}>
              <CardContent className="py-4 text-center">
                <div className={`text-2xl font-bold bg-gradient-to-r ${getMediaStyle(media)} bg-clip-text text-transparent`}>
                  {cpns.length}
                </div>
                <div className="text-sm text-slate-600">{media}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 媒体別カード */}
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
                    {media}
                    <span className="text-sm font-normal opacity-90">
                      （{cpns.length}件）
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    {/* 追加ボタン */}
                    <button
                      onClick={() => {
                        setShowAddModal(media);
                        setSearchTerm("");
                      }}
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
                {/* CPN一覧（削除ボタン付き） */}
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
                        return (
                          <tr key={cpn.cpnKey} className={`hover:bg-slate-50 ${isAdded ? "bg-green-50" : ""}`}>
                            <td className="px-4 py-2 text-sm text-slate-400">{idx + 1}</td>
                            <td className="px-4 py-2 text-sm text-slate-700 break-all">
                              {cpn.cpnName}
                              {isAdded && (
                                <span className="ml-2 text-xs text-green-600 font-medium">追加</span>
                              )}
                            </td>
                            {media === "TikTok" && (
                              <td className="px-4 py-2">
                                <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                                  cpn.media === "Pangle" 
                                    ? "bg-orange-100 text-orange-700" 
                                    : "bg-pink-100 text-pink-700"
                                }`}>
                                  {cpn.media}
                                </span>
                              </td>
                            )}
                            <td className="px-4 py-2 text-center">
                              <button
                                onClick={() => handleRemoveCpn(cpn.cpnKey)}
                                className="p-1 text-red-500 hover:bg-red-100 rounded transition"
                                title="削除"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* プレビュー */}
                {showPreview === media && (
                  <div className="p-4 bg-slate-900">
                    <pre className="text-slate-100 text-sm whitespace-pre-wrap font-mono">
                      {message}
                    </pre>
                  </div>
                )}

                {/* アクションボタン */}
                <div className="p-4 flex gap-3 flex-wrap">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowPreview(showPreview === media ? null : media)}
                  >
                    <Eye className="mr-1 h-4 w-4" />
                    {showPreview === media ? "閉じる" : "プレビュー"}
                  </Button>
                  
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleCopy(media, message)}
                  >
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
                      <>
                        <CheckCircle className="mr-1 h-4 w-4" />
                        送信完了
                      </>
                    ) : (
                      <>
                        <Send className="mr-1 h-4 w-4" />
                        Chatworkに送信
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* 全件送信ボタン */}
        {mediaList.length > 0 && (
          <Card className="bg-gradient-to-r from-slate-800 to-slate-900">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div className="text-white">
                  <div className="font-semibold">全ての媒体をまとめて送信</div>
                  <div className="text-sm text-slate-300">
                    {mediaList.length}媒体、合計{currentResults.filter(r => r.media !== "YouTube").length}件のCPNを送信します
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
                        await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待機
                      }
                    }
                  }}
                  disabled={isSending || sentMedia.size === mediaList.length}
                >
                  <Send className="mr-2 h-5 w-5" />
                  {sentMedia.size === mediaList.length ? "全て送信済み" : "全て送信"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* データがない場合 */}
        {mediaList.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-slate-500">継続判定のCPNがありません</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 追加モーダル */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-slate-100 to-slate-200">
              <h3 className="font-semibold text-lg">
                {showAddModal} のCPNを追加
              </h3>
              <button
                onClick={() => setShowAddModal(null)}
                className="p-2 hover:bg-slate-300 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* 検索 */}
            <div className="p-4 border-b">
              <input
                type="text"
                placeholder="CPN名で検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            
            {/* CPN一覧 */}
            <div className="max-h-[50vh] overflow-y-auto">
              {availableCpns.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  追加可能なCPNがありません
                </div>
              ) : (
                <div className="divide-y">
                  {availableCpns.slice(0, 50).map((cpn) => (
                    <div
                      key={cpn.cpnKey}
                      className="p-4 hover:bg-slate-50 flex items-center justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{cpn.cpnName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-500">{cpn.media}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            cpn.judgment === "continue" ? "bg-green-100 text-green-700" :
                            cpn.judgment === "stop" ? "bg-red-100 text-red-700" :
                            "bg-yellow-100 text-yellow-700"
                          }`}>
                            {cpn.judgment === "continue" ? "継続" :
                             cpn.judgment === "stop" ? "停止" : "作り替え"}
                          </span>
                          <span className={`text-xs ${cpn.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                            ¥{Math.round(cpn.profit).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          handleAddCpn(cpn);
                        }}
                        className="flex items-center gap-1 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm transition"
                      >
                        <Plus className="h-4 w-4" />
                        追加
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* フッター */}
            <div className="p-4 border-t bg-slate-50 flex justify-end">
              <Button onClick={() => setShowAddModal(null)}>
                閉じる
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
