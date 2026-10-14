"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">{t("nothingTitle")}</h1>
        <p className="text-muted-foreground">{t("nothingText")}</p>
        <Link href="/" className="text-primary underline">{t("goToStart")}</Link>
      </div>
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(info!.slaaId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked; the ID is on screen to copy by hand
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="no-print">
        <h1 className="text-2xl font-bold">{t("doneTitle")}</h1>
        <p className="mt-1 text-muted-foreground">{t("doneKeep")}</p>
      </div>

      {/* printable card */}
      <div className="mx-auto w-full max-w-md rounded-2xl border-2 border-primary bg-background p-6 shadow-sm print:shadow-none">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">{t("cardOrg")}</span>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {t("cardAthlete")}
          </span>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">{t("cardSlaaId")}</p>
        <p data-testid="slaa-id" className="font-mono text-3xl font-bold tracking-wider sm:text-4xl">
          {info.slaaId}
        </p>
        <p className="mt-4 text-lg font-medium">{info.name}</p>
        <p className="mt-6 text-xs text-muted-foreground">{t("cardStatus")}</p>
      </div>

      <div className="no-print flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button onClick={copy} className="h-auto min-h-11 whitespace-normal">{copied ? t("copied") : t("copyId")}</Button>
        <Button onClick={() => window.print()} variant="outline" className="h-auto min-h-11 whitespace-normal">{t("printCard")}</Button>
      </div>

      <div className="no-print rounded-xl border bg-background p-4 text-sm">
        <p className="font-medium">{t("nextTitle")}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>{t("next1")}</li>
          <li>{t("next2")}</li>
          {info.coachLinks > 0 && (
            <li>{t("next3")}</li>
          )}
        </ul>
      </div>
    </div>
  );
}
