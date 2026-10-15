import "server-only";
import { cookies, headers } from "next/headers";
import { LANG_COOKIE, isLang, langFromAcceptLanguage, type Lang } from ".";

/** The visitor's chosen language: cookie first, then the browser's preference. */
export async function getLang(): Promise<Lang> {
  const chosen = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLang(chosen)) return chosen;
  return langFromAcceptLanguage((await headers()).get("accept-language"));
}
