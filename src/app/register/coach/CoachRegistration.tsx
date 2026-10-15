"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { FormError } from "@/components/Field";
import { useT } from "@/components/LangProvider";
import { Turnstile, type TurnstileHandle } from "@/components/Turnstile";
import { Button } from "@/components/ui/button";
import { parseNic } from "@/lib/nic";
import {
  clearCheckedIdentity,
  loadCheckedIdentity,
  saveDone,
  type CheckedIdentity,
} from "@/lib/registration-state";
import { submitRegistration } from "@/lib/submit";
import { coachFormSchema, type CoachForm } from "@/lib/validation";
import { StepIndicator } from "./StepIndicator";
import { Step1Personal } from "./Step1Personal";
import { Step2Qualifications, emptyQual, type UploadState } from "./Step2Qualifications";
import { Step3Athletes } from "./Step3Athletes";
import { Step4Declarations } from "./Step4Declarations";

export function CoachRegistration() {
  const router = useRouter();
  const { t } = useT();
  const [checked, setChecked] = useState<CheckedIdentity | null>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadStates, setUploadStates] = useState<UploadState[]>(["idle"]);
  const turnstile = useRef<TurnstileHandle>(null);

  const methods = useForm({
    resolver: zodResolver(coachFormSchema),
    mode: "onTouched",
    defaultValues: {
      fullName: "",
      nameWithInitials: "",
      dateOfBirth: "",
      gender: "M",
      district: "" as CoachForm["district"],
      phone: "",
      email: "",
      licenseNo: "",
      disciplines: [],
      qualifications: [emptyQual()],
      athletes: [],
      declarations: [],
      signature: "",
      consent: false as unknown as true,
    } as unknown as CoachForm,
  });

  const {
    handleSubmit,
    setValue,
    trigger,
    watch,
    setError,
    formState: { isSubmitting },
  } = methods;

  useEffect(() => {
    const c = loadCheckedIdentity();
    if (!c || c.identity.type !== "nic") {
      router.replace("/register/check?for=coach");
      return;
    }
    setChecked(c);
    const r = parseNic(c.identity.nic);
    if (r.ok) {
      setValue("dateOfBirth", r.info.dateOfBirth, { shouldValidate: true });
      setValue("gender", r.info.gender, { shouldValidate: true });
    }
  }, [router, setValue]);

  const fullName = watch("fullName") ?? "";
  const lockedFromNic = true;

  const handleSetUploadState = (index: number, state: UploadState) => {
    setUploadStates((prev) => {
      const next = [...prev];
      next[index] = state;
      return next;
    });
  };

  const handleFileSelected = async (index: number, file: File) => {
    handleSetUploadState(index, "uploading");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/register/coach/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.success && data.documentPath) {
        const quals = methods.getValues("qualifications") ?? [];
        const updated = [...quals];
        if (updated[index]) {
          updated[index] = { ...updated[index], _uploadedPath: data.documentPath };
          setValue("qualifications", updated, { shouldDirty: true });
        }
        handleSetUploadState(index, "done");
      } else {
        handleSetUploadState(index, "error");
      }
    } catch {
      handleSetUploadState(index, "error");
    }
  };

  const nextStep = async () => {
    setFormError(null);
    if (step === 1) {
      const valid = await trigger([
        "fullName",
        "nameWithInitials",
        "dateOfBirth",
        "gender",
        "district",
        "phone",
        "email",
        "licenseNo",
        "disciplines",
      ]);
      if (valid) {
        setStep(2);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } else if (step === 2) {
      const valid = await trigger("qualifications");
      if (valid) {
        setStep(3);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } else if (step === 3) {
      const valid = await trigger("athletes");
      if (valid) {
        setStep(4);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  };

  const prevStep = () => {
    setFormError(null);
    setStep((s) => Math.max(1, s - 1) as 1 | 2 | 3 | 4);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onSubmit = async (form: CoachForm) => {
    if (!checked) return;
    setFormError(null);

    const token = (await turnstile.current?.getToken()) ?? "";
    if (!token) {
      setFormError(t("securityNotLoaded"));
      return;
    }

    const result = await submitRegistration("/api/register/coach", {
      identity: checked.identity,
      form,
      turnstileToken: token,
    });

    turnstile.current?.reset();

    if (result.ok) {
      saveDone({
        slaaId: result.slaaId,
        name: form.nameWithInitials,
        coachLinks: form.athletes?.length ?? 0,
        registrationType: "coach",
      });
      clearCheckedIdentity();
      router.push("/register/done");
    } else {
      setFormError(result.error);
      if (result.fields) {
        for (const [k, msg] of Object.entries(result.fields)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setError(k as any, { message: msg });
        }
      }
    }
  };

  if (!checked) {
    return <p className="text-sm text-muted-foreground">{t("loading")}</p>;
  }

  return (
    <div className="mx-auto w-full max-w-3xl sm:max-w-4xl px-4 py-6 sm:py-10">
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit((d) => onSubmit(d as CoachForm))} className="flex flex-col gap-6" noValidate>
          <StepIndicator current={step} />

          {step === 1 && (
            <Step1Personal identity={checked.identity} lockedFromNic={lockedFromNic} />
          )}

          {step === 2 && (
            <Step2Qualifications
              uploadStates={uploadStates}
              setUploadState={handleSetUploadState}
              onFileSelected={handleFileSelected}
            />
          )}

          {step === 3 && <Step3Athletes onSkip={() => setStep(4)} />}

          {step === 4 && <Step4Declarations fullName={fullName} />}

          <FormError message={formError} />

          {step === 4 && <Turnstile ref={turnstile} />}

          <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-200">
            {step > 1 ? (
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold px-6 py-3 min-h-12 shadow-xs"
              >
                ← {t("coachBackBtn")}
              </Button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <Button
                type="button"
                onClick={nextStep}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-3 min-h-12 shadow-md hover:scale-[1.01] active:scale-[0.99] transition"
              >
                <span>{t("continue")}</span>
                <span className="ml-1">→</span>
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-3 min-h-12 shadow-lg hover:scale-[1.01] active:scale-[0.99] transition text-base"
              >
                {isSubmitting ? t("coachSubmitting") : t("coachSubmit")}
              </Button>
            )}
          </div>
        </form>
      </FormProvider>
    </div>
  );
}
