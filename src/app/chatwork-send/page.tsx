"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Send, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Eye, 
  CheckCircle, 
  XCircle,
  Loader2,
  Copy,
  MessageSquare
} from "lucide-react";

interface CpnItem {
  cpnKey: string;
  cpnName: string;
  media: string;
  profit: number;
  judgment: string;
  selected: boolean;
}

interface SendListItem {
  cpnName: string;
  media: string;
  profit: number;
}

export default function ChatworkSendPage() {
  const [allCpns, setAllCpns] = useState<CpnItem[]>([]);
  const [sendList, setSendList] = useState<SendListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [previewMessage, setPreviewMessage] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<string>("all");
  const [judgmentFilter, setJudgmentFilter] = useState<string>("continue");
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // データ取得
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/judgment?refresh=true");
      const data = await response.json();
      
      if (data.success && data.results) {
        const cpns: CpnItem[] = data.results.map((r: {
          cpnKey: string;
          cpnName: string;
          media: string;
          profit: number;
          judgment: string;
        }) => ({
          cpnKey: r.cpnKey,
          cpnName: r.cpnName,
          media: r.media,
          profit: r.profit,
          judgment: r.judgment,
          selected: false,
        }));
        setAllCpns(cpns);
        
        // デフォルトで「継続」CPNを送信リストに追加（YouTubeは除外）
        const continueCpns = cpns.filter(c => c.judgment === "continue" && c.media !== "YouTube");
        setSendList(continueCpns.map(c => ({
          cpnName: c.cpnName,
          media: c.media,
          profit: c.profit,
        })));
      }
    } catch (error) {
      console.error("データ取得エラー:", error);
      setMessage({ type: "error", text: "データの取得に失敗しました" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 送信リストに追加
  const addToSendList = (cpn: CpnItem) => {
    if (sendList.some(item => item.cpnName === cpn.cpnName)) {
      setMessage({ type: "error", text: "既に送信リストに含まれています" });
      return;
    }
    setSendList([...sendList, {
      cpnName: cpn.cpnName,
      media: cpn.media,
      profit: cpn.profit,
    }]);
    setMessage({ type: "success", text: `${cpn.cpnName.substring(0, 30)}... を追加しました` });
  };

  // 送信リストから削除
  const removeFromSendList = (cpnName: string) => {
    setSendList(sendList.filter(item => item.cpnName !== cpnName));
  };

  // 送信リストをクリア
  const clearSendList = () => {
    setSendList([]);
    setMessage({ type: "success", text: "送信リストをクリアしました" });
  };

  // プレビュー生成
  const generatePreview = () => {
    if (sendList.length === 0) {
      setMessage({ type: "error", text: "送信リストが空です" });
      return;
    }

    // 媒体別にグループ化
    const mediaGroups: Record<string, SendListItem[]> = {};
    for (const item of sendList) {
      const media = item.media === "Meta" ? "FB" : item.media;
      if (!mediaGroups[media]) {
        mediaGroups[media] = [];
      }
      mediaGroups[media].push(item);
    }

    // メッセージ生成
    let message = "";
    for (const [media, items] of Object.entries(mediaGroups)) {
      message += `[To:9952259]自動送信犬さん\n`;
      message += `媒体：${media}\n`;
      message += `処理：追加\n`;
      message += `CP名：\n`;
      items.forEach(item => {
        message += `${item.cpnName}\n`;
      });
      message += "\n";
    }

    setPreviewMessage(message);
    setShowPreview(true);
  };

  // Chatworkに送信
  const sendToChatwork = async () => {
    if (sendList.length === 0) {
      setMessage({ type: "error", text: "送信リストが空です" });
      return;
    }

    setSending(true);
    try {
      const response = await fetch("/api/chatwork-send-custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpns: sendList }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessage({ type: "success", text: `Chatworkに送信しました（${data.sentCount}媒体）` });
        setShowPreview(false);
      } else {
        setMessage({ type: "error", text: data.error || "送信に失敗しました" });
      }
    } catch (error) {
      console.error("送信エラー:", error);
      setMessage({ type: "error", text: "送信に失敗しました" });
    } finally {
      setSending(false);
    }
  };

  // フィルタリング
  const filteredCpns = allCpns.filter(cpn => {
    if (mediaFilter !== "all" && cpn.media !== mediaFilter) return false;
    if (judgmentFilter !== "all" && cpn.judgment !== judgmentFilter) return false;
    if (searchTerm && !cpn.cpnName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  // 媒体一覧
  const mediaOptions = ["all", ...new Set(allCpns.map(c => c.media))];
  
  // 判定一覧
  const judgmentOptions = [
    { value: "all", label: "全て" },
    { value: "continue", label: "継続" },
    { value: "stop", label: "停止" },
    { value: "replace", label: "作り替え" },
  ];

  const getJudgmentColor = (judgment: string) => {
    switch (judgment) {
      case "continue": return "bg-green-100 text-green-800";
      case "stop": return "bg-red-100 text-red-800";
      case "replace": return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getJudgmentLabel = (judgment: string) => {
    switch (judgment) {
      case "continue": return "継続";
      case "stop": return "停止";
      case "replace": return "作り替え";
      default: return judgment;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        <span className="ml-2 text-gray-600">読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <MessageSquare className="w-7 h-7 text-emerald-500" />
            Chatwork送信管理
          </h1>
          <p className="text-gray-500 mt-1">送信するCPNを選択・編集してChatworkに送信</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
        >
          <RefreshCw className="w-4 h-4" />
          更新
        </button>
      </div>

      {/* メッセージ */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${
          message.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
        }`}>
          {message.type === "success" ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-auto">×</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左側: CPN一覧 */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">CPN一覧</h2>
          
          {/* フィルター */}
          <div className="flex flex-wrap gap-3 mb-4">
            <select
              value={mediaFilter}
              onChange={(e) => setMediaFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              {mediaOptions.map(m => (
                <option key={m} value={m}>{m === "all" ? "全媒体" : m}</option>
              ))}
            </select>
            <select
              value={judgmentFilter}
              onChange={(e) => setJudgmentFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              {judgmentOptions.map(j => (
                <option key={j.value} value={j.value}>{j.label}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="CPN名で検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-lg text-sm"
            />
          </div>

          {/* CPN一覧 */}
          <div className="max-h-[500px] overflow-y-auto space-y-2">
            {filteredCpns.length === 0 ? (
              <p className="text-gray-500 text-center py-8">該当するCPNがありません</p>
            ) : (
              filteredCpns.map((cpn) => {
                const isInSendList = sendList.some(item => item.cpnName === cpn.cpnName);
                return (
                  <div
                    key={cpn.cpnKey}
                    className={`p-3 border rounded-lg flex items-center gap-3 ${
                      isInSendList ? "bg-emerald-50 border-emerald-200" : "bg-white hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{cpn.cpnName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">{cpn.media}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${getJudgmentColor(cpn.judgment)}`}>
                          {getJudgmentLabel(cpn.judgment)}
                        </span>
                        <span className={`text-xs ${cpn.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                          ¥{Math.round(cpn.profit).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => isInSendList ? removeFromSendList(cpn.cpnName) : addToSendList(cpn)}
                      className={`p-2 rounded-lg transition ${
                        isInSendList 
                          ? "bg-red-100 text-red-600 hover:bg-red-200" 
                          : "bg-emerald-100 text-emerald-600 hover:bg-emerald-200"
                      }`}
                      title={isInSendList ? "削除" : "追加"}
                    >
                      {isInSendList ? <Trash2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 右側: 送信リスト */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">送信リスト ({sendList.length}件)</h2>
            <button
              onClick={clearSendList}
              className="text-sm text-red-600 hover:text-red-800"
            >
              クリア
            </button>
          </div>

          {/* 送信リスト */}
          <div className="max-h-[350px] overflow-y-auto space-y-2 mb-4">
            {sendList.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                左のリストからCPNを追加してください
              </p>
            ) : (
              sendList.map((item, index) => (
                <div
                  key={index}
                  className="p-3 border rounded-lg flex items-center gap-3 bg-emerald-50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.cpnName}</p>
                    <span className="text-xs text-gray-500">{item.media}</span>
                  </div>
                  <button
                    onClick={() => removeFromSendList(item.cpnName)}
                    className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* アクションボタン */}
          <div className="flex gap-3">
            <button
              onClick={generatePreview}
              disabled={sendList.length === 0}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Eye className="w-5 h-5" />
              プレビュー
            </button>
            <button
              onClick={sendToChatwork}
              disabled={sendList.length === 0 || sending}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              送信
            </button>
          </div>
        </div>
      </div>

      {/* プレビューモーダル */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">送信プレビュー</h3>
              <button onClick={() => setShowPreview(false)} className="text-gray-500 hover:text-gray-700">
                ×
              </button>
            </div>
            <div className="p-4 max-h-[50vh] overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded-lg">
                {previewMessage}
              </pre>
            </div>
            <div className="p-4 border-t flex gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(previewMessage);
                  setMessage({ type: "success", text: "コピーしました" });
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                <Copy className="w-4 h-4" />
                コピー
              </button>
              <button
                onClick={sendToChatwork}
                disabled={sending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg disabled:opacity-50"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Chatworkに送信
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

