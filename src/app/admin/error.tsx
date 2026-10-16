"use client";
export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-12">
      <h1 className="text-xl font-bold">
        The staff page could not finish loading
      </h1>
      <p className="text-sm text-muted-foreground">
        Please try again. If this happened while saving, check the member record
        and audit log before repeating the change.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-primary px-4 py-2 text-sm text-white"
        >
          Try again
        </button>
        <a href="/admin/login" className="px-4 py-2 text-sm text-primary">
          Staff sign in
        </a>
      </div>
    </div>
  );
}
