import Link from "next/link";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n/server";

export default async function Home() {
  const lang = await getLang();
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t(lang, "homeTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{t(lang, "homeIntro")}</p>
      </div>

      <div className="grid gap-4">
        <Choice href="/register/check" title={t(lang, "homeAthleteTitle")} text={t(lang, "homeAthleteText")} />
      </div>

      <div className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">{t(lang, "homeAlreadyTitle")}</p>
        <p className="mt-1">{t(lang, "homeAlreadyText")}</p>
      </div>
    </div>
  );
}

function Choice({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 rounded-xl border bg-background p-5 shadow-sm transition hover:border-primary hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary"
    >
      <span className="text-lg font-semibold group-hover:text-primary">{title} →</span>
      <span className="text-sm text-muted-foreground">{text}</span>
    </Link>
  );
}
