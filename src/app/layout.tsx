import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DataForge - Data Conversion Tool",
  description: "Convert between JSON, CSV, and other data formats instantly. Free online tool.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body className="bg-zinc-950 text-white min-h-screen">{children}</body>
    </html>
  );
}
