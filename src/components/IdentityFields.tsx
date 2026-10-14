"use client";

import { Input } from "@/components/ui/input";
import { parseNic } from "@/lib/nic";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/i18n";
import { Field, inputClass } from "./Field";
import { useT } from "./LangProvider";

export type IdentityType = "nic" | "postal";
export type IdentityValues = {
  type: IdentityType;
  nic: string;
  postalId: string;
};

export const emptyIdentity: IdentityValues = {
  type: "nic",
  nic: "",
  postalId: "",
};

const TYPE_LABELS = { nic: "idNic", postal: "idPostal" } as const;

export function IdentityFields({
  value,
  onChange,
  errors,
}: {
  value: IdentityValues;
  onChange: (v: IdentityValues) => void;
  errors: Record<string, string>;
}) {
  const { t, tErr, lang } = useT();
  const types: IdentityType[] = ["nic", "postal"];
  const set = (patch: Partial<IdentityValues>) => onChange({ ...value, ...patch });
  const nic = value.nic.trim() ? parseNic(value.nic) : null;

  return (
    <div className="flex flex-col gap-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t("whichId")}</legend>
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          {types.map((type) => (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={value.type === type}
              onClick={() => set({ type })}
              className={cn(
                "min-h-11 rounded-lg border px-3 text-sm font-medium transition-colors",
                value.type === type ? "border-primary bg-primary/10 text-primary" : "bg-background hover:bg-muted",
              )}
            >
              {t(TYPE_LABELS[type])}
            </button>
          ))}
        </div>
      </fieldset>

      {value.type === "nic" && (
        <Field label={t("nicNumber")} htmlFor="nic" error={errors.nic} hint={t("nicHint")}>
          <Input
            id="nic"
            className={cn(inputClass, "font-mono uppercase tracking-wider")}
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            maxLength={14}
            value={value.nic}
            onChange={(e) => set({ nic: e.target.value })}
            aria-invalid={!!errors.nic || (nic !== null && !nic.ok && value.nic.replace(/\s/g, "").length >= 10)}
          />
          {nic?.ok && (
            <div className="rounded-lg bg-muted px-3 py-2 text-sm" data-testid="nic-decoded">
              {withBold(t("nicDecoded"), {
                dob: formatDate(lang, nic.info.dateOfBirth),
                gender: t(nic.info.gender === "F" ? "genderFemaleLower" : "genderMaleLower"),
              })}
            </div>
          )}
          {nic && !nic.ok && value.nic.replace(/\s/g, "").length >= 10 && !errors.nic && (
            <p className="text-sm text-destructive">{tErr(nic.error)}</p>
          )}
        </Field>
      )}

      {value.type === "postal" && (
        <Field label={t("postalNumber")} htmlFor="postalId" error={errors.postalId}>
          <Input
            id="postalId"
            className={cn(inputClass, "font-mono uppercase")}
            autoComplete="off"
            value={value.postalId}
            onChange={(e) => set({ postalId: e.target.value })}
            aria-invalid={!!errors.postalId}
          />
        </Field>
      )}
    </div>
  );
}

/** Fill {name} placeholders with bold values, e.g. the decoded birth date. */
function withBold(template: string, values: Record<string, string>) {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const key = part.match(/^\{(\w+)\}$/)?.[1];
    return key && key in values ? <strong key={i}>{values[key]}</strong> : part;
  });
}

/** Reduce the form state to the shape identitySchema expects. */
export function toIdentity(v: IdentityValues) {
  switch (v.type) {
    case "nic":
      return { type: "nic" as const, nic: v.nic };
    case "postal":
      return { type: "postal" as const, postalId: v.postalId };
  }
}
