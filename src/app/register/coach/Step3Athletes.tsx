"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Search, Trash2, UserPlus, Users } from "lucide-react";
import { DistrictSelect } from "@/components/DistrictSelect";
import { Field, inputClass, selectClass } from "@/components/Field";
import { useT } from "@/components/LangProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CoachAthleteLink, CoachForm } from "@/lib/validation";

type AthleteResult = { slaaId: string; name: string; district: string };

export function Step3Athletes({ onSkip }: { onSkip: () => void }) {
  const { t, tErr, district: districtLabel } = useT();
  const {
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<CoachForm>();

  const athletes = watch("athletes") ?? [];
  const [q, setQ] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [results, setResults] = useState<AthleteResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [searchError, setSearchError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      setStatus("idle");
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setStatus("loading");
      try {
        const params = new URLSearchParams({ q: q.trim(), role: "athlete" });
        if (districtFilter) params.set("district", districtFilter);
        const res = await fetch(`/api/coaches/search?${params}`);
        if (!res.ok) throw new Error("search failed");
        const data = await res.json();
        setResults(data.results ?? []);
        setStatus("idle");
      } catch {
        setStatus("error");
        setSearchError(t("searchAthletesFailed"));
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, districtFilter, t]);

  const selectedIds = new Set(athletes.map((a) => a.athleteId));

  const add = useCallback(
    (r: AthleteResult) => {
      const current = watch("athletes") ?? [];
      const currentIds = new Set(current.map((a) => a.athleteId));
      if (currentIds.has(r.slaaId)) return;
      const link: CoachAthleteLink = {
        athleteId: r.slaaId,
        relationship: "CURRENT",
        startYear: "",
        endYear: "",
        isPrimary: false,
      };
      setValue("athletes", [...current, link], { shouldDirty: true });
    },
    [setValue, watch],
  );

  const remove = useCallback(
    (i: number) => {
      const current = watch("athletes") ?? [];
      setValue(
        "athletes",
        current.filter((_, idx) => idx !== i),
        { shouldDirty: true },
      );
    },
    [setValue, watch],
  );

  const update = useCallback(
    (i: number, patch: Partial<CoachAthleteLink>) => {
      const current = watch("athletes") ?? [];
      const updated = [...current];
      updated[i] = { ...updated[i], ...patch };
      setValue("athletes", updated, { shouldDirty: true });
    },
    [setValue, watch],
  );

  const itemErrors = errors.athletes as
    | (Record<string, { message?: string }> | undefined)[]
    | undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        {/* Card Header matching Screenshot 1 'Your coaches' card */}
        <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-100 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 font-bold">
              <Users className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{t("coachAthletesTitle")}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{t("coachAthletesDesc")}</p>
            </div>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
              athletes.length > 0
                ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                : "bg-slate-100 border border-slate-200 text-slate-600",
            )}
          >
            {athletes.length > 0 ? `✓ ${athletes.length} linked` : "Optional"}
          </span>
        </div>

        {/* Selected Athletes List */}
        <div className="flex flex-col gap-4">
          {athletes.map((a, i) => {
            const errs: Record<string, { message?: string }> =
              (itemErrors?.[i] as Record<string, { message?: string }>) ?? {};

            return (
              <div key={i} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="font-mono text-sm font-bold text-slate-900 tracking-wide">
                      {a.athleteId}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(i)}
                    className="text-xs text-slate-500 hover:text-destructive h-8 px-2 flex items-center gap-1"
                  >
                    <Trash2 className="size-3.5" />
                    <span>{t("remove")}</span>
                  </Button>
                </div>

                {/* Relationship Toggle */}
                <div className="flex flex-wrap gap-4 text-sm font-medium" role="radiogroup" aria-label={t("relationship")}>
                  {(["CURRENT", "PAST"] as const).map((r) => (
                    <label
                      key={r}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 transition-colors",
                        a.relationship === r
                          ? "border-emerald-600 bg-emerald-50 text-emerald-800 font-semibold"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                      )}
                    >
                      <input
                        type="radio"
                        className="size-4 accent-emerald-600"
                        name={`ath-rel-${i}`}
                        checked={a.relationship === r}
                        onChange={() => update(i, { relationship: r })}
                      />
                      <span>{r === "CURRENT" ? t("currentCoach") : t("pastCoach")}</span>
                    </label>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field
                    label={t("fromYear")}
                    htmlFor={`ath-start-${i}`}
                    optional
                    error={errs.startYear?.message}
                  >
                    <Input
                      id={`ath-start-${i}`}
                      inputMode="numeric"
                      maxLength={4}
                      className={cn(inputClass, "rounded-xl border-slate-200 bg-white focus:border-blue-600 focus:ring-blue-600")}
                      value={String(a.startYear)}
                      placeholder="e.g. 2022"
                      onChange={(e) => update(i, { startYear: e.target.value as unknown as "" })}
                    />
                  </Field>

                  {a.relationship === "PAST" && (
                    <Field
                      label={t("toYear")}
                      htmlFor={`ath-end-${i}`}
                      optional
                      error={errs.endYear?.message}
                    >
                      <Input
                        id={`ath-end-${i}`}
                        inputMode="numeric"
                        maxLength={4}
                        className={cn(inputClass, "rounded-xl border-slate-200 bg-white focus:border-blue-600 focus:ring-blue-600")}
                        value={String(a.endYear)}
                        placeholder="e.g. 2024"
                        onChange={(e) => update(i, { endYear: e.target.value as unknown as "" })}
                      />
                    </Field>
                  )}
                </div>
              </div>
            );
          })}

          {/* Search Box */}
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200/90 bg-slate-50/60 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <UserPlus className="size-4 text-emerald-600" />
              <span>{t("searchAthletes")}</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_13rem]">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <Input
                  id="athlete-search"
                  className={cn(inputClass, "pl-10 rounded-xl border-slate-200 bg-white focus:border-blue-600 focus:ring-blue-600")}
                  autoComplete="off"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t("searchAthletesPlaceholder")}
                  role="combobox"
                  aria-expanded={results.length > 0}
                  aria-controls="athlete-results"
                />
              </div>

              <DistrictSelect
                id="ath-district"
                placeholder={t("allDistricts")}
                className={cn(selectClass, "rounded-xl border-slate-200 bg-white focus:border-blue-600 focus:ring-blue-600")}
                value={districtFilter}
                onChange={(e) => setDistrictFilter(e.target.value)}
              />
            </div>

            {status === "loading" && <p className="text-xs text-slate-500">{t("searching")}</p>}
            {status === "error" && <p className="text-xs text-destructive">{tErr(searchError)}</p>}
            {status === "idle" && q.trim().length >= 2 && results.length === 0 && (
              <p className="text-xs text-slate-500">{t("noAthlete")}</p>
            )}

            {results.length > 0 && (
              <ul
                id="athlete-results"
                role="listbox"
                className="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-xs max-h-56 overflow-y-auto"
              >
                {results.map((r) => {
                  const taken = selectedIds.has(r.slaaId);
                  return (
                    <li key={r.slaaId} role="option" aria-selected={false} aria-disabled={taken}>
                      <button
                        type="button"
                        disabled={taken}
                        onClick={() => add(r)}
                        className={cn(
                          "flex w-full min-h-12 items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors",
                          taken ? "opacity-50 cursor-not-allowed bg-slate-50" : "hover:bg-blue-50/60 cursor-pointer",
                        )}
                      >
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">{r.name}</p>
                          <p className="text-xs text-slate-500">{districtLabel(r.district)}</p>
                        </div>
                        <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                          {r.slaaId}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Skip button */}
          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onSkip}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              {t("coachAthletesSkip")} →
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
