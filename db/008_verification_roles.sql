SET search_path = slaa, public;
ALTER TABLE admin_staff DROP CONSTRAINT IF EXISTS admin_staff_role_check;
ALTER TABLE admin_staff ADD CONSTRAINT admin_staff_role_check
  CHECK (role IN ('owner','admin','supervisor','verifier'));
ALTER TABLE admin_staff ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE admin_staff ADD COLUMN IF NOT EXISTS organization text;

CREATE TABLE IF NOT EXISTS member_verification (
  slaa_id text PRIMARY KEY REFERENCES athlete(slaa_id) ON DELETE CASCADE,
  assignee_id uuid REFERENCES admin_staff(id),
  assigned_by text NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'assigned'
    CHECK (status IN ('assigned','in_progress','callback','needs_review','approved','rejected')),
  follow_up_at timestamptz,
  verified_by text,
  verified_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'approved' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL)),
  CHECK (status <> 'callback' OR follow_up_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS member_verification_assignee_idx ON member_verification(assignee_id,status);
CREATE INDEX IF NOT EXISTS member_verification_followup_idx ON member_verification(follow_up_at) WHERE follow_up_at IS NOT NULL;
CREATE TABLE IF NOT EXISTS verification_contact (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slaa_id text NOT NULL REFERENCES member_verification(slaa_id) ON DELETE CASCADE,
  actor text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('confirmed','no_answer','busy','callback','wrong_number','mismatch','declined')),
  notes text NOT NULL CHECK (length(trim(notes)) BETWEEN 5 AND 2000),
  checks jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(checks) = 'object'),
  follow_up_at timestamptz,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT approved OR outcome='confirmed')
);
CREATE INDEX IF NOT EXISTS verification_contact_member_idx ON verification_contact(slaa_id,created_at DESC,id DESC);
GRANT SELECT, INSERT, UPDATE ON member_verification TO slaa_app;
GRANT SELECT, INSERT ON verification_contact TO slaa_app;
GRANT USAGE, SELECT ON SEQUENCE verification_contact_id_seq TO slaa_app;
