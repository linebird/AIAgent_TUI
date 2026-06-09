import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SAFETYSAAS Agent",
  description: "MSA AI 챗봇 — 안전보건 및 MSA 운영·개발 도우미",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@fontsource/jetbrains-mono@5.0.18/index.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
