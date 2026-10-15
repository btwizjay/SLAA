import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Admin access = a Supabase Auth session whose email is in ADMIN_EMAILS.
// Checked on the server for every admin page, action and API request.

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowListed(email: string | null | undefined) {
  return !!email && adminEmails().includes(email.trim().toLowerCase());
}

export function supabaseConfigured() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // called from a server component: the middleware refreshes cookies instead
        }
      },
    },
  });
}

/** The signed-in admin's email, or null. */
export async function getAdmin(): Promise<string | null> {
  const dev = process.env.DEV_ADMIN_EMAIL;
  if (dev && process.env.NODE_ENV === "development") return dev;
  if (!supabaseConfigured()) return null;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return isAllowListed(user?.email) ? user!.email!.toLowerCase() : null;
}

/** For pages and server actions: redirects to the login page when not an admin. */
export async function requireAdmin(): Promise<string> {
  const email = await getAdmin();
  if (!email) redirect("/admin/login");
  return email;
}
