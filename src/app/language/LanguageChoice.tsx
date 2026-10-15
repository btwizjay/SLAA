"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { LANG_COOKIE, LANG_LABELS, LANGS, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

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
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-8 px-4 py-8 sm:py-14">
      {/* Blue Square with SLAA Crest */}
      <div className="relative flex size-24 sm:size-28 items-center justify-center rounded-2xl bg-[#0028e8] p-3 shadow-xl shadow-blue-600/25">
        <Image
          src="/slaa-logo.png"
          alt="Sri Lanka Athletics"
          width={90}
          height={90}
          priority
          className="h-full w-full object-contain"
        />
      </div>

      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Choose your language
        </h1>
        <p className="mt-1.5 text-base sm:text-lg font-medium text-slate-700" lang="si">
          භාෂාව තෝරන්න
        </p>
        <p className="mt-1 text-base sm:text-lg font-medium text-slate-700" lang="ta">
          மொழியைத் தெரிவு செய்யவும்
        </p>
      </div>

      {/* 3 Language Choice Cards */}
      <div className="grid w-full grid-cols-1 sm:grid-cols-3 gap-4" role="group" aria-label="Language">
        {LANGS.map((l) => (
          <button
            key={l}
            type="button"
            lang={l}
            aria-pressed={current === l}
            onClick={() => choose(l)}
            className={cn(
              "flex min-h-32 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 bg-white px-5 py-6 shadow-sm transition",
              "hover:border-blue-600 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600",
              current === l ? "border-blue-600 ring-2 ring-blue-600/20" : "border-slate-200",
            )}
          >
            <span className="text-xl sm:text-2xl font-bold text-slate-900">{LANG_LABELS[l]}</span>
            <span className="text-xs text-slate-500 font-medium text-center">{CONTINUE[l]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
