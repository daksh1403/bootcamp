import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Docker × Jenkins Bootcamp — The DevOps Deployment Mission",
    template: "%s · Docker × Jenkins Bootcamp",
  },
  description:
    "Code{Y}Gen VITC presents the Docker × Jenkins Bootcamp. CODE. CONTAINERIZE. AUTOMATE. DEPLOY. No spectators. Everyone ships.",
};

export const viewport: Viewport = {
  themeColor: "#0b0f14",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${display.variable} ${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
