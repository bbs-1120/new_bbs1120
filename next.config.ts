import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // 環境変数をビルド時に埋め込まない（ランタイムで読み込む）
  serverExternalPackages: ["@prisma/client"],
  
  // パフォーマンス最適化
  experimental: {
    // パッケージのTree Shaking最適化（serverExternalPackagesと重複するパッケージは除外）
    optimizePackageImports: [
      "lucide-react", 
      "recharts",
      "date-fns",
    ],
  },
  
  // 画像最適化
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24, // 24時間キャッシュ
  },
  
  // コンパイル最適化
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  
  // HTTPヘッダー設定（キャッシュ最適化）
  async headers() {
    return [
      {
        // APIレスポンスのキャッシュ
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=60, stale-while-revalidate=300",
          },
        ],
      },
      {
        // 静的アセットの長期キャッシュ
        source: "/:all*(svg|jpg|jpeg|png|gif|ico|webp|avif)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // JSチャンクの長期キャッシュ
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  
  // 圧縮有効化
  compress: true,
  
  // パワードバイヘッダー削除
  poweredByHeader: false,
};

export default nextConfig;
