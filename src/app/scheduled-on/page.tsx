"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { 
  Power, 
  Trash2, 
  Plus, 
  RefreshCw, 
  Clock, 
  CheckCircle, 
  XCircle,
  Calendar,
  ChevronDown,
  ChevronUp,
  Link,
  AlertTriangle,
  Facebook,
  Music2
} from "lucide-react";

interface ScheduledItem {
  id: string;
  cpn_name: string;
  media: string;
  campaign_id: string | null;
  advertiser_id: string | null;
  account_name: string | null;
  scheduled_at: string;
  status: string;
}

interface HistoryItem {
  id: string;
  executed_at: string;
  total_count: number;
  success_count: number;
  failed_count: number;
  details: {
    cpnName: string;
    media: string;
    success: boolean;
    error?: string;
  }[];
}

type MediaTab = "Meta" | "TikTok";

export default function ScheduledOnPage() {
  const [scheduled, setScheduled] = useState<Record<string, ScheduledItem[]>>({
    Meta: [],
    TikTok: [],
    Pangle: [],
  });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<MediaTab>("Meta");
  const [cpnInput, setCpnInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"schedule" | "history">("schedule");
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  // データ取得
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [scheduleRes, historyRes] = await Promise.all([
        fetch("/api/scheduled-on"),
        fetch("/api/scheduled-on?type=history"),
      ]);

      const scheduleData = await scheduleRes.json();
      const historyData = await historyRes.json();

      if (scheduleData.success) {
        setScheduled(scheduleData.scheduled);
      }
      if (historyData.success) {
        setHistory(historyData.history);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // TikTok + Pangle を結合したリスト
  const getTikTokPangleList = () => {
    return [...(scheduled.TikTok || []), ...(scheduled.Pangle || [])];
  };

  // 予約登録
  const handleSubmit = async () => {
    if (!cpnInput.trim()) {
      setMessage({ type: "error", text: "CPN名を入力してください" });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      // TikTokを選択した場合、内部的にはTikTokとして登録
      const response = await fetch("/api/scheduled-on", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cpnNames: cpnInput,
          media: selectedMedia,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const mappedCount = data.addedCount - (data.unmappedCount || 0);
        let messageText = `${data.addedCount}件追加しました`;
        if (mappedCount > 0 && data.unmappedCount > 0) {
          messageText += ` (ID紐付け: ${mappedCount}件、未紐付け: ${data.unmappedCount}件)`;
        } else if (data.unmappedCount > 0) {
          messageText += ` (⚠️ ${data.unmappedCount}件はキャンペーンIDが見つかりませんでした)`;
        }
        if (data.duplicateCount > 0) {
          messageText += `、${data.duplicateCount}件重複スキップ`;
        }
        setMessage({ 
          type: data.unmappedCount > 0 ? "error" : "success", 
          text: messageText
        });
        setCpnInput("");
        fetchData();
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch {
      setMessage({ type: "error", text: "登録に失敗しました" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 個別削除
  const handleDelete = async (id: string) => {
    if (!confirm("この予約を削除しますか？")) return;
    
    try {
      const response = await fetch(`/api/scheduled-on?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setMessage({ type: "success", text: "削除しました" });
        fetchData();
      }
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  // 媒体別一括削除
  const handleDeleteAll = async (mediaTab: MediaTab) => {
    const mediaLabel = mediaTab === "TikTok" ? "TikTok/Pangle" : "Meta";
    if (!confirm(`${mediaLabel}の予約を全て削除しますか？`)) return;

    try {
      if (mediaTab === "TikTok") {
        // TikTokとPangle両方削除
        await Promise.all([
          fetch(`/api/scheduled-on?all=true&media=TikTok`, { method: "DELETE" }),
          fetch(`/api/scheduled-on?all=true&media=Pangle`, { method: "DELETE" }),
        ]);
      } else {
        await fetch(`/api/scheduled-on?all=true&media=${mediaTab}`, { method: "DELETE" });
      }
      setMessage({ type: "success", text: `${mediaLabel}の予約を全て削除しました` });
      fetchData();
    } catch (error) {
      console.error("Delete all error:", error);
    }
  };

  // 翌日の日付を取得
  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // 媒体のカラー・アイコン
  const getMediaStyle = (media: string) => {
    switch (media) {
      case "Meta":
        return {
          bg: "bg-gradient-to-r from-blue-500 to-blue-600",
          icon: Facebook,
          label: "Meta (Facebook)",
        };
      case "TikTok":
      case "Pangle":
        return {
          bg: "bg-gradient-to-r from-slate-800 to-slate-900",
          icon: Music2,
          label: media === "Pangle" ? "Pangle" : "TikTok",
        };
      default:
        return {
          bg: "bg-slate-500",
          icon: Power,
          label: media,
        };
    }
  };

  // 媒体バッジ
  const MediaBadge = ({ media }: { media: string }) => {
    const style = getMediaStyle(media);
    const Icon = style.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-white ${style.bg}`}>
        <Icon className="h-3 w-3" />
        {style.label}
      </span>
    );
  };

  const metaCount = scheduled.Meta?.length || 0;
  const tiktokPangleCount = (scheduled.TikTok?.length || 0) + (scheduled.Pangle?.length || 0);
  const totalCount = metaCount + tiktokPangleCount;

  if (isLoading) {
    return (
      <>
        <Header title="翌日ON予約" description="翌日0:00に自動でONにするCPNを登録" />
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
          <span className="ml-3 text-slate-500">読み込み中...</span>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="翌日ON予約" description="翌日0:00に自動でONにするCPNを登録" />

      {/* タブ */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("schedule")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === "schedule"
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <Power className="h-4 w-4" />
          予約登録
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === "history"
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <Clock className="h-4 w-4" />
          実行履歴
        </button>
      </div>

      {activeTab === "schedule" ? (
        <div className="space-y-6">
          {/* 予約情報 */}
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="h-6 w-6" />
              <h2 className="text-xl font-bold">実行予定日: {getTomorrowDate()}</h2>
            </div>
            <p className="text-white/80 text-lg">
              🚀 0:00 JST に <span className="font-bold text-yellow-300">{totalCount}</span> 件のCPNが自動でONになります
            </p>
            <div className="mt-3 flex gap-4 text-sm">
              <span className="flex items-center gap-1">
                <Facebook className="h-4 w-4" /> Meta: {metaCount}件
              </span>
              <span className="flex items-center gap-1">
                <Music2 className="h-4 w-4" /> TikTok/Pangle: {tiktokPangleCount}件
              </span>
            </div>
          </div>

          {/* 入力フォーム */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2 text-lg">
              <Plus className="h-5 w-5 text-indigo-600" />
              CPN予約登録
            </h3>

            {/* メッセージ */}
            {message && (
              <div
                className={`mb-4 p-4 rounded-lg text-sm flex items-center gap-2 ${
                  message.type === "success"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}
              >
                {message.type === "success" ? (
                  <CheckCircle className="h-5 w-5 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                )}
                {message.text}
              </div>
            )}

            {/* 媒体選択 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                媒体を選択
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedMedia("Meta")}
                  className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                    selectedMedia === "Meta"
                      ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <Facebook className="h-5 w-5" />
                  Meta
                </button>
                <button
                  onClick={() => setSelectedMedia("TikTok")}
                  className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                    selectedMedia === "TikTok"
                      ? "bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-md"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <Music2 className="h-5 w-5" />
                  TikTok / Pangle
                </button>
              </div>
            </div>

            {/* CPN入力 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                CPN名（1行に1つ、コピペで一括登録可能）
              </label>
              <textarea
                value={cpnInput}
                onChange={(e) => setCpnInput(e.target.value)}
                placeholder={`CPN名を入力...\n\n例:\n新規グロース部_悠太_案件A_TikTok_001\n新規グロース部_悠太_案件B_TikTok_002`}
                rows={6}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
              />
            </div>

            {/* 登録ボタン */}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md ${
                selectedMedia === "Meta"
                  ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700"
                  : "bg-gradient-to-r from-slate-800 to-slate-900 text-white hover:from-slate-900 hover:to-black"
              }`}
            >
              {isSubmitting ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                <Plus className="h-5 w-5" />
              )}
              {selectedMedia === "Meta" ? "Meta" : "TikTok/Pangle"}に登録
            </button>
          </div>

          {/* 媒体別予約一覧 - 2カラム */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Meta */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-5 py-4 flex items-center justify-between">
                <h3 className="font-bold text-white text-lg flex items-center gap-2">
                  <Facebook className="h-5 w-5" />
                  Meta ({metaCount}件)
                </h3>
                {metaCount > 0 && (
                  <button
                    onClick={() => handleDeleteAll("Meta")}
                    className="px-3 py-1.5 text-white/90 hover:text-white bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center gap-1 text-sm"
                    title="全て削除"
                  >
                    <Trash2 className="h-4 w-4" />
                    全削除
                  </button>
                )}
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                {scheduled.Meta?.length > 0 ? (
                  <ul className="divide-y divide-slate-100">
                    {scheduled.Meta.map((item) => (
                      <li
                        key={item.id}
                        className="px-5 py-4 hover:bg-blue-50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-800 break-all text-base">
                              {item.cpn_name}
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-xs">
                              {item.campaign_id ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full">
                                  <Link className="h-3 w-3" />
                                  ID紐付け済
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                                  <AlertTriangle className="h-3 w-3" />
                                  ID未紐付け
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                            title="削除"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-5 py-12 text-center text-slate-400">
                    <Facebook className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>予約なし</p>
                  </div>
                )}
              </div>
            </div>

            {/* TikTok / Pangle */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-4 flex items-center justify-between">
                <h3 className="font-bold text-white text-lg flex items-center gap-2">
                  <Music2 className="h-5 w-5" />
                  TikTok / Pangle ({tiktokPangleCount}件)
                </h3>
                {tiktokPangleCount > 0 && (
                  <button
                    onClick={() => handleDeleteAll("TikTok")}
                    className="px-3 py-1.5 text-white/90 hover:text-white bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center gap-1 text-sm"
                    title="全て削除"
                  >
                    <Trash2 className="h-4 w-4" />
                    全削除
                  </button>
                )}
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                {tiktokPangleCount > 0 ? (
                  <ul className="divide-y divide-slate-100">
                    {getTikTokPangleList().map((item) => (
                      <li
                        key={item.id}
                        className="px-5 py-4 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-800 break-all text-base">
                              {item.cpn_name}
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-xs flex-wrap">
                              <MediaBadge media={item.media} />
                              {item.campaign_id ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full">
                                  <Link className="h-3 w-3" />
                                  ID紐付け済
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                                  <AlertTriangle className="h-3 w-3" />
                                  ID未紐付け
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                            title="削除"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-5 py-12 text-center text-slate-400">
                    <Music2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>予約なし</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* 実行履歴タブ */
        <div className="space-y-4">
          {history.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>実行履歴がありません</p>
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm"
              >
                <button
                  onClick={() =>
                    setExpandedHistory(expandedHistory === item.id ? null : item.id)
                  }
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-slate-400" />
                      <span className="font-medium text-slate-900">
                        {new Date(item.executed_at).toLocaleDateString("ja-JP", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-green-600 font-medium">
                        <CheckCircle className="h-4 w-4" />
                        {item.success_count}件成功
                      </span>
                      {item.failed_count > 0 && (
                        <span className="flex items-center gap-1 text-red-600 font-medium">
                          <XCircle className="h-4 w-4" />
                          {item.failed_count}件失敗
                        </span>
                      )}
                    </div>
                  </div>
                  {expandedHistory === item.id ? (
                    <ChevronUp className="h-5 w-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                  )}
                </button>
                {expandedHistory === item.id && (
                  <div className="border-t border-slate-200 px-5 py-4 bg-slate-50">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-500">
                          <th className="pb-3 font-medium">CPN名</th>
                          <th className="pb-3 font-medium">媒体</th>
                          <th className="pb-3 font-medium">結果</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.details.map((detail, idx) => (
                          <tr key={idx} className="border-t border-slate-200">
                            <td className="py-3 text-slate-700 break-all">{detail.cpnName}</td>
                            <td className="py-3">
                              <MediaBadge media={detail.media} />
                            </td>
                            <td className="py-3">
                              {detail.success ? (
                                <span className="text-green-600 flex items-center gap-1 font-medium">
                                  <CheckCircle className="h-4 w-4" />
                                  成功
                                </span>
                              ) : (
                                <span className="text-red-600 flex items-center gap-1 font-medium">
                                  <XCircle className="h-4 w-4" />
                                  {detail.error || "失敗"}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </>
  );
}
