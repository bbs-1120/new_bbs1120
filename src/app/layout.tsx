import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-sans-jp",
});

export const metadata: Metadata = {
  title: "CPN自動仕分けシステム",
  description: "広告運用データのCPN自動仕分けシステム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${notoSansJP.variable} font-sans antialiased bg-slate-50`}>
        <Sidebar />
        <main className="pl-64">
          <div className="min-h-screen p-8">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
