-- Upgrade the original rate-limit table created by the first MVP.
-- The initial table had a two-column primary key; scoped limits need three columns.
ALTER TABLE write_rate_limits
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'create';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'write_rate_limits'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE write_rate_limits DROP CONSTRAINT write_rate_limits_pkey;
  END IF;
END $$;

ALTER TABLE write_rate_limits
  ADD CONSTRAINT write_rate_limits_pkey PRIMARY KEY (subject_hash, scope, window_start);
