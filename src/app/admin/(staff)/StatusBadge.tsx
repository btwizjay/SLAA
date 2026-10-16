import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900",
  verified: "bg-emerald-100 text-emerald-900",
  approved: "bg-emerald-100 text-emerald-900",
  suspended: "bg-red-100 text-red-900",
  merged: "bg-zinc-200 text-zinc-700",
  invited: "bg-sky-100 text-sky-900",
  registered: "bg-emerald-100 text-emerald-900",
  rejected: "bg-zinc-200 text-zinc-700",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
        STYLES[status] ?? "bg-muted",
      )}
    >
      {status}
    </span>
  );
}
