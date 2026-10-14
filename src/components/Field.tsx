"use client";

import { cn } from "@/lib/utils";
import { useT } from "./LangProvider";

// Label + control + hint/error, sized for thumbs on small phones.

export function Field({
  label,
  htmlFor,
  error,
  hint,
  optional,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: React.ReactNode;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const { t, tErr } = useT();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {optional && <span className="ml-1 font-normal text-muted-foreground">{t("optional")}</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {tErr(error)}
        </p>
      )}
    </div>
  );
}

export const inputClass = "h-11 text-base";

export const selectClass =
  "h-11 w-full rounded-lg border border-input bg-background px-2.5 text-base outline-none " +
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 " +
  "aria-invalid:border-destructive disabled:opacity-60";

export function FormError({ message }: { message?: string | null }) {
  const { tErr } = useT();
  if (!message) return null;
  return (
    <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
      {tErr(message)}
    </div>
  );
}

export function Section({ title, description, children }: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 border-t pt-6 first:border-t-0 first:pt-0">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}
