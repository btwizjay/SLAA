# SLAA Registration

Athlete registration for Sri Lanka Athletics, in English, Sinhala and Tamil. Athletes check an NIC or Postal ID, provide their details and events, and receive an SLAA ID. Minors also provide guardian details. Coaches are imported by staff; athletes can select registered coaches or submit an unlisted coach for follow-up.

The app uses Next.js 15, React 19, Neon PostgreSQL, Cloudflare Turnstile and optional Supabase Auth for staff. PostgreSQL enforces identity uniqueness, coach relationships and event constraints. Public lookups return masked names; staff actions require an allow-listed session and write audit records.

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

`DEV_ADMIN_EMAIL` enables staff access only when `NODE_ENV=development`. Never configure it in production. Without Supabase Auth credentials, staff pages remain protected and sign-in is unavailable; public registration still works.

## Verification

Tests reset their database. Always use a separate database with `test` in its name. The bootstrap script applies all six schema files and reference data in order to a **new** database; it is not an incremental migration runner and must not be rerun against an already migrated production database.

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

Production URL: <https://slaa-datacollection.vercel.app>

1. Bootstrap a new Neon database once using the direct owner connection. For this deployment the existing database already contains migrations 001-006 and reference data; preserve its registrations.
2. Use a dedicated runtime login that inherits the restricted `slaa_app` role. Keep the owner connection outside the Vercel runtime. The app disables prepared statements for transaction pooling and defaults to three connections per function instance.
3. Configure production environment variables from `.env.example`. Use real Cloudflare Turnstile keys, a strong `SESSION_SECRET`, and `NEXT_PUBLIC_SITE_URL=https://slaa-datacollection.vercel.app`. Allow the production hostname in the Turnstile widget. Do not upload `.env.local` or configure `DEV_ADMIN_EMAIL`.
4. Link the Vercel project and GitHub repository, then deploy:

   ```bash
   vercel link --project slaa-datacollection
   vercel git connect https://github.com/btwizjay/SLAA.git
   vercel --prod
   ```

5. Check the language choices, registration flow, duplicate protection and server logs. Unauthenticated `/admin` access must redirect to sign-in and CSV exports must return 401.

Only production receives the production database credentials. Preview deployments require a separate database and their own Turnstile configuration before they can accept registrations. Functions run in Singapore (`sin1`), beside the Neon database.

Staff sign-in is deferred for the first registration launch. To enable it later, set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `ADMIN_EMAILS` in Vercel, configure the Supabase Site URL and allowed redirect `https://slaa-datacollection.vercel.app/auth/callback`, and redeploy. Public registration is independent of Supabase Auth.

Sinhala and Tamil consent translations are marked as drafts in their source files and should be reviewed by SLAA's language reviewers. Messaging API settings are reserved for future use; the app does not send SMS or coach invitations automatically.

## Operations

Import a real coach CSV with an owner connection via `IMPORT_DATABASE_URL`. Review errors and warnings before importing; these reports can contain personal data and are ignored by Git. The database currently has no coaches until staff supplies an import.

```bash
IMPORT_DATABASE_URL=<owner-url> npm run import:sheet -- responses.csv --dry-run
IMPORT_DATABASE_URL=<owner-url> npm run import:sheet -- responses.csv
npm run qr -- https://slaa-datacollection.vercel.app/
```

The importer reserves provisional coach ID serials even on a dry run, because PostgreSQL sequence changes do not roll back. Never use the sample fixture as a production import.

People at a stadium may share carrier IP addresses. If legitimate users see rate limits, adjust `RATE_LIMIT_IDENTITY`, `RATE_LIMIT_SEARCH` and `RATE_LIMIT_REGISTER` in Vercel, then redeploy.

The runtime dependency audit is kept separate from development tooling. `shadcn` and Neon configuration tools are build/development dependencies. Next.js's PostCSS dependency is overridden to a patched compatible 8.x release. Development tooling still depends on `braces`, for which npm currently provides no patched release; avoid processing untrusted generator patterns.
