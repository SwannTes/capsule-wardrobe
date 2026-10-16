import type { Metadata, Viewport } from "next";
import "./globals.css";
import SiteNav from "@/components/SiteNav";

export const metadata: Metadata = {
  title: { default: "胶囊衣橱", template: "%s · 胶囊衣橱" },
  description: "极简胶囊衣橱：拍照抠图、提取主色、整理你的单品。",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "胶囊衣橱",
  },
};

export const viewport: Viewport = {
  themeColor: "#faf9f7",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="flex min-h-dvh flex-col">
        <header className="pb-6 pt-[25svh] text-center">
          <p className="font-serif-jp text-xl tracking-[0.2em]">胶囊衣橱</p>
          <p className="mt-1 text-[15px] tracking-[0.35em] text-muted">
            CAPSULE WARDROBE
          </p>
          <SiteNav />
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-24">
          {children}
        </main>
        <footer className="fixed inset-x-0 bottom-0 bg-paper pb-8 pt-3 text-center text-[12.5px] tracking-[0.25em] text-muted">
          少，但更好 · LESS BUT BETTER
        </footer>
      </body>
    </html>
  );
}
