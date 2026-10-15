-- =====================================================================
-- SLAA National Register — Phase 1 schema (PostgreSQL 14+)
-- One person = one SLAA ID for life. Duplicate registration is blocked
-- by unique constraints on the person's national identity, not by the PK.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS slaa;
SET search_path = slaa, public;

-- ---------------------------------------------------------------------
-- 1. NIC normalisation
-- Old NIC (YYDDDSSSC + V/X) and new NIC (YYYYDDD0SSSC) can belong to the
-- same person. Both are stored in the 12-digit form, so a person cannot
-- register once with each format.
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

  -- day-of-year field: 001-366 for males, 501-866 for females
  ddd := substr(v, 5, 3)::int;
  IF NOT (ddd BETWEEN 1 AND 366 OR ddd BETWEEN 501 AND 866) THEN
    RAISE EXCEPTION 'Invalid NIC (day-of-year %): %', ddd, raw USING ERRCODE = '22023';
  END IF;
  RETURN v;
END $$;

-- ---------------------------------------------------------------------
-- 2. SLAA ID generator
-- Format: A26-000123-4  (type letter, year issued, serial, check digit)
--   A = athlete, C = coach, O = official
-- The check digit catches typing mistakes at registration desks.
-- ---------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS slaa_id_seq START 1;

CREATE OR REPLACE FUNCTION slaa_check_digit(body text)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  -- Luhn mod 10 over the digits of the body
  SELECT (10 - (sum(
           CASE WHEN (len - pos) % 2 = 0
                THEN (d * 2) / 10 + (d * 2) % 10
                ELSE d END) % 10)) % 10
  FROM (SELECT d::int, pos, length(digits) AS len
        FROM (SELECT regexp_replace(body, '\D', '', 'g') AS digits) s,
             LATERAL unnest(string_to_array(digits, NULL)) WITH ORDINALITY AS t(d, pos)) x;
$$;

CREATE OR REPLACE FUNCTION new_slaa_id(kind char)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE body text;
BEGIN
  body := kind || to_char(now(), 'YY') || '-' || lpad(nextval('slaa_id_seq')::text, 6, '0');
  RETURN body || '-' || slaa_check_digit(body);
END $$;

-- ---------------------------------------------------------------------
-- 3. Members: the single identity table (athletes, coaches, officials)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS member (
  slaa_id            text PRIMARY KEY DEFAULT new_slaa_id('A'),
  nic                char(12),                 -- normalised; NULL for juniors under 16
  nic_as_entered     text,                     -- original text, for audit
  postal_id          text,                     -- fallback ID for adults without NIC
  birth_cert_no      text,                     -- juniors
  birth_cert_division text,                    -- registrar division that issued it
  full_name          text NOT NULL,
  name_with_initials text,
  date_of_birth      date NOT NULL,
  gender             char(1) NOT NULL CHECK (gender IN ('M','F')),
  district           text NOT NULL,
  phone              text,
  email              text,
  status             text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','verified','merged','suspended')),
  merged_into        text REFERENCES member(slaa_id),
  created_at         timestamptz NOT NULL DEFAULT now(),

  -- every member must carry at least one government identity
  CONSTRAINT has_identity CHECK (
    nic IS NOT NULL OR postal_id IS NOT NULL
    OR (birth_cert_no IS NOT NULL AND birth_cert_division IS NOT NULL)),

  -- NIC birth date must match the stated date of birth (year check)
  CONSTRAINT nic_matches_dob CHECK (
    nic IS NULL OR substr(nic, 1, 4)::int = extract(year FROM date_of_birth)::int),

  -- NIC encodes gender: day-of-year >= 500 means female
  CONSTRAINT nic_matches_gender CHECK (
    nic IS NULL OR (substr(nic, 5, 3)::int >= 500) = (gender = 'F'))
);

-- These are what actually stop a second account for the same person.
CREATE UNIQUE INDEX IF NOT EXISTS member_nic_uq
  ON member (nic) WHERE nic IS NOT NULL AND status <> 'merged';
CREATE UNIQUE INDEX IF NOT EXISTS member_postal_uq
  ON member (postal_id) WHERE postal_id IS NOT NULL AND status <> 'merged';
CREATE UNIQUE INDEX IF NOT EXISTS member_birth_cert_uq
  ON member (birth_cert_division, birth_cert_no)
  WHERE birth_cert_no IS NOT NULL AND status <> 'merged';

-- Soft duplicate check (same name + DOB + district) for staff review
CREATE INDEX IF NOT EXISTS member_name_dob_idx
  ON member (lower(full_name), date_of_birth, district);

-- Normalise the NIC on every insert/update, whatever format was typed
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
-- 4. Role profiles (one person can be both athlete and coach)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coach (
  slaa_id          text PRIMARY KEY REFERENCES member(slaa_id),
  slaa_license_no  text UNIQUE,
  license_level    text,
  disciplines      text[] NOT NULL DEFAULT '{}',
  is_verified      boolean NOT NULL DEFAULT false,
  verified_by      text,
  verified_at      timestamptz
);

CREATE TABLE IF NOT EXISTS athlete (
  slaa_id          text PRIMARY KEY REFERENCES member(slaa_id),
  school_or_club   text,
  main_events      text[] NOT NULL DEFAULT '{}'
);

-- ---------------------------------------------------------------------
-- 5. Coach requested by an athlete but not yet registered
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coach_request (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  requested_by     text NOT NULL REFERENCES athlete(slaa_id),
  coach_name       text NOT NULL,
  coach_phone      text NOT NULL,
  coach_district   text,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','invited','registered','rejected')),
  resolved_coach   text REFERENCES coach(slaa_id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 6. Athlete–coach history
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS athlete_coach (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  athlete_id           text NOT NULL REFERENCES athlete(slaa_id),
  coach_id             text NOT NULL REFERENCES coach(slaa_id),
  relationship_type    text NOT NULL CHECK (relationship_type IN ('CURRENT','PAST')),
  is_primary           boolean NOT NULL DEFAULT false,
  start_year           smallint CHECK (start_year BETWEEN 1950 AND 2100),
  end_year             smallint CHECK (end_year BETWEEN 1950 AND 2100),
  is_approved_by_coach boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT years_in_order CHECK (end_year IS NULL OR start_year IS NULL OR end_year >= start_year),
  CONSTRAINT current_has_no_end CHECK (relationship_type = 'PAST' OR end_year IS NULL),
  CONSTRAINT no_self_coaching CHECK (athlete_id <> coach_id)
);

-- the same coach cannot be listed twice as current for one athlete
CREATE UNIQUE INDEX IF NOT EXISTS athlete_coach_current_uq
  ON athlete_coach (athlete_id, coach_id) WHERE relationship_type = 'CURRENT';
-- at most one primary current coach per athlete
CREATE UNIQUE INDEX IF NOT EXISTS athlete_coach_primary_uq
  ON athlete_coach (athlete_id) WHERE relationship_type = 'CURRENT' AND is_primary;

-- ---------------------------------------------------------------------
-- 7. Registration lookup: call this BEFORE showing the sign-up form.
-- If it returns a row, the person is already registered; send them to
-- "recover my account" instead of creating a new one.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION find_existing_member(
  p_nic text DEFAULT NULL,
  p_postal_id text DEFAULT NULL,
  p_birth_cert_division text DEFAULT NULL,
  p_birth_cert_no text DEFAULT NULL)
RETURNS TABLE (slaa_id text, name_with_initials text, district text, match_on text)
LANGUAGE sql STABLE AS $$
  SELECT m.slaa_id, m.name_with_initials, m.district, 'nic'
  FROM member m
  WHERE p_nic IS NOT NULL AND m.nic = normalize_nic(p_nic) AND m.status <> 'merged'
  UNION ALL
  SELECT m.slaa_id, m.name_with_initials, m.district, 'postal_id'
  FROM member m
  WHERE p_postal_id IS NOT NULL AND m.postal_id = p_postal_id AND m.status <> 'merged'
  UNION ALL
  SELECT m.slaa_id, m.name_with_initials, m.district, 'birth_certificate'
  FROM member m
  WHERE p_birth_cert_no IS NOT NULL
    AND m.birth_cert_division = p_birth_cert_division
    AND m.birth_cert_no = p_birth_cert_no
    AND m.status <> 'merged';
$$;
