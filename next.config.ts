import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // 環境変数をビルド時に埋め込まない（ランタイムで読み込む）
  serverExternalPackages: ["@prisma/client"],
  
  // パフォーマンス最適化
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
  },
  
  // 画像最適化
  images: {
    formats: ["image/avif", "image/webp"],
  },
  
  // コンパイル最適化
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
};

export default nextConfig;
