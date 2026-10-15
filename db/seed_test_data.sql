-- =====================================================================
-- SLAA National Register — Test Baseline Seed Data
-- Run this script to populate test data for automated testing.
-- =====================================================================

SET search_path = slaa, public;

-- ---------------------------------------------------------------------
-- 1. Pre-existing Coach (for duplicate identity and lookup testing)
-- ---------------------------------------------------------------------
INSERT INTO member (
  slaa_id, nic, nic_as_entered, full_name, name_with_initials,
  date_of_birth, gender, district, phone, status,
  consent_version, consent_at, created_at
) VALUES (
  'C26-000001-3',
  '198532002937',
  '853202937V',
  'Kavinda Pathirana',
  'K. Pathirana',
  '1985-11-15',
  'M',
  'Gampaha',
  '+94771234567',
  'pending',
  '2026-10-v1',
  now(),
  now()
) ON CONFLICT (slaa_id) DO UPDATE SET
  nic = EXCLUDED.nic,
  nic_as_entered = EXCLUDED.nic_as_entered,
  full_name = EXCLUDED.full_name,
  name_with_initials = EXCLUDED.name_with_initials,
  phone = EXCLUDED.phone;

INSERT INTO coach (
  slaa_id, slaa_license_no, disciplines, is_verified
) VALUES (
  'C26-000001-3',
  'SLAA-C-2021-001',
  ARRAY['100m', '200m'],
  false
) ON CONFLICT (slaa_id) DO UPDATE SET
  slaa_license_no = EXCLUDED.slaa_license_no,
  disciplines = EXCLUDED.disciplines;

INSERT INTO coach_qualification (
  coach_id, level, issuing_body, certificate_serial, year_awarded, verification_status
) VALUES (
  'C26-000001-3',
  'CECS_L1_YOUTH',
  'SLAA',
  'SLAA-CECS-2021-001',
  2021,
  'unverified'
) ON CONFLICT (issuing_body, certificate_serial) DO NOTHING;

-- Sign all 13 standard CECS declarations for the baseline coach
INSERT INTO coach_declaration (
  coach_id, code, version, answer, signed_name, accepted_at, review_status
) VALUES
  ('C26-000001-3', 'CERT_LEVEL', 1, 'confirm', 'Kavinda Pathirana', now(), 'not_needed'),
  ('C26-000001-3', 'DOC_AUTHENTIC', 1, 'confirm', 'Kavinda Pathirana', now(), 'not_needed'),
  ('C26-000001-3', 'NO_CONVICTIONS', 1, 'confirm', 'Kavinda Pathirana', now(), 'not_needed'),
  ('C26-000001-3', 'POLICE_CLEARANCE', 1, 'confirm', 'Kavinda Pathirana', now(), 'not_needed'),
  ('C26-000001-3', 'SAFEGUARDING_CODE', 1, 'confirm', 'Kavinda Pathirana', now(), 'not_needed'),
  ('C26-000001-3', 'NO_DOPING_SANCTION', 1, 'confirm', 'Kavinda Pathirana', now(), 'not_needed'),
  ('C26-000001-3', 'CLEAN_SPORT', 1, 'confirm', 'Kavinda Pathirana', now(), 'not_needed'),
  ('C26-000001-3', 'NO_MANIPULATION', 1, 'confirm', 'Kavinda Pathirana', now(), 'not_needed'),
  ('C26-000001-3', 'ATHLETE_ROSTER', 1, 'confirm', 'Kavinda Pathirana', now(), 'not_needed'),
  ('C26-000001-3', 'TRANSFER_RULES', 1, 'confirm', 'Kavinda Pathirana', now(), 'not_needed'),
  ('C26-000001-3', 'TRUE_INFORMATION', 1, 'confirm', 'Kavinda Pathirana', now(), 'not_needed'),
  ('C26-000001-3', 'DATA_CONSENT', 1, 'confirm', 'Kavinda Pathirana', now(), 'not_needed'),
  ('C26-000001-3', 'VERIFY_CONSENT', 1, 'confirm', 'Kavinda Pathirana', now(), 'not_needed')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- 2. Pre-existing Athletes (for coach athlete-picker search testing)
-- ---------------------------------------------------------------------
INSERT INTO member (
  slaa_id, nic, nic_as_entered, full_name, name_with_initials,
  date_of_birth, gender, district, phone, status,
  consent_version, consent_at, created_at
) VALUES (
  'A26-000101-1',
  '200412301111',
  '200412301111',
  'Ashan Bhanuka Perera',
  'A. B. Perera',
  '2004-05-02',
  'M',
  'Colombo',
  '+94711112233',
  'verified',
  '2026-10-v1',
  now(),
  now()
) ON CONFLICT (slaa_id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  name_with_initials = EXCLUDED.name_with_initials;

INSERT INTO athlete (
  slaa_id, school_or_club, main_events
) VALUES (
  'A26-000101-1',
  'Royal College Colombo',
  ARRAY['100m', '200m']
) ON CONFLICT (slaa_id) DO UPDATE SET
  school_or_club = EXCLUDED.school_or_club,
  main_events = EXCLUDED.main_events;

INSERT INTO member (
  slaa_id, nic, nic_as_entered, full_name, name_with_initials,
  date_of_birth, gender, district, phone, status,
  consent_version, consent_at, created_at
) VALUES (
  'A26-000102-9',
  '200561202222',
  '200561202222',
  'Sachini Kavindya Silva',
  'S. K. Silva',
  '2005-04-22',
  'F',
  'Kandy',
  '+94772223344',
  'verified',
  '2026-10-v1',
  now(),
  now()
) ON CONFLICT (slaa_id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  name_with_initials = EXCLUDED.name_with_initials;

INSERT INTO athlete (
  slaa_id, school_or_club, main_events
) VALUES (
  'A26-000102-9',
  'Mahamaya Girls College Kandy',
  ARRAY['400m', '800m']
) ON CONFLICT (slaa_id) DO UPDATE SET
  school_or_club = EXCLUDED.school_or_club,
  main_events = EXCLUDED.main_events;

