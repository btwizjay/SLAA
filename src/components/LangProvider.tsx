"use client";

import { Languages } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useMemo } from "react";
import {
  LANG_LABELS,
  categoryName,
  districtName,
  eventName,
  t,
  tErr,
  type Lang,
  type MessageKey,
} from "@/lib/i18n";

const LangContext = createContext<Lang>("en");

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

/** Translation helpers bound to the current language. */
export function useT() {
  const lang = useContext(LangContext);
  return useMemo(
    () => ({
      lang,
      t: (key: MessageKey, vars?: Record<string, string>) => t(lang, key, vars),
      tErr: (message: string | undefined | null) => tErr(lang, message),
      district: (d: string) => districtName(lang, d),
      event: (code: string) => eventName(lang, code),
      category: (c: string) => categoryName(lang, c),
    }),
    [lang],
  );
}

/** Small header link showing the current language; opens the language screen. */
export function LanguageLink() {
  const { lang, t } = useT();
  const pathname = usePathname();
  if (pathname === "/language" || pathname.startsWith("/admin")) return null;
  return (
    <Link
      href={`/language?next=${encodeURIComponent(pathname)}`}
      aria-label={t("changeLanguage")}
      className="flex min-h-9 shrink-0 items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs sm:text-sm font-medium text-white transition hover:bg-white/20 backdrop-blur-sm"
    >
      <Languages className="size-4 text-white" aria-hidden />
      <span lang={lang}>{LANG_LABELS[lang]}</span>
    </Link>
  );
}
