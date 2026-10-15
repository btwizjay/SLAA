-- =====================================================================
-- SLAA National Register — ATHLETE DATABASE SCHEMA
-- Dedicated PostgreSQL schema for the Athlete Registration Subsystem.
-- Physical database separation: Contains NO foreign keys referencing
-- the Coach database tables. Coach references are stored as unconstrained text.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS slaa;
SET search_path = slaa, public;

-- ---------------------------------------------------------------------
-- 1. Reference Data: Province & District & Events
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS province (
  name text PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS district (
  name     text PRIMARY KEY,
  province text NOT NULL REFERENCES province(name)
);

CREATE TABLE IF NOT EXISTS event (
  code       text PRIMARY KEY,
  name       text NOT NULL,
  category   text NOT NULL CHECK (category IN
             ('sprints','hurdles','middle_distance','long_distance',
              'jumps','throws','relays','combined','race_walk')),
  sort_order int NOT NULL
);

-- Seed provinces
INSERT INTO province (name) VALUES
  ('Central'), ('Eastern'), ('North Central'), ('Northern'),
  ('North Western'), ('Sabaragamuwa'), ('Southern'), ('Uva'), ('Western')
ON CONFLICT DO NOTHING;

-- Seed districts
INSERT INTO district (name, province) VALUES
  ('Kandy', 'Central'), ('Matale', 'Central'), ('Nuwara Eliya', 'Central'),
  ('Ampara', 'Eastern'), ('Batticaloa', 'Eastern'), ('Trincomalee', 'Eastern'),
  ('Anuradhapura', 'North Central'), ('Polonnaruwa', 'North Central'),
  ('Jaffna', 'Northern'), ('Kilinochchi', 'Northern'), ('Mannar', 'Northern'),
  ('Mullaitivu', 'Northern'), ('Vavuniya', 'Northern'),
  ('Kurunegala', 'North Western'), ('Puttalam', 'North Western'),
  ('Kegalle', 'Sabaragamuwa'), ('Ratnapura', 'Sabaragamuwa'),
  ('Galle', 'Southern'), ('Hambantota', 'Southern'), ('Matara', 'Southern'),
  ('Badulla', 'Uva'), ('Monaragala', 'Uva'),
  ('Colombo', 'Western'), ('Gampaha', 'Western'), ('Kalutara', 'Western')
ON CONFLICT DO NOTHING;

-- Seed events
INSERT INTO event (code, name, category, sort_order) VALUES
  ('100m', '100m', 'sprints', 10),
  ('200m', '200m', 'sprints', 20),
  ('400m', '400m', 'sprints', 30),
  ('800m', '800m', 'middle_distance', 40),
  ('1500m', '1500m', 'middle_distance', 50),
  ('3000m', '3000m', 'long_distance', 60),
  ('5000m', '5000m', 'long_distance', 70),
  ('10000m', '10,000m', 'long_distance', 80),
  ('100mH', '100m Hurdles (Women)', 'hurdles', 90),
  ('110mH', '110m Hurdles (Men)', 'hurdles', 100),
  ('400mH', '400m Hurdles', 'hurdles', 110),
  ('3000mSC', '3000m Steeplechase', 'long_distance', 120),
  ('HJ', 'High Jump', 'jumps', 130),
  ('PV', 'Pole Vault', 'jumps', 140),
  ('LJ', 'Long Jump', 'jumps', 150),
  ('TJ', 'Triple Jump', 'jumps', 160),
  ('SP', 'Shot Put', 'throws', 170),
  ('DT', 'Discus Throw', 'throws', 180),
  ('HT', 'Hammer Throw', 'throws', 190),
  ('JT', 'Javelin Throw', 'throws', 200),
  ('Decathlon', 'Decathlon', 'combined', 210),
  ('Heptathlon', 'Heptathlon', 'combined', 220),
  ('10kmRW', '10km Race Walk', 'race_walk', 230),
  ('20kmRW', '20km Race Walk', 'race_walk', 240),
  ('4x100m', '4x100m Relay', 'relays', 250),
  ('4x400m', '4x400m Relay', 'relays', 260),
  ('4x400mMix', '4x400m Mixed Relay', 'relays', 270)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- 2. NIC Normalisation Function
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION normalize_nic(raw text)
RETURNS char(12) LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v text := upper(regexp_replace(coalesce(raw, ''), '\s', '', 'g'));
  ddd int;
BEGIN
  IF v = '' THEN
    RETURN NULL;
  ELSIF v ~ '^[0-9]{9}[VX]$' THEN
    v := '19' || substr(v, 1, 2) || substr(v, 3, 3) || '0' || substr(v, 6, 4);
  ELSIF v !~ '^[0-9]{12}$' THEN
    RAISE EXCEPTION 'Invalid NIC format: %', raw USING ERRCODE = '22023';
  END IF;

  ddd := substr(v, 5, 3)::int;
  IF NOT (ddd BETWEEN 1 AND 366 OR ddd BETWEEN 501 AND 866) THEN
    RAISE EXCEPTION 'Invalid NIC (day-of-year %): %', ddd, raw USING ERRCODE = '22023';
  END IF;
  RETURN v;
END $$;

-- ---------------------------------------------------------------------
-- 3. SLAA ID Generator for Athletes
-- ---------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS slaa_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS athlete_id_seq START 1;

CREATE OR REPLACE FUNCTION slaa_check_digit(body text)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT (10 - (sum(
           CASE WHEN (len - pos) % 2 = 0
                THEN (d * 2) / 10 + (d * 2) % 10
                ELSE d END) % 10)) % 10
  FROM (SELECT d::int, pos, length(digits) AS len
        FROM (SELECT regexp_replace(body, '\D', '', 'g') AS digits) s,
             LATERAL unnest(string_to_array(digits, NULL)) WITH ORDINALITY AS t(d, pos)) x;
$$;

CREATE OR REPLACE FUNCTION new_slaa_id(kind char)
RETURNS text LANGUAGE plpgsql
SET search_path = slaa, public AS $$
DECLARE
  body   text;
  serial bigint;
BEGIN
  serial := CASE upper(kind)
              WHEN 'A' THEN nextval('athlete_id_seq')
              ELSE nextval('slaa_id_seq')
            END;
  body := upper(kind) || to_char(now(), 'YY') || '-' || lpad(serial::text, 6, '0');
  RETURN body || '-' || slaa_check_digit(body);
END $$;

-- ---------------------------------------------------------------------
-- 4. Member Base Table (Athlete Database)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS member (
  slaa_id            text PRIMARY KEY DEFAULT new_slaa_id('A'),
  nic                char(12),
  nic_as_entered     text,
  postal_id          text,
  full_name          text NOT NULL,
  name_with_initials text,
  date_of_birth      date NOT NULL,
  gender             char(1) NOT NULL CHECK (gender IN ('M','F')),
  district           text NOT NULL REFERENCES district(name),
  phone              text,
  email              text,
  school_or_club     text,
  consent_version    text NOT NULL,
  consent_at         timestamptz NOT NULL,
  status             text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','verified','merged','suspended')),
  merged_into        text REFERENCES member(slaa_id),
  created_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT has_identity CHECK (nic IS NOT NULL OR postal_id IS NOT NULL),
  CONSTRAINT nic_matches_dob CHECK (
    nic IS NULL OR substr(nic, 1, 4)::int = extract(year FROM date_of_birth)::int),
  CONSTRAINT nic_matches_gender CHECK (
    nic IS NULL OR (substr(nic, 5, 3)::int >= 500) = (gender = 'F'))
);

CREATE UNIQUE INDEX IF NOT EXISTS member_nic_uq
  ON member (nic) WHERE nic IS NOT NULL AND status <> 'merged';
CREATE UNIQUE INDEX IF NOT EXISTS member_postal_uq
  ON member (postal_id) WHERE postal_id IS NOT NULL AND status <> 'merged';
CREATE INDEX IF NOT EXISTS member_name_dob_idx
  ON member (lower(full_name), date_of_birth, district);
CREATE INDEX IF NOT EXISTS member_school_or_club_idx
  ON member (lower(school_or_club)) WHERE school_or_club IS NOT NULL;

CREATE OR REPLACE FUNCTION member_before_write()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.nic_as_entered IS NOT NULL THEN
    NEW.nic := normalize_nic(NEW.nic_as_entered);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS member_normalize ON member;
CREATE TRIGGER member_normalize BEFORE INSERT OR UPDATE OF nic_as_entered ON member
FOR EACH ROW EXECUTE FUNCTION member_before_write();

-- ---------------------------------------------------------------------
-- 5. Athlete Profile Table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS athlete (
  slaa_id          text PRIMARY KEY REFERENCES member(slaa_id) ON DELETE CASCADE,
  school_or_club   text,
  main_events      text[] NOT NULL DEFAULT '{}'
);

-- Event code validation trigger on athlete main_events
CREATE OR REPLACE FUNCTION check_event_codes()
RETURNS trigger LANGUAGE plpgsql
SET search_path = slaa, public AS $$
DECLARE
  codes text[];
  bad   text;
BEGIN
  codes := NEW.main_events;
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

DROP TRIGGER IF EXISTS athlete_events_valid ON athlete;
CREATE TRIGGER athlete_events_valid BEFORE INSERT OR UPDATE OF main_events ON athlete
FOR EACH ROW EXECUTE FUNCTION check_event_codes();

-- Sync athlete.school_or_club up to member.school_or_club
CREATE OR REPLACE FUNCTION sync_member_school_or_club()
RETURNS trigger LANGUAGE plpgsql
SET search_path = slaa, public AS $$
BEGIN
  UPDATE member SET school_or_club = NEW.school_or_club
  WHERE slaa_id = NEW.slaa_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS athlete_sync_school ON athlete;
CREATE TRIGGER athlete_sync_school
  AFTER INSERT OR UPDATE OF school_or_club ON athlete
  FOR EACH ROW EXECUTE FUNCTION sync_member_school_or_club();

-- ---------------------------------------------------------------------
-- 6. Guardian Details (for athletes under 18)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guardian (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  athlete_id       text NOT NULL REFERENCES athlete(slaa_id) ON DELETE CASCADE,
  full_name        text NOT NULL,
  relationship     text NOT NULL,
  phone            text NOT NULL,
  nic              text,
  consent_given_at timestamptz NOT NULL,
  consent_ip       inet
);
CREATE INDEX IF NOT EXISTS guardian_athlete_idx ON guardian (athlete_id);

-- ---------------------------------------------------------------------
-- 7. Coach Requests (Athlete DB)
-- Note: resolved_coach has NO foreign key to Coach DB
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coach_request (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  requested_by     text NOT NULL REFERENCES athlete(slaa_id) ON DELETE CASCADE,
  coach_name       text NOT NULL,
  coach_phone      text,
  coach_district   text REFERENCES district(name),
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','invited','registered','rejected')),
  resolved_coach   text,  -- Unconstrained text pointing to Coach SLAA ID
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 8. Athlete–Coach History (Athlete DB)
-- Note: coach_id has NO foreign key constraint to Coach DB.
-- Coach existence and active status is validated in application code.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS athlete_coach (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  athlete_id           text NOT NULL REFERENCES athlete(slaa_id) ON DELETE CASCADE,
  coach_id             text NOT NULL,  -- Unconstrained text pointing to Coach SLAA ID
  relationship_type    text NOT NULL CHECK (relationship_type IN ('CURRENT','PAST')),
  is_primary           boolean NOT NULL DEFAULT false,
  start_year           smallint CHECK (start_year BETWEEN 1950 AND 2100),
  end_year             smallint CHECK (end_year BETWEEN 1950 AND 2100),
  is_approved_by_coach boolean NOT NULL DEFAULT false,
  coach_confirmed_at   timestamptz,
  transfer_acknowledged boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT years_in_order CHECK (end_year IS NULL OR start_year IS NULL OR end_year >= start_year),
  CONSTRAINT current_has_no_end CHECK (relationship_type = 'PAST' OR end_year IS NULL),
  CONSTRAINT no_self_coaching CHECK (athlete_id <> coach_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS athlete_coach_current_uq
  ON athlete_coach (athlete_id, coach_id) WHERE relationship_type = 'CURRENT';
CREATE UNIQUE INDEX IF NOT EXISTS athlete_coach_primary_uq
  ON athlete_coach (athlete_id) WHERE relationship_type = 'CURRENT' AND is_primary;

-- ---------------------------------------------------------------------
-- 9. Masked Public Lookup & Duplicate Check
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

CREATE OR REPLACE FUNCTION find_existing_member(
  p_nic text DEFAULT NULL,
  p_postal_id text DEFAULT NULL)
RETURNS TABLE (slaa_id text, name_with_initials text, district text, match_on text)
LANGUAGE sql STABLE AS $$
  SELECT m.slaa_id, m.name_with_initials, m.district, 'nic'
  FROM member m
  WHERE p_nic IS NOT NULL AND m.nic = normalize_nic(p_nic) AND m.status <> 'merged'
  UNION ALL
  SELECT m.slaa_id, m.name_with_initials, m.district, 'postal_id'
  FROM member m
  WHERE p_postal_id IS NOT NULL AND m.postal_id = p_postal_id AND m.status <> 'merged';
$$;

CREATE OR REPLACE FUNCTION find_existing_member_public(
  p_nic text DEFAULT NULL,
  p_postal_id text DEFAULT NULL)
RETURNS TABLE (slaa_id text, masked_name text, district text)
LANGUAGE sql STABLE
SET search_path = slaa, public AS $$
  SELECT DISTINCT f.slaa_id,
         mask_name(coalesce(nullif(m.name_with_initials, ''), m.full_name)),
         f.district
  FROM find_existing_member(p_nic, p_postal_id) f
  JOIN member m ON m.slaa_id = f.slaa_id;
$$;

-- ---------------------------------------------------------------------
-- 10. Audit Log & Rate Limiting
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at       timestamptz NOT NULL DEFAULT now(),
  actor    text NOT NULL,
  action   text NOT NULL,
  slaa_id  text,
  details  jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS audit_log_slaa_idx ON audit_log (slaa_id, at);

CREATE TABLE IF NOT EXISTS rate_limit (
  key          text NOT NULL,
  window_start timestamptz NOT NULL,
  hits         int NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

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
  IF random() < 0.01 THEN
    DELETE FROM rate_limit WHERE window_start < now() - interval '1 hour';
  END IF;
  RETURN n <= p_limit;
END $$;

-- ---------------------------------------------------------------------
-- 11. Admin Deletion for Athlete Database
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_delete_member(p_slaa_id text, p_actor text, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = slaa, public AS $$
BEGIN
  PERFORM 1 FROM member WHERE slaa_id = p_slaa_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No athlete with SLAA ID %', p_slaa_id USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM athlete_coach WHERE athlete_id = p_slaa_id;
  DELETE FROM coach_request WHERE requested_by = p_slaa_id;
  DELETE FROM guardian WHERE athlete_id = p_slaa_id;
  DELETE FROM athlete WHERE slaa_id = p_slaa_id;
  DELETE FROM member WHERE slaa_id = p_slaa_id;

  INSERT INTO audit_log (actor, action, slaa_id, details)
  VALUES (p_actor, 'delete', p_slaa_id, jsonb_build_object('reason', p_reason, 'role', 'athlete'));
END $$;

-- ---------------------------------------------------------------------
-- 12. Role & Permissions for slaa_app
-- ---------------------------------------------------------------------
DO $$ BEGIN
  CREATE ROLE slaa_app LOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER ROLE slaa_app SET search_path = slaa, public;
GRANT USAGE ON SCHEMA slaa TO slaa_app;
REVOKE ALL ON ALL TABLES IN SCHEMA slaa FROM slaa_app;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA slaa TO slaa_app;
GRANT UPDATE ON member, athlete, athlete_coach, coach_request, guardian TO slaa_app;
GRANT UPDATE ON rate_limit TO slaa_app;
GRANT DELETE ON rate_limit TO slaa_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA slaa TO slaa_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA slaa TO slaa_app;

