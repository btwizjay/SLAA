import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { parseCsv } from "./csv";
import { coachCreateSchema } from "./admin-validation";
import { EVENTS, DISTRICTS } from "./reference";
import { parseNic } from "./nic";
import { initialsName } from "./names";
export const COACH_CSV_COLUMNS = [
  "full_name",
  "name_with_initials",
  "nic",
  "postal_id",
  "date_of_birth",
  "gender",
  "district",
  "phone",
  "email",
  "license_no",
  "license_level",
  "events",
];
export type CoachImportRow = ReturnType<typeof readCoachCsv>[number];
export function readCoachCsv(csv: string) {
  if (Buffer.byteLength(csv, "utf8") > 500000)
    throw new Error("Use a CSV file smaller than 500 KB.");
  const [header, ...records] = parseCsv(csv);
  if (!header || !records.length || records.length > 500)
    throw new Error("Choose a CSV containing between 1 and 500 coaches.");
  const names = header.map((h) => h.trim().toLowerCase());
  if (
    new Set(names).size !== names.length ||
    !names.includes("full_name") ||
    !names.includes("district") ||
    (!names.includes("nic") && !names.includes("postal_id"))
  )
    throw new Error(
      "Use the supplied coach CSV template with unique column names.",
    );
  const seen = new Set<string>(),
    licenses = new Set<string>();
  return records.map((record, index) => {
    const get = (key: string) => (record[names.indexOf(key)] ?? "").trim();
    if (record.length !== header.length)
      throw new Error(
        `Row ${index + 2}: the number of fields does not match the header.`,
      );
    const nic = get("nic"),
      decoded = parseNic(nic),
      postal = get("postal_id");
    if (nic && postal)
      throw new Error(`Row ${index + 2}: use an NIC or Postal ID, not both.`);
    const events = get("events")
      .split(/[;,|]/)
      .map((e) => e.trim())
      .filter(Boolean)
      .map(
        (raw) =>
          EVENTS.find(
            (e) =>
              e.code.toLowerCase() === raw.toLowerCase() ||
              e.name.toLowerCase() === raw.toLowerCase(),
          )?.code ?? raw,
      );
    const district =
      DISTRICTS.find(
        (d) => d.toLowerCase() === get("district").toLowerCase(),
      ) ?? get("district");
    const parsed = coachCreateSchema.safeParse({
      fullName: get("full_name"),
      nameWithInitials:
        get("name_with_initials") || initialsName(get("full_name")),
      identity: nic
        ? { type: "nic", nic }
        : { type: "postal", postalId: postal },
      dateOfBirth: decoded.ok ? decoded.info.dateOfBirth : get("date_of_birth"),
      gender: decoded.ok ? decoded.info.gender : get("gender").toUpperCase(),
      district,
      phone: get("phone"),
      email: get("email"),
      licenseNo: get("license_no"),
      licenseLevel: get("license_level"),
      disciplines: [...new Set(events)],
      consent: true,
      reason: "CSV import",
    });
    if (!parsed.success)
      throw new Error(
        `Row ${index + 2}: ${parsed.error.issues
          .map((i) => i.message)
          .slice(0, 2)
          .join(" ")}`,
      );
    const identity =
      parsed.data.identity.type === "nic"
        ? "nic:" + (decoded.ok ? decoded.info.normalized : nic)
        : "postal:" + postal.replace(/\s/g, "").toUpperCase();
    if (seen.has(identity))
      throw new Error(
        `Row ${index + 2}: this identity is repeated in the file.`,
      );
    seen.add(identity);
    if (parsed.data.licenseNo) {
      if (licenses.has(parsed.data.licenseNo))
        throw new Error(
          `Row ${index + 2}: this licence number is repeated in the file.`,
        );
      licenses.add(parsed.data.licenseNo);
    }
    return { ...parsed.data, line: index + 2 };
  });
}
export function previewDigest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function signature(actor: string, csv: string, plan: string, expires: string) {
  const key = process.env.ADMIN_JWT_SECRET;
  if (!key || key.length < 32)
    throw new Error("Staff authentication is not configured.");
  return createHmac("sha256", key)
    .update(
      JSON.stringify([
        "coach-import",
        actor,
        previewDigest(csv),
        plan,
        expires,
      ]),
    )
    .digest("hex");
}
export function signImportPreview(actor: string, csv: string, plan: string) {
  const exp = String(Math.floor(Date.now() / 1000) + 900);
  return exp + "." + signature(actor, csv, plan, exp);
}
export function validImportPreview(
  token: string,
  actor: string,
  csv: string,
  plan: string,
) {
  const [exp, mac, ...rest] = token.split(".");
  if (
    rest.length ||
    !/^\d+$/.test(exp ?? "") ||
    Number(exp) < Date.now() / 1000 ||
    !/^[a-f0-9]{64}$/.test(mac ?? "")
  )
    return false;
  return timingSafeEqual(
    Buffer.from(mac),
    Buffer.from(signature(actor, csv, plan, exp)),
  );
}
