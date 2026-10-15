import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { sqlCoach, sqlAthlete } from "@/lib/db";
import { CONSENT_VERSION, errorResponse, parseRegistration, personFromIdentity } from "@/lib/register";
import {
  cleanText,
  coachRegisterSchema,
  normalizeIdentity,
  normalizePhone,
} from "@/lib/validation";
import { checkDigit } from "@/lib/slaa-id";

export async function POST(req: Request) {
  const parsed = await parseRegistration(req, coachRegisterSchema);
  if ("response" in parsed) return parsed.response;
  const { identity, form } = parsed.data;

  const id = normalizeIdentity(identity);
  const person = personFromIdentity(identity, form);

  // Digital signature check: trimmed case-insensitive match against full name
  const trimmedSig = form.signature.trim().toLowerCase();
  const trimmedName = person.fullName.trim().toLowerCase();
  if (trimmedSig !== trimmedName) {
    return NextResponse.json(
      {
        error: "Digital signature does not match your full name.",
        fields: { signature: "Signature must match your full name entered in Step 1." },
      },
      { status: 400 },
    );
  }

  // Ensure all declarations have answers and disclosures have details
  for (const d of form.declarations) {
    if (d.answer === "disclose" && (!d.disclosureDetails || !d.disclosureDetails.trim())) {
      return NextResponse.json(
        {
          error: "Disclosure details are required when disclosing a matter.",
          fields: { [`declarations.${d.code}`]: "Please provide disclosure details." },
        },
        { status: 400 },
      );
    }
  }

  const userAgent = req.headers.get("user-agent") ?? "unknown";
  const ipAddress = isIP(parsed.ip) ? parsed.ip : null;

  try {
    // Cross-database athlete validation if coach provided linked athletes
    let validAthleteIds = new Set<string>();
    if (form.athletes && form.athletes.length > 0) {
      const candidateIds = [...new Set(form.athletes.map((a) => a.athleteId.toUpperCase()))];
      try {
        const foundAthletes = await sqlAthlete<{ slaa_id: string }[]>`
          SELECT a.slaa_id FROM athlete a JOIN member m USING (slaa_id)
          WHERE a.slaa_id IN ${sqlAthlete(candidateIds)} AND m.status IN ('pending', 'verified')`;
        validAthleteIds = new Set(foundAthletes.map((a) => a.slaa_id));
      } catch (err) {
        if (process.env.NODE_ENV !== "production" && (err as { code?: string })?.code === "ECONNREFUSED") {
          console.warn("register coach: athlete DB offline in dev, treating candidate athletes as valid");
          validAthleteIds = new Set(candidateIds);
        } else {
          console.warn("register coach: error verifying athletes in athlete DB", err);
        }
      }
    }

    // Direct all coach records strictly to sqlCoach
    const slaaId = await sqlCoach.begin(async (tx) => {
      // 1. Insert into member with kind 'C'
      const [m] = await tx<{ slaa_id: string }[]>`
        INSERT INTO member (slaa_id, nic_as_entered, postal_id,
                            full_name, name_with_initials, date_of_birth, gender, district, phone, email,
                            consent_version, consent_at, status)
        VALUES (new_slaa_id('C'), ${id.nic}, NULL,
                ${person.fullName}, ${person.nameWithInitials}, ${person.dateOfBirth}, ${person.gender},
                ${form.district}, ${normalizePhone(form.phone)}, ${form.email || null},
                ${CONSENT_VERSION}, now(), 'pending')
        RETURNING slaa_id`;
      const coachId = m.slaa_id;

      // 2. Insert into coach
      await tx`
        INSERT INTO coach (slaa_id, slaa_license_no, disciplines, is_verified)
        VALUES (${coachId}, ${form.licenseNo ? cleanText(form.licenseNo).toUpperCase() : null},
                ${form.disciplines}, false)`;

      // 3. Insert qualifications
      for (const q of form.qualifications) {
        await tx`
          INSERT INTO coach_qualification (coach_id, level, level_other_text, event_group,
                                           issuing_body, certificate_serial, year_awarded,
                                           document_path, verification_status)
          VALUES (${coachId}, ${q.level}, ${q.level === "OTHER" ? cleanText(q.levelOtherText ?? "") : null},
                  ${q.eventGroup || null}, ${cleanText(q.issuingBody)},
                  ${q.certificateSerial ? cleanText(q.certificateSerial) : null},
                  ${q.yearAwarded}, ${q._uploadedPath || null}, 'unverified')`;
      }

      // 4. Insert coach declarations
      for (const d of form.declarations) {
        const reviewStatus = d.answer === "disclose" ? "pending" : "not_needed";
        await tx`
          INSERT INTO coach_declaration (coach_id, code, version, answer, disclosure_details,
                                         signed_name, accepted_at, ip_address, user_agent, review_status)
          VALUES (${coachId}, ${d.code}, ${d.version}, ${d.answer},
                  ${d.answer === "disclose" ? cleanText(d.disclosureDetails ?? "") : null},
                  ${cleanText(form.signature)}, now(), ${ipAddress}, ${userAgent}, ${reviewStatus})`;
      }

      // 5. Audit log in Coach DB
      await tx`
        INSERT INTO audit_log (actor, action, slaa_id, details)
        VALUES ('public', 'register_coach', ${coachId}, ${tx.json({
          identity_type: identity.type,
          ip_hash: parsed.ipHash,
          qualifications: form.qualifications.length,
          athletes: form.athletes.length,
          has_disclosures: form.declarations.some((d) => d.answer === "disclose"),
        })})`;

      return coachId;
    });

    // 6. Record verified athlete-coach links in Athlete DB (non-blocking for coach creation)
    if (form.athletes && form.athletes.length > 0) {
      const verifiedLinks = form.athletes.filter((a) => validAthleteIds.has(a.athleteId.toUpperCase()));
      if (verifiedLinks.length > 0) {
        try {
          for (const a of verifiedLinks) {
            await sqlAthlete`
              INSERT INTO athlete_coach (athlete_id, coach_id, relationship_type, is_primary,
                                         start_year, end_year, is_approved_by_coach, coach_confirmed_at)
              VALUES (${a.athleteId.toUpperCase()}, ${slaaId}, ${a.relationship},
                      ${a.relationship === "CURRENT" && a.isPrimary},
                      ${a.startYear === "" ? null : a.startYear},
                      ${a.endYear === "" ? null : a.endYear},
                      true, now())
              ON CONFLICT DO NOTHING`;
          }
        } catch (linkErr) {
          console.warn("register coach: non-fatal error recording athlete links in athlete DB:", linkErr);
        }
      }
    }

    return NextResponse.json({ slaaId }, { status: 201 });
  } catch (e) {
    if (process.env.NODE_ENV !== "production" && (e as { code?: string })?.code === "ECONNREFUSED") {
      console.warn("register coach: DB offline in dev (ECONNREFUSED), generating provisional ID");
      const year = new Date().getFullYear().toString().slice(-2);
      const rand = Math.floor(100000 + Math.random() * 900000);
      const body = `C${year}-${rand}`;
      return NextResponse.json({ slaaId: `${body}-${checkDigit(body)}` }, { status: 201 });
    }
    return errorResponse(e, "register coach");
  }
}
