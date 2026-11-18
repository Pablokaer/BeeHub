import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Serif, Pixelify_Sans } from "next/font/google";
import { THEME_SCRIPT } from "@/components/shell/theme";
import { siteConfig } from "@/lib/constants";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-plex-sans" });
const plexSerif = IBM_Plex_Serif({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-serif", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });
// Pixel display face for short Colmeia headings; self-hosted by next/font, so the CSP stays font-src 'self'.
const pixelify = Pixelify_Sans({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-pixelify", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  openGraph: { type: "website", siteName: siteConfig.name, title: siteConfig.name, description: siteConfig.description },
  twitter: { card: "summary_large_image", title: siteConfig.name, description: siteConfig.description },
  title: { default: siteConfig.name, template: `%s · ${siteConfig.name}` },
  description: siteConfig.description,
};

export const viewport: Viewport = {
  themeColor: "#352217",
  colorScheme: "light dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light" className={`${plexSans.variable} ${plexMono.variable} ${plexSerif.variable} ${pixelify.variable}`} suppressHydrationWarning>
      <head>
        {/* Applies the saved day/night choice before the first paint (no theme flash). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <a href="#main" className="sr-only-focusable fixed left-3 top-3 z-50 bg-surface px-3 py-2 font-semibold text-ink outline outline-2 outline-focus">
          Skip to content
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
