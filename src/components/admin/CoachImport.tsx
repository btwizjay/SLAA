"use client";
import { startTransition, useActionState, useState } from "react";
import { importCoaches } from "@/app/admin/(staff)/coaches/import-actions";
import type { ImportState } from "@/lib/coach-import-types";
export function CoachImport() {
  const [csv, setCsv] = useState(""),
    [fileError, setFileError] = useState("");
  const [state, dispatch, pending] = useActionState<ImportState, FormData>(
    importCoaches,
    {},
  );
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Upload the supplied UTF-8 template (up to 500 rows / 500 KB). Preview
        validates every row without changing records or reserving IDs. Import is
        one transaction.
      </p>
      <a
        href="/api/admin/coach-template"
        className="inline-block text-sm font-medium text-primary underline"
      >
        Download coach CSV template
      </a>
      <label className="block text-sm font-medium">
        Coach CSV file
        <input
          type="file"
          accept=".csv,text/csv"
          className="mt-2 block w-full rounded-lg border p-2"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            setCsv("");
            setFileError("");
            if (!file) return;
            if (file.size > 500000) {
              setFileError("Choose a CSV smaller than 500 KB.");
              return;
            }
            setCsv(await file.text());
          }}
        />
      </label>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          data.set(
            "mode",
            (
              (e.nativeEvent as SubmitEvent)
                .submitter as HTMLButtonElement | null
            )?.value ?? "preview",
          );
          startTransition(() => dispatch(data));
        }}
        className="space-y-3"
      >
        <input type="hidden" name="csv" value={csv} />
        <input type="hidden" name="token" value={state.token ?? ""} />
        <label className="block text-sm">
          Source or reason
          <textarea
            name="reason"
            maxLength={500}
            rows={2}
            className="mt-1 w-full rounded-lg border p-3"
          />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="consent" className="mt-1" />
          These coaches authorized SLAA to store their records, and I have
          checked the source.
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="linkExisting" className="mt-1" />
          Add coach roles to matched existing members while preserving their
          personal details and SLAA IDs.
        </label>
        {(state.error || fileError) && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
          >
            {fileError || state.error}
          </p>
        )}
        {state.success && (
          <p
            role="status"
            className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"
          >
            {state.success}
          </p>
        )}
        <div className="flex gap-2">
          <button
            name="mode"
            value="preview"
            disabled={!csv || pending}
            className="min-h-11 rounded-lg border px-4 text-sm disabled:opacity-50"
          >
            Preview CSV
          </button>
          <button
            name="mode"
            value="commit"
            disabled={!csv || !state.token || pending}
            className="min-h-11 rounded-lg bg-primary px-4 text-sm text-white disabled:opacity-50"
          >
            Import reviewed CSV
          </button>
        </div>
        {pending && (
          <p role="status" className="text-sm">
            Processing the coach file…
          </p>
        )}
      </form>
      {!!state.rows?.length && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                {["Row", "Coach", "Planned action", "Existing member"].map(
                  (x) => (
                    <th className="p-2" key={x}>
                      {x}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {state.rows.map((r) => (
                <tr key={r.line}>
                  <td className="p-2">{r.line}</td>
                  <td className="p-2">{r.name}</td>
                  <td className="p-2">{r.action}</td>
                  <td className="p-2">
                    {r.existingId
                      ? `${r.existingId} · ${r.existingName}`
                      : "New member"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
