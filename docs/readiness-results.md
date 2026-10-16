# Verification before the 500-applicant launch

Measured 16 October 2026, Asia/Colombo. These results describe an isolated test
database on the same Neon endpoint, not synthetic registrations in production.

| Check | Result |
| --- | --- |
| Synthetic applicants | 500, all from one IP |
| Concurrent journeys | 50 |
| Application database pool | 3 connections |
| Successful registrations / unique IDs | 500 / 500 |
| Failed journey requests | 0 |
| Database rows | 500 members, 500 athletes, 1,500 events, 500 registration audits |
| Total journey test duration | 341.825 seconds |
| Journey duration, median / 95th percentile / maximum | 33.510 / 36.914 / 37.610 seconds |
| Retrying a committed registration | 409; identity check recovered the original ID; row count stayed 500 |
| Search abuse protection | One browser throttled; another on the same IP remained usable |
| Unit, SQL and API tests | 98 passed, including 24 new staff authentication/admin cases |
| Browser regression tests | All 16 cases passed across final runs: public mobile flows and admin desktop workflows |
| Real production registration | User confirmed successful submission and receipt of the final SLAA ID card on 16 October 2026 |
| Encrypted production backup | 14 tables, 3 members in the consistent snapshot after the admin migration |
| Restore rehearsal | All table counts/checksums matched; restricted access verified; disposable restore database removed |

Each journey includes an identity check, three coach searches and registration
with three events. The runner calls the real API handlers and PostgreSQL; it
mocks CAPTCHA verification only in the test process. These timings include
database round trips from the development machine and queuing behind the
three-connection pool. They do not measure Vercel HTTP performance, real human
CAPTCHA completion, or 500 simultaneous browser sessions. No claim of that
larger concurrency has been established.

On 16 October 2026, the user confirmed completing a real production registration
and receiving the final SLAA ID card. The human CAPTCHA-to-confirmation check
has passed. The remaining account-owner and SLAA checks are listed in the
[launch runbook](launch-runbook.md).

## Admin suite verification

Migration 007 was applied to production in a transaction; the three existing
member records were preserved. The runtime still has no direct DELETE access
to members or events. The new 14-table encrypted backup was restored into a
disposable database with matching table checksums and restricted access.

The owner account is `ceo@ascendit.dev`. Staff authentication now uses the
existing Neon database, salted scrypt password hashes, signed JWT cookies and
revocable database sessions. Supabase is no longer a dependency. The initial
password is kept in the ignored `.env.local` and must be changed before data
access. See [the admin guide](admin-guide.md) for operation and recovery.

The final production build and targeted lint checks passed. The production
dependency audit reported zero vulnerabilities. Browser checks covered all
admin pages, profile correction and audit history, coach CSV preview/commit,
filtered export, staff creation and selected-record deletion, as well as the
existing registration and recovery flows. An audit-page heading assertion was
corrected to include its record count and passed on rerun. Browser checks use
a development-only staff bypass; separate database/API tests cover real JWT
login, required password changes, owner permissions and session revocation.
