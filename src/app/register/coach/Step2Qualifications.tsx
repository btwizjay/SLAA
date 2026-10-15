"use client";

import { useCallback, useRef } from "react";
import { useFormContext } from "react-hook-form";
import { Award, Check, FileUp, Plus, Trash2, UploadCloud } from "lucide-react";
import { Field, inputClass, selectClass } from "@/components/Field";
import { useT } from "@/components/LangProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  COACH_LEVEL_LABELS,
  COACH_LEVELS,
  EVENT_GROUPS,
  ISSUING_BODIES,
  type CoachForm,
  type CoachQualification,
} from "@/lib/validation";

const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"];
const MAX_SIZE = 5 * 1024 * 1024;

export const emptyQual = (): CoachQualification => ({
  level: "CECS_L1_YOUTH",
  levelOtherText: "",
  eventGroup: "",
  issuingBody: "World Athletics",
  certificateSerial: "",
  yearAwarded: new Date().getFullYear(),
  _uploadedPath: "",
  _uploadError: "",
});

export type UploadState = "idle" | "uploading" | "done" | "error";

export function Step2Qualifications({
  uploadStates,
  setUploadState,
  onFileSelected,
}: {
  uploadStates: UploadState[];
  setUploadState: (i: number, s: UploadState) => void;
  onFileSelected: (i: number, file: File) => void;
}) {
  const { t, tErr } = useT();
  const {
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<CoachForm>();

  const quals = watch("qualifications") ?? [];
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  const addQual = useCallback(() => {
    const current = watch("qualifications") ?? [];
    setValue("qualifications", [...current, emptyQual()], { shouldDirty: true });
  }, [setValue, watch]);

  const removeQual = useCallback(
    (i: number) => {
      const current = watch("qualifications") ?? [];
      setValue(
        "qualifications",
        current.filter((_, idx) => idx !== i),
        { shouldDirty: true },
      );
    },
    [setValue, watch],
  );

  const qualsError = (errors.qualifications as { message?: string } | undefined)?.message;
  const itemErrors = errors.qualifications as
    | (Record<string, { message?: string }> | undefined)[]
    | undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        {/* Card Header matching Screenshot 1 */}
        <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-100 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 font-bold">
              <Award className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{t("coachQualsTitle")}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{t("coachQualsDesc")}</p>
            </div>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
              quals.length > 0
                ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                : "bg-amber-50 border border-amber-200 text-amber-700",
            )}
          >
            {quals.length > 0 ? `✓ ${quals.length} added` : "1 to go"}
          </span>
        </div>

        {/* Qualification Items */}
        <div className="flex flex-col gap-5">
          {quals.map((q, i) => {
            const iErr = itemErrors?.[i] ?? {};
            const uploadState = uploadStates[i] ?? "idle";

            return (
              <div key={i} className="flex flex-col gap-4 rounded-xl border border-slate-200/90 bg-slate-50/50 p-5">
                {/* Sub-box Header matching screenshot '1 Main' pill style */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="rounded-md bg-blue-100/70 px-2 py-0.5 text-xs font-semibold text-blue-800">
                      {COACH_LEVEL_LABELS[q.level] || `Qualification #${i + 1}`}
                    </span>
                  </div>

                  {quals.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeQual(i)}
                      className="text-xs text-slate-500 hover:text-destructive h-8 px-2 flex items-center gap-1"
                    >
                      <Trash2 className="size-3.5" />
                      <span>{t("coachQualRemove")}</span>
                    </Button>
                  )}
                </div>

                {/* Level Select */}
                <Field
                  label={t("coachQualLevel")}
                  htmlFor={`qual-level-${i}`}
                  error={(iErr as Record<string, { message?: string }>)?.level?.message}
                >
                  <select
                    id={`qual-level-${i}`}
                    className={cn(selectClass, "rounded-xl border-slate-200 bg-white focus:border-blue-600 focus:ring-blue-600")}
                    value={q.level}
                    onChange={(e) => {
                      const updated = [...quals];
                      updated[i] = { ...updated[i], level: e.target.value as CoachQualification["level"] };
                      setValue("qualifications", updated, { shouldDirty: true });
                    }}
                  >
                    {COACH_LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {COACH_LEVEL_LABELS[l]}
                      </option>
                    ))}
                  </select>
                </Field>

                {q.level === "OTHER" && (
                  <Field
                    label={t("coachQualLevelOther")}
                    htmlFor={`qual-other-${i}`}
                    error={(iErr as Record<string, { message?: string }>)?.levelOtherText?.message}
                  >
                    <Input
                      id={`qual-other-${i}`}
                      className={cn(inputClass, "rounded-xl border-slate-200 bg-white focus:border-blue-600 focus:ring-blue-600")}
                      value={q.levelOtherText ?? ""}
                      placeholder="e.g. Diploma in Sports Science / Level 2 S&C"
                      onChange={(e) => {
                        const updated = [...quals];
                        updated[i] = { ...updated[i], levelOtherText: e.target.value };
                        setValue("qualifications", updated, { shouldDirty: true });
                      }}
                    />
                  </Field>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label={t("coachQualEventGroup")}
                    htmlFor={`qual-group-${i}`}
                    optional
                    error={(iErr as Record<string, { message?: string }>)?.eventGroup?.message}
                  >
                    <select
                      id={`qual-group-${i}`}
                      className={cn(selectClass, "rounded-xl border-slate-200 bg-white focus:border-blue-600 focus:ring-blue-600")}
                      value={q.eventGroup ?? ""}
                      onChange={(e) => {
                        const updated = [...quals];
                        updated[i] = { ...updated[i], eventGroup: e.target.value };
                        setValue("qualifications", updated, { shouldDirty: true });
                      }}
                    >
                      <option value="">{t("coachQualSelectGroup")}</option>
                      {EVENT_GROUPS.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field
                    label={t("coachQualYear")}
                    htmlFor={`qual-year-${i}`}
                    error={(iErr as Record<string, { message?: string }>)?.yearAwarded?.message}
                  >
                    <Input
                      id={`qual-year-${i}`}
                      inputMode="numeric"
                      maxLength={4}
                      className={cn(inputClass, "rounded-xl border-slate-200 bg-white focus:border-blue-600 focus:ring-blue-600")}
                      value={String(q.yearAwarded)}
                      onChange={(e) => {
                        const updated = [...quals];
                        updated[i] = { ...updated[i], yearAwarded: Number(e.target.value) || 0 };
                        setValue("qualifications", updated, { shouldDirty: true });
                      }}
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label={t("coachQualIssuingBody")}
                    htmlFor={`qual-body-${i}`}
                    error={(iErr as Record<string, { message?: string }>)?.issuingBody?.message}
                  >
                    <select
                      id={`qual-body-${i}`}
                      className={cn(selectClass, "rounded-xl border-slate-200 bg-white focus:border-blue-600 focus:ring-blue-600")}
                      value={q.issuingBody}
                      onChange={(e) => {
                        const updated = [...quals];
                        updated[i] = { ...updated[i], issuingBody: e.target.value };
                        setValue("qualifications", updated, { shouldDirty: true });
                      }}
                    >
                      <option value="">{t("coachQualSelectBody")}</option>
                      {ISSUING_BODIES.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field
                    label={t("coachQualSerial")}
                    htmlFor={`qual-serial-${i}`}
                    optional
                    error={(iErr as Record<string, { message?: string }>)?.certificateSerial?.message}
                  >
                    <Input
                      id={`qual-serial-${i}`}
                      className={cn(inputClass, "font-mono rounded-xl border-slate-200 bg-white focus:border-blue-600 focus:ring-blue-600")}
                      autoComplete="off"
                      placeholder="e.g. WA-CECS-2023-8891"
                      value={q.certificateSerial ?? ""}
                      onChange={(e) => {
                        const updated = [...quals];
                        updated[i] = { ...updated[i], certificateSerial: e.target.value };
                        setValue("qualifications", updated, { shouldDirty: true });
                      }}
                    />
                  </Field>
                </div>

                {/* Certificate upload */}
                <Field
                  label={t("coachQualUpload")}
                  hint={t("coachQualUploadHint")}
                  optional
                  error={uploadState === "error" ? t("coachQualUploadFailed") : undefined}
                >
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <input
                      ref={(el) => {
                        fileRefs.current[i] = el;
                      }}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="sr-only"
                      aria-label={t("coachQualUpload")}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (!ALLOWED_MIME.includes(file.type)) {
                          setUploadState(i, "error");
                          return;
                        }
                        if (file.size > MAX_SIZE) {
                          setUploadState(i, "error");
                          return;
                        }
                        onFileSelected(i, file);
                      }}
                    />

                    {uploadState === "idle" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileRefs.current[i]?.click()}
                        className="rounded-xl border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium flex items-center gap-2 h-10 px-4"
                      >
                        <FileUp className="size-4 text-slate-500" />
                        <span>{t("coachQualUpload")}</span>
                      </Button>
                    )}

                    {uploadState === "uploading" && (
                      <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">
                        <UploadCloud className="size-4 animate-bounce text-blue-600" />
                        <span>{t("coachQualUploading")}</span>
                      </div>
                    )}

                    {uploadState === "done" && (
                      <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800">
                        <Check className="size-4 stroke-[2.5]" />
                        <span>{t("coachQualUploaded")}</span>
                        <button
                          type="button"
                          className="ml-2 text-xs text-blue-700 underline font-medium"
                          onClick={() => {
                            fileRefs.current[i]?.click();
                          }}
                        >
                          {t("change")}
                        </button>
                      </div>
                    )}

                    {uploadState === "error" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          fileRefs.current[i]?.click();
                        }}
                        className="rounded-xl border-destructive/40 text-destructive text-xs h-9 px-3"
                      >
                        {t("coachQualUploadRetry")}
                      </Button>
                    )}
                  </div>
                </Field>
              </div>
            );
          })}

          {qualsError && (
            <p role="alert" className="text-sm text-destructive">{tErr(qualsError)}</p>
          )}

          {/* Add Another Qualification Button matching '+ Add another event' in Screenshot 1 */}
          <Button
            type="button"
            variant="outline"
            onClick={addQual}
            disabled={quals.length >= 10}
            className="self-start rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 shadow-xs flex items-center gap-2 min-h-11"
          >
            <Plus className="size-4 text-slate-600" />
            <span>{t("coachQualAdd")}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
