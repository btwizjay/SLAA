-- =====================================================================
-- SLAA National Register — Clean Up and Erase Seed Test Data
-- Removes all mock/seed test records from member and child tables
-- while strictly preserving reference tables (province, district, event, declaration_text).
-- =====================================================================

BEGIN;
SET search_path = slaa, public;

-- Temporarily disable immutability trigger on coach_declaration for cleanup
ALTER TABLE coach_declaration DISABLE TRIGGER coach_declaration_immutable;

-- 1. Identify test member IDs into a temporary table for cascading cleanups
CREATE TEMP TABLE test_member_ids ON COMMIT DROP AS
SELECT slaa_id FROM member
WHERE nic IN (
  '198532002937', -- Mock coach Kavinda Pathirana
  '199214501234', -- Test coach Nuwan Chamara Bandara (Case A)
  '198822003456', -- Test coach Dinesh Priyantha Rathnayake (Case B)
  '199411004321', -- Test coach Kasun Kalhara Jayasuriya (Case D)
  '200412301111', -- Mock athlete Ashan Bhanuka Perera
  '200561202222'  -- Mock athlete Sachini Kavindya Silva
)
OR slaa_id LIKE 'C26-000001%'
OR slaa_id LIKE 'A26-000101%'
OR slaa_id LIKE 'A26-000102%'
OR full_name IN (
  'Kavinda Pathirana',
  'Nuwan Chamara Bandara',
  'Dinesh Priyantha Rathnayake',
  'Kasun Kalhara Jayasuriya',
  'Ashan Bhanuka Perera',
  'Sachini Kavindya Silva',
  'Test Postal Coach'
);

-- 2. Delete coach declarations for test coaches
DELETE FROM coach_declaration
WHERE coach_id IN (SELECT slaa_id FROM test_member_ids);

-- 3. Delete coach qualifications for test coaches
DELETE FROM coach_qualification
WHERE coach_id IN (SELECT slaa_id FROM test_member_ids)
   OR certificate_serial IN ('SLAA-CECS-2021-001', 'WA-2023-8891', 'WA-CECS-2019-771', 'SLAA-2022-441');

-- 4. Delete athlete_coach link records involving test coaches or athletes
DELETE FROM athlete_coach
WHERE coach_id IN (SELECT slaa_id FROM test_member_ids)
   OR athlete_id IN (SELECT slaa_id FROM test_member_ids);

-- 5. Delete coach requests involving test athletes or coaches
DELETE FROM coach_request
WHERE requested_by IN (SELECT slaa_id FROM test_member_ids)
   OR resolved_coach IN (SELECT slaa_id FROM test_member_ids);

-- 6. Delete role table rows
DELETE FROM coach
WHERE slaa_id IN (SELECT slaa_id FROM test_member_ids);

DELETE FROM athlete
WHERE slaa_id IN (SELECT slaa_id FROM test_member_ids);

-- 7. Delete guardians if any associated with test athletes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'slaa' AND table_name = 'guardian') THEN
    DELETE FROM guardian WHERE athlete_id IN (SELECT slaa_id FROM test_member_ids);
  END IF;
END $$;

-- 8. Delete audit log entries for test members
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'slaa' AND table_name = 'audit_log') THEN
    DELETE FROM audit_log
    WHERE slaa_id IN (SELECT slaa_id FROM test_member_ids)
       OR details->>'test_run' = 'true';
  END IF;
END $$;

-- 9. Finally delete member rows
DELETE FROM member
WHERE slaa_id IN (SELECT slaa_id FROM test_member_ids);

-- Re-enable the immutability trigger
ALTER TABLE coach_declaration ENABLE TRIGGER coach_declaration_immutable;

COMMIT;

