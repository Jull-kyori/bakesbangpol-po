CREATE TABLE admin_sessions (
  token_hash TEXT PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX admin_sessions_expires_at_idx ON admin_sessions (expires_at);

CREATE TABLE rate_limit_buckets (
  bucket_key TEXT PRIMARY KEY CHECK (bucket_key ~ '^[a-f0-9]{64}$'),
  count INTEGER NOT NULL CHECK (count > 0),
  reset_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX rate_limit_buckets_reset_at_idx ON rate_limit_buckets (reset_at);
