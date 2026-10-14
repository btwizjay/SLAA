"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FormError } from "@/components/Field";
import { IdentityFields, emptyIdentity, toIdentity, type IdentityValues } from "@/components/IdentityFields";
import { Turnstile, type TurnstileHandle } from "@/components/Turnstile";
import { useT } from "@/components/LangProvider";
import { Button } from "@/components/ui/button";
import { saveCheckedIdentity } from "@/lib/registration-state";
import { identitySchema } from "@/lib/validation";

type Existing = { slaaId: string; maskedName: string; district: string };

export function IdentityCheck() {
  const router = useRouter();
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
    const parsed = identitySchema.safeParse(toIdentity(values));
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
      saveCheckedIdentity({ identity: parsed.data });
      router.push("/register/athlete");
    } catch {
      setFormError(t("networkError"));
    } finally {
      setBusy(false);
      turnstile.current?.reset();
    }
  }

  if (existing) {
    return (
      <div className="flex flex-col gap-6" data-testid="already-registered">
        <h1 className="text-2xl font-bold">{t("alreadyTitle")}</h1>
        <div className="rounded-xl border bg-background p-5">
          <p className="text-sm text-muted-foreground">{t("alreadyYourId")}</p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-wider">{existing.slaaId}</p>
          <p className="mt-3 text-sm">
            {existing.maskedName} · {district(existing.district)}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">{t("alreadyText")}</p>
        <Button nativeButton={false} render={<Link href="/" />} variant="outline" className="h-auto min-h-11 self-start whitespace-normal">
          {t("backToStart")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <div>
        <p className="text-sm font-medium text-primary">{t("stepCheck")}</p>
        <h1 className="mt-1 text-2xl font-bold">{t("checkTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("checkIntro")}</p>
      </div>

      <div className="rounded-xl border bg-background p-4 sm:p-6">
        <IdentityFields value={values} onChange={setValues} errors={errors} />
      </div>

      <FormError message={formError} />
      <Turnstile ref={turnstile} />

      <Button type="submit" disabled={busy} className="h-auto min-h-12 py-2 text-base whitespace-normal">
        {busy ? t("checking") : t("continue")}
      </Button>
    </form>
  );
}
