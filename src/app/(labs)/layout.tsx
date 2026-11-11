import { OG_SIZE } from "@/er/server/og";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import Analytics from "@/components/Analytics";
import "../next/next.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.BASE_URL || "https://labs.mongsil.dev"),
  title: { default: "Labs", template: "%s - Labs" },
  description: "이터널 리턴 실험체 티어와 이터컷 예측, 대회 점수 계산, 2026 KEL 기록, Escape from Tarkov 계정 전적 조회와 KORD BREACH 특성 시뮬레이터가 있는 게임 도구 모음입니다.",
  // 묶음 폴더 밖의 미리보기 이미지는 자동으로 붙지 않아 주소를 직접 적음
  openGraph: { siteName: "Labs", type: "website", locale: "ko_KR", images: [{ url: "/opengraph-image", ...OG_SIZE, alt: "Labs" }] },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#121212" };

const themeScript = `(function(){try{var t=localStorage.getItem('labs-theme');if(t!=='light'&&t!=='dark')t='dark';document.documentElement.dataset.theme=t;var m=document.querySelector('meta[name=theme-color]');if(m)m.content=t==='light'?'#fafaf9':'#121212'}catch(e){}})()`;

export default function LabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" data-theme="dark" suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/fonts/pretendard/pretendardvariable-dynamic-subset.css" />
      </head>
      <body>
        <Script id="theme" strategy="beforeInteractive">
          {themeScript}
        </Script>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
