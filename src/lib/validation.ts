// Zod schemas shared by the forms (client) and the API routes (server).
// Schemas validate what the user typed; normalise*() turns it into what is
// stored. The database still enforces uniqueness and the NIC checks.

import { z } from "zod";
import { cleanNic, parseNic } from "./nic";
import { DISTRICTS, EVENT_CODES } from "./reference";
import { isValidSlaaId } from "./slaa-id";

export const PHONE_REGEX = /^(?:\+94|0)7[0-9]{8}$/;

export function cleanPhone(v: string) {
  return (v ?? "").replace(/[\s-]/g, "");
}

/** Store phones as +947XXXXXXXX so SMS sending needs no further work. */
export function normalizePhone(v: string) {
  const p = cleanPhone(v);
  return p.startsWith("0") ? "+94" + p.slice(1) : p;
}

export function normalizePostalId(v: string) {
  return (v ?? "").replace(/\s/g, "").toUpperCase();
}

export function cleanText(v: string) {
  return (v ?? "").trim().replace(/\s+/g, " ");
}

/** Age in whole years on the given date (default: today in Sri Lanka). */
export function ageOn(dob: string, on: string = todayInColombo()): number {
  const [y, m, d] = dob.split("-").map(Number);
  const [ty, tm, td] = on.split("-").map(Number);
  let age = ty - y;
  if (tm < m || (tm === m && td < d)) age--;
  return age;
}

export function todayInColombo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(new Date());
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

const nicField = z.string().refine((v) => parseNic(v).ok, {
  error: (iss) => {
    const r = parseNic(String(iss.input ?? ""));
    return r.ok ? "Invalid NIC" : r.error;
  },
});

export const identitySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("nic"), nic: nicField }),
  z.object({
    type: z.literal("postal"),
    postalId: z
      .string()
      .refine((v) => /^[A-Z0-9/-]{4,20}$/.test(normalizePostalId(v)), {
        error: "Enter the Postal ID number (4-20 letters or digits).",
      }),
  }),
]);

export type Identity = z.infer<typeof identitySchema>;

// Coaches are strictly required to have an NIC
export const coachIdentitySchema = z.object({
  type: z.literal("nic"),
  nic: nicField,
});

export type CoachIdentity = z.infer<typeof coachIdentitySchema>;

export type NormalizedIdentity = {
  nic: string | null; // as entered (cleaned); the DB trigger normalises it
  postalId: string | null;
};

export function normalizeIdentity(id: Identity): NormalizedIdentity {
  return {
    nic: id.type === "nic" ? cleanNic(id.nic) : null,
    postalId: id.type === "postal" ? normalizePostalId(id.postalId) : null,
  };
}

// ---------------------------------------------------------------------------
// Shared person fields
// ---------------------------------------------------------------------------

const requiredText = (label: string, max = 120) =>
  z
    .string()
    .refine((v) => cleanText(v).length > 0, { error: `${label} is required.` })
    .refine((v) => cleanText(v).length <= max, { error: `${label} is too long.` });

const phoneField = z.string().refine((v) => PHONE_REGEX.test(cleanPhone(v)), {
  error: "Enter a Sri Lankan mobile number, e.g. 0771234567.",
});

const dobField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Enter the date of birth." })
  .refine((v) => !Number.isNaN(Date.parse(v)) && v <= todayInColombo(), {
    error: "Enter a valid date of birth.",
  });

const personFields = {
  fullName: requiredText("Full name"),
  nameWithInitials: requiredText("Name with initials", 80),
  dateOfBirth: dobField,
  gender: z.enum(["M", "F"], { error: "Select a gender." }),
  district: z.enum(DISTRICTS, { error: "Select a district." }),
  consent: z.literal(true, { error: "You must agree to continue." }),
};

const eventsField = (label: string) =>
  z
    .array(z.string())
    .min(1, { error: `Select at least one ${label}.` })
    .refine((a) => a.every((c) => EVENT_CODES.includes(c)), { error: "Unknown event selected." })
    .refine((a) => new Set(a).size === a.length, { error: "An event is selected twice." });

// ---------------------------------------------------------------------------
// Athlete
// ---------------------------------------------------------------------------

const currentYear = () => Number(todayInColombo().slice(0, 4));

const yearField = z.union([
  z.literal(""),
  z
    .union([z.string().trim().regex(/^\d{4}$/, { error: "Enter a 4-digit year." }), z.number().int()])
    .transform(Number)
    .refine((y) => y >= 1950 && y <= currentYear(), { error: "Enter a year between 1950 and now." }),
]);

export const coachLinkSchema = z
  .object({
    coachId: z.string().refine(isValidSlaaId, { error: "Invalid coach ID." }),
    relationship: z.enum(["CURRENT", "PAST"]),
    startYear: yearField,
    endYear: yearField,
    isPrimary: z.boolean(),
  })
  .superRefine((c, ctx) => {
    if (c.relationship === "CURRENT" && c.endYear !== "") {
      ctx.addIssue({ code: "custom", path: ["endYear"], message: "A current coach has no end year." });
    }
    if (c.relationship === "PAST" && c.isPrimary) {
      ctx.addIssue({ code: "custom", path: ["isPrimary"], message: "Only a current coach can be primary." });
    }
    if (c.startYear !== "" && c.endYear !== "" && c.endYear < c.startYear) {
      ctx.addIssue({ code: "custom", path: ["endYear"], message: "End year is before start year." });
    }
  });

export const guardianSchema = z.object({
  fullName: requiredText("Guardian name"),
  relationship: requiredText("Relationship", 40),
  phone: phoneField,
  nic: z.union([z.literal(""), nicField]),
  consent: z.literal(true, { error: "The guardian must give consent." }),
});

export const athleteFormSchema = z
  .object({
    ...personFields,
    phone: phoneField,
    schoolOrClub: requiredText("School or club"),
    mainEvents: eventsField("main event"),
    guardian: guardianSchema.nullable(),
    coaches: z.array(coachLinkSchema).max(10, { error: "Up to 10 coaches." }),
  })
  .superRefine((a, ctx) => {
    if (dobField.safeParse(a.dateOfBirth).success && ageOn(a.dateOfBirth) < 18 && !a.guardian) {
      ctx.addIssue({
        code: "custom",
        path: ["guardian"],
        message: "Athletes under 18 must give parent or guardian details.",
      });
    }
    if (a.coaches.filter((c) => c.isPrimary).length > 1) {
      ctx.addIssue({ code: "custom", path: ["coaches"], message: "Only one current coach can be primary." });
    }
    const current = a.coaches.filter((c) => c.relationship === "CURRENT").map((c) => c.coachId);
    if (new Set(current).size !== current.length) {
      ctx.addIssue({ code: "custom", path: ["coaches"], message: "The same coach is listed twice as current." });
    }
  });

export type AthleteForm = z.infer<typeof athleteFormSchema>;

export const athleteRegisterSchema = z.object({
  identity: identitySchema,
  form: athleteFormSchema,
  turnstileToken: z.string().min(1, { error: "Please complete the security check." }),
});

export const identityCheckSchema = z.object({
  identity: identitySchema,
  turnstileToken: z.string().min(1, { error: "Please complete the security check." }),
});

/** First error message per field path, for API 400 responses. */
export function flattenIssues(err: z.ZodError): { message: string; fields: Record<string, string> } {
  const fields: Record<string, string> = {};
  for (const i of err.issues) {
    const key = i.path.join(".");
    if (!(key in fields)) fields[key] = i.message;
  }
  return { message: err.issues[0]?.message ?? "Please check the form.", fields };
}

// ---------------------------------------------------------------------------
// Coach qualification levels and groups
// ---------------------------------------------------------------------------

export const COACH_LEVELS = [
  "CECS_L1_YOUTH",
  "CECS_L2_EVENT",
  "CECS_L3_ELITE",
  "SLAA_NATIONAL",
  "UNIVERSITY_SPORT_SCI",
  "OTHER",
] as const;
export type CoachLevel = (typeof COACH_LEVELS)[number];

export const COACH_LEVEL_LABELS: Record<CoachLevel, string> = {
  CECS_L1_YOUTH: "CECS Level I — Youth / Introductory",
  CECS_L2_EVENT: "CECS Level II — Event Specialist",
  CECS_L3_ELITE: "CECS Level III — Elite / High Performance",
  SLAA_NATIONAL: "SLAA National Course",
  UNIVERSITY_SPORT_SCI: "University Sports Science Degree / Diploma",
  OTHER: "Other",
};

export const EVENT_GROUPS = [
  "Sprints",
  "Hurdles",
  "Jumps",
  "Throws",
  "Endurance",
  "Race Walk",
  "Combined",
] as const;
export type EventGroup = (typeof EVENT_GROUPS)[number];

export const ISSUING_BODIES = [
  "World Athletics",
  "Sri Lanka Athletics Association",
  "Other National Federation",
  "University",
  "Other",
] as const;

// ---------------------------------------------------------------------------
// Coach qualification schema (one entry; array validated below)
// ---------------------------------------------------------------------------

const qualificationSchema = z
  .object({
    level: z.enum(COACH_LEVELS, { error: "Select a qualification level." }),
    levelOtherText: z.string().optional(),
    eventGroup: z.string().optional(),
    issuingBody: z.string().refine((v) => v.trim().length > 0, { error: "Enter the issuing body." }),
    certificateSerial: z.string().optional(),
    yearAwarded: z
      .coerce
      .number()
      .int()
      .refine((y) => y >= 1970 && y <= new Date().getFullYear(), {
        error: "Year must be between 1970 and this year.",
      }),
    // Temporary upload path returned by /api/register/coach/upload
    _uploadedPath: z.string().optional(),
    _uploadError: z.string().optional(),
  })
  .superRefine((q, ctx) => {
    if (q.level === "OTHER" && !q.levelOtherText?.trim()) {
      ctx.addIssue({ code: "custom", path: ["levelOtherText"], message: "Describe the qualification." });
    }
  });

export type CoachQualification = z.infer<typeof qualificationSchema>;

// ---------------------------------------------------------------------------
// Coach declaration answer schema
// ---------------------------------------------------------------------------

export const declarationAnswerSchema = z
  .object({
    code: z.string(),
    version: z.number().int(),
    answer: z.enum(["confirm", "disclose"]),
    disclosureDetails: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.answer === "disclose" && !d.disclosureDetails?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["disclosureDetails"],
        message: "Please describe what you need to disclose.",
      });
    }
  });

export type DeclarationAnswer = z.infer<typeof declarationAnswerSchema>;

// ---------------------------------------------------------------------------
// Coach athlete link schema
// ---------------------------------------------------------------------------

export const coachAthleteLinkSchema = z.object({
  athleteId: z.string().refine(isValidSlaaId, { error: "Invalid athlete ID." }),
  relationship: z.enum(["CURRENT", "PAST"]),
  startYear: yearField,
  endYear: yearField,
  isPrimary: z.boolean(),
});

export type CoachAthleteLink = z.infer<typeof coachAthleteLinkSchema>;

// ---------------------------------------------------------------------------
// Full coach form schema
// ---------------------------------------------------------------------------

export const coachFormSchema = z.object({
  fullName: requiredText("Full name"),
  nameWithInitials: requiredText("Name with initials", 80),
  dateOfBirth: dobField,
  gender: z.enum(["M", "F"], { error: "Select a gender." }),
  district: z.enum(DISTRICTS, { error: "Select a district." }),
  phone: phoneField,
  email: z.union([z.literal(""), z.string().email({ message: "Enter a valid email address." })]),
  licenseNo: z.string().optional(),
  disciplines: eventsField("event coached"),
  qualifications: z
    .array(qualificationSchema)
    .min(1, { error: "Add at least one qualification." })
    .max(10, { error: "Up to 10 qualifications." }),
  athletes: z.array(coachAthleteLinkSchema).max(50, { error: "Up to 50 athletes." }),
  declarations: z
    .array(declarationAnswerSchema)
    .min(1, { error: "You must complete all declarations." }),
  signature: requiredText("Signature"),
  consent: z.literal(true, { error: "You must agree to continue." }),
});

export type CoachForm = z.infer<typeof coachFormSchema>;

export const coachRegisterSchema = z.object({
  identity: coachIdentitySchema,
  form: coachFormSchema,
  turnstileToken: z.string().min(1, { error: "Please complete the security check." }),
});
