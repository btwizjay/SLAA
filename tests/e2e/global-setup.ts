import { admin, resetDb } from "../support/db";

// Coaches are no longer registered on the site, so seed two as the
// Phase 1 import would.
export default async function globalSetup() {
  await resetDb();
  for (const [nic, name, initials, dob, gender, district] of [
    ["197812301234", "Saman Kumara Perera", "S. K. Perera", "1978-05-02", "M", "Colombo"],
    ["826543210V", "Dilani Chamari Fernando", "D. C. Fernando", "1982-06-02", "F", "Kandy"],
  ]) {
    const [m] = await admin<{ slaa_id: string }[]>`
      INSERT INTO member (slaa_id, nic_as_entered, full_name, name_with_initials, date_of_birth, gender, district,
                          phone, consent_version, consent_at)
      VALUES (new_slaa_id('C'), ${nic}, ${name}, ${initials}, ${dob}, ${gender}, ${district}, '+94771234567',
              'google-form-phase1', now())
      RETURNING slaa_id`;
    await admin`INSERT INTO coach (slaa_id, disciplines) VALUES (${m.slaa_id}, '{100m}')`;
  }
  // two throwaway athletes for the admin bulk-delete test
  for (const [nic, name] of [["199501501111", "Bulk Test One"], ["199501502222", "Bulk Test Two"]]) {
    const [m] = await admin<{ slaa_id: string }[]>`
      INSERT INTO member (slaa_id, nic_as_entered, full_name, name_with_initials, date_of_birth, gender, district,
                          consent_version, consent_at)
      VALUES (new_slaa_id('A'), ${nic}, ${name}, ${name}, '1995-02-19', 'M', 'Galle', 'test', now())
      RETURNING slaa_id`;
    await admin`INSERT INTO athlete (slaa_id) VALUES (${m.slaa_id})`;
  }
  await admin.end();
}
