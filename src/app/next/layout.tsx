import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./next.css";

export const metadata: Metadata = {
  title: { default: "Labs 시안", template: "%s - Labs 시안" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#121212" };

const themeScript = `(function(){try{var t=localStorage.getItem('labs-theme');if(t!=='light'&&t!=='dark')t='dark';document.documentElement.dataset.theme=t}catch(e){}})()`;

export default function NextLayout({ children }: { children: React.ReactNode }) {
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
      </body>
    </html>
  );
}
