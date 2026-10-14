import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin, supabaseConfigured, supabaseServer } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

async function signOut() {
  "use server";
  if (supabaseConfigured()) await (await supabaseServer()).auth.signOut();
  redirect("/admin/login");
}

const NAV = [
  ["/admin", "Members"],
  ["/admin/duplicates", "Possible duplicates"],
  ["/admin/coach-requests", "Coach requests"],
  ["/admin/confirmations", "Coach confirmations"],
] as const;

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const email = await requireAdmin();
  return (
    // break out of the narrow public column; tables need the width
    <div className="relative left-1/2 flex w-[min(72rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="font-medium text-primary hover:underline">
              {label}
            </Link>
          ))}
        </nav>
        <form action={signOut} className="flex items-center gap-2 text-xs text-muted-foreground">
          {email}
          <button type="submit" className="underline">Sign out</button>
        </form>
      </div>
      {children}
    </div>
  );
}
