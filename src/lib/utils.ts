import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 数値を通貨形式にフォーマット
 */
export function formatCurrency(value: number): string {
  const sign = value < 0 ? "-" : "";
  const absValue = Math.abs(Math.round(value));
  return sign + "¥" + absValue.toLocaleString("ja-JP");
}

/**
 * パーセンテージをフォーマット
 */
export function formatPercentage(value: number): string {
  return Math.round(value) + "%";
}

/**
 * 日付をYYYY/MM/DD形式にフォーマット
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

/**
 * CPNがReありかどうかを判定
 */
export function isReCpn(cpnName: string): boolean {
  return cpnName.includes("_Re");
}

/**
 * ROASに応じた色クラスを返す（高いほど目立つ赤/紫ベース）
 */
export function getRoasColorClass(roas: number): string {
  if (roas >= 301) return "text-fuchsia-600 font-bold";  // 301%以上: 濃い紫（最も目立つ）
  if (roas >= 251) return "text-purple-600 font-bold";   // 251%以上: 紫
  if (roas >= 200) return "text-rose-600 font-bold";     // 200%以上: ローズ
  if (roas >= 151) return "text-orange-600 font-bold";   // 151%以上: オレンジ
  if (roas >= 100) return "text-amber-600 font-semibold"; // 100%以上: アンバー（損益分岐）
  return "text-slate-400";                               // それ以下: グレー（目立たない）
}

/**
 * ROASに応じた背景色クラスを返す（高いほど目立つ赤/紫ベース）
 */
export function getRoasBgClass(roas: number): string {
  if (roas >= 301) return "bg-fuchsia-100 text-fuchsia-700";
  if (roas >= 251) return "bg-purple-100 text-purple-700";
  if (roas >= 200) return "bg-rose-100 text-rose-700";
  if (roas >= 151) return "bg-orange-100 text-orange-700";
  if (roas >= 100) return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-500";
}

