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
  ChevronUp
} from "lucide-react";

interface ScheduledItem {
  id: string;
  cpn_name: string;
  media: string;
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

export default function ScheduledOnPage() {
  const [scheduled, setScheduled] = useState<Record<string, ScheduledItem[]>>({
    Meta: [],
    TikTok: [],
    Pangle: [],
  });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<string>("Meta");
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

  // 予約登録
  const handleSubmit = async () => {
    if (!cpnInput.trim()) {
      setMessage({ type: "error", text: "CPN名を入力してください" });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
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
        setMessage({ 
          type: "success", 
          text: `${data.addedCount}件追加しました${data.duplicateCount > 0 ? `（${data.duplicateCount}件重複）` : ""}` 
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
    try {
      const response = await fetch(`/api/scheduled-on?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  // 媒体別一括削除
  const handleDeleteAll = async (media: string) => {
    if (!confirm(`${media}の予約を全て削除しますか？`)) return;

    try {
      const response = await fetch(`/api/scheduled-on?all=true&media=${media}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchData();
      }
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

  // 媒体のカラー
  const getMediaColor = (media: string) => {
    switch (media) {
      case "Meta":
        return "bg-blue-500";
      case "TikTok":
        return "bg-slate-900";
      case "Pangle":
        return "bg-orange-500";
      default:
        return "bg-slate-500";
    }
  };

  const totalCount = Object.values(scheduled).reduce((acc, arr) => acc + arr.length, 0);

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
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === "schedule"
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <Power className="inline-block h-4 w-4 mr-2" />
          予約登録
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === "history"
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <Clock className="inline-block h-4 w-4 mr-2" />
          実行履歴
        </button>
      </div>

      {activeTab === "schedule" ? (
        <div className="space-y-6">
          {/* 予約情報 */}
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="h-6 w-6" />
              <h2 className="text-lg font-bold">実行予定日: {getTomorrowDate()}</h2>
            </div>
            <p className="text-white/80">
              0:00 JST に {totalCount} 件のCPNが自動でONになります
            </p>
          </div>

          {/* 入力フォーム */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Plus className="h-5 w-5 text-indigo-600" />
              CPN予約登録
            </h3>

            {/* メッセージ */}
            {message && (
              <div
                className={`mb-4 p-3 rounded-lg text-sm ${
                  message.type === "success"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {message.text}
              </div>
            )}

            {/* 媒体選択 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                媒体を選択
              </label>
              <div className="flex gap-2">
                {["Meta", "TikTok", "Pangle"].map((media) => (
                  <button
                    key={media}
                    onClick={() => setSelectedMedia(media)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      selectedMedia === media
                        ? `${getMediaColor(media)} text-white`
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {media}
                  </button>
                ))}
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
                placeholder={`CPN名を入力...\n例:\n新規グロース部_悠太_案件A_TikTok_001\n新規グロース部_悠太_案件B_TikTok_002`}
                rows={8}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
              />
            </div>

            {/* 登録ボタン */}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                <Plus className="h-5 w-5" />
              )}
              {selectedMedia}に登録
            </button>
          </div>

          {/* 媒体別予約一覧 */}
          <div className="grid gap-4 lg:grid-cols-3">
            {(["Meta", "TikTok", "Pangle"] as const).map((media) => (
              <div
                key={media}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden"
              >
                <div className={`${getMediaColor(media)} px-4 py-3 flex items-center justify-between`}>
                  <h3 className="font-bold text-white">
                    {media} ({scheduled[media]?.length || 0}件)
                  </h3>
                  {scheduled[media]?.length > 0 && (
                    <button
                      onClick={() => handleDeleteAll(media)}
                      className="p-1 text-white/80 hover:text-white hover:bg-white/20 rounded transition-colors"
                      title="全て削除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {scheduled[media]?.length > 0 ? (
                    <ul className="divide-y divide-slate-100">
                      {scheduled[media].map((item) => (
                        <li
                          key={item.id}
                          className="px-4 py-2 flex items-center justify-between hover:bg-slate-50"
                        >
                          <span className="text-sm text-slate-700 truncate flex-1 mr-2">
                            {item.cpn_name}
                          </span>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="px-4 py-8 text-center text-slate-400">
                      予約なし
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* 実行履歴タブ */
        <div className="space-y-4">
          {history.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
              実行履歴がありません
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden"
              >
                <button
                  onClick={() =>
                    setExpandedHistory(expandedHistory === item.id ? null : item.id)
                  }
                  className="w-full px-4 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
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
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        {item.success_count}件成功
                      </span>
                      {item.failed_count > 0 && (
                        <span className="flex items-center gap-1 text-red-600">
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
                  <div className="border-t border-slate-200 px-4 py-3 bg-slate-50">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-500">
                          <th className="pb-2">CPN名</th>
                          <th className="pb-2">媒体</th>
                          <th className="pb-2">結果</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.details.map((detail, idx) => (
                          <tr key={idx} className="border-t border-slate-200">
                            <td className="py-2 text-slate-700">{detail.cpnName}</td>
                            <td className="py-2">
                              <span
                                className={`px-2 py-0.5 rounded text-xs text-white ${getMediaColor(detail.media)}`}
                              >
                                {detail.media}
                              </span>
                            </td>
                            <td className="py-2">
                              {detail.success ? (
                                <span className="text-green-600 flex items-center gap-1">
                                  <CheckCircle className="h-4 w-4" />
                                  成功
                                </span>
                              ) : (
                                <span className="text-red-600 flex items-center gap-1">
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

