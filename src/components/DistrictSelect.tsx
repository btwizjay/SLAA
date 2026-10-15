"use client";

import { forwardRef } from "react";
import { DISTRICTS } from "@/lib/reference";
import { selectClass } from "./Field";
import { useT } from "./LangProvider";

// Native <select>: the phone's own picker is the easiest to use on a small screen.
// Option values stay in English (what the database stores); labels are translated.
export const DistrictSelect = forwardRef<
  HTMLSelectElement,
  React.ComponentProps<"select"> & { placeholder?: string }
>(function DistrictSelect({ placeholder, className, ...props }, ref) {
  const { t, district } = useT();
  return (
    <select ref={ref} className={className ?? selectClass} {...props}>
      <option value="">{placeholder ?? t("selectDistrict")}</option>
      {DISTRICTS.map((d) => ({ d, label: district(d) }))
        .sort((a, b) => a.label.localeCompare(b.label))
        .map(({ d, label }) => (
          <option key={d} value={d}>
            {label}
          </option>
        ))}
    </select>
  );
});
