import { requireAdmin } from "@/lib/admin-auth";
export default async function ExportsPage() {
  await requireAdmin();
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Exports</h1>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Downloads contain personal data. Store them only in approved locations.
        Every export is audited. To export a filtered selection, apply filters
        on the Members page.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["members", "Member register"],
          ["athletes", "Athlete register"],
          ["coaches", "Coach register"],
          ["events", "Events and personal bests"],
          ["links", "Athlete–coach relationships"],
          ["requests", "Unlisted coach requests"],
        ].map(([type, label]) => (
          <a
            key={type}
            href={`/api/admin/export?format=${type}`}
            className="rounded-xl border bg-background p-5 text-sm font-semibold text-primary hover:bg-primary/5"
          >
            {label} ↓ CSV
          </a>
        ))}
      </div>
    </div>
  );
}
