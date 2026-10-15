"use client";

import type { Identity } from "./validation";

// Carries the checked identity from step 1 to the form, and the new SLAA ID
// to the done page. sessionStorage only: it dies with the tab, and the server
// re-checks everything anyway.

export type CheckedIdentity = { identity: Identity; checkedAt: number; registrationType: "coach" | "athlete" };
export type DoneInfo = { slaaId: string; name: string; coachLinks: number; registrationType: "coach" | "athlete"; pendingUploads?: { qualificationIndex: number; file: string }[] };

const IDENTITY_KEY = "slaa.identity";
const DONE_KEY = "slaa.done";
const MAX_AGE_MS = 60 * 60 * 1000;

function read<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage blocked: the flow still works within this page load
  }
}

export function saveCheckedIdentity(v: Omit<CheckedIdentity, "checkedAt">) {
  write(IDENTITY_KEY, { ...v, checkedAt: Date.now() });
}

export function loadCheckedIdentity(): CheckedIdentity | null {
  const v = read<CheckedIdentity>(IDENTITY_KEY);
  if (!v || Date.now() - v.checkedAt > MAX_AGE_MS) return null;
  return v;
}

export function clearCheckedIdentity() {
  write(IDENTITY_KEY, null);
}

export function saveDone(v: DoneInfo) {
  write(DONE_KEY, v);
}

export function loadDone(): DoneInfo | null {
  return read<DoneInfo>(DONE_KEY);
}
