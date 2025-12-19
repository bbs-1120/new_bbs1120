"use client";

import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "dark-mode";

export function DarkModeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // ローカルストレージから初期状態を取得
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const darkMode = saved === "true";
      setIsDark(darkMode);
      if (darkMode) {
        document.documentElement.classList.add("dark");
      }
    } else {
      // システム設定を確認
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setIsDark(prefersDark);
      if (prefersDark) {
        document.documentElement.classList.add("dark");
      }
    }
  }, []);

  const toggleDarkMode = () => {
    const newValue = !isDark;
    setIsDark(newValue);
    localStorage.setItem(STORAGE_KEY, String(newValue));
    
    if (newValue) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // SSR時のフラッシュを防ぐ
  if (!mounted) {
    return (
      <button className="p-2 rounded-lg hover:bg-white/10 transition-colors">
        <div className="h-5 w-5" />
      </button>
    );
  }

  return (
    <button
      onClick={toggleDarkMode}
      className="p-2 rounded-lg hover:bg-white/10 transition-colors group relative"
      title={isDark ? "ライトモードに切り替え" : "ダークモードに切り替え"}
    >
      {isDark ? (
        <Sun className="h-5 w-5 text-yellow-300 group-hover:rotate-12 transition-transform" />
      ) : (
        <Moon className="h-5 w-5 text-white/70 group-hover:-rotate-12 transition-transform" />
      )}
      
      {/* ツールチップ */}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-gray-900 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
        {isDark ? "ライトモード" : "ダークモード"}
      </span>
    </button>
  );
}

// フルバージョン（設定画面用）
export function DarkModeSwitch() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const darkMode = saved === "true";
      setIsDark(darkMode);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setIsDark(prefersDark);
    }
  }, []);

  const toggleDarkMode = () => {
    const newValue = !isDark;
    setIsDark(newValue);
    localStorage.setItem(STORAGE_KEY, String(newValue));
    
    if (newValue) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="flex items-center gap-3">
        {isDark ? (
          <Moon className="h-5 w-5 text-indigo-500" />
        ) : (
          <Sun className="h-5 w-5 text-amber-500" />
        )}
        <div>
          <p className="font-medium text-gray-900 dark:text-white">ダークモード</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isDark ? "オン - 目に優しい暗い画面" : "オフ - 明るい画面"}
          </p>
        </div>
      </div>
      
      <button
        onClick={toggleDarkMode}
        className={`relative w-14 h-7 rounded-full transition-colors ${
          isDark ? "bg-indigo-600" : "bg-gray-300"
        }`}
      >
        <div
          className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
            isDark ? "translate-x-8" : "translate-x-1"
          }`}
        >
          {isDark ? (
            <Moon className="h-3 w-3 text-indigo-600 absolute top-1 left-1" />
          ) : (
            <Sun className="h-3 w-3 text-amber-500 absolute top-1 left-1" />
          )}
        </div>
      </button>
    </div>
  );
}

