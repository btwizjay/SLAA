import { cookies } from "next/headers";
import { LANG_COOKIE, isLang } from "@/lib/i18n";
import { LanguageChoice } from "./LanguageChoice";

export const metadata = { title: "Language · SLAA Registration" };

export default async function LanguagePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // only same-site paths, so the link cannot send people to another website
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/language") ? next : "/";
  const chosen = (await cookies()).get(LANG_COOKIE)?.value;
  return <LanguageChoice next={safeNext} current={isLang(chosen) ? chosen : null} />;
}
