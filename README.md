# SLAA Registration

Athlete registration for Sri Lanka Athletics, in English, Sinhala and Tamil. Athletes check an NIC or Postal ID, provide their details and events, and receive an SLAA ID. Minors also provide guardian details. Coaches are imported by staff; athletes can select registered coaches or submit an unlisted coach for follow-up.

The app uses Next.js 15, React 19, Neon PostgreSQL and Cloudflare Turnstile. Staff use app-managed password authentication with signed JWT cookies, database-backed revocation and owner-managed accounts. Public lookups return masked names; staff changes are authenticated and audited. No Supabase account is required.

## Development

Use Node.js 24 and npm. Create a separate PostgreSQL database, then bootstrap it once:

```bash
npm ci
createdb slaa_dev
bash scripts/db-apply.sh postgres://localhost/slaa_dev
psql postgres://localhost/slaa_dev -c "ALTER ROLE slaa_app PASSWORD 'devpass'"
cp .env.example .env.local
```

Set `DATABASE_URL` to the pooled runtime connection, `DATABASE_URL_UNPOOLED` to the owner connection for schema work, and `SESSION_SECRET` to a random value of at least 32 characters. Development can use the Turnstile test keys in `.env.example`. Run `npm run dev`.

`DEV_ADMIN_EMAIL` enables owner access only when `NODE_ENV=development`. Never configure it in production. For real staff sign-in, configure the owner connection in `.env.local`, then run `npm run admin:bootstrap`. See [the admin guide](docs/admin-guide.md) for setup, login, features and recovery.

## Verification

Tests reset their database. Always use a separate database with `test` in its name. The bootstrap script applies migrations 001?007 and reference data in order to a **new** database; it is not an incremental migration runner and must not be rerun against an already migrated production database.

```bash
createdb slaa_test
bash scripts/db-apply.sh postgres://localhost/slaa_test
psql postgres://localhost/slaa_test -c "ALTER ROLE slaa_app PASSWORD 'devpass'"
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

For a remote test database, set `TEST_ADMIN_DATABASE_URL` to its owner URL and `TEST_DATABASE_URL` to an application login that inherits `slaa_app`. Browser tests use development-only staff access and Cloudflare's official test keys; they need internet access. GitHub Actions runs the tests and build against an isolated PostgreSQL service.

## Production on Vercel

Production URL: <https://slaa-datacollection-gold.vercel.app>

1. Bootstrap a new Neon database once using the direct owner connection. For this deployment the existing database already contains migrations 001-007 and reference data; preserve its registrations.
2. Use a dedicated runtime login that inherits the restricted `slaa_app` role. Keep the owner connection outside the Vercel runtime. The app disables prepared statements for transaction pooling and defaults to three connections per function instance.
3. Configure production environment variables from `.env.example`. Use real Cloudflare Turnstile keys, a strong `SESSION_SECRET`, and `NEXT_PUBLIC_SITE_URL=https://slaa-datacollection-gold.vercel.app`. Allow the production hostname in the Turnstile widget. Do not upload `.env.local` or configure `DEV_ADMIN_EMAIL`.
4. Link the Vercel project and GitHub repository, then deploy:

   ```bash
   vercel link --project slaa-datacollection
   vercel git connect https://github.com/btwizjay/SLAA.git
   vercel --prod
   ```

5. Check the language choices, registration flow, duplicate protection and server logs. Unauthenticated `/admin` access must redirect to sign-in and CSV exports must return 401.

Only production receives the production database credentials. Preview deployments require a separate database and their own Turnstile configuration before they can accept registrations. Functions run in Singapore (`sin1`), beside the Neon database.

Staff sign-in uses the existing Neon database and a dedicated `ADMIN_JWT_SECRET`. Run `npm run admin:bootstrap` to create the owner `ceo@ascendit.dev`; keep its generated `ADMIN_INITIAL_PASSWORD` in the ignored local environment file. Upload only the signing secret to Vercel. The owner manages other staff accounts from the admin panel; no Supabase configuration is needed. See [the admin guide](docs/admin-guide.md).

Sinhala and Tamil consent translations are marked as drafts in their source files and should be reviewed by SLAA's language reviewers. Messaging API settings are reserved for future use; the app does not send SMS or coach invitations automatically.

## Operations

The admin panel provides a reviewed coach CSV import and individual coach creation. For legacy Google-sheet rows with provisional IDs, import a real coach CSV with an owner connection via `IMPORT_DATABASE_URL`. Review errors and warnings before importing; these reports can contain personal data and are ignored by Git. The database currently has no coaches until staff supplies an import.

```bash
IMPORT_DATABASE_URL=<owner-url> npm run import:sheet -- responses.csv --dry-run
IMPORT_DATABASE_URL=<owner-url> npm run import:sheet -- responses.csv
npm run qr -- https://slaa-datacollection-gold.vercel.app/
```

The importer reserves provisional coach ID serials even on a dry run, because PostgreSQL sequence changes do not roll back. Never use the sample fixture as a production import.

The event limits allow 600 identity checks, 600 registration submissions and 6,000 coach searches per IP per minute, with an additional 60-search/minute browser limit. CAPTCHA and identity uniqueness remain enabled. `npm run test:load` verifies 500 synthetic signups at concurrency 50 in a disposable database, including a shared-IP scenario. It does not test Vercel scaling or real CAPTCHA.

See [the launch runbook](docs/launch-runbook.md) for the health endpoint, hourly monitoring, encrypted backups and restore rehearsal, submission recovery, incident steps and remaining account-owner checks.

The runtime dependency audit is kept separate from development tooling. `shadcn` and Neon configuration tools are build/development dependencies. Next.js's PostCSS dependency is overridden to a patched compatible 8.x release. Development tooling still depends on `braces`, for which npm currently provides no patched release; avoid processing untrusted generator patterns.
