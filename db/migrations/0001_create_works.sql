CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS works (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT NOT NULL UNIQUE,
  owner_session_hash TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('uploading', 'ready', 'deleted', 'failed')),
  original_object_key TEXT,
  share_image_object_key TEXT,
  share_image_url TEXT,
  allow_scribbles BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  shared_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS works_public_ready_idx
  ON works (public_id)
  WHERE status = 'ready' AND deleted_at IS NULL;
