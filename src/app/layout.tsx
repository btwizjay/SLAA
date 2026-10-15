import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Sinhala, Noto_Sans_Tamil } from "next/font/google";
import Link from "next/link";
import { LangProvider, LanguageLink } from "@/components/LangProvider";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Geist has no Sinhala or Tamil glyphs; these fill in, self-hosted by next/font.
const notoSinhala = Noto_Sans_Sinhala({ variable: "--font-sinhala", subsets: ["sinhala"] });
const notoTamil = Noto_Sans_Tamil({ variable: "--font-tamil", subsets: ["tamil"] });

export const metadata: Metadata = {
  title: "SLAA Registration",
  description: "Register as an athlete with Sri Lanka Athletics and receive your SLAA ID.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

import Image from "next/image";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const lang = await getLang();
  const fonts = [geistSans, geistMono, notoSinhala, notoTamil].map((f) => f.variable).join(" ");

  return (
    <html lang={lang} suppressHydrationWarning>
      <body className={`${fonts} min-h-dvh flex flex-col bg-[#f8fafc] font-sans antialiased text-slate-900`} suppressHydrationWarning>
        <LangProvider lang={lang}>
          <header className="no-print bg-[#0028e8] text-white shadow-md">
            <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
              <Link href="/" className="flex min-w-0 items-center gap-3 transition opacity-95 hover:opacity-100">
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-blue-900/30 p-0.5">
                  <Image
                    src="/slaa-logo.png"
                    alt="Sri Lanka Athletics"
                    width={40}
                    height={40}
                    priority
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-base font-bold leading-tight tracking-tight text-white">
                    {t(lang, "siteTitle")}
                  </span>
                  <span className="text-xs font-normal leading-tight text-blue-100">
                    Sri Lanka Athletics
                  </span>
                </div>
              </Link>
              <LanguageLink />
            </div>
          </header>
          <main className="flex-1 w-full">{children}</main>
          <footer className="no-print mx-auto max-w-5xl px-4 py-8 text-center text-xs text-muted-foreground">
            {t(lang, "footer")}
          </footer>
        </LangProvider>
      </body>
    </html>
  );
}

