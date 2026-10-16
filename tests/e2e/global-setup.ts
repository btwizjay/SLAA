import { admin, resetDb } from "../support/db";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { signAdminToken } from "../../src/lib/admin-session";

// Coaches are no longer registered on the site, so seed two as the
// Phase 1 import would.
export default async function globalSetup() {
  await resetDb();
  for (const [nic, name, initials, dob, gender, district] of [
    [
      "197812301234",
      "Saman Kumara Perera",
      "S. K. Perera",
      "1978-05-02",
      "M",
      "Colombo",
    ],
    [
      "826543210V",
      "Dilani Chamari Fernando",
      "D. C. Fernando",
      "1982-06-02",
      "F",
      "Kandy",
    ],
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
  for (const [nic, name] of [
    ["199501501111", "Bulk Test One"],
    ["199501502222", "Bulk Test Two"],
  ]) {
    const [m] = await admin<{ slaa_id: string }[]>`
      INSERT INTO member (slaa_id, nic_as_entered, full_name, name_with_initials, date_of_birth, gender, district,
                          consent_version, consent_at)
      VALUES (new_slaa_id('A'), ${nic}, ${name}, ${name}, '1995-02-19', 'M', 'Galle', 'test', now())
      RETURNING slaa_id`;
    await admin`INSERT INTO athlete (slaa_id) VALUES (${m.slaa_id})`;
  }
  const [caller] =
    await admin`INSERT INTO admin_staff(email,password_hash,role,must_change_password,display_name,organization) VALUES('university-caller@example.com','test-only-unusable-hash','verifier',false,'University Caller','Sabaragamuwa University') RETURNING id`;
  const session = randomUUID();
  await admin`INSERT INTO admin_session(id,staff_id,expires_at) VALUES(${session},${caller.id},now()+interval '8 hours')`;
  const previous = process.env.ADMIN_JWT_SECRET;
  process.env.ADMIN_JWT_SECRET =
    "e2e-admin-jwt-secret-only-not-for-production-1234";
  const token = await signAdminToken(caller.id, session);
  if (previous === undefined) delete process.env.ADMIN_JWT_SECRET;
  else process.env.ADMIN_JWT_SECRET = previous;
  const cases = [];
  for (const [nic, name] of [
    ["199512309999", "University Call Applicant"],
    ["199512309998", "Other Caller Applicant"],
  ]) {
    const [m] =
      await admin`INSERT INTO member(slaa_id,nic_as_entered,full_name,date_of_birth,gender,district,phone,consent_version,consent_at)
      VALUES(new_slaa_id('A'),${nic},${name},'1995-05-02','M','Colombo','+94712345678','test',now()) RETURNING slaa_id`;
    await admin`INSERT INTO athlete(slaa_id,main_events) VALUES(${m.slaa_id},'{100m}')`;
    await admin`INSERT INTO athlete_event(athlete_id,event_code,rank) VALUES(${m.slaa_id},'100m',1)`;
    cases.push(m.slaa_id);
  }
  writeFileSync(
    "tests/e2e/.staff-state.json",
    JSON.stringify({ token, callerId: caller.id, cases }),
  );
  await admin.end();
}
