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

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const lang = await getLang();
  const fonts = [geistSans, geistMono, notoSinhala, notoTamil].map((f) => f.variable).join(" ");

  return (
    <html lang={lang}>
      <body className={`${fonts} min-h-dvh bg-muted/40 font-sans antialiased`}>
        <LangProvider lang={lang}>
          <header className="no-print border-b bg-background">
            <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
              <Link href="/" className="flex min-w-0 items-center gap-2 font-semibold">
                <span className="grid h-8 shrink-0 place-items-center rounded-md bg-primary px-2 text-xs font-bold tracking-wide text-primary-foreground">
                  SLAA
                </span>
                <span className="hidden truncate sm:inline">{t(lang, "siteTitle")}</span>
              </Link>
              <LanguageLink />
            </div>
          </header>
          <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">{children}</main>
          <footer className="no-print mx-auto max-w-3xl px-4 pb-8 text-xs text-muted-foreground">
            {t(lang, "footer")}
          </footer>
        </LangProvider>
      </body>
    </html>
  );
}
