"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useT } from "@/components/LangProvider";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

export type TurnstileHandle = {
  reset: () => void;
  /** Resolves with the current token, waiting for the widget if needed ("" on timeout). */
  getToken: (timeoutMs?: number) => Promise<string>;
};

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | null = null;

function loadScript() {
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      if (window.turnstile) return resolve();
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      const fail = () => {
        clearTimeout(timer);
        s.remove();
        scriptPromise = null;
        reject(new Error("Could not load the security check"));
      };
      const timer = setTimeout(fail, 15000);
      s.onload = () => {
        clearTimeout(timer);
        if (window.turnstile) resolve();
        else fail();
      };
      s.onerror = fail;
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

/** Cloudflare Turnstile widget. Tokens are single use: call reset() after each submit. */
export const Turnstile = forwardRef<TurnstileHandle, { onToken?: (token: string) => void }>(
  function Turnstile({ onToken }, ref) {
    const { t } = useT();
    const [attempt, setAttempt] = useState(0);
    const [status, setStatus] = useState<"loading" | "ready" | "verified" | "failed">("loading");
    const container = useRef<HTMLDivElement>(null);
    const el = useRef<HTMLDivElement>(null);
    const widgetId = useRef<string | null>(null);
    const token = useRef("");
    const waiters = useRef(new Set<(t: string) => void>());
    const onTokenRef = useRef<(t: string) => void>(() => {});
    onTokenRef.current = (t: string) => {
      token.current = t;
      if (t) {
        waiters.current.forEach((w) => w(t));
        waiters.current.clear();
      }
      onToken?.(t);
    };

    useImperativeHandle(ref, () => ({
      reset() {
        onTokenRef.current("");
        if (widgetId.current && window.turnstile) {
          setStatus("ready");
          window.turnstile.reset(widgetId.current);
        }
      },
      getToken(timeoutMs = 30000) {
        if (token.current) return Promise.resolve(token.current);
        container.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        return new Promise<string>((resolve) => {
          const finish = (t: string) => {
            clearTimeout(timer);
            waiters.current.delete(finish);
            resolve(t);
          };
          const timer = setTimeout(() => finish(""), timeoutMs);
          waiters.current.add(finish);
        });
      },
    }));

    useEffect(() => {
      let cancelled = false;
      const pendingWaiters = waiters.current;
      loadScript()
        .then(() => {
          if (cancelled || !el.current || !window.turnstile) return;
          const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
            || (process.env.NODE_ENV !== "production" ? "1x00000000000000000000AA" : "");
          if (!sitekey) throw new Error("Turnstile site key is missing");
          setStatus("ready");
          widgetId.current = window.turnstile.render(el.current, {
            sitekey,
            callback: (value: string) => {
              setStatus("verified");
              onTokenRef.current(value);
            },
            "expired-callback": () => { setStatus("ready"); onTokenRef.current(""); },
            "timeout-callback": () => { setStatus("failed"); onTokenRef.current(""); },
            "error-callback": () => { setStatus("failed"); onTokenRef.current(""); },
            appearance: "always",
            size: window.matchMedia("(max-width: 359px)").matches ? "compact" : "flexible",
          });
        })
        .catch(() => {
          if (cancelled) return;
          setStatus("failed");
          onTokenRef.current("");
        });
      return () => {
        cancelled = true;
        if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
        widgetId.current = null;
        token.current = "";
        pendingWaiters.forEach((finish) => finish(""));
      };
    }, [attempt]);

    return (
      <div ref={container} className="mb-4 min-w-0 scroll-mt-28 scroll-mb-32 rounded-xl border bg-muted/20 p-3">
        <p className="mb-2 text-sm" role="status">
          {status === "failed" ? t("securityNotLoaded")
            : status === "verified" ? t("securityVerified") : t("securityHint")}
        </p>
        <div ref={el} className="min-h-[65px]" />
        <button type="button" className="mt-2 min-h-10 text-sm font-medium text-primary underline underline-offset-4"
          onClick={() => {
            onTokenRef.current("");
            setStatus("loading");
            setAttempt((n) => n + 1);
          }}>
          {t("securityRetry")}
        </button>
      </div>
    );
  },
);
