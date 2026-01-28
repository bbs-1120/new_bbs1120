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
  title: "AdProfit - 広告運用ダッシュボード",
  description: "広告運用を自動化・最適化するインテリジェントプラットフォーム",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AdProfit",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/icons/adprofit-logo.png",
    apple: "/icons/adprofit-logo.png",
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
          <main>
            <div 
              className="min-h-screen px-3 py-4 sm:px-4 lg:px-8 lg:py-6 main-content"
              style={{ 
                paddingTop: 'calc(64px + env(safe-area-inset-top, 0px))',
              }}
            >
              {children}
            </div>
          </main>
        </DataProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
