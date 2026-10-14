"use client";

import { useRef, useState } from "react";

// Wraps the members table in a form: row checkboxes (name="ids"), a
// select-all box, and the bulk delete bar that appears once a row is ticked.

export function BulkSelectForm({
  action,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  children: React.ReactNode;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [count, setCount] = useState(0);

  const boxes = () => Array.from(form.current?.querySelectorAll<HTMLInputElement>('input[name="ids"]') ?? []);
  const recount = () => {
    const all = boxes();
    const n = all.filter((b) => b.checked).length;
    setCount(n);
    const master = form.current?.querySelector<HTMLInputElement>("input[data-select-all]");
    if (master) {
      master.checked = n > 0 && n === all.length;
      master.indeterminate = n > 0 && n < all.length;
    }
  };

  return (
    <form
      ref={form}
      action={action}
      onChange={(e) => {
        const t = e.target as unknown as HTMLInputElement;
        if (t.dataset.selectAll !== undefined) boxes().forEach((b) => (b.checked = t.checked));
        if (t.type === "checkbox") recount();
      }}
      onSubmit={(e) => {
        if (!window.confirm(`Permanently delete ${count} account${count === 1 ? "" : "s"}? This cannot be undone.`)) {
          e.preventDefault();
        }
      }}
      className="flex flex-col gap-3"
    >
      {children}
      {count > 0 && (
        <div className="sticky bottom-3 z-10 flex flex-wrap items-end gap-2 rounded-lg border border-red-200 bg-background p-3 text-sm shadow-lg">
          <p className="mr-2 self-center font-medium">
            {count} selected
          </p>
          <label className="flex flex-col text-xs text-muted-foreground">
            Reason
            <input name="reason" required maxLength={500} placeholder="e.g. Test entries"
              className="h-9 w-56 rounded-md border px-2 text-sm text-foreground" />
          </label>
          <label className="flex flex-col text-xs text-muted-foreground">
            Type DELETE to confirm
            <input name="confirm" required autoComplete="off" pattern="DELETE"
              className="h-9 w-36 rounded-md border px-2 font-mono text-sm text-foreground" />
          </label>
          <button className="h-9 rounded-md bg-red-700 px-4 text-white">Delete selected</button>
          <button type="button" className="h-9 px-2 text-muted-foreground underline"
            onClick={() => { boxes().forEach((b) => (b.checked = false)); recount(); }}>
            Clear selection
          </button>
        </div>
      )}
    </form>
  );
}

export function SelectAllBox() {
  return <input type="checkbox" data-select-all aria-label="Select all on this page" className="size-4 accent-primary" />;
}

export function RowBox({ id, label }: { id: string; label: string }) {
  return <input type="checkbox" name="ids" value={id} aria-label={`Select ${label}`} className="size-4 accent-primary" />;
}
