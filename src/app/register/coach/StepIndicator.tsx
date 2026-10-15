"use client";

import { Check } from "lucide-react";
import { useT } from "@/components/LangProvider";

const STEPS = [
  { id: 1, key: "coachStepPersonal", label: "Personal" },
  { id: 2, key: "coachStepQuals", label: "Qualifications" },
  { id: 3, key: "coachStepAthletes", label: "Athletes" },
  { id: 4, key: "coachStepDeclarations", label: "Declarations" },
] as const;

const PERCENTAGES: Record<1 | 2 | 3 | 4, number> = {
  1: 25,
  2: 50,
  3: 75,
  4: 95,
};

export function StepIndicator({ current }: { current: 1 | 2 | 3 | 4 }) {
  const { t } = useT();
  const percent = PERCENTAGES[current];

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between text-sm font-semibold">
        <span className="text-slate-800">Your progress</span>
        <span className="text-blue-700">{percent}% complete</span>
      </div>

      {/* Progress track */}
      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-blue-600 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Step badges row */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {STEPS.map((s) => {
          const isDone = s.id < current;
          const isActive = s.id === current;
          const label = t(s.key as Parameters<typeof t>[0]);

          if (isDone) {
            return (
              <div
                key={s.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
              >
                <Check className="size-3.5 stroke-[2.5]" />
                <span>{label}</span>
              </div>
            );
          }

          if (isActive) {
            return (
              <div
                key={s.id}
                className="inline-flex items-center gap-1.5 rounded-full border-2 border-blue-600 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 shadow-xs"
              >
                <span className="size-1.5 rounded-full bg-blue-600" />
                <span>{label}</span>
              </div>
            );
          }

          return (
            <div
              key={s.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500"
            >
              <span className="size-1.5 rounded-full bg-amber-500/80" />
              <span>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
