"use client";

import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Check, CheckCircle2, PenLine, ShieldCheck } from "lucide-react";
import { Field, inputClass } from "@/components/Field";
import { useT } from "@/components/LangProvider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cleanText } from "@/lib/validation";
import { cn } from "@/lib/utils";
import type { CoachForm, DeclarationAnswer } from "@/lib/validation";

type DeclarationRow = {
  code: string;
  version: number;
  section: "certification" | "safeguarding" | "integrity" | "athletes" | "legal";
  title: string;
  text_en?: string;
  text_si?: string | null;
  text_ta?: string | null;
  text?: string;
  allows_disclosure: boolean;
  required: boolean;
};

type DeclarationsBySection = Record<string, DeclarationRow[]>;

const SECTION_ORDER = ["certification", "safeguarding", "integrity", "athletes", "legal"] as const;

const SECTION_TITLE_KEYS: Record<string, string> = {
  certification: "coachDeclSectionCert",
  safeguarding: "coachDeclSectionSafe",
  integrity: "coachDeclSectionInt",
  athletes: "coachDeclSectionAth",
  legal: "coachDeclSectionLegal",
};

export function Step4Declarations({ fullName }: { fullName: string }) {
  const { t, tErr, lang } = useT();
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<CoachForm>();

  const [declarationsData, setDeclarationsData] = useState<DeclarationsBySection>({});
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const declarations = watch("declarations") ?? [];
  const signature = watch("signature") ?? "";

  useEffect(() => {
    fetch("/api/declarations")
      .then((r) => {
        if (!r.ok) throw new Error("failed to load");
        return r.json();
      })
      .then((data: DeclarationRow[]) => {
        const bySection: DeclarationsBySection = {};
        for (const row of data) {
          bySection[row.section] = bySection[row.section] ?? [];
          bySection[row.section].push(row);
        }
        setDeclarationsData(bySection);

        // Initialise answers for all active declarations if not already populated
        const current = watch("declarations") ?? [];
        if (!current || current.length === 0) {
          const initial: DeclarationAnswer[] = data.map((d) => ({
            code: d.code,
            version: d.version,
            answer: "confirm",
            disclosureDetails: "",
          }));
          setValue("declarations", initial, { shouldDirty: false });
        }
        setLoading(false);
      })
      .catch(() => {
        setLoadError("Could not load declarations. Please refresh the page.");
        setLoading(false);
      });
  }, [setValue, watch]);

  function getAnswer(code: string): DeclarationAnswer | undefined {
    return declarations.find((d) => d.code === code);
  }

  function setAnswer(code: string, version: number, patch: Partial<DeclarationAnswer>) {
    const current = [...declarations];
    const idx = current.findIndex((d) => d.code === code);
    if (idx === -1) {
      current.push({
        code,
        version,
        answer: "confirm",
        disclosureDetails: "",
        ...patch,
      });
    } else {
      current[idx] = { ...current[idx], ...patch };
    }
    setValue("declarations", current, { shouldDirty: true });
  }

  const trimmedSig = signature.trim().toLowerCase();
  const trimmedName = cleanText(fullName).toLowerCase();
  const signatureMismatch = trimmedSig.length > 0 && trimmedSig !== trimmedName;
  const signatureMatched = trimmedSig.length > 0 && trimmedSig === trimmedName;

  const getDeclarationText = (d: DeclarationRow) => {
    if (lang === "si" && d.text_si) return d.text_si;
    if (lang === "ta" && d.text_ta) return d.text_ta;
    return d.text_en ?? d.text ?? "";
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center text-slate-500 shadow-sm">
        <p className="text-sm">{t("loading")}</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-6 text-destructive shadow-sm">
        <p className="text-sm font-semibold">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Declarations Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-100 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 font-bold">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{t("coachDeclTitle")}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{t("coachDeclDesc")}</p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
            Step 4 of 4
          </span>
        </div>

        <div className="flex flex-col gap-8">
          {SECTION_ORDER.map((section) => {
            const rows = declarationsData[section] ?? [];
            if (!rows.length) return null;

            return (
              <div key={section} className="flex flex-col gap-4 border-t border-slate-100 pt-5 first:border-0 first:pt-0">
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <span className="size-2 rounded-full bg-blue-600" />
                  <span>{t(SECTION_TITLE_KEYS[section] as Parameters<typeof t>[0])}</span>
                </h3>

                {rows.map((decl) => {
                  const ans = getAnswer(decl.code);
                  const declText = getDeclarationText(decl);
                  const disclosureError = errors.declarations
                    ? (errors.declarations as unknown as Record<string, { disclosureDetails?: { message?: string } }>)?.[decl.code]?.disclosureDetails?.message
                    : undefined;

                  return (
                    <div
                      key={decl.code}
                      className="flex flex-col gap-3 rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 transition-colors"
                    >
                      <p className="text-sm font-bold text-slate-900">{decl.title}</p>
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{declText}</p>

                      {decl.allows_disclosure ? (
                        <fieldset className="flex flex-col gap-2 pt-1">
                          <legend className="sr-only">{decl.title}</legend>
                          <div className="flex flex-col sm:flex-row sm:gap-6">
                            <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm font-medium text-slate-800">
                              <input
                                type="radio"
                                name={`decl-${decl.code}`}
                                className="size-4.5 accent-blue-600"
                                checked={ans?.answer !== "disclose"}
                                onChange={() =>
                                  setAnswer(decl.code, decl.version, {
                                    answer: "confirm",
                                    disclosureDetails: "",
                                  })
                                }
                              />
                              <span>{t("coachDeclConfirm")}</span>
                            </label>

                            <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm font-medium text-slate-800">
                              <input
                                type="radio"
                                name={`decl-${decl.code}`}
                                className="size-4.5 accent-blue-600"
                                checked={ans?.answer === "disclose"}
                                onChange={() =>
                                  setAnswer(decl.code, decl.version, {
                                    answer: "disclose",
                                    disclosureDetails: ans?.disclosureDetails || "",
                                  })
                                }
                              />
                              <span>{t("coachDeclDisclose")}</span>
                            </label>
                          </div>

                          {ans?.answer === "disclose" && (
                            <div className="mt-2 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
                              <p className="text-xs text-amber-800 font-semibold">
                                {t("coachDeclDisclosureNote")}
                              </p>
                              <Field
                                label={t("coachDeclDiscloseLabel")}
                                htmlFor={`disclose-${decl.code}`}
                                error={disclosureError}
                              >
                                <Textarea
                                  id={`disclose-${decl.code}`}
                                  rows={3}
                                  className="text-sm rounded-xl border-slate-300 bg-white"
                                  placeholder={t("coachDeclDisclosePlaceholder")}
                                  value={ans?.disclosureDetails ?? ""}
                                  onChange={(e) =>
                                    setAnswer(decl.code, decl.version, {
                                      disclosureDetails: e.target.value,
                                    })
                                  }
                                />
                              </Field>
                            </div>
                          )}
                        </fieldset>
                      ) : (
                        <label className="flex min-h-10 cursor-pointer items-start gap-3 pt-1 text-sm font-medium text-slate-800">
                          <input
                            type="checkbox"
                            className="mt-0.5 size-4.5 shrink-0 accent-blue-600 rounded"
                            checked={ans?.answer === "confirm"}
                            onChange={(e) =>
                              setAnswer(decl.code, decl.version, {
                                answer: e.target.checked ? "confirm" : ("" as "confirm"),
                              })
                            }
                          />
                          <span>{t("coachDeclConfirm")}</span>
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Digital Signature Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-100 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 font-bold">
              <PenLine className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{t("coachSignatureTitle")}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{t("coachSignatureDesc")}</p>
            </div>
          </div>
          {signatureMatched && (
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              <Check className="size-3" />
              <span>Verified</span>
            </span>
          )}
        </div>

        <Field
          label={t("coachSignatureLabel")}
          htmlFor="signature"
          error={
            signatureMismatch
              ? t("coachSignatureMismatch")
              : (errors.signature?.message as string | undefined)
          }
        >
          <Input
            id="signature"
            className={cn(
              inputClass,
              "rounded-xl border-slate-200 bg-white focus:border-blue-600 focus:ring-blue-600",
              signatureMatched && "border-emerald-500 bg-emerald-50/20",
            )}
            autoComplete="name"
            placeholder={fullName}
            aria-invalid={!!errors.signature || signatureMismatch}
            {...register("signature")}
          />
        </Field>

        {signatureMatched && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
            <CheckCircle2 className="size-3.5" />
            <span>Digital signature matches your full name.</span>
          </p>
        )}
      </div>

      {/* Consent Checkbox Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <label className="flex items-start gap-3.5 text-sm font-medium text-slate-800 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 size-5 shrink-0 accent-blue-600 rounded"
            {...register("consent")}
          />
          <span className="leading-relaxed">{t("coachConsentLabel")}</span>
        </label>
        {errors.consent && (
          <p role="alert" className="mt-2 text-sm text-destructive pl-8">
            {tErr(errors.consent.message as string)}
          </p>
        )}
      </div>
    </div>
  );
}
