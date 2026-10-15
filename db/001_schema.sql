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

-- =====================================================================
-- 8. Coach qualifications and declarations
-- Based on the World Athletics Coaches Education and Certification
-- System (CECS, formerly IAAF Academy). Level names below must be
-- confirmed with SLAA before go-live.
-- =====================================================================

-- 8.1 Qualifications (a coach can hold several)
CREATE TABLE IF NOT EXISTS coach_qualification (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  coach_id            text NOT NULL REFERENCES coach(slaa_id),
  level               text NOT NULL CHECK (level IN (
                        'CECS_L1_YOUTH',        -- Level I  Youth / Introductory
                        'CECS_L2_EVENT',        -- Level II Event Specialist
                        'CECS_L3_ELITE',        -- Level III Elite / High Performance
                        'SLAA_NATIONAL',        -- national federation course
                        'UNIVERSITY_SPORT_SCI', -- degree / diploma in sports science
                        'OTHER')),
  level_other_text    text,                     -- required when level = 'OTHER'
  event_group         text,                     -- sprints, jumps, throws, endurance, combined
  issuing_body        text NOT NULL,            -- 'World Athletics', 'SLAA', ...
  certificate_serial  text,
  year_awarded        smallint NOT NULL CHECK (year_awarded BETWEEN 1970 AND 2100),
  document_path       text,                     -- private storage key, never a public URL
  verification_status text NOT NULL DEFAULT 'unverified'
                      CHECK (verification_status IN ('unverified','verified','rejected')),
  verified_by         text,
  verified_at         timestamptz,
  rejection_reason    text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT other_needs_text CHECK (level <> 'OTHER' OR level_other_text IS NOT NULL),
  CONSTRAINT rejected_needs_reason CHECK (verification_status <> 'rejected' OR rejection_reason IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS coach_qualification_serial_uq
  ON coach_qualification (issuing_body, certificate_serial)
  WHERE certificate_serial IS NOT NULL;   -- one certificate cannot be claimed by two coaches

-- 8.2 Declaration wording, versioned. Changing wording = new version.
CREATE TABLE IF NOT EXISTS declaration_text (
  code          text NOT NULL,
  version       int  NOT NULL,
  section       text NOT NULL CHECK (section IN
                  ('certification','safeguarding','integrity','athletes','legal')),
  title         text NOT NULL,
  text_en       text NOT NULL,
  text_si       text,
  text_ta       text,
  allows_disclosure boolean NOT NULL DEFAULT false, -- coach may answer "I need to disclose"
  required      boolean NOT NULL DEFAULT true,
  active        boolean NOT NULL DEFAULT true,
  PRIMARY KEY (code, version)
);

-- 8.3 What each coach answered. Append-only: never updated or deleted.
CREATE TABLE IF NOT EXISTS coach_declaration (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  coach_id           text NOT NULL REFERENCES coach(slaa_id),
  code               text NOT NULL,
  version            int  NOT NULL,
  answer             text NOT NULL CHECK (answer IN ('confirm','disclose')),
  disclosure_details text,
  signed_name        text NOT NULL,          -- coach types full name as signature
  accepted_at        timestamptz NOT NULL DEFAULT now(),
  ip_address         inet,
  user_agent         text,
  review_status      text NOT NULL DEFAULT 'not_needed'
                     CHECK (review_status IN ('not_needed','pending','cleared','upheld')),
  reviewed_by        text,
  reviewed_at        timestamptz,
  FOREIGN KEY (code, version) REFERENCES declaration_text(code, version),
  CONSTRAINT disclose_needs_details CHECK (answer = 'confirm' OR length(trim(disclosure_details)) > 0),
  CONSTRAINT disclose_needs_review CHECK (answer = 'confirm' OR review_status <> 'not_needed')
);
CREATE INDEX IF NOT EXISTS coach_declaration_coach_idx ON coach_declaration (coach_id, code);

CREATE OR REPLACE FUNCTION coach_declaration_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Declarations cannot be deleted';
  END IF;
  -- only the review columns may change after signing
  IF (NEW.coach_id, NEW.code, NEW.version, NEW.answer, NEW.disclosure_details,
      NEW.signed_name, NEW.accepted_at)
     IS DISTINCT FROM
     (OLD.coach_id, OLD.code, OLD.version, OLD.answer, OLD.disclosure_details,
      OLD.signed_name, OLD.accepted_at) THEN
    RAISE EXCEPTION 'A signed declaration cannot be changed; record a new one';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS coach_declaration_immutable ON coach_declaration;
CREATE TRIGGER coach_declaration_immutable BEFORE UPDATE OR DELETE ON coach_declaration
FOR EACH ROW EXECUTE FUNCTION coach_declaration_guard();

-- 8.4 Missing or unresolved declarations for a coach (empty = complete)
CREATE OR REPLACE FUNCTION coach_declaration_gaps(p_coach text)
RETURNS TABLE (code text, version int, problem text)
LANGUAGE sql STABLE AS $$
  SELECT t.code, t.version,
         CASE
           WHEN d.id IS NULL THEN 'not signed'
           WHEN d.review_status = 'pending' THEN 'disclosure awaiting review'
           WHEN d.review_status = 'upheld' THEN 'disclosure upheld'
         END
  FROM declaration_text t
  LEFT JOIN LATERAL (
    SELECT * FROM coach_declaration cd
    WHERE cd.coach_id = p_coach AND cd.code = t.code AND cd.version = t.version
    ORDER BY cd.accepted_at DESC LIMIT 1) d ON true
  WHERE t.active AND t.required
    AND (d.id IS NULL OR d.review_status IN ('pending','upheld'));
$$;

-- 8.5 A coach cannot be marked verified with gaps or no verified qualification
CREATE OR REPLACE FUNCTION coach_verify_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_verified AND NOT coalesce(OLD.is_verified, false) THEN
    IF EXISTS (SELECT 1 FROM coach_declaration_gaps(NEW.slaa_id)) THEN
      RAISE EXCEPTION 'Coach % has missing or unresolved declarations', NEW.slaa_id
        USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM coach_qualification q
                   WHERE q.coach_id = NEW.slaa_id AND q.verification_status = 'verified') THEN
      RAISE EXCEPTION 'Coach % has no verified qualification', NEW.slaa_id
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS coach_verify_check ON coach;
CREATE TRIGGER coach_verify_check BEFORE UPDATE OF is_verified ON coach
FOR EACH ROW EXECUTE FUNCTION coach_verify_guard();

-- 8.6 Coach confirmation of an athlete link records who confirmed and when
ALTER TABLE athlete_coach
  ADD COLUMN IF NOT EXISTS coach_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS transfer_acknowledged boolean NOT NULL DEFAULT false;

-- 8.7 Declaration wording, version 1 (English). Have SLAA's legal adviser
-- review before go-live; add Sinhala and Tamil in text_si / text_ta.
INSERT INTO declaration_text (code, version, section, title, text_en, allows_disclosure) VALUES
('CERT_LEVEL', 1, 'certification', 'Highest qualification',
 'I confirm that the qualifications I have listed, including level, issuing body, year awarded and certificate number, are my own and are accurate.', false),
('DOC_AUTHENTIC', 1, 'certification', 'Genuine documents',
 'I confirm that every certificate, transcript and licence I upload is a genuine, unaltered copy of the original.', false),
('NO_CONVICTIONS', 1, 'safeguarding', 'Criminal record',
 'I confirm that I have no criminal convictions, and no pending investigations or charges, relating to sexual offences, exploitation, child abuse or neglect, or violence. If this is not true for me, I will choose "I need to disclose" and give details.', true),
('POLICE_CLEARANCE', 1, 'safeguarding', 'Police clearance',
 'I agree to provide a current Police Clearance Certificate when SLAA requests it, and to tell SLAA within 14 days if I am charged with or convicted of any offence.', false),
('SAFEGUARDING_CODE', 1, 'safeguarding', 'Safeguarding code of conduct',
 'I agree to follow the SLAA safeguarding code of conduct: keep appropriate physical and communication boundaries with athletes, never be alone in private with a minor where avoidable, keep a parent or guardian included in messages to athletes under 18, ensure a safe training environment, and report any concern about abuse to the SLAA safeguarding officer.', false),
('NO_DOPING_SANCTION', 1, 'integrity', 'Anti-doping record',
 'I confirm that I am not currently serving a sanction or provisional suspension under the World Anti-Doping Code, from the Sri Lanka Anti-Doping Agency (SLADA), the Athletics Integrity Unit (AIU) or any sport body. If this is not true for me, I will choose "I need to disclose" and give details.', true),
('CLEAN_SPORT', 1, 'integrity', 'Commitment to clean sport',
 'I will not administer, supply, traffic, encourage or help hide the use of any prohibited substance or method, and I will support my athletes to meet their anti-doping obligations.', false),
('NO_MANIPULATION', 1, 'integrity', 'Competition manipulation',
 'I will not take part in fixing or manipulating any competition, betting on athletics events involving my athletes, or sharing inside information for betting.', false),
('ATHLETE_ROSTER', 1, 'athletes', 'Athletes I coach',
 'I confirm that every athlete I list as current is actively training under my supervision, and that the coaching periods I give for past athletes are accurate.', false),
('TRANSFER_RULES', 1, 'athletes', 'Athlete transfers',
 'I confirm that, to my knowledge, athletes who moved to or from me did so in line with SLAA transfer rules and without an unresolved dispute.', false),
('TRUE_INFORMATION', 1, 'legal', 'Truth of information',
 'I confirm that all information in this application is true, complete and accurate. I understand that false information or credentials will lead to disciplinary action and revocation of my registration or accreditation.', false),
('DATA_CONSENT', 1, 'legal', 'Use of my data',
 'I consent to SLAA storing and processing my personal and professional details in the national athletics database, and sharing them with World Athletics where needed for accreditation, in line with the Personal Data Protection Act No. 9 of 2022.', false),
('VERIFY_CONSENT', 1, 'legal', 'Verification checks',
 'I allow SLAA to check my credentials with the bodies that issued them, my past clubs and schools, World Athletics, SLADA and the AIU.', false)
ON CONFLICT DO NOTHING;
