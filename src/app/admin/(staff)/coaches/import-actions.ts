"use server";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import {
  readCoachCsv,
  previewDigest,
  signImportPreview,
  validImportPreview,
} from "@/lib/coach-import";
import { cleanText, normalizeIdentity, normalizePhone } from "@/lib/validation";
import { mapPgError } from "@/lib/errors";
import type { ImportState } from "@/lib/coach-import-types";
export async function importCoaches(
  _state: ImportState,
  data: FormData,
): Promise<ImportState> {
  const actor = await requireAdmin(),
    csv = String(data.get("csv") ?? "");
  let records;
  try {
    records = readCoachCsv(csv);
  } catch (e) {
    return { error: (e as Error).message };
  }
  const identities = records.map((r) => normalizeIdentity(r.identity));
  const nics = identities.flatMap((i) => (i.nic ? [i.nic] : [])),
    postals = identities.flatMap((i) => (i.postalId ? [i.postalId] : []));
  const existing =
    await sql`SELECT m.slaa_id,m.nic::text,m.postal_id,m.full_name,m.status,m.updated_at::text version,c.slaa_id IS NOT NULL coach
    FROM member m LEFT JOIN coach c USING(slaa_id) WHERE m.status <> 'merged' AND (m.nic::text=ANY(${nics}::text[]) OR m.postal_id=ANY(${postals}::text[]))`;
  const plan = records.map((record, index) => {
    const identity = identities[index],
      found = existing.find((m) =>
        identity.nic
          ? m.nic === identity.nic
          : m.postal_id === identity.postalId,
      );
    return {
      record,
      identity,
      existingId: found?.slaa_id ?? null,
      existingName: found?.full_name ?? null,
      version: found?.version ?? null,
      status: found?.status ?? null,
      action: found?.coach
        ? "Already a coach — skip"
        : found
          ? "Add coach role to existing member"
          : "Create coach",
    };
  });
  const suspended = plan.find((p) => p.status === "suspended");
  if (suspended)
    return {
      error: `Row ${suspended.record.line}: this member is suspended; review their profile before importing.`,
    };
  const licenses = records.map((r) => r.licenseNo).filter(Boolean);
  if (licenses.length) {
    const used =
      await sql`SELECT slaa_id,slaa_license_no FROM coach WHERE slaa_license_no=ANY(${licenses}::text[])`;
    const clash = plan.find(
      (p) =>
        p.record.licenseNo &&
        used.some(
          (c) =>
            c.slaa_license_no === p.record.licenseNo &&
            c.slaa_id !== p.existingId,
        ),
    );
    if (clash)
      return {
        error: `Row ${clash.record.line}: this licence belongs to another registered coach.`,
      };
  }
  const digest = previewDigest(plan);
  if (data.get("mode") !== "commit")
    return {
      token: signImportPreview(actor, csv, digest),
      rows: plan.map((p) => ({
        line: p.record.line,
        name: p.record.fullName,
        identityType: p.record.identity.type,
        action: p.action,
        existingId: p.existingId,
        existingName: p.existingName,
      })),
    };
  if (!validImportPreview(String(data.get("token") ?? ""), actor, csv, digest))
    return {
      error:
        "The preview expired or the file/register changed. Preview this file again before importing.",
    };
  const reason = String(data.get("reason") ?? "").trim();
  if (!reason || reason.length > 500 || data.get("consent") !== "on")
    return {
      error:
        "Give the source or reason, and confirm that these coaches authorized SLAA to store their records.",
    };
  if (
    plan.some((p) => p.existingId && !p.action.includes("skip")) &&
    data.get("linkExisting") !== "on"
  )
    return {
      error:
        "Confirm adding coach roles to matched existing members. Their personal details and SLAA IDs will be preserved.",
    };
  let created = 0,
    linked = 0,
    skipped = 0;
  try {
    await sql.begin(async (tx) => {
      for (const p of plan) {
        if (p.action.includes("skip")) {
          skipped++;
          continue;
        }
        const r = p.record;
        let id = p.existingId;
        if (id) {
          const [locked] =
            await tx`SELECT status,updated_at::text version FROM member WHERE slaa_id=${id} FOR UPDATE`;
          if (
            !locked ||
            locked.status === "merged" ||
            locked.status === "suspended" ||
            locked.version !== p.version
          )
            throw new Error("changed");
          linked++;
        } else {
          const [m] =
            await tx`INSERT INTO member(slaa_id,nic_as_entered,postal_id,full_name,name_with_initials,date_of_birth,gender,district,phone,email,consent_version,consent_at)
          VALUES(new_slaa_id('C'),${r.identity.type === "nic" ? r.identity.nic : null},${p.identity.postalId},${cleanText(r.fullName)},${cleanText(r.nameWithInitials)},${r.dateOfBirth},${r.gender},${r.district},${r.phone ? normalizePhone(r.phone) : null},${r.email || null},'staff-import-v1',now()) RETURNING slaa_id`;
          id = m.slaa_id;
          created++;
        }
        await tx`INSERT INTO coach(slaa_id,slaa_license_no,license_level,disciplines) VALUES(${id},${r.licenseNo || null},${r.licenseLevel || null},${r.disciplines})`;
        await tx`INSERT INTO audit_log(actor,action,slaa_id,details) VALUES(${actor},'import_coach',${id},${tx.json({ reason, existing_member: !!p.existingId })})`;
      }
      await tx`INSERT INTO audit_log(actor,action,details) VALUES(${actor},'import_coaches',${tx.json({ reason, created, linked, skipped, file_digest: previewDigest(csv) })})`;
    });
  } catch (e) {
    return {
      error:
        mapPgError(e)?.message ??
        "The register changed or the import could not finish. Nothing was imported; preview again.",
    };
  }
  revalidatePath("/admin", "layout");
  return {
    success: `Import complete: ${created} new coaches, ${linked} existing members given coach profiles, ${skipped} already registered coaches skipped.`,
  };
}
