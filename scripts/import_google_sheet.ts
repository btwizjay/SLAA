/**
 * Import Phase 1 coach registrations from the Google Form response sheet.
 *
 *   npx tsx scripts/import_google_sheet.ts responses.csv --dry-run
 *   npx tsx scripts/import_google_sheet.ts responses.csv
 *
 * Connects with IMPORT_DATABASE_URL (falls back to DATABASE_URL). Moving the
 * coach sequence needs a role with UPDATE on coach_id_seq, so use the owner
 * connection, not slaa_app.
 *
 * - Rows whose Status starts with DUPLICATE are skipped.
 * - Each coach keeps the provisional SLAA ID from the sheet.
 * - Rows that fail (bad NIC, no DOB for Postal ID rows, unknown district,
 *   already registered...) go to import_errors.csv. Nothing is dropped silently.
 * - --dry-run does everything inside a transaction and rolls it back.
 */
import { readFileSync, writeFileSync } from "node:fs";
import postgres from "postgres";
import { mapPgError } from "../src/lib/errors";
import { initialsName } from "../src/lib/names";
import { parseNic } from "../src/lib/nic";
import { DISTRICTS, EVENTS } from "../src/lib/reference";
import { isValidSlaaId } from "../src/lib/slaa-id";
import { PHONE_REGEX, cleanPhone, cleanText, normalizePhone, normalizePostalId } from "../src/lib/validation";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");
if (!file) {
  console.error("usage: tsx scripts/import_google_sheet.ts <responses.csv> [--dry-run]");
  process.exit(1);
}

// --- CSV -------------------------------------------------------------------

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

function csvLine(cells: string[]) {
  return cells.map((c) => (/[",\n\r]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",");
}

// --- column mapping ----------------------------------------------------------

const COLUMNS = {
  timestamp: /timestamp/i,
  fullName: /full\s*name/i,
  identity: /nic|postal/i,
  phone: /phone|mobile/i,
  email: /e-?mail/i,
  district: /district/i,
  licenseNo: /licen[cs]e/i,
  events: /event|discipline/i,
  normalisedId: /normali[sz]ed/i,
  provisionalId: /provisional|slaa\s*id/i,
  status: /^status/i,
} as const;
type Col = keyof typeof COLUMNS;

function mapHeader(header: string[]): Record<Col, number> {
  const out = {} as Record<Col, number>;
  const used = new Set<number>();
  // most specific first so "Normalised ID" is not taken as the identity column
  for (const key of ["timestamp", "normalisedId", "provisionalId", "status", "fullName", "identity", "phone", "email",
    "district", "licenseNo", "events"] as Col[]) {
    const idx = header.findIndex((h, i) => !used.has(i) && COLUMNS[key].test(h));
    if (idx === -1) throw new Error(`Column for "${key}" not found in header: ${header.join(" | ")}`);
    out[key] = idx;
    used.add(idx);
  }
  return out;
}

// --- value helpers -----------------------------------------------------------

const EVENT_LOOKUP = new Map<string, string>();
for (const e of EVENTS) {
  EVENT_LOOKUP.set(e.code.toLowerCase(), e.code);
  EVENT_LOOKUP.set(e.name.toLowerCase(), e.code);
}
const EVENT_ALIASES: Record<string, string> = {
  "high jump": "HJ", "pole vault": "PV", "long jump": "LJ", "triple jump": "TJ", "shot put": "SP",
  discus: "DT", hammer: "HT", javelin: "JT", steeplechase: "3000mSC", heptathlon: "HEP", decathlon: "DEC",
  "race walk": "RW", "race walking": "RW", walk: "RW", "4x100": "4x100m", "4x400": "4x400m",
  "100m hurdles": "100mH", "110m hurdles": "110mH", "400m hurdles": "400mH",
};

function mapEvents(raw: string): { codes: string[]; unknown: string[] } {
  const codes: string[] = [];
  const unknown: string[] = [];
  for (const part of raw.split(/[,;/\n]+/).map((p) => p.trim()).filter(Boolean)) {
    const key = part.toLowerCase().replace(/\s+/g, " ").replace(/(\d)\s*m\b/, "$1m");
    const code = EVENT_LOOKUP.get(key) ?? EVENT_ALIASES[key] ?? EVENT_LOOKUP.get(key.replace(/ /g, ""));
    if (code) {
      if (!codes.includes(code)) codes.push(code);
    } else unknown.push(part);
  }
  return { codes, unknown };
}

function mapDistrict(raw: string) {
  const v = cleanText(raw).toLowerCase();
  return DISTRICTS.find((d) => d.toLowerCase() === v) ?? null;
}

/** Google Sheets timestamps: ISO, or d/m/yyyy h:mm:ss (Sri Lanka locale). */
function parseTimestamp(raw: string): Date | null {
  const v = raw.trim();
  if (!v) return null;
  const iso = Date.parse(v);
  if (/^\d{4}-/.test(v) && !Number.isNaN(iso)) return new Date(iso);
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const [, d, mo, y, h = "0", mi = "0", s = "0"] = m;
  // Sri Lanka is UTC+05:30
  return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s) - 5.5 * 3600 * 1000);
}

// --- import ------------------------------------------------------------------

type Outcome = { imported: number; skippedDuplicates: number; alreadyInDb: number; errors: number; warnings: number };

async function main() {
  const rows = parseCsv(readFileSync(file!, "utf8"));
  const [header, ...data] = rows;
  const col = mapHeader(header);
  const url = process.env.IMPORT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Set IMPORT_DATABASE_URL (owner connection) or DATABASE_URL");

  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {}, connection: { search_path: "slaa,public" } });
  const errors: string[][] = [];
  const warnings: string[][] = [];
  const out: Outcome = { imported: 0, skippedDuplicates: 0, alreadyInDb: 0, errors: 0, warnings: 0 };
  let maxSerial = 0;

  const fail = (rowNo: number, r: string[], reason: string) => {
    errors.push([String(rowNo), reason, ...r]);
    out.errors++;
  };

  class Rollback extends Error {}

  try {
    await sql.begin(async (tx) => {
      for (let i = 0; i < data.length; i++) {
        const r = data[i];
        const rowNo = i + 2; // spreadsheet row number (header is row 1)
        const get = (c: Col) => (r[col[c]] ?? "").trim();

        if (/^DUPLICATE/i.test(get("status"))) {
          out.skippedDuplicates++;
          continue;
        }

        const slaaId = get("provisionalId").toUpperCase();
        if (!isValidSlaaId(slaaId) || !slaaId.startsWith("C")) {
          fail(rowNo, r, `Provisional SLAA ID "${slaaId}" is missing or has a wrong check digit`);
          continue;
        }

        const fullName = cleanText(get("fullName"));
        if (!fullName) {
          fail(rowNo, r, "Full name is empty");
          continue;
        }
        const district = mapDistrict(get("district"));
        if (!district) {
          fail(rowNo, r, `Unknown district "${get("district")}"`);
          continue;
        }

        // Identity: NIC gives DOB and gender. A Postal ID row has neither, so it needs manual follow-up.
        const idRaw = get("identity");
        const nic = parseNic(idRaw);
        let nicEntered: string | null = null;
        let postalId: string | null = null;
        let dob: string;
        let gender: string;
        if (nic.ok) {
          nicEntered = idRaw.replace(/\s/g, "").toUpperCase();
          ({ dateOfBirth: dob, gender } = nic.info);
        } else if (/^[0-9]{9}[VvXx]$|^[0-9]{12}$/.test(idRaw.replace(/\s/g, ""))) {
          fail(rowNo, r, `NIC is not valid: ${nic.error}`);
          continue;
        } else if (idRaw) {
          postalId = normalizePostalId(idRaw);
          fail(rowNo, r, "Postal ID row: date of birth and gender are not in the sheet; collect them and register manually");
          continue;
        } else {
          fail(rowNo, r, "No NIC or Postal ID");
          continue;
        }

        const phoneRaw = cleanPhone(get("phone"));
        const phone = PHONE_REGEX.test(phoneRaw) ? normalizePhone(phoneRaw) : phoneRaw || null;
        if (phoneRaw && !PHONE_REGEX.test(phoneRaw)) warnings.push([String(rowNo), slaaId, `Phone kept as typed: ${phoneRaw}`]);

        const { codes, unknown } = mapEvents(get("events"));
        if (unknown.length) warnings.push([String(rowNo), slaaId, `Events not recognised (not imported): ${unknown.join("; ")}`]);

        const consentAt = parseTimestamp(get("timestamp")) ?? new Date();

        try {
          await tx.savepoint(async (sp) => {
            await sp`
              INSERT INTO member (slaa_id, nic_as_entered, postal_id, full_name, name_with_initials, date_of_birth,
                                  gender, district, phone, email, consent_version, consent_at, created_at)
              VALUES (${slaaId}, ${nicEntered}, ${postalId}, ${fullName}, ${initialsName(fullName)}, ${dob},
                      ${gender}, ${district}, ${phone}, ${get("email").toLowerCase() || null},
                      'google-form-phase1', ${consentAt}, ${consentAt})`;
            await sp`
              INSERT INTO coach (slaa_id, slaa_license_no, disciplines)
              VALUES (${slaaId}, ${cleanText(get("licenseNo")).toUpperCase() || null}, ${codes})`;
            await sp`
              INSERT INTO audit_log (actor, action, slaa_id, details)
              VALUES ('import', 'import_google_form', ${slaaId}, ${sp.json({ sheet_row: rowNo })})`;
          });
          out.imported++;
        } catch (e) {
          const err = e as { code?: string; constraint_name?: string };
          if (err.code === "23505" && err.constraint_name === "member_pkey") {
            out.alreadyInDb++;
            continue;
          }
          fail(rowNo, r, mapPgError(e)?.message ?? String((e as Error).message));
        }
      }

      // Every provisional ID in the sheet was already shown to someone, including rows that
      // failed or were marked DUPLICATE, so the sequence must pass all of them.
      // Never move it backwards.
      for (const r of data) {
        const v = (r[col.provisionalId] ?? "").trim().toUpperCase();
        const m = v.match(/^C\d{2}-(\d{6})/); // count it even if the check digit was mistyped
        if (m) maxSerial = Math.max(maxSerial, Number(m[1]));
      }
      if (maxSerial > 0) {
        await tx`
          SELECT setval('coach_id_seq', GREATEST(${maxSerial}, (SELECT last_value FROM coach_id_seq)))`;
      }
      if (dryRun) throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  } finally {
    await sql.end();
  }

  out.warnings = warnings.length;
  if (errors.length) writeFileSync("import_errors.csv", [csvLine(["sheet_row", "reason", ...header]), ...errors.map(csvLine)].join("\n") + "\n");
  if (warnings.length) writeFileSync("import_warnings.csv", [csvLine(["sheet_row", "slaa_id", "warning"]), ...warnings.map(csvLine)].join("\n") + "\n");

  console.log(dryRun ? "\nDRY RUN — nothing was saved\n" : "\nImport finished\n");
  console.log(`  rows in sheet           ${data.length}`);
  console.log(`  imported                ${out.imported}`);
  console.log(`  skipped (DUPLICATE)     ${out.skippedDuplicates}`);
  console.log(`  already in database     ${out.alreadyInDb}`);
  console.log(`  errors                  ${out.errors}${out.errors ? "  -> import_errors.csv" : ""}`);
  console.log(`  warnings                ${out.warnings}${out.warnings ? "  -> import_warnings.csv" : ""}`);
  console.log(`  coach_id_seq moved to   ${maxSerial || "(unchanged)"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
