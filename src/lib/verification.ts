export const CASE_LABELS: Record<string, string> = {
  unassigned: "Unassigned",
  assigned: "Assigned",
  in_progress: "In progress",
  callback: "Callback scheduled",
  needs_review: "Needs supervisor review",
  approved: "Verified",
  rejected: "Closed without approval",
};
export const CALL_OUTCOMES = {
  confirmed: "Information confirmed",
  no_answer: "No answer",
  busy: "Busy",
  callback: "Requested a callback",
  wrong_number: "Wrong / unavailable number",
  mismatch: "Information does not match",
  declined: "Declined verification",
} as const;
export const VERIFICATION_CHECKS = {
  identity: "Name, identity and date of birth confirmed",
  contact: "Contact details confirmed",
  athletics: "School / club, events and coaching information confirmed",
  conversation: "I spoke with the applicant or the required guardian",
} as const;
export function sriLankaTime(date: Date | null) {
  return date
    ? date.toLocaleString("en-GB", { timeZone: "Asia/Colombo" })
    : "—";
}
export function parseCallback(value: string): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value))
    throw Error("Choose a valid callback date and time.");
  const day = new Date(value.slice(0, 10) + "T00:00:00Z");
  if (
    Number.isNaN(day.getTime()) ||
    day.toISOString().slice(0, 10) !== value.slice(0, 10)
  )
    throw Error("Choose a valid callback date.");
  const date = new Date(value + "+05:30");
  if (date.getTime() <= Date.now())
    throw Error("The callback must be in the future (Sri Lanka time).");
  return date;
}
