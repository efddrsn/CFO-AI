import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CFO-AI",
  description: "Seu CFO pessoal autônomo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-zinc-950 text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
