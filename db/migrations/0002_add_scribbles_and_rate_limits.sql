CREATE TABLE IF NOT EXISTS anonymous_subjects (
  subject_hash TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scribbles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  source_subject_hash TEXT NOT NULL REFERENCES anonymous_subjects(subject_hash),
  object_key TEXT NOT NULL,
  image_url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('visible', 'hidden', 'deleted')) DEFAULT 'visible',
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hidden_at TIMESTAMPTZ,
  UNIQUE (target_work_id, source_subject_hash, idempotency_key)
);

CREATE INDEX IF NOT EXISTS scribbles_visible_target_idx
  ON scribbles (target_work_id, created_at)
  WHERE status = 'visible';

CREATE TABLE IF NOT EXISTS write_rate_limits (
  subject_hash TEXT NOT NULL,
  scope TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (subject_hash, scope, window_start)
);
