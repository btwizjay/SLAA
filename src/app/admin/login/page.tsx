import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { ActionForm } from "@/components/admin/ActionForm";
import { loginAction } from "../auth-actions";
export const metadata = { title: "Staff sign in · SLAA" };
export default async function LoginPage() {
  const session = await getAdminSession();
  if (session)
    redirect(
      session.must_change_password ? "/admin/account" : "/admin/overview",
    );
  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <div className="rounded-2xl border bg-background p-6 shadow-sm">
        <p className="text-sm font-medium text-primary">Sri Lanka Athletics</p>
        <h1 className="mt-1 text-2xl font-bold">Staff sign in</h1>
        <p className="mb-6 mt-2 text-sm text-muted-foreground">
          Manage the national register with your staff account.
        </p>
        <ActionForm action={loginAction} submit="Sign in">
          <label className="text-sm font-medium">
            Email
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              className="mt-1 h-11 w-full rounded-lg border px-3"
            />
          </label>
          <label className="text-sm font-medium">
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
              className="mt-1 h-11 w-full rounded-lg border px-3"
            />
          </label>
        </ActionForm>
        <p className="mt-5 text-xs text-muted-foreground">
          Contact the register owner if you need an account or a password reset.
        </p>
      </div>
    </div>
  );
}
