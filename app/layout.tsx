import type { Metadata } from "next";
import "./globals.css";
import { UserProvider } from "./contexts/UserContext";

export const metadata: Metadata = {
  title: "MockupGen - AI 목업 생성 도구",
  description: "기획안을 입력하면 AI가 목업 화면을 자동으로 생성해드립니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full flex flex-col bg-slate-50">
        <UserProvider>{children}</UserProvider>
      </body>
    </html>
  );
}
