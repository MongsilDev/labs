import type { NextConfig } from "next";

// 15개 화면 중 14곳 이상이 쓰는 Pretendard 조각. Cloudflare가 이 헤더로 103 Early Hints를 보냄
const FONT_SUBSETS = [83, 84, 85, 86, 87, 88, 89, 90, 91];
const PRELOAD = [
  "</fonts/pretendard/pretendardvariable-dynamic-subset.css>; rel=preload; as=style",
  ...FONT_SUBSETS.map((n) => `</fonts/pretendard/woff2-dynamic-subset/PretendardVariable.subset.${n}.woff2>; rel=preload; as=font; type="font/woff2"; crossorigin`),
].join(", ");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async redirects() {
    return [
      { source: "/er", destination: "/", permanent: false },
      { source: "/tarkov", destination: "/", permanent: false },
      { source: "/er/privacy", destination: "/privacy", permanent: true },
      { source: "/tarkov/privacy", destination: "/privacy", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/((?!er/t/[^/]+/[^/]+/(?:overlay|live)|er/rank/overlay).*)",
        headers: [{ key: "X-Frame-Options", value: "DENY" }],
      },
      {
        source: "/((?!api/|auth/|_next/|fonts/|img/|kord/).*)",
        missing: [{ type: "header", key: "rsc" }],
        headers: [{ key: "Link", value: PRELOAD }],
      },
      {
        source: "/fonts/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
