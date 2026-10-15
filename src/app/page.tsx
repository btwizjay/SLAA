import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, CreditCard, FileText, ShieldCheck } from "lucide-react";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n/server";

export default async function Home() {
  const lang = await getLang();

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0024e0] via-[#0028e8] to-[#001bb8] text-white">
        {/* Subtle diagonal background lines */}
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, #ffffff 0, #ffffff 1px, transparent 0, transparent 24px)",
          }}
        />

        <div className="relative mx-auto flex max-w-5xl flex-col items-center justify-between gap-10 px-4 py-12 sm:px-6 md:flex-row md:py-16">
          {/* Left Hero Content */}
          <div className="flex max-w-xl flex-col items-start gap-4">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              <Clock className="size-3.5" />
              <span>About 5 minutes</span>
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-white">
              {t(lang, "homeTitle")}
            </h1>

            <p className="text-base text-blue-100 sm:text-lg leading-relaxed">
              {t(lang, "homeIntro")}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/register/check?for=athlete"
                className="inline-flex items-center gap-2 rounded-full bg-[#ffe600] px-6 py-3.5 text-base font-bold text-slate-900 shadow-lg shadow-black/15 transition hover:bg-[#ffd700] hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>{t(lang, "homeAthleteTitle")}</span>
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/register/check?for=coach"
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>{t(lang, "homeCoachTitle")}</span>
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>

          {/* Right Hero: Crest & Floating Card */}
          <div className="relative flex shrink-0 flex-col items-center justify-center">
            {/* Background Crest */}
            <div className="relative h-48 w-48 sm:h-56 sm:w-56 opacity-90 drop-shadow-2xl">
              <Image
                src="/slaa-logo.png"
                alt="Sri Lanka Athletics"
                width={240}
                height={240}
                priority
                className="h-full w-full object-contain"
              />
            </div>

            {/* Floating Sample SLAA ID Card Preview (Athlete) */}
            <div className="relative -mt-10 sm:-mt-12 w-64 sm:w-72 rounded-2xl border border-white/40 bg-white p-4 shadow-2xl text-slate-900 transform sm:-rotate-2 transition hover:rotate-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider text-slate-600 uppercase">
                  Sri Lanka Athletics
                </span>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                  Athlete
                </span>
              </div>
              <p className="mt-3 text-[10px] font-medium text-slate-400 uppercase tracking-wider">SLAA ID</p>
              <p className="font-mono text-2xl font-black tracking-wide text-slate-900">
                A26-000123-4
              </p>
              <div className="mt-2 h-1.5 w-16 rounded-full bg-[#ffe600]" />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">How it works</h2>

        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 font-bold">
              <CreditCard className="size-5" />
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900">1. Check your ID</h3>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              Enter your NIC or Postal ID. We make sure you are not already registered.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="flex size-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 font-bold">
              <FileText className="size-5" />
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900">2. Fill in your details</h3>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              Your name, district, events, qualifications, and declarations. Fast and mobile-friendly.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 font-bold">
              <ShieldCheck className="size-5" />
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900">3. Get your SLAA ID</h3>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              Your verified SLAA ID card appears straight away. Print or save it for championships.
            </p>
          </div>
        </div>

        {/* Portals cards */}
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {/* Athlete Portal Card (Primary) */}
          <div className="flex flex-col justify-between rounded-2xl border-2 border-blue-600/20 bg-gradient-to-b from-blue-50/50 to-white p-6 shadow-sm">
            <div>
              <div className="inline-flex rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white">
                Athlete Portal
              </div>
              <h3 className="mt-3 text-xl font-bold text-slate-900">{t(lang, "homeAthleteTitle")}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                {t(lang, "homeAthleteText")} Register your track and field events and link with your coach.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100">
              <Link
                href="/register/check?for=athlete"
                className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-800"
              >
                <span>Proceed to Athlete Registration</span>
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>

          {/* Coach Portal Card */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <div className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                Coach Portal
              </div>
              <h3 className="mt-3 text-xl font-bold text-slate-900">{t(lang, "homeCoachTitle")}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                {t(lang, "homeCoachText")} Conforming to World Athletics CECS standards, qualification verification, and athlete links.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100">
              <Link
                href="/register/check?for=coach"
                className="inline-flex items-center gap-2 text-sm font-bold text-slate-900 hover:text-blue-600"
              >
                <span>Proceed to Coach Registration</span>
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Already Registered Note */}
        <div className="mt-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm text-sm text-slate-600 flex items-start gap-3">
          <CheckCircle2 className="size-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-slate-900">{t(lang, "homeAlreadyTitle")}</p>
            <p className="mt-0.5">{t(lang, "homeAlreadyText")}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
