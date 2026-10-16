import { requireAdmin } from "@/lib/admin-auth";
import { ActionForm } from "@/components/admin/ActionForm";
import { CoachImport } from "@/components/admin/CoachImport";
import { DISTRICTS, EVENTS } from "@/lib/reference";
import { createCoach } from "../suite-actions";
export const maxDuration = 60;
export const metadata = { title: "Coach management · SLAA admin" };
export default async function CoachesPage() {
  await requireAdmin();
  const input = (name: string, label: string, type = "text") => (
    <label key={name} className="text-sm">
      {label}
      <input
        name={name}
        type={type}
        maxLength={254}
        className="mt-1 h-11 w-full rounded-lg border px-3"
      />
    </label>
  );
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Add and import coaches</h1>
      <section className="rounded-xl border bg-background p-5">
        <h2 className="mb-4 text-lg font-semibold">Import coach CSV</h2>
        <CoachImport />
      </section>
      <details className="rounded-xl border bg-background p-5">
        <summary className="cursor-pointer text-lg font-semibold text-primary">
          Add one coach
        </summary>
        <ActionForm
          action={createCoach}
          submit="Create coach profile"
          className="mt-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {input("fullName", "Full name")}
            {input("nameWithInitials", "Name with initials")}
            <label className="text-sm">
              Identity type
              <select
                name="identityType"
                className="mt-1 h-11 w-full rounded-lg border px-3"
              >
                <option value="nic">NIC</option>
                <option value="postal">Postal ID</option>
              </select>
            </label>
            {input("nic", "NIC number")}
            {input("postalId", "Postal ID (if selected)")}
            {input(
              "dateOfBirth",
              "Date of birth (required for Postal ID)",
              "date",
            )}
            <label className="text-sm">
              Gender (derived from NIC when used)
              <select
                name="gender"
                className="mt-1 h-11 w-full rounded-lg border px-3"
              >
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </label>
            <label className="text-sm">
              District
              <select
                name="district"
                className="mt-1 h-11 w-full rounded-lg border px-3"
              >
                {DISTRICTS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            {input("phone", "Mobile (optional)", "tel")}
            {input("email", "Email (optional)", "email")}
            {input("licenseNo", "Licence number (optional)")}
            {input("licenseLevel", "Licence level (optional)")}
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">
              Coaching events
            </legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {EVENTS.map((e) => (
                <label key={e.code} className="flex gap-2 text-sm">
                  <input type="checkbox" name="disciplines" value={e.code} />
                  {e.name}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="text-sm">
            Source or reason
            <textarea
              name="reason"
              required
              maxLength={500}
              className="mt-1 w-full rounded-lg border p-3"
            />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="consent" required className="mt-1" />
            This coach authorized SLAA to store these details.
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="linkExisting" className="mt-1" />
            If this identity already belongs to a member, add a coach profile to
            their existing SLAA ID. Preserve their existing personal details.
          </label>
        </ActionForm>
      </details>
    </div>
  );
}
