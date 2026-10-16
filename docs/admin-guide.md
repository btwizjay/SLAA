# Staff administration

Staff sign-in: https://slaa-datacollection-gold.vercel.app/admin/login

The initial owner is `ceo@ascendit.dev`. Authentication runs in the app using
the existing Neon database. It has no Supabase or email-provider dependency.

## Initial setup and recovery

Apply migration `db/007_admin_suite.sql` once to an existing database, inside
a transaction using its owner connection. Do not rerun migrations 001–006
against an already migrated live register. For a new development or test
database, `scripts/db-apply.sh` applies all migrations and reference data.

With the owner connection in the ignored `.env.local`, run:

```bash
npm run admin:bootstrap
```

The command creates the owner once, stores only a salted scrypt hash in the
database, and writes `ADMIN_JWT_SECRET`, `ADMIN_OWNER_EMAIL` and
`ADMIN_INITIAL_PASSWORD` to `.env.local`. It generates strong random values
when the secret/password are blank and never prints passwords or signing
keys. It refuses to add a different owner when one already exists.

Upload **only `ADMIN_JWT_SECRET`** to the Vercel production environment, then
redeploy. Keep `ADMIN_INITIAL_PASSWORD` and `DATABASE_URL_UNPOOLED` outside
the runtime environment. Never set `DEV_ADMIN_EMAIL` in production.

Use the initial password at staff sign-in. The owner must set a different
password before accessing member data. There is no email password-reset
service. The owner can reset other staff accounts in **Staff**.
After setting your own password, remove the obsolete `ADMIN_INITIAL_PASSWORD`
value from `.env.local` or store it only in your password manager.

If the owner loses access, an authorized database operator can set a new
strong `ADMIN_INITIAL_PASSWORD` in `.env.local`, then explicitly run:

```bash
npm run admin:bootstrap -- --reset-password
```

That resets only the existing owner, revokes all their sessions and requires
another password change. Running bootstrap normally never changes an existing
password. This recovery operation needs the database owner credentials.

## Feature suite

- **Overview:** live totals, seven-day registrations, district coverage,
  recent applicants, and links to outstanding review queues.
- **Members:** search by name, SLAA ID, NIC or Postal ID; filter by role,
  district, status, school/club, age and registration date; paginate results
  or export the same filtered selection.
- **Member profile:** correct personal/identity details, contacts, school,
  guardian details, coach licence and disciplines, events and personal bests.
  NIC date of birth and gender are derived on the server. Corrections require
  a reason and reject stale versions rather than overwriting another staff
  member's changes. The existing SLAA ID and consent record remain intact.
- **Coach relationships:** add or correct current/past links and primary
  coach selection. New/changed links return to review. Approve, reject or
  reopen a link with a recorded reason. Rejection clears primary status and
  retains the relationship history.
- **Coach creation:** create a coach from an authorized source. If their
  identity already belongs to an athlete, explicit confirmation adds the
  coach role to the existing member without overwriting their personal data.
- **Coach CSV import:** authenticated template download, validation and
  read-only preview, followed by an explicit commit. Supports up to 500 rows
  and 500 KB per file. Preview does not reserve IDs. The signed preview is
  bound to the staff member, file, current register state and a 15-minute
  expiry. Commit revalidates everything and is one transaction. Existing
  coaches are skipped; adding roles to existing members needs confirmation.
- **Unlisted coach requests:** manual contact shortcuts, invited/rejected
  status tracking and linking to registered coaches. Contact shortcuts do
  not send messages automatically.
- **Duplicate review:** compare suggested duplicates and merge after giving
  a reason and typing the kept SLAA ID. Relationships, events and guardians
  move within a transaction, and both records receive audit entries.
- **Status and deletion:** verify, suspend with a reason, reinstate, or
  delete individual/selected records with the existing confirmations. These
  operations affect live personal data; review the selection carefully.
- **Exports:** members, athletes, coaches, events/PBs, relationships and
  unlisted requests, with CSV formula protection and an audit of each export.
- **Audit log:** append-only history with action, actor and member filters.
- **Staff:** owner-only account creation, activation/disablement, temporary
  password reset and session revocation. New/reset accounts must change
  their password before they can access data. Staff cannot manage the owner.
- **Your account:** change your password or sign out other sessions.

For CSV imports, use the downloadable template. `nic` supplies date of birth
and gender; Postal ID rows must supply both explicitly. Separate coaching
event codes with semicolons, e.g. `100m;200m;LJ`. Existing provisional coach
IDs from the original Google sheet are handled by the separate owner-run
`import:sheet` tool; do not put those rows into the new-ID template and expect
their provisional IDs to be retained.

## Authentication and operational checks

JWTs are signed with a dedicated secret using HS256 and validated for their
algorithm, issuer, audience, purpose and expiry. Production cookies use the
`__Host-` prefix, Secure, HttpOnly, SameSite=Strict and an eight-hour maximum.
Each protected request also checks the active staff account and unrevoked,
unexpired database session. Disabling staff, resetting a password or signing
out invalidates stored sessions immediately. Password changes revoke all
previous sessions and issue a replacement for the current browser.

Passwords use Node's asynchronous scrypt with a random salt and timing-safe
comparison. Sign-in attempts are limited per hashed IP and hashed email.
Unknown accounts and incorrect passwords receive the same response. Staff
forms use Next.js Server Actions and its origin checks. Account creation,
password changes, session changes and domain mutations are audited without
recording passwords or JWTs. The runtime has no direct DELETE permission on
member records or events; constrained database functions perform those
operations. Staff credentials and sessions are never included in CSV exports.

Take an encrypted backup before applying migrations and after the event.
Database backups now include staff password hashes, so keep the encryption
key separate from exported backups. A new signing secret can replace a lost
JWT key, but doing so signs out existing sessions. See the
[launch runbook](launch-runbook.md) for monitoring and backup instructions.
