"use client";

import Link from "next/link";
import type { Identity } from "@/lib/validation";
import { useT } from "./LangProvider";

/** Locked identity from step 1. The person who typed it may see it again. */
export function IdentitySummary({ identity }: { identity: Identity }) {
  const { t } = useT();
  const [label, value] =
    identity.type === "nic"
      ? [t("idNic"), identity.nic.toUpperCase()]
      : [t("idPostal"), identity.postalId.toUpperCase()];

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2.5 text-sm">
      <div>
        <span className="text-muted-foreground">{label}: </span>
        <span className="font-mono font-medium">{value}</span>
      </div>
      <Link href="/register/check" className="shrink-0 text-primary underline-offset-4 hover:underline">
        {t("change")}
      </Link>
    </div>
  );
}
