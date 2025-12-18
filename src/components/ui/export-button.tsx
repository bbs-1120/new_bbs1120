"use client";

import { useState } from "react";
import { Button } from "./button";
import { Download, FileSpreadsheet, FileText, Loader2, ChevronDown } from "lucide-react";

interface ExportData {
  [key: string]: string | number | boolean | null | undefined;
}

interface ExportButtonProps {
  data: ExportData[];
  filename: string;
  columns?: { key: string; label: string }[];
  title?: string;
}

export function ExportButton({ data, filename, columns, title = "レポート" }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // CSV形式でエクスポート
  const exportCSV = () => {
    setIsExporting(true);

    try {
      const headers = columns ? columns.map(c => c.label) : Object.keys(data[0] || {});
      const keys = columns ? columns.map(c => c.key) : Object.keys(data[0] || {});

      const csvContent = [
        // BOM for Excel UTF-8
        "\uFEFF",
        headers.join(","),
        ...data.map(row =>
          keys.map(key => {
            const val = row[key];
            if (val === null || val === undefined) return "";
            if (typeof val === "string" && (val.includes(",") || val.includes('"') || val.includes("\n"))) {
              return `"${val.replace(/"/g, '""')}"`;
            }
            return String(val);
          }).join(",")
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename}_${formatDate(new Date())}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("CSV export error:", error);
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  };

  // Excel形式でエクスポート（CSVベース）
  const exportExcel = () => {
    // 実際にはCSVをダウンロードするが、Excelで開ける形式
    exportCSV();
  };

  // PDF形式でエクスポート（HTMLベースの印刷）
  const exportPDF = () => {
    setIsExporting(true);

    try {
      const headers = columns ? columns.map(c => c.label) : Object.keys(data[0] || {});
      const keys = columns ? columns.map(c => c.key) : Object.keys(data[0] || {});

      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        alert("ポップアップがブロックされました。許可してください。");
        return;
      }

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${title} - ${formatDate(new Date())}</title>
          <style>
            @page { size: landscape; margin: 1cm; }
            body { 
              font-family: 'Hiragino Sans', 'Yu Gothic', sans-serif;
              padding: 20px;
              font-size: 10px;
            }
            h1 { 
              font-size: 18px;
              margin-bottom: 10px;
              color: #1e293b;
            }
            .date { 
              font-size: 12px;
              color: #64748b;
              margin-bottom: 20px;
            }
            table { 
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th, td { 
              border: 1px solid #e2e8f0;
              padding: 8px;
              text-align: left;
            }
            th { 
              background: #1e293b;
              color: white;
              font-weight: 600;
            }
            tr:nth-child(even) { 
              background: #f8fafc;
            }
            .positive { color: #22c55e; font-weight: 600; }
            .negative { color: #ef4444; font-weight: 600; }
            .summary {
              margin-top: 20px;
              padding: 15px;
              background: #f1f5f9;
              border-radius: 8px;
            }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <p class="date">出力日時: ${new Date().toLocaleString("ja-JP")}</p>
          
          <table>
            <thead>
              <tr>
                ${headers.map(h => `<th>${h}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${data.map(row => `
                <tr>
                  ${keys.map(key => {
                    const val = row[key];
                    let className = "";
                    if (typeof val === "number" && key.toLowerCase().includes("profit")) {
                      className = val > 0 ? "positive" : val < 0 ? "negative" : "";
                    }
                    return `<td class="${className}">${formatCellValue(val)}</td>`;
                  }).join("")}
                </tr>
              `).join("")}
            </tbody>
          </table>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
        </html>
      `;

      printWindow.document.write(html);
      printWindow.document.close();
    } catch (error) {
      console.error("PDF export error:", error);
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting || data.length === 0}
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Download className="h-4 w-4 mr-2" />
        )}
        エクスポート
        <ChevronDown className="h-3 w-3 ml-1" />
      </Button>

      {isOpen && (
        <>
          {/* オーバーレイ */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          
          {/* ドロップダウン */}
          <div className="absolute right-0 mt-2 w-48 rounded-lg bg-white shadow-lg border border-gray-200 py-1 z-50">
            <button
              onClick={exportCSV}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            >
              <FileSpreadsheet className="h-4 w-4 text-green-600" />
              CSV形式
            </button>
            <button
              onClick={exportExcel}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Excel形式
            </button>
            <hr className="my-1" />
            <button
              onClick={exportPDF}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            >
              <FileText className="h-4 w-4 text-red-600" />
              PDF形式（印刷）
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ヘルパー関数
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function formatCellValue(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) return "-";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "number") {
    // ROASっぽい値は%表示
    if (val >= 0 && val <= 1000) {
      return val.toLocaleString();
    }
    return val.toLocaleString();
  }
  return String(val);
}

// クイックエクスポート（CSVのみ）
export function QuickExportCSV({ 
  data, 
  filename, 
  columns,
}: Omit<ExportButtonProps, "title">) {
  const exportCSV = () => {
    const headers = columns ? columns.map(c => c.label) : Object.keys(data[0] || {});
    const keys = columns ? columns.map(c => c.key) : Object.keys(data[0] || {});

    const csvContent = [
      "\uFEFF",
      headers.join(","),
      ...data.map(row =>
        keys.map(key => {
          const val = row[key];
          if (val === null || val === undefined) return "";
          if (typeof val === "string" && (val.includes(",") || val.includes('"') || val.includes("\n"))) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return String(val);
        }).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}_${formatDate(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant="ghost" size="sm" onClick={exportCSV} disabled={data.length === 0}>
      <Download className="h-4 w-4" />
    </Button>
  );
}

