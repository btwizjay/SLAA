-- =====================================================================
-- Admin: permanently delete a member's account and personal details.
-- slaa_app has no DELETE privilege (002 section 7); this one function,
-- owned by the schema owner, is the only way the app can delete. The
-- audit_log row keeps who/when/why, but no personal details.
-- =====================================================================

SET search_path = slaa, public;

CREATE OR REPLACE FUNCTION admin_delete_member(p_slaa_id text, p_actor text, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = slaa, public AS $$
DECLARE
  roles text[];
BEGIN
  PERFORM 1 FROM member WHERE slaa_id = p_slaa_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No member with SLAA ID %', p_slaa_id USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (SELECT 1 FROM member WHERE merged_into = p_slaa_id) THEN
    RAISE EXCEPTION 'Other records were merged into %; it cannot be deleted', p_slaa_id
      USING ERRCODE = '55000';
  END IF;

  roles := array_remove(ARRAY[
    CASE WHEN EXISTS (SELECT 1 FROM coach WHERE slaa_id = p_slaa_id) THEN 'coach' END,
    CASE WHEN EXISTS (SELECT 1 FROM athlete WHERE slaa_id = p_slaa_id) THEN 'athlete' END], NULL);

  DELETE FROM athlete_coach WHERE athlete_id = p_slaa_id OR coach_id = p_slaa_id;
  UPDATE coach_request
     SET resolved_coach = NULL,
         status = CASE WHEN status = 'registered' THEN 'pending' ELSE status END
   WHERE resolved_coach = p_slaa_id;
  DELETE FROM coach_request WHERE requested_by = p_slaa_id;
  DELETE FROM guardian WHERE athlete_id = p_slaa_id;
  DELETE FROM athlete WHERE slaa_id = p_slaa_id;
  DELETE FROM coach WHERE slaa_id = p_slaa_id;
  DELETE FROM member WHERE slaa_id = p_slaa_id;

  INSERT INTO audit_log (actor, action, slaa_id, details)
  VALUES (p_actor, 'delete', p_slaa_id, jsonb_build_object('reason', p_reason, 'roles', roles));
END $$;

REVOKE ALL ON FUNCTION admin_delete_member(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_delete_member(text, text, text) TO slaa_app;
