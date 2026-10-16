export function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false;
  const text = source.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
        closed = true;
      } else field += ch;
    } else if (ch === ",") {
      row.push(field);
      field = "";
      closed = false;
    } else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      field = "";
      closed = false;
    } else if (ch === '"' && !field && !closed) quoted = true;
    else if (closed) {
      if (!/\s/.test(ch))
        throw new Error("Unexpected text after a quoted CSV field.");
    } else if (ch === '"')
      throw new Error(
        "Quote a complete CSV field, and escape embedded quotes by doubling them.",
      );
    else field += ch;
  }
  if (quoted) throw new Error("An opening CSV quote is not closed.");
  if (field || row.length || closed) {
    row.push(field);
    if (row.some((c) => c.trim())) rows.push(row);
  }
  return rows;
}
export function toCsv(rows: Record<string, unknown>[], columns: string[]) {
  const cell = (value: unknown) => {
    let text =
      value == null
        ? ""
        : value instanceof Date
          ? value.toISOString()
          : Array.isArray(value)
            ? value.join("; ")
            : typeof value === "object"
              ? JSON.stringify(value)
              : String(value);
    if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r]/.test(text)) text = "'" + text;
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  };
  return (
    "\uFEFF" +
    [
      columns.map(cell).join(","),
      ...rows.map((r) => columns.map((c) => cell(r[c])).join(",")),
    ].join("\r\n") +
    "\r\n"
  );
}
