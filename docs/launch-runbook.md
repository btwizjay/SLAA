# Registration launch operations

Public site: https://slaa-datacollection-gold.vercel.app

## Traffic and verification

The event configuration allows 600 identity checks, 600 registration submissions,
and 6,000 coach searches per IP per minute. A signed browser pass has a separate
60-search/minute limit. Each new pass contains a random nonce, so people checking
their identity in the same second do not share a browser limit. CAPTCHA and
database identity uniqueness remain mandatory. Invalid rate settings fall back
to the documented defaults instead of disabling the limit.

`npm run test:load` runs 500 synthetic applicants with 50 concurrent journeys,
all sharing one IP. Every journey checks identity, runs three coach searches,
and registers three events. It verifies 500 unique IDs, exactly 500 members and
athletes, 1,500 events, 500 registration audits, duplicate recovery, and browser
search throttling. `test-results/load-report.json` records timing and failures.

Run this only with `TEST_ADMIN_DATABASE_URL` and `TEST_DATABASE_URL` pointing
to the same disposable database with `test` in its name. It truncates that
database. It uses the real route handlers, SQL constraints and restricted app
role with the production pool size of three. CAPTCHA is mocked only by the test
runner. It does **not** measure Vercel scaling, HTTP latency, real CAPTCHA, or
500 simultaneous browser sessions. GitHub CI also runs this test against its
isolated PostgreSQL service.

Before opening registration, have one authorized applicant finish a real
production registration on a phone, save the SLAA ID, then check the same NIC
again to confirm the existing ID is recovered. Do not use synthetic identities
in the live register. Test normal venue Wi-Fi and a mobile connection.

On 16 October 2026, the owner confirmed completing a real production
registration and receiving the final SLAA ID card. That browser signup check
is complete; venue-network checks remain useful before the event.

## Health and incident handling

`GET /api/health` queries PostgreSQL and returns only `{"status":"ok"}` (200)
or `{"status":"unavailable"}` (503). Responses are not cached. A stalled query
is cancelled after five seconds. No credentials, counts or account details are
returned. The endpoint is a connectivity check, not a registration rehearsal.

The **Production health** GitHub Actions workflow runs hourly and can be run
manually. It retries three times before failing. The repository owner should
enable notifications for failed Actions workflows. Scheduled Actions can be
delayed; this is not a guaranteed alert delivery service. For minute-level
alerts, connect an external uptime monitor to this endpoint. Check remaining
private-repository Actions minutes; an always-on five-minute schedule would
consume thousands of runner minutes per month.

During the event, keep the Vercel runtime logs and Neon usage dashboard open.
If registration fails:

1. Check `/api/health`, Vercel deployment status and Neon connectivity/usage.
2. For CAPTCHA hostname errors, check the widget allowlist contains exactly
   `slaa-datacollection-gold.vercel.app`. Applicants can reload the security
   check without discarding their answers.
3. A 429 response asks applicants to wait one minute. Check whether the
   per-browser search limit or the shared-IP limit was reached before raising
   anything. Keep CAPTCHA enabled.
4. After a network error or timeout, use **Check registration and recover my
   SLAA ID** with the same identity. A committed submission is found by the
   identity check; database uniqueness prevents a second record. If it did
   not commit, return to the details form in the same tab to restore the draft.
5. If a deployment causes failures, roll back to the last healthy deployment
   in this Vercel project. This change does not migrate production data.

Registration waits at most 45 seconds for its response; identity checks wait
30 seconds. A timeout does not prove that the server rolled back, which is why
the recovery path checks for an existing ID rather than automatically posting
again. Drafts remain in the current browser tab, subject to the existing
expiry. Save or print the final ID; SMS/email delivery is not implemented.

## Encrypted backup and restore rehearsal

`scripts/backup.mjs` uses the standard PostgreSQL `pg_dump` custom format,
streams it through AES-256-GCM encryption, and never writes a plaintext dump.
It retains application grants and revocations. It exports a consistent
PostgreSQL snapshot for both the dump and all 12 table counts/checksums.

Install PostgreSQL client tools at least as new as the server major version.
Set `PG_BIN` if the tools are not on PATH. With the owner connection in the
ignored `.env.local`, run:

```powershell
$env:PG_BIN = 'C:\path\to\postgresql\bin'
node --env-file=.env.local scripts/backup.mjs
node --env-file=.env.local scripts/backup.mjs verify C:\path\to\backup.dump.aes
```

Default backup directory: `~/SLAA-backups`. The encryption key is a separate
32-byte file at `~/.slaa-backup-key`, restricted to the current Windows user.
Override paths with `BACKUP_DIR` and `BACKUP_KEY_FILE`. Keep the key in secure
storage separate from exported backups. Losing the key loses access to the
backup. The `.json` manifest and `.verified.json` report contain counts and
checksums, not applicant fields.

Verification creates a randomly named `slaa_test_restore_*` database, decrypts
into `pg_restore`, compares every table's count and checksum, checks important
runtime restrictions and the PUBLIC revoke on staff deletion, then drops the
test database. It never restores over production. Neon provider-owned default
privileges are skipped during rehearsal because the project owner cannot
change those provider roles; application object ACLs are retained.

Take a backup before opening registration and after the event. Copy encrypted
backups and manifests to approved off-device storage. The local backup and
successful restore rehearsal do not configure scheduled offsite backups or
establish the Neon plan's point-in-time recovery window. Check that window and
remaining compute/storage/network quotas in the actual Neon account.

## Items requiring SLAA or account-owner action

- Confirm the Vercel plan permits this organizational use and check remaining
  Neon/Vercel quotas. No paid upgrade is performed by this change.
- Have native Sinhala and Tamil reviewers approve the consent translations;
  their draft status has not been silently removed.
- Staff sign-in remains deferred as requested. Enable Supabase credentials
  and allow-listed staff accounts before staff need web exports/corrections.
  Until then, assign an authorized database operator to handle support.
- Supply the real coach CSV before expecting existing coaches in the picker.
  Unlisted-coach submissions remain available. Never import the test fixture.
- Name a support person for applicants and verify failure notifications.
