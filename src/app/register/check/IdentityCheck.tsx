"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { FormError } from "@/components/Field";
import { IdentityFields, emptyIdentity, toIdentity, type IdentityValues } from "@/components/IdentityFields";
import { Turnstile, type TurnstileHandle } from "@/components/Turnstile";
import { useT } from "@/components/LangProvider";
import { Button } from "@/components/ui/button";
import { saveCheckedIdentity } from "@/lib/registration-state";
import { coachIdentitySchema, identitySchema } from "@/lib/validation";

type Existing = { slaaId: string; maskedName: string; district: string };

export function IdentityCheck() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const target = searchParams.get("for") === "coach" ? "coach" : "athlete";
  const { t, district } = useT();
  const [values, setValues] = useState<IdentityValues>(emptyIdentity);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<Existing | null>(null);
  const turnstile = useRef<TurnstileHandle>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const schema = target === "coach" ? coachIdentitySchema : identitySchema;
    const parsed = schema.safeParse(toIdentity(values));
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const token = (await turnstile.current?.getToken()) ?? "";
      if (!token) {
        setFormError(t("securityNotLoaded"));
        return;
      }
      const res = await fetch("/api/identity-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identity: parsed.data, turnstileToken: token }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(body.error ?? t("serverError"));
        return;
      }
      if (body.exists) {
        setExisting(body);
        return;
      }
      saveCheckedIdentity({ identity: parsed.data, registrationType: target });
      router.push(target === "coach" ? "/register/coach" : "/register/athlete");
    } catch {
      setFormError(t("networkError"));
    } finally {
      setBusy(false);
      turnstile.current?.reset();
    }
  }

  if (existing) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-8 sm:py-12 flex flex-col gap-6" data-testid="already-registered">
        <div className="rounded-2xl border border-blue-200/80 bg-blue-50/50 p-6 shadow-sm">
          <h1 className="text-2xl font-extrabold text-slate-900">{t("alreadyTitle")}</h1>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">{t("alreadyText")}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("alreadyYourId")}</p>
          <p className="mt-1 font-mono text-3xl sm:text-4xl font-extrabold tracking-wider text-blue-700">{existing.slaaId}</p>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-800">{existing.maskedName}</span>
            <span className="text-slate-500">{district(existing.district)}</span>
          </div>
        </div>
        <Button
          nativeButton={false}
          render={<Link href="/" />}
          variant="outline"
          className="rounded-xl border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold h-auto min-h-11 self-start"
        >
          ← {t("backToStart")}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8 sm:py-12">
      <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate suppressHydrationWarning>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-blue-100 text-blue-800 px-2.5 py-0.5 text-xs font-semibold">
              {target === "coach" ? "Coach Verification" : "Athlete Verification"}
            </span>
            <span className="text-xs text-slate-400">Step 1 of {target === "coach" ? 4 : 2}</span>
          </div>
          <h1 className="mt-3 text-2xl font-extrabold text-slate-900 tracking-tight">{t("checkTitle")}</h1>
          <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{t("checkIntro")}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <IdentityFields
            value={values}
            onChange={setValues}
            errors={errors}
            allowedTypes={target === "coach" ? ["nic"] : ["nic", "postal"]}
          />
        </div>

        <FormError message={formError} />
        <Turnstile ref={turnstile} />

        <Button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold h-auto min-h-12 py-3 text-base shadow-md hover:scale-[1.01] active:scale-[0.99] transition"
        >
          {busy ? t("checking") : `${t("continue")} →`}
        </Button>
      </form>
    </div>
  );
}
