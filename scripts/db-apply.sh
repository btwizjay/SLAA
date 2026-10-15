#!/usr/bin/env bash
# Apply schema + additions + seed for Coach Registration to the database in $1.
# Usage: scripts/db-apply.sh postgres://localhost/slaa_dev
set -euo pipefail
DB_URL="${1:?database URL required}"
DIR="$(cd "$(dirname "$0")/../db" && pwd)"

# Strictly scoped migrations for Coach Registration (004_athlete_details.sql is EXCLUDED)
FILES=(
  "001_schema.sql"
  "seed_reference.sql"
  "002_app_additions.sql"
  "003_admin_delete.sql"
  "005_tighten_identity_and_school.sql"
  "006_coach_request_phone_optional.sql"
)

for f in "${FILES[@]}"; do
  echo "Applying $f..."
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$DIR/$f"
done

echo "Coach registration database setup complete."
