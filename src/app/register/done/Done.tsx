"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Copy, Printer, ShieldCheck } from "lucide-react";
import { useT } from "@/components/LangProvider";
import { Button } from "@/components/ui/button";
import { loadDone, type DoneInfo } from "@/lib/registration-state";

export function Done() {
  const { t } = useT();
  const [info, setInfo] = useState<DoneInfo | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  useEffect(() => setInfo(loadDone()), []);

  if (info === undefined) return null;
  if (info === null) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-12 flex flex-col items-center text-center gap-4">
        <h1 className="text-2xl font-bold">{t("nothingTitle")}</h1>
        <p className="text-muted-foreground">{t("nothingText")}</p>
        <Link href="/" className="text-blue-600 font-semibold underline">
          {t("goToStart")}
        </Link>
      </div>
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(info!.slaaId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked
    }
  }

  const isCoach = info.registrationType === "coach";

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12 flex flex-col gap-6">
      <div className="no-print text-center">
        <div className="inline-flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-3 shadow-xs">
          <ShieldCheck className="size-8" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          {isCoach ? t("coachDoneTitle") : t("doneTitle")}
        </h1>
        <p className="mt-1.5 text-sm text-slate-500 max-w-md mx-auto">
          {isCoach ? t("coachDoneKeep") : t("doneKeep")}
        </p>
      </div>

      {/* Official printable SLAA ID card with SLAA logo */}
      <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-3xl border-2 border-slate-200 bg-white p-6 sm:p-7 shadow-xl print:shadow-none print:border-black">
        {/* Subtle background decoration */}
        <div className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-blue-50/50" />

        <div className="relative flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-[#0028e8] p-1">
              <Image
                src="/slaa-logo.png"
                alt="Sri Lanka Athletics"
                width={40}
                height={40}
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <span className="block text-xs font-black tracking-widest text-slate-800 uppercase">
                {t("cardOrg")}
              </span>
              <span className="block text-[10px] text-slate-400 font-medium">National Register</span>
            </div>
          </div>

          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
            {isCoach ? t("cardCoach") : t("cardAthlete")}
          </span>
        </div>

        <div className="relative mt-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {t("cardSlaaId")}
          </p>
          <p
            data-testid="slaa-id"
            className="mt-1 font-mono text-3xl sm:text-4xl font-black tracking-wider text-slate-900"
          >
            {info.slaaId}
          </p>
          <div className="mt-2 h-1.5 w-16 rounded-full bg-[#ffe600]" />
        </div>

        <div className="relative mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Full Name</p>
            <p className="text-base font-bold text-slate-900">{info.name}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400 font-medium">Status</p>
            <p className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full inline-block">
              {isCoach ? t("coachCardStatus") : t("cardStatus")}
            </p>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="no-print flex flex-col sm:flex-row items-center justify-center gap-3">
        <Button
          onClick={copy}
          className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 px-6 shadow-md hover:scale-[1.01] active:scale-[0.99] transition w-full sm:w-auto"
        >
          {copied ? (
            <span className="flex items-center gap-2">
              <Check className="size-4" />
              <span>{t("copied")}</span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Copy className="size-4" />
              <span>{t("copyId")}</span>
            </span>
          )}
        </Button>

        <Button
          onClick={() => window.print()}
          variant="outline"
          className="rounded-xl border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold h-12 px-6 shadow-xs w-full sm:w-auto flex items-center gap-2"
        >
          <Printer className="size-4 text-slate-500" />
          <span>{t("printCard")}</span>
        </Button>
      </div>

      {/* Next Steps Guide */}
      <div className="no-print rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm text-sm">
        <p className="font-bold text-slate-900 text-base">{isCoach ? t("coachNextTitle") : t("nextTitle")}</p>
        <ul className="mt-3 space-y-2 text-slate-600">
          {isCoach ? (
            <>
              <li className="flex items-start gap-2">
                <span className="size-1.5 rounded-full bg-blue-600 mt-2 shrink-0" />
                <span>{t("coachNext1")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="size-1.5 rounded-full bg-blue-600 mt-2 shrink-0" />
                <span>{t("coachNext2")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="size-1.5 rounded-full bg-blue-600 mt-2 shrink-0" />
                <span>{t("coachNext3")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="size-1.5 rounded-full bg-blue-600 mt-2 shrink-0" />
                <span>{t("coachNext4")}</span>
              </li>
            </>
          ) : (
            <>
              <li className="flex items-start gap-2">
                <span className="size-1.5 rounded-full bg-blue-600 mt-2 shrink-0" />
                <span>{t("next1")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="size-1.5 rounded-full bg-blue-600 mt-2 shrink-0" />
                <span>{t("next2")}</span>
              </li>
              {info.coachLinks > 0 && (
                <li className="flex items-start gap-2">
                  <span className="size-1.5 rounded-full bg-blue-600 mt-2 shrink-0" />
                  <span>{t("next3")}</span>
                </li>
              )}
            </>
          )}
        </ul>
      </div>
    </div>
  );
}
