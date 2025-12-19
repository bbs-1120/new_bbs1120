import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // 環境変数をビルド時に埋め込まない（ランタイムで読み込む）
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
