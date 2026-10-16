import { ActionForm } from "./ActionForm";
import { saveCoachLink } from "@/app/admin/(staff)/suite-actions";
export function LinkEditor({
  athleteId,
  row = {},
}: {
  athleteId: string;
  row?: Record<string, unknown>;
}) {
  return (
    <details className="mt-3 rounded-lg border p-3">
      <summary className="cursor-pointer text-sm font-medium text-primary">
        {row.id ? "Edit relationship" : "Add a coach relationship"}
      </summary>
      <ActionForm
        action={saveCoachLink}
        submit="Save relationship"
        className="mt-3"
      >
        <input type="hidden" name="athleteId" value={athleteId} />
        <input type="hidden" name="linkId" value={String(row.id ?? 0)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Coach SLAA ID
            <input
              name="coachId"
              required
              defaultValue={String(row.coach_id ?? "")}
              className="mt-1 h-10 w-full rounded-lg border px-3 font-mono"
            />
          </label>
          <label className="text-sm">
            Relationship
            <select
              name="relationship"
              defaultValue={String(row.relationship_type ?? "CURRENT")}
              className="mt-1 h-10 w-full rounded-lg border px-3"
            >
              <option value="CURRENT">Current</option>
              <option value="PAST">Past</option>
            </select>
          </label>
          <label className="text-sm">
            From year
            <input
              type="number"
              name="startYear"
              min={1950}
              max={2100}
              defaultValue={String(row.start_year ?? "")}
              className="mt-1 h-10 w-full rounded-lg border px-3"
            />
          </label>
          <label className="text-sm">
            To year (past only)
            <input
              type="number"
              name="endYear"
              min={1950}
              max={2100}
              defaultValue={String(row.end_year ?? "")}
              className="mt-1 h-10 w-full rounded-lg border px-3"
            />
          </label>
        </div>
        <label className="flex gap-2 text-sm">
          <input
            name="isPrimary"
            type="checkbox"
            defaultChecked={!!row.is_primary}
          />
          Primary current coach (replaces any previous primary)
        </label>
        <label className="text-sm">
          Reason
          <input
            name="reason"
            required
            maxLength={500}
            className="mt-1 h-10 w-full rounded-lg border px-3"
          />
        </label>
        <p className="text-xs text-muted-foreground">
          New and changed relationships return to the coach review queue.
        </p>
      </ActionForm>
    </details>
  );
}
