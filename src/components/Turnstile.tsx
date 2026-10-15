"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

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
      s.onload = () => resolve();
      s.onerror = () => {
        scriptPromise = null;
        reject(new Error("Could not load the security check"));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

const TEST_SITEKEY = "1x00000000000000000000AA";

/** Cloudflare Turnstile widget. Tokens are single use: call reset() after each submit. */
export const Turnstile = forwardRef<TurnstileHandle, { onToken?: (token: string) => void }>(
  function Turnstile({ onToken }, ref) {
    const el = useRef<HTMLDivElement>(null);
    const widgetId = useRef<string | null>(null);
    const token = useRef("");
    const waiters = useRef<((t: string) => void)[]>([]);
    const onTokenRef = useRef<(t: string) => void>(() => {});
    const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || TEST_SITEKEY;

    onTokenRef.current = (t: string) => {
      token.current = t;
      if (t) {
        waiters.current.forEach((w) => w(t));
        waiters.current = [];
      }
      onToken?.(t);
    };

    useImperativeHandle(ref, () => ({
      reset() {
        onTokenRef.current("");
        if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
      },
      getToken(timeoutMs = 10000) {
        if (token.current) return Promise.resolve(token.current);
        return new Promise<string>((resolve) => {
          const timer = setTimeout(() => {
            // In dev mode or when using Cloudflare's always-pass test key,
            // fallback to test token if Cloudflare is unreachable
            if (process.env.NODE_ENV !== "production" || sitekey === TEST_SITEKEY) {
              resolve(TEST_SITEKEY);
            } else {
              resolve("");
            }
          }, timeoutMs);
          waiters.current.push((t) => {
            clearTimeout(timer);
            resolve(t);
          });
        });
      },
    }));

    useEffect(() => {
      let cancelled = false;
      loadScript()
        .then(() => {
          if (cancelled || !el.current || !window.turnstile) return;
          widgetId.current = window.turnstile.render(el.current, {
            sitekey,
            callback: (t: string) => onTokenRef.current(t),
            "expired-callback": () => onTokenRef.current(""),
            "error-callback": () => {
              if (process.env.NODE_ENV !== "production" || sitekey === TEST_SITEKEY) {
                onTokenRef.current(TEST_SITEKEY);
              } else {
                onTokenRef.current("");
              }
            },
            appearance: "interaction-only",
          });
        })
        .catch(() => {
          if (process.env.NODE_ENV !== "production" || sitekey === TEST_SITEKEY) {
            onTokenRef.current(TEST_SITEKEY);
          } else {
            onTokenRef.current("");
          }
        });
      return () => {
        cancelled = true;
        if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      };
    }, [sitekey]);

    return <div ref={el} className="min-h-0" />;
  },
);
