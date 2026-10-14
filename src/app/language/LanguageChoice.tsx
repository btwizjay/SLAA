"use client";

import { useRouter } from "next/navigation";
import { LANG_COOKIE, LANG_LABELS, LANGS, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// The first screen: the visitor has not read anything yet, so every line
// here is shown in all three languages.
const CONTINUE: Record<Lang, string> = {
  en: "Continue in English",
  si: "සිංහලෙන් ඉදිරියට යන්න",
  ta: "தமிழில் தொடரவும்",
};

export function LanguageChoice({ next, current }: { next: string; current: Lang | null }) {
  const router = useRouter();

  function choose(l: Lang) {
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    router.push(next);
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 py-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Choose your language</h1>
        <p className="mt-1 text-lg font-semibold" lang="si">භාෂාව තෝරන්න</p>
        <p className="mt-1 text-lg font-semibold" lang="ta">மொழியைத் தெரிவு செய்யவும்</p>
      </div>

      <div className="flex flex-col gap-3" role="group" aria-label="Language">
        {LANGS.map((l) => (
          <button
            key={l}
            type="button"
            lang={l}
            aria-pressed={current === l}
            onClick={() => choose(l)}
            className={cn(
              "flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border-2 bg-background px-4 py-3 shadow-sm transition",
              "hover:border-primary hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary",
              current === l ? "border-primary" : "border-border",
            )}
          >
            <span className="text-2xl font-bold">{LANG_LABELS[l]}</span>
            <span className="text-sm text-muted-foreground">{CONTINUE[l]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
