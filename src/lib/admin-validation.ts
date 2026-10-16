import { z } from "zod";
import {
  athleteFormSchema,
  eventEntrySchema,
  identitySchema,
  guardianSchema,
} from "./validation";
import { EVENT_CODES } from "./reference";
const person = athleteFormSchema.shape;
export const staffPersonSchema = z.object({
  fullName: person.fullName,
  nameWithInitials: person.nameWithInitials,
  dateOfBirth: person.dateOfBirth,
  gender: person.gender,
  district: person.district,
  phone: z.union([z.literal(""), person.phone]),
  email: z.union([z.literal(""), z.email().max(254)]),
});
export const editProfileSchema = staffPersonSchema.extend({
  identity: identitySchema,
  schoolOrClub: z.string().trim().max(160),
  events: z.array(eventEntrySchema).max(20),
  guardian: guardianSchema.nullable(),
  licenseNo: z.string().trim().max(100),
  licenseLevel: z.string().trim().max(100),
  disciplines: z
    .array(z.string().refine((v) => EVENT_CODES.includes(v)))
    .max(50),
  reason: z.string().trim().min(1, "Give a reason for this change.").max(500),
});
export const coachCreateSchema = staffPersonSchema.extend({
  identity: identitySchema,
  licenseNo: z.string().trim().max(100),
  licenseLevel: z.string().trim().max(100),
  disciplines: z
    .array(z.string().refine((v) => EVENT_CODES.includes(v)))
    .max(50),
  consent: z.literal(true, {
    error: "Confirm that this coach authorized SLAA to store these details.",
  }),
  reason: z.string().trim().min(1, "Give a source or reason.").max(500),
});
