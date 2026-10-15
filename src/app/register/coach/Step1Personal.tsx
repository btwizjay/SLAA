"use client";

import { Controller, useFormContext, useWatch } from "react-hook-form";
import { ShieldCheck, Trophy, User } from "lucide-react";
import Link from "next/link";
import { EventPicker } from "@/components/EventPicker";
import { Field, inputClass } from "@/components/Field";
import { useT } from "@/components/LangProvider";
import { PersonFields } from "@/components/PersonFields";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Identity, CoachForm } from "@/lib/validation";

export function Step1Personal({
  identity,
  lockedFromNic,
}: {
  identity: Identity;
  lockedFromNic: boolean;
}) {
  const { t } = useT();
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<CoachForm>();

  const disciplines = useWatch({ control, name: "disciplines" }) ?? [];
  const disciplinesError = (errors.disciplines as { message?: string } | undefined)?.message;

  const nicValue = identity.type === "nic" ? identity.nic.toUpperCase() : "";

  return (
    <div className="flex flex-col gap-6">
      {/* Verified Identity Badge Card */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-blue-200/80 bg-blue-50/50 p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                {t("idNic")} Verified
              </span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.2 text-[10px] font-semibold text-emerald-800">
                Active
              </span>
            </div>
            <p className="font-mono text-base font-bold text-slate-900 mt-0.5">{nicValue}</p>
          </div>
        </div>
        <Link
          href="/register/check?for=coach"
          className="text-xs font-semibold text-blue-700 hover:text-blue-900 underline"
        >
          {t("change")}
        </Link>
      </div>

      {/* Card 1: Personal & Contact Information */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-100 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 font-bold">
              <User className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{t("coachPersonalTitle")}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{t("coachPersonalDesc")}</p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
            Step 1 of 4
          </span>
        </div>

        <div className="flex flex-col gap-5">
          <PersonFields
            register={register}
            errors={errors}
            lockedFromNic={lockedFromNic}
            phoneLabel={t("phoneCoach")}
          />

          <Field label={t("email")} htmlFor="email" optional error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              className={cn(inputClass, "rounded-xl border-slate-200 focus:border-blue-600 focus:ring-blue-600")}
              {...register("email")}
              aria-invalid={!!errors.email}
            />
          </Field>

          <Field
            label={t("slaaLicenseNo")}
            htmlFor="licenseNo"
            optional
            hint={t("slaaLicenseNoHint")}
            error={errors.licenseNo?.message}
          >
            <Input
              id="licenseNo"
              className={cn(inputClass, "font-mono uppercase rounded-xl border-slate-200 focus:border-blue-600 focus:ring-blue-600")}
              autoComplete="off"
              {...register("licenseNo")}
              aria-invalid={!!errors.licenseNo}
            />
          </Field>
        </div>
      </div>

      {/* Card 2: Coaching Disciplines */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-100 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 font-bold">
              <Trophy className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{t("disciplinesCoach")}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{t("disciplinesCoachDesc")}</p>
            </div>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
              disciplines.length > 0
                ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                : "bg-amber-50 border border-amber-200 text-amber-700",
            )}
          >
            {disciplines.length > 0 ? `✓ ${disciplines.length} selected` : "1 to go"}
          </span>
        </div>

        <Controller
          control={control}
          name="disciplines"
          render={({ field }) => (
            <EventPicker
              value={field.value ?? []}
              onChange={field.onChange}
              invalid={!!disciplinesError}
            />
          )}
        />
        {disciplinesError && (
          <p role="alert" className="mt-2 text-sm text-destructive">{disciplinesError}</p>
        )}
      </div>
    </div>
  );
}
