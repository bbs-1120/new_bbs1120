"use client";

import { useState, useEffect } from "react";
import { StickyNote, Edit2, X, Check, Trash2 } from "lucide-react";

interface CpnMemoProps {
  cpnKey: string;
  cpnName: string;
  compact?: boolean;
}

const STORAGE_KEY = "cpn_memos";

// メモを取得
export function getMemos(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

// メモを保存
function saveMemos(memos: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memos));
}

// メモを取得（個別）
export function getMemo(cpnKey: string): string | null {
  const memos = getMemos();
  return memos[cpnKey] || null;
}

// メモを設定
export function setMemo(cpnKey: string, memo: string) {
  const memos = getMemos();
  if (memo.trim()) {
    memos[cpnKey] = memo.trim();
  } else {
    delete memos[cpnKey];
  }
  saveMemos(memos);
}

export function CpnMemo({ cpnKey, cpnName, compact = false }: CpnMemoProps) {
  const [memo, setMemoState] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    const saved = getMemo(cpnKey);
    if (saved) {
      setMemoState(saved);
      setInputValue(saved);
    }
  }, [cpnKey]);

  const handleSave = () => {
    setMemo(cpnKey, inputValue);
    setMemoState(inputValue);
    setIsEditing(false);
  };

  const handleDelete = () => {
    setMemo(cpnKey, "");
    setMemoState("");
    setInputValue("");
    setIsEditing(false);
  };

  const handleCancel = () => {
    setInputValue(memo);
    setIsEditing(false);
  };

  // コンパクトモード（テーブル内での表示）
  if (compact) {
    if (isEditing) {
      return (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="メモ..."
            className="w-24 px-1.5 py-0.5 text-xs border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
          />
          <button onClick={handleSave} className="p-0.5 text-green-600 hover:bg-green-50 rounded">
            <Check className="h-3 w-3" />
          </button>
          <button onClick={handleCancel} className="p-0.5 text-slate-400 hover:bg-slate-100 rounded">
            <X className="h-3 w-3" />
          </button>
        </div>
      );
    }

    if (memo) {
      return (
        <button
          onClick={() => setIsEditing(true)}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 transition-colors max-w-[100px] truncate"
          title={memo}
        >
          <StickyNote className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{memo}</span>
        </button>
      );
    }

    return (
      <button
        onClick={() => setIsEditing(true)}
        className="p-1 text-slate-300 hover:text-slate-500 hover:bg-slate-100 rounded transition-colors"
        title="メモを追加"
      >
        <StickyNote className="h-3.5 w-3.5" />
      </button>
    );
  }

  // 通常モード
  return (
    <div className="space-y-2">
      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="メモを入力..."
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            rows={2}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              保存
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              キャンセル
            </button>
            {memo && (
              <button
                onClick={handleDelete}
                className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-auto"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          onClick={() => setIsEditing(true)}
          className={`p-3 rounded-lg cursor-pointer transition-colors ${
            memo
              ? "bg-yellow-50 border border-yellow-200 hover:bg-yellow-100"
              : "bg-slate-50 border border-dashed border-slate-200 hover:bg-slate-100"
          }`}
        >
          {memo ? (
            <div className="flex items-start gap-2">
              <StickyNote className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{memo}</p>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400">
              <Edit2 className="h-4 w-4" />
              <span className="text-sm">メモを追加...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// メモ一覧表示コンポーネント
export function MemoList() {
  const [memos, setMemosState] = useState<Record<string, string>>({});

  useEffect(() => {
    setMemosState(getMemos());
  }, []);

  const entries = Object.entries(memos);

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <StickyNote className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>メモはありません</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map(([cpnKey, memo]) => (
        <div
          key={cpnKey}
          className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
        >
          <p className="text-xs text-slate-500 truncate mb-1">{cpnKey}</p>
          <p className="text-sm text-slate-700">{memo}</p>
        </div>
      ))}
    </div>
  );
}

