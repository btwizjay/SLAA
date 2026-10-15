/** 'Kamal Pradeep Perera' -> 'K. P. Perera'. Used where only initials may be shown. */
export function initialsName(fullName: string): string {
  const words = (fullName ?? "").trim().split(/[\s.]+/).filter(Boolean);
  if (words.length <= 1) return words[0] ?? "";
  const last = words[words.length - 1];
  return words
    .slice(0, -1)
    .map((w) => w[0].toUpperCase() + ".")
    .concat(last)
    .join(" ");
}
