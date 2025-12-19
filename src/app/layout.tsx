import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { DataProvider } from "@/components/providers/data-provider";
import { SessionProvider } from "@/components/providers/session-provider";

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-sans-jp",
});

export const metadata: Metadata = {
  title: "GrowthDeck - 広告運用ダッシュボード",
  description: "広告運用を自動化・最適化するインテリジェントプラットフォーム",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GrowthDeck",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/icons/Cactus-Jack.jpg",
    apple: "/icons/Cactus-Jack.jpg",
  },
};

export const viewport: Viewport = {
  themeColor: "#3f0e40",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${notoSansJP.variable} font-sans antialiased bg-[#f8f8f8]`}>
        <SessionProvider>
          <DataProvider>
            <Sidebar />
            <main className="lg:pl-64">
              <div className="min-h-screen pt-16 lg:pt-0 px-4 py-4 lg:p-8">
                {children}
              </div>
            </main>
          </DataProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
