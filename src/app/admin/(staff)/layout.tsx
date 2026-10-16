import Link from "next/link";
import { PageContainer } from "@/components/Page";
import { requireAdminSession } from "@/lib/admin-auth";
import { signOut } from "../auth-actions";
import { LangProvider } from "@/components/LangProvider";

export const dynamic = "force-dynamic";

const NAV = [
  ["/admin/overview", "Overview"],
  ["/admin", "Members"],
  ["/admin/duplicates", "Possible duplicates"],
  ["/admin/coach-requests", "Coach requests"],
  ["/admin/confirmations", "Coach confirmations"],
  ["/admin/coaches", "Add / import coaches"],
  ["/admin/audit", "Audit log"],
  ["/admin/exports", "Exports"],
  ["/admin/staff", "Staff"],
  ["/admin/account", "Your account"],
] as const;

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdminSession(true);
  return (
    <PageContainer size="wide" className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 border-b pb-3 md:flex-row md:items-center md:justify-between">
        {/* scrolls sideways on phones instead of wrapping into several lines */}
        <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 text-sm md:mx-0 md:px-0 md:pb-0">
          {NAV.filter(
            ([href]) => href !== "/admin/staff" || session.role === "owner",
          ).map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="shrink-0 rounded-full border bg-background px-3.5 py-1.5 font-medium text-primary hover:bg-primary/5"
            >
              {label}
            </Link>
          ))}
        </nav>
        <form
          action={signOut}
          className="flex items-center gap-2 text-xs text-muted-foreground"
        >
          <span className="truncate">{session.email}</span>
          <button type="submit" className="shrink-0 underline">
            Sign out
          </button>
        </form>
      </div>
      <LangProvider lang="en">{children}</LangProvider>
    </PageContainer>
  );
}
