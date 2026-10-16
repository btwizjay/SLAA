import { requireAdminSession } from "@/lib/admin-auth";
import { ActionForm } from "@/components/admin/ActionForm";
import { changePassword, revokeOtherSessions } from "../../auth-actions";
export default async function AccountPage() {
  const session = await requireAdminSession(true);
  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Your account</h1>
      <p className="text-sm text-muted-foreground">{session.email}</p>
      {session.must_change_password && (
        <p
          role="status"
          className="rounded-lg border bg-amber-50 p-3 text-sm text-amber-900"
        >
          Set your own password before accessing the register.
        </p>
      )}
      <ActionForm
        action={changePassword}
        submit="Change password"
        className="rounded-xl border bg-background p-5"
      >
        {[
          ["currentPassword", "Current password", "current-password"],
          ["newPassword", "New password", "new-password"],
          ["confirmPassword", "Confirm new password", "new-password"],
        ].map(([name, label, autocomplete]) => (
          <label key={name} className="text-sm font-medium">
            {label}
            <input
              type="password"
              name={name}
              autoComplete={autocomplete}
              required
              minLength={name === "currentPassword" ? 1 : 12}
              maxLength={128}
              className="mt-1 h-11 w-full rounded-lg border px-3"
            />
          </label>
        ))}
        <p className="text-xs text-muted-foreground">
          Use 12–128 characters. Changing your password signs out all other
          sessions.
        </p>
      </ActionForm>
      {!session.must_change_password && (
        <ActionForm
          action={revokeOtherSessions}
          submit="Sign out other sessions"
        />
      )}
    </div>
  );
}
