"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DistrictSelect } from "./DistrictSelect";
import { Field, inputClass, selectClass } from "./Field";
import { useT } from "./LangProvider";

export type CoachLink = {
  coachId: string;
  relationship: "CURRENT" | "PAST";
  startYear: string | number;
  endYear: string | number;
  isPrimary: boolean;
};

type Result = { slaaId: string; name: string; district: string };

/**
 * Search registered coaches and describe the relationship with each.
 * Results show name with initials, district and SLAA ID only.
 */
export function CoachPicker({
  value,
  onChange,
  error,
  itemErrors,
}: {
  value: CoachLink[];
  onChange: (v: CoachLink[]) => void;
  error?: string;
  itemErrors?: Record<number, Record<string, string>>;
}) {
  const { t, tErr, district: districtLabel } = useT();
  const [q, setQ] = useState("");
  const [district, setDistrict] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [searchError, setSearchError] = useState("");
  const [meta, setMeta] = useState<Record<string, Result>>({});
  const seq = useRef(0);

  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) {
      setResults([]);
      setStatus("idle");
      return;
    }
    const mine = ++seq.current;
    setStatus("loading");
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: text });
        if (district) params.set("district", district);
        const res = await fetch(`/api/coaches/search?${params}`);
        const body = await res.json().catch(() => ({}));
        if (mine !== seq.current) return;
        if (!res.ok) {
          setSearchError(body.error ?? t("searchFailed"));
          setStatus("error");
          return;
        }
        setResults(body.results);
        setStatus("idle");
      } catch {
        if (mine === seq.current) {
          setSearchError(t("searchNetwork"));
          setStatus("error");
        }
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [q, district, t]);

  function add(r: Result) {
    setMeta((m) => ({ ...m, [r.slaaId]: r }));
    const hasPrimary = value.some((c) => c.isPrimary);
    onChange([
      ...value,
      { coachId: r.slaaId, relationship: "CURRENT", startYear: "", endYear: "", isPrimary: !hasPrimary },
    ]);
    setQ("");
    setResults([]);
  }

  function update(i: number, patch: Partial<CoachLink>) {
    let next = value.map((c, j) => (j === i ? { ...c, ...patch } : c));
    if (patch.relationship === "PAST") next[i] = { ...next[i], isPrimary: false };
    if (patch.relationship === "CURRENT") next[i] = { ...next[i], endYear: "" };
    if (patch.isPrimary) next = next.map((c, j) => ({ ...c, isPrimary: j === i }));
    onChange(next);
  }

  function remove(i: number) {
    onChange(value.filter((_, j) => j !== i));
  }

  const selectedIds = new Set(value.map((c) => c.coachId));

  return (
    <div className="flex flex-col gap-4">
      {value.map((c, i) => {
        const m = meta[c.coachId];
        const errs = itemErrors?.[i] ?? {};
        return (
          <div key={c.coachId + i} data-testid="coach-link" className="flex flex-col gap-3 rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{m?.name ?? c.coachId}</p>
                <p className="text-xs text-muted-foreground">
                  {m?.district && districtLabel(m.district)} · <span className="font-mono">{c.coachId}</span>
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)}>
                {t("remove")}
              </Button>
            </div>
            <div className="flex gap-4 text-sm" role="radiogroup" aria-label={t("relationship")}>
              {(["CURRENT", "PAST"] as const).map((r) => (
                <label key={r} className="flex min-h-10 items-center gap-2">
                  <input
                    type="radio"
                    className="size-5 accent-primary"
                    name={`rel-${i}`}
                    checked={c.relationship === r}
                    onChange={() => update(i, { relationship: r })}
                  />
                  {r === "CURRENT" ? t("currentCoach") : t("pastCoach")}
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("fromYear")} htmlFor={`start-${i}`} optional error={errs.startYear}>
                <Input id={`start-${i}`} inputMode="numeric" maxLength={4} className={inputClass}
                  value={String(c.startYear)} onChange={(e) => update(i, { startYear: e.target.value })} />
              </Field>
              {c.relationship === "PAST" && (
                <Field label={t("toYear")} htmlFor={`end-${i}`} optional error={errs.endYear}>
                  <Input id={`end-${i}`} inputMode="numeric" maxLength={4} className={inputClass}
                    value={String(c.endYear)} onChange={(e) => update(i, { endYear: e.target.value })} />
                </Field>
              )}
            </div>
            {c.relationship === "CURRENT" && (
              <label className="flex min-h-10 items-center gap-2 text-sm">
                <input type="checkbox" className="size-5 accent-primary" checked={c.isPrimary}
                  onChange={(e) => update(i, { isPrimary: e.target.checked })} />
                {t("primaryCoach")}
              </label>
            )}
          </div>
        );
      })}

      <div className="flex flex-col gap-3 rounded-lg bg-muted/60 p-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
          <Field label={t("searchCoaches")} htmlFor="coach-search" hint={t("searchHint")}>
            <Input id="coach-search" className={inputClass} autoComplete="off" value={q}
              onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlaceholder")} role="combobox"
              aria-expanded={results.length > 0} aria-controls="coach-results" />
          </Field>
          <Field label={t("filterDistrict")} htmlFor="coach-district" optional>
            <DistrictSelect id="coach-district" placeholder={t("allDistricts")} className={selectClass}
              value={district} onChange={(e) => setDistrict(e.target.value)} />
          </Field>
        </div>
        {status === "loading" && <p className="text-sm text-muted-foreground">{t("searching")}</p>}
        {status === "error" && <p className="text-sm text-destructive">{tErr(searchError)}</p>}
        {status === "idle" && q.trim().length >= 2 && results.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("noCoach")}</p>
        )}
        {results.length > 0 && (
          <ul id="coach-results" role="listbox" className="flex flex-col divide-y rounded-lg border bg-background">
            {results.map((r) => {
              const taken = selectedIds.has(r.slaaId);
              return (
                <li key={r.slaaId} role="option" aria-selected={false} aria-disabled={taken}>
                  <button type="button" disabled={taken} onClick={() => add(r)}
                    className={cn("flex w-full min-h-12 items-center justify-between gap-2 px-3 py-2 text-left",
                      taken ? "opacity-50" : "hover:bg-muted")}>
                    <span>
                      <span className="font-medium">{r.name}</span>
                      <span className="block text-xs text-muted-foreground">{districtLabel(r.district)}</span>
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{r.slaaId}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{tErr(error)}</p>}
    </div>
  );
}
