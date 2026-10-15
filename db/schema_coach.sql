-- =====================================================================
-- SLAA National Register — COACH DATABASE SCHEMA
-- Dedicated PostgreSQL schema for the Coach Registration Subsystem.
-- Physical database separation: Contains NO athlete-specific tables or
-- cross-database foreign key constraints.
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
  code       text PRIMARY KEY,         -- e.g. '100m', 'HJ', '4x400m'
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
-- 3. SLAA ID Generator for Coaches
-- ---------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS slaa_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS coach_id_seq START 1;

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
              WHEN 'C' THEN nextval('coach_id_seq')
              ELSE nextval('slaa_id_seq')
            END;
  body := upper(kind) || to_char(now(), 'YY') || '-' || lpad(serial::text, 6, '0');
  RETURN body || '-' || slaa_check_digit(body);
END $$;

-- ---------------------------------------------------------------------
-- 4. Member Base Table (Coach Database)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS member (
  slaa_id            text PRIMARY KEY DEFAULT new_slaa_id('C'),
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
-- 5. Coach Profile Table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coach (
  slaa_id          text PRIMARY KEY REFERENCES member(slaa_id) ON DELETE CASCADE,
  slaa_license_no  text UNIQUE,
  license_level    text,
  disciplines      text[] NOT NULL DEFAULT '{}',
  is_verified      boolean NOT NULL DEFAULT false,
  verified_by      text,
  verified_at      timestamptz
);

-- Event code validation trigger on coach disciplines
CREATE OR REPLACE FUNCTION check_event_codes()
RETURNS trigger LANGUAGE plpgsql
SET search_path = slaa, public AS $$
DECLARE
  codes text[];
  bad   text;
BEGIN
  codes := NEW.disciplines;
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

-- ---------------------------------------------------------------------
-- 6. Coach Qualifications (CECS)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coach_qualification (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  coach_id            text NOT NULL REFERENCES coach(slaa_id) ON DELETE CASCADE,
  level               text NOT NULL CHECK (level IN (
                        'CECS_L1_YOUTH',
                        'CECS_L2_EVENT',
                        'CECS_L3_ELITE',
                        'SLAA_NATIONAL',
                        'UNIVERSITY_SPORT_SCI',
                        'OTHER')),
  level_other_text    text,
  event_group         text,
  issuing_body        text NOT NULL,
  certificate_serial  text,
  year_awarded        smallint NOT NULL CHECK (year_awarded BETWEEN 1970 AND 2100),
  document_path       text,
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
  WHERE certificate_serial IS NOT NULL;

-- ---------------------------------------------------------------------
-- 7. Coach Declarations
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS declaration_text (
  code              text NOT NULL,
  version           int  NOT NULL,
  section           text NOT NULL CHECK (section IN
                      ('certification','safeguarding','integrity','athletes','legal')),
  title             text NOT NULL,
  text_en           text NOT NULL,
  text_si           text,
  text_ta           text,
  allows_disclosure boolean NOT NULL DEFAULT false,
  required          boolean NOT NULL DEFAULT true,
  active            boolean NOT NULL DEFAULT true,
  PRIMARY KEY (code, version)
);

CREATE TABLE IF NOT EXISTS coach_declaration (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  coach_id           text NOT NULL REFERENCES coach(slaa_id) ON DELETE CASCADE,
  code               text NOT NULL,
  version            int  NOT NULL,
  answer             text NOT NULL CHECK (answer IN ('confirm','disclose')),
  disclosure_details text,
  signed_name        text NOT NULL,
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

-- Seed declaration wording
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
ON CONFLICT (code, version) DO NOTHING;

-- ---------------------------------------------------------------------
-- 8. Masked Public Lookup & Duplicate Check
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
-- 9. Audit Log & Rate Limiting
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
-- 10. Admin Deletion for Coach Database
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_delete_member(p_slaa_id text, p_actor text, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = slaa, public AS $$
BEGIN
  PERFORM 1 FROM member WHERE slaa_id = p_slaa_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No coach with SLAA ID %', p_slaa_id USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM coach_declaration WHERE coach_id = p_slaa_id;
  DELETE FROM coach_qualification WHERE coach_id = p_slaa_id;
  DELETE FROM coach WHERE slaa_id = p_slaa_id;
  DELETE FROM member WHERE slaa_id = p_slaa_id;

  INSERT INTO audit_log (actor, action, slaa_id, details)
  VALUES (p_actor, 'delete', p_slaa_id, jsonb_build_object('reason', p_reason, 'role', 'coach'));
END $$;

-- ---------------------------------------------------------------------
-- 11. Role & Permissions for slaa_app
-- ---------------------------------------------------------------------
DO $$ BEGIN
  CREATE ROLE slaa_app LOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER ROLE slaa_app SET search_path = slaa, public;
GRANT USAGE ON SCHEMA slaa TO slaa_app;
REVOKE ALL ON ALL TABLES IN SCHEMA slaa FROM slaa_app;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA slaa TO slaa_app;
GRANT UPDATE ON member, coach TO slaa_app;
GRANT UPDATE ON rate_limit TO slaa_app;
GRANT DELETE ON rate_limit TO slaa_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA slaa TO slaa_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA slaa TO slaa_app;

