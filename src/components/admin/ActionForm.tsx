"use client";
import { startTransition, useActionState } from "react";
import type { ActionState } from "@/lib/admin-ui";
export function ActionForm({
  action,
  children,
  submit = "Save changes",
  className = "",
}: {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  children?: React.ReactNode;
  submit?: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
      className={`flex flex-col gap-3 ${className}`}
    >
      {children}
      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {state.error}
        </p>
      )}
      {state.success && (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
        >
          {state.success}
        </p>
      )}
      <button
        disabled={pending}
        className="min-h-11 self-start rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Please wait…" : submit}
      </button>
    </form>
  );
}
