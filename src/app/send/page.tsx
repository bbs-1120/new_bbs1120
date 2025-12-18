"use client";

import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JudgmentBadge } from "@/components/ui/badge";
import { useState } from "react";
import { Send, Eye, CheckCircle } from "lucide-react";
import { formatDate } from "@/lib/utils";

// 送信対象のモックデータ
const mockSendTargets = [
  {
    id: "1",
    cpnName: "キャンペーンA",
    media: "Meta",
    judgment: "停止",
    todayProfit: -15000,
    profit7Days: -45000,
    roas7Days: 95,
    reasons: ["連続赤字(3日)", "ROAS基準未達(95%)"],
  },
  {
    id: "3",
    cpnName: "キャンペーンC",
    media: "YouTube",
    judgment: "作り替え",
    todayProfit: -5000,
    profit7Days: -28000,
    roas7Days: 102,
    reasons: ["連続赤字(4日)"],
  },
];

export default function SendPage() {
  const [isSending, setIsSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  const formatCurrency = (value: number) => {
    const sign = value < 0 ? "" : "+";
    return `${sign}¥${value.toLocaleString("ja-JP")}`;
  };

  const generateMessage = () => {
    const today = formatDate(new Date());
    const grouped = {
      stop: mockSendTargets.filter((t) => t.judgment === "停止"),
      replace: mockSendTargets.filter((t) => t.judgment === "作り替え"),
      continue: mockSendTargets.filter((t) => t.judgment === "継続"),
      check: mockSendTargets.filter((t) => t.judgment === "要確認"),
    };

    let message = `【本日のCPN仕分け】${today}\n\n`;

    if (grouped.stop.length > 0) {
      message += `■ 停止（Reあり）\n`;
      grouped.stop.forEach((t) => {
        message += `${t.cpnName}｜${formatCurrency(t.todayProfit)}｜${formatCurrency(t.profit7Days)}｜${t.roas7Days}%｜${t.reasons.join(", ")}\n`;
      });
      message += "\n";
    }

    if (grouped.replace.length > 0) {
      message += `■ 作り替え（Reなし）\n`;
      grouped.replace.forEach((t) => {
        message += `${t.cpnName}｜${formatCurrency(t.todayProfit)}｜${formatCurrency(t.profit7Days)}｜${t.roas7Days}%｜${t.reasons.join(", ")}\n`;
      });
      message += "\n";
    }

    message += `▼詳細\n管理画面URL`;

    return message;
  };

  const handleSend = async () => {
    setIsSending(true);
    // TODO: 実際のChatwork送信処理
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsSending(false);
    setSendSuccess(true);
  };

  if (sendSuccess) {
    return (
      <>
        <Header title="Chatwork送信" description="仕分け結果をChatworkに送信" />
        <Card className="max-w-2xl">
          <CardContent className="py-12 text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              送信完了
            </h2>
            <p className="text-slate-600 mb-6">
              Chatworkへメッセージを送信しました
            </p>
            <Button onClick={() => setSendSuccess(false)}>
              新しい送信を作成
            </Button>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <Header title="Chatwork送信" description="仕分け結果をChatworkに送信" />

      <div className="max-w-4xl space-y-6">
        {/* 送信対象一覧 */}
        <Card>
          <CardHeader>
            <CardTitle>送信対象CPN（{mockSendTargets.length}件）</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    CPN名
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    媒体
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    判定
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                    当日利益
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                    7日利益
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    理由
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {mockSendTargets.map((target) => (
                  <tr key={target.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      {target.cpnName}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {target.media}
                    </td>
                    <td className="px-4 py-3">
                      <JudgmentBadge judgment={target.judgment} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`text-sm font-medium ${
                          target.todayProfit >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {formatCurrency(target.todayProfit)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`text-sm font-medium ${
                          target.profit7Days >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {formatCurrency(target.profit7Days)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {target.reasons.map((reason, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* プレビュー */}
        {showPreview && (
          <Card>
            <CardHeader>
              <CardTitle>送信メッセージプレビュー</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="p-4 bg-slate-900 text-slate-100 rounded-lg text-sm whitespace-pre-wrap font-mono">
                {generateMessage()}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* アクションボタン */}
        <div className="flex gap-4">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => setShowPreview(!showPreview)}
          >
            <Eye className="mr-2 h-5 w-5" />
            {showPreview ? "プレビューを閉じる" : "プレビューを表示"}
          </Button>
          <Button
            size="lg"
            onClick={handleSend}
            loading={isSending}
            disabled={mockSendTargets.length === 0}
          >
            <Send className="mr-2 h-5 w-5" />
            Chatworkに送信
          </Button>
        </div>
      </div>
    </>
  );
}

