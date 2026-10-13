import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: { default: "Koza", template: "%s · Koza" },
  description: "Koza: sürdürülebilirlik görevine yeni başlayan çalışanı adım adım yönlendiren, veriyi kanıtıyla toplayan, hesabı denetlenebilir motorla yapan uygulama. MEXT İş Dünyasında Sorumlu Üretim grubu önizlemesi.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0d5f55" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
