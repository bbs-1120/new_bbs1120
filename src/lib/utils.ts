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

