CREATE TABLE app_state (
  key TEXT PRIMARY KEY CHECK (key IN ('berita', 'komentar', 'site-settings')),
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT app_state_value_shape CHECK (
    (key = 'berita' AND jsonb_typeof(value) = 'array')
    OR (
      key = 'komentar'
      AND jsonb_typeof(value) = 'object'
      AND COALESCE(jsonb_typeof(value -> 'comments') = 'array', FALSE)
      AND COALESCE(jsonb_typeof(value -> 'reactions') = 'array', FALSE)
      AND COALESCE(jsonb_typeof(value -> 'reports') = 'array', FALSE)
    )
    OR (key = 'site-settings' AND jsonb_typeof(value) = 'object')
  )
);
