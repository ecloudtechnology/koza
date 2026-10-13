import type { NextConfig } from "next";

// Statik dışa aktarma: önizleme GitHub Pages / Vercel üzerinde sunucusuz çalışır.
// basePath yalnız GitHub Pages (https://<org>.github.io/koza/) için gerekir.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
