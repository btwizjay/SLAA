-- =====================================================================
-- SLAA National Register — app additions (apply after 001_schema.sql)
-- See IMPLEMENTATION_PLAN section 4. Does not alter anything 001 defines
-- except new_slaa_id(kind), which keeps the same format and check digit.
-- =====================================================================

SET search_path = slaa, public;

-- ---------------------------------------------------------------------
-- 1. Reference data (rows are in seed_reference.sql)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS province (
  name text PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS district (
  name     text PRIMARY KEY,
  province text NOT NULL REFERENCES province(name)
);

CREATE TABLE IF NOT EXISTS event (
  code       text PRIMARY KEY,         -- e.g. '100m', 'HJ', '4x400m'
  name       text NOT NULL,
  category   text NOT NULL CHECK (category IN
             ('sprints','hurdles','middle_distance','long_distance',
              'jumps','throws','relays','combined','race_walk')),
  sort_order int NOT NULL
);

-- member.district and coach_request.coach_district must be a real district
DO $$ BEGIN
  ALTER TABLE member ADD CONSTRAINT member_district_fk
    FOREIGN KEY (district) REFERENCES district(name);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE coach_request ADD CONSTRAINT coach_request_district_fk
    FOREIGN KEY (coach_district) REFERENCES district(name);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Arrays cannot carry a foreign key, so a trigger checks each element.
CREATE OR REPLACE FUNCTION check_event_codes()
RETURNS trigger LANGUAGE plpgsql
  SET search_path = slaa, public AS $$
DECLARE
  codes text[];
  bad   text;
BEGIN
  IF TG_TABLE_NAME = 'coach' THEN
    codes := NEW.disciplines;
  ELSE
    codes := NEW.main_events;
  END IF;

  SELECT c INTO bad
  FROM unnest(codes) AS c
  WHERE NOT EXISTS (SELECT 1 FROM event e WHERE e.code = c)
  LIMIT 1;

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Unknown event code: %', bad
      USING ERRCODE = '23514', CONSTRAINT = TG_TABLE_NAME || '_events_valid';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS coach_events_valid ON coach;
CREATE TRIGGER coach_events_valid BEFORE INSERT OR UPDATE OF disciplines ON coach
FOR EACH ROW EXECUTE FUNCTION check_event_codes();

DROP TRIGGER IF EXISTS athlete_events_valid ON athlete;
CREATE TRIGGER athlete_events_valid BEFORE INSERT OR UPDATE OF main_events ON athlete
FOR EACH ROW EXECUTE FUNCTION check_event_codes();

-- ---------------------------------------------------------------------
-- 2. Guardian details for athletes under 18
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guardian (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  athlete_id       text NOT NULL REFERENCES athlete(slaa_id),
  full_name        text NOT NULL,
  relationship     text NOT NULL,
  phone            text NOT NULL,
  nic              text,
  consent_given_at timestamptz NOT NULL,
  consent_ip       inet
);
CREATE INDEX IF NOT EXISTS guardian_athlete_idx ON guardian (athlete_id);

-- ---------------------------------------------------------------------
-- 3. Consent record (PDPA), versioned
-- ---------------------------------------------------------------------
ALTER TABLE member ADD COLUMN IF NOT EXISTS consent_version text NOT NULL;
ALTER TABLE member ADD COLUMN IF NOT EXISTS consent_at timestamptz NOT NULL;

-- ---------------------------------------------------------------------
-- 4. Masked lookup for the public. The public API calls only this.
--    'K. P. Perera' -> 'K. P*****'
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mask_name(name text)
RETURNS text LANGUAGE sql IMMUTABLE
  SET search_path = slaa, public AS $$
  WITH w AS (
    SELECT array_remove(regexp_split_to_array(trim(coalesce(name, '')), '[\s.]+'), '') AS words
  )
  SELECT CASE
    WHEN cardinality(words) = 0 THEN ''
    WHEN cardinality(words) = 1 THEN
      upper(left(words[1], 1)) || repeat('*', greatest(length(words[1]) - 1, 1))
    ELSE
      upper(left(words[1], 1)) || '. ' ||
      upper(left(words[cardinality(words)], 1)) ||
      repeat('*', greatest(length(words[cardinality(words)]) - 1, 1))
  END
  FROM w;
$$;

CREATE OR REPLACE FUNCTION find_existing_member_public(
  p_nic text DEFAULT NULL,
  p_postal_id text DEFAULT NULL,
  p_birth_cert_division text DEFAULT NULL,
  p_birth_cert_no text DEFAULT NULL)
RETURNS TABLE (slaa_id text, masked_name text, district text)
LANGUAGE sql STABLE
SET search_path = slaa, public AS $$
  SELECT DISTINCT f.slaa_id,
         mask_name(coalesce(nullif(m.name_with_initials, ''), m.full_name)),
         f.district
  FROM find_existing_member(p_nic, p_postal_id, p_birth_cert_division, p_birth_cert_no) f
  JOIN member m ON m.slaa_id = f.slaa_id;
$$;

-- ---------------------------------------------------------------------
-- 5. Audit log (append only for the app role, see section 7)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at       timestamptz NOT NULL DEFAULT now(),
  actor    text NOT NULL,          -- 'public', 'import', or an admin email
  action   text NOT NULL,          -- 'register_coach', 'verify', 'merge', 'export', ...
  slaa_id  text,
  details  jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS audit_log_slaa_idx ON audit_log (slaa_id, at);

-- ---------------------------------------------------------------------
-- 6. Separate ID sequences per type. Format and check digit unchanged.
--    Officials ('O') keep using slaa_id_seq from 001.
-- ---------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS coach_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS athlete_id_seq START 1;

CREATE OR REPLACE FUNCTION new_slaa_id(kind char)
RETURNS text LANGUAGE plpgsql
  SET search_path = slaa, public AS $$
DECLARE
  body   text;
  serial bigint;
BEGIN
  serial := CASE upper(kind)
              WHEN 'C' THEN nextval('coach_id_seq')
              WHEN 'A' THEN nextval('athlete_id_seq')
              ELSE nextval('slaa_id_seq')
            END;
  body := upper(kind) || to_char(now(), 'YY') || '-' || lpad(serial::text, 6, '0');
  RETURN body || '-' || slaa_check_digit(body);
END $$;

-- ---------------------------------------------------------------------
-- Public rate limiting (Vercel functions share no memory, so the counter
-- lives here). Keys are hashed IPs, never raw addresses.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limit (
  key          text NOT NULL,
  window_start timestamptz NOT NULL,
  hits         int NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

-- Returns true when the request is allowed.
CREATE OR REPLACE FUNCTION rate_limit_hit(p_key text, p_limit int, p_window interval)
RETURNS boolean LANGUAGE plpgsql
  SET search_path = slaa, public AS $$
DECLARE
  w timestamptz := to_timestamp(floor(extract(epoch FROM now()) / extract(epoch FROM p_window))
                                * extract(epoch FROM p_window));
  n int;
BEGIN
  INSERT INTO rate_limit AS r (key, window_start, hits) VALUES (p_key, w, 1)
  ON CONFLICT (key, window_start) DO UPDATE SET hits = r.hits + 1
  RETURNING hits INTO n;
  -- occasional cleanup of old windows
  IF random() < 0.01 THEN
    DELETE FROM rate_limit WHERE window_start < now() - interval '1 hour';
  END IF;
  RETURN n <= p_limit;
END $$;

-- ---------------------------------------------------------------------
-- 7. Database role for the app
--    SELECT/INSERT everywhere; UPDATE only where admin actions need it;
--    no DELETE; audit_log is insert/select only.
-- ---------------------------------------------------------------------
DO $$ BEGIN
  CREATE ROLE slaa_app LOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Set the password separately, outside version control:
--   ALTER ROLE slaa_app PASSWORD '...';

ALTER ROLE slaa_app SET search_path = slaa, public;

GRANT USAGE ON SCHEMA slaa TO slaa_app;
REVOKE ALL ON ALL TABLES IN SCHEMA slaa FROM slaa_app;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA slaa TO slaa_app;
GRANT UPDATE ON member, coach, athlete, athlete_coach, coach_request, guardian TO slaa_app;
GRANT UPDATE ON rate_limit TO slaa_app;
GRANT DELETE ON rate_limit TO slaa_app;   -- cleanup of expired windows only
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA slaa TO slaa_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA slaa TO slaa_app;
