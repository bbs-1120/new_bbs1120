"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

export function RealtimeClock() {
  const [time, setTime] = useState<string>("");
  const [date, setDate] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("ja-JP", {
        timeZone: "Asia/Tokyo",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      const dateStr = now.toLocaleDateString("ja-JP", {
        timeZone: "Asia/Tokyo",
        month: "numeric",
        day: "numeric",
        weekday: "short",
      });
      setTime(timeStr);
      setDate(dateStr);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
      <Clock className="h-4 w-4 text-slate-500 dark:text-slate-400" />
      <div className="text-sm">
        <span className="text-slate-500 dark:text-slate-400">{date}</span>
        <span className="ml-2 font-mono font-bold text-slate-900 dark:text-white">{time}</span>
      </div>
    </div>
  );
}

