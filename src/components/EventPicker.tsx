"use client";

import { EVENTS } from "@/lib/reference";
import { cn } from "@/lib/utils";
import { useT } from "./LangProvider";

const GROUPS = [...new Set(EVENTS.map((e) => e.category))];

/** Multi-select of events as tappable chips, grouped by category. */
export function EventPicker({
  value,
  onChange,
  invalid,
  id,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  invalid?: boolean;
  id?: string;
}) {
  const { event, category } = useT();
  const toggle = (code: string) =>
    onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);

  return (
    <div id={id} className={cn("flex flex-col gap-3 rounded-lg", invalid && "ring-2 ring-destructive/40 p-2")}>
      {GROUPS.map((g) => (
        <fieldset key={g}>
          <legend className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{category(g)}</legend>
          <div className="flex flex-wrap gap-2">
            {EVENTS.filter((e) => e.category === g).map((e) => {
              const on = value.includes(e.code);
              return (
                <button
                  key={e.code}
                  type="button"
                  aria-pressed={on}
                  title={event(e.code)}
                  onClick={() => toggle(e.code)}
                  className={cn(
                    "min-h-10 rounded-full border px-3.5 text-sm transition-colors",
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-muted",
                  )}
                >
                  {event(e.code)}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
