"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy message" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="h-8 rounded-md border px-3 text-xs hover:bg-muted"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          window.prompt("Copy this message:", text);
        }
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}
