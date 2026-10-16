SET search_path = slaa, public;
CREATE TABLE IF NOT EXISTS admin_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email = lower(trim(email))),
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('owner', 'admin')),
  active boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);
CREATE TABLE IF NOT EXISTS admin_session (
  id uuid PRIMARY KEY,
  staff_id uuid NOT NULL REFERENCES admin_staff(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS admin_session_staff_idx ON admin_session(staff_id);
GRANT SELECT, INSERT, UPDATE ON admin_staff, admin_session TO slaa_app;
ALTER TABLE member ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE OR REPLACE FUNCTION member_stamp_update() RETURNS trigger LANGUAGE plpgsql
SET search_path = slaa, public AS $$ BEGIN NEW.updated_at := clock_timestamp(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS member_updated ON member;
CREATE TRIGGER member_updated BEFORE UPDATE ON member FOR EACH ROW EXECUTE FUNCTION member_stamp_update();
ALTER TABLE athlete_coach ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending'
  CHECK (review_status IN ('pending', 'approved', 'rejected'));
ALTER TABLE athlete_coach ADD COLUMN IF NOT EXISTS reviewed_by text;
ALTER TABLE athlete_coach ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE athlete_coach ADD COLUMN IF NOT EXISTS review_reason text;
UPDATE athlete_coach SET review_status = 'approved' WHERE is_approved_by_coach AND review_status = 'pending';
CREATE OR REPLACE FUNCTION admin_replace_events(p_id text, p_events jsonb, p_actor text, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = slaa, public AS $$
BEGIN
  IF length(trim(coalesce(p_reason, ''))) = 0 OR length(p_reason) > 500 OR length(trim(coalesce(p_actor, ''))) = 0 THEN
    RAISE EXCEPTION 'An actor and reason are required' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM member m JOIN athlete a USING (slaa_id) WHERE m.slaa_id = p_id AND m.status <> 'merged' FOR UPDATE OF m;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active athlete not found' USING ERRCODE = 'P0002'; END IF;
  IF p_events IS NULL OR jsonb_typeof(p_events) IS DISTINCT FROM 'array' OR jsonb_array_length(p_events) NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'Choose between 1 and 20 events' USING ERRCODE = '22023';
  END IF;
  DELETE FROM athlete_event WHERE athlete_id = p_id;
  INSERT INTO athlete_event (athlete_id, event_code, rank, personal_best, pb_year, pb_competition)
    SELECT p_id, e->>'code', n::smallint, nullif(e->>'pb', ''), nullif(e->>'pbYear', '')::smallint, nullif(e->>'pbCompetition', '')
    FROM jsonb_array_elements(p_events) WITH ORDINALITY AS t(e,n);
  UPDATE athlete SET main_events = ARRAY(SELECT event_code FROM athlete_event WHERE athlete_id = p_id ORDER BY rank)
    WHERE slaa_id = p_id;
  INSERT INTO audit_log(actor, action, slaa_id, details)
    VALUES(p_actor, 'edit_events', p_id, jsonb_build_object('reason', p_reason, 'event_count', jsonb_array_length(p_events)));
END $$;
REVOKE ALL ON FUNCTION admin_replace_events(text,jsonb,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_replace_events(text,jsonb,text,text) TO slaa_app;
