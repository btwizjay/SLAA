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
| Unit, SQL and API tests | 74 passed |
| Mobile browser tests | 13 passed, including lost-response ID recovery and CAPTCHA script reload |
| Real production registration | User confirmed successful submission and receipt of the final SLAA ID card on 16 October 2026 |
| Encrypted production backup | 12 tables, 3 members in the consistent snapshot |
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
