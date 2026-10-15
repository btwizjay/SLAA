"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch, type FieldErrors, type Path } from "react-hook-form";
import { CoachPicker } from "@/components/CoachPicker";
import { EventPicker } from "@/components/EventPicker";
import { Field, FormError, Section, inputClass } from "@/components/Field";
import { IdentitySummary } from "@/components/IdentitySummary";
import { useT } from "@/components/LangProvider";
import { ConsentBlock, PersonFields } from "@/components/PersonFields";
import { Turnstile, type TurnstileHandle } from "@/components/Turnstile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseNic } from "@/lib/nic";
import {
  clearCheckedIdentity,
  loadCheckedIdentity,
  saveDone,
  type CheckedIdentity,
} from "@/lib/registration-state";
import { submitRegistration } from "@/lib/submit";
import { ageOn, athleteFormSchema, type AthleteForm } from "@/lib/validation";

const emptyGuardian = { fullName: "", relationship: "", phone: "", nic: "", consent: false };

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

/** RHF keeps array item errors as arrays; flatten to index -> field -> message. */
function coachItemErrors(errors: { coaches?: unknown }) {
  const out: Record<number, Record<string, string>> = {};
  const arr = errors.coaches as unknown as (Record<string, { message?: string }> | undefined)[] | undefined;
  if (Array.isArray(arr)) {
    arr.forEach((e, i) => {
      if (!e) return;
      out[i] = {};
      for (const [k, v] of Object.entries(e)) if (v?.message) out[i][k] = v.message;
    });
  }
  return out;
}

export function AthleteRegistration() {
  const router = useRouter();
  const { t, tErr } = useT();
  const [checked, setChecked] = useState<CheckedIdentity | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const turnstile = useRef<TurnstileHandle>(null);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(athleteFormSchema),
    defaultValues: {
      fullName: "",
      nameWithInitials: "",
      dateOfBirth: "",
      district: "",
      phone: "",
      schoolOrClub: "",
      mainEvents: [],
      guardian: null,
      coaches: [],
    } as unknown as AthleteForm,
  });

  const dob = useWatch({ control, name: "dateOfBirth" });
  const isMinor = isDate(dob) && ageOn(dob) < 18;

  useEffect(() => {
    if (isMinor && !getValues("guardian")) setValue("guardian", emptyGuardian as unknown as AthleteForm["guardian"]);
    if (!isMinor && getValues("guardian")) setValue("guardian", null);
  }, [isMinor, getValues, setValue]);

  useEffect(() => {
    const c = loadCheckedIdentity();
    if (!c) {
      router.replace("/register/check");
      return;
    }
    setChecked(c);
    if (c.identity.type === "nic") {
      const r = parseNic(c.identity.nic);
      if (r.ok) {
        setValue("dateOfBirth", r.info.dateOfBirth);
        setValue("gender", r.info.gender);
      }
    }
  }, [router, setValue]);

  async function onSubmit(form: AthleteForm) {
    if (!checked) return;
    setFormError(null);
    const token = (await turnstile.current?.getToken()) ?? "";
    if (!token) {
      setFormError(t("securityNotLoaded"));
      return;
    }
    const result = await submitRegistration("/api/register/athlete", {
      identity: checked.identity,
      form,
      turnstileToken: token,
    });
    turnstile.current?.reset();
    if (result.ok) {
      saveDone({
        slaaId: result.slaaId,
        name: form.nameWithInitials,
        coachLinks: form.coaches.length,
        registrationType: "athlete",
      });
      clearCheckedIdentity();
      router.push("/register/done");
      return;
    }
    for (const [field, message] of Object.entries(result.fields)) {
      if (field.split(".")[0] in athleteFormSchema.shape) setError(field as Path<AthleteForm>, { message });
    }
    setFormError(result.error);
  }

  if (!checked) return <p className="text-muted-foreground">{t("loading")}</p>;
  const lockedFromNic = checked.identity.type === "nic";
  const g = errors.guardian as FieldErrors<NonNullable<AthleteForm["guardian"]>> & { message?: string } | undefined;

  return (
    <div className="mx-auto w-full max-w-3xl sm:max-w-4xl px-4 py-6 sm:py-10">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
        <div>
          <p className="text-sm font-semibold text-blue-600">{t("stepForm")}</p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900 tracking-tight">{t("formTitle")}</h1>
        </div>

        <div className="flex flex-col gap-6 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-7 shadow-sm">
          <IdentitySummary identity={checked.identity} />

        <Section title={t("aboutYou")}>
          <PersonFields register={register} errors={errors} lockedFromNic={lockedFromNic}
            phoneLabel={t("phoneAthlete")} />
          <Field label={t("schoolOrClub")} htmlFor="schoolOrClub" error={errors.schoolOrClub?.message}>
            <Input id="schoolOrClub" className={inputClass} {...register("schoolOrClub")}
              aria-invalid={!!errors.schoolOrClub} />
          </Field>
          <Field label={t("mainEvents")} error={errors.mainEvents?.message}>
            <Controller control={control} name="mainEvents"
              render={({ field }) => (
                <EventPicker value={field.value} onChange={field.onChange} invalid={!!errors.mainEvents} />
              )} />
          </Field>
        </Section>

        {isMinor && (
          <Section title={t("guardianTitle")} description={t("guardianDesc")}>
            <Field label={t("guardianName")} htmlFor="g-name" error={g?.fullName?.message}>
              <Input id="g-name" className={inputClass} {...register("guardian.fullName")} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("guardianRel")} htmlFor="g-rel" error={g?.relationship?.message}
                hint={t("guardianRelHint")}>
                <Input id="g-rel" className={inputClass} {...register("guardian.relationship")} />
              </Field>
              <Field label={t("guardianPhone")} htmlFor="g-phone" error={g?.phone?.message}>
                <Input id="g-phone" type="tel" inputMode="tel" className={inputClass} {...register("guardian.phone")} />
              </Field>
            </div>
            <Field label={t("guardianNic")} htmlFor="g-nic" optional error={g?.nic?.message}>
              <Input id="g-nic" className={inputClass + " font-mono uppercase"} {...register("guardian.nic")} />
            </Field>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-primary"
                {...register("guardian.consent")} />
              <span>{t("guardianConsentCheckbox")}</span>
            </label>
            {g?.consent?.message && <p role="alert" className="text-sm text-destructive">{tErr(g.consent.message)}</p>}
            {g?.message && <p role="alert" className="text-sm text-destructive">{tErr(g.message)}</p>}
          </Section>
        )}

        <Section title={t("coachesTitle")} description={t("coachesDesc")}>
          <Controller control={control} name="coaches"
            render={({ field }) => (
              <CoachPicker value={field.value} onChange={field.onChange}
                error={(errors.coaches as { message?: string } | undefined)?.message}
                itemErrors={coachItemErrors(errors)} />
            )} />
        </Section>

        <Section title={t("consentSection")}>
          <ConsentBlock register={register} error={errors.consent?.message} />
        </Section>
      </div>

        <FormError message={formError} />
        <Turnstile ref={turnstile} />
        <Button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold h-auto min-h-12 py-3 text-base shadow-md hover:scale-[1.01] active:scale-[0.99] transition whitespace-normal"
        >
          {isSubmitting ? t("submitting") : t("submit")}
        </Button>
      </form>
    </div>
  );
}
