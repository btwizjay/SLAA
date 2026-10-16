import { requireOwner } from "@/lib/admin-auth";
import { sql } from "@/lib/db";
import { ActionForm } from "@/components/admin/ActionForm";
import { createStaff, manageStaff } from "../../auth-actions";
import { ROLE_LABELS, type StaffRole } from "@/lib/staff-permissions";
export default async function StaffPage() {
  await requireOwner();
  const staff =
    await sql`SELECT id, email, role, display_name, organization, active, must_change_password, last_login_at FROM admin_staff ORDER BY role DESC, email`;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Staff accounts</h1>
      <p className="text-sm text-muted-foreground">
        Only the owner can create accounts, reset passwords or disable staff.
        Changes are audited.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {staff.map((s) => (
          <section
            key={s.id}
            className="space-y-3 rounded-xl border bg-background p-5"
          >
            <h2 className="break-all font-semibold">{s.email}</h2>
            <p className="text-sm">
              {ROLE_LABELS[s.role as StaffRole]} ·{" "}
              {s.active ? "Active" : "Disabled"}
              {s.must_change_password ? " · Password change required" : ""}
            </p>
            {(s.display_name || s.organization) && (
              <p className="text-sm text-muted-foreground">
                {[s.display_name, s.organization].filter(Boolean).join(" · ")}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Last sign in:{" "}
              {s.last_login_at
                ? s.last_login_at.toLocaleString("en-GB", {
                    timeZone: "Asia/Colombo",
                  })
                : "Never"}
            </p>
            {s.role !== "owner" && (
              <ActionForm action={manageStaff} submit="Apply staff action">
                <input type="hidden" name="staffId" value={s.id} />
                <label className="text-sm">
                  Action
                  <select
                    name="operation"
                    className="mt-1 h-10 w-full rounded-lg border px-2"
                  >
                    <option value="revoke">Sign out all sessions</option>
                    <option value={s.active ? "disable" : "enable"}>
                      {s.active ? "Disable account" : "Enable account"}
                    </option>
                    <option value="reset">Reset temporary password</option>
                    <option value="role">Change access role</option>
                  </select>
                </label>
                <label className="text-sm">
                  Access role (for role change only)
                  <select
                    name="role"
                    defaultValue={s.role}
                    className="mt-1 h-10 w-full rounded-lg border px-2"
                  >
                    {["verifier", "supervisor", "admin"].map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role as StaffRole]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  New temporary password (for reset only)
                  <input
                    type="password"
                    name="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    className="mt-1 h-10 w-full rounded-lg border px-3"
                  />
                </label>
              </ActionForm>
            )}
          </section>
        ))}
      </div>
      <section className="max-w-lg rounded-xl border bg-background p-5">
        <h2 className="mb-4 font-semibold">Add staff account</h2>
        <ActionForm action={createStaff} submit="Create staff account">
          <label className="text-sm">
            Full name
            <input
              name="displayName"
              maxLength={120}
              className="mt-1 h-11 w-full rounded-lg border px-3"
            />
          </label>
          <label className="text-sm">
            Organization
            <input
              name="organization"
              placeholder="e.g. Sabaragamuwa University"
              maxLength={120}
              className="mt-1 h-11 w-full rounded-lg border px-3"
            />
          </label>
          <label className="text-sm">
            Access role
            <select
              name="role"
              defaultValue="verifier"
              className="mt-1 h-11 w-full rounded-lg border px-3"
            >
              {["verifier", "supervisor", "admin"].map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role as StaffRole]}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-muted-foreground">
            Student verifiers call and approve assigned applicants. Supervisors
            manage all verification cases and assignments. Administrators also
            manage the full register and exports.
          </p>
          <label className="text-sm">
            Staff email
            <input
              name="email"
              type="email"
              required
              maxLength={254}
              className="mt-1 h-11 w-full rounded-lg border px-3"
            />
          </label>
          <label className="text-sm">
            Temporary password
            <input
              name="password"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              className="mt-1 h-11 w-full rounded-lg border px-3"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Share the password through an approved secure channel. Staff must
            change it at their first sign-in.
          </p>
        </ActionForm>
      </section>
    </div>
  );
}
