CREATE TABLE IF NOT EXISTS admin_activity (
  id BIGSERIAL PRIMARY KEY,
  actor TEXT NOT NULL DEFAULT 'Admin' CHECK (actor = 'Admin'),
  action TEXT NOT NULL CHECK (char_length(action) BETWEEN 1 AND 80),
  detail TEXT NOT NULL DEFAULT '' CHECK (char_length(detail) <= 200),
  outcome TEXT NOT NULL CHECK (outcome IN ('berhasil', 'gagal')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_activity_created_at_idx
  ON admin_activity (created_at DESC, id DESC);
